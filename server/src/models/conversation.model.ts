import mongoose, { Schema, Document, Types } from "mongoose";

export interface IConversation extends Document {
  customerId: Types.ObjectId;
  sellerId: Types.ObjectId;
  shopId: Types.ObjectId;
  shopName: string;
  customerName: string;
  lastMessage: string;
  lastMessageAt: Date;
  lastMessageSender: "customer" | "seller";
  customerUnread: number;
  sellerUnread: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
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
    shopName: {
      type: String,
      required: true,
    },
    customerName: {
      type: String,
      default: "Customer",
    },
    lastMessage: {
      type: String,
      default: "",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    lastMessageSender: {
      type: String,
      enum: ["customer", "seller"],
    },
    customerUnread: {
      type: Number,
      default: 0,
    },
    sellerUnread: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound index for finding conversations between specific users
ConversationSchema.index({ customerId: 1, shopId: 1 }, { unique: true });
ConversationSchema.index({ lastMessageAt: -1 });

export const Conversation = mongoose.model<IConversation>(
  "Conversation",
  ConversationSchema
);
