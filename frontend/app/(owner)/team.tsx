import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';

const ROLE_MAP: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  OWNER: { icon: 'star', color: '#E30613', label: 'Власник' },
  ADMIN: { icon: 'shield', color: '#7C3AED', label: 'Адмін' },
  COACH: { icon: 'fitness', color: '#3B82F6', label: 'Тренер' },
  MANAGER: { icon: 'briefcase', color: '#F59E0B', label: 'Менеджер' },
  PARENT: { icon: 'heart', color: '#EC4899', label: 'Батько' },
  STUDENT: { icon: 'school', color: '#10B981', label: 'Учень' },
};

export default function OwnerTeam() {
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [invitePhone, setInvitePhone] = useState('+380');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('COACH');
  const [inviting, setInviting] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState<any>(null);

  const fetchData = async () => {
    try {
      const res = await api.get('/owner/team');
      setTeam(res.data?.members || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const handleInvite = async () => {
    if (!invitePhone || invitePhone.length < 10) return;
    setInviting(true);
    try {
      await api.post('/owner/team/invite', { phone: invitePhone, role: inviteRole, firstName: inviteName });
      setShowInvite(false);
      setInvitePhone('+380');
      setInviteName('');
      fetchData();
    } catch (e: any) {
      Alert.alert('Помилка', e?.response?.data?.error || 'Не вдалось запросити');
    } finally { setInviting(false); }
  };

  const handleRemove = (member: any) => {
    if (member.role === 'OWNER') return;
    Alert.alert('Видалити з команди?', `${member.name || 'Користувач'} буде видалений`, [
      { text: 'Скасувати', style: 'cancel' },
      { text: 'Видалити', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/owner/team/${member.id}`);
          fetchData();
        } catch (e) { Alert.alert('Помилка', 'Не вдалось видалити'); }
      }},
    ]);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.patch(`/owner/team/${userId}/role`, { role: newRole });
      setShowRoleModal(null);
      fetchData();
    } catch (e) { Alert.alert('Помилка', 'Не вдалось змінити роль'); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#E30613" /></View>;

  const coaches = team.filter(m => m.role === 'COACH');
  const admins = team.filter(m => m.role === 'ADMIN' || m.role === 'MANAGER');
  const owner = team.filter(m => m.role === 'OWNER');
  const others = team.filter(m => !['COACH', 'ADMIN', 'MANAGER', 'OWNER'].includes(m.role));

  return (
    <View style={s.flex}>
      <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#E30613" />}>
        {/* Header */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.title}>Команда клубу</Text>
            <Text style={s.subtitle}>{team.length} учасників</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={s.actionsRow}>
          <TouchableOpacity testID="invite-coach-btn" style={s.actionBtn} onPress={() => { setInviteRole('COACH'); setShowInvite(true); }}>
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={s.actionBtnText}>Додати тренера</Text>
          </TouchableOpacity>
        </View>

        {/* Owner */}
        {owner.length > 0 && <Section title="Власник" members={owner} onRemove={handleRemove} onRoleChange={(m: any) => {}} isOwnerSection />}

        {/* Coaches */}
        {coaches.length > 0 && <Section title={`Тренери (${coaches.length})`} members={coaches} onRemove={handleRemove} onRoleChange={(m: any) => setShowRoleModal(m)} />}

        {/* Admins */}
        {admins.length > 0 && <Section title={`Адміністрація (${admins.length})`} members={admins} onRemove={handleRemove} onRoleChange={(m: any) => setShowRoleModal(m)} />}

        {/* Others */}
        {others.length > 0 && <Section title={`Інші (${others.length})`} members={others} onRemove={handleRemove} onRoleChange={(m: any) => setShowRoleModal(m)} />}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Invite Modal */}
      <Modal visible={showInvite} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Запросити {inviteRole === 'COACH' ? 'тренера' : 'адміністратора'}</Text>
              <TouchableOpacity onPress={() => setShowInvite(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <Text style={s.inputLabel}>Номер телефону</Text>
            <TextInput style={s.input} value={invitePhone} onChangeText={setInvitePhone} keyboardType="phone-pad" placeholder="+380..." testID="invite-phone-input" />
            <Text style={s.inputLabel}>Ім'я (опціонально)</Text>
            <TextInput style={s.input} value={inviteName} onChangeText={setInviteName} placeholder="Ім'я" testID="invite-name-input" />
            <Text style={s.inputLabel}>Роль</Text>
            <View style={s.roleSelector}>
              {(['COACH'] as const).map(r => (
                <TouchableOpacity key={r} style={[s.roleChip, inviteRole === r && s.roleChipActive]} onPress={() => setInviteRole(r)}>
                  <Text style={[s.roleChipText, inviteRole === r && s.roleChipTextActive]}>{ROLE_MAP[r]?.label || r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity testID="confirm-invite-btn" style={s.inviteBtn} onPress={handleInvite} disabled={inviting}>
              {inviting ? <ActivityIndicator color="#FFF" /> : <Text style={s.inviteBtnText}>Запросити</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Role Change Modal */}
      <Modal visible={!!showRoleModal} animationType="fade" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Змінити роль</Text>
            <Text style={s.modalSub}>{showRoleModal?.name}</Text>
            {(['COACH', 'ADMIN', 'MANAGER'] as const).map(r => (
              <TouchableOpacity key={r} style={[s.roleOption, showRoleModal?.role === r && s.roleOptionActive]} onPress={() => handleRoleChange(showRoleModal?.id, r)}>
                <Ionicons name={ROLE_MAP[r]?.icon || 'person'} size={20} color={ROLE_MAP[r]?.color || '#6B7280'} />
                <Text style={s.roleOptionText}>{ROLE_MAP[r]?.label || r}</Text>
                {showRoleModal?.role === r && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowRoleModal(null)}>
              <Text style={s.cancelBtnText}>Скасувати</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Section({ title, members, onRemove, onRoleChange, isOwnerSection }: any) {
  return (
    <>
      <Text style={s.sectionTitle}>{title}</Text>
      {members.map((m: any, i: number) => {
        const rc = ROLE_MAP[m.role] || { icon: 'person' as any, color: '#6B7280', label: m.role };
        return (
          <View key={i} style={s.memberCard} testID={`team-member-${m.id || i}`}>
            <View style={[s.memberIcon, { backgroundColor: rc.color + '18' }]}>
              <Ionicons name={rc.icon} size={22} color={rc.color} />
            </View>
            <View style={s.memberInfo}>
              <Text style={s.memberName}>{m.name || 'Без імені'}</Text>
              <Text style={s.memberPhone}>{m.phone || ''}</Text>
            </View>
            {!isOwnerSection && (
              <View style={s.memberActions}>
                <TouchableOpacity style={s.memberActionBtn} onPress={() => onRoleChange(m)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                  <Ionicons name="swap-horizontal" size={18} color="#6B7280" />
                </TouchableOpacity>
                <TouchableOpacity style={s.memberActionBtn} onPress={() => onRemove(m)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            )}
            <View style={[s.roleBadge, { backgroundColor: rc.color + '18' }]}>
              <Text style={[s.roleText, { color: rc.color }]}>{rc.label}</Text>
            </View>
          </View>
        );
      })}
    </>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F9FAFB' },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  title: { fontSize: 20, fontWeight: '800', color: '#0F0F10' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#E30613', borderRadius: 12, paddingVertical: 14 },
  actionBtnSecondary: { backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#7C3AED' },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F0F10', marginTop: 28, marginBottom: 14, letterSpacing: 0.3 },
  memberCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  memberIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberName: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  memberPhone: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  memberActions: { flexDirection: 'row', gap: 8, marginRight: 8 },
  memberActionBtn: { padding: 4 },
  roleBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  roleText: { fontSize: 11, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F0F10' },
  modalSub: { fontSize: 15, color: '#6B7280', marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#4B5563', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  roleSelector: { flexDirection: 'row', gap: 8, marginTop: 4 },
  roleChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F3F4F6' },
  roleChipActive: { backgroundColor: '#E30613' },
  roleChipText: { fontSize: 14, fontWeight: '600', color: '#4B5563' },
  roleChipTextActive: { color: '#FFF' },
  inviteBtn: { backgroundColor: '#E30613', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  inviteBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  roleOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  roleOptionActive: { backgroundColor: '#F0FDF4', borderRadius: 10, paddingHorizontal: 12, borderBottomWidth: 0 },
  roleOptionText: { fontSize: 16, fontWeight: '500', color: '#1F2937', flex: 1 },
  cancelBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
});
