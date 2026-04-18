import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { colors, spacing, fontSizes, borderRadius } from '@/theme';

interface Props {
  onApplied?: (result: any) => void;
}

export default function PromoCodeInput({ onApplied }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ valid: boolean; message?: string } | null>(null);

  const applyCode = async () => {
    if (!code.trim()) return;

    try {
      setLoading(true);
      setResult(null);
      
      const response = await api.post('/discounts/validate-promo', {
        promoCode: code.trim(),
      });

      setResult(response);
      
      if (response.valid) {
        onApplied?.(response);
      }
    } catch (error: any) {
      setResult({
        valid: false,
        message: error.response?.data?.message || '\u041F\u043E\u043C\u0438\u043B\u043A\u0430 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438 \u043A\u043E\u0434\u0443',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="\u041F\u0440\u043E\u043C\u043E\u043A\u043E\u0434"
          placeholderTextColor={colors.textTertiary}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.button, !code.trim() && styles.buttonDisabled]}
          onPress={applyCode}
          disabled={loading || !code.trim()}
        >
          {loading ? (
            <Ionicons name="hourglass-outline" size={20} color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>\u0417\u0430\u0441\u0442\u043E\u0441\u0443\u0432\u0430\u0442\u0438</Text>
          )}
        </TouchableOpacity>
      </View>

      {result && (
        <View style={[styles.resultBox, result.valid ? styles.resultSuccess : styles.resultError]}>
          <Ionicons
            name={result.valid ? 'checkmark-circle' : 'close-circle'}
            size={18}
            color={result.valid ? colors.success : colors.error}
          />
          <Text style={[styles.resultText, { color: result.valid ? colors.success : colors.error }]}>
            {result.valid ? '\u041F\u0440\u043E\u043C\u043E\u043A\u043E\u0434 \u0437\u0430\u0441\u0442\u043E\u0441\u043E\u0432\u0430\u043D\u043E!' : result.message}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.base,
    fontSize: fontSizes.base,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.text,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.base,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.textTertiary,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: fontSizes.sm,
  },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  resultSuccess: {
    backgroundColor: colors.successLight,
  },
  resultError: {
    backgroundColor: colors.errorLight,
  },
  resultText: {
    fontSize: fontSizes.sm,
    fontWeight: '500',
  },
});
