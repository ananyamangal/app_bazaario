import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { apiGetAuth, apiPatchAuth } from '../api/client';
import { useAuth } from './AuthContext';
import { useChat } from './ChatContext';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type NotificationType =
  | 'order'
  | 'call'
  | 'system'
  | 'message'
  | 'review'
  | 'availability_request'
  | 'availability_response';

export type AppNotification = {
  _id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  loadNotifications: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotificationContext() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return ctx;
}

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { socket } = useChat();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiGetAuth<{ notifications: AppNotification[] }>('/notifications');
      setNotifications(res.notifications || []);
    } catch (e) {
      console.error('[Notifications] Failed to load:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiGetAuth<{ count: number }>('/notifications/unread-count');
      setUnreadCount(res.count ?? 0);
    } catch (e) {
      console.error('[Notifications] Failed to get unread count:', e);
    }
  }, [user]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await apiPatchAuth(`/notifications/${notificationId}/read`);
      setNotifications((prev) =>
        // Remove the notification from the in-memory list so it disappears
        // immediately after being marked as read.
        prev.filter((n) => n._id !== notificationId)
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      console.error('[Notifications] Failed to mark as read:', e);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await apiPatchAuth('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error('[Notifications] Failed to mark all as read:', e);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadNotifications();
      refreshUnreadCount();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user, loadNotifications, refreshUnreadCount]);

  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        refreshUnreadCount();
      }
    });
    return () => sub.remove();
  }, [user, refreshUnreadCount]);

  // Real-time: when server emits new_notification, add to list and bump unread count
  useEffect(() => {
    if (!socket || !user) return;
    const onNewNotification = (payload: { notification: AppNotification }) => {
      const n = payload.notification;
      if (!n || !n._id) return;
      setNotifications((prev) => {
        if (prev.some((x) => x._id === n._id)) return prev;
        return [n, ...prev];
      });
      setUnreadCount((c) => c + 1);
    };
    socket.on('new_notification', onNewNotification);
    return () => {
      socket.off('new_notification', onNewNotification);
    };
  }, [socket, user]);

  const value: NotificationContextValue = {
    notifications,
    unreadCount,
    loading,
    loadNotifications,
    refreshUnreadCount,
    markAsRead,
    markAllAsRead,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
