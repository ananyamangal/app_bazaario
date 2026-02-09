import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiPostAuth } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useAvailability } from '../context/AvailabilityContext';
import { useAvailabilityCart } from '../context/AvailabilityCartContext';

// Configure how notifications appear when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function useNotifications() {
  const { user } = useAuth();
  const { clearCache, refreshPendingCount } = useAvailability();
  const { setPending: setPendingAvailabilityCart } = useAvailabilityCart();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

  useEffect(() => {
    // Register for push notifications
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token);
        // Send token to backend
        sendTokenToBackend(token);
      }
    });

    // Listen for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      setNotification(notification);
      handleNotificationReceived(notification);
    });

    // Listen for user interactions with notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response);
    });

    return () => {
      if (notificationListener.current?.remove) {
        notificationListener.current.remove();
      }
      if (responseListener.current?.remove) {
        responseListener.current.remove();
      }
    };
  }, [user]);

  async function sendTokenToBackend(token: string) {
    if (!user) return;
    
    try {
      await apiPostAuth('/notifications/register-token', { token });
      console.log('[Notifications] Token registered with backend');
    } catch (error) {
      console.error('[Notifications] Failed to register token:', error);
    }
  }

  function handleNotificationReceived(notification: Notifications.Notification) {
    const data = notification.request.content.data as any;
    console.log('[Notifications] Received:', data);

    // Handle different notification types
    if (data?.type === 'availability_request') {
      // Seller received an availability request - refresh pending count
      refreshPendingCount();
    } else if (data?.type === 'availability_response') {
      clearCache();
      // When approved with cart payload, signal so TabNavigator can add to cart and show "Proceed to checkout"
      if (data?.approved === 'true' && data?.productId && data?.shopId && data?.shopName && data?.productName && data?.quantity != null && data?.price != null) {
        setPendingAvailabilityCart({
          productId: String(data.productId),
          shopId: String(data.shopId),
          shopName: String(data.shopName),
          productName: String(data.productName),
          productImage: data.productImage ? String(data.productImage) : undefined,
          quantity: String(data.quantity),
          price: String(data.price),
        });
      }
    }
  }

  function handleNotificationResponse(response: Notifications.NotificationResponse) {
    const data = response.notification.request.content.data as any;
    console.log('[Notifications] User interacted with:', data);

    // Handle navigation based on notification type
    if (data?.type === 'availability_request' && data?.action === 'open_requests') {
      // TODO: Navigate to availability requests screen
    } else if (data?.type === 'availability_response' && data?.approved === 'true' && data?.productId && data?.shopId && data?.shopName && data?.productName && data?.quantity != null && data?.price != null) {
      // Same as received: signal so TabNavigator adds to cart and shows "Proceed to checkout"
      setPendingAvailabilityCart({
        productId: String(data.productId),
        shopId: String(data.shopId),
        shopName: String(data.shopName),
        productName: String(data.productName),
        productImage: data.productImage ? String(data.productImage) : undefined,
        quantity: String(data.quantity),
        price: String(data.price),
      });
    }
  }

  return {
    expoPushToken,
    notification,
  };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('bazaario_default', {
      name: 'Bazaario',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4F46E5',
    });
  }

  if (!Device.isDevice) {
    console.log('[Notifications] Must use physical device for push notifications');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Failed to get push notification permission');
    return null;
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) {
      console.warn('[Notifications] No EAS projectId in app config; push token may fail.');
    }
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: projectId ?? undefined,
    });
    token = tokenResponse.data;
    console.log('[Notifications] Expo Push Token:', token);
  } catch (error) {
    console.error('[Notifications] Failed to get push token:', error);
  }

  return token;
}

// Helper function to schedule a local notification (useful for testing)
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: { seconds: 1 },
  });
}
