import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import type { IconName } from '@/components/ui';
import { flags } from '@/config/features';
import { useColors } from '@/theme';

const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border },
        headerStyle: { backgroundColor: c.card },
        headerTintColor: c.text,
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: flags.workout ? 'Workout' : 'Home',
          tabBarIcon: icon(flags.workout ? 'barbell' : 'home'),
        }}
      />
      <Tabs.Protected guard={flags.exercises}>
        <Tabs.Screen name="exercises" options={{ title: 'Exercises', tabBarIcon: icon('list') }} />
      </Tabs.Protected>
      <Tabs.Protected guard={flags.history}>
        <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('time') }} />
      </Tabs.Protected>
      <Tabs.Protected guard={flags.profile}>
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person') }} />
      </Tabs.Protected>
    </Tabs>
  );
}
