import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/spacing';

const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 };
const PAD = 16;

const PRIVACY_URL = 'https://bazaario-privacypolicy.vercel.app/';
const TERMS_URL = 'https://bazaario-privacypolicy.vercel.app/terms';

export default function SellerMoreScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 100 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>More</Text>
      <View style={[styles.card, SHADOW]}>
        <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed, styles.rowBorder]}>
          <Ionicons name="settings-outline" size={22} color={colors.primary} />
          <Text style={styles.rowLabel}>Settings</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        </Pressable>
        <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed, styles.rowBorder]}>
          <Ionicons name="help-circle-outline" size={22} color={colors.primary} />
          <Text style={styles.rowLabel}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed, styles.rowBorder]}
          onPress={() => Linking.openURL(PRIVACY_URL)}
        >
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
          <Text style={styles.rowLabel}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed, styles.rowBorder]}
          onPress={() => Linking.openURL(TERMS_URL)}
        >
          <Ionicons name="document-text-outline" size={22} color={colors.primary} />
          <Text style={styles.rowLabel}>Terms and Conditions</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        </Pressable>
        <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
          <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
          <Text style={styles.rowLabel}>About Bazaario</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: PAD },
  title: { fontSize: 22, fontWeight: '700', color: colors.foreground, marginBottom: 20 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: PAD, gap: 12, alignSelf: 'stretch', width: '100%' },
  rowPressed: { backgroundColor: colors.muted },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.foreground },
});
