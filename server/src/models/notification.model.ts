import mongoose, { Schema, Document, Types } from "mongoose";

export type NotificationType =
  | "order"
  | "call"
  | "system"
  | "message"
  | "review"
  | "availability_request"
  | "availability_response";

export interface INotification extends Document {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  /** Optional payload for deep linking: orderId, conversationId, shopId, etc. */
  data?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "order",
        "call",
        "system",
        "message",
        "review",
        "availability_request",
        "availability_response",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    data: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>(
  "Notification",
  NotificationSchema
);

