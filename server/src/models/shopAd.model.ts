import mongoose, { Schema, Document, Types } from "mongoose";

export interface IShopAd extends Document {
  shopId: Types.ObjectId;
  title: string;
  bannerImage: string;
  targetCategories: Types.ObjectId[];
  startDate: Date;
  endDate: Date;
  budget: number;
  impressions: number;
  clicks: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ShopAdSchema = new Schema<IShopAd>(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: "Shop",
      required: true
    },
    title: { type: String, required: true },
    bannerImage: { type: String, required: true },
    targetCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: "Category"
      }
    ],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    budget: { type: Number, required: true },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const ShopAd = mongoose.model<IShopAd>("ShopAd", ShopAdSchema);

