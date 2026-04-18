import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';

interface Props {
  label: string;
  backgroundColor: string;
  textColor: string;
  isActive?: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export function AttendanceActionButton({
  label,
  backgroundColor,
  textColor,
  isActive = false,
  onPress,
  disabled = false,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        {
          backgroundColor,
          opacity: disabled ? 0.6 : 1,
          borderWidth: isActive ? 2 : 0,
          borderColor: '#0F0F10',
        },
      ]}
    >
      <Text style={[styles.label, { color: textColor }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  label: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
  },
});
