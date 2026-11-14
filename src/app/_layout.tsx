import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { AppStoreProvider, useAppStore } from '@/state/AppStore';
import { flags } from '@/config/features';
import { RestTimerProvider } from '@/state/RestTimer';
import { useColors, useScheme } from '@/theme';

function RootNavigator() {
  const { ready } = useAppStore();
  const c = useColors();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  // Screens behind a disabled feature flag (src/config/features.ts) are not
  // registered at all, so they can't be reached by navigation or deep links.
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.card },
        headerTintColor: c.text,
        contentStyle: { backgroundColor: c.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Protected guard={flags.workout}>
        <Stack.Screen name="workout" options={{ title: 'Workout' }} />
        <Stack.Screen name="pick-exercise" options={{ title: 'Add exercise', presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={flags.exerciseDetails}>
        <Stack.Screen name="exercise/[id]" options={{ title: 'Exercise' }} />
      </Stack.Protected>
      <Stack.Protected guard={flags.history}>
        <Stack.Screen name="history/[id]" options={{ title: 'Workout details' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppStoreProvider>
        <RestTimerProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <RootNavigator />
        </RestTimerProvider>
      </AppStoreProvider>
    </ThemeProvider>
  );
}
