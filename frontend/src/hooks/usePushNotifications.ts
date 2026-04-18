import { useEffect, useRef, useState, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import {
  registerForPushNotificationsAsync,
  registerDeviceToken,
  unregisterDeviceToken,
  PushNotificationData,
} from '@/services/push/notifications';
import { useStore } from '@/store/useStore';

export interface UsePushNotificationsResult {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  isRegistered: boolean;
  isLoading: boolean;
  error: string | null;
  registerPushToken: () => Promise<void>;
  unregisterPushToken: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const router = useRouter();
  const user = useStore((state) => state.user);
  const authState = useStore((state) => state.authState);

  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  /**
   * Handle notification received while app is in foreground
   */
  const handleNotificationReceived = useCallback((notification: Notifications.Notification) => {
    console.log('Notification received:', notification);
    setNotification(notification);
  }, []);

  /**
   * Handle notification response (user tapped on notification)
   */
  const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse) => {
    console.log('Notification response:', response);
    
    const data = response.notification.request.content.data as PushNotificationData;
    
    // Navigate based on notification data
    if (data?.screen) {
      const params = data.params || {};
      const route = data.screen as any;
      
      // Small delay to ensure app is ready
      setTimeout(() => {
        if (params.id) {
          router.push({ pathname: route, params });
        } else {
          router.push(route);
        }
      }, 100);
    }
  }, [router]);

  /**
   * Register for push notifications
   */
  const registerPushToken = useCallback(async () => {
    if (!user?.id || authState !== 'authenticated') {
      console.log('User not authenticated, skipping push registration');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await registerForPushNotificationsAsync();
      
      if (token) {
        setExpoPushToken(token);
        
        // Register with backend
        const success = await registerDeviceToken(token);
        setIsRegistered(success);
        
        if (!success) {
          console.log('Push registration: backend registration skipped');
        }
      } else {
        // Not on physical device, permission denied, or no EAS project
        // This is normal for development - don't treat as error
        console.log('Push notification setup: Push notifications not available');
      }
    } catch (err) {
      // Don't show error to user in development
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.log('Push registration skipped:', message);
    } finally {
      setIsLoading(false);
    }
  }, [user, authState]);

  /**
   * Unregister push token
   */
  const unregisterPushToken = useCallback(async () => {
    if (!expoPushToken) return;

    try {
      await unregisterDeviceToken(expoPushToken);
      setIsRegistered(false);
      setExpoPushToken(null);
    } catch (err) {
      console.error('Push unregistration error:', err);
    }
  }, [expoPushToken]);

  // Setup notification listeners
  useEffect(() => {
    // Listener for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(
      handleNotificationReceived
    );

    // Listener for when user taps on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [handleNotificationReceived, handleNotificationResponse]);

  // Auto-register when user is authenticated
  useEffect(() => {
    if (authState === 'authenticated' && user?.id && !isRegistered && !isLoading) {
      registerPushToken();
    }
  }, [authState, user?.id, isRegistered, isLoading, registerPushToken]);

  // Unregister when user logs out
  useEffect(() => {
    if (authState === 'unauthenticated' && isRegistered) {
      unregisterPushToken();
    }
  }, [authState, isRegistered, unregisterPushToken]);

  return {
    expoPushToken,
    notification,
    isRegistered,
    isLoading,
    error,
    registerPushToken,
    unregisterPushToken,
  };
}
