import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  onApply: (code: string) => Promise<{ valid: boolean; message?: string }>;
  appliedCode?: string;
  disabled?: boolean;
}

export default function PromoCodeInput({ onApply, appliedCode, disabled }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleApply = async () => {
    if (!code.trim() || loading || disabled) return;

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const result = await onApply(code.trim().toUpperCase());
      if (result.valid) {
        setSuccess(true);
        setCode('');
      } else {
        setError(result.message || 'Невірний промокод');
      }
    } catch (e: any) {
      setError(e.message || 'Помилка перевірки');
    } finally {
      setLoading(false);
    }
  };

  if (appliedCode) {
    return (
      <View style={styles.appliedContainer}>
        <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
        <Text style={styles.appliedText}>
          Промокод <Text style={styles.appliedCode}>{appliedCode}</Text> застосовано
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Промокод</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, error && styles.inputError]}
          placeholder="Введіть промокод"
          placeholderTextColor="#9CA3AF"
          value={code}
          onChangeText={(t) => {
            setCode(t.toUpperCase());
            setError('');
          }}
          autoCapitalize="characters"
          editable={!disabled}
        />
        <Pressable
          style={[styles.applyBtn, (!code.trim() || disabled) && styles.applyBtnDisabled]}
          onPress={handleApply}
          disabled={!code.trim() || loading || disabled}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.applyBtnText}>Застосувати</Text>
          )}
        </Pressable>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {success ? (
        <Text style={styles.successText}>Промокод застосовано!</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500',
    color: '#0F0F10',
  },
  inputError: {
    backgroundColor: '#FEE2E2',
  },
  applyBtn: {
    backgroundColor: '#0F0F10',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  applyBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 6,
  },
  successText: {
    color: '#22C55E',
    fontSize: 13,
    marginTop: 6,
  },
  appliedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    padding: 12,
    borderRadius: 10,
    marginVertical: 12,
  },
  appliedText: {
    color: '#166534',
    fontSize: 14,
  },
  appliedCode: {
    fontWeight: '700',
  },
});
