import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Switch,
  TextInput,
  Modal,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { useStore } from '../../src/store/useStore';
import { useBiometricAuth } from '../../src/hooks/useBiometricAuth';

/**
 * SECURITY SETTINGS - Налаштування безпеки
 * - Google Authenticator (TOTP)
 * - Face ID / Touch ID (Біометрія)
 * - Backup codes
 */

interface SecurityStatus {
  totpEnabled: boolean;
  totpEnabledAt?: string;
  biometricEnabled: boolean;
  biometricEnabledAt?: string;
  requireOnLogin: boolean;
  requireOnSensitiveActions: boolean;
}

export default function SecurityScreen() {
  const router = useRouter();
  const { user } = useStore();
  const biometric = useBiometricAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>({
    totpEnabled: false,
    biometricEnabled: false,
    requireOnLogin: false,
    requireOnSensitiveActions: false,
  });
  
  // TOTP Setup state
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpQrCode, setTotpQrCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  
  // TOTP Disable state
  const [showDisableTotp, setShowDisableTotp] = useState(false);
  const [disableCode, setDisableCode] = useState('');

  // Load security status
  const loadSecurityStatus = useCallback(async () => {
    try {
      setLoading(true);
      const status = await api.get('/security/2fa/status');
      setSecurityStatus(status);
    } catch (error) {
      console.log('Security status error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSecurityStatus();
  }, [loadSecurityStatus]);

  // Start TOTP setup
  const startTotpSetup = async () => {
    try {
      setSaving(true);
      const response = await api.post('/security/2fa/totp/setup');
      setTotpSecret(response.manualEntry);
      setTotpQrCode(response.qrCode);
      setShowTotpSetup(true);
    } catch (error: any) {
      Alert.alert('Помилка', error?.response?.data?.message || 'Не вдалося почати налаштування');
    } finally {
      setSaving(false);
    }
  };

  // Verify and enable TOTP
  const verifyAndEnableTotp = async () => {
    if (verificationCode.length !== 6) {
      Alert.alert('Помилка', 'Введіть 6-значний код');
      return;
    }
    
    try {
      setSaving(true);
      const response = await api.post('/security/2fa/totp/verify', { token: verificationCode });
      
      if (response.backupCodes) {
        setBackupCodes(response.backupCodes);
        setShowBackupCodes(true);
      }
      
      setShowTotpSetup(false);
      setVerificationCode('');
      await loadSecurityStatus();
      Alert.alert('Успішно', 'Google Authenticator активовано!');
    } catch (error: any) {
      Alert.alert('Помилка', error?.response?.data?.message || 'Невірний код верифікації');
    } finally {
      setSaving(false);
    }
  };

  // Disable TOTP
  const disableTotp = async () => {
    if (disableCode.length < 6) {
      Alert.alert('Помилка', 'Введіть код з Google Authenticator або резервний код');
      return;
    }
    
    try {
      setSaving(true);
      await api.delete('/security/2fa/totp', { data: { token: disableCode } });
      setShowDisableTotp(false);
      setDisableCode('');
      await loadSecurityStatus();
      Alert.alert('Успішно', 'Google Authenticator вимкнено');
    } catch (error: any) {
      Alert.alert('Помилка', error?.response?.data?.message || 'Невірний код');
    } finally {
      setSaving(false);
    }
  };

  // Toggle biometric
  const toggleBiometric = async () => {
    if (securityStatus.biometricEnabled) {
      // Disable biometric
      Alert.alert(
        'Вимкнути біометрію?',
        `Ви впевнені, що хочете вимкнути ${biometric.getBiometricLabel()}?`,
        [
          { text: 'Скасувати', style: 'cancel' },
          {
            text: 'Вимкнути',
            style: 'destructive',
            onPress: async () => {
              try {
                setSaving(true);
                await api.delete('/security/2fa/biometric');
                await biometric.disableBiometric();
                await loadSecurityStatus();
              } catch (error) {
                Alert.alert('Помилка', 'Не вдалося вимкнути біометрію');
              } finally {
                setSaving(false);
              }
            },
          },
        ]
      );
    } else {
      // Enable biometric
      if (!biometric.status.isAvailable) {
        Alert.alert(
          'Біометрія недоступна',
          'Ваш пристрій не підтримує біометричну автентифікацію або вона не налаштована в системі.'
        );
        return;
      }
      
      try {
        setSaving(true);
        const authenticated = await biometric.authenticate(
          `Активувати ${biometric.getBiometricLabel()}`
        );
        
        if (authenticated) {
          await api.post('/security/2fa/biometric/enable');
          await biometric.enableBiometric(user?.id || '');
          await loadSecurityStatus();
          Alert.alert('Успішно', `${biometric.getBiometricLabel()} активовано!`);
        }
      } catch (error) {
        Alert.alert('Помилка', 'Не вдалося активувати біометрію');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E30613" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.headerBackBtn}>
          <Ionicons name="chevron-back" size={24} color="#0F0F10" />
        </Pressable>
        <Text style={styles.headerTitle}>Безпека</Text>
        <View style={styles.headerBackBtn} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="shield-checkmark" size={24} color="#22C55E" />
          <Text style={styles.infoBannerText}>
            Двофакторна автентифікація захищає ваш акаунт від несанкціонованого доступу
          </Text>
        </View>

        {/* Google Authenticator Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Google Authenticator</Text>
          <Text style={styles.sectionDescription}>
            Використовуйте додаток Google Authenticator для генерації одноразових кодів входу
          </Text>
          
          <Pressable 
            style={styles.settingItem}
            onPress={securityStatus.totpEnabled ? () => setShowDisableTotp(true) : startTotpSetup}
            disabled={saving}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: securityStatus.totpEnabled ? '#D1FAE5' : '#FEE2E2' }]}>
                <Ionicons 
                  name={securityStatus.totpEnabled ? 'checkmark-circle' : 'key-outline'} 
                  size={20} 
                  color={securityStatus.totpEnabled ? '#22C55E' : '#EF4444'} 
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>TOTP Автентифікація</Text>
                <Text style={styles.settingHint}>
                  {securityStatus.totpEnabled 
                    ? `Активовано${securityStatus.totpEnabledAt ? ` • ${new Date(securityStatus.totpEnabledAt).toLocaleDateString('uk')}` : ''}`
                    : 'Не налаштовано'
                  }
                </Text>
              </View>
            </View>
            {saving ? (
              <ActivityIndicator size="small" color="#E30613" />
            ) : (
              <View style={[styles.statusBadge, securityStatus.totpEnabled ? styles.statusBadgeActive : styles.statusBadgeInactive]}>
                <Text style={[styles.statusBadgeText, securityStatus.totpEnabled ? styles.statusBadgeTextActive : styles.statusBadgeTextInactive]}>
                  {securityStatus.totpEnabled ? 'Вимкнути' : 'Налаштувати'}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Biometric Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{biometric.getBiometricLabel()}</Text>
          <Text style={styles.sectionDescription}>
            Швидкий вхід за допомогою біометричної автентифікації
          </Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons 
                  name={biometric.status.biometricType === 'facial' ? 'scan' : 'finger-print'} 
                  size={20} 
                  color="#3B82F6" 
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{biometric.getBiometricLabel()}</Text>
                <Text style={styles.settingHint}>
                  {biometric.status.isAvailable 
                    ? (securityStatus.biometricEnabled ? 'Активовано' : 'Доступно')
                    : 'Недоступно на цьому пристрої'
                  }
                </Text>
              </View>
            </View>
            <Switch
              value={securityStatus.biometricEnabled}
              onValueChange={toggleBiometric}
              trackColor={{ false: '#E5E7EB', true: '#22C55E' }}
              thumbColor="#fff"
              disabled={!biometric.status.isAvailable || saving}
            />
          </View>
        </View>

        {/* Admin Notice */}
        {user?.role === 'ADMIN' && (
          <View style={styles.adminNotice}>
            <Ionicons name="warning" size={20} color="#F59E0B" />
            <Text style={styles.adminNoticeText}>
              Як адміністратор, вам обов'язково потрібно мати увімкнену двофакторну автентифікацію
            </Text>
          </View>
        )}

        {/* Security Tips */}
        <View style={styles.tipsSection}>
          <Text style={styles.tipsTitle}>Поради з безпеки</Text>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
            <Text style={styles.tipText}>Використовуйте унікальний пароль</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
            <Text style={styles.tipText}>Зберігайте резервні коди в безпечному місці</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
            <Text style={styles.tipText}>Не діліться кодами верифікації</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* TOTP Setup Modal */}
      <Modal visible={showTotpSetup} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Налаштування Google Authenticator</Text>
              <Pressable onPress={() => { setShowTotpSetup(false); setVerificationCode(''); }}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Step 1 */}
              <View style={styles.setupStep}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Встановіть додаток</Text>
                  <Text style={styles.stepDescription}>
                    Завантажте Google Authenticator з App Store або Google Play
                  </Text>
                </View>
              </View>

              {/* Step 2 - QR Code */}
              <View style={styles.setupStep}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Скануйте QR-код</Text>
                  <Text style={styles.stepDescription}>
                    Відкрийте Google Authenticator та відскануйте цей код
                  </Text>
                  {totpQrCode ? (
                    <View style={styles.qrContainer}>
                      <Image source={{ uri: totpQrCode }} style={styles.qrCode} resizeMode="contain" />
                    </View>
                  ) : null}
                  <Text style={styles.manualEntryLabel}>Або введіть код вручну:</Text>
                  <View style={styles.secretContainer}>
                    <Text style={styles.secretText} selectable>{totpSecret}</Text>
                  </View>
                </View>
              </View>

              {/* Step 3 - Verify */}
              <View style={styles.setupStep}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Введіть код</Text>
                  <Text style={styles.stepDescription}>
                    Введіть 6-значний код з Google Authenticator для підтвердження
                  </Text>
                  <TextInput
                    style={styles.codeInput}
                    value={verificationCode}
                    onChangeText={(text) => setVerificationCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
                    placeholder="000000"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={6}
                    textAlign="center"
                  />
                </View>
              </View>
            </ScrollView>

            <Pressable 
              style={[styles.saveButton, (saving || verificationCode.length !== 6) && styles.saveButtonDisabled]}
              onPress={verifyAndEnableTotp}
              disabled={saving || verificationCode.length !== 6}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Підтвердити та активувати</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Backup Codes Modal */}
      <Modal visible={showBackupCodes} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Резервні коди</Text>
            </View>

            <View style={styles.backupWarning}>
              <Ionicons name="warning" size={24} color="#F59E0B" />
              <Text style={styles.backupWarningText}>
                Збережіть ці коди в безпечному місці! Вони потрібні для входу, якщо ви втратите доступ до Google Authenticator.
              </Text>
            </View>

            <View style={styles.codesGrid}>
              {backupCodes.map((code, index) => (
                <View key={index} style={styles.codeItem}>
                  <Text style={styles.codeText} selectable>{code}</Text>
                </View>
              ))}
            </View>

            <Pressable 
              style={styles.saveButton}
              onPress={() => { setShowBackupCodes(false); setBackupCodes([]); }}
            >
              <Text style={styles.saveButtonText}>Я зберіг коди</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Disable TOTP Modal */}
      <Modal visible={showDisableTotp} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Вимкнути Google Authenticator</Text>
              <Pressable onPress={() => { setShowDisableTotp(false); setDisableCode(''); }}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </Pressable>
            </View>

            <View style={styles.disableWarning}>
              <Ionicons name="warning" size={24} color="#EF4444" />
              <Text style={styles.disableWarningText}>
                Вимкнення 2FA знизить безпеку вашого акаунту. Ви впевнені?
              </Text>
            </View>

            <Text style={styles.inputLabel}>Введіть код з Google Authenticator або резервний код:</Text>
            <TextInput
              style={styles.codeInput}
              value={disableCode}
              onChangeText={(text) => setDisableCode(text.toUpperCase().slice(0, 8))}
              placeholder="Код"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              textAlign="center"
            />

            <Pressable 
              style={[styles.disableButton, (saving || disableCode.length < 6) && styles.saveButtonDisabled]}
              onPress={disableTotp}
              disabled={saving || disableCode.length < 6}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Вимкнути 2FA</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerBackBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F0F10',
  },
  
  scrollView: { flex: 1 },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#D1FAE5',
    margin: 16,
    borderRadius: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#065F46',
    lineHeight: 20,
  },

  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F0F10',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },

  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F0F10',
  },
  settingHint: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeActive: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeInactive: {
    backgroundColor: '#D1FAE5',
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadgeTextActive: {
    color: '#EF4444',
  },
  statusBadgeTextInactive: {
    color: '#22C55E',
  },

  adminNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#FEF3C7',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  adminNoticeText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },

  tipsSection: {
    marginHorizontal: 16,
    padding: 16,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#6B7280',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F0F10',
  },

  setupStep: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E30613',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F0F10',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },

  qrContainer: {
    alignItems: 'center',
    marginVertical: 16,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  qrCode: {
    width: 200,
    height: 200,
  },
  manualEntryLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 12,
    marginBottom: 8,
  },
  secretContainer: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
  },
  secretText: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#0F0F10',
    textAlign: 'center',
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  codeInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: '700',
    color: '#0F0F10',
    letterSpacing: 8,
    marginTop: 12,
  },

  backupWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    marginBottom: 24,
  },
  backupWarningText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },

  codesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  codeItem: {
    width: '48%',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  codeText: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
    color: '#0F0F10',
  },

  disableWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    marginBottom: 24,
  },
  disableWarningText: {
    flex: 1,
    fontSize: 14,
    color: '#991B1B',
    lineHeight: 20,
  },

  saveButton: {
    backgroundColor: '#E30613',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#FECACA',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  disableButton: {
    backgroundColor: '#EF4444',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
});
