import mongoose, { Schema, Document, Types } from "mongoose";

export type VerificationStatus = "pending" | "verified" | "rejected";

export interface ISellerProfile extends Document {
  userId: Types.ObjectId;
  businessName: string;
  businessType: string;
  gstNumber?: string;
  panNumber?: string;
  verificationStatus: VerificationStatus;
  supportContact: string;
  subscriptionId?: Types.ObjectId;
  totalShops: number;
  ratingAverage: number;
  createdAt: Date;
  updatedAt: Date;
}

const SellerProfileSchema = new Schema<ISellerProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },
    businessName: { type: String, required: true },
    businessType: { type: String, required: true },
    gstNumber: { type: String },
    panNumber: { type: String },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending"
    },
    supportContact: { type: String, required: true },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription"
    },
    totalShops: { type: Number, default: 0 },
    ratingAverage: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const SellerProfile = mongoose.model<ISellerProfile>(
  "SellerProfile",
  SellerProfileSchema
);

