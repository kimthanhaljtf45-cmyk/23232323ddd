import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing, Pressable, ViewStyle, TextStyle, TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ============================================================
// PressScale — TouchableOpacity replacement with scale 0.97 on tap
// ============================================================
type PressScaleProps = {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  scaleTo?: number;
  testID?: string;
  hitSlop?: number;
};

export function PressScale({
  children,
  onPress,
  disabled,
  style,
  scaleTo = 0.97,
  testID,
  hitSlop,
}: PressScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (to: number) => {
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 50,
      bounciness: 6,
    }).start();
  };

  return (
    <Pressable
      testID={testID}
      onPressIn={() => !disabled && animateTo(scaleTo)}
      onPressOut={() => !disabled && animateTo(1)}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      hitSlop={hitSlop}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style as any]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ============================================================
// FadeInUp — card entry animation (fade 0→1 + translateY 8→0)
// ============================================================
type FadeInUpProps = {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  translateY?: number;
  style?: ViewStyle | ViewStyle[];
};

export function FadeInUp({
  children,
  delay = 0,
  duration = 320,
  translateY = 8,
  style,
}: FadeInUpProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(translateY)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(ty, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY: ty }] }, style as any]}>
      {children}
    </Animated.View>
  );
}

// ============================================================
// CountUp — animated number from `from` → `to`
// ============================================================
type CountUpProps = {
  to: number;
  from?: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  style?: TextStyle | TextStyle[];
  testID?: string;
};

export function CountUp({
  to,
  from = 0,
  duration = 700,
  suffix = '',
  prefix = '',
  style,
  testID,
}: CountUpProps) {
  const val = useRef(new Animated.Value(from)).current;
  const [display, setDisplay] = React.useState(from);

  useEffect(() => {
    const id = val.addListener(({ value }) => setDisplay(Math.round(value)));
    Animated.timing(val, {
      toValue: to,
      duration,
      useNativeDriver: false,
      easing: Easing.out(Easing.cubic),
    }).start();
    return () => val.removeListener(id);
  }, [to]);

  return (
    <Text testID={testID} style={style as any}>
      {prefix}{display}{suffix}
    </Text>
  );
}

// ============================================================
// XPPop — floating "+N XP" animation; renders at top of screen
// ============================================================
type XPPopProps = {
  visible: boolean;
  xp: number;
  onDone?: () => void;
  label?: string;
};

export function XPPop({ visible, xp, onDone, label = 'XP' }: XPPopProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    ty.setValue(0);
    scale.setValue(0.8);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 12 }),
      ]),
      Animated.delay(800),
      Animated.parallel([
        Animated.timing(ty, { toValue: -40, duration: 500, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start(() => onDone && onDone());
  }, [visible]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={mStyles.xpPopWrap}>
      <Animated.View style={[mStyles.xpPop, { opacity, transform: [{ translateY: ty }, { scale }] }]}>
        <Ionicons name="sparkles" size={18} color="#F59E0B" />
        <Text style={mStyles.xpPopT}>+{xp} {label}</Text>
      </Animated.View>
    </View>
  );
}

// ============================================================
// SuccessToast — slide down from top; "🔥 Ти молодець!"
// ============================================================
type ToastProps = {
  visible: boolean;
  text: string;
  icon?: string;
  tone?: 'success' | 'info' | 'soft';
  duration?: number;
  onHide?: () => void;
};

export function Toast({ visible, text, icon = 'checkmark-circle', tone = 'success', duration = 2200, onHide }: ToastProps) {
  const ty = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.spring(ty, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(ty, { toValue: -80, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => onHide && onHide());
    }, duration);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  const toneStyle =
    tone === 'success' ? mStyles.toastSuccess :
    tone === 'soft' ? mStyles.toastSoft :
    mStyles.toastInfo;

  const color = tone === 'success' ? '#065F46' : tone === 'soft' ? '#92400E' : '#1E40AF';

  return (
    <Animated.View pointerEvents="none" style={[mStyles.toastWrap, toneStyle, { opacity, transform: [{ translateY: ty }] }]}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[mStyles.toastT, { color }]}>{text}</Text>
    </Animated.View>
  );
}

const mStyles = StyleSheet.create({
  xpPopWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    alignItems: 'center',
    zIndex: 9998,
    paddingTop: 80,
  },
  xpPop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  xpPopT: { fontSize: 16, fontWeight: '800', color: '#92400E' },

  toastWrap: {
    position: 'absolute',
    top: 48,
    left: 16, right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 9999,
  },
  toastSuccess: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  toastInfo: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  toastSoft: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  toastT: { flex: 1, fontSize: 14, fontWeight: '700' },
});
