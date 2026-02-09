import admin from "../config/firebase";
import User from "../models/user.model";
import { Notification, NotificationType } from "../models/notification.model";

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Send push notification to a specific user
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

    const tokens = (user as any).fcmTokens || [];
    if (tokens.length === 0) {
      console.log(`[Notification] No FCM tokens for user ${userId}`);
      return { success: false, sent: 0, failed: 0 };
    }

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      android: {
        notification: {
          channelId: "bazaario_default",
          priority: "high",
          sound: "default",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(
      `[Notification] Sent to user ${userId}: ${response.successCount} success, ${response.failureCount} failed`
    );

    // Remove invalid tokens
    if (response.failureCount > 0) {
      const invalidTokens: string[] = [];
      response.responses.forEach((resp: any, idx: number) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered"
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        await User.findByIdAndUpdate(userId, {
          $pull: { fcmTokens: { $in: invalidTokens } },
        });
        console.log(`[Notification] Removed ${invalidTokens.length} invalid tokens`);
      }
    }

    return {
      success: response.successCount > 0,
      sent: response.successCount,
      failed: response.failureCount,
    };
  } catch (error) {
    console.error("[Notification] Error sending push:", error);
    return { success: false, sent: 0, failed: 0 };
  }
}

/**
 * Create an in-app notification and send push to the user.
 * Use this for all notification types so they appear in the app and as push.
 */
export async function createAndSendNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  try {
    await Notification.create({
      userId,
      type,
      title,
      message: body,
      isRead: false,
      data: data || undefined,
    });
    await sendPushNotification(userId, { title, body, data });
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
