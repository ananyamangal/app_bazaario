import React, { useState, useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, Alert } from 'react-native';
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
import WishlistScreen from '../screens/WishlistScreen';
import SavedShopsScreen from '../screens/SavedShopsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ConversationsScreen from '../screens/ConversationsScreen';
import ChatScreen from '../screens/ChatScreen';
import VideoCallScreen from '../screens/VideoCallScreen';
import IncomingCallScreen from '../screens/IncomingCallScreen';
import ScheduleCallbackModal from '../screens/ScheduleCallbackModal';
import SearchResultsScreen from '../screens/SearchResultsScreen';
import { useChat, Conversation } from '../context/ChatContext';
import { useCall } from '../context/CallContext';
import { useAvailabilityCart } from '../context/AvailabilityCartContext';
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
  | { type: 'Wishlist' }
  | { type: 'SavedShops' }
  | { type: 'EditProfile' }
  | { type: 'Conversations' }
  | { type: 'Chat'; params: { conversation: Conversation } }
  | { type: 'Settings' };

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

// When seller approves availability, push sets pending payload; we add to cart and show "Proceed to checkout"
function AvailabilityResponseCartListener({ switchToTab }: { switchToTab: (tab: TabId) => void }) {
  const { pending, setPending } = useAvailabilityCart();
  const { addItem } = useCart();

  useEffect(() => {
    if (!pending) return;
    const qty = Math.max(1, parseInt(pending.quantity, 10) || 1);
    const price = parseFloat(pending.price) || 0;
    addItem(
      {
        productId: pending.productId,
        shopId: pending.shopId,
        shopName: pending.shopName,
        name: pending.productName,
        price,
        image: pending.productImage,
      },
      qty
    );
    setPending(null);
    Alert.alert(
      'Item added to cart',
      'It was available and has been added to your cart. Proceed to checkout.',
      [
        { text: 'OK', style: 'cancel' },
        { text: 'View cart & checkout', onPress: () => switchToTab('Cart') },
      ]
    );
  }, [pending, addItem, setPending, switchToTab]);

  return null;
}

export default function TabNavigator() {
  const [active, setActive] = useState<TabId>('Home');
  const [overlayStack, setOverlayStack] = useState<OverlayItem[]>([]);
  const insets = useSafeAreaInsets();
  const top = overlayStack[overlayStack.length - 1];

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
    openConversations: () => setOverlayStack((s) => [...s, { type: 'Conversations' }]),
    openSearchResults: (query) => setOverlayStack((s) => [...s, { type: 'SearchResults', params: { query } }]),
    goBack: () => setOverlayStack((s) => s.slice(0, -1)),
  };

  // Helper functions for profile overlays
  const openOrders = () => setOverlayStack((s) => [...s, { type: 'MyOrders' }]);
  const openWishlist = () => setOverlayStack((s) => [...s, { type: 'Wishlist' }]);
  const openSavedShops = () => setOverlayStack((s) => [...s, { type: 'SavedShops' }]);
  const openEditProfile = () => setOverlayStack((s) => [...s, { type: 'EditProfile' }]);
  const openConversations = () => setOverlayStack((s) => [...s, { type: 'Conversations' }]);
  const openSettings = () => setOverlayStack((s) => [...s, { type: 'Settings' }]);
  
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
    if (top?.type === 'Wishlist') {
      return <WishlistScreen onBack={value.goBack} onViewShop={handleViewShop} />;
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
      return <SettingsScreen onBack={value.goBack} />;
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
        return <ShopReelsScreen onShopPress={handleShopPressFromReels} />;
      case 'Cart':
        return <CartScreen />;
      case 'Profile':
        return (
          <ProfileScreen
            onOpenOrders={openOrders}
            onOpenWishlist={openWishlist}
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
      <AvailabilityResponseCartListener switchToTab={value.switchToTab} />
      <View style={styles.container}>
        <View style={styles.content}>
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
