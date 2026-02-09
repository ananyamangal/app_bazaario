import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/spacing';
import { apiGet, apiGetAuth, apiPostAuth, apiPutAuth, apiDeleteAuth } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const PAD = 16;
const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 };

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Product = {
  _id: string;
  name: string;
  description?: string;
  price: number;
  discountPrice?: number;
  images: string[];
  isAvailable: boolean;
  stock: number;
  categoryId?: string;
};

type Category = {
  _id: string;
  name: string;
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

type Props = { onOpenConversations?: () => void };

export default function SellerProductsScreen({ onOpenConversations }: Props = {}) {
  const insets = useSafeAreaInsets();
  const { shop, refreshUser, user } = useAuth();
  const { totalUnread } = useChat();
  const shopId = shop?._id;

  // Debug: Log shop data
  useEffect(() => {
    console.log('[SellerProducts] Shop:', shop);
    console.log('[SellerProducts] User:', user);
  }, [shop, user]);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDiscountPrice, setFormDiscountPrice] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formIsAvailable, setFormIsAvailable] = useState(true);
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formCategoryId, setFormCategoryId] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const fetchProducts = useCallback(async () => {
    if (!shopId) return;
    try {
      const data = await apiGetAuth<{ products: Product[] }>(`/shops/${shopId}/products`);
      setProducts(data.products || []);
    } catch (error) {
      console.warn('[SellerProducts] Failed to load products', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shopId]);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await apiGet<Category[]>('/categories');
      setCategories(data || []);
      // Set default category if available
      if (data && data.length > 0 && !formCategoryId) {
        setFormCategoryId(data[0]._id);
      }
    } catch (error) {
      console.warn('[SellerProducts] Failed to load categories', error);
    }
  }, [formCategoryId]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProducts();
  }, [fetchProducts]);

  function resetForm() {
    setFormName('');
    setFormDescription('');
    setFormPrice('');
    setFormDiscountPrice('');
    setFormStock('');
    setFormIsAvailable(true);
    setFormImages([]);
    setFormCategoryId(categories.length > 0 ? categories[0]._id : '');
    setEditingProduct(null);
  }

  function openAddModal() {
    resetForm();
    setModalVisible(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setFormName(product.name);
    setFormDescription(product.description || '');
    setFormPrice(product.price.toString());
    setFormDiscountPrice(
      typeof product.discountPrice === 'number' && !isNaN(product.discountPrice)
        ? product.discountPrice.toString()
        : ''
    );
    setFormStock(product.stock.toString());
    setFormIsAvailable(product.isAvailable);
    setFormImages(product.images || []);
    setFormCategoryId(product.categoryId || (categories.length > 0 ? categories[0]._id : ''));
    setModalVisible(true);
  }

  async function handlePickImage() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'We need access to your photos to upload product images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (!asset.uri) return;

      setUploadingImage(true);

      // Convert to base64 and upload to get URL
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // For now, use a placeholder approach - in production you'd upload to cloudinary
      // We'll store the local URI for display and upload when saving
      const dataUri = `data:image/jpeg;base64,${base64}`;
      setFormImages((prev) => [...prev, dataUri]);
    } catch (error) {
      console.error('[SellerProducts] Image pick error', error);
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      setUploadingImage(false);
    }
  }

  function handleRemoveImage(index: number) {
    setFormImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveProduct() {
    if (!shopId) {
      Alert.alert('Error', 'Shop not found');
      return;
    }

    if (!formName.trim()) {
      Alert.alert('Validation Error', 'Product name is required');
      return;
    }

    if (!formCategoryId) {
      Alert.alert('Validation Error', 'Please select a category');
      return;
    }

    const numericPrice = Number(formPrice);
    if (!formPrice.trim() || isNaN(numericPrice) || numericPrice <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid price greater than 0');
      return;
    }

    const numericDiscount =
      formDiscountPrice.trim() && !isNaN(Number(formDiscountPrice))
        ? Number(formDiscountPrice)
        : undefined;

    setSaving(true);

    try {
      // Upload any base64 images first
      const uploadedImageUrls: string[] = [];
      const existingUrls = formImages.filter((img) => !img.startsWith('data:'));
      const base64Images = formImages.filter((img) => img.startsWith('data:'));

      for (const base64Img of base64Images) {
        try {
          // Remove the data:image/jpeg;base64, prefix
          const base64Data = base64Img.replace(/^data:image\/\w+;base64,/, '');
          const response = await apiPostAuth<{ url: string }>('/products/upload-image', {
            imageBase64: base64Data,
          });
          if (response.url) {
            uploadedImageUrls.push(response.url);
          }
        } catch (uploadError) {
          console.warn('[SellerProducts] Failed to upload image', uploadError);
        }
      }

      const allImages = [...existingUrls, ...uploadedImageUrls];

      const productData = {
        name: formName.trim(),
        description: formDescription.trim(),
        price: numericPrice,
        discountPrice: numericDiscount,
        stock: Number(formStock) || 0,
        isAvailable: formIsAvailable,
        categoryId: formCategoryId,
        images: allImages,
      };

      if (editingProduct) {
        // Update existing product
        await apiPutAuth(`/products/${editingProduct._id}`, productData);
        Alert.alert('Success', 'Product updated successfully');
      } else {
        // Create new product
        await apiPostAuth(`/shops/${shopId}/products`, productData);
        Alert.alert('Success', 'Product added successfully');
      }

      setModalVisible(false);
      resetForm();
      fetchProducts();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProduct(product: Product) {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${product.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiDeleteAuth(`/products/${product._id}`);
              Alert.alert('Success', 'Product deleted');
              fetchProducts();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete product');
            }
          },
        },
      ]
    );
  }

  async function handleToggleAvailability(product: Product) {
    try {
      await apiPutAuth(`/products/${product._id}`, {
        isAvailable: !product.isAvailable,
      });
      fetchProducts();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update product');
    }
  }

  if (!shopId) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.emptyWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>Shop not found. Please complete your seller registration.</Text>
          <Pressable 
            onPress={refreshUser} 
            style={({ pressed }) => [styles.refreshBtn, pressed && styles.pressed]}
          >
            <Ionicons name="refresh" size={18} color={colors.card} />
            <Text style={styles.refreshBtnText}>Refresh Data</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Products</Text>
        <View style={styles.headerRight}>
          {onOpenConversations && (
            <Pressable onPress={onOpenConversations} style={styles.chatIconBtn} hitSlop={8}>
              <Ionicons name="chatbubbles-outline" size={22} color={colors.foreground} />
              {totalUnread > 0 && (
                <View style={styles.chatBadge}>
                  <Text style={styles.chatBadgeText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
                </View>
              )}
            </Pressable>
          )}
          <Pressable onPress={openAddModal} style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
            <Ionicons name="add" size={20} color={colors.card} />
            <Text style={styles.addBtnText}>Add Product</Text>
          </Pressable>
        </View>
      </View>

      {/* Product List */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : products.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="cube-outline" size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No products yet</Text>
            <Text style={styles.emptySubtext}>Tap "Add Product" to add your first product</Text>
          </View>
        ) : (
          products.map((product) => (
            <View key={product._id} style={[styles.productCard, SHADOW]}>
              <View style={styles.productRow}>
                {product.images && product.images.length > 0 ? (
                  <Image source={{ uri: product.images[0] }} style={styles.productImage} />
                ) : (
                  <View style={[styles.productImage, styles.productImagePlaceholder]}>
                    <Ionicons name="image-outline" size={24} color={colors.mutedForeground} />
                  </View>
                )}
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                  {product.description ? (
                    <Text style={styles.productDescription} numberOfLines={2}>{product.description}</Text>
                  ) : null}
                  <Text style={styles.stockText}>Stock: {product.stock}</Text>
                </View>
                <View style={styles.productActions}>
                  <Switch
                    value={product.isAvailable}
                    onValueChange={() => handleToggleAvailability(product)}
                    trackColor={{ false: colors.border, true: colors.secondary }}
                    thumbColor={product.isAvailable ? colors.primary : colors.mutedForeground}
                  />
                </View>
              </View>
              <View style={styles.cardFooter}>
                <Pressable onPress={() => openEditModal(product)} style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}>
                  <Ionicons name="create-outline" size={16} color={colors.primary} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => handleDeleteProduct(product)} style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}>
                  <Ionicons name="trash-outline" size={16} color={colors.destructive} />
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalKeyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingProduct ? 'Edit Product' : 'Add Product'}</Text>
                <Pressable onPress={() => setModalVisible(false)} hitSlop={8}>
                  <Ionicons name="close" size={24} color={colors.foreground} />
                </Pressable>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Product Name */}
              <Text style={styles.label}>Product Name *</Text>
              <TextInput
                style={styles.input}
                value={formName}
                onChangeText={setFormName}
                placeholder="Enter product name"
                placeholderTextColor={colors.mutedForeground}
              />

              {/* Description */}
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formDescription}
                onChangeText={setFormDescription}
                placeholder="Enter product description"
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
              />

              {/* Category */}
              <Text style={styles.label}>Category *</Text>
              <View style={styles.categoryGrid}>
                {categories.map((cat) => (
                  <Pressable
                    key={cat._id}
                    onPress={() => setFormCategoryId(cat._id)}
                    style={[
                      styles.categoryChip,
                      formCategoryId === cat._id && styles.categoryChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        formCategoryId === cat._id && styles.categoryChipTextActive,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Pricing */}
              <View style={styles.row}>
                <View style={styles.halfCol}>
                  <Text style={styles.label}>Price (₹) *</Text>
                  <TextInput
                    style={styles.input}
                    value={formPrice}
                    onChangeText={setFormPrice}
                    placeholder="0"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfCol}>
                  <Text style={styles.label}>Discounted Price (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={formDiscountPrice}
                    onChangeText={setFormDiscountPrice}
                    placeholder="Optional"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Stock */}
              <View style={styles.row}>
                <View style={styles.halfCol}>
                  <Text style={styles.label}>Stock Quantity</Text>
                  <TextInput
                    style={styles.input}
                    value={formStock}
                    onChangeText={setFormStock}
                    placeholder="0"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfCol}>
                  <Text style={styles.label}>Available for Sale</Text>
                  <View style={styles.switchRow}>
                    <Switch
                      value={formIsAvailable}
                      onValueChange={setFormIsAvailable}
                      trackColor={{ false: colors.border, true: colors.secondary }}
                      thumbColor={formIsAvailable ? colors.primary : colors.mutedForeground}
                    />
                    <Text style={styles.switchLabel}>{formIsAvailable ? 'Yes' : 'No'}</Text>
                  </View>
                </View>
              </View>

              {/* Images */}
              <Text style={styles.label}>Product Images</Text>
              <View style={styles.imagesRow}>
                {formImages.map((img, index) => (
                  <View key={index} style={styles.imageThumbWrap}>
                    <Image source={{ uri: img }} style={styles.imageThumb} />
                    <Pressable onPress={() => handleRemoveImage(index)} style={styles.removeImageBtn}>
                      <Ionicons name="close-circle" size={20} color={colors.destructive} />
                    </Pressable>
                  </View>
                ))}
                <Pressable onPress={handlePickImage} style={[styles.addImageBtn, uploadingImage && styles.addImageBtnDisabled]}>
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="add" size={24} color={colors.primary} />
                  )}
                </Pressable>
              </View>
            </ScrollView>

            {/* Save Button */}
            <Pressable
              onPress={handleSaveProduct}
              disabled={saving}
              style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed, saving && styles.saveBtnDisabled]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.card} />
              ) : (
                <Text style={styles.saveBtnText}>{editingProduct ? 'Update Product' : 'Add Product'}</Text>
              )}
            </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PAD,
    paddingVertical: 12,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.foreground },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chatIconBtn: { position: 'relative', padding: 4 },
  chatBadge: {
    position: 'absolute',
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
  chatBadgeText: { fontSize: 10, fontWeight: '700', color: colors.card },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.lg,
    gap: 4,
  },
  addBtnText: { color: colors.card, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.8 },

  scroll: { flex: 1 },
  scrollContent: { padding: PAD, paddingBottom: 100 },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100, paddingHorizontal: 32 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.foreground, marginTop: 12, textAlign: 'center' },
  emptySubtext: { fontSize: 14, color: colors.mutedForeground, marginTop: 4 },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.lg,
    marginTop: 20,
    gap: 8,
  },
  refreshBtnText: { color: colors.card, fontSize: 14, fontWeight: '600' },

  productCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: PAD,
    marginBottom: 12,
  },
  productRow: { flexDirection: 'row', alignItems: 'center' },
  productImage: { width: 64, height: 64, borderRadius: radius.md, marginRight: 12 },
  productImagePlaceholder: {
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: { flex: 1 },
  productName: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  productDescription: { fontSize: 13, color: colors.mutedForeground, marginTop: 2, lineHeight: 18 },
  stockText: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  productActions: { marginLeft: 8 },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnText: { fontSize: 14, color: colors.primary, fontWeight: '500' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deleteBtnText: { fontSize: 14, color: colors.destructive, fontWeight: '500' },

  // Modal
  modalKeyboardAvoid: { flex: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: PAD,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  modalScroll: { paddingHorizontal: PAD },

  label: { fontSize: 14, fontWeight: '600', color: colors.foreground, marginTop: 16, marginBottom: 8 },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 15,
    color: colors.foreground,
  },
  textArea: { height: 80, textAlignVertical: 'top' },

  row: { flexDirection: 'row', gap: 12 },
  halfCol: { flex: 1 },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  switchLabel: { fontSize: 14, color: colors.foreground },

  imagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  imageThumbWrap: { position: 'relative' },
  imageThumb: { width: 64, height: 64, borderRadius: radius.md },
  removeImageBtn: { position: 'absolute', top: -6, right: -6 },
  addImageBtn: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageBtnDisabled: { opacity: 0.5 },

  saveBtn: {
    backgroundColor: colors.primary,
    marginHorizontal: PAD,
    marginTop: 16,
    padding: 14,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.card, fontSize: 16, fontWeight: '600' },

  // Category picker
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    color: colors.foreground,
  },
  categoryChipTextActive: {
    color: colors.card,
    fontWeight: '600',
  },
});
