import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, unique: true },
    role: { type: String, enum: ["customer", "seller"], required: true },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    name: { type: String, default: null },
    photoURL: { type: String, default: null },
    // FCM Push notification tokens (user can have multiple devices)
    fcmTokens: [{ type: String }],
    // Notification preferences
    notificationsEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

UserSchema.index({ uid: 1 }, { unique: true });

export default mongoose.model("User", UserSchema);

