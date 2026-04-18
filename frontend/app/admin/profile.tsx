import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
  Modal,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { useStore } from '../../src/store/useStore';
import { api } from '../../src/lib/api';

/**
 * ADMIN PROFILE with Security Settings
 * 
 * Features:
 * - Avatar change with ImagePicker
 * - Profile editing (name, description)
 * - Google Authenticator (TOTP) setup
 * - Face ID / Biometric authentication
 * - Security status overview
 */

interface SecurityStatus {
  totpEnabled: boolean;
  totpEnabledAt?: string;
  biometricEnabled: boolean;
  biometricEnabledAt?: string;
  requireOnLogin: boolean;
}

interface TotpSetup {
  secret: string;
  qrCode: string;
  manualEntry: string;
}

export default function AdminProfileScreen() {
  const router = useRouter();
  const { user, logout } = useStore();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Profile state
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [description, setDescription] = useState('');
  const [editMode, setEditMode] = useState(false);
  
  // Security state
  const [security, setSecurity] = useState<SecurityStatus | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  
  // TOTP setup modal
  const [totpModalVisible, setTotpModalVisible] = useState(false);
  const [totpSetup, setTotpSetup] = useState<TotpSetup | null>(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [setupStep, setSetupStep] = useState<'qr' | 'verify' | 'backup'>('qr');

  const fetchProfile = useCallback(async () => {
    try {
      // Get security status
      const securityRes = await api.get('/security/2fa/status').catch(() => null);
      setSecurity(securityRes || {
        totpEnabled: false,
        biometricEnabled: false,
        requireOnLogin: false,
      });

      // Set profile data from user
      setFirstName(user?.firstName || '');
      setLastName(user?.lastName || '');
      setAvatarBase64(user?.avatarUrl || null);
      setDescription(user?.description || '');
    } catch (error) {
      console.log('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const checkBiometricSupport = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      setBiometricAvailable(hasHardware && isEnrolled);
      
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('Face ID');
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType('Touch ID');
      } else {
        setBiometricType('Biometric');
      }
    } catch (error) {
      console.log('Biometric check error:', error);
    }
  };

  useEffect(() => {
    fetchProfile();
    checkBiometricSupport();
  }, [fetchProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  }, [fetchProfile]);

  // ============ Avatar ============
  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Помилка', 'Потрібен доступ до галереї');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setAvatarBase64(base64);
    }
  };

  // ============ Save Profile ============
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.put('/users/profile', {
        firstName,
        lastName,
        avatarUrl: avatarBase64,
        description,
      });

      setEditMode(false);
      Alert.alert('Успіх', 'Профіль оновлено');
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося зберегти');
    } finally {
      setSaving(false);
    }
  };

  // ============ TOTP Setup ============
  const handleSetupTotp = async () => {
    try {
      const res = await api.post('/security/2fa/totp/setup');
      setTotpSetup(res);
      setSetupStep('qr');
      setTotpVerifyCode('');
      setBackupCodes(null);
      setTotpModalVisible(true);
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося налаштувати');
    }
  };

  const handleVerifyTotp = async () => {
    if (totpVerifyCode.length !== 6) {
      Alert.alert('Помилка', 'Введіть 6-значний код');
      return;
    }

    try {
      const res = await api.post('/security/2fa/totp/verify', { token: totpVerifyCode });
      setBackupCodes(res.backupCodes);
      setSetupStep('backup');
      
      // Refresh security status
      const securityRes = await api.get('/security/2fa/status');
      setSecurity(securityRes);
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Невірний код');
    }
  };

  const handleDisableTotp = async () => {
    Alert.prompt(
      'Вимкнути Google Authenticator',
      'Введіть код з Google Authenticator для підтвердження:',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Вимкнути',
          style: 'destructive',
          onPress: async (token) => {
            if (!token || token.length < 6) {
              Alert.alert('Помилка', 'Введіть код');
              return;
            }
            try {
              await api.delete('/security/2fa/totp', { data: { token } });
              Alert.alert('Успіх', 'Google Authenticator вимкнено');
              const securityRes = await api.get('/security/2fa/status');
              setSecurity(securityRes);
            } catch (error: any) {
              Alert.alert('Помилка', error.message || 'Невірний код');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  // ============ Biometric ============
  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
      // Enable biometric
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Налаштувати ${biometricType}`,
        cancelLabel: 'Скасувати',
      });

      if (result.success) {
        try {
          await api.post('/security/2fa/biometric/enable');
          setSecurity(prev => prev ? { ...prev, biometricEnabled: true } : null);
          Alert.alert('Успіх', `${biometricType} увімкнено`);
        } catch (error: any) {
          Alert.alert('Помилка', error.message || 'Не вдалося увімкнути');
        }
      }
    } else {
      // Disable biometric
      Alert.alert(
        `Вимкнути ${biometricType}`,
        `Ви впевнені, що хочете вимкнути ${biometricType}?`,
        [
          { text: 'Скасувати', style: 'cancel' },
          {
            text: 'Вимкнути',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.delete('/security/2fa/biometric');
                setSecurity(prev => prev ? { ...prev, biometricEnabled: false } : null);
              } catch (error: any) {
                Alert.alert('Помилка', error.message || 'Не вдалося вимкнути');
              }
            },
          },
        ]
      );
    }
  };

  // ============ Logout ============
  const handleLogout = () => {
    Alert.alert(
      'Вихід',
      'Ви впевнені, що хочете вийти?',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Вийти',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/');
            } catch (e) {
              router.replace('/');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0F0F10" />
        </Pressable>
        <Text style={styles.headerTitle}>Профіль</Text>
        {editMode ? (
          <Pressable onPress={handleSaveProfile} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#7C3AED" />
            ) : (
              <Text style={styles.saveButton}>Зберегти</Text>
            )}
          </Pressable>
        ) : (
          <Pressable onPress={() => setEditMode(true)}>
            <Ionicons name="pencil" size={22} color="#7C3AED" />
          </Pressable>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />
        }
      >
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <Pressable onPress={editMode ? handlePickAvatar : undefined} style={styles.avatarWrapper}>
            {avatarBase64 ? (
              <Image source={{ uri: avatarBase64 }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>
                  {(firstName?.[0] || 'A')}{(lastName?.[0] || '')}
                </Text>
              </View>
            )}
            {editMode && (
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            )}
          </Pressable>
          
          {editMode ? (
            <View style={styles.nameInputs}>
              <TextInput
                style={styles.nameInput}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Ім'я"
                placeholderTextColor="#9CA3AF"
              />
              <TextInput
                style={styles.nameInput}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Прізвище"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          ) : (
            <>
              <Text style={styles.profileName}>{firstName} {lastName}</Text>
              <Text style={styles.profileRole}>Адміністратор</Text>
            </>
          )}
        </View>

        {/* Description Section */}
        {editMode && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Про себе</Text>
            <TextInput
              style={styles.descriptionInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Коротко про себе..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
            />
          </View>
        )}

        {/* Security Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark" size={20} color="#7C3AED" />
            <Text style={styles.sectionTitle}>Безпека</Text>
          </View>

          {/* Google Authenticator */}
          <View style={styles.securityItem}>
            <View style={styles.securityItemLeft}>
              <View style={[styles.securityIcon, { backgroundColor: '#3B82F620' }]}>
                <Ionicons name="key" size={20} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.securityItemTitle}>Google Authenticator</Text>
                <Text style={styles.securityItemDesc}>
                  {security?.totpEnabled ? 'Увімкнено' : 'Двофакторна автентифікація'}
                </Text>
              </View>
            </View>
            {security?.totpEnabled ? (
              <Pressable style={styles.securityAction} onPress={handleDisableTotp}>
                <Text style={[styles.securityActionText, { color: '#EF4444' }]}>Вимкнути</Text>
              </Pressable>
            ) : (
              <Pressable style={[styles.securityAction, { backgroundColor: '#7C3AED' }]} onPress={handleSetupTotp}>
                <Text style={[styles.securityActionText, { color: '#fff' }]}>Налаштувати</Text>
              </Pressable>
            )}
          </View>

          {/* Biometric */}
          {biometricAvailable && (
            <View style={styles.securityItem}>
              <View style={styles.securityItemLeft}>
                <View style={[styles.securityIcon, { backgroundColor: '#22C55E20' }]}>
                  <Ionicons name="finger-print" size={20} color="#22C55E" />
                </View>
                <View>
                  <Text style={styles.securityItemTitle}>{biometricType}</Text>
                  <Text style={styles.securityItemDesc}>
                    {security?.biometricEnabled ? 'Увімкнено' : 'Швидкий вхід'}
                  </Text>
                </View>
              </View>
              <Switch
                value={security?.biometricEnabled || false}
                onValueChange={handleToggleBiometric}
                trackColor={{ false: '#D1D5DB', true: '#22C55E' }}
                thumbColor="#fff"
              />
            </View>
          )}

          {/* Security status */}
          {(security?.totpEnabled || security?.biometricEnabled) && (
            <View style={styles.securityStatus}>
              <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
              <Text style={styles.securityStatusText}>
                Акаунт захищено {security?.totpEnabled && security?.biometricEnabled ? 'двома методами' : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Акаунт</Text>

          <Pressable style={styles.menuItem} onPress={() => router.push('/admin/notifications' as any)}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="notifications-outline" size={22} color="#6B7280" />
              <Text style={styles.menuItemText}>Сповіщення</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </Pressable>

          <Pressable style={styles.menuItem} onPress={() => router.push('/admin/privacy' as any)}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="lock-closed-outline" size={22} color="#6B7280" />
              <Text style={styles.menuItemText}>Приватність</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </Pressable>
        </View>

        {/* Logout */}
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          <Text style={styles.logoutText}>Вийти</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* TOTP Setup Modal */}
      <Modal
        visible={totpModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setTotpModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {setupStep === 'qr' && 'Налаштування Google Authenticator'}
                {setupStep === 'verify' && 'Введіть код'}
                {setupStep === 'backup' && 'Резервні коди'}
              </Text>
              {setupStep !== 'backup' && (
                <Pressable onPress={() => setTotpModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </Pressable>
              )}
            </View>

            {setupStep === 'qr' && totpSetup && (
              <>
                <Text style={styles.modalText}>
                  1. Встановіть Google Authenticator на телефон{'\n'}
                  2. Відскануйте QR-код нижче
                </Text>
                <Image source={{ uri: totpSetup.qrCode }} style={styles.qrCode} />
                <Text style={styles.manualCode}>
                  Або введіть вручну:{'\n'}{totpSetup.manualEntry}
                </Text>
                <Pressable
                  style={styles.modalButton}
                  onPress={() => setSetupStep('verify')}
                >
                  <Text style={styles.modalButtonText}>Далі</Text>
                </Pressable>
              </>
            )}

            {setupStep === 'verify' && (
              <>
                <Text style={styles.modalText}>
                  Введіть 6-значний код з Google Authenticator:
                </Text>
                <TextInput
                  style={styles.codeInput}
                  value={totpVerifyCode}
                  onChangeText={setTotpVerifyCode}
                  placeholder="000000"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
                <Pressable
                  style={[styles.modalButton, totpVerifyCode.length !== 6 && styles.modalButtonDisabled]}
                  onPress={handleVerifyTotp}
                  disabled={totpVerifyCode.length !== 6}
                >
                  <Text style={styles.modalButtonText}>Підтвердити</Text>
                </Pressable>
              </>
            )}

            {setupStep === 'backup' && backupCodes && (
              <>
                <Text style={styles.modalText}>
                  Збережіть ці резервні коди в безпечному місці.{'\n'}
                  Кожен код можна використати один раз:
                </Text>
                <View style={styles.backupCodesGrid}>
                  {backupCodes.map((code, i) => (
                    <View key={i} style={styles.backupCode}>
                      <Text style={styles.backupCodeText}>{code}</Text>
                    </View>
                  ))}
                </View>
                <Pressable
                  style={styles.modalButton}
                  onPress={() => setTotpModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Готово</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F0F10' },
  saveButton: { fontSize: 16, fontWeight: '600', color: '#7C3AED' },
  // Content
  scrollView: { flex: 1 },
  content: { padding: 16 },
  // Avatar
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 36, fontWeight: '800', color: '#fff' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  nameInputs: { marginTop: 12, width: '100%', gap: 8 },
  nameInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0F0F10',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    textAlign: 'center',
  },
  profileName: { fontSize: 24, fontWeight: '700', color: '#0F0F10', marginTop: 12 },
  profileRole: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  // Section
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F0F10' },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#0F0F10',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  // Security
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  securityItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  securityIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  securityItemTitle: { fontSize: 15, fontWeight: '600', color: '#0F0F10' },
  securityItemDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  securityAction: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  securityActionText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  securityStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
  },
  securityStatusText: { fontSize: 13, color: '#166534', fontWeight: '500' },
  // Menu
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuItemText: { fontSize: 15, color: '#374151' },
  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#EF4444' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F0F10' },
  modalText: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 20 },
  qrCode: { width: 200, height: 200, alignSelf: 'center', marginBottom: 16 },
  manualCode: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  codeInput: {
    borderWidth: 2,
    borderColor: '#7C3AED',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 24,
    fontWeight: '700',
    color: '#0F0F10',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonDisabled: { backgroundColor: '#D1D5DB' },
  modalButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  backupCodesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  backupCode: {
    width: '48%',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  backupCodeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
