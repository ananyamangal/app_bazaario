import crypto from "crypto";

import { Order, type IOrder } from "../models/order.model";
import { Payment } from "../models/payment.model";

const PHONEPE_BASE_URL = process.env.PHONEPE_BASE_URL || "https://api-preprod.phonepe.com/apis/hermes";
const PHONEPE_MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID || "";
const PHONEPE_SALT_KEY = process.env.PHONEPE_SALT_KEY || "";
const PHONEPE_SALT_INDEX = process.env.PHONEPE_SALT_INDEX || "1";

const PHONEPE_PAY_PATH = "/pg/v1/pay";

function requirePhonePeConfig() {
  if (!PHONEPE_MERCHANT_ID || !PHONEPE_SALT_KEY || !PHONEPE_BASE_URL) {
    throw new Error("PhonePe configuration is missing. Please set PHONEPE_BASE_URL, PHONEPE_MERCHANT_ID and PHONEPE_SALT_KEY in server/.env");
  }
}

function buildXVerify(payloadBase64: string, path: string): string {
  const toSign = payloadBase64 + path + PHONEPE_SALT_KEY;
  const hash = crypto.createHash("sha256").update(toSign).digest("hex");
  return `${hash}###${PHONEPE_SALT_INDEX}`;
}

export async function createPhonePePaymentForOrder(order: IOrder, customerPhone: string | undefined) {
  requirePhonePeConfig();

  const amountPaise = Math.round(order.totalAmount * 100); // totalAmount is in rupees
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    throw new Error("Invalid order amount for PhonePe payment");
  }

  const merchantTransactionId = `BAZAARIO_${order._id.toString()}`;

  const payload: any = {
    merchantId: PHONEPE_MERCHANT_ID,
    merchantTransactionId,
    merchantUserId: order.customerId.toString(),
    amount: amountPaise,
    redirectUrl: `${process.env.APP_BASE_URL || ""}/payments/phonepe/redirect`, // optional, mostly for web flows
    callbackUrl: `${process.env.API_BASE_URL || process.env.APP_BASE_URL || ""}/api/payments/phonepe/callback`,
    mobileNumber: customerPhone || undefined,
    paymentInstrument: {
      type: "PAY_PAGE",
    },
  };

  const payloadJson = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadJson).toString("base64");
  const xVerify = buildXVerify(payloadBase64, PHONEPE_PAY_PATH);

  const url = `${PHONEPE_BASE_URL}${PHONEPE_PAY_PATH}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-VERIFY": xVerify,
      "X-MERCHANT-ID": PHONEPE_MERCHANT_ID,
      accept: "application/json",
    },
    body: JSON.stringify({ request: payloadBase64 }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[PhonePe] Initiate failed (${res.status}): ${text}`);
  }

  const data: any = await res.json();

  if (!data || data.success !== true || !data.data) {
    throw new Error("[PhonePe] Unexpected initiate response");
  }

  const redirectUrl: string | undefined =
    data.data.instrumentResponse?.redirectUrl ||
    data.data.instrumentResponse?.redirectUri ||
    data.data.redirectUrl;

  if (!redirectUrl) {
    throw new Error("[PhonePe] Missing redirect URL in response");
  }

  // Upsert payment record
  await Payment.findOneAndUpdate(
    { orderId: order._id },
    {
      orderId: order._id,
      provider: "PhonePe",
      paymentIntentId: merchantTransactionId,
      amount: order.totalAmount,
      currency: "INR",
      status: "pending",
    },
    { upsert: true, new: true }
  );

  return { redirectUrl, merchantTransactionId };
}

export async function handlePhonePeCallback(body: any, xVerifyHeader: string | undefined) {
  requirePhonePeConfig();

  if (!xVerifyHeader) {
    throw new Error("Missing X-VERIFY header");
  }

  const [receivedChecksum, receivedIndex] = xVerifyHeader.split("###");
  if (!receivedChecksum || !receivedIndex) {
    throw new Error("Invalid X-VERIFY header format");
  }

  const rawBody = typeof body === "string" ? body : JSON.stringify(body);
  const toSign = rawBody + PHONEPE_SALT_KEY;
  const expectedChecksum = crypto.createHash("sha256").update(toSign).digest("hex");

  if (expectedChecksum !== receivedChecksum || receivedIndex !== PHONEPE_SALT_INDEX) {
    throw new Error("PhonePe checksum verification failed");
  }

  const txId: string | undefined =
    body?.data?.merchantTransactionId || body?.merchantTransactionId || body?.transactionId;
  const status: string | undefined =
    body?.data?.state || body?.state || body?.code;

  if (!txId) {
    throw new Error("PhonePe callback missing transaction id");
  }

  const payment = await Payment.findOne({ paymentIntentId: txId });
  if (!payment) {
    throw new Error("Payment not found for transaction id");
  }

  if (status === "SUCCESS" || status === "COMPLETED") {
    payment.status = "succeeded";
  } else if (status === "FAILED") {
    payment.status = "failed";
  }
  await payment.save();

  const order = await Order.findById(payment.orderId);
  if (order) {
    if (payment.status === "succeeded") {
      order.paymentStatus = "paid";
      order.paymentMethod = "online";
      order.paymentId = txId;
    } else if (payment.status === "failed") {
      order.paymentStatus = "failed";
    }
    await order.save();
  }

  return { payment, order };
}

