import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

type Severity = 'INFO' | 'WARNING' | 'CRITICAL';

interface Props {
  title: string;
  message: string;
  severity: Severity;
}

const severityMap: Record<Severity, { bg: string; color: string }> = {
  INFO: { bg: '#E3F2FD', color: '#1565C0' },
  WARNING: { bg: '#FFF3E0', color: '#EF6C00' },
  CRITICAL: { bg: '#FDECEC', color: '#C62828' },
};

export default function AlertBanner({ title, message, severity }: Props) {
  const s = severityMap[severity] || severityMap.INFO;

  return (
    <View style={[styles.container, { backgroundColor: s.bg }]}>
      <Text style={[styles.title, { color: s.color }]}>
        {title}
      </Text>
      <Text style={styles.message}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  title: {
    fontWeight: '800',
    fontSize: 14,
  },
  message: {
    color: '#333',
    marginTop: 6,
    lineHeight: 20,
  },
});
