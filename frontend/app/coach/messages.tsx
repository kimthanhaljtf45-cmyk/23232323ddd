import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../../src/lib/api';

/**
 * COACH MESSAGES - Send messages to students/parents
 * 
 * Supports:
 * - Sending to risk students
 * - Inviting absent students
 * - Custom messages
 */

interface Student {
  id: string;
  name: string;
  parentPhone?: string;
  parentName?: string;
  riskLevel?: string;
}

const MESSAGE_TEMPLATES = {
  risk: {
    title: 'Повідомлення ризиковим учням',
    template: 'Вітаємо! Ми помітили, що {studentName} давно не відвідував тренування. Чи все гаразд? Будемо раді бачити на наступному занятті!',
    icon: 'warning',
    color: '#E30613',
  },
  invite: {
    title: 'Запрошення відсутнім',
    template: 'Вітаємо! Запрошуємо {studentName} на наступне тренування. Ми готуємо цікаву програму!',
    icon: 'person-add',
    color: '#3B82F6',
  },
  custom: {
    title: 'Повідомлення',
    template: '',
    icon: 'chatbubble',
    color: '#22C55E',
  },
};

export default function CoachMessagesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ action?: string; groupId?: string; studentIds?: string }>();
  
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  
  const action = (params.action || 'custom') as keyof typeof MESSAGE_TEMPLATES;
  const template = MESSAGE_TEMPLATES[action];

  useEffect(() => {
    loadStudents();
  }, [params.studentIds]);

  const loadStudents = async () => {
    try {
      // If specific students provided
      if (params.studentIds) {
        const ids = params.studentIds.split(',');
        // Fetch students from group
        if (params.groupId) {
          const response = await api.get(`/coach/groups/${params.groupId}`);
          const groupStudents = response.students || [];
          const filtered = groupStudents.filter((s: any) => ids.includes(s.id));
          setStudents(filtered.map((s: any) => ({
            id: s.id,
            name: s.name,
            parentPhone: s.parentPhone,
            parentName: s.parentName,
            riskLevel: s.riskLevel,
          })));
          setSelectedStudents(ids);
        }
      } else {
        // Load all students
        const response = await api.get('/coach/students');
        setStudents((response || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          parentPhone: s.parentPhone,
          parentName: s.parentName,
          riskLevel: s.riskLevel,
        })));
      }
      
      // Set default message
      setMessage(template.template);
    } catch (error) {
      console.log('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const sendMessages = async () => {
    if (selectedStudents.length === 0) {
      Alert.alert('Помилка', 'Виберіть хоча б одного учня');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Помилка', 'Введіть текст повідомлення');
      return;
    }

    setSending(true);
    
    try {
      // For each selected student, send message
      const selected = students.filter(s => selectedStudents.includes(s.id));
      
      // Option 1: Open SMS app with first parent
      if (selected.length === 1 && selected[0].parentPhone) {
        const personalMessage = message.replace('{studentName}', selected[0].name);
        const smsUrl = `sms:${selected[0].parentPhone}?body=${encodeURIComponent(personalMessage)}`;
        await Linking.openURL(smsUrl);
        Alert.alert('Успіх', 'Відкрито SMS додаток');
      } else {
        // Option 2: Log to backend for bulk
        await api.post('/coach/messages/bulk', {
          studentIds: selectedStudents,
          message: message,
          type: action,
        });
        Alert.alert('Успіх', `Повідомлення надіслано ${selectedStudents.length} учням`);
      }
      
      router.back();
    } catch (error: any) {
      console.log('Error sending messages:', error);
      Alert.alert('Помилка', error?.message || 'Не вдалося надіслати повідомлення');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E30613" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0F0F10" />
        </Pressable>
        <View style={styles.headerContent}>
          <View style={[styles.headerIcon, { backgroundColor: template.color + '20' }]}>
            <Ionicons name={template.icon as any} size={20} color={template.color} />
          </View>
          <Text style={styles.headerTitle}>{template.title}</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Selected Students */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Отримувачі ({selectedStudents.length})</Text>
          <View style={styles.studentsGrid}>
            {students.map(student => (
              <Pressable
                key={student.id}
                style={[
                  styles.studentChip,
                  selectedStudents.includes(student.id) && styles.studentChipSelected,
                ]}
                onPress={() => toggleStudent(student.id)}
              >
                <Text style={[
                  styles.studentChipText,
                  selectedStudents.includes(student.id) && styles.studentChipTextSelected,
                ]}>
                  {student.name}
                </Text>
                {selectedStudents.includes(student.id) && (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Message Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Повідомлення</Text>
          <TextInput
            style={styles.messageInput}
            value={message}
            onChangeText={setMessage}
            multiline
            placeholder="Введіть текст повідомлення..."
            placeholderTextColor="#9CA3AF"
          />
          <Text style={styles.hint}>
            Використовуйте {'{studentName}'} для вставки імені учня
          </Text>
        </View>
      </ScrollView>

      {/* Send Button */}
      <View style={styles.footer}>
        <Pressable 
          style={[styles.sendButton, sending && styles.sendButtonDisabled]}
          onPress={sendMessages}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#fff" />
              <Text style={styles.sendButtonText}>Надіслати</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F0F10',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  studentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  studentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  studentChipSelected: {
    backgroundColor: '#E30613',
    borderColor: '#E30613',
  },
  studentChipText: {
    fontSize: 14,
    color: '#374151',
  },
  studentChipTextSelected: {
    color: '#fff',
  },
  messageInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#0F0F10',
    minHeight: 150,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E30613',
    borderRadius: 12,
    paddingVertical: 16,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
