import React, { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { apiGet, apiPost, apiGetAuth, apiPostAuth, apiPutAuth, apiDeleteAuth } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useAvailability } from '../../context/AvailabilityContext';
import { useChat } from '../../context/ChatContext';
import { useNotificationContext } from '../../context/NotificationContext';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const ACCENT_YELLOW = '#FDE68A';
const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 };
const PAD = 16;
const CARD_RADIUS = radius.lg;
const GAP = 12;
const SECTION_GAP = 20;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

type OrderStats = {
  pending: number;
  confirmed: number;
  preparing: number;
  ready: number;
  delivered: number;
  totalRevenue: number;
};

type Props = {
  onOpenAvailabilityRequests?: () => void;
  onOpenReelInsights?: () => void;
  onOpenReviews?: () => void;
  onOpenConversations?: () => void;
};

export default function SellerDashboardScreen({ onOpenAvailabilityRequests, onOpenReelInsights, onOpenReviews, onOpenConversations }: Props = {}) {
  const insets = useSafeAreaInsets();
  const { shop, user, refreshUser } = useAuth();
  const { pendingCount, refreshPendingCount } = useAvailability();
  const { totalUnread } = useChat();
  const { unreadCount: notificationUnreadCount, notifications, loadNotifications, refreshUnreadCount, markAsRead, markAllAsRead } = useNotificationContext();

  const [isOpen, setIsOpen] = useState(shop?.isActive ?? true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [videoOn, setVideoOn] = useState((shop as any)?.videoEnabled ?? true);
  const [instantCallsOn, setInstantCallsOn] = useState((shop as any)?.instantCallsEnabled ?? false);

  const [shopImages, setShopImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingImageUrl, setDeletingImageUrl] = useState<string | null>(null);
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  
  // Edit shop modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editField, setEditField] = useState<'name' | 'description' | 'categories' | 'returnDays' | 'exchangeDays' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Banner modal
  const [bannerModalVisible, setBannerModalVisible] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [currentBanner, setCurrentBanner] = useState<string | null>((shop as any)?.banner || null);

  // Promotions modal
  const [promoModalVisible, setPromoModalVisible] = useState(false);
  const [promoTitle, setPromoTitle] = useState('');
  const [promoDiscount, setPromoDiscount] = useState('');
  const [promoDescription, setPromoDescription] = useState('');

  // Preview modal
  const [previewModalVisible, setPreviewModalVisible] = useState(false);

  // Reel upload modal
  const [reelModalVisible, setReelModalVisible] = useState(false);
  const [reelUploading, setReelUploading] = useState(false);

  // Call timings modal
  const [timingModalVisible, setTimingModalVisible] = useState(false);
  const [timingStart, setTimingStart] = useState((shop as any)?.callTimings?.start || '10:00');
  const [timingEnd, setTimingEnd] = useState((shop as any)?.callTimings?.end || '20:00');
  const [timingDays, setTimingDays] = useState<string[]>(
    (shop as any)?.callTimings?.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  );
  const [savingTimings, setSavingTimings] = useState(false);

  const WEEK_DAYS: { id: string; label: string }[] = [
    { id: 'Mon', label: 'Mon' },
    { id: 'Tue', label: 'Tue' },
    { id: 'Wed', label: 'Wed' },
    { id: 'Thu', label: 'Thu' },
    { id: 'Fri', label: 'Fri' },
    { id: 'Sat', label: 'Sat' },
    { id: 'Sun', label: 'Sun' },
  ];

  const shopId = shop?._id;
  const shopName = shop?.name || user?.name || 'My Shop';

  // Update local state when shop changes
  useEffect(() => {
    if (shop) {
      setIsOpen(shop.isActive ?? true);
      setVideoOn((shop as any).videoEnabled ?? true);
      setInstantCallsOn((shop as any).instantCallsEnabled ?? false);
      if ((shop as any).banner) {
        setCurrentBanner((shop as any).banner);
      }
      if ((shop as any).callTimings) {
        setTimingStart((shop as any).callTimings.start || '10:00');
        setTimingEnd((shop as any).callTimings.end || '20:00');
        setTimingDays(
          (shop as any).callTimings.days && (shop as any).callTimings.days.length > 0
            ? (shop as any).callTimings.days
            : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        );
      }
    }
  }, [shop]);

  // Load existing images and order stats
  useEffect(() => {
    async function fetchData() {
      if (!shopId) return;
      
      try {
        // Fetch shop images
        const imgData = await apiGet<{ images: string[] }>(`/shops/${shopId}/images`);
        setShopImages(imgData.images ?? []);
      } catch (error) {
        console.warn('[SellerDashboard] Failed to load shop images', error);
      }

      try {
        // Fetch order stats
        const ordersData = await apiGetAuth<{ stats: any[] }>('/orders/seller?limit=0');
        if (ordersData.stats) {
          const stats: OrderStats = {
            pending: 0,
            confirmed: 0,
            preparing: 0,
            ready: 0,
            delivered: 0,
            totalRevenue: 0,
          };
          ordersData.stats.forEach((s: { _id: string; count: number; total: number }) => {
            if (s._id in stats) {
              (stats as any)[s._id] = s.count;
            }
            if (s._id === 'delivered') {
              stats.totalRevenue = s.total;
            }
          });
          setOrderStats(stats);
        }
      } catch (error) {
        console.warn('[SellerDashboard] Failed to load order stats', error);
      }
    }

    fetchData();
  }, [shopId]);

  // Set shop images from shop data
  useEffect(() => {
    if (shop?.images && shop.images.length > 0) {
      setShopImages(shop.images);
    }
  }, [shop]);

  // Save shop setting to backend
  const saveShopSetting = async (key: string, value: any) => {
    if (!shopId) return;
    try {
      await apiPutAuth(`/shops/${shopId}`, { [key]: value });
      await refreshUser();
    } catch (error) {
      console.warn('[SellerDashboard] Failed to save setting', error);
      Alert.alert('Error', 'Failed to save setting');
    }
  };

  // Toggle shop open/closed
  const handleToggleOpen = async (value: boolean) => {
    setIsOpen(value);
    await saveShopSetting('isActive', value);
  };

  // Toggle video availability
  const handleToggleVideo = async (value: boolean) => {
    setVideoOn(value);
    await saveShopSetting('videoEnabled', value);
  };

  // Toggle instant calls
  const handleToggleInstantCalls = async (value: boolean) => {
    setInstantCallsOn(value);
    await saveShopSetting('instantCallsEnabled', value);
  };

  const toggleDay = (dayId: string) => {
    setTimingDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
    );
  };

  const handleSaveTimings = async () => {
    if (!shopId) return;
    if (!timingStart || !timingEnd) {
      Alert.alert('Invalid time', 'Please enter both start and end time.');
      return;
    }
    if (timingDays.length === 0) {
      Alert.alert('Select days', 'Please select at least one day.');
      return;
    }
    try {
      setSavingTimings(true);
      await apiPutAuth(`/shops/${shopId}`, {
        callTimings: {
          start: timingStart,
          end: timingEnd,
          days: timingDays,
        },
      });
      await refreshUser();
      setTimingModalVisible(false);
      Alert.alert('Saved', 'Call timings updated successfully.');
    } catch (e) {
      console.warn('[SellerDashboard] Failed to save call timings', e);
      Alert.alert('Error', 'Failed to update call timings');
    } finally {
      setSavingTimings(false);
    }
  };

  // Open edit modal
  const openEditModal = (field: 'name' | 'description' | 'categories' | 'returnDays' | 'exchangeDays') => {
    setEditField(field);
    if (field === 'name') setEditValue(shop?.name || '');
    else if (field === 'description') setEditValue(shop?.description || '');
    else if (field === 'categories') setEditValue(shop?.categories?.join(', ') || '');
    else if (field === 'returnDays') setEditValue((shop as any)?.returnDays != null ? String((shop as any).returnDays) : '');
    else if (field === 'exchangeDays') setEditValue((shop as any)?.exchangeDays != null ? String((shop as any).exchangeDays) : '');
    setEditModalVisible(true);
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!shopId || !editField) return;
    setSaving(true);
    try {
      let value: any = editValue;
      if (editField === 'categories') {
        value = editValue.split(',').map(c => c.trim()).filter(c => c);
      } else if (editField === 'returnDays' || editField === 'exchangeDays') {
        const n = parseInt(editValue.trim(), 10);
        value = Number.isNaN(n) ? null : Math.max(0, n);
      }
      await apiPutAuth(`/shops/${shopId}`, { [editField]: value });
      await refreshUser();
      setEditModalVisible(false);
      Alert.alert('Success', 'Shop updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update shop');
    } finally {
      setSaving(false);
    }
  };

  const uploadBannerFromSource = async (useCamera: boolean) => {
    if (!shopId) return;
    try {
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission required', 'We need camera access to take a banner photo.');
          return;
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission required', 'We need access to your photos to upload a banner.');
          return;
        }
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
          });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (!asset.uri) return;

      setBannerUploading(true);

      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const res = await apiPost<{ url: string }>(`/shops/${shopId}/banner`, {
        imageBase64: base64,
      });

      if (res?.url) {
        setCurrentBanner(res.url);
        await refreshUser();
        Alert.alert('Success', 'Banner uploaded successfully');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload banner');
    } finally {
      setBannerUploading(false);
    }
  };

  const handleUploadBanner = () => {
    Alert.alert('Banner image', 'Choose source', [
      { text: 'Take photo', onPress: () => uploadBannerFromSource(true) },
      { text: 'Choose from gallery', onPress: () => uploadBannerFromSource(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Share shop
  const handleShareShop = async () => {
    try {
      const shopUrl = `https://bazaario.app/shop/${shopId}`;
      await Share.share({
        message: `Check out ${shopName} on Bazaario! ${shopUrl}`,
        title: shopName,
      });
    } catch (error) {
      console.warn('Share failed', error);
    }
  };

  // Create / update promotion on backend
  const handleCreatePromotion = async () => {
    if (!shopId) {
      Alert.alert('Error', 'Shop not found');
      return;
    }

    if (!promoTitle || !promoDiscount) {
      Alert.alert('Error', 'Please enter promotion title and discount');
      return;
    }

    const discountNum = Number(promoDiscount);
    if (isNaN(discountNum) || discountNum <= 0) {
      Alert.alert('Error', 'Please enter a valid discount percentage');
      return;
    }

    try {
      setSaving(true);
      await apiPutAuth(`/shops/${shopId}`, {
        promotion: {
          title: promoTitle.trim(),
          discountPercent: discountNum,
          description: promoDescription.trim(),
          active: true,
        },
      });
      await refreshUser();
      Alert.alert('Success', `Promotion "${promoTitle}" created with ${discountNum}% off!`);
      setPromoModalVisible(false);
      setPromoTitle('');
      setPromoDiscount('');
      setPromoDescription('');
    } catch (error: any) {
      console.warn('[SellerDashboard] Failed to save promotion', error);
      Alert.alert('Error', error?.message || 'Failed to save promotion');
    } finally {
      setSaving(false);
    }
  };

  const uploadShopImageFromSource = async (useCamera: boolean) => {
    try {
      if (!shopId) {
        Alert.alert('Error', 'Shop not found. Please try again.');
        return;
      }

      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission required', 'We need camera access to take a shop photo.');
          return;
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission required', 'We need access to your photos to upload shop images.');
          return;
        }
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
          });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.uri) return;

      setUploading(true);

      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const res = await apiPost<{ url: string }>(`/shops/${shopId}/images`, {
        imageBase64: base64,
      });

      if (res?.url) {
        setShopImages((prev) => [res.url, ...prev]);
      }
    } catch (error) {
      console.error('[SellerDashboard] Failed to upload image', error);
      Alert.alert('Upload failed', 'There was a problem uploading your image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadShopImage = () => {
    Alert.alert('Shop image', 'Choose source', [
      { text: 'Take photo', onPress: () => uploadShopImageFromSource(true) },
      { text: 'Choose from gallery', onPress: () => uploadShopImageFromSource(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleDeleteShopImage = async (url: string) => {
    if (!shopId) return;
    Alert.alert(
      'Remove image',
      'Remove this image from your shop?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setDeletingImageUrl(url);
            try {
              await apiDeleteAuth(`/shops/${shopId}/images`, { imageUrl: url });
              setShopImages((prev) => prev.filter((u) => u !== url));
              await refreshUser();
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to remove image.');
            } finally {
              setDeletingImageUrl(null);
            }
          },
        },
      ]
    );
  };

  // Handle reel upload from camera
  const handleRecordReel = async () => {
    if (!shopId) {
      Alert.alert('Error', 'Shop not found. Please try again.');
      return;
    }

    try {
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraPermission.granted) {
        Alert.alert('Permission required', 'We need access to your camera to record reels.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60, // 60 seconds max
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      await uploadReelVideo(result.assets[0].uri);
    } catch (error) {
      console.error('[SellerDashboard] Failed to record reel', error);
      Alert.alert('Error', 'Failed to record reel. Please try again.');
    }
  };

  // Handle reel upload from library
  const handleUploadReelFromLibrary = async () => {
    if (!shopId) {
      Alert.alert('Error', 'Shop not found. Please try again.');
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'We need access to your videos to upload reels.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60, // 60 seconds max
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      await uploadReelVideo(result.assets[0].uri);
    } catch (error) {
      console.error('[SellerDashboard] Failed to upload reel', error);
      Alert.alert('Error', 'Failed to upload reel. Please try again.');
    }
  };

  // Upload reel video to server
  const uploadReelVideo = async (videoUri: string) => {
    if (!shopId) return;

    setReelUploading(true);
    setReelModalVisible(false);

    try {
      // Read video as base64
      // Note: For large videos, consider using direct upload to Cloudinary instead
      const base64 = await FileSystem.readAsStringAsync(videoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Upload to server
      const res = await apiPostAuth<{ reel: { videoUrl: string } }>(`/shops/${shopId}/reels`, {
        videoBase64: base64,
      });

      if (res?.reel) {
        Alert.alert('Success', 'Reel uploaded successfully!');
        await refreshUser();
      }
    } catch (error) {
      console.error('[SellerDashboard] Failed to upload reel', error);
      Alert.alert('Upload failed', 'There was a problem uploading your reel. Please try again.');
    } finally {
      setReelUploading(false);
    }
  };


  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: 100 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Top Header: Shop name, Status badge, Bell */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.shopName} numberOfLines={1}>{shopName}</Text>
          <View style={[styles.badge, isOpen ? styles.badgeOpen : styles.badgeClosed]}>
            <Text style={styles.badgeText}>{isOpen ? 'Open' : 'Closed'}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{isOpen ? 'Open' : 'Closed'}</Text>
            <Switch
              value={isOpen}
              onValueChange={handleToggleOpen}
              trackColor={{ false: colors.border, true: colors.secondary }}
              thumbColor={isOpen ? colors.primary : colors.mutedForeground}
            />
          </View>
          {onOpenConversations && (
            <Pressable onPress={onOpenConversations} style={styles.headerIconBtn} hitSlop={8}>
              <Ionicons name="chatbubbles-outline" size={22} color={colors.foreground} />
              {totalUnread > 0 && (
                <View style={styles.messageBadge}>
                  <Text style={styles.messageBadgeText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
                </View>
              )}
            </Pressable>
          )}
          <Pressable 
            onPress={() => {
              if (onOpenAvailabilityRequests) {
                onOpenAvailabilityRequests();
              } else {
                loadNotifications();
                refreshUnreadCount();
                setNotifOpen(true);
              }
            }} 
            style={styles.bell} 
            hitSlop={8}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.foreground} />
            {(pendingCount > 0 || notificationUnreadCount > 0) && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {pendingCount + notificationUnreadCount > 9 ? '9+' : pendingCount + notificationUnreadCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Shop Banner Section */}
      <Pressable 
        style={[styles.bannerSection, SHADOW]} 
        onPress={() => setBannerModalVisible(true)}
      >
        {(currentBanner || (shop as any)?.banner) ? (
          <Image 
            source={{ uri: currentBanner || (shop as any)?.banner }} 
            style={styles.dashboardBanner} 
            resizeMode="cover"
          />
        ) : (
          <View style={styles.dashboardBannerPlaceholder}>
            <Ionicons name="image-outline" size={32} color={colors.mutedForeground} />
            <Text style={styles.dashboardBannerText}>Tap to add a shop banner</Text>
          </View>
        )}
        <View style={styles.bannerEditBadge}>
          <Ionicons name="pencil" size={14} color={colors.card} />
        </View>
      </Pressable>

      {/* Earnings: This week / Month */}
      <View style={styles.earningsRow}>
        <View style={[styles.earnCard, SHADOW]}>
          <Text style={styles.earnLabel}>Delivered Orders</Text>
          <Text style={styles.earnValue}>{orderStats?.delivered || 0}</Text>
        </View>
        <View style={[styles.earnCard, SHADOW]}>
          <Text style={styles.earnLabel}>Total Revenue</Text>
          <Text style={styles.earnValue}>₹{(orderStats?.totalRevenue || 0).toLocaleString('en-IN')}</Text>
        </View>
      </View>

      {/* 2. Upcoming Calls & Schedule */}
      <Text style={styles.sectionTitle}>Upcoming Calls & Schedule</Text>
      <View style={[styles.card, SHADOW]}>
        <View style={styles.callRow}>
          <View style={styles.callIconWrap}>
            <Ionicons name="calendar-outline" size={22} color={colors.mutedForeground} />
          </View>
          <View style={styles.callBody}>
            <Text style={styles.callType}>No scheduled calls</Text>
            <Text style={styles.callWith}>Schedule calls with customers from the Calls tab</Text>
          </View>
        </View>
      </View>

      {/* 3. Orders, Sales & Analytics */}
      <Text style={styles.sectionTitle}>Orders, Sales & Analytics</Text>
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, SHADOW]}>
          <Text style={styles.statLabel}>Orders placed</Text>
          <Text style={styles.statValue}>{(orderStats?.pending || 0) + (orderStats?.confirmed || 0)}</Text>
        </View>
        <View style={[styles.statCard, SHADOW]}>
          <Text style={styles.statLabel}>Ready for dispatch</Text>
          <Text style={styles.statValue}>{orderStats?.preparing || 0}</Text>
        </View>
        <View style={[styles.statCard, SHADOW]}>
          <Text style={styles.statLabel}>Dispatched</Text>
          <Text style={styles.statValue}>{orderStats?.ready || 0}</Text>
        </View>
        <View style={[styles.statCard, SHADOW]}>
          <Text style={styles.statLabel}>Delivered</Text>
          <Text style={styles.statValue}>{orderStats?.delivered || 0}</Text>
        </View>
      </View>

      {/* 4. Edit Your Shop Profile */}
      <Text style={styles.sectionTitle}>Edit Your Shop Profile</Text>
      <View style={styles.quickGrid}>
        <Pressable
          style={({ pressed }) => [styles.quickCard, SHADOW, pressed && styles.pressed]}
          onPress={() => openEditModal('name')}
        >
          <Ionicons name="create-outline" size={22} color={colors.primary} />
          <Text style={styles.quickLabel}>Edit shop name</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.quickCard, SHADOW, pressed && styles.pressed]}
          onPress={() => openEditModal('description')}
        >
          <Ionicons name="document-text-outline" size={22} color={colors.primary} />
          <Text style={styles.quickLabel}>Update description</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.quickCard, SHADOW, pressed && styles.pressed]}
          onPress={() => openEditModal('categories')}
        >
          <Ionicons name="pricetags-outline" size={22} color={colors.primary} />
          <Text style={styles.quickLabel}>Manage categories</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.quickCard, SHADOW, pressed && styles.pressed]}
          onPress={() => openEditModal('returnDays')}
        >
          <Ionicons name="arrow-undo-outline" size={22} color={colors.primary} />
          <Text style={styles.quickLabel}>Return (days)</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.quickCard, SHADOW, pressed && styles.pressed]}
          onPress={() => openEditModal('exchangeDays')}
        >
          <Ionicons name="repeat-outline" size={22} color={colors.primary} />
          <Text style={styles.quickLabel}>Exchange (days)</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.quickCard, SHADOW, pressed && styles.pressed]}
          onPress={handleUploadShopImage}
        >
          <Ionicons name="images-outline" size={22} color={colors.primary} />
          <Text style={styles.quickLabel}>Upload shop images</Text>
        </Pressable>
      </View>

      {/* Shop images gallery */}
      <Text style={styles.sectionTitle}>Shop Images</Text>
      <View style={[styles.card, SHADOW]}>
        {uploading && (
          <View style={styles.uploadRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.uploadText}>Uploading image...</Text>
          </View>
        )}
        {shopImages.length === 0 && !uploading && (
          <Text style={styles.emptyImagesText}>No images uploaded yet.</Text>
        )}
        {shopImages.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
            {shopImages.map((url) => (
              <View key={url} style={styles.shopImageWrap}>
                <Image source={{ uri: url }} style={styles.shopImage} />
                <Pressable
                  onPress={() => handleDeleteShopImage(url)}
                  disabled={deletingImageUrl === url}
                  style={({ pressed }) => [styles.shopImageDeleteBtn, pressed && styles.pressed]}
                >
                  {deletingImageUrl === url ? (
                    <ActivityIndicator size="small" color={colors.card} />
                  ) : (
                    <Ionicons name="trash" size={18} color={colors.card} />
                  )}
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* 5. Call Availability & Timings */}
      <Text style={styles.sectionTitle}>Call Timings</Text>
      <View style={[styles.card, SHADOW]}>
        <View style={[styles.timingRow, styles.timingRowBorder]}>
          <Text style={styles.timingLabel}>Video call availability</Text>
          <Switch
            value={videoOn}
            onValueChange={handleToggleVideo}
            trackColor={{ false: colors.border, true: colors.secondary }}
            thumbColor={videoOn ? colors.primary : colors.mutedForeground}
          />
        </View>
        <View style={styles.timingRow}>
          <Text style={styles.timingLabel}>Instant calls</Text>
          <Switch
            value={instantCallsOn}
            onValueChange={handleToggleInstantCalls}
            trackColor={{ false: colors.border, true: colors.secondary }}
            thumbColor={instantCallsOn ? colors.primary : colors.mutedForeground}
          />
        </View>
        <View style={styles.timingSummary}>
          <Ionicons name="time-outline" size={16} color={colors.mutedForeground} />
          <Text style={styles.timingSummaryText}>
            {timingDays.length === 7
              ? 'Every day'
              : timingDays.length === 0
              ? 'No days selected'
              : timingDays.join(', ')}
            {' · '}
            {timingStart} – {timingEnd}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.timingCta, pressed && styles.pressed]}
          onPress={() => setTimingModalVisible(true)}
        >
          <Text style={styles.timingCtaLabel}>Set days & time slots</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* 6. Reviews & Ratings */}
      <Text style={styles.sectionTitle}>Reviews & Ratings</Text>
      <View style={[styles.card, SHADOW]}>
        <View style={styles.reviewTop}>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingNum}>{(shop?.ratingAverage || 0).toFixed(1)}</Text>
            <Ionicons name="star" size={16} color={ACCENT_YELLOW} />
          </View>
          <Text style={styles.reviewCount}>{shop?.reviewCount || 0} reviews</Text>
        </View>
        <Text style={styles.reviewRecent} numberOfLines={2}>
          {shop?.reviewCount
            ? 'See what customers are saying about your shop.'
            : 'No reviews yet. Once customers review you, they will appear here.'}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.viewAll, pressed && styles.pressed]}
          onPress={onOpenReviews}
        >
          <Text style={styles.viewAllLabel}>View All Reviews</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </Pressable>
      </View>

      {/* 7. Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        <Pressable 
          style={({ pressed }) => [styles.actionCard, SHADOW, pressed && styles.pressed]}
          onPress={() => setReelModalVisible(true)}
        >
          <Ionicons name="videocam-outline" size={24} color={colors.primary} />
          <Text style={styles.actionLabel}>Upload reel</Text>
        </Pressable>
        <Pressable 
          style={({ pressed }) => [styles.actionCard, SHADOW, pressed && styles.pressed]}
          onPress={() => {
            if (onOpenReelInsights) {
              onOpenReelInsights();
            }
          }}
        >
          <Ionicons name="analytics-outline" size={24} color={colors.primary} />
          <Text style={styles.actionLabel}>View reel insights</Text>
        </Pressable>
        <Pressable 
          style={({ pressed }) => [styles.actionCard, SHADOW, pressed && styles.pressed]}
          onPress={() => setBannerModalVisible(true)}
        >
          <Ionicons name="megaphone-outline" size={24} color={colors.primary} />
          <Text style={styles.actionLabel}>Add banner</Text>
        </Pressable>
        <Pressable 
          style={({ pressed }) => [styles.actionCard, SHADOW, pressed && styles.pressed]}
          onPress={() => setPromoModalVisible(true)}
        >
          <Ionicons name="pricetag-outline" size={24} color={colors.primary} />
          <Text style={styles.actionLabel}>Promotions</Text>
        </Pressable>
        <Pressable 
          style={({ pressed }) => [styles.actionCard, SHADOW, pressed && styles.pressed]}
          onPress={handleShareShop}
        >
          <Ionicons name="share-social-outline" size={24} color={colors.primary} />
          <Text style={styles.actionLabel}>Share shop</Text>
        </Pressable>
        <Pressable 
          style={({ pressed }) => [styles.actionCard, SHADOW, pressed && styles.pressed]}
          onPress={() => setPreviewModalVisible(true)}
        >
          <Ionicons name="eye-outline" size={24} color={colors.primary} />
          <Text style={styles.actionLabel}>Preview shop</Text>
        </Pressable>
      </View>

      {/* Notifications modal */}
      <Modal visible={notifOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setNotifOpen(false)}>
          <Pressable style={styles.notifModal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.notifModalHeader}>
              <Text style={styles.notifModalTitle}>Notifications</Text>
              {notifications.length > 0 && (
                <Pressable onPress={() => { markAllAsRead(); refreshUnreadCount(); }} hitSlop={8}>
                  <Text style={styles.notifMarkAll}>Mark all read</Text>
                </Pressable>
              )}
            </View>
            {notifications.length === 0 ? (
              <Text style={styles.notifEmpty}>No notifications yet</Text>
            ) : (
              <ScrollView style={styles.notifScroll}>
                {notifications.slice(0, 30).map((n) => (
                  <Pressable
                    key={n._id}
                    onPress={() => { markAsRead(n._id); refreshUnreadCount(); }}
                    style={[styles.notifRow, !n.isRead && styles.notifRowUnread]}
                  >
                    <Text style={styles.notifRowTitle}>{n.title}</Text>
                    <Text style={styles.notifRowText} numberOfLines={2}>{n.message}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Call timings modal */}
      <Modal
        visible={timingModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTimingModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.editModalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setTimingModalVisible(false)} />
            <View style={styles.editModalContent}>
              <View style={styles.editModalHeader}>
                <Text style={styles.editModalTitle}>Call days & time slots</Text>
                <Pressable onPress={() => setTimingModalVisible(false)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.foreground} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.editModalScrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.editHint}>Select days when you accept customer calls.</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  {WEEK_DAYS.map((d) => {
                    const active = timingDays.includes(d.id);
                    return (
                      <Pressable
                        key={d.id}
                        onPress={() => toggleDay(d.id)}
                        style={[
                          {
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: radius.xxl,
                            borderWidth: 1,
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? colors.secondary : colors.card,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '600',
                            color: active ? colors.primary : colors.foreground,
                          }}
                        >
                          {d.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.editHint, { marginTop: 20 }]}>
                  Set the daily time window when you accept video / instant calls.
                </Text>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Start time (HH:MM)</Text>
                    <TextInput
                      style={styles.editInput}
                      value={timingStart}
                      onChangeText={setTimingStart}
                      placeholder="10:00"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>End time (HH:MM)</Text>
                    <TextInput
                      style={styles.editInput}
                      value={timingEnd}
                      onChangeText={setTimingEnd}
                      placeholder="20:00"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.editSaveBtn,
                    pressed && { opacity: 0.9 },
                    savingTimings && { opacity: 0.6 },
                  ]}
                  onPress={handleSaveTimings}
                  disabled={savingTimings}
                >
                  {savingTimings ? (
                    <ActivityIndicator color={colors.card} />
                  ) : (
                    <Text style={styles.editSaveBtnText}>Save timings</Text>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Shop Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.editModalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditModalVisible(false)} />
            <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>
                {editField === 'name' ? 'Edit Shop Name' :
                 editField === 'description' ? 'Edit Description' :
                 editField === 'categories' ? 'Edit Categories' :
                 editField === 'returnDays' ? 'Return (days)' :
                 'Exchange (days)'}
              </Text>
              <Pressable onPress={() => setEditModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.editModalScrollContent}>
              <TextInput
                style={[styles.editInput, editField === 'description' && styles.editInputMultiline]}
                value={editValue}
                onChangeText={setEditValue}
                placeholder={
                  editField === 'name' ? 'Enter shop name' :
                  editField === 'description' ? 'Enter description' :
                  editField === 'categories' ? 'Enter categories (comma separated)' :
                  editField === 'returnDays' ? 'e.g. 10' :
                  'e.g. 7'
                }
                placeholderTextColor={colors.mutedForeground}
                multiline={editField === 'description'}
                numberOfLines={editField === 'description' ? 4 : 1}
                keyboardType={editField === 'returnDays' || editField === 'exchangeDays' ? 'number-pad' : 'default'}
              />
              {editField === 'categories' && (
                <Text style={styles.editHint}>Separate categories with commas (e.g., Clothing, Accessories, Footwear)</Text>
              )}
              {(editField === 'returnDays' || editField === 'exchangeDays') && (
                <Text style={styles.editHint}>Shown on your shop as &quot;X days Return&quot; / &quot;X days Exchange&quot;</Text>
              )}
              <Pressable
                style={({ pressed }) => [styles.editSaveBtn, pressed && styles.pressed, saving && styles.editSaveBtnDisabled]}
                onPress={handleSaveEdit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.card} />
                ) : (
                  <Text style={styles.editSaveBtnText}>Save Changes</Text>
                )}
              </Pressable>
            </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Banner Modal */}
      <Modal visible={bannerModalVisible} transparent animationType="slide">
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Shop Banner</Text>
              <Pressable onPress={() => setBannerModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>
            
            {currentBanner || (shop as any)?.banner ? (
              <View style={styles.bannerPreview}>
                <Image 
                  source={{ uri: currentBanner || (shop as any)?.banner }} 
                  style={styles.bannerImage} 
                  resizeMode="cover"
                />
              </View>
            ) : (
              <View style={styles.bannerPlaceholder}>
                <Ionicons name="image-outline" size={48} color={colors.mutedForeground} />
                <Text style={styles.bannerPlaceholderText}>No banner uploaded</Text>
              </View>
            )}
            
            <Pressable
              style={({ pressed }) => [styles.editSaveBtn, pressed && styles.pressed, bannerUploading && styles.editSaveBtnDisabled]}
              onPress={handleUploadBanner}
              disabled={bannerUploading}
            >
              {bannerUploading ? (
                <ActivityIndicator size="small" color={colors.card} />
              ) : (
                <Text style={styles.editSaveBtnText}>
                  {currentBanner || (shop as any)?.banner ? 'Change Banner' : 'Upload Banner'}
                </Text>
              )}
            </Pressable>
            <Text style={styles.editHint}>Recommended: 16:9 aspect ratio (e.g., 1920x1080)</Text>
          </View>
        </View>
      </Modal>

      {/* Promotions Modal */}
      <Modal visible={promoModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.editModalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setPromoModalVisible(false)} />
            <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Create Promotion</Text>
              <Pressable onPress={() => setPromoModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.editModalScrollContent}>
              <Text style={styles.promoLabel}>Promotion Title</Text>
              <TextInput
                style={styles.editInput}
                value={promoTitle}
                onChangeText={setPromoTitle}
                placeholder="e.g., Weekend Sale"
                placeholderTextColor={colors.mutedForeground}
              />
              <Text style={styles.promoLabel}>Discount Percentage</Text>
              <TextInput
                style={styles.editInput}
                value={promoDiscount}
                onChangeText={setPromoDiscount}
                placeholder="e.g., 20"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
              />
              <Text style={styles.promoLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.editInput, styles.editInputMultiline]}
                value={promoDescription}
                onChangeText={setPromoDescription}
                placeholder="Describe your promotion..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
              />
              <Pressable
                style={({ pressed }) => [styles.editSaveBtn, pressed && styles.pressed]}
                onPress={handleCreatePromotion}
              >
                <Text style={styles.editSaveBtnText}>Create Promotion</Text>
              </Pressable>
            </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Upload Reel Modal */}
      <Modal visible={reelModalVisible} transparent animationType="slide">
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Upload Reel</Text>
              <Pressable onPress={() => setReelModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>
            
            <Text style={styles.editHint}>Choose how you want to create your reel</Text>
            
            <Pressable
              style={({ pressed }) => [styles.reelOptionButton, pressed && styles.pressed, reelUploading && styles.editSaveBtnDisabled]}
              onPress={handleRecordReel}
              disabled={reelUploading}
            >
              <Ionicons name="videocam" size={24} color={colors.card} />
              <Text style={styles.reelOptionText}>Record from Camera</Text>
            </Pressable>
            
            <Pressable
              style={({ pressed }) => [styles.reelOptionButton, styles.reelOptionButtonSecondary, pressed && styles.pressed, reelUploading && styles.editSaveBtnDisabled]}
              onPress={handleUploadReelFromLibrary}
              disabled={reelUploading}
            >
              <Ionicons name="folder-outline" size={24} color={colors.primary} />
              <Text style={[styles.reelOptionText, styles.reelOptionTextSecondary]}>Upload from Library</Text>
            </Pressable>

            {reelUploading && (
              <View style={styles.uploadRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.uploadText}>Uploading reel...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Preview Shop Modal */}
      <Modal visible={previewModalVisible} transparent animationType="slide">
        <View style={styles.previewModalOverlay}>
          <View style={styles.previewModalContent}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Shop Preview</Text>
              <Pressable onPress={() => setPreviewModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>
            
            <ScrollView style={styles.previewScroll} showsVerticalScrollIndicator={false}>
              {/* Banner */}
              {((shop as any)?.banner || currentBanner) ? (
                <Image 
                  source={{ uri: currentBanner || (shop as any)?.banner }} 
                  style={styles.previewBanner} 
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.previewBannerPlaceholder}>
                  <Ionicons name="storefront-outline" size={40} color={colors.mutedForeground} />
                </View>
              )}
              
              {/* Shop Info */}
              <View style={styles.previewInfo}>
                <Text style={styles.previewShopName}>{shopName}</Text>
                <View style={styles.previewRating}>
                  <Ionicons name="star" size={16} color={ACCENT_YELLOW} />
                  <Text style={styles.previewRatingText}>
                    {(shop?.ratingAverage || 0).toFixed(1)} ({shop?.reviewCount || 0} reviews)
                  </Text>
                </View>
                <Text style={styles.previewDescription}>
                  {shop?.description || 'No description available'}
                </Text>
                
                {/* Categories */}
                {shop?.categories && shop.categories.length > 0 && (
                  <View style={styles.previewCategories}>
                    {shop.categories.map((cat, i) => (
                      <View key={i} style={styles.previewCategoryTag}>
                        <Text style={styles.previewCategoryText}>{cat}</Text>
                      </View>
                    ))}
                  </View>
                )}
                
                {/* Status */}
                <View style={styles.previewStatus}>
                  <View style={[styles.previewStatusDot, { backgroundColor: isOpen ? colors.success : colors.destructive }]} />
                  <Text style={styles.previewStatusText}>
                    {isOpen ? 'Open for business' : 'Currently closed'}
                  </Text>
                </View>
              </View>
              
              {/* Shop Images */}
              {shopImages.length > 0 && (
                <View style={styles.previewImagesSection}>
                  <Text style={styles.previewSectionTitle}>Shop Images</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {shopImages.map((url, i) => (
                      <Image key={i} source={{ uri: url }} style={styles.previewShopImage} />
                    ))}
                  </ScrollView>
                </View>
              )}
            </ScrollView>
            
            <Text style={styles.previewNote}>This is how customers see your shop</Text>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: PAD, paddingBottom: 24 },
  pressed: { opacity: 0.9 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: GAP,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shopName: { fontSize: 20, fontWeight: '700', color: colors.foreground },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.xxl },
  badgeOpen: { backgroundColor: colors.success },
  badgeClosed: { backgroundColor: colors.mutedForeground },
  badgeText: { fontSize: 12, fontWeight: '600', color: colors.card },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleLabel: { fontSize: 12, color: colors.mutedForeground },
  headerIconBtn: { position: 'relative' as const, padding: 4 },
  messageBadge: {
    position: 'absolute' as const,
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.card,
  },
  messageBadgeText: { fontSize: 10, fontWeight: '700', color: colors.card },
  bell: { position: 'relative' as const },
  bellDot: { position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.destructive },
  bellBadge: { 
    position: 'absolute' as const, 
    top: -4, 
    right: -4, 
    minWidth: 18, 
    height: 18, 
    borderRadius: 9, 
    backgroundColor: colors.destructive,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 4,
  },
  bellBadgeText: { color: colors.card, fontSize: 10, fontWeight: '700' as const },

  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.secondary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    marginBottom: SECTION_GAP,
  },
  pendingText: { fontSize: 13, color: colors.foreground, flex: 1 },

  earningsRow: { flexDirection: 'row', gap: GAP, marginBottom: SECTION_GAP },
  earnCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: CARD_RADIUS,
    padding: 14,
  },
  earnLabel: { fontSize: 12, color: colors.mutedForeground, marginBottom: 4 },
  earnValue: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  trend: { fontSize: 12, marginTop: 4 },
  trendUp: { color: colors.success },
  trendDn: { color: colors.destructive },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground, marginBottom: GAP },
  card: { backgroundColor: colors.card, borderRadius: CARD_RADIUS, padding: PAD, marginBottom: GAP },
  cardHighlight: { borderLeftWidth: 4, borderLeftColor: colors.primary },
  callRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  callIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  callBody: { flex: 1 },
  callType: { fontSize: 15, fontWeight: '600', color: colors.foreground },
  callWith: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  ctaRow: { flexDirection: 'row', gap: 10 },
  ctaPrimary: { flex: 1, backgroundColor: colors.primary, paddingVertical: 10, borderRadius: radius.lg, alignItems: 'center' },
  ctaPrimaryLabel: { color: colors.card, fontSize: 14, fontWeight: '600' },
  ctaSecondary: { flex: 1, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, borderRadius: radius.lg, alignItems: 'center' },
  ctaSecondaryLabel: { color: colors.foreground, fontSize: 14, fontWeight: '600' },

  missedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SECTION_GAP },
  missedText: { fontSize: 13, color: colors.destructive, fontWeight: '500' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginBottom: GAP },
  statCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: CARD_RADIUS,
    padding: 14,
  },
  statLabel: { fontSize: 12, color: colors.mutedForeground, marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '700', color: colors.foreground },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginBottom: SECTION_GAP },
  quickCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: CARD_RADIUS,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickLabel: { fontSize: 13, fontWeight: '500', color: colors.foreground, flex: 1 },

  timingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  timingRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  timingLabel: { fontSize: 15, color: colors.foreground },
  timingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 4,
  },
  timingSummaryText: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  timingCta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  timingCtaLabel: { fontSize: 14, color: colors.mutedForeground },

  reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingNum: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  reviewCount: { fontSize: 13, color: colors.mutedForeground },
  reviewRecent: { fontSize: 14, color: colors.foreground, fontStyle: 'italic', marginBottom: 10 },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewAllLabel: { fontSize: 14, fontWeight: '600', color: colors.primary },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginBottom: SECTION_GAP },
  actionCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: CARD_RADIUS,
    padding: 16,
    alignItems: 'center',
  },
  actionLabel: { fontSize: 13, fontWeight: '600', color: colors.foreground, marginTop: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  notifModal: { width: '100%', maxWidth: 320, maxHeight: '70%', backgroundColor: colors.card, borderRadius: radius.xl, padding: 16 },
  notifModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  notifModalTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  notifMarkAll: { fontSize: 13, color: colors.primary, fontWeight: '500' },
  notifEmpty: { paddingVertical: 24, fontSize: 15, color: colors.mutedForeground, textAlign: 'center' },
  notifScroll: { maxHeight: 360 },
  notifRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  notifRowUnread: { backgroundColor: colors.secondary },
  notifRowTitle: { fontSize: 15, fontWeight: '600', color: colors.foreground },
  notifRowText: { fontSize: 14, color: colors.mutedForeground, marginTop: 4 },

  // Edit modal styles
  keyboardAvoid: { flex: 1 },
  editModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  editModalContent: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: PAD, paddingBottom: 32, maxHeight: '90%' },
  editModalScrollContent: { paddingBottom: 24 },
  editModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  editModalTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  editInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 16,
    color: colors.foreground,
  },
  editInputMultiline: { height: 120, textAlignVertical: 'top' },
  editHint: { fontSize: 12, color: colors.mutedForeground, marginTop: 8 },
  editSaveBtn: { backgroundColor: colors.primary, padding: 14, borderRadius: radius.lg, alignItems: 'center', marginTop: 16 },
  editSaveBtnDisabled: { opacity: 0.6 },
  editSaveBtnText: { color: colors.card, fontSize: 16, fontWeight: '600' },

  // Shop images
  imagesScroll: { marginHorizontal: -8 },
  shopImageWrap: { position: 'relative', marginHorizontal: 4 },
  shopImage: { width: 120, height: 80, borderRadius: radius.md },
  shopImageDeleteBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  uploadText: { fontSize: 14, color: colors.mutedForeground },
  emptyImagesText: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center', paddingVertical: 16 },

  // Banner styles
  bannerPreview: { marginBottom: 16 },
  bannerImage: { width: '100%', height: 160, borderRadius: radius.lg },
  bannerPlaceholder: { 
    width: '100%', 
    height: 160, 
    borderRadius: radius.lg, 
    backgroundColor: colors.muted, 
    alignItems: 'center', 
    justifyContent: 'center',
    marginBottom: 16,
  },
  bannerPlaceholderText: { fontSize: 14, color: colors.mutedForeground, marginTop: 8 },

  // Dashboard banner section
  bannerSection: {
    marginBottom: SECTION_GAP,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    position: 'relative',
  },
  dashboardBanner: {
    width: '100%',
    height: 140,
    borderRadius: CARD_RADIUS,
  },
  dashboardBannerPlaceholder: {
    width: '100%',
    height: 100,
    backgroundColor: colors.muted,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashboardBannerText: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 6,
  },
  bannerEditBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Promotion styles
  promoLabel: { fontSize: 14, fontWeight: '600', color: colors.foreground, marginTop: 12, marginBottom: 6 },

  // Preview modal styles
  previewModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  previewModalContent: { flex: 1, backgroundColor: colors.card, marginTop: 60, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: PAD, borderBottomWidth: 1, borderBottomColor: colors.border },
  previewTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  previewScroll: { flex: 1 },
  previewBanner: { width: '100%', height: 180 },
  previewBannerPlaceholder: { width: '100%', height: 120, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  previewInfo: { padding: PAD },
  previewShopName: { fontSize: 22, fontWeight: '700', color: colors.foreground },
  previewRating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  previewRatingText: { fontSize: 14, color: colors.mutedForeground },
  previewDescription: { fontSize: 14, color: colors.foreground, marginTop: 12, lineHeight: 20 },
  previewCategories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  previewCategoryTag: { backgroundColor: colors.secondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.xxl },
  previewCategoryText: { fontSize: 12, color: colors.foreground },
  previewStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  previewStatusDot: { width: 10, height: 10, borderRadius: 5 },
  previewStatusText: { fontSize: 14, color: colors.foreground },
  previewImagesSection: { padding: PAD, paddingTop: 0 },
  previewSectionTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground, marginBottom: 12 },
  previewShopImage: { width: 150, height: 100, borderRadius: radius.md, marginRight: 10 },
  previewNote: { fontSize: 12, color: colors.mutedForeground, textAlign: 'center', padding: PAD, fontStyle: 'italic' },

  // Reel upload styles
  reelOptionButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  reelOptionButtonSecondary: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reelOptionText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '600',
  },
  reelOptionTextSecondary: {
    color: colors.primary,
  },
});
