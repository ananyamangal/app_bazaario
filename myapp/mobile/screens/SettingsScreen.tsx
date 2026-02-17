import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '../components/ScreenHeader';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';
import { useAuth } from '../context/AuthContext';

type Props = {
  onBack: () => void;
  onOpenSupport?: () => void;
};

export default function SettingsScreen({ onBack, onOpenSupport }: Props) {
  const { user } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [marketingEnabled, setMarketingEnabled] = useState(false);

  function handleTogglePush(value: boolean) {
    setPushEnabled(value);
    // In future, persist to backend or AsyncStorage.
  }

  function handleToggleMarketing(value: boolean) {
    setMarketingEnabled(value);
  }

  function handleAbout() {
    Alert.alert('About Bazaario', 'Bazaario helps you shop from nearby markets with live video calls and instant chat.');
  }

  return (
    <View style={styles.container}>
      <ScreenHeader onBack={onBack} title="Settings" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Account section */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="person-circle-outline" size={22} color={colors.primary} />
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>Signed in as</Text>
                <Text style={styles.rowSub}>
                  {user?.name || 'Customer'} · {user?.phone || 'No phone'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Notifications */}
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="notifications-outline" size={20} color={colors.foreground} />
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>Push notifications</Text>
                <Text style={styles.rowSub}>Order updates, messages and offers</Text>
              </View>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={handleTogglePush}
              trackColor={{ false: colors.border, true: colors.secondary }}
              thumbColor={pushEnabled ? colors.primary : colors.mutedForeground}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="megaphone-outline" size={20} color={colors.foreground} />
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>Marketing updates</Text>
                <Text style={styles.rowSub}>Occasional deals and announcements</Text>
              </View>
            </View>
            <Switch
              value={marketingEnabled}
              onValueChange={handleToggleMarketing}
              trackColor={{ false: colors.border, true: colors.secondary }}
              thumbColor={marketingEnabled ? colors.primary : colors.mutedForeground}
            />
          </View>
        </View>

        {/* App info */}
        <Text style={styles.sectionLabel}>More</Text>
        <View style={styles.card}>
          {onOpenSupport ? (
            <>
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={onOpenSupport}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name="help-circle-outline" size={20} color={colors.foreground} />
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.rowTitle}>Help & Support</Text>
                    <Text style={styles.rowSub}>Contact us, FAQs</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
              </Pressable>
              <View style={styles.divider} />
            </>
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={handleAbout}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="information-circle-outline" size={20} color={colors.foreground} />
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>About Bazaario</Text>
                <Text style={styles.rowSub}>Version 1.0.0</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 16 },
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  rowSub: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  rowPressed: {
    opacity: 0.85,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
});

