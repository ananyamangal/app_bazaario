import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useNotificationContext, AppNotification } from '../context/NotificationContext';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Props = {
  /** Vertical offset from top for the dropdown (e.g. insets.top + 56) */
  dropdownTop?: number;
  /** Called when user taps a notification; use to navigate (e.g. to chat, order) */
  onNotificationPress?: (notification: AppNotification) => void;
};

function getIconForType(type: AppNotification['type']) {
  switch (type) {
    case 'order':
      return 'cart';
    case 'message':
      return 'chatbubbles';
    case 'review':
      return 'star';
    case 'call':
      return 'videocam';
    case 'availability_request':
    case 'availability_response':
      return 'cube';
    default:
      return 'notifications';
  }
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function NotificationBell({ dropdownTop = 100, onNotificationPress }: Props) {
  const [open, setOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    loading,
    loadNotifications,
    refreshUnreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotificationContext();

  function handleBellPress() {
    setOpen((v) => !v);
    if (!open) {
      loadNotifications();
      refreshUnreadCount();
    }
  }

  function handleClose() {
    setOpen(false);
  }

  async function handleNotificationPress(n: AppNotification) {
    if (!n.isRead) await markAsRead(n._id);
    setOpen(false);
    onNotificationPress?.(n);
  }

  return (
    <>
      <Pressable
        onPress={handleBellPress}
        style={({ pressed }) => [styles.bellWrap, pressed && styles.pressed]}
        hitSlop={8}
      >
        <Ionicons name="notifications-outline" size={24} color={colors.foreground} />
        {unreadCount > 0 && <View style={styles.bellBadge} />}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          <View style={[styles.dropdown, { top: dropdownTop }]}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>Notifications</Text>
              {notifications.length > 0 && (
                <Pressable onPress={markAllAsRead} hitSlop={8}>
                  <Text style={styles.markAllRead}>Mark all read</Text>
                </Pressable>
              )}
            </View>
            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : notifications.length > 0 ? (
              notifications.slice(0, 20).map((n) => (
                <Pressable
                  key={n._id}
                  onPress={() => handleNotificationPress(n)}
                  style={({ pressed }) => [
                    styles.notifRow,
                    pressed && styles.notifRowPressed,
                    !n.isRead && styles.notifRowUnread,
                  ]}
                >
                  <View style={styles.notifIconWrap}>
                    <Ionicons
                      name={getIconForType(n.type) as any}
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.notifBody}>
                    <Text style={styles.notifTitle} numberOfLines={1}>{n.title}</Text>
                    <Text style={styles.notifText} numberOfLines={2}>{n.message}</Text>
                  </View>
                </Pressable>
              ))
            ) : (
              <Text style={styles.emptyText}>No notifications yet</Text>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  bellWrap: { position: 'relative' as const, padding: 4 },
  pressed: { opacity: 0.85 },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.destructive,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  dropdown: {
    position: 'absolute',
    right: 16,
    minWidth: 280,
    maxWidth: 320,
    maxHeight: 400,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  markAllRead: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  loadingWrap: {
    padding: 24,
    alignItems: 'center',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  notifRowPressed: { backgroundColor: colors.muted },
  notifRowUnread: { backgroundColor: colors.secondary },
  notifIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBody: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  notifText: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  emptyText: {
    padding: 20,
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center' as const,
  },
});
