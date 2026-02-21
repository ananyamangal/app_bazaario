import mongoose, { Schema, Document, Types } from "mongoose";

export type PaymentProvider = "Razorpay" | "PhonePe";

export interface IPayment extends Document {
  orderId: Types.ObjectId;
  provider: PaymentProvider;
  paymentIntentId: string;
  paymentMethod?: string;
  amount: number;
  currency: string;
  status: "pending" | "succeeded" | "failed";
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true
    },
    provider: {
      type: String,
      enum: ["Razorpay", "PhonePe"],
      required: true
    },
    paymentIntentId: { type: String, required: true, unique: true },
    paymentMethod: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "succeeded", "failed"],
      default: "pending"
    }
  },
  { timestamps: true }
);

export const Payment = mongoose.model<IPayment>("Payment", PaymentSchema);

