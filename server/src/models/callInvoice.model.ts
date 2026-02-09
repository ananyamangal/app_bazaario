import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICallInvoice extends Document {
  callId: Types.ObjectId;
  shopId: Types.ObjectId;
  sellerId: Types.ObjectId;
  customerId: Types.ObjectId;
  shopName: string;
  itemName: string;
  price: number;
  imageUrl: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

const CallInvoiceSchema = new Schema<ICallInvoice>(
  {
    callId: { type: Schema.Types.ObjectId, ref: "VideoCall", required: true },
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    shopName: { type: String, required: true },
    itemName: { type: String, required: true },
    price: { type: Number, required: true },
    imageUrl: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);

CallInvoiceSchema.index({ callId: 1 });
CallInvoiceSchema.index({ customerId: 1 });

export const CallInvoice = mongoose.model<ICallInvoice>("CallInvoice", CallInvoiceSchema);
