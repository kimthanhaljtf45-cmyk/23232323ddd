import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, borderRadius, spacing } from '@/theme';

interface ProgressBarProps {
  value: number; // 0-100
  height?: number;
  color?: string;
  backgroundColor?: string;
}

export function ProgressBar({ 
  value, 
  height = 8, 
  color = colors.primary,
  backgroundColor = colors.backgroundTertiary 
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  
  return (
    <View style={[styles.container, { height, backgroundColor }]}>
      <View 
        style={[
          styles.fill, 
          { 
            width: `${clampedValue}%`, 
            backgroundColor: color,
          }
        ]} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
});
