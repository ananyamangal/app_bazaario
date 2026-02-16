import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, BackHandler, Platform, ToastAndroid } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import SellerCallsScreen from '../screens/seller/SellerCallsScreen';
import SellerDashboardScreen from '../screens/seller/SellerDashboardScreen';
import SellerReviewsScreen from '../screens/seller/SellerReviewsScreen';
import SellerOrdersScreen from '../screens/seller/SellerOrdersScreen';
import SellerProductsScreen from '../screens/seller/SellerProductsScreen';
import SellerProfileTabScreen from '../screens/seller/SellerProfileTabScreen';
import SellerAvailabilityRequestsScreen from '../screens/seller/SellerAvailabilityRequestsScreen';
import ReelInsightsScreen from '../screens/seller/ReelInsightsScreen';
import ConversationsScreen from '../screens/ConversationsScreen';
import ChatScreen from '../screens/ChatScreen';
import VideoCallScreen from '../screens/VideoCallScreen';
import IncomingCallScreen from '../screens/IncomingCallScreen';
import { useChat, Conversation } from '../context/ChatContext';
import { useCall } from '../context/CallContext';
import { useAuth } from '../context/AuthContext';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type SellerTabId = 'Dashboard' | 'Products' | 'Orders' | 'Calls' | 'Profile';
type OverlayScreen = 
  | { type: 'AvailabilityRequests' }
  | { type: 'ReelInsights' }
  | { type: 'Conversations' }
  | { type: 'Chat'; conversation: Conversation }
  | { type: 'Reviews' }
  | null;

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

const TABS: {
  id: SellerTabId;
  label: string;
  icon:
    | 'grid-outline'
    | 'cube-outline'
    | 'receipt-outline'
    | 'videocam-outline'
    | 'person-outline'
    | 'chatbubbles-outline';
}[] = [
  { id: 'Dashboard', label: 'Dashboard', icon: 'grid-outline' },
  { id: 'Products', label: 'Products', icon: 'cube-outline' },
  { id: 'Orders', label: 'Orders', icon: 'receipt-outline' },
  { id: 'Calls', label: 'Calls', icon: 'videocam-outline' },
  { id: 'Profile', label: 'Profile', icon: 'person-outline' },
];

const BACK_EXIT_DELAY_MS = 2000;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function SellerTabNavigator() {
  const [active, setActive] = useState<SellerTabId>('Dashboard');
  const [overlay, setOverlay] = useState<OverlayScreen>(null);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const lastBackPress = useRef(0);
  const insets = useSafeAreaInsets();

  // Android back: close overlay or double-tap to exit
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (overlay !== null) {
        setOverlay(null);
        return true;
      }
      const now = Date.now();
      if (now - lastBackPress.current < BACK_EXIT_DELAY_MS) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPress.current = now;
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      return true;
    });
    return () => sub.remove();
  }, [overlay]);

  const { shop } = useAuth();

  const { totalUnread } = useChat();
  const { callState, currentCall } = useCall();

  const openAvailabilityRequests = () => setOverlay({ type: 'AvailabilityRequests' });
  const openReelInsights = () => setOverlay({ type: 'ReelInsights' });
  const openConversations = () => setOverlay({ type: 'Conversations' });
  const openReviews = () => setOverlay({ type: 'Reviews' });
  const closeOverlay = () => setOverlay(null);

  const handleOpenChat = useCallback((conversation: Conversation) => {
    setOverlay({ type: 'Chat', conversation });
  }, []);

  const handleAcceptCall = useCallback(() => {
    setShowVideoCall(true);
  }, []);

  const handleDeclineCall = useCallback(() => {
    // CallContext handles decline
  }, []);

  const handleCloseVideoCall = useCallback(() => {
    setShowVideoCall(false);
  }, []);

  // Render overlay screen if active
  if (overlay?.type === 'AvailabilityRequests') {
    return <SellerAvailabilityRequestsScreen onBack={closeOverlay} />;
  }
  if (overlay?.type === 'ReelInsights') {
    return <ReelInsightsScreen onBack={closeOverlay} />;
  }
  if (overlay?.type === 'Conversations') {
    return <ConversationsScreen onBack={closeOverlay} onOpenChat={handleOpenChat} />;
  }
  if (overlay?.type === 'Chat') {
    return <ChatScreen conversation={overlay.conversation} onBack={closeOverlay} />;
  }
  if (overlay?.type === 'Reviews') {
    return <SellerReviewsScreen onBack={closeOverlay} shopId={(shop as any)?._id} />;
  }

  // Render the appropriate tab screen with props
  const renderScreen = () => {
    switch (active) {
      case 'Dashboard':
        return (
          <SellerDashboardScreen
            onOpenAvailabilityRequests={openAvailabilityRequests}
            onOpenReelInsights={openReelInsights}
            onOpenReviews={openReviews}
            onOpenConversations={openConversations}
          />
        );
      case 'Products':
        return <SellerProductsScreen onOpenConversations={openConversations} />;
      case 'Orders':
        return <SellerOrdersScreen onOpenConversations={openConversations} />;
      case 'Calls':
        return <SellerCallsScreen onOpenConversations={openConversations} />;
      case 'Profile':
        return <SellerProfileTabScreen onOpenConversations={openConversations} />;
      default:
        return <SellerDashboardScreen onOpenAvailabilityRequests={openAvailabilityRequests} />;
    }
  };

  // Check if we should show incoming call screen
  const showIncomingCall = callState === 'ringing' && currentCall?.isIncoming && !showVideoCall;
  
  // Check if we should show video call screen
  const showActiveVideoCall = showVideoCall || (callState === 'in_call' || callState === 'connecting');

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {renderScreen()}
      </View>
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TABS.map((t) => {
          const isActive = active === t.id;
          const tint = isActive ? colors.primary : colors.mutedForeground;
          const showBadge = false;
          return (
            <Pressable
              key={t.id}
              onPress={() => setActive(t.id)}
              style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
            >
              <View>
                <Ionicons name={t.icon} size={22} color={tint} />
                {showBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, { color: tint }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Incoming Call Overlay */}
      {showIncomingCall && (
        <View style={StyleSheet.absoluteFill}>
          <IncomingCallScreen
            onAccept={handleAcceptCall}
            onDecline={handleDeclineCall}
          />
        </View>
      )}

      {/* Video Call Overlay */}
      {showActiveVideoCall && (
        <View style={StyleSheet.absoluteFill}>
          <VideoCallScreen onClose={handleCloseVideoCall} />
        </View>
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPressed: { opacity: 0.7 },
  tabLabel: { fontSize: 11, fontWeight: '500', marginTop: 4 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.card,
  },
});
