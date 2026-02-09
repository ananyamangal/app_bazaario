# Call → Invoice Form → Checkout Flow

This document describes the full path when a **seller** and **buyer** are on a call, agree on something, the seller sends an invoice, and the buyer completes checkout.

---

## 1. Video call (seller + buyer)

- **Customer** starts a call from a shop (e.g. Shop Detail → Call).
- **Seller** receives the call (incoming) and accepts.
- Both join the same Agora channel and are in a video/voice call.

---

## 2. Ending the call

- Either party can tap **End call**.
- **Backend:** `POST /calls/:callId/end` sets the call status to `completed` and emits `call_ended` to both.

**Behaviour after fix:**

- **Customer** ends call → call ends, customer’s screen closes.
- **Seller** ends call → call ends, seller stays on the same screen and sees the **post-call invoice form** (modal).

---

## 3. Post-call invoice form (seller only)

- Shown only to the **seller** when the call has ended (`callState === 'ended'` and `currentCall.isIncoming`).
- Modal: **“Call summary – send invoice”** with:
  - **Item name** (required)
  - **Price (₹)** (required)
  - **Quantity** (default 1)
  - **Product image** (optional, from gallery)

- **Send invoice** → `POST /calls/:callId/invoice` with `itemName`, `price`, `quantity`, `imageBase64` (optional).
- **Backend:** Creates a `CallInvoice`, uploads image to Cloudinary, then emits `invoice_ready` to the **customer** via socket with: `invoiceId`, `shopId`, `shopName`, `itemName`, `price`, `imageUrl`, `quantity`.
- **Skip** → seller closes the screen without sending an invoice.

---

## 4. Customer receives invoice and cart

- **TabNavigator** has `InvoiceReadyListener` subscribed to the `invoice_ready` socket event.
- When the customer (buyer) receives `invoice_ready`:
  - The item is **added to the cart** (using `invoiceId` as `productId`, so the cart can contain call-invoice items).
  - An alert is shown: **“Your invoice is ready!”** with **“View cart & checkout”**.
  - Tapping it switches to the **Cart** tab.

**Note:** The customer must have the app open (and socket connected) when the seller sends the invoice. If the app was closed, they won’t get the event until they open the app again (no server-side “pending invoice” is pushed on next open).

---

## 5. Checkout flow (customer)

From **Cart** screen:

1. **Proceed to Checkout** → **CheckoutAddress**
   - Choose or add delivery address.

2. **Proceed** → **CheckoutSchedule**
   - Instant or Scheduled delivery.

3. **Continue** → **CheckoutInvoice**
   - Final invoice: items, subtotal, platform fee, tax, promo, wallet.
   - **Seller** line now shows the actual shop name (from cart), not hardcoded text.

4. **Continue to Payment** → **CheckoutPayment**
   - Select payment method (UPI, Card, COD, etc.).

5. **Continue** → **CheckoutPlaceOrder**
   - Accept terms and tap **Place order**.
   - **Backend:** `POST /orders` with `shopId`, `items: [{ productId, quantity }]`, address, schedule, payment.
   - For each item, server resolves `productId` as:
     - **Product** (catalog) → use product name/price/image.
     - **CallInvoice** (call-invoice id) → use invoice’s `itemName`, `price`, `imageUrl`, and validate it belongs to this customer and shop.

6. Order created → **CheckoutSuccess**; cart is cleared.

---

## Bugs fixed (for this flow)

1. **Seller never saw the post-call form**  
   - **Cause:** When the seller ended the call, `endCall()` called `resetCallState()` and the screen closed, so `callState === 'ended'` and the invoice modal never appeared.  
   - **Fix:** In `CallContext.endCall()`, if the current user is the seller (`currentCall.isIncoming`), only set `callState` to `'ended'` and keep `currentCall`; do not reset. In `VideoCallScreen.handleEndCall()`, call `onClose()` only for the customer, so the seller stays on the screen and the modal can show.

2. **CheckoutInvoiceScreen showed hardcoded seller name**  
   - **Cause:** “Sellers: Ramesh Textiles, Crafts Corner” was hardcoded.  
   - **Fix:** Use the shop name from the first cart item: `items[0]?.shopName ?? '—'`.

---

## How to test

1. **Seller device:** Log in as seller, open a shop that can receive calls.
2. **Customer device:** Log in as customer, open the same shop, start a video call.
3. Seller accepts; have a short call, then **seller** taps **End call**.
4. On seller: **“Call summary – send invoice”** modal should appear. Fill item name, price, quantity, optionally image → **Send invoice**.
5. On customer: Alert **“Your invoice is ready!”** → **View cart & checkout** → Cart tab with the invoice item.
6. Customer: **Proceed to Checkout** → Address → Schedule → Invoice (see correct shop name) → Payment → Place order → Success.

Also test **Skip** on the invoice form (seller closes without sending) and **customer ends call** (customer’s screen closes, seller still sees the form).
