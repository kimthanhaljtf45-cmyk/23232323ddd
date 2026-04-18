import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/theme';

interface FeedItem {
  id: string;
  type: 'news' | 'tournament' | 'achievement' | 'announcement';
  title: string;
  subtitle?: string;
  image?: string;
  date?: string;
}

interface Props {
  feed: FeedItem[];
}

export function FeedPreviewBlock({ feed }: Props) {
  if (!feed || feed.length === 0) return null;

  const getIcon = (type: FeedItem['type']) => {
    switch (type) {
      case 'tournament': return 'trophy';
      case 'achievement': return 'medal';
      case 'announcement': return 'megaphone';
      default: return 'newspaper';
    }
  };

  const getColor = (type: FeedItem['type']) => {
    switch (type) {
      case 'tournament': return '#F59E0B';
      case 'achievement': return '#22C55E';
      case 'announcement': return '#E30613';
      default: return '#3B82F6';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Новини клубу</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/feed')}>
          <Text style={styles.seeAll}>Усі</Text>
        </TouchableOpacity>
      </View>
      
      {feed.slice(0, 2).map((item, index) => (
        <TouchableOpacity
          key={item.id || index}
          style={styles.feedCard}
          onPress={() => router.push('/(tabs)/feed')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, { backgroundColor: getColor(item.type) + '15' }]}>
            <Ionicons 
              name={getIcon(item.type)} 
              size={22} 
              color={getColor(item.type)} 
            />
          </View>
          
          <View style={styles.feedContent}>
            <Text style={styles.feedTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.subtitle && (
              <Text style={styles.feedSubtitle} numberOfLines={1}>
                {item.subtitle}
              </Text>
            )}
          </View>

          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
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
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E30613',
  },
  feedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedContent: {
    flex: 1,
    marginLeft: 12,
  },
  feedTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  feedSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
