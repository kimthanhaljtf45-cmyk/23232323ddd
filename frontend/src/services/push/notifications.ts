import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from '@/lib/api';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotificationData {
  type?: string;
  action?: string;
  screen?: string;
  params?: Record<string, any>;
  [key: string]: any;
}

/**
 * Register for push notifications and get the Expo push token
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Check if we're on a physical device
  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices');
    return null;
  }

  // Check and request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Permission to send notifications was denied');
    return null;
  }

  // Setup Android notification channel
  if (Platform.OS === 'android') {
    await setupAndroidChannels();
  }

  // Get the Expo push token
  try {
    const projectId = 
      Constants?.expoConfig?.extra?.eas?.projectId ?? 
      Constants?.easConfig?.projectId ??
      null;

    // If no projectId available (development/testing), skip push token registration
    if (!projectId) {
      console.log('No EAS projectId found - push notifications disabled in development');
      return null;
    }

    const tokenOptions: Notifications.ExpoPushTokenOptions = { projectId };

    const tokenData = await Notifications.getExpoPushTokenAsync(tokenOptions);
    const token = tokenData.data;
    
    console.log('Expo Push Token:', token);
    return token;
  } catch (error: any) {
    // Handle gracefully - don't crash the app
    console.log('Push notifications not available:', error?.message || error);
    return null;
  }
}

/**
 * Setup Android notification channels
 */
async function setupAndroidChannels() {
  // Default channel
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Загальні',
    description: 'Загальні сповіщення',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
    sound: 'default',
  });

  // Messages channel
  await Notifications.setNotificationChannelAsync('messages', {
    name: 'Повідомлення',
    description: 'Повідомлення від тренерів',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
    sound: 'default',
  });

  // Alerts channel
  await Notifications.setNotificationChannelAsync('alerts', {
    name: 'Сповіщення',
    description: 'Важливі сповіщення',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 500],
    lightColor: '#FF0000',
    sound: 'default',
  });

  // Payments channel
  await Notifications.setNotificationChannelAsync('payments', {
    name: 'Оплати',
    description: 'Нагадування про оплату',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
  });
}

/**
 * Register device token with backend
 */
export async function registerDeviceToken(token: string): Promise<boolean> {
  try {
    const platform = Platform.OS as 'ios' | 'android' | 'web';
    await api.registerDevice(token, platform);
    console.log('Device token registered with backend');
    return true;
  } catch (error) {
    console.error('Failed to register device token:', error);
    return false;
  }
}

/**
 * Unregister device token from backend
 */
export async function unregisterDeviceToken(token: string): Promise<boolean> {
  try {
    await api.unregisterDevice(token);
    console.log('Device token unregistered');
    return true;
  } catch (error) {
    console.error('Failed to unregister device token:', error);
    return false;
  }
}

/**
 * Schedule a local notification
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: PushNotificationData,
  trigger?: Notifications.NotificationTriggerInput,
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
    },
    trigger: trigger || null, // null means show immediately
  });
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get badge count
 */
export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

/**
 * Set badge count
 */
export async function setBadgeCount(count: number): Promise<boolean> {
  return Notifications.setBadgeCountAsync(count);
}

/**
 * Dismiss all notifications
 */
export async function dismissAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
}
