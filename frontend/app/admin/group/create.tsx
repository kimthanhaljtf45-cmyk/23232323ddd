import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';

/**
 * CREATE GROUP - Створення нової групи
 * 
 * Функції:
 * - Вибір тренера
 * - Вибір локації
 * - Тип програми
 * - Розклад
 * - Ціна
 */

interface Coach {
  id: string;
  name: string;
  phone: string;
}

interface Location {
  id: string;
  name: string;
  address: string;
  district?: string;
}

const PROGRAM_TYPES = [
  { value: 'KIDS', label: 'Дитяча (4-17)' },
  { value: 'SPECIAL', label: 'Особлива програма' },
  { value: 'SELF_DEFENSE', label: 'Самооборона' },
  { value: 'MENTORSHIP', label: 'Наставництво' },
];

const DAYS = [
  { value: 'MON', label: 'Пн' },
  { value: 'TUE', label: 'Вт' },
  { value: 'WED', label: 'Ср' },
  { value: 'THU', label: 'Чт' },
  { value: 'FRI', label: 'Пт' },
  { value: 'SAT', label: 'Сб' },
  { value: 'SUN', label: 'Нд' },
];

export default function CreateGroupScreen() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  
  // Form state
  const [name, setName] = useState('');
  const [selectedCoach, setSelectedCoach] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [programType, setProgramType] = useState('KIDS');
  const [ageRange, setAgeRange] = useState('4-12');
  const [capacity, setCapacity] = useState('15');
  const [monthlyPrice, setMonthlyPrice] = useState('2000');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState<{ day: string; time: string }[]>([]);
  
  // UI state
  const [showCoachPicker, setShowCoachPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showProgramPicker, setShowProgramPicker] = useState(false);

  // Load coaches and locations
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [coachesRes, locationsRes] = await Promise.all([
        api.get('/admin/coaches'),
        api.get('/admin/locations'),
      ]);
      setCoaches(coachesRes || []);
      setLocations(locationsRes || []);
    } catch (error) {
      console.log('Load data error:', error);
      // Demo data fallback
      setCoaches([
        { id: '1', name: 'Олександр Петренко', phone: '+380501234568' },
        { id: '2', name: 'Марія Іваненко', phone: '+380991001003' },
      ]);
      setLocations([
        { id: '1', name: 'Позняки', address: 'вул. Анни Ахматової, 14Д', district: 'Дарницький' },
        { id: '2', name: 'Соломянка', address: 'вул. Солом\'янська, 15', district: 'Соломянський' },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle day in schedule
  const toggleDay = (day: string) => {
    const existing = schedule.find(s => s.day === day);
    if (existing) {
      setSchedule(schedule.filter(s => s.day !== day));
    } else {
      setSchedule([...schedule, { day, time: '18:00' }]);
    }
  };

  // Update time for day
  const updateTime = (day: string, time: string) => {
    setSchedule(schedule.map(s => s.day === day ? { ...s, time } : s));
  };

  // Validate form
  const isValid = () => {
    return name.trim() && selectedCoach && parseInt(capacity) > 0 && parseInt(monthlyPrice) > 0;
  };

  // Create group
  const handleCreate = async () => {
    if (!isValid()) {
      Alert.alert('Помилка', 'Заповніть всі обов\'язкові поля');
      return;
    }

    try {
      setSaving(true);
      
      await api.post('/admin/groups', {
        name: name.trim(),
        coachId: selectedCoach,
        locationId: selectedLocation || undefined,
        programType,
        ageRange,
        capacity: parseInt(capacity),
        monthlyPrice: parseInt(monthlyPrice),
        schedule,
        description: description.trim() || undefined,
      });

      Alert.alert('Успішно', 'Групу створено!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('Помилка', error?.response?.data?.message || 'Не вдалося створити групу');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const getSelectedCoachName = () => {
    const coach = coaches.find(c => c.id === selectedCoach);
    return coach?.name || 'Оберіть тренера';
  };

  const getSelectedLocationName = () => {
    const location = locations.find(l => l.id === selectedLocation);
    return location?.name || 'Оберіть локацію (опціонально)';
  };

  const getSelectedProgramLabel = () => {
    return PROGRAM_TYPES.find(p => p.value === programType)?.label || programType;
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
        <Pressable onPress={handleBack} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#0F0F10" />
        </Pressable>
        <Text style={styles.headerTitle}>Нова група</Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Назва групи *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Наприклад: Діти 18:00"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Coach Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Тренер *</Text>
            <Pressable 
              style={styles.picker} 
              onPress={() => setShowCoachPicker(!showCoachPicker)}
            >
              <Text style={[styles.pickerText, !selectedCoach && styles.pickerPlaceholder]}>
                {getSelectedCoachName()}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#6B7280" />
            </Pressable>
            {showCoachPicker && (
              <View style={styles.pickerDropdown}>
                {coaches.map(coach => (
                  <Pressable
                    key={coach.id}
                    style={[styles.pickerOption, selectedCoach === coach.id && styles.pickerOptionSelected]}
                    onPress={() => {
                      setSelectedCoach(coach.id);
                      setShowCoachPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, selectedCoach === coach.id && styles.pickerOptionTextSelected]}>
                      {coach.name}
                    </Text>
                    <Text style={styles.pickerOptionHint}>{coach.phone}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Location Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Локація</Text>
            <Pressable 
              style={styles.picker} 
              onPress={() => setShowLocationPicker(!showLocationPicker)}
            >
              <Text style={[styles.pickerText, !selectedLocation && styles.pickerPlaceholder]}>
                {getSelectedLocationName()}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#6B7280" />
            </Pressable>
            {showLocationPicker && (
              <View style={styles.pickerDropdown}>
                <Pressable
                  style={[styles.pickerOption, !selectedLocation && styles.pickerOptionSelected]}
                  onPress={() => {
                    setSelectedLocation('');
                    setShowLocationPicker(false);
                  }}
                >
                  <Text style={styles.pickerOptionText}>Без прив'язки</Text>
                </Pressable>
                {locations.map(loc => (
                  <Pressable
                    key={loc.id}
                    style={[styles.pickerOption, selectedLocation === loc.id && styles.pickerOptionSelected]}
                    onPress={() => {
                      setSelectedLocation(loc.id);
                      setShowLocationPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, selectedLocation === loc.id && styles.pickerOptionTextSelected]}>
                      {loc.name}
                    </Text>
                    <Text style={styles.pickerOptionHint}>{loc.address}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Program Type */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Тип програми</Text>
            <Pressable 
              style={styles.picker} 
              onPress={() => setShowProgramPicker(!showProgramPicker)}
            >
              <Text style={styles.pickerText}>{getSelectedProgramLabel()}</Text>
              <Ionicons name="chevron-down" size={20} color="#6B7280" />
            </Pressable>
            {showProgramPicker && (
              <View style={styles.pickerDropdown}>
                {PROGRAM_TYPES.map(p => (
                  <Pressable
                    key={p.value}
                    style={[styles.pickerOption, programType === p.value && styles.pickerOptionSelected]}
                    onPress={() => {
                      setProgramType(p.value);
                      setShowProgramPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, programType === p.value && styles.pickerOptionTextSelected]}>
                      {p.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Age Range */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Вікова група</Text>
            <TextInput
              style={styles.input}
              value={ageRange}
              onChangeText={setAgeRange}
              placeholder="4-12"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Capacity & Price Row */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Місткість *</Text>
              <TextInput
                style={styles.input}
                value={capacity}
                onChangeText={setCapacity}
                placeholder="15"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Ціна/міс (₴) *</Text>
              <TextInput
                style={styles.input}
                value={monthlyPrice}
                onChangeText={setMonthlyPrice}
                placeholder="2000"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* Schedule */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Розклад</Text>
            <View style={styles.daysRow}>
              {DAYS.map(day => {
                const isSelected = schedule.some(s => s.day === day.value);
                return (
                  <Pressable
                    key={day.value}
                    style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                    onPress={() => toggleDay(day.value)}
                  >
                    <Text style={[styles.dayChipText, isSelected && styles.dayChipTextSelected]}>
                      {day.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {schedule.length > 0 && (
              <View style={styles.timesContainer}>
                {schedule.map(s => (
                  <View key={s.day} style={styles.timeRow}>
                    <Text style={styles.timeLabel}>
                      {DAYS.find(d => d.value === s.day)?.label}:
                    </Text>
                    <TextInput
                      style={styles.timeInput}
                      value={s.time}
                      onChangeText={(time) => updateTime(s.day, time)}
                      placeholder="18:00"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Опис</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Додаткова інформація про групу..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Create Button */}
      <View style={styles.footer}>
        <Pressable 
          style={[styles.createButton, (!isValid() || saving) && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={!isValid() || saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.createButtonText}>Створити групу</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
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
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F0F10' },
  
  scrollView: { flex: 1, padding: 16 },
  
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#0F0F10',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textArea: { height: 100 },
  
  row: { flexDirection: 'row' },
  
  picker: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pickerText: { fontSize: 16, color: '#0F0F10' },
  pickerPlaceholder: { color: '#9CA3AF' },
  
  pickerDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  pickerOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerOptionSelected: { backgroundColor: '#F3E8FF' },
  pickerOptionText: { fontSize: 15, color: '#0F0F10' },
  pickerOptionTextSelected: { color: '#7C3AED', fontWeight: '600' },
  pickerOptionHint: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dayChipSelected: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  dayChipText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  dayChipTextSelected: { color: '#FFFFFF' },
  
  timesContainer: { marginTop: 16 },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeLabel: { fontSize: 14, fontWeight: '600', color: '#374151', width: 40 },
  timeInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#0F0F10',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginLeft: 12,
  },
  
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  createButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonDisabled: { backgroundColor: '#D8B4FE' },
  createButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
