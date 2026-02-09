import mongoose, { Schema, Document, Types } from "mongoose";
import { SnapshotUserSchema, SnapshotUser } from "./common";
import { OrderProductSnapshotSchema, OrderProductSnapshot } from "./order.model";

export interface TaxBreakdownItem {
  name: string;
  amount: number;
}

const TaxBreakdownItemSchema = new Schema<TaxBreakdownItem>(
  {
    name: { type: String, required: true },
    amount: { type: Number, required: true }
  },
  { _id: false }
);

export interface IInvoice extends Document {
  orderId: Types.ObjectId;
  invoiceNumber: string;
  sellerDetailsSnapshot: SnapshotUser;
  customerDetailsSnapshot: SnapshotUser;
  items: OrderProductSnapshot[];
  taxBreakdown: TaxBreakdownItem[];
  totalAmount: number;
  pdfUrl?: string;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true
    },
    invoiceNumber: { type: String, required: true, unique: true },
    sellerDetailsSnapshot: { type: SnapshotUserSchema, required: true },
    customerDetailsSnapshot: { type: SnapshotUserSchema, required: true },
    items: {
      type: [OrderProductSnapshotSchema],
      required: true
    },
    taxBreakdown: { type: [TaxBreakdownItemSchema], default: [] },
    totalAmount: { type: Number, required: true },
    pdfUrl: { type: String },
    generatedAt: { type: Date, required: true }
  },
  { timestamps: true }
);

export const Invoice = mongoose.model<IInvoice>("Invoice", InvoiceSchema);

