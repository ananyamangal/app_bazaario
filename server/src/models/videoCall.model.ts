import mongoose, { Schema, Document, Types } from "mongoose";

export type CallType = "instant" | "scheduled";
export type CallStatus = "requested" | "accepted" | "completed" | "cancelled";

export interface IVideoCall extends Document {
  shopId: Types.ObjectId;
  sellerId: Types.ObjectId;
  customerId: Types.ObjectId;
  callType: CallType;
  channelName: string;
  scheduledTime?: Date;
  startedAt?: Date;
  endedAt?: Date;
  duration?: number;
  status: CallStatus;
  recordingUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VideoCallSchema = new Schema<IVideoCall>(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: "Shop",
      required: true
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "SellerProfile",
      required: true
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "CustomerProfile",
      required: true
    },
    callType: {
      type: String,
      enum: ["instant", "scheduled"],
      required: true
    },
    channelName: {
      type: String,
      required: true,
      index: true
    },
    scheduledTime: { type: Date },
    startedAt: { type: Date },
    endedAt: { type: Date },
    duration: { type: Number },
    status: {
      type: String,
      enum: ["requested", "accepted", "completed", "cancelled"],
      default: "requested"
    },
    recordingUrl: { type: String }
  },
  { timestamps: true }
);

export const VideoCall = mongoose.model<IVideoCall>(
  "VideoCall",
  VideoCallSchema
);

