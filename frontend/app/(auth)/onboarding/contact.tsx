import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useOnboardingStore } from '../../../src/store/onboarding';
import { api } from '../../../src/lib/api';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ContactScreen() {
  const router = useRouter();
  const { target, program, setContact, name, phone, getRole } = useOnboardingStore();
  
  const [localName, setLocalName] = useState(name);
  const [localPhone, setLocalPhone] = useState(phone || '+380 ');
  const [referralCode, setReferralCode] = useState('');
  const [referralApplied, setReferralApplied] = useState(false);
  const [referralError, setReferralError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Format phone: +380 XX XXX XX XX
  const formatPhone = (text: string): string => {
    let digits = text.replace(/\D/g, '');
    
    if (!digits.startsWith('380')) {
      if (digits.startsWith('80')) digits = '3' + digits;
      else if (digits.startsWith('0')) digits = '38' + digits;
      else if (!digits.startsWith('3')) digits = '380' + digits;
    }
    
    digits = digits.slice(0, 12);
    
    let formatted = '+';
    if (digits.length > 0) formatted += digits.slice(0, 3);
    if (digits.length > 3) formatted += ' ' + digits.slice(3, 5);
    if (digits.length > 5) formatted += ' ' + digits.slice(5, 8);
    if (digits.length > 8) formatted += ' ' + digits.slice(8, 10);
    if (digits.length > 10) formatted += ' ' + digits.slice(10, 12);
    
    return formatted;
  };

  const isValid = localName.trim().length >= 2 && localPhone.replace(/\D/g, '').length === 12;

  // Validate referral code
  const handleValidateReferral = async () => {
    if (!referralCode.trim()) return;
    
    try {
      const result = await api.validateReferralCode(referralCode.trim().toUpperCase());
      if (result.valid) {
        setReferralApplied(true);
        setReferralError('');
      } else {
        setReferralError(result.message || 'Невірний реферальний код');
      }
    } catch (err: any) {
      setReferralError(err.response?.data?.message || 'Невірний реферальний код');
    }
  };

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setError('');

    try {
      setContact(localName, localPhone);
      const phoneDigits = '+' + localPhone.replace(/\D/g, '');

      await api.createConsultation({
        fullName: localName,
        phone: phoneDigits,
        role: getRole(),
        programType: program,
        source: 'MOBILE_ONBOARDING',
        referralCode: referralApplied ? referralCode.trim().toUpperCase() : undefined,
      });

      router.push('/(auth)/onboarding/success');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Помилка. Спробуйте ще раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Progress */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '100%' }]} />
            </View>
            <Text style={styles.progressText}>Крок 4 з 4</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>Залиште контакт</Text>
          <Text style={styles.subtitle}>
            Тренер зв'яжеться та підбере групу
          </Text>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ваше ім'я</Text>
              <TextInput
                style={styles.input}
                placeholder="Введіть ім'я"
                placeholderTextColor="#9CA3AF"
                value={localName}
                onChangeText={setLocalName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Телефон</Text>
              <TextInput
                style={styles.input}
                placeholder="+380 XX XXX XX XX"
                placeholderTextColor="#9CA3AF"
                value={localPhone}
                onChangeText={(text) => setLocalPhone(formatPhone(text))}
                keyboardType="phone-pad"
              />
            </View>

            {/* Referral Code Section */}
            <View style={styles.referralSection}>
              <Text style={styles.referralTitle}>Є реферальний код?</Text>
              {!referralApplied ? (
                <View style={styles.referralInputRow}>
                  <TextInput
                    style={[styles.referralInput, referralError && styles.referralInputError]}
                    placeholder="Введіть код"
                    placeholderTextColor="#9CA3AF"
                    value={referralCode}
                    onChangeText={(t) => {
                      setReferralCode(t.toUpperCase());
                      setReferralError('');
                    }}
                    autoCapitalize="characters"
                  />
                  <Pressable
                    style={[styles.referralApplyBtn, !referralCode.trim() && styles.referralApplyBtnDisabled]}
                    onPress={handleValidateReferral}
                    disabled={!referralCode.trim()}
                  >
                    <Text style={styles.referralApplyBtnText}>Застосувати</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.referralApplied}>
                  <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                  <Text style={styles.referralAppliedText}>
                    Код <Text style={styles.referralAppliedCode}>{referralCode}</Text> застосовано!
                  </Text>
                </View>
              )}
              {referralError ? <Text style={styles.referralErrorText}>{referralError}</Text> : null}
              <Pressable onPress={() => {
                setReferralCode('');
                setReferralError('');
                setReferralApplied(false);
              }}>
                <Text style={styles.referralSkipText}>
                  {referralCode ? 'Очистити' : 'Пропустити'}
                </Text>
              </Pressable>
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Submit Button */}
          <AnimatedPressable
            style={[
              styles.submitButton,
              animatedStyle,
              !isValid && styles.submitButtonDisabled,
            ]}
            onPressIn={() => { if (isValid) scale.value = withSpring(0.97); }}
            onPressOut={() => { scale.value = withSpring(1); }}
            onPress={handleSubmit}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Записатися на пробне</Text>
            )}
          </AnimatedPressable>

          <Text style={styles.privacyNote}>
            Натискаючи кнопку, ви погоджуєтесь з обробкою персональних даних
          </Text>
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
    paddingTop: 16,
    paddingBottom: 40,
  },
  progressContainer: {
    marginBottom: 32,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#E30613',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 13,
    color: '#9CA3AF',
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
    marginBottom: 32,
  },
  form: {
    gap: 20,
    marginBottom: 24,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#0F0F10',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#E30613',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#FECACA',
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  privacyNote: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
  // Referral styles
  referralSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  referralTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  referralInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  referralInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500',
    color: '#0F0F10',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  referralInputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEE2E2',
  },
  referralApplyBtn: {
    backgroundColor: '#0F0F10',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  referralApplyBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  referralApplyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  referralApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    padding: 12,
    borderRadius: 10,
  },
  referralAppliedText: {
    color: '#166534',
    fontSize: 14,
  },
  referralAppliedCode: {
    fontWeight: '700',
  },
  referralErrorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 6,
  },
  referralSkipText: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
});
