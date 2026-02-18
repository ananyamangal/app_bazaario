import React from 'react';
import {
  Alert,
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import NotificationBell from '../components/NotificationBell';
import { useTabNavigator } from '../navigation/TabContext';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const LOGO_SIZE = 36;
const AVATAR_SIZE = 72;
const HORIZONTAL_PADDING = 16;

const SHADOW_OPACITY = 0.08;
const SHADOW_RADIUS = 8;
const SHADOW_OFFSET = { width: 0, height: 2 };

// -----------------------------------------------------------------------------
// Assets
// -----------------------------------------------------------------------------

const splashLogo: ImageSourcePropType = require('../../assets/bazaario-logo.png');

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

type Props = {
  onOpenOrders?: () => void;
  onOpenSavedShops?: () => void;
  onOpenEditProfile?: () => void;
  onOpenSettings?: () => void;
  onOpenConversations?: () => void;
};

export default function ProfileScreen({ onOpenOrders, onOpenSavedShops, onOpenEditProfile, onOpenSettings, onOpenConversations }: Props) {
  const insets = useSafeAreaInsets();
  const { switchToTab } = useTabNavigator();
  const { signOut, user, profile } = useAuth();
  const { totalUnread: messageCount } = useChat();

  const customerProfile = profile as any;
  const defaultAddress = customerProfile?.addresses?.[0];

  function handleLogo() {
    switchToTab('Home');
  }

  function handleSearch() {
    switchToTab('Explore');
  }

  function handleEditProfile() {
    onOpenEditProfile?.();
  }

  function handleMyOrders() {
    onOpenOrders?.();
  }

  function handleSavedShops() {
    onOpenSavedShops?.();
  }

  function handleSettings() {
    onOpenSettings?.();
  }

  function handleMessages() {
    onOpenConversations?.();
  }

  async function handleLogOut() {
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  }

  const menuItems = [
    { 
      id: 'orders', 
      label: 'My Orders', 
      icon: 'cube-outline' as const, 
      iconBg: true,
      onPress: handleMyOrders,
    },
    { 
      id: 'messages', 
      label: 'Messages', 
      icon: 'chatbubbles-outline' as const, 
      iconBg: false,
      badge: messageCount > 0 ? messageCount : undefined,
      onPress: handleMessages,
    },
    { 
      id: 'savedShops', 
      label: 'Saved Shops', 
      icon: 'bookmark-outline' as const, 
      iconBg: false,
      onPress: handleSavedShops,
    },
    { 
      id: 'settings', 
      label: 'Settings', 
      icon: 'settings-outline' as const, 
      iconBg: false,
      onPress: handleSettings,
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 8, paddingBottom: 100 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleLogo} style={({ pressed }) => [styles.logoRow, pressed && styles.pressed]}>
            <Image source={splashLogo} style={styles.logo} resizeMode="contain" />
            <Text style={styles.logoText}>Bazaario</Text>
          </Pressable>
          <Pressable onPress={handleSearch} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]} hitSlop={8}>
            <Ionicons name="search" size={22} color={colors.foreground} />
          </Pressable>
          <NotificationBell dropdownTop={insets.top + 56} />
        </View>

        <Text style={styles.title}>My Profile</Text>

        {/* User Card */}
        <View style={styles.card}>
          <View style={styles.userCardRow}>
            <View style={styles.avatar}>
              {user?.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={36} color={colors.primary} />
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.name || 'Customer'}</Text>
              <Text style={styles.userPhone}>{user?.phone || 'No phone'}</Text>
              {user?.email && <Text style={styles.userEmail}>{user.email}</Text>}
              <Pressable onPress={handleEditProfile} hitSlop={8}>
                <Text style={styles.editLink}>Edit Profile</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Default Address */}
        {defaultAddress && (
          <View style={styles.card}>
            <View style={styles.addressHeader}>
              <Ionicons name="location-outline" size={20} color={colors.primary} />
              <Text style={styles.addressLabel}>{defaultAddress.label || 'Address'}</Text>
            </View>
            <Text style={styles.addressText}>
              {defaultAddress.line1}
              {defaultAddress.line2 ? `, ${defaultAddress.line2}` : ''}
            </Text>
            <Text style={styles.addressCity}>
              {defaultAddress.city}, {defaultAddress.state} - {defaultAddress.pincode}
            </Text>
          </View>
        )}

        {/* Action List */}
        <View style={styles.card}>
          {menuItems.map((item, i) => (
            <React.Fragment key={item.id}>
              <Pressable
                onPress={item.onPress}
                style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
              >
                <View style={[styles.menuIconWrap, item.iconBg && styles.menuIconWrapPink]}>
                  <Ionicons name={item.icon} size={20} color={colors.primary} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                {item.badge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
              </Pressable>
              {i < menuItems.length - 1 && <View style={styles.menuDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Log Out */}
        <Pressable
          onPress={handleLogOut}
          style={({ pressed }) => [styles.logoutBtn, pressed && styles.btnPressed]}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
          <Text style={styles.logoutLabel}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: HORIZONTAL_PADDING, paddingBottom: 100 },
  pressed: { opacity: 0.85 },
  btnPressed: { opacity: 0.9 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  logoText: { fontSize: 18, fontWeight: '700', color: colors.foreground, fontFamily: 'Impact' },
  iconBtn: { padding: 4, marginLeft: 8, position: 'relative' as const },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 20,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: SHADOW_OFFSET,
    shadowOpacity: SHADOW_OPACITY,
    shadowRadius: SHADOW_RADIUS,
    elevation: 2,
  },

  userCardRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  userInfo: { marginLeft: 16, flex: 1, justifyContent: 'center' },
  userName: { fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 4 },
  userPhone: { fontSize: 15, color: colors.mutedForeground },
  userEmail: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  editLink: { fontSize: 15, fontWeight: '600', color: colors.primary, marginTop: 8 },

  addressHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  addressLabel: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  addressText: { fontSize: 14, color: colors.foreground, marginBottom: 2 },
  addressCity: { fontSize: 13, color: colors.mutedForeground },

  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuIconWrapPink: { backgroundColor: colors.secondary },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: '500', color: colors.foreground },
  menuDivider: { height: 1, backgroundColor: colors.border, marginLeft: 54 },
  badge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: colors.card },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    paddingVertical: 16,
    borderRadius: radius.xl,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.destructive,
  },
  logoutLabel: { fontSize: 16, fontWeight: '600', color: colors.destructive },
});
