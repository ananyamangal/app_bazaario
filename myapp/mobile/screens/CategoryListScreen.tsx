import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '../components/ScreenHeader';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { apiGet } from '../api/client';

// Same display order and icons as HomeScreen
const CATEGORY_DISPLAY: { name: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { name: 'Jewellery and accessories', icon: 'diamond-outline' },
  { name: 'Home decor', icon: 'home-outline' },
  { name: 'Home appliances', icon: 'desktop-outline' },
  { name: 'Electronics', icon: 'phone-portrait-outline' },
  { name: 'Kids and toys', icon: 'happy-outline' },
  { name: 'Bags', icon: 'bag-outline' },
  { name: 'Footwear', icon: 'walk-outline' },
  { name: 'Beauty and health', icon: 'sparkles-outline' },
  { name: 'Menswear', icon: 'shirt-outline' },
  { name: 'Traditional wear', icon: 'flower-outline' },
  { name: "Women's Western", icon: 'woman-outline' },
];

type ApiCategory = { _id: string; name: string };
type MergedCategory = { _id: string | null; name: string; icon: keyof typeof Ionicons.glyphMap };

type Props = {
  onBack: () => void;
  onSelectCategory: (categoryId: string | null, categoryLabel: string) => void;
};

export default function CategoryListScreen({ onBack, onSelectCategory }: Props) {
  // Show all 11 immediately; fill _id from API when name matches
  const [merged, setMerged] = useState<MergedCategory[]>(() =>
    CATEGORY_DISPLAY.map((d) => ({ name: d.name, icon: d.icon, _id: null }))
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiGet<ApiCategory[]>('/categories');
        if (cancelled) return;
        const normalized = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
        const result = CATEGORY_DISPLAY.map((d) => {
          const match = list.find((c) => normalized(c.name) === normalized(d.name));
          return { name: d.name, icon: d.icon, _id: match ? match._id : null };
        });
        setMerged(result);
      } catch {
        if (!cancelled) setMerged(CATEGORY_DISPLAY.map((d) => ({ name: d.name, icon: d.icon, _id: null })));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <View style={styles.container}>
      <ScreenHeader onBack={onBack} title="Categories" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {merged.map((c) => (
            <Pressable
              key={c.name}
              onPress={() => onSelectCategory(c._id, c.name)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={c.icon} size={32} color={colors.primary} />
              </View>
              <Text style={styles.label} numberOfLines={2}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 32 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-start',
  },
  card: {
    width: '30%',
    minWidth: 100,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: { opacity: 0.9 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  label: { fontSize: 12, fontWeight: '500', color: colors.foreground, textAlign: 'center' },
});
