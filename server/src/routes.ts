import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import twilio from "twilio";
import User from "./models/user.model";
import { Market } from "./models/market.model";
import { Category } from "./models/category.model";
import Shop from "./models/shop.model";
import { Product } from "./models/product.model";
import { Order } from "./models/order.model";
import { Review } from "./models/review.model";
import { CustomerProfile } from "./models/customerProfile.model";
import { SellerProfile } from "./models/sellerProfile.model";
import { Subscription, ISubscription } from "./models/subscription.model";
import { AvailabilityRequest } from "./models/availability-request.model";
import { VideoCall } from "./models/videoCall.model";
import { CallInvoice } from "./models/callInvoice.model";
import { ScheduledCallback } from "./models/scheduledCallback.model";
import { Conversation } from "./models/conversation.model";
import { Message } from "./models/message.model";
import { Notification } from "./models/notification.model";
import cloudinary from "./config/cloudinary";
import { authenticate } from "./middlewares/auth.middleware";
import admin from "./config/firebase";
import {
  createAndSendNotification,
  notifySellerAvailabilityRequest,
  notifyCustomerAvailabilityResponse,
  registerFcmToken,
  unregisterFcmToken,
  sendIncomingCallPush,
} from "./services/notification.service";
import {
  generateAgoraToken,
  generateChannelName,
  generateNumericUid,
  isAgoraConfigured,
  getAgoraAppId,
} from "./services/agora.service";
import { emitToUser } from "./services/socket.service";

const router = express.Router();

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const TWILIO_SERVICE_SID = process.env.TWILIO_SERVICE_SID as string;

// =============================================================================
// TEST PHONE NUMBERS (bypass Twilio for development)
// =============================================================================
// These numbers skip OTP verification for testing purposes
// Test OTP code for these numbers: 123456
const TEST_PHONE_NUMBERS: { [key: string]: { role: "customer" | "seller"; name: string } } = {
  "+919999999991": { role: "seller", name: "Test Seller" },
  "+919999999992": { role: "customer", name: "Test Customer" },
};
const TEST_OTP_CODE = "123456";

function isTestPhoneNumber(phone: string): boolean {
  const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;
  return formattedPhone in TEST_PHONE_NUMBERS;
}

function getFormattedPhone(phone: string): string {
  return phone.startsWith("+") ? phone : `+91${phone}`;
}

// =============================================================================
// OTP ROUTES (using Twilio Verify)
// =============================================================================

// Send OTP to phone number
router.post("/otp/send", async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    const formattedPhone = getFormattedPhone(phone);

    // Check if it's a test phone number - skip Twilio
    if (isTestPhoneNumber(phone)) {
      console.log("[OTP] Test number detected, skipping Twilio:", formattedPhone);
      return res.json({
        message: "OTP sent successfully (TEST MODE)",
        status: "pending",
        phone: formattedPhone,
        isTestNumber: true,
      });
    }

    // Send OTP via Twilio Verify for real numbers
    const verification = await twilioClient.verify.v2
      .services(TWILIO_SERVICE_SID)
      .verifications.create({
        to: formattedPhone,
        channel: "sms",
      });

    console.log("[OTP] Verification sent:", verification.status);

    return res.json({
      message: "OTP sent successfully",
      status: verification.status,
      phone: formattedPhone,
    });
  } catch (err: any) {
    console.error("[OTP Send Error]", err);
    return res.status(500).json({
      message: "Failed to send OTP",
      error: err.message,
    });
  }
});

// Verify OTP and create/login user
router.post("/otp/verify", async (req: Request, res: Response) => {
  try {
    const { phone, code, role } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ message: "Phone and code are required" });
    }

    const formattedPhone = getFormattedPhone(phone);

    // Check if it's a test phone number
    if (isTestPhoneNumber(phone)) {
      if (code !== TEST_OTP_CODE) {
        return res.status(400).json({
          message: "Invalid OTP code for test number",
          valid: false,
        });
      }
      console.log("[OTP] Test number verified:", formattedPhone);
      // Continue to user creation/login logic below (skip Twilio check)
    } else {
      // Verify OTP with Twilio for real numbers
      const verificationCheck = await twilioClient.verify.v2
        .services(TWILIO_SERVICE_SID)
        .verificationChecks.create({
          to: formattedPhone,
          code: code,
        });

      console.log("[OTP] Verification check:", verificationCheck.status);

      if (verificationCheck.status !== "approved") {
        return res.status(400).json({
          message: "Invalid OTP",
          status: verificationCheck.status,
        });
      }
    }

    // OTP verified - check if user exists
    let user = await User.findOne({ phone: formattedPhone });
    let isNewUser = false;
    let profile = null;
    let shop = null;

    if (!user) {
      // New user - we'll create them later after they complete registration
      isNewUser = true;
    } else {
      // Existing user - get their profile
      if (user.role === "customer") {
        profile = await CustomerProfile.findOne({ userId: user._id });
      } else if (user.role === "seller") {
        profile = await SellerProfile.findOne({ userId: user._id });
        shop = await Shop.findOne({ sellerId: user._id });
      }
    }

    // Create a Firebase custom token for the user
    // Use phone number as the UID (or existing uid if user exists)
    const uid = user?.uid || `phone_${formattedPhone.replace(/\+/g, "")}`;
    let customToken: string;
    try {
      customToken = await admin.auth().createCustomToken(uid);
    } catch (err) {
      customToken = ""; // optional if we only use session fallback
    }

    // Backend session JWT (fallback when Firebase network fails on client)
    const JWT_SECRET = process.env.JWT_SECRET;
    const resolvedRole = user?.role ?? role ?? "customer";
    const sessionToken = JWT_SECRET
      ? jwt.sign(
          { uid, userId: user?._id?.toString(), role: resolvedRole },
          JWT_SECRET,
          { expiresIn: 7 * 24 * 60 * 60 } // 7 days in seconds
        )
      : "";

    return res.json({
      message: "OTP verified successfully",
      verified: true,
      isNewUser,
      user,
      profile,
      shop,
      customToken,
      sessionToken: sessionToken || undefined,
      uid,
    });
  } catch (err: any) {
    console.error("[OTP Verify Error]", err);
    return res.status(500).json({
      message: "Failed to verify OTP",
      error: err.message,
    });
  }
});

// Complete registration after OTP verification (for new users)
router.post("/otp/complete-registration", async (req: Request, res: Response) => {
  try {
    const { uid, phone, role, name, email } = req.body;

    if (!uid || !phone || !role) {
      return res.status(400).json({
        message: "uid, phone, and role are required",
      });
    }

    if (!["customer", "seller"].includes(role)) {
      return res.status(400).json({
        message: "role must be customer or seller",
      });
    }

    // Format phone number
    const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;

    // Check if user already exists
    let user = await User.findOne({ $or: [{ uid }, { phone: formattedPhone }] });

    if (user) {
      // Update existing user
      user.uid = uid;
      user.phone = formattedPhone;
      if (name) user.name = name;
      if (email) user.email = email;
      await user.save();
    } else {
      // Create new user
      user = await User.create({
        uid,
        role,
        phone: formattedPhone,
        email: email || null,
        name: name || null,
      });

      // Create role-specific profile for new users
      if (role === "customer") {
        await CustomerProfile.create({
          userId: user._id,
          savedAddresses: [],
          preferredCategories: [],
          totalOrders: 0,
        });
      }
    }

    // Get profile
    let profile = null;
    let shop = null;

    if (user.role === "customer") {
      profile = await CustomerProfile.findOne({ userId: user._id });
    } else if (user.role === "seller") {
      profile = await SellerProfile.findOne({ userId: user._id });
      shop = await Shop.findOne({ sellerId: user._id });
    }

    return res.status(201).json({
      message: "Registration completed successfully",
      user,
      profile,
      shop,
    });
  } catch (err: any) {
    console.error("[Registration Error]", err);
    return res.status(500).json({
      message: "Failed to complete registration",
      error: err.message,
    });
  }
});

// =============================================================================
// SUBSCRIPTION ROUTES (SELLER)
// =============================================================================

const SUBSCRIPTION_PLANS = {
  Basic: {
    planName: "Basic",
    price: 0,
    billingCycle: "monthly",
    features: [
      "Up to 50 products",
      "Basic analytics",
      "Standard support"
    ]
  },
  Pro: {
    planName: "Pro",
    price: 499,
    billingCycle: "monthly",
    features: [
      "Up to 250 products",
      "Priority listing in Explore",
      "Advanced insights",
      "Chat & call priority support"
    ]
  },
  Premium: {
    planName: "Premium",
    price: 999,
    billingCycle: "monthly",
    features: [
      "Unlimited products",
      "Top placement in Explore",
      "Full analytics suite",
      "Dedicated account support"
    ]
  }
} as const;

type SubscriptionPlanKey = keyof typeof SUBSCRIPTION_PLANS;

// Get current seller subscription
router.get("/subscriptions/me", authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;

    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.role !== "seller") {
      return res.status(403).json({ message: "Only sellers have subscriptions" });
    }

    const sellerProfile = await SellerProfile.findOne({ userId: user._id }).populate("subscriptionId");
    if (!sellerProfile) {
      return res.status(404).json({ message: "Seller profile not found" });
    }

    const sub = (sellerProfile as any).subscriptionId as ISubscription | undefined;
    if (!sub) {
      // Default to Basic when no subscription exists
      const basic = SUBSCRIPTION_PLANS.Basic;
      return res.json({
        planName: basic.planName,
        price: basic.price,
        billingCycle: basic.billingCycle,
        // clone to satisfy mutable array type
        features: [...basic.features],
        status: "active"
      });
    }

    return res.json({
      planName: sub.planName,
      price: sub.price,
      billingCycle: sub.billingCycle,
      features: sub.features,
      status: sub.status,
      startDate: sub.startDate,
      endDate: sub.endDate
    });
  } catch (err: any) {
    console.error("[Get Subscription Error]", err);
    return res.status(500).json({ message: "Failed to get subscription", error: err.message });
  }
});

// Upgrade seller subscription (no payments for now, just assign plan)
router.post("/subscriptions/upgrade", authenticate, async (req: Request, res: Response) => {
  try {
    const { planName } = req.body as { planName?: SubscriptionPlanKey | string };

    if (!planName) {
      return res.status(400).json({ message: "planName is required" });
    }

    const normalizedPlanName =
      planName === "basic" || planName === "Basic"
        ? "Basic"
        : planName === "pro" || planName === "Pro"
        ? "Pro"
        : planName === "premium" || planName === "Premium"
        ? "Premium"
        : null;

    if (!normalizedPlanName || !(normalizedPlanName in SUBSCRIPTION_PLANS)) {
      return res.status(400).json({ message: "Invalid planName" });
    }

    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;

    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.role !== "seller") {
      return res.status(403).json({ message: "Only sellers can upgrade subscriptions" });
    }

    const sellerProfile = await SellerProfile.findOne({ userId: user._id });
    if (!sellerProfile) {
      return res.status(404).json({ message: "Seller profile not found" });
    }

    const plan = SUBSCRIPTION_PLANS[normalizedPlanName as SubscriptionPlanKey];

    // Soft-expire existing active subscription
    if (sellerProfile.subscriptionId) {
      await Subscription.updateOne(
        { _id: sellerProfile.subscriptionId, status: "active" },
        { $set: { status: "expired" } }
      );
    }

    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const newSub = (await Subscription.create({
      sellerId: sellerProfile._id,
      planName: plan.planName,
      // clone to satisfy mutable array type
      features: [...plan.features],
      price: plan.price,
      billingCycle: plan.billingCycle,
      startDate: now,
      endDate: end,
      status: "active"
    })) as ISubscription;

    sellerProfile.subscriptionId = newSub._id;
    await sellerProfile.save();

    return res.status(201).json({
      message: "Subscription upgraded",
      subscription: {
        planName: newSub.planName,
        price: newSub.price,
        billingCycle: newSub.billingCycle,
        features: newSub.features,
        status: newSub.status,
        startDate: newSub.startDate,
        endDate: newSub.endDate
      }
    });
  } catch (err: any) {
    console.error("[Upgrade Subscription Error]", err);
    return res.status(500).json({ message: "Failed to upgrade subscription", error: err.message });
  }
});

// =============================================================================
// AUTH ROUTES
// =============================================================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;

// Exchange Google OAuth code for id_token (for Firebase sign-in)
// GET handler for testing (returns method info)
router.get("/auth/google-id-token", (req: Request, res: Response) => {
  return res.status(405).json({ 
    message: "This endpoint requires POST method. Send code and redirectUri in request body.",
    method: "POST",
    path: "/api/auth/google-id-token"
  });
});

router.post("/auth/google-id-token", async (req: Request, res: Response) => {
  try {
    const { code, redirectUri } = req.body;
    if (!code || !redirectUri) {
      return res.status(400).json({ message: "code and redirectUri are required" });
    }
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(503).json({ message: "Google sign-in is not configured" });
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("[Google Token]", tokenRes.status, err);
      console.error("[Google Token] Request details:", { code: code.substring(0, 20) + "...", redirectUri, clientId: GOOGLE_CLIENT_ID?.substring(0, 30) + "..." });
      return res.status(400).json({ message: `Failed to exchange Google code: ${err.substring(0, 200)}` });
    }

    const data = (await tokenRes.json()) as { id_token?: string; access_token?: string };
    if (!data.id_token) {
      return res.status(400).json({ message: "Google did not return id_token" });
    }

    return res.json({ idToken: data.id_token });
  } catch (err: any) {
    console.error("[Google Token Error]", err);
    return res.status(500).json({ message: "Failed to get Google token" });
  }
});

// Exchange Facebook OAuth code for access_token (for Firebase sign-in)
router.post("/auth/facebook-token", async (req: Request, res: Response) => {
  try {
    const { code, redirectUri } = req.body;
    if (!code || !redirectUri) {
      return res.status(400).json({ message: "code and redirectUri are required" });
    }
    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
      return res.status(503).json({ message: "Facebook sign-in is not configured" });
    }

    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${FACEBOOK_APP_SECRET}&code=${encodeURIComponent(code)}`;
    const tokenRes = await fetch(tokenUrl, { method: "GET" });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("[Facebook Token]", tokenRes.status, err);
      return res.status(400).json({ message: "Failed to exchange Facebook code" });
    }

    const data = (await tokenRes.json()) as { access_token?: string };
    if (!data.access_token) {
      return res.status(400).json({ message: "Facebook did not return access_token" });
    }

    return res.json({ accessToken: data.access_token });
  } catch (err: any) {
    console.error("[Facebook Token Error]", err);
    return res.status(500).json({ message: "Failed to get Facebook token" });
  }
});

// Register a new user (called after Firebase Auth signup - phone or social)
router.post("/auth/register", async (req: Request, res: Response) => {
  try {
    const { uid, role, phone, email, name, photoURL } = req.body;

    if (!uid || !role) {
      return res.status(400).json({ message: "uid and role are required" });
    }

    if (!["customer", "seller"].includes(role)) {
      return res.status(400).json({ message: "role must be customer or seller" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ uid });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists", user: existingUser });
    }

    // Create user (phone optional for Google/Facebook sign-in)
    const user = await User.create({
      uid,
      role,
      phone: phone || null,
      email: email || null,
      name: name || null,
      photoURL: photoURL || null,
    });

    // Create role-specific profile
    if (role === "customer") {
      await CustomerProfile.create({
        userId: user._id,
        savedAddresses: [],
        preferredCategories: [],
        totalOrders: 0,
      });
    }

    return res.status(201).json({
      message: "User registered successfully",
      user,
    });
  } catch (err) {
    console.error("[Auth Register Error]", err);
    return res.status(500).json({ message: "Failed to register user" });
  }
});

// Register seller with shop details (called after seller completes onboarding)
router.post("/auth/register-seller", async (req: Request, res: Response) => {
  try {
    const {
      uid,
      phone,
      email,
      name,
      shopName,
      shopDescription,
      market,
      city,
      shopAddress,
      categories,
    } = req.body;

    if (!uid || !phone || !shopName) {
      return res.status(400).json({ message: "uid, phone, and shopName are required" });
    }

    // Check if user already exists
    let user = await User.findOne({ uid });
    if (user) {
      return res.status(409).json({ message: "User already exists", user });
    }

    // Create user
    user = await User.create({
      uid,
      role: "seller",
      phone,
      email: email || null,
      name: name || null,
    });

    // Create seller profile
    const sellerProfile = await SellerProfile.create({
      userId: user._id,
      businessName: shopName,
      businessType: "Retail",
      supportContact: phone,
      verificationStatus: "pending",
      totalShops: 1,
    });

    // Find or create market
    let marketDoc = await Market.findOne({ name: { $regex: new RegExp(market, "i") } });
    if (!marketDoc) {
      marketDoc = await Market.create({
        name: market,
        city: city || "Unknown",
        state: "Delhi",
        description: "",
        isActive: true,
      });
    }

    // Create shop
    const shop = await Shop.create({
      sellerId: user._id,
      marketId: marketDoc._id,
      name: shopName,
      description: shopDescription || "",
      addressLine: shopAddress || "",
      city: city || marketDoc.city || "",
      state: marketDoc.state || "Delhi",
      categories: categories || [],
      images: [],
      isActive: true,
    });

    return res.status(201).json({
      message: "Seller registered successfully",
      user,
      sellerProfile,
      shop,
    });
  } catch (err) {
    console.error("[Auth Register Seller Error]", err);
    return res.status(500).json({ message: "Failed to register seller" });
  }
});

// Login - verify Firebase token and return user profile
router.post("/auth/login", authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;

    // Find user in database
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found. Please register first." });
    }

    // Get role-specific profile
    let profile = null;
    let shop = null;

    if (user.role === "customer") {
      profile = await CustomerProfile.findOne({ userId: user._id });
    } else if (user.role === "seller") {
      profile = await SellerProfile.findOne({ userId: user._id });
      shop = await Shop.findOne({ sellerId: user._id });
    }

    return res.json({
      message: "Login successful",
      user,
      profile,
      shop,
    });
  } catch (err) {
    console.error("[Auth Login Error]", err);
    return res.status(500).json({ message: "Failed to login" });
  }
});

// Get current user (protected)
router.get("/auth/me", authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;

    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let profile = null;
    let shop = null;

    if (user.role === "customer") {
      profile = await CustomerProfile.findOne({ userId: user._id });
    } else if (user.role === "seller") {
      profile = await SellerProfile.findOne({ userId: user._id });
      shop = await Shop.findOne({ sellerId: user._id });
    }

    return res.json({ user, profile, shop });
  } catch (err) {
    console.error("[Auth Me Error]", err);
    return res.status(500).json({ message: "Failed to get user" });
  }
});

// Update user profile (protected)
router.put("/auth/profile", authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;
    const { name, email, phone, photoURL } = req.body;

    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update user fields
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (photoURL !== undefined) user.photoURL = photoURL;

    await user.save();

    return res.json({ message: "Profile updated", user });
  } catch (err) {
    console.error("[Auth Profile Update Error]", err);
    return res.status(500).json({ message: "Failed to update profile" });
  }
});

// Update customer profile with address (protected)
router.put("/users/profile", authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;
    const { name, email, address } = req.body;

    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update user fields
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    await user.save();

    // Update customer profile with address (customers only)
    if (user.role === "customer" && address && typeof address === "object") {
      let customerProfile = await CustomerProfile.findOne({ userId: user._id });
      if (!customerProfile) {
        customerProfile = new CustomerProfile({
          userId: user._id,
          savedAddresses: [],
        });
      }

      // Normalise incoming address shape to match AddressSchema (all required: name, phone, street, city, state, pincode)
      // Mobile sends: { label, line1, line2, city, state, pincode, phone? }
      const raw = address as Record<string, unknown>;
      const normalizedAddress: { name: string; phone: string; street: string; city: string; state: string; pincode: string } =
        "label" in raw || "line1" in raw
          ? {
              name: String(raw.label ?? raw.name ?? "Home").trim() || "Home",
              phone: String(raw.phone ?? (user as any).phone ?? "").trim() || "",
              street: [raw.line1, raw.line2].filter(Boolean).map(String).join(", ").trim() || " ",
              city: String(raw.city ?? "").trim() || " ",
              state: String(raw.state ?? "").trim() || " ",
              pincode: String(raw.pincode ?? "").trim() || " ",
            }
          : {
              name: String((raw as any).name ?? "Home").trim() || "Home",
              phone: String((raw as any).phone ?? (user as any).phone ?? "").trim() || " ",
              street: String((raw as any).street ?? "").trim() || " ",
              city: String((raw as any).city ?? "").trim() || " ",
              state: String((raw as any).state ?? "").trim() || " ",
              pincode: String((raw as any).pincode ?? "").trim() || " ",
            };

      // Update or add address (match by name/label)
      const existingIdx = customerProfile.savedAddresses.findIndex((a: any) => a.name === normalizedAddress.name);
      if (existingIdx >= 0) {
        customerProfile.savedAddresses[existingIdx] = normalizedAddress as any;
      } else {
        customerProfile.savedAddresses.push(normalizedAddress as any);
      }

      await customerProfile.save();
    }

    return res.json({ message: "Profile updated successfully", user });
  } catch (err: any) {
    console.error("[User Profile Update Error]", err?.message ?? err);
    if (err?.errors) console.error("[User Profile Update] Validation errors:", JSON.stringify(err.errors, null, 2));
    return res.status(500).json({ message: "Failed to update profile" });
  }
});

// Update customer addresses (protected)
router.put("/auth/addresses", authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;
    const { addresses } = req.body;

    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "customer") {
      return res.status(400).json({ message: "Only customers can update addresses" });
    }

    const profile = await CustomerProfile.findOne({ userId: user._id });
    if (!profile) {
      return res.status(404).json({ message: "Customer profile not found" });
    }

    profile.savedAddresses = addresses;
    await profile.save();

    return res.json({ message: "Addresses updated", addresses: profile.savedAddresses });
  } catch (err) {
    console.error("[Auth Addresses Update Error]", err);
    return res.status(500).json({ message: "Failed to update addresses" });
  }
});

// =============================================================================
// SAVED SHOPS (customer only)
// =============================================================================

// Get list of saved shops for current customer
router.get("/me/saved-shops", authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role !== "customer") return res.status(400).json({ message: "Only customers can have saved shops" });

    const profile = await CustomerProfile.findOne({ userId: user._id }).populate({
      path: "savedShops",
      model: "Shop",
      // Include basic location fields so we can show address on saved-shop cards
      select: "name shopName description images categories ratingAverage reviewCount isActive promotion addressLine city state",
    });
    const shops = (profile?.savedShops ?? []).filter((s: any) => s != null && s.isActive !== false);
    return res.json({ shops });
  } catch (err) {
    console.error("[GET /me/saved-shops]", err);
    return res.status(500).json({ message: "Failed to fetch saved shops" });
  }
});

// Check if a shop is saved by current customer
router.get("/me/saved-shops/check/:shopId", authenticate, async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role !== "customer") return res.json({ saved: false });

    const profile = await CustomerProfile.findOne({ userId: user._id });
    const saved = profile?.savedShops?.some((id: any) => id.toString() === shopId) ?? false;
    return res.json({ saved });
  } catch (err) {
    console.error("[GET /me/saved-shops/check]", err);
    return res.status(500).json({ message: "Failed to check saved shop" });
  }
});

// Save a shop (add to saved list)
router.post("/me/saved-shops/:shopId", authenticate, async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role !== "customer") return res.status(400).json({ message: "Only customers can save shops" });

    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    let profile = await CustomerProfile.findOne({ userId: user._id });
    if (!profile) {
      profile = await CustomerProfile.create({ userId: user._id, savedShops: [] });
    }
    const id = new mongoose.Types.ObjectId(shopId);
    if (profile.savedShops.some((sid: any) => sid.toString() === shopId)) {
      return res.json({ message: "Already saved", saved: true });
    }
    profile.savedShops.push(id);
    await profile.save();
    return res.json({ message: "Shop saved", saved: true });
  } catch (err) {
    console.error("[POST /me/saved-shops]", err);
    return res.status(500).json({ message: "Failed to save shop" });
  }
});

// Unsave a shop (remove from saved list)
router.delete("/me/saved-shops/:shopId", authenticate, async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role !== "customer") return res.status(400).json({ message: "Only customers can unsave shops" });

    const profile = await CustomerProfile.findOne({ userId: user._id });
    if (!profile) return res.json({ message: "Shop removed", saved: false });
    profile.savedShops = profile.savedShops.filter((sid: any) => sid.toString() !== shopId);
    await profile.save();
    return res.json({ message: "Shop removed", saved: false });
  } catch (err) {
    console.error("[DELETE /me/saved-shops]", err);
    return res.status(500).json({ message: "Failed to unsave shop" });
  }
});

// =============================================================================
// HEALTH & DEBUG ROUTES
// =============================================================================

// Simple health check to verify server and DB connection
router.get("/health", async (_req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState; // 0 = disconnected, 1 = connected
  return res.json({
    status: "ok",
    dbConnected: dbState === 1,
    dbState
  });
});

// Debug endpoint to check database and collection info
router.get("/debug/db-info", async (_req: Request, res: Response) => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ message: "Database not connected" });
    }

    const dbName = db.databaseName;
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    // Count documents in markets collection
    const marketsCount = await db.collection("markets").countDocuments();
    const marketsRaw = await db.collection("markets").find({}).toArray();

    return res.json({
      databaseName: dbName,
      collections: collectionNames,
      marketsDocumentCount: marketsCount,
      marketsRawData: marketsRaw.map(m => ({ _id: m._id, name: m.name }))
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to get db info" });
  }
});

// One-time seeding for demo markets, categories, and shops (used when empty)
async function ensureDemoData() {
  const marketCount = await Market.countDocuments();
  const categoryCount = await Category.countDocuments();

  if (marketCount > 0 && categoryCount > 0) return;

  const categories = await Category.insertMany([
    { name: "Apparel", icon: "shirt", isActive: true },
    { name: "Jewelry", icon: "diamond", isActive: true },
    { name: "Footwear", icon: "shoes", isActive: true }
  ]);

  const [apparel, jewelry, footwear] = categories;

  const markets = await Market.insertMany([
    {
      name: "Sarojini Nagar",
      city: "New Delhi",
      state: "Delhi",
      description:
        "One of Delhi's most loved markets for budget fashion and fabrics.",
      ratingAverage: 4.6,
      totalShops: 2
    },
    {
      name: "Dilli Haat",
      city: "New Delhi",
      state: "Delhi",
      description: "Curated marketplace for crafts and regional cuisine.",
      ratingAverage: 4.8,
      totalShops: 1
    }
  ]);

  const [sarojini, dilliHaat] = markets;

  await Shop.insertMany([
    {
      sellerId: new mongoose.Types.ObjectId(), // demo placeholder
      marketId: sarojini._id,
      shopName: "Ramesh Textiles",
      description: "Fabrics, sarees and tailoring services.",
      categories: [apparel._id],
      shopImages: [],
      bannerImages: [],
      ratingAverage: 4.5,
      totalReviews: 10,
      totalOrders: 120,
      isOpen: true,
      callEnabled: true,
      chatEnabled: true,
      address: {
        name: "Ramesh Textiles",
        phone: "0000000000",
        street: "Main Market Road",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110023"
      },
      geoLocation: { lat: 28.575, lng: 77.201 }
    },
    {
      sellerId: new mongoose.Types.ObjectId(),
      marketId: sarojini._id,
      shopName: "Crafts Corner",
      description: "Handmade home decor and gifts.",
      categories: [jewelry._id],
      shopImages: [],
      bannerImages: [],
      ratingAverage: 4.7,
      totalReviews: 8,
      totalOrders: 80,
      isOpen: true,
      callEnabled: true,
      chatEnabled: true,
      address: {
        name: "Crafts Corner",
        phone: "0000000000",
        street: "Lane 3",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110023"
      },
      geoLocation: { lat: 28.576, lng: 77.202 }
    },
    {
      sellerId: new mongoose.Types.ObjectId(),
      marketId: dilliHaat._id,
      shopName: "Artisan Footwear",
      description: "Handcrafted leather sandals and shoes.",
      categories: [footwear._id],
      shopImages: [],
      bannerImages: [],
      ratingAverage: 4.8,
      totalReviews: 5,
      totalOrders: 40,
      isOpen: true,
      callEnabled: true,
      chatEnabled: true,
      address: {
        name: "Artisan Footwear",
        phone: "0000000000",
        street: "Stall 12",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110023"
      },
      geoLocation: { lat: 28.569, lng: 77.207 }
    }
  ]);
}

// Public markets list used by Explore/Home screens
router.get("/markets", async (_req: Request, res: Response) => {
  try {
    // Fetch all markets using Mongoose (no schema filtering)
    const markets = await Market.find({}).lean().sort({ createdAt: -1 });
    console.log(`[DEBUG] Found ${markets.length} markets`);
    return res.json(markets);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch markets" });
  }
});

// Public categories list used by Home screen
router.get("/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({
      name: 1
    });
    return res.json(categories);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch categories" });
  }
});

// Shops by market, used from Explore/MarketDetail
router.get("/markets/:marketId/shops", async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;
    const market = await Market.findById(marketId).lean();
    const shops = await Shop.find({ marketId, isActive: true })
      .sort({ ratingAverage: -1 })
      .lean();

    const mapped = shops.map((s: any) => {
      const city = s.city || (market && market.city) || "";
      const state = s.state || (market && market.state) || "";
      return {
        ...s,
        city,
        state,
      };
    });

    return res.json(mapped);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch shops" });
  }
});

// Comprehensive search endpoint (shops, markets, products, locations)
router.get("/search", async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    const query = (q as string)?.trim() || "";

    if (!query || query.length < 2) {
      return res.json({
        shops: [],
        markets: [],
        products: [],
      });
    }

    const searchRegex = new RegExp(query, "i");

    // Search shops (by name, description, categories)
    const shops = await Shop.find({
      isActive: true,
      $or: [
        { name: searchRegex },
        { description: searchRegex },
        { categories: { $in: [searchRegex] } },
      ],
    })
      // Include basic location fields so search results can show where the shop is
      .select("name description images banner categories ratingAverage reviewCount promotion addressLine city state")
      .limit(20)
      .lean();

    // Search markets (by name, city, state, description)
    const markets = await Market.find({
      isActive: true,
      $or: [
        { name: searchRegex },
        { city: searchRegex },
        { state: searchRegex },
        { description: searchRegex },
      ],
    })
      .select("name city state description images ratingAverage")
      .limit(20)
      .lean();

    // Search products (by name, description) - populate shop info
    const products = await Product.find({
      isAvailable: true,
      $or: [{ name: searchRegex }, { description: searchRegex }],
    })
      .populate("shopId", "name images banner")
      .populate("categoryId", "name")
      .select("name description images price discountPrice shopId categoryId")
      .limit(20)
      .lean();

    return res.json({
      shops: shops.map((s: any) => ({
        _id: s._id,
        name: s.name,
        description: s.description,
        images: s.images,
        banner: s.banner,
        categories: s.categories,
        ratingAverage: s.ratingAverage,
        reviewCount: s.reviewCount,
        promotion: s.promotion,
        addressLine: s.addressLine,
        city: s.city,
        state: s.state,
      })),
      markets: markets.map((m: any) => ({
        _id: m._id,
        name: m.name,
        city: m.city,
        state: m.state,
        description: m.description,
        images: m.images,
        ratingAverage: m.ratingAverage,
      })),
      products: products.map((p: any) => ({
        _id: p._id,
        name: p.name,
        description: p.description,
        images: p.images,
        price: p.price,
        discountPrice: p.discountPrice,
        shop: p.shopId
          ? {
              _id: (p.shopId as any)._id,
              name: (p.shopId as any).name,
              images: (p.shopId as any).images,
              banner: (p.shopId as any).banner,
            }
          : null,
        category: p.categoryId ? { _id: (p.categoryId as any)._id, name: (p.categoryId as any).name } : null,
      })),
    });
  } catch (err) {
    console.error("[Search Error]", err);
    return res.status(500).json({ message: "Search failed" });
  }
});

// List all active shops (for HomeScreen featured stores)
router.get("/shops", async (_req: Request, res: Response) => {
  try {
    // Include basic market location info for each shop so the app can display city/state
    const shops = await Shop.find({ isActive: true })
      .sort({ ratingAverage: -1 })
      .limit(10)
      .populate("marketId", "name city state")
      .lean();

    const mapped = shops.map((s: any) => {
      const city = s.city || (s.marketId && (s.marketId as any).city) || "";
      const state = s.state || (s.marketId && (s.marketId as any).state) || "";
      return {
        ...s,
        city,
        state,
      };
    });

    return res.json(mapped);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch shops" });
  }
});

// Get single shop by ID
router.get("/shops/:shopId", async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    // Populate market so we can provide city/state even for older shops
    const shop = await Shop.findById(shopId).populate("marketId", "name city state").lean();
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    const city = (shop as any).city || ((shop as any).marketId && (shop as any).marketId.city) || "";
    const state = (shop as any).state || ((shop as any).marketId && (shop as any).marketId.state) || "";
    return res.json({
      ...shop,
      city,
      state,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch shop" });
  }
});

// Get reviews for a shop (public)
router.get("/shops/:shopId/reviews", async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;

    const reviews = await Review.find({ shopId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const mapped = reviews.map((r) => ({
      id: r._id,
      name: r.customerName,
      rating: r.rating,
      text: r.comment ?? "",
      images: r.images ?? [],
      date: r.createdAt,
    }));

    return res.json({ reviews: mapped });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch reviews" });
  }
});

// Update shop details (seller only)
router.put("/shops/:shopId", authenticate, async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;

    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    if (shop.sellerId.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to update this shop" });
    }

    const { name, description, categories, isActive, callTimings, chatEnabled, videoEnabled, instantCallsEnabled, promotion, returnDays, exchangeDays } = req.body;

    if (name !== undefined) shop.name = name;
    if (description !== undefined) shop.description = description;
    if (categories !== undefined) shop.categories = categories;
    if (isActive !== undefined) shop.isActive = isActive;
    if (callTimings !== undefined) shop.callTimings = callTimings;
    if (chatEnabled !== undefined) (shop as any).chatEnabled = chatEnabled;
    if (videoEnabled !== undefined) (shop as any).videoEnabled = videoEnabled;
    if (instantCallsEnabled !== undefined) (shop as any).instantCallsEnabled = instantCallsEnabled;
    if (promotion !== undefined) (shop as any).promotion = promotion;
    if (returnDays !== undefined) (shop as any).returnDays = returnDays == null ? null : Number(returnDays);
    if (exchangeDays !== undefined) (shop as any).exchangeDays = exchangeDays == null ? null : Number(exchangeDays);

    await shop.save();

    return res.json({ message: "Shop updated", shop });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update shop" });
  }
});

// Get seller's shop (for dashboard)
router.get("/shops/my/shop", authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;

    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const shop = await Shop.findOne({ sellerId: user._id });
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    return res.json(shop);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch shop" });
  }
});

// Upload a market image: frontend sends base64 image string, we upload to Cloudinary
// and persist the resulting secure URL in the market's `images` array.
router.post("/markets/:marketId/images", async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;
    const { imageBase64 } = req.body as { imageBase64?: string };

    if (!imageBase64) {
      return res.status(400).json({ message: "imageBase64 is required" });
    }

    const market = await Market.findById(marketId);
    if (!market) {
      return res.status(404).json({ message: "Market not found" });
    }

    const uploadResult = await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${imageBase64}`,
      {
        folder: "markets",
        public_id: `market_${marketId}_${Date.now()}`,
        overwrite: false,
      }
    );

    const imageUrl = uploadResult.secure_url;

    market.images = [...(market.images || []), { url: imageUrl, type: 'gallery' }];
    await market.save();

    return res.status(201).json({
      message: "Market image uploaded successfully",
      url: imageUrl,
      marketId: market._id,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to upload market image" });
  }
});

// Get all images for a market
router.get("/markets/:marketId/images", async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;
    const market = await Market.findById(marketId);

    if (!market) {
      return res.status(404).json({ message: "Market not found" });
    }

    return res.json({
      marketId: market._id,
      images: market.images || [],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch market images" });
  }
});

// Upload a shop image: frontend sends base64 image string, we upload to Cloudinary
// and persist the resulting secure URL in the shop's `images` array.
router.post("/shops/:shopId/images", async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const { imageBase64 } = req.body as { imageBase64?: string };

    if (!imageBase64) {
      return res.status(400).json({ message: "imageBase64 is required" });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    const uploadResult = await cloudinary.uploader.upload(
      // Assume JPEG; Cloudinary will detect format if possible
      `data:image/jpeg;base64,${imageBase64}`,
      {
        folder: "shops",
        public_id: `shop_${shopId}_${Date.now()}`,
        overwrite: false,
      }
    );

    const imageUrl = uploadResult.secure_url;

    shop.images = [imageUrl, ...(shop.images || [])];
    await shop.save();

    return res.status(201).json({
      message: "Image uploaded successfully",
      url: imageUrl,
      shopId: shop._id,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to upload image" });
  }
});

// Get all images for a shop
router.get("/shops/:shopId/images", async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const shop = await Shop.findById(shopId);

    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    const images = shop.images || [];
    return res.json({
      shopId: shop._id,
      images: images.slice().reverse(),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch shop images" });
  }
});

// Create a review for a shop (customer only)
router.post("/shops/:shopId/reviews", authenticate, async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const { rating, comment, imagesBase64 } = req.body as {
      rating?: number;
      comment?: string;
      imagesBase64?: string[];
    };

    if (!mongoose.Types.ObjectId.isValid(shopId)) {
      return res.status(400).json({ message: "Invalid shop" });
    }

    const ratingNum = typeof rating === "number" ? rating : Number(rating);
    if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ message: "Rating must be a number between 1 and 5" });
    }

    const firebaseUser = (req as any).user;
    const uid = firebaseUser?.uid;
    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.role !== "customer") {
      return res.status(403).json({ message: "Only customers can leave reviews" });
    }

    const shopObjectId = new mongoose.Types.ObjectId(shopId);
    const shop = await Shop.findById(shopObjectId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    // Upload images (optional)
    const imageUrls: string[] = [];
    if (Array.isArray(imagesBase64) && imagesBase64.length > 0) {
      for (const base64 of imagesBase64.slice(0, 5)) {
        if (!base64) continue;
        try {
          const uploadResult = await cloudinary.uploader.upload(
            `data:image/jpeg;base64,${base64}`,
            {
              folder: "reviews",
              public_id: `review_${shopId}_${Date.now()}`,
              overwrite: false,
            }
          );
          if (uploadResult.secure_url) {
            imageUrls.push(uploadResult.secure_url);
          }
        } catch (e) {
          console.warn("[Reviews] Failed to upload review image", e);
        }
      }
    }

    const customerName = user.name || (user.phone ? `Customer ${user.phone.slice(-4)}` : "Customer");

    const review = await Review.create({
      shopId: shopObjectId,
      customerId: user._id,
      customerName,
      rating: ratingNum,
      comment: comment != null ? String(comment) : "",
      images: imageUrls,
    });

    // Recalculate shop ratingAverage and reviewCount
    const stats = await Review.aggregate([
      { $match: { shopId: shopObjectId } },
      {
        $group: {
          _id: "$shopId",
          avgRating: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      const { avgRating, count } = stats[0] as { avgRating: number; count: number };
      shop.ratingAverage = avgRating;
      shop.reviewCount = count;
      await shop.save();
    }

    // Notify seller of new review
    await createAndSendNotification(
      shop.sellerId.toString(),
      "review",
      "New review",
      `${customerName} left a ${ratingNum}-star review on ${shop.name}.`,
      { shopId: shop._id.toString(), reviewId: review._id.toString() }
    );

    return res.status(201).json({
      message: "Review submitted",
      review: {
        id: review._id,
        name: review.customerName,
        rating: review.rating,
        text: review.comment,
        images: review.images,
        date: review.createdAt,
      },
      shop: {
        ratingAverage: shop.ratingAverage,
        reviewCount: shop.reviewCount,
      },
    });
  } catch (err: any) {
    console.error("[POST /shops/:shopId/reviews]", err);
    const message = err?.message || "Failed to submit review";
    return res.status(500).json({ message: "Failed to submit review", error: message });
  }
});

// Delete a shop image (seller must own the shop)
router.delete("/shops/:shopId/images", authenticate, async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const { imageUrl } = req.body as { imageUrl?: string };
    if (!imageUrl || typeof imageUrl !== "string") {
      return res.status(400).json({ message: "imageUrl is required" });
    }

    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    if (shop.sellerId.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized: You can only delete images from your own shop" });
    }

    const images = (shop.images || []).filter((url: string) => url !== imageUrl);
    if (images.length === (shop.images || []).length) {
      return res.status(404).json({ message: "Image not found in shop" });
    }
    shop.images = images;
    await shop.save();

    return res.json({ message: "Image deleted", images: shop.images });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete image" });
  }
});

// Upload a shop banner
router.post("/shops/:shopId/banner", async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const { imageBase64 } = req.body as { imageBase64?: string };

    if (!imageBase64) {
      return res.status(400).json({ message: "imageBase64 is required" });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    const uploadResult = await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${imageBase64}`,
      {
        folder: "shop-banners",
        public_id: `banner_${shopId}_${Date.now()}`,
        overwrite: false,
        transformation: [
          { width: 1920, height: 1080, crop: "fill", gravity: "center" }
        ]
      }
    );

    const bannerUrl = uploadResult.secure_url;

    (shop as any).banner = bannerUrl;
    await shop.save();

    return res.status(201).json({
      message: "Banner uploaded successfully",
      url: bannerUrl,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to upload banner" });
  }
});

// Upload a shop reel (video)
router.post("/shops/:shopId/reels", authenticate, async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const { videoBase64, thumbnailBase64 } = req.body as { videoBase64?: string; thumbnailBase64?: string };

    if (!videoBase64) {
      return res.status(400).json({ message: "videoBase64 is required" });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    // Verify the authenticated user owns this shop
    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (shop.sellerId.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized: You can only upload reels to your own shop" });
    }

    // Upload video to Cloudinary
    const videoUploadResult = await cloudinary.uploader.upload(
      `data:video/mp4;base64,${videoBase64}`,
      {
        resource_type: "video",
        folder: "shop-reels",
        public_id: `reel_${shopId}_${Date.now()}`,
        overwrite: false,
      }
    );

    const videoUrl = videoUploadResult.secure_url;
    let thumbnailUrl: string | undefined;

    // Upload thumbnail if provided
    if (thumbnailBase64) {
      const thumbnailUploadResult = await cloudinary.uploader.upload(
        `data:image/jpeg;base64,${thumbnailBase64}`,
        {
          folder: "shop-reels-thumbnails",
          public_id: `thumbnail_${shopId}_${Date.now()}`,
          overwrite: false,
        }
      );
      thumbnailUrl = thumbnailUploadResult.secure_url;
    }

    // Add reel to shop - Mongoose will handle the subdocument creation
    const newReel = {
      videoUrl,
      thumbnailUrl,
      createdAt: new Date(),
    };
    
    shop.reels.push(newReel as any);
    await shop.save();

    return res.status(201).json({
      message: "Reel uploaded successfully",
      reel: newReel,
      shopId: shop._id,
    });
  } catch (err) {
    console.error("[Reel Upload Error]", err);
    return res.status(500).json({ message: "Failed to upload reel" });
  }
});

// Get all reels for a shop
router.get("/shops/:shopId/reels", async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const shop = await Shop.findById(shopId).populate('reels.likes', 'name').lean();
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    
    const rawReels = (shop.reels || []).slice();
    rawReels.sort((a: any, b: any) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    const reels = rawReels.map((reel: any) => ({
      _id: reel._id ? reel._id.toString() : undefined,
      videoUrl: reel.videoUrl,
      thumbnailUrl: reel.thumbnailUrl,
      createdAt: reel.createdAt,
      likes: reel.likes?.length || 0,
      comments: reel.comments?.length || 0,
      views: reel.views || 0,
      commentsList: reel.comments || [],
    }));
    
    return res.json({ reels });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch shop reels" });
  }
});

// Like/Unlike a reel
router.post("/reels/:reelId/like", authenticate, async (req: Request, res: Response) => {
  try {
    const { reelId } = req.params;
    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find shop containing this reel - try both ObjectId and string matching
    let shop = await Shop.findOne({ 'reels._id': reelId });
    
    // If not found, try searching all shops (for backwards compatibility)
    if (!shop) {
      const shops = await Shop.find({});
      for (const s of shops) {
        const reel = s.reels.find((r: any) => r._id && r._id.toString() === reelId);
        if (reel) {
          shop = s;
          break;
        }
      }
    }
    
    if (!shop) {
      return res.status(404).json({ message: "Reel not found" });
    }

    const reel = shop.reels.id(reelId);
    if (!reel) {
      return res.status(404).json({ message: "Reel not found" });
    }

    const userId = user._id;
    const likesArray = reel.likes || [];
    const isLiked = likesArray.some((id: any) => id.toString() === userId.toString());

    if (isLiked) {
      // Unlike
      reel.likes = likesArray.filter((id: any) => id.toString() !== userId.toString());
    } else {
      // Like
      reel.likes.push(userId);
    }

    await shop.save();

    return res.json({
      message: isLiked ? "Reel unliked" : "Reel liked",
      likes: reel.likes.length,
      isLiked: !isLiked,
    });
  } catch (err) {
    console.error("[Like Reel Error]", err);
    return res.status(500).json({ message: "Failed to like/unlike reel" });
  }
});

// Add comment to a reel
router.post("/reels/:reelId/comments", authenticate, async (req: Request, res: Response) => {
  try {
    const { reelId } = req.params;
    const { text } = req.body as { text?: string };
    
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find shop containing this reel
    const shop = await Shop.findOne({ 'reels._id': reelId });
    if (!shop) {
      return res.status(404).json({ message: "Reel not found" });
    }

    const reel = shop.reels.id(reelId);
    if (!reel) {
      return res.status(404).json({ message: "Reel not found" });
    }

    // Add comment
    const comment = {
      userId: user._id,
      userName: user.name || 'User',
      userImage: (user as any).photoURL || undefined,
      text: text.trim(),
      createdAt: new Date(),
    };

    // Ensure comments array exists (avoid reassigning Mongoose DocumentArray type)
    if (!reel.comments) {
      (reel as any).comments = [];
    }
    reel.comments.push(comment as any);
    await shop.save();

    return res.json({
      message: "Comment added",
      comment: {
        id: reel.comments[reel.comments.length - 1]._id.toString(),
        userName: comment.userName,
        userImage: comment.userImage,
        text: comment.text,
        timestamp: comment.createdAt.toISOString(),
      },
      comments: reel.comments.length,
    });
  } catch (err) {
    console.error("[Add Comment Error]", err);
    return res.status(500).json({ message: "Failed to add comment" });
  }
});

// Get comments for a reel
router.get("/reels/:reelId/comments", async (req: Request, res: Response) => {
  try {
    const { reelId } = req.params;
    let shop = await Shop.findOne({ 'reels._id': reelId }).lean();
    
    // If not found, try searching all shops
    if (!shop) {
      const shops = await Shop.find({}).lean();
      for (const s of shops) {
        const reel = (s.reels as any[]).find((r: any) => r._id && r._id.toString() === reelId);
        if (reel) {
          shop = s;
          break;
        }
      }
    }
    
    if (!shop) {
      return res.status(404).json({ message: "Reel not found" });
    }

    const reel = (shop.reels as any[]).find((r: any) => r._id && r._id.toString() === reelId);
    if (!reel) {
      return res.status(404).json({ message: "Reel not found" });
    }

    const comments = (reel.comments || []).map((comment: any) => ({
      id: comment._id ? comment._id.toString() : Date.now().toString(),
      userName: comment.userName,
      userImage: comment.userImage,
      text: comment.text,
      timestamp: comment.createdAt || new Date(),
    }));

    // Sort by creation date (newest first)
    comments.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.json({ comments });
  } catch (err) {
    console.error("[Get Comments Error]", err);
    return res.status(500).json({ message: "Failed to fetch comments" });
  }
});

// Increment reel views
router.post("/reels/:reelId/view", async (req: Request, res: Response) => {
  try {
    const { reelId } = req.params;
    const shop = await Shop.findOne({ 'reels._id': reelId });
    if (!shop) {
      return res.status(404).json({ message: "Reel not found" });
    }

    const reel = shop.reels.id(reelId);
    if (!reel) {
      return res.status(404).json({ message: "Reel not found" });
    }

    reel.views = (reel.views || 0) + 1;
    await shop.save();

    return res.json({ views: reel.views });
  } catch (err) {
    console.error("[Increment Views Error]", err);
    return res.status(500).json({ message: "Failed to increment views" });
  }
});

// Get all reels from all active shops (for ShopReelsScreen)
router.get("/reels", async (req: Request, res: Response) => {
  try {
    const shops = await Shop.find({ isActive: true })
      .select('_id name description images banner reels promotion marketId')
      .populate('marketId', 'name')
      .lean();

    // Get user ID if authenticated (for checking if reels are liked)
    const authHeader = req.headers.authorization;
    let userId: string | null = null;
    if (authHeader) {
      try {
        const token = authHeader.split("Bearer ")[1];
        if (token) {
          // Try Firebase token first
          try {
            const firebaseUser = await admin.auth().verifyIdToken(token);
            const user = await User.findOne({ uid: firebaseUser.uid });
            if (user) userId = user._id.toString();
          } catch {
            // Try JWT token as fallback
            const JWT_SECRET = process.env.JWT_SECRET;
            if (JWT_SECRET) {
              const decoded = jwt.verify(token, JWT_SECRET) as { uid?: string; userId?: string };
              const user = await User.findOne(decoded.userId ? { _id: decoded.userId } : { uid: decoded.uid });
              if (user) userId = user._id.toString();
            }
          }
        }
      } catch (e) {
        // Ignore auth errors for public endpoint
      }
    }

    // Flatten reels from all shops into a single array with shop + market info
    const allReels: any[] = [];
    const marketsMap = new Map<string, string>();

    shops.forEach((shop: any) => {
      if (shop.reels && shop.reels.length > 0) {
        const shopImage = (shop.images && shop.images.length > 0)
          ? shop.images[0]
          : (shop.banner || '');
        const marketId = shop.marketId?._id?.toString() ?? null;
        const marketName = shop.marketId?.name ?? '';
        if (marketId && marketName) marketsMap.set(marketId, marketName);

        shop.reels.forEach((reel: any, index: number) => {
          const reelId = reel._id ? reel._id.toString() : undefined;
          const likesArray = reel.likes || [];
          const isLiked = userId ? likesArray.some((id: any) => id.toString() === userId) : false;
          const promotion = shop.promotion;
          const promotionBadge = promotion?.active
            ? (promotion.discountPercent ? `${promotion.discountPercent}% OFF` : promotion.title || 'Offer')
            : null;
          allReels.push({
            id: reelId || `${shop._id}_${index}_${reel.createdAt || Date.now()}`,
            reelId: reelId,
            shopId: shop._id.toString(),
            shopName: shop.name,
            shopDescription: shop.description || '',
            shopImage: shopImage,
            videoUrl: reel.videoUrl,
            thumbnailUrl: reel.thumbnailUrl,
            createdAt: reel.createdAt,
            likes: likesArray.length || 0,
            comments: reel.comments?.length || 0,
            views: reel.views || 0,
            isLiked: isLiked,
            promotionBadge: promotionBadge,
            marketId: marketId,
            marketName: marketName,
          });
        });
      }
    });

    // Sort by creation date (newest first)
    allReels.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    const markets = Array.from(marketsMap.entries()).map(([_id, name]) => ({ _id, name }));
    return res.json({ reels: allReels, markets });
  } catch (err) {
    console.error("[Get All Reels Error]", err);
    return res.status(500).json({ message: "Failed to fetch reels" });
  }
});

// Get shops by category
router.get("/categories/:categoryId/shops", async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;
    
    // First, get the category to find its name
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    // Query shops where the categories array contains the category name
    // Shops store categories as an array of category name strings
    const shops = await Shop.find({ 
      categories: category.name, 
      isActive: true 
    })
      .sort({ ratingAverage: -1 })
      .populate("marketId", "city state")
      .lean();

    const mapped = shops.map((s: any) => {
      const city = s.city || (s.marketId && (s.marketId as any).city) || "";
      const state = s.state || (s.marketId && (s.marketId as any).state) || "";
      return {
        ...s,
        city,
        state,
      };
    });
    
    return res.json(mapped);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch shops by category" });
  }
});

// =============================================================================
// PRODUCT ROUTES
// =============================================================================

// Get products by shop
router.get("/shops/:shopId/products", async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const products = await Product.find({ shopId }).sort({ createdAt: -1 });
    return res.json({ products });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch products" });
  }
});

// Get single product
router.get("/products/:productId", async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.json(product);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch product" });
  }
});

// Create product (seller only)
router.post("/shops/:shopId/products", authenticate, async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;

    // Verify the user owns this shop
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    if (shop.sellerId.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to add products to this shop" });
    }

    const { name, description, price, discountPrice, categoryId, images, stock } = req.body;

    if (!name || !price || !categoryId) {
      return res.status(400).json({ message: "name, price, and categoryId are required" });
    }

    const product = await Product.create({
      shopId,
      name,
      description: description || "",
      price,
      discountPrice,
      categoryId,
      images: images || [],
      stock,
      isAvailable: true,
    });

    return res.status(201).json({ message: "Product created", product });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to create product" });
  }
});

// Update product (seller only)
router.put("/products/:productId", authenticate, async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;

    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Verify the user owns the shop this product belongs to
    const shop = await Shop.findById(product.shopId);
    if (!shop || shop.sellerId.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to update this product" });
    }

    const { name, description, price, discountPrice, categoryId, images, stock, isAvailable } = req.body;

    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = price;
    if (discountPrice !== undefined) product.discountPrice = discountPrice;
    if (categoryId !== undefined) product.categoryId = categoryId;
    if (images !== undefined) product.images = images;
    if (stock !== undefined) product.stock = stock;
    if (isAvailable !== undefined) product.isAvailable = isAvailable;

    await product.save();

    return res.json({ message: "Product updated", product });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update product" });
  }
});

// Delete product (seller only)
router.delete("/products/:productId", authenticate, async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;

    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Verify the user owns the shop this product belongs to
    const shop = await Shop.findById(product.shopId);
    if (!shop || shop.sellerId.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this product" });
    }

    await Product.findByIdAndDelete(productId);

    return res.json({ message: "Product deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete product" });
  }
});

// Upload product image (returns URL)
router.post("/products/upload-image", authenticate, async (req: Request, res: Response) => {
  try {
    const { imageBase64 } = req.body as { imageBase64?: string };

    if (!imageBase64) {
      return res.status(400).json({ message: "imageBase64 is required" });
    }

    const uploadResult = await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${imageBase64}`,
      {
        folder: "products",
        public_id: `product_${Date.now()}`,
        overwrite: false,
      }
    );

    return res.status(201).json({
      message: "Image uploaded successfully",
      url: uploadResult.secure_url,
    });
  } catch (err) {
    console.error("[Product Image Upload Error]", err);
    return res.status(500).json({ message: "Failed to upload image" });
  }
});

// Debug route to create a test user so that a collection appears in MongoDB
router.post("/debug/seed-test-user", async (_req: Request, res: Response) => {
  try {
    const existing = await User.findOne({ uid: "test-uid-1" });
    if (existing) {
      return res.json({ message: "Test user already exists", user: existing });
    }

    const user = await User.create({
      uid: "test-uid-1",
      role: "customer",
      phone: "0000000000",
      name: "Test User",
      email: "test@example.com"
    });

    return res.status(201).json({ message: "Test user created", user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to seed test user" });
  }
});

// Debug route to seed Meena Bazaar market for testing
router.post("/debug/seed-meena-bazaar", async (_req: Request, res: Response) => {
  try {
    const existing = await Market.findOne({ name: "Meena Bazaar" });
    if (existing) {
      return res.json({ message: "Meena Bazaar already exists", market: existing });
    }

    const market = await Market.create({
      name: "Meena Bazaar",
      city: "Old Delhi",
      state: "Delhi",
      description: "Historic market famous for wedding shopping, fabrics, and traditional Indian wear.",
      ratingAverage: 4.4,
      totalShops: 150,
      isActive: true
    });

    return res.status(201).json({ message: "Meena Bazaar created", market });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to seed Meena Bazaar" });
  }
});

// Debug route to seed/update Lajpat Nagar with images
router.post("/debug/seed-lajpat-nagar", async (_req: Request, res: Response) => {
  try {
    const lajpatData = {
      name: "Lajpat Nagar Central Market",
      city: "New Delhi",
      state: "Delhi",
      description: "Lajpat Nagar Central Market is one of South Delhi's most popular shopping destinations, known for clothing, footwear, electronics, street food, and local vendors.",
      ratingAverage: 4.4,
      images: [
        {
          url: "https://res.cloudinary.com/dc2z9g4ld/image/upload/v1769588324/Screenshot_2026-01-28_at_1.48.35_PM_rrlmel.png",
          type: "cover"
        }
      ],
      totalShops: 350,
      isActive: true
    };

    // Try to update existing or create new
    const existing = await Market.findOne({ name: lajpatData.name });

    if (existing) {
      Object.assign(existing, lajpatData);
      await existing.save();
      return res.json({ message: "Lajpat Nagar updated with images", market: existing });
    }

    const market = await Market.create(lajpatData);
    return res.status(201).json({ message: "Lajpat Nagar created with images", market });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to seed Lajpat Nagar" });
  }
});

// Seed Rajouri Garden and Kamla Nagar markets with images
router.post("/debug/seed-new-markets", async (_req: Request, res: Response) => {
  try {
    const marketsToAdd = [
      {
        name: "Rajouri Garden Market",
        city: "New Delhi",
        state: "Delhi",
        description: "Rajouri Garden Market is a popular shopping and entertainment destination known for branded stores, eateries, and nightlife.",
        ratingAverage: 4.4,
        images: [
          { url: "https://res.cloudinary.com/dc2z9g4ld/image/upload/v1769673074/Screenshot_2026-01-29_at_1.21.05_PM_qxzjmp.png", type: "cover" },
          { url: "https://res.cloudinary.com/dc2z9g4ld/image/upload/v1769673097/Screenshot_2026-01-29_at_1.21.29_PM_eb9qtw.png", type: "gallery" }
        ],
        totalShops: 400,
        isActive: true
      },
      {
        name: "Kamla Nagar Market",
        city: "New Delhi",
        state: "Delhi",
        description: "Kamla Nagar Market is a lively shopping hub near Delhi University, popular among students for affordable fashion, books, and street food.",
        ratingAverage: 4.2,
        images: [
          { url: "https://res.cloudinary.com/dc2z9g4ld/image/upload/v1769672904/Screenshot_2026-01-29_at_1.18.09_PM_lrhxpo.png", type: "cover" },
          { url: "https://res.cloudinary.com/dc2z9g4ld/image/upload/v1769672884/Screenshot_2026-01-29_at_1.17.06_PM_xpbtgr.png", type: "gallery" }
        ],
        totalShops: 250,
        isActive: true
      }
    ];

    const results = [];
    for (const marketData of marketsToAdd) {
      const existing = await Market.findOne({ name: marketData.name });
      if (existing) {
        Object.assign(existing, marketData);
        await existing.save();
        results.push({ name: marketData.name, status: "updated" });
      } else {
        await Market.create(marketData);
        results.push({ name: marketData.name, status: "created" });
      }
    }

    return res.status(201).json({ message: "Markets seeded successfully", results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to seed markets" });
  }
});

// Seed new categories for Shop by Category section
router.post("/debug/seed-new-categories", async (_req: Request, res: Response) => {
  try {
    const categoriesToAdd = [
      { name: "Suits", description: "Formal suits and blazers", icon: "business", isActive: true },
      { name: "Home Decor", description: "Decorative items for home", icon: "home", isActive: true },
      { name: "Casual Wear", description: "Casual clothing and everyday wear", icon: "body", isActive: true },
      { name: "Jewelry", description: "Traditional and modern jewelry", icon: "diamond", isActive: true },
      { name: "Lehenga", description: "Traditional Indian lehengas and ethnic wear", icon: "flower", isActive: true }
    ];

    const results = [];
    for (const catData of categoriesToAdd) {
      const existing = await Category.findOne({ name: catData.name });
      if (existing) {
        Object.assign(existing, catData);
        await existing.save();
        results.push({ name: catData.name, status: "updated" });
      } else {
        await Category.create(catData);
        results.push({ name: catData.name, status: "created" });
      }
    }

    return res.status(201).json({ message: "Categories seeded successfully", results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to seed categories" });
  }
});

// Delete Footwear category
router.delete("/debug/delete-footwear", async (_req: Request, res: Response) => {
  try {
    const result = await Category.deleteOne({ name: "Footwear" });
    return res.json({ message: "Footwear deleted", deletedCount: result.deletedCount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete Footwear" });
  }
});

// Cleanup old markets and add Dilli Haat INA
router.post("/debug/cleanup-and-add-dilli-haat", async (_req: Request, res: Response) => {
  try {
    // Delete old entries
    const deletedDilli = await Market.deleteMany({ name: { $regex: /^Dilli Haat$/i } });
    const deletedSarojini = await Market.deleteMany({ name: { $regex: /Sarojini/i } });

    // Add new Dilli Haat INA with images
    const dilliHaatData = {
      name: "Dilli Haat INA",
      city: "New Delhi",
      state: "Delhi",
      description: "Dilli Haat INA is a popular open-air market showcasing traditional handicrafts, handlooms, and regional cuisines from across India.",
      ratingAverage: 4.7,
      images: [
        { url: "https://res.cloudinary.com/dc2z9g4ld/image/upload/v1769672612/Screenshot_2026-01-29_at_1.13.06_PM_kqzgag.png", type: "cover" },
        { url: "https://res.cloudinary.com/dc2z9g4ld/image/upload/v1769672668/Screenshot_2026-01-29_at_1.14.12_PM_lam3zh.png", type: "gallery" },
        { url: "https://res.cloudinary.com/dc2z9g4ld/image/upload/v1769672725/Screenshot_2026-01-29_at_1.15.08_PM_gfeh2b.png", type: "gallery" }
      ],
      totalShops: 200,
      isActive: true
    };

    const existing = await Market.findOne({ name: dilliHaatData.name });
    let market;
    if (existing) {
      Object.assign(existing, dilliHaatData);
      await existing.save();
      market = existing;
    } else {
      market = await Market.create(dilliHaatData);
    }

    return res.status(201).json({
      message: "Cleanup complete and Dilli Haat INA added",
      deletedDilliHaat: deletedDilli.deletedCount,
      deletedSarojini: deletedSarojini.deletedCount,
      market
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to cleanup and add Dilli Haat INA" });
  }
});

// Comprehensive seed endpoint for testing Phase 1 integration
router.post("/debug/seed-all", async (_req: Request, res: Response) => {
  try {
    const results: { markets: any[]; categories: any[]; sellers: any[]; shops: any[] } = {
      markets: [],
      categories: [],
      sellers: [],
      shops: []
    };

    // 1. Create Markets
    const marketsData = [
      { name: "Sarojini Nagar", city: "New Delhi", state: "Delhi", description: "Budget fashion hub with trendy clothes at bargain prices.", ratingAverage: 4.6, totalShops: 200 },
      { name: "Dilli Haat", city: "INA", state: "Delhi", description: "Curated cultural marketplace for crafts and regional cuisine.", ratingAverage: 4.8, totalShops: 62 },
      { name: "Lajpat Nagar Central Market", city: "New Delhi", state: "Delhi", description: "Popular shopping destination for ethnic wear and home decor.", ratingAverage: 4.5, totalShops: 150 },
      { name: "Chandni Chowk", city: "Old Delhi", state: "Delhi", description: "Historic market for electronics, textiles, and street food.", ratingAverage: 4.3, totalShops: 500 },
    ];

    for (const m of marketsData) {
      const existing = await Market.findOne({ name: m.name });
      if (!existing) {
        const market = await Market.create({ ...m, isActive: true });
        results.markets.push(market);
      } else {
        results.markets.push(existing);
      }
    }

    // 2. Create Categories
    const categoriesData = [
      { name: "Apparel", description: "Clothing and fashion wear" },
      { name: "Jewelry", description: "Traditional and modern jewelry" },
      { name: "Footwear", description: "Shoes, sandals, and ethnic footwear" },
      { name: "Home Decor", description: "Decorative items for home" },
      { name: "Electronics", description: "Gadgets and electronic items" },
    ];

    for (const c of categoriesData) {
      const existing = await Category.findOne({ name: c.name });
      if (!existing) {
        const cat = await Category.create({ ...c, isActive: true });
        results.categories.push(cat);
      } else {
        results.categories.push(existing);
      }
    }

    // 3. Create test sellers
    const sellersData = [
      { uid: "seller-1", role: "seller", name: "Ramesh Kumar", phone: "9876543210", email: "ramesh@example.com" },
      { uid: "seller-2", role: "seller", name: "Priya Sharma", phone: "9876543211", email: "priya@example.com" },
      { uid: "seller-3", role: "seller", name: "Amit Singh", phone: "9876543212", email: "amit@example.com" },
    ];

    for (const s of sellersData) {
      const existing = await User.findOne({ uid: s.uid });
      if (!existing) {
        const seller = await User.create(s);
        results.sellers.push(seller);
      } else {
        results.sellers.push(existing);
      }
    }

    // 4. Create Shops (linked to markets and sellers)
    const sarojini = results.markets.find(m => m.name === "Sarojini Nagar");
    const dilliHaat = results.markets.find(m => m.name === "Dilli Haat");
    const lajpatNagar = results.markets.find(m => m.name === "Lajpat Nagar Central Market");
    const chandniChowk = results.markets.find(m => m.name === "Chandni Chowk");

    const apparelCat = results.categories.find(c => c.name === "Apparel");
    const jewelryCat = results.categories.find(c => c.name === "Jewelry");
    const homeDecorCat = results.categories.find(c => c.name === "Home Decor");
    const footwearCat = results.categories.find(c => c.name === "Footwear");

    const shopsData = [
      {
        sellerId: results.sellers[0]._id,
        marketId: sarojini?._id,
        name: "Ramesh Textiles",
        description: "Quality fabrics, trendy sarees, and custom tailoring services for over 25 years.",
        categories: [apparelCat?.name],
        ratingAverage: 4.6,
        reviewCount: 128,
        isActive: true
      },
      {
        sellerId: results.sellers[1]._id,
        marketId: dilliHaat?._id,
        name: "Crafts Corner",
        description: "Handmade home decor and unique gifts. Every piece tells a story from artisans across India.",
        categories: [homeDecorCat?.name],
        ratingAverage: 4.7,
        reviewCount: 86,
        isActive: true
      },
      {
        sellerId: results.sellers[2]._id,
        marketId: lajpatNagar?._id,
        name: "Style Shoppe",
        description: "Trendy apparel and accessories for the modern fashion-forward individual.",
        categories: [apparelCat?.name],
        ratingAverage: 4.4,
        reviewCount: 52,
        isActive: true
      },
      {
        sellerId: results.sellers[0]._id,
        marketId: chandniChowk?._id,
        name: "Sparkle & Co Jewelers",
        description: "Traditional and modern jewelry. Gold, silver, and diamond collections.",
        categories: [jewelryCat?.name],
        ratingAverage: 4.8,
        reviewCount: 203,
        isActive: true
      },
      {
        sellerId: results.sellers[1]._id,
        marketId: sarojini?._id,
        name: "Sole Comfort",
        description: "Footwear for all occasions. From ethnic juttis to trendy sneakers.",
        categories: [footwearCat?.name],
        ratingAverage: 4.3,
        reviewCount: 67,
        isActive: true
      },
      {
        sellerId: results.sellers[2]._id,
        marketId: dilliHaat?._id,
        name: "Ethnic Elegance",
        description: "Handloom sarees and ethnic wear from across India. Authentic handicrafts.",
        categories: [apparelCat?.name, homeDecorCat?.name],
        ratingAverage: 4.5,
        reviewCount: 94,
        isActive: true
      },
    ];

    for (const s of shopsData) {
      const existing = await Shop.findOne({ name: s.name });
      if (!existing) {
        const shop = await Shop.create(s);
        results.shops.push(shop);
      } else {
        results.shops.push(existing);
      }
    }

    return res.status(201).json({
      message: "Sample data seeded successfully!",
      counts: {
        markets: results.markets.length,
        categories: results.categories.length,
        sellers: results.sellers.length,
        shops: results.shops.length
      },
      data: results
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to seed data", error: String(err) });
  }
});

// =============================================================================
// SEED TEST DATA FOR TESTING (Test Seller Shop + Products)
// =============================================================================

router.post("/debug/seed-test-seller", async (_req: Request, res: Response) => {
  try {
    const testSellerPhone = "+919999999991";
    const testSellerUid = `phone_919999999991`;
    const testCustomerPhone = "+919999999992";
    const testCustomerUid = `phone_919999999992`;

    // 1. Create or find Market
    let market = await Market.findOne({ name: "Test Market Delhi" });
    if (!market) {
      market = await Market.create({
        name: "Test Market Delhi",
        city: "New Delhi",
        state: "Delhi",
        description: "A vibrant test market in the heart of Delhi",
        images: [{ url: "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=800", type: "cover" }],
        isActive: true,
        totalShops: 1,
      });
    }

    // 2. Create or find Categories
    const categoryData = [
      { name: "Clothing", icon: "shirt" },
      { name: "Accessories", icon: "glasses" },
      { name: "Home Decor", icon: "home" },
      { name: "Electronics", icon: "phone-portrait" },
    ];
    const categories: any[] = [];
    for (const catItem of categoryData) {
      let cat = await Category.findOne({ name: catItem.name });
      if (!cat) {
        cat = await Category.create({
          name: catItem.name,
          icon: catItem.icon,
          isActive: true,
        });
      }
      categories.push(cat);
    }

    // 3. Create or update Test Seller User
    let sellerUser = await User.findOne({ phone: testSellerPhone });
    if (!sellerUser) {
      sellerUser = await User.create({
        uid: testSellerUid,
        phone: testSellerPhone,
        role: "seller",
        name: "Test Seller",
        email: "testseller@bazaario.com",
      });
    } else {
      // Update existing user to be a seller
      sellerUser.role = "seller";
      sellerUser.name = sellerUser.name || "Test Seller";
      await sellerUser.save();
    }
    
    // Create or update seller profile
    let sellerProfile = await SellerProfile.findOne({ userId: sellerUser._id });
    if (!sellerProfile) {
      await SellerProfile.create({
        userId: sellerUser._id,
        businessName: "Test Fashion Store",
        businessType: "retail",
        verificationStatus: "verified",
        supportContact: testSellerPhone,
        totalShops: 1,
        ratingAverage: 4.5,
      });
    }

    // 4. Create or update Test Customer User
    let customerUser = await User.findOne({ phone: testCustomerPhone });
    if (!customerUser) {
      customerUser = await User.create({
        uid: testCustomerUid,
        phone: testCustomerPhone,
        role: "customer",
        name: "Test Customer",
        email: "testcustomer@bazaario.com",
      });
    } else {
      // Update existing user to be a customer
      customerUser.role = "customer";
      customerUser.name = customerUser.name || "Test Customer";
      await customerUser.save();
    }
    
    // Create or update customer profile with saved addresses
    let customerProfile = await CustomerProfile.findOne({ userId: customerUser._id });
    if (!customerProfile) {
      await CustomerProfile.create({
        userId: customerUser._id,
        savedAddresses: [
          {
            name: "Home",
            phone: testCustomerPhone.replace("+91", ""),
            street: "123, Test Street, Block A",
            city: "New Delhi",
            state: "Delhi",
            pincode: "110001",
          },
          {
            name: "Office",
            phone: testCustomerPhone.replace("+91", ""),
            street: "456, Work Plaza, Floor 3",
            city: "New Delhi",
            state: "Delhi",
            pincode: "110002",
          },
        ],
        preferredCategories: [categories[0]._id, categories[1]._id],
        totalOrders: 0,
      });
    }

    // 5. Create or update Shop for Test Seller (find by sellerId OR create new)
    let shop = await Shop.findOne({ sellerId: sellerUser._id });
    if (!shop) {
      // Also check if there's any shop with the old sellerId and update it
      const orphanShop = await Shop.findOne({ name: "Test Fashion Store" });
      if (orphanShop) {
        orphanShop.sellerId = sellerUser._id;
        orphanShop.marketId = market._id;
        await orphanShop.save();
        shop = orphanShop;
      } else {
        shop = await Shop.create({
          sellerId: sellerUser._id,
          marketId: market._id,
          name: "Test Fashion Store",
          description: "A premium fashion store with trendy clothing, accessories, and home decor items. Quality products at affordable prices!",
          categories: ["Clothing", "Accessories", "Home Decor"],
          images: [
            "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800",
            "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=800",
            "https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=800",
          ],
          ratingAverage: 4.5,
          reviewCount: 25,
          callTimings: { start: "10:00", end: "20:00" },
          isActive: true,
        });
      }
    }

    // 6. Create Products for the Shop
    const productsToCreate = [
      {
        name: "Cotton Casual Shirt",
        description: "Premium quality cotton shirt, perfect for casual outings. Available in multiple sizes.",
        price: 1299,
        discountPrice: 999,
        images: ["https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400"],
        categoryId: categories[0]._id, // Clothing
        isAvailable: true,
        stock: 50,
      },
      {
        name: "Denim Jeans",
        description: "Comfortable slim-fit denim jeans with stretchable fabric.",
        price: 1999,
        discountPrice: 1499,
        images: ["https://images.unsplash.com/photo-1542272604-787c3835535d?w=400"],
        categoryId: categories[0]._id,
        isAvailable: true,
        stock: 30,
      },
      {
        name: "Leather Belt",
        description: "Genuine leather belt with classic buckle design.",
        price: 799,
        discountPrice: 599,
        images: ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400"],
        categoryId: categories[1]._id, // Accessories
        isAvailable: true,
        stock: 100,
      },
      {
        name: "Sunglasses",
        description: "UV protected stylish sunglasses for men and women.",
        price: 1499,
        discountPrice: 999,
        images: ["https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400"],
        categoryId: categories[1]._id,
        isAvailable: true,
        stock: 40,
      },
      {
        name: "Decorative Cushion Set",
        description: "Set of 4 premium decorative cushions for your living room.",
        price: 1299,
        images: ["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400"],
        categoryId: categories[2]._id, // Home Decor
        isAvailable: true,
        stock: 20,
      },
      {
        name: "Wall Clock",
        description: "Modern minimalist wall clock with silent movement.",
        price: 899,
        discountPrice: 699,
        images: ["https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?w=400"],
        categoryId: categories[2]._id,
        isAvailable: true,
        stock: 15,
      },
      {
        name: "Formal Blazer",
        description: "Slim fit formal blazer perfect for office and events.",
        price: 3999,
        discountPrice: 2999,
        images: ["https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400"],
        categoryId: categories[0]._id,
        isAvailable: true,
        stock: 10,
      },
      {
        name: "Sports Watch",
        description: "Water-resistant sports watch with multiple features.",
        price: 2499,
        discountPrice: 1799,
        images: ["https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=400"],
        categoryId: categories[1]._id,
        isAvailable: false, // Out of stock for testing
        stock: 0,
      },
    ];

    // Delete existing products for this shop and create new ones
    await Product.deleteMany({ shopId: shop._id });
    const createdProducts = await Product.insertMany(
      productsToCreate.map(p => ({ ...p, shopId: shop._id }))
    );

    // 7. Create a delivered test order for the test customer (Ankit 9999999992)
    const existingDeliveredOrder = await Order.findOne({
      customerId: customerUser._id,
      shopId: shop._id,
      status: "delivered",
    });

    if (!existingDeliveredOrder && createdProducts.length > 0) {
      const firstProduct = createdProducts[0];
      await Order.create({
        customerId: customerUser._id,
        shopId: shop._id,
        sellerId: sellerUser._id,
        items: [
          {
            productId: firstProduct._id,
            name: firstProduct.name,
            price: firstProduct.discountPrice || firstProduct.price,
            quantity: 1,
            image: firstProduct.images?.[0],
          },
        ],
        status: "delivered",
        totalAmount: firstProduct.discountPrice || firstProduct.price,
        deliveryAddress: {
          label: "Home",
          line1: "123, Test Street, Block A",
          line2: "",
          city: "New Delhi",
          state: "Delhi",
          pincode: "110001",
          phone: testCustomerPhone.replace("+91", ""),
        },
        paymentStatus: "paid",
        paymentMethod: "online",
      });
    }

    return res.status(201).json({
      message: "Test data seeded successfully!",
      data: {
        market: { _id: market._id, name: market.name },
        seller: { 
          _id: sellerUser._id, 
          phone: testSellerPhone,
          name: sellerUser.name,
          uid: testSellerUid,
        },
        customer: {
          _id: customerUser._id,
          phone: testCustomerPhone,
          name: customerUser.name,
          uid: testCustomerUid,
        },
        shop: {
          _id: shop._id,
          name: shop.name,
        },
        products: createdProducts.length,
        categories: categories.map(c => ({ _id: c._id, name: c.name })),
      },
      instructions: {
        seller: "Login with phone 9999999991, OTP: 123456",
        customer: "Login with phone 9999999992, OTP: 123456",
      },
    });
  } catch (err: any) {
    console.error("[Seed Test Seller Error]", err);
    return res.status(500).json({ message: "Failed to seed test data", error: err.message });
  }
});

// =============================================================================
// ORDER ROUTES
// =============================================================================

// Create a new order (customer)
router.post("/orders", authenticate, async (req: Request, res: Response) => {
  try {
    const { shopId, items, deliveryAddress, deliverySchedule, paymentMethod, notes } = req.body;

    if (!shopId || !items || !items.length || !deliveryAddress) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Get the MongoDB user from Firebase UID
    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get shop to find seller
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    // Validate delivery address has required fields
    if (!deliveryAddress.line1) {
      return res.status(400).json({ message: "Delivery address line1 is required" });
    }

    // Calculate total amount
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      let name: string;
      let price: number;
      let image: string;
      let itemProductId: mongoose.Types.ObjectId;

      const product = await Product.findById(item.productId);
      if (product) {
        name = product.name;
        price = product.discountPrice ?? product.price;
        image = product.images?.[0] || "";
        itemProductId = product._id;
      } else {
        const callInvoice = await CallInvoice.findById(item.productId);
        if (!callInvoice) {
          return res.status(404).json({ message: `Product or invoice ${item.productId} not found` });
        }
        if (callInvoice.customerId.toString() !== user._id.toString()) {
          return res.status(403).json({ message: "Call invoice does not belong to you" });
        }
        if (callInvoice.shopId.toString() !== shopId) {
          return res.status(400).json({ message: "Call invoice shop does not match order shop" });
        }
        const expiresAt = (callInvoice as any).expiresAt;
        // Missing expiresAt = old invoice (before 15-min rule); treat as expired
        if (!expiresAt || new Date(expiresAt) < new Date()) {
          return res.status(400).json({
            message: "This invoice has expired. You have 15 minutes from when the seller sent it to place the order. Please request a new invoice from the seller.",
          });
        }
        name = callInvoice.itemName;
        price = callInvoice.price;
        image = callInvoice.imageUrl || "";
        itemProductId = callInvoice._id;
      }

      totalAmount += price * item.quantity;
      orderItems.push({
        productId: itemProductId,
        name,
        price,
        quantity: item.quantity,
        image,
      });
    }

    // Create order with proper customerId from MongoDB user
    const order = new Order({
      customerId: user._id,
      shopId: shop._id,
      sellerId: shop.sellerId,
      items: orderItems,
      totalAmount,
      deliveryAddress: {
        label: deliveryAddress.label || 'Home',
        line1: deliveryAddress.line1,
        line2: deliveryAddress.line2 || '',
        city: deliveryAddress.city || '',
        state: deliveryAddress.state || '',
        pincode: deliveryAddress.pincode || '',
        phone: deliveryAddress.phone || user.phone || '',
      },
      deliverySchedule,
      paymentMethod: paymentMethod || "cod",
      paymentStatus: paymentMethod === "cod" ? "pending" : "pending",
      notes,
    });

    await order.save();

    // Update customer's total orders
    await CustomerProfile.findOneAndUpdate(
      { userId: user._id },
      { $inc: { totalOrders: 1 } }
    );

    // Notify seller of new order
    const customerName = user.name || (user.phone ? `Customer ${user.phone.slice(-4)}` : "A customer");
    await createAndSendNotification(
      shop.sellerId.toString(),
      "order",
      "New order",
      `${customerName} placed an order (₹${order.totalAmount.toLocaleString("en-IN")})`,
      { orderId: order._id.toString(), shopId: shop._id.toString(), type: "new_order" }
    );

    return res.status(201).json({
      message: "Order created successfully",
      order,
    });
  } catch (err: any) {
    console.error("[Create Order Error]", err);
    return res.status(500).json({ message: "Failed to create order", error: err.message });
  }
});

// Get customer's orders
router.get("/orders/my", authenticate, async (req: Request, res: Response) => {
  try {
    const { status, limit = 20, skip = 0 } = req.query;

    // Get the MongoDB user from Firebase UID
    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const query: any = { customerId: user._id };
    if (status) query.status = status;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .populate("shopId", "name images");

    const total = await Order.countDocuments(query);

    return res.json({ orders, total, limit: Number(limit), skip: Number(skip) });
  } catch (err: any) {
    console.error("[Get My Orders Error]", err);
    return res.status(500).json({ message: "Failed to get orders", error: err.message });
  }
});

// Get seller's orders (for their shops)
router.get("/orders/seller", authenticate, async (req: Request, res: Response) => {
  try {
    const { status, limit = 20, skip = 0 } = req.query;

    // Get the MongoDB user from Firebase UID
    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const query: any = { sellerId: user._id };
    if (status) query.status = status;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .populate("customerId", "name phone")
      .populate("shopId", "name");

    const total = await Order.countDocuments(query);

    // Get order stats
    const stats = await Order.aggregate([
      { $match: { sellerId: user._id } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: "$totalAmount" },
        },
      },
    ]);

    return res.json({ orders, total, stats, limit: Number(limit), skip: Number(skip) });
  } catch (err: any) {
    console.error("[Get Seller Orders Error]", err);
    return res.status(500).json({ message: "Failed to get orders", error: err.message });
  }
});

// Get single order
router.get("/orders/:orderId", authenticate, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    // Get the MongoDB user from Firebase UID
    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const order = await Order.findById(orderId)
      .populate("shopId", "name images")
      .populate("customerId", "name phone");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Verify user has access to this order
    const userId = user._id.toString();
    const orderCustomerId = (order.customerId as any)?._id?.toString() || order.customerId?.toString();
    if (orderCustomerId !== userId && order.sellerId.toString() !== userId) {
      return res.status(403).json({ message: "Not authorized to view this order" });
    }

    return res.json(order);
  } catch (err: any) {
    console.error("[Get Order Error]", err);
    return res.status(500).json({ message: "Failed to get order", error: err.message });
  }
});

// Update order status (seller only)
router.put("/orders/:orderId/status", authenticate, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // Get the MongoDB user from Firebase UID
    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const validStatuses = ["pending", "confirmed", "preparing", "ready", "delivered", "cancelled"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Only seller can update order status
    if (order.sellerId.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "Only seller can update order status" });
    }

    order.status = status;
    
    // If delivered, mark payment as paid for COD
    if (status === "delivered" && order.paymentMethod === "cod") {
      order.paymentStatus = "paid";
    }

    await order.save();

    return res.json({ message: "Order status updated", order });
  } catch (err: any) {
    console.error("[Update Order Status Error]", err);
    return res.status(500).json({ message: "Failed to update order", error: err.message });
  }
});

// Cancel order (customer - only if pending/confirmed)
router.put("/orders/:orderId/cancel", authenticate, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    // Get the MongoDB user from Firebase UID
    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Only customer can cancel their own order
    if (order.customerId.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to cancel this order" });
    }

    // Can only cancel if pending or confirmed
    if (!["pending", "confirmed"].includes(order.status)) {
      return res.status(400).json({ message: "Order cannot be cancelled at this stage" });
    }

    order.status = "cancelled";
    await order.save();

    // Notify seller that customer cancelled the order
    await createAndSendNotification(
      order.sellerId.toString(),
      "order",
      "Order cancelled",
      "A customer cancelled their order.",
      { orderId: order._id.toString(), type: "order_cancelled" }
    );

    return res.json({ message: "Order cancelled", order });
  } catch (err: any) {
    console.error("[Cancel Order Error]", err);
    return res.status(500).json({ message: "Failed to cancel order", error: err.message });
  }
});

// =============================================================================
// FCM TOKEN MANAGEMENT
// =============================================================================

// Register FCM token for push notifications
router.post("/notifications/register-token", authenticate, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const success = await registerFcmToken(user._id.toString(), token);
    return res.json({ success, message: success ? "Token registered" : "Failed to register token" });
  } catch (err: any) {
    console.error("[Register FCM Token Error]", err);
    return res.status(500).json({ message: "Failed to register token", error: err.message });
  }
});

// Unregister FCM token
router.post("/notifications/unregister-token", authenticate, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const success = await unregisterFcmToken(user._id.toString(), token);
    return res.json({ success, message: success ? "Token unregistered" : "Failed to unregister token" });
  } catch (err: any) {
    console.error("[Unregister FCM Token Error]", err);
    return res.status(500).json({ message: "Failed to unregister token", error: err.message });
  }
});

// List notifications for current user
router.get("/notifications", authenticate, async (req: Request, res: Response) => {
  try {
    const { limit = 30, skip = 0 } = req.query;
    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) return res.status(404).json({ message: "User not found" });

    const notifications = await Notification.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .lean();

    const total = await Notification.countDocuments({ userId: user._id });
    return res.json({ notifications, total, limit: Number(limit), skip: Number(skip) });
  } catch (err: any) {
    console.error("[GET /notifications]", err);
    return res.status(500).json({ message: "Failed to fetch notifications", error: err.message });
  }
});

// Unread count
router.get("/notifications/unread-count", authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) return res.status(404).json({ message: "User not found" });

    const count = await Notification.countDocuments({ userId: user._id, isRead: false });
    return res.json({ count });
  } catch (err: any) {
    console.error("[GET /notifications/unread-count]", err);
    return res.status(500).json({ message: "Failed to get unread count", error: err.message });
  }
});

// Mark one notification as read
router.patch("/notifications/:notificationId/read", authenticate, async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) return res.status(404).json({ message: "User not found" });

    const updated = await Notification.findOneAndUpdate(
      { _id: notificationId, userId: user._id },
      { isRead: true },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Notification not found" });
    return res.json({ notification: updated });
  } catch (err: any) {
    console.error("[PATCH /notifications/:id/read]", err);
    return res.status(500).json({ message: "Failed to mark as read", error: err.message });
  }
});

// Mark all notifications as read
router.patch("/notifications/read-all", authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) return res.status(404).json({ message: "User not found" });

    await Notification.updateMany({ userId: user._id }, { isRead: true });
    return res.json({ message: "All marked as read" });
  } catch (err: any) {
    console.error("[PATCH /notifications/read-all]", err);
    return res.status(500).json({ message: "Failed to mark all as read", error: err.message });
  }
});

// =============================================================================
// AVAILABILITY REQUESTS
// =============================================================================

// Default timeout for availability requests (15 minutes)
const AVAILABILITY_REQUEST_TIMEOUT_MS = 15 * 60 * 1000;

// Create availability request (customer)
router.post("/availability-requests", authenticate, async (req: Request, res: Response) => {
  try {
    const { productId, quantity = 1, message } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "productId is required" });
    }

    // Get customer
    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;
    const customer = await User.findOne({ uid });
    if (!customer) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get product and shop
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const shop = await Shop.findById(product.shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    // Check if there's already a pending request for this product by this customer
    const existingRequest = await AvailabilityRequest.findOne({
      customerId: customer._id,
      productId: product._id,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

    if (existingRequest) {
      return res.status(400).json({
        message: "You already have a pending request for this product",
        request: existingRequest,
      });
    }

    // Create the request
    const expiresAt = new Date(Date.now() + AVAILABILITY_REQUEST_TIMEOUT_MS);
    const request = new AvailabilityRequest({
      customerId: customer._id,
      sellerId: shop.sellerId,
      shopId: shop._id,
      productId: product._id,
      productName: product.name,
      productImage: product.images?.[0],
      quantity,
      customerMessage: message,
      expiresAt,
    });

    await request.save();

    // Send push notification to seller
    await notifySellerAvailabilityRequest(
      shop.sellerId.toString(),
      customer.name || "A customer",
      product.name,
      request._id.toString()
    );

    return res.status(201).json({
      message: "Availability request sent",
      request,
      expiresIn: AVAILABILITY_REQUEST_TIMEOUT_MS / 1000 / 60, // minutes
    });
  } catch (err: any) {
    console.error("[Create Availability Request Error]", err);
    return res.status(500).json({ message: "Failed to create request", error: err.message });
  }
});

// Get customer's availability requests
router.get("/availability-requests/my", authenticate, async (req: Request, res: Response) => {
  try {
    const { status, productId } = req.query;

    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // First, expire any old pending requests
    await AvailabilityRequest.updateMany(
      {
        customerId: user._id,
        status: "pending",
        expiresAt: { $lt: new Date() },
      },
      { status: "expired" }
    );

    const query: any = { customerId: user._id };
    if (status) query.status = status;
    if (productId) query.productId = productId;

    const requests = await AvailabilityRequest.find(query)
      .sort({ createdAt: -1 })
      .populate("shopId", "name images")
      .limit(50);

    return res.json({ requests });
  } catch (err: any) {
    console.error("[Get Customer Availability Requests Error]", err);
    return res.status(500).json({ message: "Failed to get requests", error: err.message });
  }
});

// Get seller's pending availability requests
router.get("/availability-requests/seller", authenticate, async (req: Request, res: Response) => {
  try {
    const { status = "pending" } = req.query;

    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // First, expire any old pending requests
    await AvailabilityRequest.updateMany(
      {
        sellerId: user._id,
        status: "pending",
        expiresAt: { $lt: new Date() },
      },
      { status: "expired" }
    );

    const query: any = { sellerId: user._id };
    if (status !== "all") query.status = status;

    const requests = await AvailabilityRequest.find(query)
      .sort({ createdAt: -1 })
      .populate("customerId", "name phone")
      .populate("shopId", "name")
      .limit(100);

    // Count pending requests
    const pendingCount = await AvailabilityRequest.countDocuments({
      sellerId: user._id,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

    return res.json({ requests, pendingCount });
  } catch (err: any) {
    console.error("[Get Seller Availability Requests Error]", err);
    return res.status(500).json({ message: "Failed to get requests", error: err.message });
  }
});

// Respond to availability request (seller)
router.put("/availability-requests/:requestId/respond", authenticate, async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { approved, response: sellerResponse } = req.body;

    if (typeof approved !== "boolean") {
      return res.status(400).json({ message: "approved (boolean) is required" });
    }

    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const request = await AvailabilityRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    // Verify seller owns this request
    if (request.sellerId.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to respond to this request" });
    }

    // Check if already responded or expired
    if (request.status !== "pending") {
      return res.status(400).json({ message: `Request already ${request.status}` });
    }

    if (request.expiresAt < new Date()) {
      request.status = "expired";
      await request.save();
      return res.status(400).json({ message: "Request has expired" });
    }

    // Update request
    request.status = approved ? "approved" : "declined";
    request.sellerResponse = sellerResponse;
    request.respondedAt = new Date();
    await request.save();

    // Get shop name and product price for notification (and cart when approved)
    const shop = await Shop.findById(request.shopId);
    let cartPayload: { productId: string; shopId: string; shopName: string; productName: string; productImage?: string; quantity: string; price: string } | undefined;
    if (approved) {
      const product = await Product.findById(request.productId);
      const price = product && typeof (product as any).price === "number" ? (product as any).price : 0;
      cartPayload = {
        productId: request.productId.toString(),
        shopId: request.shopId.toString(),
        shopName: shop?.name || "Shop",
        productName: request.productName,
        productImage: request.productImage,
        quantity: String(request.quantity),
        price: String(price),
      };
    }

    // Send push notification to customer (with cart payload when approved so app can add to cart)
    await notifyCustomerAvailabilityResponse(
      request.customerId.toString(),
      shop?.name || "The shop",
      request.productName,
      approved,
      request._id.toString(),
      cartPayload
    );

    return res.json({
      message: approved ? "Request approved" : "Request declined",
      request,
    });
  } catch (err: any) {
    console.error("[Respond Availability Request Error]", err);
    return res.status(500).json({ message: "Failed to respond", error: err.message });
  }
});

// Check availability status for a product (customer - to see if they can add to cart)
router.get("/availability-requests/check/:productId", authenticate, async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    const firebaseUser = (req as any).user;
    const uid = firebaseUser.uid;
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check for approved request that hasn't been used (within last 24 hours)
    const approvedRequest = await AvailabilityRequest.findOne({
      customerId: user._id,
      productId,
      status: "approved",
      respondedAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
    }).sort({ respondedAt: -1 });

    // Check for pending request
    const pendingRequest = await AvailabilityRequest.findOne({
      customerId: user._id,
      productId,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

    if (approvedRequest) {
      return res.json({
        canAddToCart: true,
        status: "approved",
        request: approvedRequest,
      });
    }

    if (pendingRequest) {
      return res.json({
        canAddToCart: false,
        status: "pending",
        request: pendingRequest,
        message: "Waiting for seller response",
      });
    }

    return res.json({
      canAddToCart: false,
      status: "none",
      message: "Please check availability before adding to cart",
    });
  } catch (err: any) {
    console.error("[Check Availability Error]", err);
    return res.status(500).json({ message: "Failed to check availability", error: err.message });
  }
});

// =============================================================================
// VIDEO CALL ROUTES
// =============================================================================

// Check if Agora is configured (public - no auth required; only returns configured + appId)
router.get("/calls/config", async (_req: Request, res: Response) => {
  try {
    return res.json({
      configured: isAgoraConfigured(),
      appId: isAgoraConfigured() ? getAgoraAppId() : null,
    });
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to get config", error: err.message });
  }
});

// Request a call (customer initiates)
router.post("/calls/request", authenticate, async (req: Request, res: Response) => {
  try {
    const { shopId, callType = "video" } = req.body;

    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get shop and seller info
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    // Check if shop allows calls (video: only videoEnabled; voice/instant: instantCallsEnabled)
    if (callType === "video") {
      if (!shop.videoEnabled) {
        return res.status(400).json({
          message: "Shop is not accepting calls at the moment.",
          callsDisabled: true,
        });
      }
    } else if (!shop.instantCallsEnabled) {
      return res.status(400).json({
        message: "Shop is not accepting calls at the moment.",
        callsDisabled: true,
      });
    }

    // Generate channel name
    const channelName = generateChannelName(user._id.toString(), shop.sellerId.toString());

    // Create call record
    const call = new VideoCall({
      shopId: shop._id,
      sellerId: shop.sellerId,
      customerId: user._id,
      callType: "instant",
      status: "requested",
      channelName,
    });
    await call.save();

    // Notify seller via socket (when app is open)
    emitToUser(shop.sellerId.toString(), "call_incoming", {
      callId: call._id,
      customerId: user._id,
      customerName: user.name || "Customer",
      shopId: shop._id,
      shopName: shop.name,
      callType,
      channelName,
    });

    // Also send push so seller sees incoming call when app is closed
    await sendIncomingCallPush(
      shop.sellerId.toString(),
      user.name || "Customer",
      call._id.toString(),
      shop._id.toString(),
      shop.name,
      callType,
      channelName
    );

    return res.status(201).json({
      message: "Call requested",
      call: {
        _id: call._id,
        channelName,
        status: call.status,
        shopName: shop.name,
      },
    });
  } catch (err: any) {
    console.error("[Request Call Error]", err);
    return res.status(500).json({ message: "Failed to request call", error: err.message });
  }
});

// Accept a call (seller)
router.post("/calls/:callId/accept", authenticate, async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;

    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const call = await VideoCall.findById(callId);
    if (!call) {
      return res.status(404).json({ message: "Call not found" });
    }

    // Verify seller owns this call
    if (call.sellerId.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (call.status !== "requested") {
      return res.status(400).json({ message: "Call cannot be accepted" });
    }

    // Generate Agora tokens for both parties
    const sellerUid = generateNumericUid(call.sellerId.toString());
    const customerUid = generateNumericUid(call.customerId.toString());

    let sellerToken, customerToken;
    try {
      sellerToken = generateAgoraToken(call.channelName, sellerUid, "publisher");
      customerToken = generateAgoraToken(call.channelName, customerUid, "publisher");
    } catch (tokenError: any) {
      return res.status(500).json({ message: tokenError.message });
    }

    // Update call status
    call.status = "accepted";
    call.startedAt = new Date();
    await call.save();

    // Notify customer via socket
    emitToUser(call.customerId.toString(), "call_accepted", {
      callId: call._id,
      channelName: call.channelName,
      token: customerToken.token,
      uid: customerUid,
      appId: customerToken.appId,
    });

    return res.json({
      message: "Call accepted",
      call: {
        _id: call._id,
        channelName: call.channelName,
        status: call.status,
      },
      agora: {
        token: sellerToken.token,
        uid: sellerUid,
        appId: sellerToken.appId,
        channelName: call.channelName,
      },
    });
  } catch (err: any) {
    console.error("[Accept Call Error]", err);
    return res.status(500).json({ message: "Failed to accept call", error: err.message });
  }
});

// Decline a call (seller)
router.post("/calls/:callId/decline", authenticate, async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;

    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const call = await VideoCall.findById(callId);
    if (!call) {
      return res.status(404).json({ message: "Call not found" });
    }

    if (call.sellerId.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    call.status = "cancelled";
    await call.save();

    // Notify customer
    emitToUser(call.customerId.toString(), "call_declined", {
      callId: call._id,
    });

    return res.json({ message: "Call declined", call });
  } catch (err: any) {
    console.error("[Decline Call Error]", err);
    return res.status(500).json({ message: "Failed to decline call", error: err.message });
  }
});

// End a call
router.post("/calls/:callId/end", authenticate, async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;

    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const call = await VideoCall.findById(callId);
    if (!call) {
      return res.status(404).json({ message: "Call not found" });
    }

    // Either party can end the call
    const isParticipant =
      call.sellerId.toString() === user._id.toString() ||
      call.customerId.toString() === user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({ message: "Not authorized" });
    }

    call.status = "completed";
    call.endedAt = new Date();
    if (call.startedAt) {
      call.duration = Math.floor((call.endedAt.getTime() - call.startedAt.getTime()) / 1000);
    }
    await call.save();

    // Notify both parties
    emitToUser(call.customerId.toString(), "call_ended", { callId: call._id });
    emitToUser(call.sellerId.toString(), "call_ended", { callId: call._id });

    return res.json({ message: "Call ended", call });
  } catch (err: any) {
    console.error("[End Call Error]", err);
    return res.status(500).json({ message: "Failed to end call", error: err.message });
  }
});

// Submit post-call invoice (seller only) – item agreed on call, then add to buyer's cart
router.post("/calls/:callId/invoice", authenticate, async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    const { itemName, price, imageBase64, quantity } = req.body as {
      itemName?: string;
      price?: number;
      imageBase64?: string;
      quantity?: number;
    };

    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) return res.status(404).json({ message: "User not found" });

    const call = await VideoCall.findById(callId);
    if (!call) return res.status(404).json({ message: "Call not found" });
    if (call.status !== "completed") {
      return res.status(400).json({ message: "Invoice can only be submitted after the call has ended" });
    }
    if (call.sellerId.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "Only the seller can submit the call invoice" });
    }

    if (!itemName || typeof itemName !== "string" || !itemName.trim()) {
      return res.status(400).json({ message: "Item name is required" });
    }
    const priceNum = typeof price === "number" ? price : Number(price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({ message: "Valid price is required" });
    }
    const qty = typeof quantity === "number" ? quantity : Number(quantity);
    if (Number.isNaN(qty) || qty < 1) {
      return res.status(400).json({ message: "Quantity must be at least 1" });
    }

    const shop = await Shop.findById(call.shopId);
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    let imageUrl = "";
    if (imageBase64 && typeof imageBase64 === "string") {
      try {
        const uploadResult = await cloudinary.uploader.upload(
          `data:image/jpeg;base64,${imageBase64.replace(/^data:image\/\w+;base64,/, "")}`,
          { folder: "call-invoices", public_id: `call_${callId}_${Date.now()}`, overwrite: false }
        );
        imageUrl = uploadResult.secure_url || "";
      } catch (e) {
        console.warn("[Call invoice] Image upload failed", e);
      }
    }

    const existing = await CallInvoice.findOne({ callId: call._id });
    if (existing) {
      return res.status(400).json({ message: "Invoice already submitted for this call" });
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
    const invoice = await CallInvoice.create({
      callId: call._id,
      shopId: call.shopId,
      sellerId: call.sellerId,
      customerId: call.customerId,
      shopName: shop.name,
      itemName: itemName.trim(),
      price: priceNum,
      imageUrl,
      quantity: qty,
      expiresAt,
    });

    emitToUser(call.customerId.toString(), "invoice_ready", {
      invoiceId: invoice._id.toString(),
      shopId: call.shopId.toString(),
      shopName: shop.name,
      itemName: invoice.itemName,
      price: invoice.price,
      imageUrl: invoice.imageUrl,
      quantity: invoice.quantity,
      expiresAt: expiresAt.toISOString(),
    });

    return res.status(201).json({
      message: "Invoice submitted",
      invoice: {
        _id: invoice._id,
        itemName: invoice.itemName,
        price: invoice.price,
        imageUrl: invoice.imageUrl,
        quantity: invoice.quantity,
      },
    });
  } catch (err: any) {
    console.error("[Call Invoice Error]", err);
    return res.status(500).json({ message: "Failed to submit invoice", error: err.message });
  }
});

// Get Agora token for rejoining a call
router.get("/calls/:callId/token", authenticate, async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;

    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const call = await VideoCall.findById(callId);
    if (!call) {
      return res.status(404).json({ message: "Call not found" });
    }

    const isParticipant =
      call.sellerId.toString() === user._id.toString() ||
      call.customerId.toString() === user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (call.status !== "accepted") {
      return res.status(400).json({ message: "Call is not active" });
    }

    const uid = generateNumericUid(user._id.toString());
    const tokenResult = generateAgoraToken(call.channelName, uid, "publisher");

    return res.json({
      agora: {
        token: tokenResult.token,
        uid,
        appId: tokenResult.appId,
        channelName: call.channelName,
      },
    });
  } catch (err: any) {
    console.error("[Get Call Token Error]", err);
    return res.status(500).json({ message: "Failed to get token", error: err.message });
  }
});

// Get call history for seller
router.get("/calls/seller", authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const calls = await VideoCall.find({ sellerId: user._id })
      .populate("customerId", "name phone")
      .populate("shopId", "name")
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({ calls });
  } catch (err: any) {
    console.error("[Get Seller Calls Error]", err);
    return res.status(500).json({ message: "Failed to get calls", error: err.message });
  }
});

// Get call history for customer
router.get("/calls/my", authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const calls = await VideoCall.find({ customerId: user._id })
      .populate("sellerId", "name")
      .populate("shopId", "name images")
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({ calls });
  } catch (err: any) {
    console.error("[Get Customer Calls Error]", err);
    return res.status(500).json({ message: "Failed to get calls", error: err.message });
  }
});

// Schedule a callback (customer): shop not accepting calls or call declined/no-answer
router.post("/calls/schedule-callback", authenticate, async (req: Request, res: Response) => {
  try {
    const { shopId, scheduledAt } = req.body as { shopId?: string; scheduledAt?: string };
    if (!shopId || !scheduledAt) {
      return res.status(400).json({ message: "shopId and scheduledAt are required" });
    }

    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    const at = new Date(scheduledAt);
    if (isNaN(at.getTime()) || at <= new Date()) {
      return res.status(400).json({ message: "scheduledAt must be a future date/time" });
    }

    const callback = new ScheduledCallback({
      shopId: shop._id,
      sellerId: shop.sellerId,
      customerId: user._id,
      customerName: user.name || "Customer",
      scheduledAt: at,
      status: "pending",
    });
    await callback.save();

    console.log(`[Schedule Callback] Created callback ${callback._id} for seller ${shop.sellerId}, customer ${user._id}, scheduled at ${at.toISOString()}`);

    return res.status(201).json({
      message: "Callback scheduled",
      callback: {
        _id: callback._id,
        shopId: callback.shopId,
        scheduledAt: callback.scheduledAt,
        status: callback.status,
      },
    });
  } catch (err: any) {
    console.error("[Schedule Callback Error]", err);
    return res.status(500).json({ message: "Failed to schedule callback", error: err.message });
  }
});

// Get scheduled callbacks for seller's shop(s)
router.get("/calls/scheduled", authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const callbacks = await ScheduledCallback.find({ sellerId: user._id, status: "pending" })
      .populate("customerId", "name phone")
      .populate("shopId", "name")
      .sort({ scheduledAt: 1 })
      .lean();

    console.log(`[Get Scheduled Callbacks] Found ${callbacks.length} callbacks for seller ${user._id}`);
    return res.json({ callbacks });
  } catch (err: any) {
    console.error("[Get Scheduled Callbacks Error]", err);
    return res.status(500).json({ message: "Failed to get scheduled callbacks", error: err.message });
  }
});

// =============================================================================
// CHAT / CONVERSATION ROUTES
// =============================================================================

// Get or create a conversation with a shop
router.post("/conversations/start", authenticate, async (req: Request, res: Response) => {
  try {
    const { shopId } = req.body;

    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    // Chat is always available (no check)

    // Check for existing conversation
    let conversation = await Conversation.findOne({
      customerId: user._id,
      shopId: shop._id,
    });

    if (!conversation) {
      // Get customer name
      conversation = new Conversation({
        customerId: user._id,
        sellerId: shop.sellerId,
        shopId: shop._id,
        shopName: shop.name,
        customerName: user.name || "Customer",
      });
      await conversation.save();
    }

    return res.json({
      conversation: {
        _id: conversation._id,
        shopId: conversation.shopId,
        shopName: conversation.shopName,
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        unreadCount: conversation.customerUnread,
      },
    });
  } catch (err: any) {
    console.error("[Start Conversation Error]", err);
    return res.status(500).json({ message: "Failed to start conversation", error: err.message });
  }
});

// Get all conversations for user
router.get("/conversations", authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let conversations;
    if (user.role === "seller") {
      conversations = await Conversation.find({ sellerId: user._id })
        .populate("customerId", "name")
        .populate("shopId", "name images")
        .sort({ lastMessageAt: -1 });

      // Map to include unread count for seller
      conversations = conversations.map((c: any) => ({
        _id: c._id,
        shopId: c.shopId?._id,
        shopName: c.shopName,
        shopImage: c.shopId?.images?.[0],
        customerId: c.customerId?._id,
        customerName: c.customerName || c.customerId?.name || "Customer",
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        lastMessageSender: c.lastMessageSender,
        unreadCount: c.sellerUnread,
      }));
    } else {
      conversations = await Conversation.find({ customerId: user._id })
        .populate("shopId", "name images")
        .sort({ lastMessageAt: -1 });

      // Map to include unread count for customer
      conversations = conversations.map((c: any) => ({
        _id: c._id,
        shopId: c.shopId?._id,
        shopName: c.shopName,
        shopImage: c.shopId?.images?.[0],
        sellerId: c.sellerId,
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        lastMessageSender: c.lastMessageSender,
        unreadCount: c.customerUnread,
      }));
    }

    return res.json({ conversations });
  } catch (err: any) {
    console.error("[Get Conversations Error]", err);
    return res.status(500).json({ message: "Failed to get conversations", error: err.message });
  }
});

// Get messages for a conversation
router.get("/conversations/:conversationId/messages", authenticate, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { before, limit = 50 } = req.query;

    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Verify user is part of conversation
    const isParticipant =
      conversation.customerId.toString() === user._id.toString() ||
      conversation.sellerId.toString() === user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Build query
    const query: any = { conversationId };
    if (before) {
      query.createdAt = { $lt: new Date(before as string) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    // Return in chronological order
    return res.json({ messages: messages.reverse() });
  } catch (err: any) {
    console.error("[Get Messages Error]", err);
    return res.status(500).json({ message: "Failed to get messages", error: err.message });
  }
});

// Send a message (REST fallback, prefer socket for real-time)
router.post("/conversations/:conversationId/messages", authenticate, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { content, messageType = "text", imageUrl } = req.body;

    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const isCustomer = conversation.customerId.toString() === user._id.toString();
    const isSeller = conversation.sellerId.toString() === user._id.toString();

    if (!isCustomer && !isSeller) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const senderType = isCustomer ? "customer" : "seller";

    const message = new Message({
      conversationId,
      senderId: user._id,
      senderType,
      content,
      messageType,
      imageUrl,
    });
    await message.save();

    // Update conversation
    const updateData: any = {
      lastMessage: content,
      lastMessageAt: new Date(),
      lastMessageSender: senderType,
    };

    if (isCustomer) {
      updateData.sellerUnread = (conversation.sellerUnread || 0) + 1;
    } else {
      updateData.customerUnread = (conversation.customerUnread || 0) + 1;
    }

    await Conversation.findByIdAndUpdate(conversationId, updateData);

    // Emit via socket to conversation room
    const { emitToConversation } = require("./services/socket.service");
    emitToConversation(conversationId, "new_message", { message });

    return res.status(201).json({ message });
  } catch (err: any) {
    console.error("[Send Message Error]", err);
    return res.status(500).json({ message: "Failed to send message", error: err.message });
  }
});

// Mark conversation as read
router.post("/conversations/:conversationId/read", authenticate, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;

    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const isCustomer = conversation.customerId.toString() === user._id.toString();
    const isSeller = conversation.sellerId.toString() === user._id.toString();

    if (!isCustomer && !isSeller) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Update unread count
    if (isCustomer) {
      await Conversation.findByIdAndUpdate(conversationId, { customerUnread: 0 });
    } else {
      await Conversation.findByIdAndUpdate(conversationId, { sellerUnread: 0 });
    }

    // Mark messages as read
    const otherSenderType = isCustomer ? "seller" : "customer";
    await Message.updateMany(
      { conversationId, senderType: otherSenderType, readAt: null },
      { readAt: new Date() }
    );

    return res.json({ message: "Marked as read" });
  } catch (err: any) {
    console.error("[Mark Read Error]", err);
    return res.status(500).json({ message: "Failed to mark as read", error: err.message });
  }
});

// Get total unread count for user
router.get("/conversations/unread/count", authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUser = (req as any).user;
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let totalUnread = 0;
    if (user.role === "seller") {
      const result = await Conversation.aggregate([
        { $match: { sellerId: user._id } },
        { $group: { _id: null, total: { $sum: "$sellerUnread" } } },
      ]);
      totalUnread = result[0]?.total || 0;
    } else {
      const result = await Conversation.aggregate([
        { $match: { customerId: user._id } },
        { $group: { _id: null, total: { $sum: "$customerUnread" } } },
      ]);
      totalUnread = result[0]?.total || 0;
    }

    return res.json({ unreadCount: totalUnread });
  } catch (err: any) {
    console.error("[Get Unread Count Error]", err);
    return res.status(500).json({ message: "Failed to get unread count", error: err.message });
  }
});

export default router;

