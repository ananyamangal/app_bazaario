import admin from "../config/firebase";
import User from "../models/user.model";
import { Notification, NotificationType } from "../models/notification.model";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function isExpoPushToken(token: string): boolean {
  return typeof token === "string" && token.startsWith("ExponentPushToken[");
}

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Send push via Expo Push API (for ExponentPushToken[...] from Expo apps)
 */
async function sendExpoPush(
  tokens: string[],
  payload: NotificationPayload
): Promise<{ success: number; failed: number; invalidTokens: string[] }> {
  if (tokens.length === 0) return { success: 0, failed: 0, invalidTokens: [] };
  const invalidTokens: string[] = [];
  try {
    const messages = tokens.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      sound: "default",
      priority: "high" as const,
      channelId: "bazaario_default",
    }));
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
    const data = await res.json();
    if (data.data) {
      data.data.forEach((r: any, idx: number) => {
        if (r.status === "error" && r.details?.error === "DeviceNotRegistered") {
          invalidTokens.push(tokens[idx]);
        }
      });
    }
    const success = data.data?.filter((r: any) => r.status === "ok").length ?? 0;
    const failed = (data.data?.length ?? 0) - success;
    return { success, failed, invalidTokens };
  } catch (e) {
    console.error("[Notification] Expo push error:", e);
    return { success: 0, failed: tokens.length, invalidTokens: [] };
  }
}

/**
 * Send push notification to a specific user.
 * Uses Expo Push API for ExponentPushToken[...] (Expo app) and FCM for native FCM tokens.
 */
export async function sendPushNotification(
  userId: string,
  payload: NotificationPayload
): Promise<{ success: boolean; sent: number; failed: number }> {
  try {
    const user = await User.findById(userId);
    if (!user || !user.notificationsEnabled) {
      return { success: false, sent: 0, failed: 0 };
    }

    const tokens: string[] = (user as any).fcmTokens || [];
    if (tokens.length === 0) {
      console.log(`[Notification] No push tokens for user ${userId}`);
      return { success: false, sent: 0, failed: 0 };
    }

    const expoTokens = tokens.filter(isExpoPushToken);
    const fcmTokens = tokens.filter((t) => !isExpoPushToken(t));

    let totalSent = 0;
    let totalFailed = 0;
    const allInvalid: string[] = [];

    if (expoTokens.length > 0) {
      const expoResult = await sendExpoPush(expoTokens, payload);
      totalSent += expoResult.success;
      totalFailed += expoResult.failed;
      allInvalid.push(...expoResult.invalidTokens);
      console.log(`[Notification] Expo push to ${userId}: ${expoResult.success} ok, ${expoResult.failed} failed`);
    }

    if (fcmTokens.length > 0) {
      const message: admin.messaging.MulticastMessage = {
        tokens: fcmTokens,
        notification: { title: payload.title, body: payload.body },
        data: payload.data || {},
        android: {
          notification: {
            channelId: "bazaario_default",
            priority: "high",
            sound: "default",
          },
        },
        apns: {
          payload: { aps: { sound: "default", badge: 1 } },
        },
      };
      const response = await admin.messaging().sendEachForMulticast(message);
      totalSent += response.successCount;
      totalFailed += response.failureCount;
      if (response.failureCount > 0) {
        response.responses.forEach((resp: any, idx: number) => {
          if (!resp.success) {
            const code = resp.error?.code;
            if (
              code === "messaging/invalid-registration-token" ||
              code === "messaging/registration-token-not-registered"
            ) {
              allInvalid.push(fcmTokens[idx]);
            }
          }
        });
      }
    }

    if (allInvalid.length > 0) {
      await User.findByIdAndUpdate(userId, { $pull: { fcmTokens: { $in: allInvalid } } });
      console.log(`[Notification] Removed ${allInvalid.length} invalid tokens for user ${userId}`);
    }

    return { success: totalSent > 0, sent: totalSent, failed: totalFailed };
  } catch (error) {
    console.error("[Notification] Error sending push:", error);
    return { success: false, sent: 0, failed: 0 };
  }
}

/**
 * Send high-priority push for incoming call (so seller sees it when app is closed)
 */
export async function sendIncomingCallPush(
  sellerId: string,
  customerName: string,
  callId: string,
  shopId: string,
  shopName: string,
  callType: string,
  channelName: string
): Promise<void> {
  const payload: NotificationPayload = {
    title: "Incoming call",
    body: `${customerName || "A customer"} is calling you (${shopName})`,
    data: {
      type: "incoming_call",
      callId,
      customerName: customerName || "Customer",
      shopId,
      shopName,
      callType: callType || "video",
      channelName: channelName || "",
    },
  };
  await sendPushNotification(sellerId, payload);
}

/** Set by socket.service so we can emit new_notification in real time without circular dependency */
let socketEmit: ((userId: string, event: string, data: any) => void) | null = null;
export function setNotificationSocketEmitter(
  emit: (userId: string, event: string, data: any) => void
): void {
  socketEmit = emit;
}

/**
 * Create an in-app notification and send push to the user.
 * Use this for all notification types so they appear in the app and as push.
 * Also emits new_notification via socket for real-time in-app updates.
 */
export async function createAndSendNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  try {
    const doc = await Notification.create({
      userId,
      type,
      title,
      message: body,
      isRead: false,
      data: data || undefined,
    });
    await sendPushNotification(userId, { title, body, data });
    if (socketEmit) {
      const notification = doc.toObject ? doc.toObject() : doc;
      socketEmit(userId, "new_notification", {
        notification: {
          _id: (notification as any)._id?.toString(),
          type: notification.type,
          title: notification.title,
          message: notification.message,
          isRead: notification.isRead,
          data: notification.data,
          createdAt: (notification as any).createdAt,
          updatedAt: (notification as any).updatedAt,
        },
      });
    }
  } catch (err) {
    console.error("[Notification] createAndSend error:", err);
  }
}

/**
 * Send notification for availability request (to seller)
 */
export async function notifySellerAvailabilityRequest(
  sellerId: string,
  customerName: string,
  productName: string,
  requestId: string
): Promise<void> {
  await sendPushNotification(sellerId, {
    title: "New Availability Request",
    body: `${customerName || "A customer"} wants to know if "${productName}" is available`,
    data: {
      type: "availability_request",
      requestId: requestId,
      action: "open_requests",
    },
  });
}

/**
 * Cart payload for "approved" availability so the app can add item to cart.
 * All values must be strings for FCM data.
 */
export interface AvailabilityResponseCartPayload {
  productId: string;
  shopId: string;
  shopName: string;
  productName: string;
  productImage?: string;
  quantity: string;
  price: string;
}

/**
 * Send notification for availability response (to customer).
 * When approved, pass cartPayload so the app can add the item to cart and show "Proceed to checkout".
 */
export async function notifyCustomerAvailabilityResponse(
  customerId: string,
  shopName: string,
  productName: string,
  approved: boolean,
  requestId: string,
  cartPayload?: AvailabilityResponseCartPayload
): Promise<void> {
  const title = approved ? "Product Available!" : "Product Unavailable";
  const body = approved
    ? (cartPayload
        ? "Item was available, added to cart. Proceed to checkout."
        : `${shopName} confirmed "${productName}" is available. You can now add it to cart!`)
    : `Sorry, ${shopName} says "${productName}" is currently unavailable.`;
  const data: Record<string, string> = {
    type: "availability_response",
    requestId: requestId,
    approved: approved ? "true" : "false",
    action: approved ? "open_cart" : "dismiss",
  };
  if (approved && cartPayload) {
    data.productId = cartPayload.productId;
    data.shopId = cartPayload.shopId;
    data.shopName = cartPayload.shopName;
    data.productName = cartPayload.productName;
    data.quantity = cartPayload.quantity;
    data.price = cartPayload.price;
    if (cartPayload.productImage) data.productImage = cartPayload.productImage;
  }
  await createAndSendNotification(customerId, "availability_response", title, body, data);
}

/**
 * Register FCM token for a user
 */
export async function registerFcmToken(
  userId: string,
  token: string
): Promise<boolean> {
  try {
    await User.findByIdAndUpdate(
      userId,
      { $addToSet: { fcmTokens: token } },
      { new: true }
    );
    console.log(`[Notification] Registered FCM token for user ${userId}`);
    return true;
  } catch (error) {
    console.error("[Notification] Error registering FCM token:", error);
    return false;
  }
}

/**
 * Unregister FCM token for a user
 */
export async function unregisterFcmToken(
  userId: string,
  token: string
): Promise<boolean> {
  try {
    await User.findByIdAndUpdate(
      userId,
      { $pull: { fcmTokens: token } },
      { new: true }
    );
    console.log(`[Notification] Unregistered FCM token for user ${userId}`);
    return true;
  } catch (error) {
    console.error("[Notification] Error unregistering FCM token:", error);
    return false;
  }
}
