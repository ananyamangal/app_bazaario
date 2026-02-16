export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  RoleSelect: undefined;
  Login: undefined;
  OtpVerify: {
    phone: string;
    role: 'customer' | 'seller';
    isLogin: boolean;
  };
  PhoneVerified: undefined;
  Home: undefined;
  // Checkout (Cart) flow
  CheckoutAddress: undefined;
  CheckoutSchedule: undefined;
  CheckoutInvoice: undefined;
  CheckoutPayment: undefined;
  CheckoutPlaceOrder: undefined;
  CheckoutSuccess: undefined;
  // Customer sign up (Join as customer)
  CustomerSignUp: undefined;
  CustomerOtpVerify: {
    phone: string;
    name?: string;
    email?: string;
  };
  // Seller onboarding (Join as seller)
  SellerStep1: undefined;
  SellerStep2: { shopName: string; ownerName: string; shopDescription: string };
  SellerStep3: {
    shopName: string;
    ownerName: string;
    shopDescription: string;
    market: string;
    city: string;
    shopAddress: string;
  };
  SellerPhoneOtp: {
    shopName: string;
    ownerName: string;
    shopDescription: string;
    market: string;
    city: string;
    shopAddress: string;
    categories: string[];
    phone?: string;
  };
  SellerTabs: undefined;
};
