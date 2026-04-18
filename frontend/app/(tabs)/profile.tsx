import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';

export default function ProfileScreen() {
  const { user, logout } = useStore();
  const [editMode, setEditMode] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [notifications, setNotifications] = useState(true);
  const [trainingHistory, setTrainingHistory] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [historyRes, achRes] = await Promise.all([
        api.get('/schedule/upcoming').catch(() => []),
        api.get('/children').catch(() => []),
      ]);
      setTrainingHistory(Array.isArray(historyRes) ? historyRes.slice(0, 5) : []);
      setAchievements(Array.isArray(achRes) ? achRes.slice(0, 3) : []);
    } catch (e) { console.log('Profile data error:', e); }
  };

  const handleSave = async () => {
    try {
      await api.put('/users/me', { firstName, lastName, email });
      Alert.alert('Збережено', 'Дані оновлено');
      setEditMode(false);
    } catch (e) {
      Alert.alert('Помилка', 'Не вдалось зберегти');
    }
  };

  const handleLogout = () => {
    Alert.alert('Вихід', 'Ви впевнені?', [
      { text: 'Скасувати', style: 'cancel' },
      { text: 'Вийти', style: 'destructive', onPress: async () => {
        await logout();
        router.replace('/(auth)/welcome');
      }},
    ]);
  };

  const initials = `${(user?.firstName || 'У').charAt(0)}${(user?.lastName || '').charAt(0)}`;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Профіль</Text>
          <TouchableOpacity onPress={() => editMode ? handleSave() : setEditMode(true)} style={s.editBtn}>
            <Text style={s.editBtnText}>{editMode ? 'Зберегти' : 'Редагувати'}</Text>
          </TouchableOpacity>
        </View>

        {/* Avatar & Name */}
        <View style={s.avatarSection}>
          <TouchableOpacity style={s.avatar} activeOpacity={0.8}>
            <Text style={s.avatarText}>{initials}</Text>
            <View style={s.cameraIcon}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          {editMode ? (
            <View style={s.editFields}>
              <TextInput style={s.input} value={firstName} onChangeText={setFirstName} placeholder="Ім'я" placeholderTextColor="#9CA3AF" />
              <TextInput style={s.input} value={lastName} onChangeText={setLastName} placeholder="Прізвище" placeholderTextColor="#9CA3AF" />
            </View>
          ) : (
            <>
              <Text style={s.name}>{user?.firstName} {user?.lastName}</Text>
              <Text style={s.phone}>{user?.phone || '+380...'}</Text>
            </>
          )}
        </View>

        {/* Особисті дані */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Особисті дані</Text>
          <View style={s.card}>
            <InfoRow icon="person-outline" label="Ім'я" value={`${user?.firstName || ''} ${user?.lastName || ''}`} />
            <InfoRow icon="call-outline" label="Телефон" value={user?.phone || '—'} />
            <InfoRow icon="mail-outline" label="Email" value={user?.email || 'Не вказано'} editable={editMode} editValue={email} onEdit={setEmail} />
            <InfoRow icon="ribbon-outline" label="Роль" value={user?.role === 'STUDENT' ? 'Учень' : user?.role === 'PARENT' ? 'Батьки' : user?.role || '—'} last />
          </View>
        </View>

        {/* Історія тренувань */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Історія тренувань</Text>
          <View style={s.card}>
            {trainingHistory.length > 0 ? trainingHistory.map((t: any, i: number) => (
              <View key={i} style={[s.historyRow, i === trainingHistory.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={s.historyIcon}><Ionicons name="fitness-outline" size={18} color="#E30613" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.historyTitle}>{t.groupName || t.name || 'Тренування'}</Text>
                  <Text style={s.historyMeta}>{t.date || t.dayOfWeek || '—'} • {t.time || t.startTime || '—'}</Text>
                </View>
              </View>
            )) : (
              <View style={s.emptyRow}>
                <Ionicons name="barbell-outline" size={24} color="#D1D5DB" />
                <Text style={s.emptyText}>Історія тренувань поки відсутня</Text>
              </View>
            )}
          </View>
        </View>

        {/* Досягнення */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Досягнення</Text>
          <View style={s.card}>
            {achievements.length > 0 ? achievements.map((a: any, i: number) => (
              <View key={i} style={[s.achRow, i === achievements.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={[s.achIcon, { backgroundColor: '#FEF3C7' }]}><Ionicons name="trophy" size={18} color="#D97706" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.achTitle}>{a.firstName || a.title || 'Учень'}</Text>
                  <Text style={s.achMeta}>{a.belt || a.description || 'Новий рівень'}</Text>
                </View>
              </View>
            )) : (
              <View style={s.emptyRow}>
                <Ionicons name="trophy-outline" size={24} color="#D1D5DB" />
                <Text style={s.emptyText}>Досягнення з'являться тут</Text>
              </View>
            )}
          </View>
        </View>

        {/* Сповіщення */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Сповіщення</Text>
          <View style={s.card}>
            <View style={s.switchRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <Ionicons name="notifications-outline" size={20} color="#6B7280" />
                <Text style={s.switchLabel}>Push-сповіщення</Text>
              </View>
              <Switch value={notifications} onValueChange={setNotifications} trackColor={{ true: '#E30613' }} thumbColor="#fff" />
            </View>
          </View>
        </View>

        {/* Допомога */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Допомога</Text>
          <View style={s.card}>
            <TouchableOpacity style={s.helpRow} onPress={() => Alert.alert('Підтримка', 'Напишіть нам: support@ataka.club')}>
              <Ionicons name="help-circle-outline" size={20} color="#6B7280" />
              <Text style={s.helpText}>Зв'язатися з підтримкою</Text>
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
            </TouchableOpacity>
            <TouchableOpacity style={[s.helpRow, { borderBottomWidth: 0 }]} onPress={() => Alert.alert('FAQ', 'Розділ у розробці')}>
              <Ionicons name="document-text-outline" size={20} color="#6B7280" />
              <Text style={s.helpText}>Часті питання</Text>
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout */}
        <View style={s.section}>
          <TouchableOpacity testID="logout-btn" style={s.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
            <Text style={s.logoutText}>Вийти з акаунту</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value, last, editable, editValue, onEdit }: any) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: '#F3F4F6' }]}>
      <Ionicons name={icon} size={20} color="#6B7280" style={{ marginRight: 12 }} />
      <Text style={{ fontSize: 14, color: '#6B7280', width: 80 }}>{label}</Text>
      {editable && onEdit ? (
        <TextInput style={{ flex: 1, fontSize: 14, fontWeight: '600', color: '#0F172A', borderBottomWidth: 1, borderBottomColor: '#E30613', paddingVertical: 2 }} value={editValue} onChangeText={onEdit} />
      ) : (
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: '#0F172A', textAlign: 'right' }}>{value}</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  editBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText: { fontSize: 14, fontWeight: '600', color: '#E30613' },
  // Avatar
  avatarSection: { alignItems: 'center', paddingVertical: 24, backgroundColor: '#fff' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E30613', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  name: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  phone: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  editFields: { width: '80%', gap: 8, marginTop: 8 },
  input: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#0F172A' },
  // Section
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  // History
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  historyIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  historyTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  historyMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  // Achievements
  achRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  achIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  achTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  achMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  // Empty
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 20, justifyContent: 'center' },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
  // Switch
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  switchLabel: { fontSize: 15, fontWeight: '500', color: '#0F172A' },
  // Help
  helpRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  helpText: { flex: 1, fontSize: 15, fontWeight: '500', color: '#0F172A' },
  // Logout
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FEE2E2', borderRadius: 14, paddingVertical: 16 },
  logoutText: { fontSize: 16, fontWeight: '700', color: '#DC2626' },
});
