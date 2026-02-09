import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import BackButton from '../../components/BackButton';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { apiGet } from '../../api/client';

type Props = {
  onBack: () => void;
  shopId?: string;
};

type ShopReview = {
  id: string;
  name: string;
  rating: number;
  text: string;
  date?: string;
};

export default function SellerReviewsScreen({ onBack, shopId }: Props) {
  const insets = useSafeAreaInsets();
  const [reviews, setReviews] = useState<ShopReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!shopId) {
        setError('No shop found for this seller.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await apiGet<{ reviews: ShopReview[] }>(`/shops/${shopId}/reviews`);
        setReviews(res.reviews || []);
        setError(null);
      } catch (e: any) {
        console.warn('[SellerReviews] Failed to load reviews', e);
        setError(e?.message || 'Failed to load reviews');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [shopId]);

  function renderItem({ item }: { item: ShopReview }) {
    const created = item.date ? new Date(item.date) : null;
    const dateLabel = created ? created.toLocaleDateString('en-IN') : '';

    return (
      <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <Text style={styles.reviewName}>{item.name || 'Customer'}</Text>
          {dateLabel ? <Text style={styles.reviewDate}>{dateLabel}</Text> : null}
        </View>
        <View style={styles.reviewRatingRow}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Ionicons
              key={i}
              name={i < item.rating ? 'star' : 'star-outline'}
              size={14}
              color="#FACC15"
            />
          ))}
          <Text style={styles.reviewRatingNum}>{item.rating.toFixed(1)}</Text>
        </View>
        {!!item.text && <Text style={styles.reviewText}>{item.text}</Text>}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <BackButton onPress={onBack} />
        <Text style={styles.headerTitle}>Shop Reviews</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.centerText}>Loading reviews…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.centerText}>{error}</Text>
        </View>
      ) : reviews.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>No reviews yet</Text>
          <Text style={styles.emptySubtitle}>
            Once customers start reviewing your shop, they will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  centerText: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  emptyTitle: {
    marginTop: spacing.md,
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  emptySubtitle: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  reviewDate: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  reviewRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 2,
  },
  reviewRatingNum: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  reviewText: {
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 20,
  },
});

