import React from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '../components/ScreenHeader';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

// Display number (what user sees)
const SUPPORT_PHONE = '8700825181';
// E.164-style with country code for links (WhatsApp requires this, without '+')
const SUPPORT_PHONE_E164 = '918700825181';

type Props = {
  onBack: () => void;
};

export default function SupportScreen({ onBack }: Props) {
  const handleCall = () => {
    // Prepend country code for better compatibility with dialers
    Linking.openURL(`tel:+${SUPPORT_PHONE_E164}`);
  };

  const handleWhatsApp = () => {
    // WhatsApp requires full international number without '+' in the URL
    Linking.openURL(`https://wa.me/${SUPPORT_PHONE_E164}`);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader onBack={onBack} title="Help & Support" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>We're here to help</Text>
          <Text style={styles.heroSub}>
            Questions about your order, video calls, or account? Reach out anytime.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Contact us</Text>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.contactRow, pressed && styles.rowPressed]}
            onPress={handleCall}
          >
            <View style={styles.contactIconWrap}>
              <Ionicons name="call" size={22} color={colors.card} />
            </View>
            <View style={styles.contactTextWrap}>
              <Text style={styles.contactTitle}>Call support</Text>
              <Text style={styles.contactSub}>{SUPPORT_PHONE}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={({ pressed }) => [styles.contactRow, pressed && styles.rowPressed]}
            onPress={handleWhatsApp}
          >
            <View style={[styles.contactIconWrap, styles.whatsappIcon]}>
              <Ionicons name="logo-whatsapp" size={22} color={colors.card} />
            </View>
            <View style={styles.contactTextWrap}>
              <Text style={styles.contactTitle}>Chat on WhatsApp</Text>
              <Text style={styles.contactSub}>Quick replies for orders & general queries</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Common topics</Text>
        <View style={styles.card}>
          <View style={styles.topicRow}>
            <Ionicons name="cube-outline" size={18} color={colors.primary} />
            <Text style={styles.topicText}>Order status & delivery</Text>
          </View>
          <View style={styles.topicRow}>
            <Ionicons name="videocam-outline" size={18} color={colors.primary} />
            <Text style={styles.topicText}>Video call or chat issues</Text>
          </View>
          <View style={styles.topicRow}>
            <Ionicons name="card-outline" size={18} color={colors.primary} />
            <Text style={styles.topicText}>Payments & refunds</Text>
          </View>
          <View style={styles.topicRow}>
            <Ionicons name="person-outline" size={18} color={colors.primary} />
            <Text style={styles.topicText}>Account & login</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 32 },
  hero: {
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 14,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  contactIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  whatsappIcon: { backgroundColor: '#25D366' },
  contactTextWrap: { flex: 1 },
  contactTitle: { fontSize: 15, fontWeight: '600', color: colors.foreground },
  contactSub: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  rowPressed: { opacity: 0.85 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 52 },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  topicText: { fontSize: 14, color: colors.foreground, flex: 1 },
});
