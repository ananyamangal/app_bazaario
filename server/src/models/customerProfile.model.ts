import mongoose, { Schema, Document, Types } from "mongoose";
import { AddressSchema, Address } from "./common";

export interface ICustomerProfile extends Document {
  userId: Types.ObjectId;
  savedAddresses: Address[];
  savedShops: Types.ObjectId[];
  preferredCategories: Types.ObjectId[];
  lastActiveAt?: Date;
  totalOrders: number;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerProfileSchema = new Schema<ICustomerProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },
    savedAddresses: {
      type: [AddressSchema],
      default: []
    },
    savedShops: {
      type: [{ type: Schema.Types.ObjectId, ref: "Shop" }],
      default: []
    },
    preferredCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: "Category"
      }
    ],
    lastActiveAt: { type: Date },
    totalOrders: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const CustomerProfile = mongoose.model<ICustomerProfile>(
  "CustomerProfile",
  CustomerProfileSchema
);

