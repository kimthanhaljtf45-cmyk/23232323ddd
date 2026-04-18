import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { api } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { getHomeRoute } from '../../src/utils/roleRouter';

// Required for Google Auth on web
WebBrowser.maybeCompleteAuthSession();

import { ATAKA_LOGO_BASE64 } from '../../src/constants/logo';
const logoSource = { uri: ATAKA_LOGO_BASE64 };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Google OAuth Config - Replace with your actual client ID
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';

export default function LoginScreen() {
  const router = useRouter();
  
  const [phone, setPhone] = useState('+380 ');
  const [step, setStep] = useState<'MAIN' | 'PHONE' | 'OTP'>('MAIN');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const scale = useSharedValue(1);
  const googleScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const googleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: googleScale.value }],
  }));

  // Google Auth Request setup
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      redirectUri: AuthSession.makeRedirectUri({
        scheme: 'ataka',
        path: 'auth',
      }),
      scopes: ['profile', 'email'],
      responseType: AuthSession.ResponseType.IdToken,
    },
    {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    }
  );

  // Handle Google Auth response
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleLogin(id_token);
    } else if (response?.type === 'error') {
      setError('Помилка авторизації через Google');
      setGoogleLoading(false);
    }
  }, [response]);

  // Google Login Handler
  const handleGoogleLogin = async (idToken: string) => {
    setGoogleLoading(true);
    setError('');
    
    try {
      const result = await api.googleAuth(idToken);
      
      if (result.accessToken) {
        if (result.user) {
          useStore.getState().setUser(result.user);
        }
        
        const needsOnboarding = result.isNewUser || result.needsOnboarding || (result.user && !result.user.isOnboarded);
        
        if (needsOnboarding) {
          router.replace('/(auth)/onboarding');
        } else {
          const homeRoute = getHomeRoute(result.user?.role);
          router.replace(homeRoute as any);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Помилка авторизації');
    } finally {
      setGoogleLoading(false);
    }
  };

  // Trigger Google Sign In
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
    
    try {
      await promptAsync();
    } catch (err) {
      setError('Помилка підключення до Google');
      setGoogleLoading(false);
    }
  };

  // Format phone: +380 (XX) XXX XX XX
  const formatPhone = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 12);

    if (digits.startsWith('380')) {
      const rest = digits.slice(3);
      if (rest.length === 0) return '+380';
      if (rest.length <= 2) return `+380 (${rest}`;
      if (rest.length <= 5) return `+380 (${rest.slice(0, 2)}) ${rest.slice(2)}`;
      if (rest.length <= 7) return `+380 (${rest.slice(0, 2)}) ${rest.slice(2, 5)} ${rest.slice(5)}`;
      return `+380 (${rest.slice(0, 2)}) ${rest.slice(2, 5)} ${rest.slice(5, 7)} ${rest.slice(7, 9)}`;
    }

    if (digits.length === 0) return '+380';
    if (digits.length <= 2) return `+380 (${digits}`;
    if (digits.length <= 5) return `+380 (${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 7) return `+380 (${digits.slice(0, 2)}) ${digits.slice(2, 5)} ${digits.slice(5)}`;
    return `+380 (${digits.slice(0, 2)}) ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
  };

  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    if (digits.length < 3 && !text.includes('+380')) {
      setPhone('+380');
      return;
    }
    const formatted = formatPhone(text);
    setPhone(formatted);
    setError('');
  };

  const isPhoneValid = phone.replace(/\D/g, '').length === 12;

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value[value.length - 1];
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');
    
    if (value && index < 3) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const startResendTimer = () => {
    setResendTimer(30);
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRequestOtp = async () => {
    if (!isPhoneValid) return;
    
    setLoading(true);
    setError('');
    
    try {
      const phoneDigits = '+' + phone.replace(/\D/g, '');
      await api.requestOtp(phoneDigits);
      setStep('OTP');
      startResendTimer();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Помилка відправки коду');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 4) return;
    
    setLoading(true);
    setError('');
    
    try {
      const phoneDigits = '+' + phone.replace(/\D/g, '');
      const response = await api.verifyOtp(phoneDigits, otpCode);
      
      console.log('Login response:', JSON.stringify(response.user, null, 2));
      
      if (response.accessToken) {
        if (response.user) {
          // Set user with correct role - tokens already saved by api.verifyOtp
          useStore.getState().setUser(response.user);
          console.log('User role set:', response.user.role);
        }
        
        const needsOnboarding = response.isNewUser || response.needsOnboarding || (response.user && !response.user.isOnboarded);
        
        if (needsOnboarding) {
          router.replace('/(auth)/onboarding');
        } else {
          const homeRoute = getHomeRoute(response.user?.role);
          router.replace(homeRoute as any);
        }
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Невірний код';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    await handleRequestOtp();
  };

  const handleBack = () => {
    if (step === 'OTP') {
      setStep('PHONE');
      setOtp(['', '', '', '']);
      setError('');
    } else if (step === 'PHONE') {
      setStep('MAIN');
      setError('');
    } else {
      router.back();
    }
  };

  // MAIN screen - Google primary, OTP fallback
  if (step === 'MAIN') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color="#0F0F10" />
            </Pressable>
          </View>

          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image source={logoSource} style={styles.logo} resizeMode="contain" />
          </View>

          {/* Title */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>Вхід</Text>
            <Text style={styles.subtitle}>
              Оберіть зручний спосіб входу
            </Text>
          </View>

          {/* Google Sign In - PRIMARY */}
          <View style={styles.authSection}>
            <AnimatedPressable
              style={[styles.googleBtn, googleAnimatedStyle]}
              onPressIn={() => { googleScale.value = withSpring(0.97); }}
              onPressOut={() => { googleScale.value = withSpring(1); }}
              onPress={handleGoogleSignIn}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <View style={styles.googleIconContainer}>
                    <Ionicons name="logo-google" size={20} color="#EA4335" />
                  </View>
                  <Text style={styles.googleBtnText}>Увійти через Google</Text>
                </>
              )}
            </AnimatedPressable>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>або</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Phone OTP - FALLBACK */}
            <AnimatedPressable
              style={[styles.phoneBtn, animatedStyle]}
              onPressIn={() => { scale.value = withSpring(0.97); }}
              onPressOut={() => { scale.value = withSpring(1); }}
              onPress={() => setStep('PHONE')}
            >
              <Ionicons name="phone-portrait-outline" size={20} color="#fff" />
              <Text style={styles.phoneBtnText}>Ввести номер телефону</Text>
            </AnimatedPressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Немає акаунту?</Text>
            <Pressable onPress={() => router.push('/(auth)/onboarding')}>
              <Text style={styles.footerLink}>Записатися на пробне</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // PHONE and OTP screens
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color="#0F0F10" />
            </Pressable>
          </View>

          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image source={logoSource} style={styles.logo} resizeMode="contain" />
          </View>

          {/* Title */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>
              {step === 'PHONE' ? 'Вхід по телефону' : 'Введіть код'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'PHONE' 
                ? 'Введіть номер телефону для входу'
                : `Код надіслано на ${phone}`}
            </Text>
          </View>

          {step === 'PHONE' ? (
            <View style={styles.formSection}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Номер телефону</Text>
                <View style={styles.phoneInputContainer}>
                  <TextInput
                    testID="phone-input"
                    style={styles.phoneInput}
                    placeholder="+380 XX XXX XX XX"
                    placeholderTextColor="#9CA3AF"
                    value={phone}
                    onChangeText={handlePhoneChange}
                    keyboardType="phone-pad"
                    autoFocus
                  />
                  {isPhoneValid && (
                    <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                  )}
                </View>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                testID="request-otp-button"
                style={[
                  styles.primaryBtn,
                  !isPhoneValid && styles.primaryBtnDisabled,
                ]}
                onPress={handleRequestOtp}
                disabled={!isPhoneValid || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Отримати код</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.formSection}>
              <View style={styles.otpContainer}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => { otpRefs.current[index] = ref; }}
                    style={[
                      styles.otpInput,
                      digit && styles.otpInputFilled,
                      error && styles.otpInputError,
                    ]}
                    value={digit}
                    onChangeText={(value) => handleOtpChange(index, value)}
                    onKeyPress={({ nativeEvent }) => handleOtpKeyPress(index, nativeEvent.key)}
                    keyboardType="number-pad"
                    maxLength={1}
                    autoFocus={index === 0}
                  />
                ))}
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                testID="verify-otp-button"
                style={[
                  styles.primaryBtn,
                  otp.join('').length !== 4 && styles.primaryBtnDisabled,
                ]}
                onPress={handleVerifyOtp}
                disabled={otp.join('').length !== 4 || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Увійти</Text>
                )}
              </Pressable>

              <Pressable
                style={[styles.resendButton, resendTimer > 0 && styles.resendButtonDisabled]}
                onPress={handleResendOtp}
                disabled={resendTimer > 0}
              >
                <Text style={[styles.resendText, resendTimer > 0 && styles.resendTextDisabled]}>
                  {resendTimer > 0 
                    ? `Надіслати код повторно (${resendTimer}с)`
                    : 'Надіслати код повторно'}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Немає акаунту?</Text>
            <Pressable onPress={() => router.push('/(auth)/onboarding')}>
              <Text style={styles.footerLink}>Записатися на пробне</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    flexGrow: 1,
  },
  header: {
    height: 50,
    justifyContent: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  logo: {
    width: 80,
    height: 80,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F0F10',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
  },
  authSection: {
    marginBottom: 24,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    gap: 12,
    minHeight: 56,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F0F10',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#9CA3AF',
  },
  phoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F0F10',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
    minHeight: 56,
  },
  phoneBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  formSection: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  phoneInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 17,
    fontWeight: '500',
    color: '#0F0F10',
    letterSpacing: 0.5,
  },
  error: {
    fontSize: 14,
    color: '#EF4444',
    marginTop: 16,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: '#E30613',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  primaryBtnDisabled: {
    backgroundColor: '#FECACA',
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: '#0F0F10',
  },
  otpInputFilled: {
    backgroundColor: '#E5E7EB',
  },
  otpInputError: {
    backgroundColor: '#FEE2E2',
  },
  resendButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  resendButtonDisabled: {
    opacity: 0.6,
  },
  resendText: {
    fontSize: 15,
    color: '#E30613',
    fontWeight: '500',
  },
  resendTextDisabled: {
    color: '#9CA3AF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 'auto',
    paddingTop: 24,
  },
  footerText: {
    fontSize: 15,
    color: '#6B7280',
  },
  footerLink: {
    fontSize: 15,
    color: '#E30613',
    fontWeight: '600',
  },
});
