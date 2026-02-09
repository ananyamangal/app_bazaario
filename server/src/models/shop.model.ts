import mongoose from "mongoose";

const ShopSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    marketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Market",
    },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    categories: [{ type: String }],
    images: [{ type: String }],
    banner: { type: String, default: null },
    reels: [{
      videoUrl: { type: String, required: true },
      thumbnailUrl: { type: String },
      createdAt: { type: Date, default: Date.now },
      likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      comments: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        userName: { type: String, required: true },
        userImage: { type: String },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      }],
      views: { type: Number, default: 0 },
    }],
    ratingAverage: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    callTimings: {
      start: { type: String, default: "10:00" },
      end: { type: String, default: "20:00" },
      days: {
        type: [String],
        default: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      },
    },
    isActive: { type: Boolean, default: true },
    chatEnabled: { type: Boolean, default: true },
    videoEnabled: { type: Boolean, default: true },
    instantCallsEnabled: { type: Boolean, default: false },
    // Business info
    businessPhone: { type: String, default: null },
    businessEmail: { type: String, default: null },
    // Bank details
    bankDetails: {
      accountHolder: { type: String, default: null },
      accountNumber: { type: String, default: null },
      bankName: { type: String, default: null },
      ifscCode: { type: String, default: null },
    },
    promotion: {
      title: { type: String, default: null },
      discountPercent: { type: Number, default: null },
      description: { type: String, default: "" },
      active: { type: Boolean, default: false },
    },
    returnDays: { type: Number, default: null },
    exchangeDays: { type: Number, default: null },
  },
  { timestamps: true }
);

ShopSchema.index({ sellerId: 1 });
ShopSchema.index({ marketId: 1 });

export default mongoose.model("Shop", ShopSchema);
