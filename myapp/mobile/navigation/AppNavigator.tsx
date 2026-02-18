import { enableScreens } from 'react-native-screens';
enableScreens();

import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthScreen from '../screens/auth/AuthScreen';
import CustomerOtpVerifyScreen from '../screens/auth/CustomerOtpVerifyScreen';
import CustomerSignUpScreen from '../screens/auth/CustomerSignUpScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import OtpVerifyScreen from '../screens/auth/OtpVerifyScreen';
import PhoneVerifiedScreen from '../screens/auth/PhoneVerifiedScreen';
import RoleSelectScreen from '../screens/auth/RoleSelectScreen';
import SellerPhoneOtpScreen from '../screens/auth/SellerPhoneOtpScreen';
import SellerStep1Screen from '../screens/auth/SellerStep1Screen';
import SellerStep2Screen from '../screens/auth/SellerStep2Screen';
import SellerStep3Screen from '../screens/auth/SellerStep3Screen';
import GoogleRoleSelectScreen from '../screens/auth/GoogleRoleSelectScreen';
import CheckoutAddressScreen from '../screens/checkout/CheckoutAddressScreen';
import CheckoutInvoiceScreen from '../screens/checkout/CheckoutInvoiceScreen';
import CheckoutPaymentScreen from '../screens/checkout/CheckoutPaymentScreen';
import CheckoutPlaceOrderScreen from '../screens/checkout/CheckoutPlaceOrderScreen';
import CheckoutScheduleScreen from '../screens/checkout/CheckoutScheduleScreen';
import CheckoutSuccessScreen from '../screens/checkout/CheckoutSuccessScreen';
import SplashScreen from '../screens/SplashScreen';
import SellerTabNavigator from './SellerTabNavigator';
import TabNavigator from './TabNavigator';
import { CheckoutProvider } from '../context/CheckoutContext';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Auth stack - shown when user is NOT authenticated
function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}
    >
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
      <Stack.Screen name="GoogleRoleSelect" component={GoogleRoleSelectScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
      <Stack.Screen name="PhoneVerified" component={PhoneVerifiedScreen} />
      <Stack.Screen name="CustomerSignUp" component={CustomerSignUpScreen} />
      <Stack.Screen name="CustomerOtpVerify" component={CustomerOtpVerifyScreen} />
      <Stack.Screen name="SellerStep1" component={SellerStep1Screen} />
      <Stack.Screen name="SellerStep2" component={SellerStep2Screen} />
      <Stack.Screen name="SellerStep3" component={SellerStep3Screen} />
      <Stack.Screen name="SellerPhoneOtp" component={SellerPhoneOtpScreen} />
    </Stack.Navigator>
  );
}

// Seller onboarding - shown when seller is authenticated but has no shop (e.g. just signed up with Google)
function SellerOnboardingStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="SellerStep1">
      <Stack.Screen name="SellerStep1" component={SellerStep1Screen} />
      <Stack.Screen name="SellerStep2" component={SellerStep2Screen} />
      <Stack.Screen name="SellerStep3" component={SellerStep3Screen} />
      <Stack.Screen name="SellerPhoneOtp" component={SellerPhoneOtpScreen} />
    </Stack.Navigator>
  );
}

// Customer stack - shown when customer is authenticated
function CustomerStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}
    >
      <Stack.Screen name="Home" component={TabNavigator} />
      <Stack.Screen name="CheckoutAddress" component={CheckoutAddressScreen} />
      <Stack.Screen name="CheckoutSchedule" component={CheckoutScheduleScreen} />
      <Stack.Screen name="CheckoutInvoice" component={CheckoutInvoiceScreen} />
      <Stack.Screen name="CheckoutPayment" component={CheckoutPaymentScreen} />
      <Stack.Screen name="CheckoutPlaceOrder" component={CheckoutPlaceOrderScreen} />
      <Stack.Screen name="CheckoutSuccess" component={CheckoutSuccessScreen} />
    </Stack.Navigator>
  );
}

// Seller stack - shown when seller is authenticated
function SellerStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SellerTabs" component={SellerTabNavigator} />
    </Stack.Navigator>
  );
}

// Loading screen
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export default function AppNavigator() {
  const { isLoading, isAuthenticated, user, shop } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  // Show splash screen for 2 seconds on app start
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Show splash screen on initial load
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // Show loading while checking auth state
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Seller with no shop (e.g. just signed up with Google) must complete 3-step onboarding first
  const isSellerWithoutShop = isAuthenticated && user?.role === 'seller' && !shop;

  return (
    <NavigationContainer>
      <CheckoutProvider>
        {!isAuthenticated ? (
          // Not logged in - show auth screens
          <AuthStack />
        ) : isSellerWithoutShop ? (
          // Seller signed in but has not completed shop setup - show onboarding (Step 1 → 2 → 3 → Phone OTP)
          <SellerOnboardingStack />
        ) : user?.role === 'seller' ? (
          // Logged in as seller with shop - show dashboard
          <SellerStack />
        ) : (
          // Logged in as customer
          <CustomerStack />
        )}
      </CheckoutProvider>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});

export type { RootStackParamList };
