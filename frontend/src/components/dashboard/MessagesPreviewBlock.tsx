import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/theme';

interface Message {
  id: string;
  threadId?: string;
  sender: string;
  senderRole?: string;
  text: string;
  time?: string;
  unread?: boolean;
}

interface Props {
  messages: Message[];
  unreadCount?: number;
}

export function MessagesPreviewBlock({ messages, unreadCount = 0 }: Props) {
  if (!messages || messages.length === 0) return null;

  const formatTime = (time?: string) => {
    if (!time) return '';
    const date = new Date(time);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Повідомлення</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => router.push('/messages')}>
          <Text style={styles.seeAll}>Усі</Text>
        </TouchableOpacity>
      </View>
      
      {messages.slice(0, 2).map((message, index) => (
        <TouchableOpacity
          key={message.id || index}
          style={[
            styles.messageCard,
            message.unread && styles.messageCardUnread,
          ]}
          onPress={() => {
            if (message.threadId) {
              router.push(`/messages/${message.threadId}`);
            } else {
              router.push('/messages');
            }
          }}
          activeOpacity={0.8}
        >
          <View style={[
            styles.avatar,
            message.senderRole === 'COACH' && styles.avatarCoach,
            message.senderRole === 'ADMIN' && styles.avatarAdmin,
          ]}>
            <Ionicons 
              name={message.senderRole === 'COACH' ? 'fitness' : 'person'} 
              size={18} 
              color="#fff" 
            />
          </View>
          
          <View style={styles.messageContent}>
            <View style={styles.messageHeader}>
              <Text style={styles.senderName}>{message.sender}</Text>
              {message.time && (
                <Text style={styles.messageTime}>{formatTime(message.time)}</Text>
              )}
            </View>
            <Text 
              style={[styles.messageText, message.unread && styles.messageTextUnread]}
              numberOfLines={1}
            >
              {message.text}
            </Text>
          </View>

          {message.unread && (
            <View style={styles.unreadDot} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  badge: {
    backgroundColor: '#DC2626',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E30613',
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageCardUnread: {
    backgroundColor: '#FEF7F7',
    borderColor: '#FECACA',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6B7280',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCoach: {
    backgroundColor: '#E30613',
  },
  avatarAdmin: {
    backgroundColor: '#000',
  },
  messageContent: {
    flex: 1,
    marginLeft: 12,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  senderName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  messageTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  messageText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  messageTextUnread: {
    color: '#000',
    fontWeight: '500',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E30613',
    marginLeft: 8,
  },
});
