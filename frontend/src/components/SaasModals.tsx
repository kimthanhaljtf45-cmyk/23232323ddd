import React from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Dimensions, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_W } = Dimensions.get('window');

// ============================================================
// LIMIT BLOCK MODAL — Shows when resource limit is exceeded
// ============================================================

interface LimitBlockModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade: (plan: string) => void;
  resource?: string;
  current?: number;
  limit?: number;
  percent?: number;
  currentPlan?: string;
  upgradeTo?: string | null;
  upgradeDiscount?: number;
  message?: string;
}

export function LimitBlockModal({
  visible, onClose, onUpgrade,
  resource = 'students', current = 0, limit = 0, percent = 100,
  currentPlan = 'START', upgradeTo, upgradeDiscount = 30,
  message,
}: LimitBlockModalProps) {
  const labelMap: Record<string, string> = {
    students: 'учнів', coaches: 'тренерів', branches: 'філіалів',
  };
  const iconMap: Record<string, string> = {
    students: 'people', coaches: 'person', branches: 'business',
  };
  const priceMap: Record<string, number> = { START: 990, PRO: 2490, ENTERPRISE: 4990 };

  const label = labelMap[resource] || resource;
  const icon = iconMap[resource] || 'alert-circle';
  const upgradePrice = upgradeTo ? priceMap[upgradeTo] || 0 : 0;
  const discountPrice = Math.round(upgradePrice * (1 - upgradeDiscount / 100));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={ms.modal}>
          <View style={ms.iconWrap}>
            <View style={[ms.iconCircle, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name={icon as any} size={32} color="#DC2626" />
            </View>
          </View>

          <Text style={ms.title}>Ліміт вичерпано</Text>
          <Text style={ms.desc}>
            {message || `Ваш тариф "${currentPlan}" дозволяє максимум ${limit} ${label}. Зараз використано: ${current}/${limit}.`}
          </Text>

          {/* Progress bar */}
          <View style={ms.barWrap}>
            <View style={ms.barBg}>
              <View style={[ms.barFill, { width: `${Math.min(percent, 100)}%`, backgroundColor: '#DC2626' }]} />
            </View>
            <Text style={ms.barText}>{current}/{limit} ({percent}%)</Text>
          </View>

          {upgradeTo && (
            <View style={ms.upgradeCard}>
              <Text style={ms.upgradeLabel}>Перейдіть на {upgradeTo}</Text>
              <View style={ms.priceRow}>
                <Text style={ms.oldPrice}>{upgradePrice} ₴/міс</Text>
                <Text style={ms.newPrice}>{discountPrice} ₴</Text>
                <View style={ms.discountBadge}>
                  <Text style={ms.discountBadgeT}>-{upgradeDiscount}%</Text>
                </View>
              </View>
              <Text style={ms.upgradeHint}>Знижка на перший місяць</Text>

              <TouchableOpacity
                style={ms.upgradeBtn}
                onPress={() => onUpgrade(upgradeTo)}
                activeOpacity={0.8}
              >
                <Ionicons name="flash" size={18} color="#fff" />
                <Text style={ms.upgradeBtnT}>Оновити до {upgradeTo}</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={ms.closeBtn} onPress={onClose}>
            <Text style={ms.closeBtnT}>Закрити</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}


// ============================================================
// PAST DUE MODAL — Shows when subscription is overdue
// ============================================================

interface PastDueModalProps {
  visible: boolean;
  onClose: () => void;
  onPayInvoice: () => void;
  overdueCount?: number;
  plan?: string;
}

export function PastDueModal({
  visible, onClose, onPayInvoice,
  overdueCount = 1, plan = 'PRO',
}: PastDueModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={ms.modal}>
          <View style={ms.iconWrap}>
            <View style={[ms.iconCircle, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="card" size={32} color="#D97706" />
            </View>
          </View>

          <Text style={ms.title}>Підписка прострочена</Text>
          <Text style={ms.desc}>
            У вас {overdueCount} неоплачених рахунків. Оплатіть для продовження роботи з платформою.
          </Text>

          <View style={[ms.upgradeCard, { borderColor: '#D97706' + '40' }]}>
            <Ionicons name="warning" size={20} color="#D97706" />
            <Text style={[ms.upgradeLabel, { color: '#D97706' }]}>
              Функціонал обмежено до оплати
            </Text>
            <Text style={ms.upgradeHint}>
              Ви не зможете додавати учнів, тренерів або змінювати розклад до оплати рахунку.
            </Text>

            <TouchableOpacity
              style={[ms.upgradeBtn, { backgroundColor: '#D97706' }]}
              onPress={onPayInvoice}
              activeOpacity={0.8}
            >
              <Ionicons name="card" size={18} color="#fff" />
              <Text style={ms.upgradeBtnT}>Оплатити рахунок</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={ms.closeBtn} onPress={onClose}>
            <Text style={ms.closeBtnT}>Пізніше</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}


// ============================================================
// UPGRADE SUCCESS MODAL
// ============================================================

interface UpgradeSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  plan?: string;
  fromPlan?: string;
  finalPrice?: number;
  basePrice?: number;
  discountPercent?: number;
}

export function UpgradeSuccessModal({
  visible, onClose,
  plan = 'PRO', fromPlan = 'START',
  finalPrice = 0, basePrice = 0, discountPercent = 30,
}: UpgradeSuccessModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={ms.modal}>
          <View style={ms.iconWrap}>
            <View style={[ms.iconCircle, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="checkmark-circle" size={40} color="#16A34A" />
            </View>
          </View>

          <Text style={ms.title}>Тариф оновлено!</Text>
          <Text style={ms.desc}>
            {fromPlan} → {plan}
          </Text>

          <View style={[ms.upgradeCard, { borderColor: '#16A34A40' }]}>
            <View style={ms.priceRow}>
              <Text style={ms.oldPrice}>{basePrice} ₴</Text>
              <Text style={[ms.newPrice, { color: '#16A34A' }]}>{finalPrice} ₴/міс</Text>
              <View style={[ms.discountBadge, { backgroundColor: '#16A34A' }]}>
                <Text style={ms.discountBadgeT}>-{discountPercent}%</Text>
              </View>
            </View>
            <Text style={ms.upgradeHint}>Знижка на перший місяць автоматично застосована</Text>
          </View>

          <TouchableOpacity style={[ms.upgradeBtn, { backgroundColor: '#16A34A', marginTop: 16 }]} onPress={onClose}>
            <Text style={ms.upgradeBtnT}>Чудово!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}


// ============================================================
// SMART UPGRADE BANNER — 3-level inline banner
// ============================================================

interface SmartBannerProps {
  triggers: Array<{
    type: string;
    severity: string;
    level: string;
    resource: string;
    message: string;
    action?: string;
    actionType?: string;
    upgradeTo?: string;
    current?: number;
    limit?: number;
    percent?: number;
    upgradeDiscount?: number;
  }>;
  onUpgrade: (plan: string) => void;
  onPayInvoice: () => void;
}

export function SmartUpgradeBanners({ triggers, onUpgrade, onPayInvoice }: SmartBannerProps) {
  if (!triggers || triggers.length === 0) return null;

  return (
    <View style={bn.container}>
      {triggers.map((t, i) => {
        let bgColor = '#FEF3C7';     // soft/warning
        let borderColor = '#F59E0B';
        let textColor = '#92400E';
        let iconName: any = 'information-circle';

        if (t.level === 'strong' || t.severity === 'critical') {
          bgColor = '#FEE2E2';
          borderColor = '#EF4444';
          textColor = '#991B1B';
          iconName = 'alert-circle';
        }
        if (t.level === 'hard' || t.severity === 'blocker') {
          bgColor = '#FEE2E2';
          borderColor = '#DC2626';
          textColor = '#7F1D1D';
          iconName = 'close-circle';
        }

        const showBtn = t.actionType === 'upgrade' || t.actionType === 'pay_invoice';

        return (
          <View key={i} style={[bn.banner, { backgroundColor: bgColor, borderColor }]}>
            <View style={bn.bannerRow}>
              <Ionicons name={iconName} size={20} color={borderColor} />
              <View style={bn.bannerTextWrap}>
                <Text style={[bn.bannerText, { color: textColor }]}>{t.message}</Text>
                {t.upgradeDiscount && t.actionType === 'upgrade' && (
                  <Text style={[bn.bannerHint, { color: textColor + '99' }]}>
                    Знижка -{t.upgradeDiscount}% на перший місяць
                  </Text>
                )}
              </View>
            </View>
            {showBtn && (
              <TouchableOpacity
                style={[bn.bannerBtn, { backgroundColor: borderColor }]}
                onPress={() => {
                  if (t.actionType === 'pay_invoice') {
                    onPayInvoice();
                  } else if (t.upgradeTo) {
                    onUpgrade(t.upgradeTo);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={bn.bannerBtnT}>{t.action || 'Оновити'}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}


// ============================================================
// STYLES
// ============================================================

const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: Math.min(SCREEN_W - 40, 380),
    alignItems: 'center',
  },
  iconWrap: { marginBottom: 16 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  barWrap: { width: '100%', marginBottom: 16 },
  barBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4 },
  barFill: { height: 8, borderRadius: 4 },
  barText: { fontSize: 12, color: '#6B7280', textAlign: 'right', marginTop: 4 },
  upgradeCard: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#7C3AED40',
    alignItems: 'center',
    gap: 8,
  },
  upgradeLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7C3AED',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  oldPrice: {
    fontSize: 14,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  newPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: '#7C3AED',
  },
  discountBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountBadgeT: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  upgradeHint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: '100%',
    marginTop: 8,
  },
  upgradeBtnT: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  closeBtn: {
    marginTop: 12,
    paddingVertical: 10,
  },
  closeBtnT: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
});

const bn = StyleSheet.create({
  container: { gap: 8 },
  banner: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bannerTextWrap: { flex: 1 },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  bannerHint: {
    fontSize: 11,
    marginTop: 2,
  },
  bannerBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  bannerBtnT: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});
