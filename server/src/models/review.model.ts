import mongoose, { Schema, Document, Types } from "mongoose";

export interface IReview extends Document {
  shopId: Types.ObjectId;
  orderId?: Types.ObjectId;
  customerId: Types.ObjectId;
  customerName: string;
  rating: number;
  comment?: string;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: "Shop",
      required: true
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: false,
      unique: false
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    customerName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
    images: { type: [String], default: [] }
  },
  { timestamps: true }
);

export const Review = mongoose.model<IReview>("Review", ReviewSchema);

