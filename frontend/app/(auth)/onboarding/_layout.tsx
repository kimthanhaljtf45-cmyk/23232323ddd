import { Stack, useRouter } from 'expo-router';
import { Pressable, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function OnboardingLayout() {
  const router = useRouter();
  
  const BackButton = () => (
    <Pressable 
      onPress={() => router.back()} 
      style={{ padding: 8, marginLeft: Platform.OS === 'web' ? 8 : 0 }}
    >
      <Ionicons name="chevron-back" size={28} color="#0F0F10" />
    </Pressable>
  );

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitle: '',
        headerBackTitle: '',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#0F0F10',
        contentStyle: { backgroundColor: '#FFFFFF' },
        headerLeft: () => <BackButton />,
      }}
    />
  );
}
