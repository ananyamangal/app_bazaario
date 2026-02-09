
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  StyleSheet,
  View,
} from 'react-native';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const BACKGROUND_COLOR = '#FFFFFF';

// Tailwind max-w-lg equivalent (~512px)
const LOGO_MAX_WIDTH = 300;
const LOGO_HEIGHT = 300;

const ANIMATION_DURATION_MS = 300;
const INITIAL_TRANSLATE_Y = 20;
const STAY_DURATION_MS = 3000;

const EASE_OUT = Easing.bezier(0, 0, 0.2, 1);

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type SplashScreenProps = {
  onFinish?: () => void;
};

// -----------------------------------------------------------------------------
// Assets
// -----------------------------------------------------------------------------

// Make sure this file exists:
// myapp/assets/splashlogo.png
const splashLogo: ImageSourcePropType = require('../../assets/splashlogo.png');

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(INITIAL_TRANSLATE_Y)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: ANIMATION_DURATION_MS,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: ANIMATION_DURATION_MS,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
    ]).start();

    timeoutRef.current = setTimeout(() => {
      onFinish?.();
    }, STAY_DURATION_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [opacity, translateY, onFinish]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Image
          source={splashLogo}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    maxWidth: LOGO_MAX_WIDTH,
    height: LOGO_HEIGHT,
  },
});