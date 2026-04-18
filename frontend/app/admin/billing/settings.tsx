import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';

export default function IntegrationSettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [merchantAccount, setMerchantAccount] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [isProdMode, setIsProdMode] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['integration-settings'],
    queryFn: async () => {
      try {
        return await api.get('/admin/integrations/payment');
      } catch {
        return { provider: 'WAYFORPAY', mode: 'TEST', merchantAccount: 'test_merch_n1', enabled: true };
      }
    },
    select: (data) => {
      if (data && !merchantAccount) {
        setMerchantAccount(data.merchantAccount || '');
        setIsProdMode(data.mode === 'LIVE');
      }
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: { merchantAccount: string; secretKey: string; mode: string }) =>
      api.post('/admin/integrations/payment', data),
    onSuccess: () => {
      Alert.alert('Збережено', 'Налаштування платежів оновлено');
      queryClient.invalidateQueries({ queryKey: ['integration-settings'] });
    },
    onError: () => Alert.alert('Помилка', 'Не вдалось зберегти'),
  });

  const handleSave = () => {
    if (isProdMode && (!merchantAccount || !secretKey)) {
      Alert.alert('Помилка', 'Для PROD режиму потрібні merchantAccount та secretKey');
      return;
    }
    if (isProdMode) {
      Alert.alert(
        'Увага!',
        'Ви перемикаєтесь на PRODUCTION режим. Реальні гроші будуть оброблятись. Продовжити?',
        [
          { text: 'Скасувати', style: 'cancel' },
          { text: 'Так, підтвердити', style: 'destructive', onPress: () => saveMutation.mutate({ merchantAccount, secretKey, mode: 'LIVE' }) },
        ]
      );
    } else {
      saveMutation.mutate({ merchantAccount, secretKey, mode: 'TEST' });
    }
  };

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color="#DC2626" /></View>;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Payment Settings</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {/* Provider */}
        <View style={s.providerCard}>
          <View style={s.providerHeader}>
            <Ionicons name="card" size={24} color="#3B82F6" />
            <Text style={s.providerName}>WayForPay</Text>
          </View>
          <View style={[s.modeBadge, { backgroundColor: isProdMode ? '#FEE2E2' : '#D1FAE5' }]}>
            <Ionicons name={isProdMode ? 'alert-circle' : 'shield-checkmark'} size={14} color={isProdMode ? '#DC2626' : '#059669'} />
            <Text style={[s.modeText, { color: isProdMode ? '#DC2626' : '#059669' }]}>
              {isProdMode ? 'PRODUCTION' : 'TEST MODE'}
            </Text>
          </View>
        </View>

        {/* Mode Switch */}
        <View style={s.switchRow}>
          <View>
            <Text style={s.switchLabel}>Production Mode</Text>
            <Text style={s.switchHint}>Реальні гроші будуть оброблятись</Text>
          </View>
          <Switch
            testID="prod-mode-switch"
            value={isProdMode}
            onValueChange={setIsProdMode}
            trackColor={{ false: '#D1D5DB', true: '#FCA5A5' }}
            thumbColor={isProdMode ? '#DC2626' : '#9CA3AF'}
          />
        </View>

        {/* Credentials */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>Merchant Account</Text>
          <TextInput
            testID="merchant-account-input"
            style={s.input}
            value={merchantAccount}
            onChangeText={setMerchantAccount}
            placeholder="your_merchant_account"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>Secret Key</Text>
          <TextInput
            testID="secret-key-input"
            style={s.input}
            value={secretKey}
            onChangeText={setSecretKey}
            placeholder={isProdMode ? 'Enter production key' : 'Using test key'}
            placeholderTextColor="#9CA3AF"
            secureTextEntry
          />
        </View>

        {isProdMode && (
          <View style={s.warningBox}>
            <Ionicons name="warning" size={20} color="#D97706" />
            <Text style={s.warningText}>
              УВАГА: В production режимі всі платежі реальні. Переконайтесь, що ваші ключі WayForPay валідні.
            </Text>
          </View>
        )}

        <TouchableOpacity
          testID="save-settings-btn"
          style={s.saveBtn}
          onPress={handleSave}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.saveBtnText}>Зберегти налаштування</Text>
          )}
        </TouchableOpacity>

        {/* Logging Info */}
        <View style={s.logSection}>
          <Text style={s.logTitle}>Logging</Text>
          <View style={s.logItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={s.logText}>Invalid signature → logged</Text>
          </View>
          <View style={s.logItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={s.logText}>Failed callbacks → logged</Text>
          </View>
          <View style={s.logItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={s.logText}>Timeout → auto-retry (3 attempts)</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  content: { padding: 16, gap: 16 },
  providerCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  providerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  providerName: { fontSize: 18, fontWeight: '700', color: '#111' },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  modeText: { fontSize: 12, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FAFAFA', padding: 16, borderRadius: 12 },
  switchLabel: { fontSize: 15, fontWeight: '600', color: '#111' },
  switchHint: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111' },
  warningBox: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  warningText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },
  saveBtn: { backgroundColor: '#DC2626', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  logSection: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, gap: 8 },
  logTitle: { fontSize: 14, fontWeight: '700', color: '#059669', marginBottom: 4 },
  logItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logText: { fontSize: 13, color: '#374151' },
});
