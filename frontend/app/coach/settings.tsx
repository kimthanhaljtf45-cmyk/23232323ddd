import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../src/lib/api';
import { useStore } from '../../src/store/useStore';

/**
 * COACH SETTINGS - НАЛАШТУВАННЯ ТРЕНЕРА
 * Світла тема відповідно до дизайну платформи
 */

interface NotificationSettings {
  pushEnabled: boolean;
  trainingReminders: boolean;
  studentAlerts: boolean;
  weeklyReport: boolean;
}

interface WorkDay {
  day: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

// Validate time format HH:MM (00:00 - 23:59)
const validateTime = (time: string): boolean => {
  const regex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  return regex.test(time);
};

// Format time input to HH:MM
const formatTimeInput = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length === 0) return '';
  if (digits.length === 1) return digits;
  if (digits.length === 2) {
    const hours = parseInt(digits);
    if (hours > 23) return '23';
    return digits;
  }
  if (digits.length === 3) {
    const hours = digits.slice(0, 2);
    const mins = digits.slice(2);
    const h = parseInt(hours);
    if (h > 23) return `23:${mins}`;
    return `${hours}:${mins}`;
  }
  if (digits.length >= 4) {
    let hours = digits.slice(0, 2);
    let mins = digits.slice(2, 4);
    
    const h = parseInt(hours);
    const m = parseInt(mins);
    
    if (h > 23) hours = '23';
    if (m > 59) mins = '59';
    
    return `${hours}:${mins}`;
  }
  return value;
};

export default function CoachSettingsScreen() {
  const router = useRouter();
  const { user, setUser, logout } = useStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile data
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Notification settings
  const [notifications, setNotifications] = useState<NotificationSettings>({
    pushEnabled: true,
    trainingReminders: true,
    studentAlerts: true,
    weeklyReport: true,
  });

  // Work schedule
  const [schedule, setSchedule] = useState<WorkDay[]>([
    { day: 'Понеділок', enabled: true, startTime: '09:00', endTime: '18:00' },
    { day: 'Вівторок', enabled: true, startTime: '09:00', endTime: '18:00' },
    { day: 'Середа', enabled: true, startTime: '09:00', endTime: '18:00' },
    { day: 'Четвер', enabled: true, startTime: '09:00', endTime: '18:00' },
    { day: 'П\'ятниця', enabled: true, startTime: '09:00', endTime: '18:00' },
    { day: 'Субота', enabled: true, startTime: '10:00', endTime: '14:00' },
    { day: 'Неділя', enabled: true, startTime: '10:00', endTime: '14:00' },
  ]);

  // Modals
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [editScheduleModal, setEditScheduleModal] = useState(false);

  // Load settings
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);

      // Load profile
      const profile = await api.get('/coach/profile-full');
      console.log('Loaded profile:', profile);
      setFirstName(profile.firstName || '');
      setLastName(profile.lastName || '');
      setPhone(profile.phone || '');
      
      // Load avatar from profile
      if (profile.avatarUrl) {
        setAvatarUrl(profile.avatarUrl);
      }

      // Load notifications
      try {
        const notifSettings = await api.get('/coach/settings/notifications');
        if (notifSettings) {
          setNotifications({
            pushEnabled: notifSettings.pushEnabled ?? true,
            trainingReminders: notifSettings.trainingReminders ?? true,
            studentAlerts: notifSettings.studentAlerts ?? true,
            weeklyReport: notifSettings.weeklyReport ?? true,
          });
        }
      } catch (e) {
        console.log('Using default notification settings');
      }

      // Load schedule
      try {
        const scheduleData = await api.get('/coach/settings/schedule');
        if (scheduleData && Array.isArray(scheduleData) && scheduleData.length > 0) {
          setSchedule(scheduleData);
        }
      } catch (e) {
        console.log('Using default schedule');
      }
    } catch (error) {
      console.log('Settings load error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Pick avatar image with proper permission handling
  const pickAvatar = async () => {
    try {
      // First check current permission status
      const { status: existingStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
      
      let finalStatus = existingStatus;
      
      // If not granted, request permission
      if (existingStatus !== 'granted') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        finalStatus = status;
      }
      
      // Check if permission was granted
      if (finalStatus !== 'granted') {
        Alert.alert(
          'Доступ заборонено',
          'Для вибору фото потрібен доступ до галереї. Надайте дозвіл у налаштуваннях телефону.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.3, // Slightly higher quality for better image
        base64: true,
        exif: false,
      });

      // User cancelled
      if (result.canceled) {
        return;
      }

      // Check if we have the image data
      if (!result.assets || !result.assets[0]) {
        Alert.alert('Помилка', 'Не вдалося отримати зображення');
        return;
      }

      const asset = result.assets[0];
      
      // Check if base64 is available
      if (!asset.base64) {
        Alert.alert('Помилка', 'Не вдалося отримати дані зображення');
        return;
      }

      const mimeType = asset.mimeType || 'image/jpeg';
      const base64Image = `data:${mimeType};base64,${asset.base64}`;
      
      // Check size
      const sizeKB = Math.round(base64Image.length / 1024);
      console.log('Avatar size:', sizeKB, 'KB');
      
      if (sizeKB > 1000) {
        Alert.alert(
          'Завелике зображення',
          `Розмір: ${sizeKB}KB. Максимум 1MB. Спробуйте вибрати менше зображення або обріжте його.`,
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Show loading and save
      setSaving(true);
      
      try {
        console.log('Sending avatar to server...');
        const response = await api.put('/coach/settings/avatar', { 
          avatarBase64: base64Image 
        });
        console.log('Avatar save response:', response);
        
        if (response && response.success) {
          // Update local state
          setAvatarUrl(response.avatarUrl || base64Image);
          
          // Update global store
          if (user) {
            setUser({ ...user, avatarUrl: response.avatarUrl || base64Image });
          }
          
          Alert.alert('Успішно', 'Фото профілю оновлено');
        } else {
          throw new Error(response?.message || 'Невідома помилка');
        }
      } catch (apiError: any) {
        console.log('Avatar API error:', apiError);
        
        // Parse error message
        let errorMessage = 'Не вдалося зберегти фото';
        
        if (apiError?.message) {
          if (apiError.message.includes('Network') || apiError.message.includes('network')) {
            errorMessage = 'Помилка мережі. Перевірте інтернет-з\'єднання.';
          } else if (apiError.message.includes('413') || apiError.message.includes('too large')) {
            errorMessage = 'Зображення занадто велике. Спробуйте менше.';
          } else {
            errorMessage = apiError.message;
          }
        }
        
        Alert.alert('Помилка', errorMessage);
      } finally {
        setSaving(false);
      }
    } catch (error: any) {
      console.log('Avatar pick error:', error);
      Alert.alert('Помилка', 'Не вдалося вибрати фото. Спробуйте ще раз.');
    }
  };

  // Save profile
  const saveProfile = async () => {
    if (!firstName.trim()) {
      Alert.alert('Помилка', 'Введіть ім\'я');
      return;
    }
    
    try {
      setSaving(true);
      await api.put('/coach/settings/profile', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
      });
      setEditProfileModal(false);
      Alert.alert('Успішно', 'Профіль оновлено');
      
      if (user) {
        setUser({ ...user, firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() });
      }
    } catch (error) {
      Alert.alert('Помилка', 'Не вдалося оновити профіль');
    } finally {
      setSaving(false);
    }
  };

  // Save notification settings - with immediate API call
  const toggleNotification = async (key: keyof NotificationSettings) => {
    const newValue = !notifications[key];
    
    // If disabling push, disable all
    let newSettings = { ...notifications };
    
    if (key === 'pushEnabled' && !newValue) {
      newSettings = {
        pushEnabled: false,
        trainingReminders: false,
        studentAlerts: false,
        weeklyReport: false,
      };
    } else {
      newSettings[key] = newValue;
    }
    
    // Update UI immediately
    setNotifications(newSettings);
    
    // Save to backend
    try {
      await api.put('/coach/settings/notifications', newSettings);
      console.log('Notifications saved:', newSettings);
    } catch (error) {
      console.log('Error saving notifications:', error);
      // Revert on error
      setNotifications(notifications);
      Alert.alert('Помилка', 'Не вдалося зберегти налаштування');
    }
  };

  // Validate schedule before saving
  const validateSchedule = (): boolean => {
    for (const day of schedule) {
      if (day.enabled) {
        if (!validateTime(day.startTime)) {
          Alert.alert('Помилка', `Невірний час початку для ${day.day}. Формат: ГГ:ХХ`);
          return false;
        }
        if (!validateTime(day.endTime)) {
          Alert.alert('Помилка', `Невірний час закінчення для ${day.day}. Формат: ГГ:ХХ`);
          return false;
        }
        
        const [startH, startM] = day.startTime.split(':').map(Number);
        const [endH, endM] = day.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        
        if (endMinutes <= startMinutes) {
          Alert.alert('Помилка', `${day.day}: час закінчення має бути пізніше за час початку`);
          return false;
        }
      }
    }
    return true;
  };

  // Save schedule
  const saveSchedule = async () => {
    if (!validateSchedule()) return;
    
    try {
      setSaving(true);
      await api.put('/coach/settings/schedule', { schedule });
      setEditScheduleModal(false);
      Alert.alert('Успішно', 'Графік оновлено');
    } catch (error) {
      Alert.alert('Помилка', 'Не вдалося зберегти графік');
    } finally {
      setSaving(false);
    }
  };

  // Toggle day
  const toggleDay = (dayIndex: number) => {
    const newSchedule = [...schedule];
    newSchedule[dayIndex].enabled = !newSchedule[dayIndex].enabled;
    setSchedule(newSchedule);
  };

  // Update day time
  const updateDayTime = (dayIndex: number, field: 'startTime' | 'endTime', value: string) => {
    const formatted = formatTimeInput(value);
    const newSchedule = [...schedule];
    newSchedule[dayIndex][field] = formatted;
    setSchedule(newSchedule);
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

  // Navigate back
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
      
      {/* Header - світла тема */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.headerBackBtn}>
          <Ionicons name="chevron-back" size={24} color="#0F0F10" />
        </Pressable>
        <Text style={styles.headerTitle}>Налаштування</Text>
        <View style={styles.headerBackBtn} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* AVATAR SECTION */}
        <View style={styles.avatarSection}>
          <Pressable onPress={pickAvatar} style={styles.avatarContainer} disabled={saving}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
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
          <Text style={styles.avatarHint}>Натисніть, щоб змінити фото</Text>
        </View>

        {/* PROFILE SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Профіль</Text>
          <Pressable style={styles.settingItem} onPress={() => setEditProfileModal(true)}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="person-outline" size={20} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.settingLabel}>Ім'я та прізвище</Text>
                <Text style={styles.settingValue}>{firstName} {lastName}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>

          <Pressable style={styles.settingItem} onPress={() => setEditProfileModal(true)}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="call-outline" size={20} color="#10B981" />
              </View>
              <View>
                <Text style={styles.settingLabel}>Номер телефону</Text>
                <Text style={styles.settingValue}>{phone || 'Не вказано'}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* NOTIFICATIONS SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Сповіщення</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="notifications-outline" size={20} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Push-сповіщення</Text>
                <Text style={styles.settingHint}>Всі сповіщення</Text>
              </View>
            </View>
            <Switch
              value={notifications.pushEnabled}
              onValueChange={() => toggleNotification('pushEnabled')}
              trackColor={{ false: '#E5E7EB', true: '#22C55E' }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.settingItem, !notifications.pushEnabled && styles.settingItemDisabled]}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="time-outline" size={20} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, !notifications.pushEnabled && styles.settingLabelDisabled]}>
                  Нагадування про тренування
                </Text>
                <Text style={styles.settingHint}>За 30 хв до початку</Text>
              </View>
            </View>
            <Switch
              value={notifications.trainingReminders}
              onValueChange={() => toggleNotification('trainingReminders')}
              trackColor={{ false: '#E5E7EB', true: '#22C55E' }}
              thumbColor="#fff"
              disabled={!notifications.pushEnabled}
            />
          </View>

          <View style={[styles.settingItem, !notifications.pushEnabled && styles.settingItemDisabled]}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="alert-circle-outline" size={20} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, !notifications.pushEnabled && styles.settingLabelDisabled]}>
                  Сповіщення про учнів
                </Text>
                <Text style={styles.settingHint}>Ризики, пропуски</Text>
              </View>
            </View>
            <Switch
              value={notifications.studentAlerts}
              onValueChange={() => toggleNotification('studentAlerts')}
              trackColor={{ false: '#E5E7EB', true: '#22C55E' }}
              thumbColor="#fff"
              disabled={!notifications.pushEnabled}
            />
          </View>

          <View style={[styles.settingItem, !notifications.pushEnabled && styles.settingItemDisabled]}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#E0E7FF' }]}>
                <Ionicons name="stats-chart-outline" size={20} color="#6366F1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, !notifications.pushEnabled && styles.settingLabelDisabled]}>
                  Тижневий звіт
                </Text>
                <Text style={styles.settingHint}>Кожної неділі</Text>
              </View>
            </View>
            <Switch
              value={notifications.weeklyReport}
              onValueChange={() => toggleNotification('weeklyReport')}
              trackColor={{ false: '#E5E7EB', true: '#22C55E' }}
              thumbColor="#fff"
              disabled={!notifications.pushEnabled}
            />
          </View>
        </View>

        {/* WORK SCHEDULE SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Робочий графік</Text>
            <Pressable onPress={() => setEditScheduleModal(true)}>
              <Text style={styles.editBtn}>Редагувати</Text>
            </Pressable>
          </View>

          {schedule.map((day) => (
            <View key={day.day} style={[styles.scheduleItem, !day.enabled && styles.scheduleItemDisabled]}>
              <Text style={[styles.scheduleDay, !day.enabled && styles.scheduleDayDisabled]}>
                {day.day}
              </Text>
              <Text style={[styles.scheduleTime, !day.enabled && styles.scheduleTimeDisabled]}>
                {day.enabled ? `${day.startTime} - ${day.endTime}` : 'Вихідний'}
              </Text>
            </View>
          ))}
        </View>

        {/* LOGOUT - простий текст без великої плашки */}
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Вийти з акаунту</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* EDIT PROFILE MODAL */}
      <Modal visible={editProfileModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Редагувати профіль</Text>
              <Pressable onPress={() => setEditProfileModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ім'я *</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Введіть ім'я"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Прізвище</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Введіть прізвище"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Номер телефону</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+380"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
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

      {/* EDIT SCHEDULE MODAL */}
      <Modal visible={editScheduleModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Робочий графік</Text>
              <Pressable onPress={() => setEditScheduleModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </Pressable>
            </View>
            
            <Text style={styles.scheduleHint}>
              Формат часу: ГГ:ХХ (наприклад 09:00)
            </Text>

            <ScrollView style={{ maxHeight: 400 }}>
              {schedule.map((day, index) => (
                <View key={day.day} style={styles.scheduleEditItem}>
                  <View style={styles.scheduleEditRow}>
                    <Text style={styles.scheduleEditDay}>{day.day}</Text>
                    <Switch
                      value={day.enabled}
                      onValueChange={() => toggleDay(index)}
                      trackColor={{ false: '#E5E7EB', true: '#22C55E' }}
                      thumbColor="#fff"
                    />
                  </View>
                  {day.enabled && (
                    <View style={styles.scheduleTimeRow}>
                      <View style={styles.timeInputGroup}>
                        <Text style={styles.timeLabel}>Початок</Text>
                        <TextInput
                          style={[
                            styles.timeInput,
                            !validateTime(day.startTime) && day.startTime.length >= 5 && styles.timeInputError
                          ]}
                          value={day.startTime}
                          onChangeText={(v) => updateDayTime(index, 'startTime', v)}
                          placeholder="09:00"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="numeric"
                          maxLength={5}
                        />
                      </View>
                      <View style={styles.timeInputGroup}>
                        <Text style={styles.timeLabel}>Кінець</Text>
                        <TextInput
                          style={[
                            styles.timeInput,
                            !validateTime(day.endTime) && day.endTime.length >= 5 && styles.timeInputError
                          ]}
                          value={day.endTime}
                          onChangeText={(v) => updateDayTime(index, 'endTime', v)}
                          placeholder="18:00"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="numeric"
                          maxLength={5}
                        />
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>

            <Pressable 
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={saveSchedule}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Зберегти графік</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // СВІТЛА ТЕМА
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Header - світлий
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

  // Avatar
  avatarSection: { alignItems: 'center', paddingVertical: 24, backgroundColor: '#FFFFFF' },
  avatarContainer: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E30613',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarHint: { marginTop: 8, fontSize: 13, color: '#6B7280' },

  // Sections
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F0F10', marginBottom: 12 },
  editBtn: { fontSize: 14, fontWeight: '600', color: '#E30613' },

  // Setting items
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingItemDisabled: { opacity: 0.5 },
  settingLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingLabel: { fontSize: 15, fontWeight: '600', color: '#0F0F10' },
  settingLabelDisabled: { color: '#9CA3AF' },
  settingValue: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  settingHint: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  // Schedule
  scheduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  scheduleItemDisabled: { opacity: 0.5 },
  scheduleDay: { fontSize: 15, color: '#0F0F10', fontWeight: '500' },
  scheduleDayDisabled: { color: '#9CA3AF' },
  scheduleTime: { fontSize: 15, color: '#0F0F10' },
  scheduleTimeDisabled: { color: '#9CA3AF' },
  
  scheduleHint: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
  },

  // Logout - простий стиль без великої плашки
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 12,
    gap: 8,
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },

  // Modal
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
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0F0F10' },

  // Inputs
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#0F0F10',
  },

  // Schedule Edit
  scheduleEditItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  scheduleEditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleEditDay: { fontSize: 16, fontWeight: '600', color: '#0F0F10' },
  scheduleTimeRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  timeInputGroup: { flex: 1 },
  timeLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  timeInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#0F0F10',
    textAlign: 'center',
  },
  timeInputError: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },

  // Save Button
  saveButton: {
    backgroundColor: '#E30613',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonDisabled: { backgroundColor: '#FECACA' },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
