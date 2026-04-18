import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';

type Props = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export default function SlotButton({
  label,
  active,
  disabled,
  onPress,
}: Props) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        active && styles.buttonActive,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text
        style={[
          styles.label,
          active && styles.labelActive,
          disabled && styles.labelDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginRight: 8,
    marginBottom: 8,
  },
  buttonActive: {
    backgroundColor: '#E53935',
    borderColor: '#E53935',
  },
  buttonDisabled: {
    backgroundColor: '#F3F3F3',
    borderColor: '#F3F3F3',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  labelActive: {
    color: '#FFF',
  },
  labelDisabled: {
    color: '#AAA',
  },
});
