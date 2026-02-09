import mongoose, { Schema, Document, Types } from "mongoose";

export type SubscriptionStatus = "active" | "expired" | "cancelled" | "upcoming";

export interface ISubscription extends Document {
  sellerId: Types.ObjectId;
  planName: string;
  features: string[];
  price: number;
  billingCycle: string;
  startDate: Date;
  endDate: Date;
  status: SubscriptionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "SellerProfile",
      required: true,
      index: true
    },
    planName: { type: String, required: true },
    features: { type: [String], default: [] },
    price: { type: Number, required: true },
    billingCycle: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled", "upcoming"],
      default: "upcoming"
    }
  },
  { timestamps: true }
);

export const Subscription = mongoose.model<ISubscription>(
  "Subscription",
  SubscriptionSchema
);

