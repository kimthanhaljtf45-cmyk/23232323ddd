import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '@/theme';

interface ContactAction {
  type: string;
  title: string;
  value: string;
  icon: string;
}

export function ContactActionsBlock({ items }: { items: ContactAction[] }) {
  const handlePress = (item: ContactAction) => {
    switch (item.type) {
      case 'phone':
        Linking.openURL(`tel:${item.value.replace(/\s/g, '')}`);
        break;
      case 'telegram':
        Linking.openURL(`https://t.me/${item.value.replace('@', '')}`);
        break;
      case 'instagram':
        Linking.openURL(`https://instagram.com/${item.value.replace('@', '')}`);
        break;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Зв'яжіться з нами</Text>
      <View style={styles.buttons}>
        {items.map((item, index) => (
          <TouchableOpacity
            key={`${item.type}-${index}`}
            style={styles.button}
            onPress={() => handlePress(item)}
          >
            <Ionicons name={item.icon as any} size={24} color={colors.primary} />
            <Text style={styles.buttonText}>{item.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    minWidth: 100,
  },
  buttonText: {
    ...typography.caption,
    color: colors.text,
    marginTop: spacing.xs,
  },
});
