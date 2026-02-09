import mongoose, { Schema, Document, Types } from "mongoose";

export type ScheduledCallbackStatus = "pending" | "completed" | "cancelled";

export interface IScheduledCallback extends Document {
  shopId: Types.ObjectId;
  sellerId: Types.ObjectId;
  customerId: Types.ObjectId;
  customerName: string;
  scheduledAt: Date;
  status: ScheduledCallbackStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ScheduledCallbackSchema = new Schema<IScheduledCallback>(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    customerName: { type: String, default: "Customer" },
    scheduledAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "completed", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

ScheduledCallbackSchema.index({ shopId: 1, scheduledAt: 1 });
ScheduledCallbackSchema.index({ sellerId: 1, status: 1 });

export const ScheduledCallback = mongoose.model<IScheduledCallback>(
  "ScheduledCallback",
  ScheduledCallbackSchema
);
