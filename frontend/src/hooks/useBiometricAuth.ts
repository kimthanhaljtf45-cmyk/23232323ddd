import { useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform, Alert } from 'react-native';

const BIOMETRIC_ENABLED_KEY = 'ataka_biometric_enabled';
const BIOMETRIC_USER_KEY = 'ataka_biometric_user';

export interface BiometricStatus {
  isAvailable: boolean;
  isEnabled: boolean;
  biometricType: 'fingerprint' | 'facial' | 'iris' | 'none';
  isEnrolled: boolean;
}

export const useBiometricAuth = () => {
  const [status, setStatus] = useState<BiometricStatus>({
    isAvailable: false,
    isEnabled: false,
    biometricType: 'none',
    isEnrolled: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Check biometric availability
  const checkBiometricStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Check if device supports biometrics
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      // Determine biometric type
      let biometricType: 'fingerprint' | 'facial' | 'iris' | 'none' = 'none';
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometricType = 'facial';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometricType = 'fingerprint';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        biometricType = 'iris';
      }
      
      // Check if user has enabled biometric login
      let isEnabled = false;
      if (Platform.OS !== 'web') {
        const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
        isEnabled = enabled === 'true';
      }
      
      setStatus({
        isAvailable: hasHardware && isEnrolled,
        isEnabled,
        biometricType,
        isEnrolled,
      });
    } catch (error) {
      console.log('Biometric check error:', error);
      setStatus({
        isAvailable: false,
        isEnabled: false,
        biometricType: 'none',
        isEnrolled: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkBiometricStatus();
  }, [checkBiometricStatus]);

  // Authenticate with biometrics
  const authenticate = useCallback(async (reason?: string): Promise<boolean> => {
    if (!status.isAvailable) {
      return false;
    }
    
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason || 'Підтвердіть вашу особу',
        cancelLabel: 'Скасувати',
        disableDeviceFallback: false,
        fallbackLabel: 'Використати пароль',
      });
      
      return result.success;
    } catch (error) {
      console.log('Biometric auth error:', error);
      return false;
    }
  }, [status.isAvailable]);

  // Enable biometric authentication
  const enableBiometric = useCallback(async (userId: string): Promise<boolean> => {
    if (!status.isAvailable) {
      Alert.alert(
        'Біометрія недоступна',
        'Ваш пристрій не підтримує біометричну автентифікацію або вона не налаштована.',
      );
      return false;
    }
    
    try {
      // Verify biometric first
      const authenticated = await authenticate('Підтвердіть біометрію для активації');
      
      if (!authenticated) {
        return false;
      }
      
      // Save to secure storage
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
        await SecureStore.setItemAsync(BIOMETRIC_USER_KEY, userId);
      }
      
      setStatus(prev => ({ ...prev, isEnabled: true }));
      return true;
    } catch (error) {
      console.log('Enable biometric error:', error);
      return false;
    }
  }, [status.isAvailable, authenticate]);

  // Disable biometric authentication
  const disableBiometric = useCallback(async (): Promise<boolean> => {
    try {
      if (Platform.OS !== 'web') {
        await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
        await SecureStore.deleteItemAsync(BIOMETRIC_USER_KEY);
      }
      
      setStatus(prev => ({ ...prev, isEnabled: false }));
      return true;
    } catch (error) {
      console.log('Disable biometric error:', error);
      return false;
    }
  }, []);

  // Get stored user ID for biometric
  const getBiometricUserId = useCallback(async (): Promise<string | null> => {
    if (Platform.OS === 'web') return null;
    try {
      return await SecureStore.getItemAsync(BIOMETRIC_USER_KEY);
    } catch {
      return null;
    }
  }, []);

  // Get biometric type label
  const getBiometricLabel = useCallback((): string => {
    switch (status.biometricType) {
      case 'facial':
        return Platform.OS === 'ios' ? 'Face ID' : 'Розпізнавання обличчя';
      case 'fingerprint':
        return Platform.OS === 'ios' ? 'Touch ID' : 'Відбиток пальця';
      case 'iris':
        return 'Сканування райдужки';
      default:
        return 'Біометрія';
    }
  }, [status.biometricType]);

  return {
    status,
    isLoading,
    authenticate,
    enableBiometric,
    disableBiometric,
    checkBiometricStatus,
    getBiometricUserId,
    getBiometricLabel,
  };
};
