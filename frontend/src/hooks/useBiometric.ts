import { useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Biometric Authentication Hook
 * 
 * Works on:
 * - iOS: Face ID, Touch ID
 * - Android: Fingerprint, Face Recognition
 * - Web: Not supported (returns fallback)
 */

interface BiometricState {
  isAvailable: boolean;
  biometricType: string;
  isEnabled: boolean;
  isLoading: boolean;
}

const BIOMETRIC_ENABLED_KEY = '@biometric_enabled';

export function useBiometric() {
  const [state, setState] = useState<BiometricState>({
    isAvailable: false,
    biometricType: 'Biometric',
    isEnabled: false,
    isLoading: true,
  });

  const checkBiometricSupport = useCallback(async () => {
    if (Platform.OS === 'web') {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      let biometricType = 'Biometric';
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometricType = Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometricType = Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
      }

      // Check if enabled in storage
      const enabledStr = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      const isEnabled = enabledStr === 'true';

      setState({
        isAvailable: hasHardware && isEnrolled,
        biometricType,
        isEnabled: isEnabled && hasHardware && isEnrolled,
        isLoading: false,
      });
    } catch (error) {
      console.log('Biometric check error:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    checkBiometricSupport();
  }, [checkBiometricSupport]);

  /**
   * Authenticate with biometric
   */
  const authenticate = useCallback(async (promptMessage?: string): Promise<boolean> => {
    if (Platform.OS === 'web' || !state.isAvailable) {
      return false;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || `Увійти з ${state.biometricType}`,
        cancelLabel: 'Скасувати',
        disableDeviceFallback: false,
        fallbackLabel: 'Ввести пароль',
      });

      return result.success;
    } catch (error) {
      console.log('Biometric auth error:', error);
      return false;
    }
  }, [state.isAvailable, state.biometricType]);

  /**
   * Enable biometric authentication
   */
  const enable = useCallback(async (): Promise<boolean> => {
    if (!state.isAvailable) {
      return false;
    }

    // Verify with biometric first
    const verified = await authenticate(`Увімкнути ${state.biometricType}`);
    if (!verified) {
      return false;
    }

    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
    setState(prev => ({ ...prev, isEnabled: true }));
    return true;
  }, [state.isAvailable, state.biometricType, authenticate]);

  /**
   * Disable biometric authentication
   */
  const disable = useCallback(async (): Promise<void> => {
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');
    setState(prev => ({ ...prev, isEnabled: false }));
  }, []);

  /**
   * Check if should prompt for biometric on app start
   */
  const shouldPromptOnStart = useCallback((): boolean => {
    return state.isAvailable && state.isEnabled;
  }, [state.isAvailable, state.isEnabled]);

  return {
    ...state,
    authenticate,
    enable,
    disable,
    shouldPromptOnStart,
    refresh: checkBiometricSupport,
  };
}
