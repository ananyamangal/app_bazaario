import mongoose, { Schema, Document, Types } from "mongoose";

export interface IProduct extends Document {
  shopId: Types.ObjectId;
  name: string;
  description?: string;
  images: string[];
  price: number;
  discountPrice?: number;
  categoryId: Types.ObjectId;
  isAvailable: boolean;
  stock?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true
    },
    name: { type: String, required: true },
    description: { type: String },
    images: { type: [String], default: [] },
    price: { type: Number, required: true },
    discountPrice: { type: Number },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true
    },
    isAvailable: { type: Boolean, default: true },
    stock: { type: Number }
  },
  { timestamps: true }
);

export const Product = mongoose.model<IProduct>("Product", ProductSchema);

