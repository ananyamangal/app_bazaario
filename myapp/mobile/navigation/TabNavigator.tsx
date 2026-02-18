import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Pressable, PanResponder, StyleSheet, Text, View, Alert, BackHandler, Platform, ToastAndroid } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { useCart } from '../context/CartContext';
import CartScreen from '../screens/CartScreen';
import ShopReelsScreen from '../screens/ShopReelsScreen';
import ExploreScreen from '../screens/ExploreScreen';
import HomeScreen from '../screens/HomeScreen';
import CategoryShopsScreen from '../screens/CategoryShopsScreen';
import MarketDetailScreen from '../screens/MarketDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ShopDetailScreen from '../screens/ShopDetailScreen';
import MyOrdersScreen from '../screens/MyOrdersScreen';
import SavedShopsScreen from '../screens/SavedShopsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ConversationsScreen from '../screens/ConversationsScreen';
import ChatScreen from '../screens/ChatScreen';
import VideoCallScreen from '../screens/VideoCallScreen';
import IncomingCallScreen from '../screens/IncomingCallScreen';
import ScheduleCallbackModal from '../screens/ScheduleCallbackModal';
import SearchResultsScreen from '../screens/SearchResultsScreen';
import SupportScreen from '../screens/SupportScreen';
import CategoryListScreen from '../screens/CategoryListScreen';
import { useChat, Conversation } from '../context/ChatContext';
import { useCall } from '../context/CallContext';
import {
  TabNavigatorContext,
  type CategoryShopsParams,
  type MarketDetailParams,
  type ShopDetailParams,
  type TabContextValue,
  type TabId,
} from './TabContext';

export type { CategoryShopsParams, MarketDetailParams, ShopDetailParams, TabId };

type OverlayItem =
  | { type: 'MarketDetail'; params: MarketDetailParams }
  | { type: 'ShopDetail'; params: ShopDetailParams }
  | { type: 'CategoryShops'; params: CategoryShopsParams }
  | { type: 'MyOrders' }
  | { type: 'SavedShops' }
  | { type: 'EditProfile' }
  | { type: 'Conversations' }
  | { type: 'Chat'; params: { conversation: Conversation } }
  | { type: 'Settings' }
  | { type: 'Support' }
  | { type: 'CategoryList' };

const TABS: { id: TabId; label: string; icon: 'home' | 'search' | 'play-circle' | 'cart' | 'person' }[] = [
  { id: 'Home', label: 'Home', icon: 'home' },
  { id: 'Explore', label: 'Explore', icon: 'search' },
  { id: 'Shop', label: 'Shop', icon: 'play-circle' },
  { id: 'Cart', label: 'Cart', icon: 'cart' },
  { id: 'Profile', label: 'Profile', icon: 'person' },
];

// Listens for post-call invoice from seller and adds to cart, then shows "View cart" popup
function InvoiceReadyListener({ switchToTab }: { switchToTab: (tab: TabId) => void }) {
  const { socket } = useChat();
  const { addItem } = useCart();

  useEffect(() => {
    if (!socket) return;
    const onInvoiceReady = (data: {
      invoiceId: string;
      shopId: string;
      shopName: string;
      itemName: string;
      price: number;
      imageUrl: string;
      quantity: number;
      expiresAt?: string;
    }) => {
      addItem(
        {
          productId: data.invoiceId,
          shopId: data.shopId,
          shopName: data.shopName,
          name: data.itemName,
          price: data.price,
          image: data.imageUrl || undefined,
          invoiceExpiresAt: data.expiresAt,
        },
        data.quantity
      );
      Alert.alert(
        'Your invoice is ready!',
        'The seller has added the item from your call. View cart and checkout.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'View cart & checkout', onPress: () => switchToTab('Cart') },
        ]
      );
    };
    socket.on('invoice_ready', onInvoiceReady);
    return () => { socket.off('invoice_ready', onInvoiceReady); };
  }, [socket, addItem, switchToTab]);

  return null;
}


const BACK_EXIT_DELAY_MS = 2000;

const LEFT_EDGE_SWIPE_WIDTH = 28;
const SWIPE_BACK_THRESHOLD = 50;

export default function TabNavigator() {
  const [active, setActive] = useState<TabId>('Home');
  const [overlayStack, setOverlayStack] = useState<OverlayItem[]>([]);
  const lastBackPress = useRef(0);
  const swipeStartX = useRef(0);
  const insets = useSafeAreaInsets();
  const top = overlayStack[overlayStack.length - 1];

  const goBack = useCallback(() => setOverlayStack((s) => s.slice(0, -1)), []);
  const overlaySwipeBack = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetResponder: () => false,
        onMoveShouldSetResponder: (_, evt) => evt.nativeEvent.pageX <= LEFT_EDGE_SWIPE_WIDTH,
        onPanResponderGrant: (_, evt) => {
          swipeStartX.current = evt.nativeEvent.pageX;
        },
        onPanResponderRelease: (_, evt) => {
          if (evt.nativeEvent.pageX - swipeStartX.current >= SWIPE_BACK_THRESHOLD) {
            goBack();
          }
        },
      }),
    [goBack]
  );

  // Android back: pop overlay or double-tap to exit
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (overlayStack.length > 0) {
        setOverlayStack((s) => s.slice(0, -1));
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
  }, [overlayStack.length]);

  // Chat and Call contexts
  const { totalUnread } = useChat();
  const { callState, currentCall, scheduleCallbackPrompt, clearScheduleCallbackPrompt } = useCall();

  // Video call overlays
  const [showVideoCall, setShowVideoCall] = useState(false);

  const value: TabContextValue = {
    switchToTab: setActive,
    openMarketDetail: (p) => setOverlayStack((s) => [...s, { type: 'MarketDetail', params: p }]),
    openShopDetail: (p) => setOverlayStack((s) => [...s, { type: 'ShopDetail', params: p }]),
    openCategoryShops: (p) => setOverlayStack((s) => [...s, { type: 'CategoryShops', params: p }]),
    openCategoryList: () => setOverlayStack((s) => [...s, { type: 'CategoryList' }]),
    openConversations: () => setOverlayStack((s) => [...s, { type: 'Conversations' }]),
    openSearchResults: (query) => setOverlayStack((s) => [...s, { type: 'SearchResults', params: { query } }]),
    goBack,
  };

  // Helper functions for profile overlays
  const openOrders = () => setOverlayStack((s) => [...s, { type: 'MyOrders' }]);
  const openSavedShops = () => setOverlayStack((s) => [...s, { type: 'SavedShops' }]);
  const openEditProfile = () => setOverlayStack((s) => [...s, { type: 'EditProfile' }]);
  const openConversations = () => setOverlayStack((s) => [...s, { type: 'Conversations' }]);
  const openSettings = () => setOverlayStack((s) => [...s, { type: 'Settings' }]);
  const openSupport = () => setOverlayStack((s) => [...s, { type: 'Support' }]);
  const handleViewShop = (shopId: string) => {
    setOverlayStack((s) => [...s, { type: 'ShopDetail', params: { shopId } }]);
  };

  // Handle shop press from ShopReels
  const handleShopPressFromReels = (shopId: string) => {
    setOverlayStack((s) => [...s, { type: 'ShopDetail', params: { shopId } }]);
  };

  // Handle opening chat from conversation list
  const handleOpenChat = useCallback((conversation: Conversation) => {
    setOverlayStack((s) => [...s, { type: 'Chat', params: { conversation } }]);
  }, []);

  // Handle accepting incoming call
  const handleAcceptCall = useCallback(() => {
    setShowVideoCall(true);
  }, []);

  // Handle declining incoming call
  const handleDeclineCall = useCallback(() => {
    // CallContext handles the decline
  }, []);

  // Handle closing video call
  const handleCloseVideoCall = useCallback(() => {
    setShowVideoCall(false);
  }, []);

  // Render the appropriate screen or overlay
  function renderContent() {
    if (top?.type === 'MarketDetail') {
      return <MarketDetailScreen {...top.params} onBack={value.goBack} />;
    }
    if (top?.type === 'ShopDetail') {
      return <ShopDetailScreen {...top.params} onBack={value.goBack} onOpenChat={handleOpenChat} />;
    }
    if (top?.type === 'CategoryShops') {
      return <CategoryShopsScreen {...top.params} onBack={value.goBack} />;
    }
    if (top?.type === 'MyOrders') {
      return <MyOrdersScreen onBack={value.goBack} />;
    }
    if (top?.type === 'SavedShops') {
      return <SavedShopsScreen onBack={value.goBack} onViewShop={(shopId) => value.openShopDetail({ shopId })} />;
    }
    if (top?.type === 'EditProfile') {
      return <EditProfileScreen onBack={value.goBack} />;
    }
    if (top?.type === 'Conversations') {
      return <ConversationsScreen onBack={value.goBack} onOpenChat={handleOpenChat} />;
    }
    if (top?.type === 'Chat') {
      return <ChatScreen conversation={top.params.conversation} onBack={value.goBack} />;
    }
    if (top?.type === 'Settings') {
      return <SettingsScreen onBack={value.goBack} onOpenSupport={openSupport} />;
    }
    if (top?.type === 'Support') {
      return <SupportScreen onBack={value.goBack} />;
    }
    if (top?.type === 'CategoryList') {
      return (
        <CategoryListScreen
          onBack={value.goBack}
          onOpenShop={(shopId) => {
            value.goBack();
            setOverlayStack((s) => [...s, { type: 'ShopDetail', params: { shopId } }]);
          }}
        />
      );
    }
    if (top?.type === 'SearchResults') {
      return <SearchResultsScreen onBack={value.goBack} initialQuery={top.params.query} />;
    }
    
    // Render the active tab screen
    switch (active) {
      case 'Home':
        return <HomeScreen />;
      case 'Explore':
        return <ExploreScreen />;
      case 'Shop':
        return <ShopReelsScreen onShopPress={handleShopPressFromReels} onOpenChat={handleOpenChat} />;
      case 'Cart':
        return <CartScreen />;
      case 'Profile':
        return (
          <ProfileScreen
            onOpenOrders={openOrders}
            onOpenSavedShops={openSavedShops}
            onOpenEditProfile={openEditProfile}
            onOpenSettings={openSettings}
            onOpenConversations={openConversations}
          />
        );
      default:
        return <HomeScreen />;
    }
  }

  // For Shop tab, use transparent floating tab bar
  const isShopFullscreen = active === 'Shop' && overlayStack.length === 0;

  // Check if we should show incoming call screen
  const showIncomingCall = callState === 'ringing' && currentCall?.isIncoming && !showVideoCall;
  
  // Show video call screen: outgoing ringing (customer waiting), connecting, or in call. Incoming ringing shows IncomingCallScreen.
  const showActiveVideoCall = showVideoCall || (callState === 'in_call' || callState === 'connecting' || (callState === 'ringing' && currentCall && !currentCall.isIncoming));

  return (
    <TabNavigatorContext.Provider value={value}>
      <InvoiceReadyListener switchToTab={value.switchToTab} />
      <View style={styles.container}>
        <View style={styles.content}>
          {overlayStack.length > 0 && (
            <View
              style={styles.leftEdgeSwipeStrip}
              {...overlaySwipeBack.panHandlers}
              pointerEvents="box-only"
            />
          )}
          {renderContent()}
        </View>
        <View style={[
          styles.tabBar, 
          { paddingBottom: Math.max(insets.bottom, 8) },
          isShopFullscreen && styles.tabBarTransparent
        ]}>
          {TABS.map((t) => {
            const isActive = active === t.id;
            const tint = isShopFullscreen 
              ? (isActive ? '#FFFFFF' : 'rgba(255,255,255,0.7)') 
              : (isActive ? colors.primary : colors.mutedForeground);
            return (
              <Pressable
                key={t.id}
                onPress={() => {
                  setOverlayStack([]);
                  setActive(t.id);
                }}
                style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
              >
                <View>
                  <Ionicons name={t.icon} size={24} color={tint} />
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

        {/* Schedule Callback Modal (when shop not accepting / declined / no answer) */}
        {scheduleCallbackPrompt && (
          <ScheduleCallbackModal
            visible={!!scheduleCallbackPrompt}
            shopId={scheduleCallbackPrompt.shopId}
            shopName={scheduleCallbackPrompt.shopName}
            fromDeclinedOrNoAnswer={scheduleCallbackPrompt.fromDeclinedOrNoAnswer}
            onClose={clearScheduleCallbackPrompt}
            onScheduled={clearScheduleCallbackPrompt}
          />
        )}
      </View>
    </TabNavigatorContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  leftEdgeSwipeStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: LEFT_EDGE_SWIPE_WIDTH,
    zIndex: 10,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  tabBarTransparent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPressed: { opacity: 0.7 },
  tabLabel: { fontSize: 12, fontWeight: '500', marginTop: 4 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.card,
  },
});
