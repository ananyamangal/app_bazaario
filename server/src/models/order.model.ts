import mongoose, { Schema, Document, Types } from "mongoose";

export interface IOrderItem {
  productId: Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface IOrder extends Document {
  customerId: Types.ObjectId;
  shopId: Types.ObjectId;
  sellerId: Types.ObjectId;
  items: IOrderItem[];
  status: "pending" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled";
  totalAmount: number;
  deliveryAddress: {
    label: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    phone?: string;
  };
  deliverySchedule?: {
    date: string;
    timeSlot: string;
  };
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  paymentMethod: "cod" | "online" | "upi";
  paymentId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    image: { type: String },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    shopId: {
      type: Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: { type: [OrderItemSchema], required: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "preparing", "ready", "delivered", "cancelled"],
      default: "pending",
    },
    totalAmount: { type: Number, required: true },
    deliveryAddress: {
      label: { type: String, required: true },
      line1: { type: String, required: true },
      line2: { type: String },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      phone: { type: String },
    },
    deliverySchedule: {
      date: { type: String },
      timeSlot: { type: String },
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["cod", "online", "upi"],
      default: "cod",
    },
    paymentId: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

// Indexes for efficient queries
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ status: 1 });

// Re-export item schema/type for use in other models (e.g. invoices)
export type OrderProductSnapshot = IOrderItem;
export const OrderProductSnapshotSchema = OrderItemSchema;

export const Order = mongoose.model<IOrder>("Order", OrderSchema);
