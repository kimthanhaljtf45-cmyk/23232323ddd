import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';

type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

interface Action {
  id: string;
  childName: string;
  action: string;
  priority: Priority;
}

interface Props {
  actions: Action[];
  onActionPress?: (actionId: string) => void;
}

const priorityColors: Record<Priority, string> = {
  HIGH: '#E53935',
  MEDIUM: '#FB8C00',
  LOW: '#43A047',
};

const priorityLabels: Record<Priority, string> = {
  HIGH: 'Терміново',
  MEDIUM: 'Важливо',
  LOW: 'Звичайно',
};

export default function CoachActionQueue({ actions, onActionPress }: Props) {
  if (!actions || actions.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.header}>Черга дій</Text>
        <Text style={styles.emptyText}>Немає дій на сьогодні</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.header}>Черга дій</Text>

      {actions.map((item) => (
        <Pressable
          key={item.id}
          style={styles.item}
          onPress={() => onActionPress?.(item.id)}
        >
          <Text style={styles.itemName}>{item.childName}</Text>
          <Text style={styles.itemAction}>{item.action}</Text>
          <Text style={[styles.itemPriority, { color: priorityColors[item.priority] }]}>
            {priorityLabels[item.priority]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  header: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
  },
  item: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F1F1',
  },
  itemName: {
    fontWeight: '700',
    color: '#111',
  },
  itemAction: {
    marginTop: 4,
    color: '#666',
  },
  itemPriority: {
    marginTop: 6,
    fontWeight: '700',
  },
});
