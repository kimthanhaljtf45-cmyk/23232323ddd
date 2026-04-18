import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useStore } from '../src/store/useStore';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { ClubProvider } from '../src/contexts/ClubContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000,
    },
  },
});

// Push notification provider component
function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  const { isRegistered, error } = usePushNotifications();
  
  useEffect(() => {
    if (error) {
      console.log('Push notification setup:', error);
    }
    if (isRegistered) {
      console.log('Push notifications registered successfully');
    }
  }, [isRegistered, error]);

  return <>{children}</>;
}

export default function RootLayout() {
  const checkAuth = useStore((state) => state.checkAuth);
  const user = useStore((state) => state.user);

  useEffect(() => {
    // Hydrate from storage first, then check auth API if needed
    const initAuth = async () => {
      // First try to restore user from local storage
      await useStore.getState()._hydrate();
      
      const currentUser = useStore.getState().user;
      if (!currentUser) {
        // No cached user - check with API
        await checkAuth();
      }
    };
    initAuth();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ClubProvider>
            <PushNotificationProvider>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="(coach)" />
                <Stack.Screen name="(owner)" />
              </Stack>
            </PushNotificationProvider>
          </ClubProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
