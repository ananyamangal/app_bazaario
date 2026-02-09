import { useEffect } from 'react';
import AppNavigator from './mobile/navigation/AppNavigator';
import { AuthProvider, useAuth } from './mobile/context/AuthContext';
import { CartProvider } from './mobile/context/CartContext';
import { WishlistProvider } from './mobile/context/WishlistContext';
import { AvailabilityProvider } from './mobile/context/AvailabilityContext';
import { ChatProvider } from './mobile/context/ChatContext';
import { CallProvider } from './mobile/context/CallContext';
import { NotificationProvider } from './mobile/context/NotificationContext';
import { AvailabilityCartProvider } from './mobile/context/AvailabilityCartContext';
import { useNotifications as usePushNotifications } from './mobile/hooks/useNotifications';
import { setAuthTokenGetter } from './mobile/api/client';

function PushNotificationSetup() {
  usePushNotifications();
  return null;
}

// Component to set up auth token getter after AuthProvider is initialized
function AuthTokenSetup({ children }: { children: React.ReactNode }) {
  const { getIdToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(getIdToken);
  }, [getIdToken]);

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthTokenSetup>
        <CartProvider>
          <AvailabilityCartProvider>
            <WishlistProvider>
              <AvailabilityProvider>
                <PushNotificationSetup />
                <ChatProvider>
                  <CallProvider>
                    <NotificationProvider>
                      <AppNavigator />
                    </NotificationProvider>
                  </CallProvider>
                </ChatProvider>
              </AvailabilityProvider>
            </WishlistProvider>
          </AvailabilityCartProvider>
        </CartProvider>
      </AuthTokenSetup>
    </AuthProvider>
  );
}
