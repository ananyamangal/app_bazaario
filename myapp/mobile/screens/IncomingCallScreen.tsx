import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  Vibration,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { useCall } from '../context/CallContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Props = {
  onAccept: () => void;
  onDecline: () => void;
};

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export default function IncomingCallScreen({ onAccept, onDecline }: Props) {
  const insets = useSafeAreaInsets();
  const { currentCall, acceptCall, declineCall } = useCall();

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation for avatar
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [pulseAnim]);

  // Slide up animation
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 1,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  // Vibration pattern
  useEffect(() => {
    const pattern = Platform.OS === 'android'
      ? [0, 500, 200, 500]
      : [0, 500];

    const interval = setInterval(() => {
      Vibration.vibrate(pattern);
    }, 2000);

    // Initial vibration
    Vibration.vibrate(pattern);

    return () => {
      clearInterval(interval);
      Vibration.cancel();
    };
  }, []);

  const handleAccept = async () => {
    Vibration.cancel();
    await acceptCall();
    onAccept();
  };

  const handleDecline = async () => {
    Vibration.cancel();
    await declineCall();
    onDecline();
  };

  const callerName = currentCall?.customerName || 'Customer';
  const shopName = currentCall?.shopName;

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460']}
      style={styles.container}
    >
      {/* Top Section */}
      <View style={[styles.topSection, { paddingTop: insets.top + spacing.xl }]}>
        <Text style={styles.incomingLabel}>Incoming Video Call</Text>
        
        {/* Avatar with pulse */}
        <Animated.View
          style={[
            styles.avatarContainer,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <View style={styles.avatar}>
            <Ionicons name="person" size={60} color="rgba(255,255,255,0.8)" />
          </View>
          <View style={styles.avatarRing} />
          <View style={styles.avatarRingOuter} />
        </Animated.View>

        <Text style={styles.callerName}>{callerName}</Text>
        {shopName && (
          <Text style={styles.shopName}>calling {shopName}</Text>
        )}
      </View>

      {/* Bottom Section - Buttons */}
      <Animated.View
        style={[
          styles.bottomSection,
          {
            paddingBottom: insets.bottom + spacing.xl,
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [100, 0],
                }),
              },
            ],
          },
        ]}
      >
        {/* Decline Button */}
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleDecline}
        >
          <View style={[styles.buttonIcon, { backgroundColor: '#FF3B30' }]}>
            <Ionicons name="close" size={36} color={colors.card} />
          </View>
          <Text style={styles.buttonLabel}>Decline</Text>
        </Pressable>

        {/* Accept Button */}
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleAccept}
        >
          <View style={[styles.buttonIcon, { backgroundColor: '#34C759' }]}>
            <Ionicons name="videocam" size={32} color={colors.card} />
          </View>
          <Text style={styles.buttonLabel}>Accept</Text>
        </Pressable>
      </Animated.View>

      {/* Decorative elements */}
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />
    </LinearGradient>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topSection: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  incomingLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: spacing.xl,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  avatarRing: {
    position: 'absolute',
    top: -10,
    left: -10,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarRingOuter: {
    position: 'absolute',
    top: -20,
    left: -20,
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  callerName: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.card,
    marginBottom: spacing.xs,
  },
  shopName: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.xl * 2,
  },
  actionButton: {
    alignItems: 'center',
  },
  buttonIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonLabel: {
    fontSize: 14,
    color: colors.card,
    fontWeight: '500',
  },
  decorCircle1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -50,
    left: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
});
