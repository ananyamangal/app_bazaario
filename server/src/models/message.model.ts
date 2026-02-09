import mongoose, { Schema, Document, Types } from "mongoose";

export type MessageType = "text" | "image" | "system" | "call_started" | "call_ended";

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderType: "customer" | "seller";
  content: string;
  messageType: MessageType;
  imageUrl?: string;
  readAt?: Date;
  metadata?: {
    callDuration?: number;
    callId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderType: {
      type: String,
      enum: ["customer", "seller"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    messageType: {
      type: String,
      enum: ["text", "image", "system", "call_started", "call_ended"],
      default: "text",
    },
    imageUrl: {
      type: String,
    },
    readAt: {
      type: Date,
    },
    metadata: {
      callDuration: Number,
      callId: String,
    },
  },
  { timestamps: true }
);

// Index for fetching messages in a conversation
MessageSchema.index({ conversationId: 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>("Message", MessageSchema);
