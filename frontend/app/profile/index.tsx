import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../src/lib/api';
import { useStore } from '../../src/store/useStore';

/**
 * UNIVERSAL PROFILE SCREEN
 * Працює для всіх ролей: PARENT, STUDENT, COACH, ADMIN
 * 
 * Функції:
 * - Зміна аватара
 * - Редагування профілю (ім'я, опис)
 * - Посилання на безпеку
 * - Посилання на налаштування
 * - Вихід
 */

interface ProfileData {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  role: string;
  avatarUrl?: string;
  bio?: string;
  createdAt?: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, setUser, logout } = useStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  
  // Edit profile modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editBio, setEditBio] = useState('');

  // Load profile
  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/me');
      setProfile(response);
      setEditFirstName(response.firstName || '');
      setEditLastName(response.lastName || '');
      setEditBio(response.bio || '');
    } catch (error) {
      console.log('Profile load error:', error);
      // Use store data as fallback
      if (user) {
        setProfile({
          id: user.id,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          phone: user.phone || '',
          role: user.role,
          avatarUrl: user.avatarUrl,
        });
        setEditFirstName(user.firstName || '');
        setEditLastName(user.lastName || '');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, [loadProfile]);

  // Pick avatar
  const pickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Доступ заборонено',
          'Для вибору фото потрібен доступ до галереї.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.3,
        base64: true,
        exif: false,
      });

      if (result.canceled || !result.assets?.[0]?.base64) {
        return;
      }

      const asset = result.assets[0];
      const mimeType = asset.mimeType || 'image/jpeg';
      const base64Image = `data:${mimeType};base64,${asset.base64}`;
      
      const sizeKB = Math.round(base64Image.length / 1024);
      if (sizeKB > 1000) {
        Alert.alert('Завелике зображення', 'Максимум 1MB. Спробуйте менше зображення.');
        return;
      }
      
      setSaving(true);
      
      try {
        const response = await api.patch('/users/me', { avatarUrl: base64Image });
        
        setProfile(prev => prev ? { ...prev, avatarUrl: base64Image } : prev);
        
        if (user) {
          setUser({ ...user, avatarUrl: base64Image });
        }
        
        Alert.alert('Успішно', 'Фото профілю оновлено');
      } catch (apiError: any) {
        console.log('Avatar API error:', apiError);
        Alert.alert('Помилка', 'Не вдалося зберегти фото');
      } finally {
        setSaving(false);
      }
    } catch (error) {
      console.log('Avatar pick error:', error);
      Alert.alert('Помилка', 'Не вдалося вибрати фото');
    }
  };

  // Save profile
  const saveProfile = async () => {
    if (!editFirstName.trim()) {
      Alert.alert('Помилка', "Введіть ім'я");
      return;
    }
    
    try {
      setSaving(true);
      const response = await api.patch('/users/me', {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        bio: editBio.trim(),
      });
      
      setProfile(prev => prev ? {
        ...prev,
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        bio: editBio.trim(),
      } : prev);
      
      if (user) {
        setUser({
          ...user,
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
        });
      }
      
      setShowEditModal(false);
      Alert.alert('Успішно', 'Профіль оновлено');
    } catch (error) {
      Alert.alert('Помилка', 'Не вдалося оновити профіль');
    } finally {
      setSaving(false);
    }
  };

  // Handle logout
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

  const handleBack = () => {
    router.back();
  };

  const getRoleLabel = (role: string): string => {
    switch (role) {
      case 'ADMIN': return 'Адміністратор';
      case 'COACH': return 'Тренер';
      case 'PARENT': return 'Батьки';
      case 'STUDENT': return 'Учень';
      default: return role;
    }
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
        <Text style={styles.headerTitle}>Профіль</Text>
        <Pressable onPress={() => setShowEditModal(true)} style={styles.headerBackBtn}>
          <Ionicons name="create-outline" size={24} color="#E30613" />
        </Pressable>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E30613" />
        }
      >
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <Pressable onPress={pickAvatar} style={styles.avatarContainer} disabled={saving}>
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={48} color="#9CA3AF" />
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={16} color="#fff" />
              )}
            </View>
          </Pressable>
          
          <Text style={styles.profileName}>
            {profile?.firstName} {profile?.lastName}
          </Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{getRoleLabel(profile?.role || '')}</Text>
          </View>
          
          {profile?.bio && (
            <Text style={styles.profileBio}>{profile.bio}</Text>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Інформація</Text>
          
          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="call-outline" size={20} color="#3B82F6" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Телефон</Text>
              <Text style={styles.infoValue}>{profile?.phone || 'Не вказано'}</Text>
            </View>
          </View>
          
          {profile?.email && (
            <View style={styles.infoItem}>
              <View style={[styles.infoIcon, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="mail-outline" size={20} color="#22C55E" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{profile.email}</Text>
              </View>
            </View>
          )}
          
          {profile?.createdAt && (
            <View style={styles.infoItem}>
              <View style={[styles.infoIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="calendar-outline" size={20} color="#F59E0B" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>З нами з</Text>
                <Text style={styles.infoValue}>
                  {new Date(profile.createdAt).toLocaleDateString('uk')}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Налаштування</Text>
          
          <Pressable 
            style={styles.menuItem}
            onPress={() => router.push('/profile/security')}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#22C55E" />
              </View>
              <View>
                <Text style={styles.menuItemLabel}>Безпека</Text>
                <Text style={styles.menuItemHint}>2FA, Face ID, Google Authenticator</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
          
          <Pressable 
            style={styles.menuItem}
            onPress={() => router.push('/profile/referral')}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: '#E0E7FF' }]}>
                <Ionicons name="gift-outline" size={20} color="#6366F1" />
              </View>
              <View>
                <Text style={styles.menuItemLabel}>Запроси друга</Text>
                <Text style={styles.menuItemHint}>Отримай знижку за рекомендацію</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
          
          <Pressable 
            style={styles.menuItem}
            onPress={() => router.push('/notifications')}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="notifications-outline" size={20} color="#EF4444" />
              </View>
              <View>
                <Text style={styles.menuItemLabel}>Сповіщення</Text>
                <Text style={styles.menuItemHint}>Керування сповіщеннями</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* Logout */}
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Вийти з акаунту</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Редагувати профіль</Text>
              <Pressable onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ім'я *</Text>
              <TextInput
                style={styles.input}
                value={editFirstName}
                onChangeText={setEditFirstName}
                placeholder="Введіть ім'я"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Прізвище</Text>
              <TextInput
                style={styles.input}
                value={editLastName}
                onChangeText={setEditLastName}
                placeholder="Введіть прізвище"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Про себе</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Розкажіть про себе..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <Pressable 
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={saveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Зберегти</Text>
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

  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
  },
  avatarContainer: { position: 'relative' },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E30613',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F0F10',
    marginTop: 16,
  },
  roleBadge: {
    backgroundColor: '#E30613',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  profileBio: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
    paddingHorizontal: 32,
    textAlign: 'center',
    lineHeight: 20,
  },

  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F10',
    marginBottom: 16,
  },

  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 13, color: '#6B7280' },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#0F0F10', marginTop: 2 },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemLabel: { fontSize: 15, fontWeight: '600', color: '#0F0F10' },
  menuItemHint: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 12,
    gap: 8,
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },

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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0F0F10' },

  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#0F0F10',
  },
  textArea: {
    height: 100,
  },

  saveButton: {
    backgroundColor: '#E30613',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: { backgroundColor: '#FECACA' },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
