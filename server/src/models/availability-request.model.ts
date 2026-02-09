import mongoose, { Schema, Document, Types } from "mongoose";

export interface IAvailabilityRequest extends Document {
  customerId: Types.ObjectId;
  sellerId: Types.ObjectId;
  shopId: Types.ObjectId;
  productId: Types.ObjectId;
  productName: string;
  productImage?: string;
  quantity: number;
  status: "pending" | "approved" | "declined" | "expired";
  customerMessage?: string;
  sellerResponse?: string;
  respondedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AvailabilityRequestSchema = new Schema<IAvailabilityRequest>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    shopId: {
      type: Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    productImage: {
      type: String,
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "declined", "expired"],
      default: "pending",
      index: true,
    },
    customerMessage: {
      type: String,
      maxlength: 500,
    },
    sellerResponse: {
      type: String,
      maxlength: 500,
    },
    respondedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index for checking existing requests
AvailabilityRequestSchema.index({ customerId: 1, productId: 1, status: 1 });

// TTL index alternative - we'll handle expiry via cron/check instead
// This allows us to keep expired records for history

export const AvailabilityRequest = mongoose.model<IAvailabilityRequest>(
  "AvailabilityRequest",
  AvailabilityRequestSchema
);
