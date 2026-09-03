import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import {
  Manrope_500Medium,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import {
  Newsreader_500Medium,
  Newsreader_600SemiBold,
} from '@expo-google-fonts/newsreader';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';

import { configureApi } from '@/api';
import { AuthProvider, useAuth } from '@/auth/auth-context';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* Already hidden — nothing to do. */
});

// The web app created the QueryClient at module scope with all defaults.
// On mobile the network is flakier and the app gets backgrounded, so a
// couple of defaults are worth setting explicitly.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

// Renders the navigator once auth has resolved. Everything under
// `(tabs)` / `plan` is gated behind a valid session; `sign-in` is shown
// otherwise. `Stack.Protected` handles the redirect either way.
function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { status, isAuthenticated } = useAuth();
  const ready = fontsReady && status !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="plan"
          options={{
            // iOS sheet presentation — the web version used a centred
            // dialog, which is the wrong idiom on a phone.
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [apiReady, setApiReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Manrope_500Medium,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Newsreader_500Medium,
    Newsreader_600SemiBold,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  useEffect(() => {
    configureApi();
    setApiReady(true);
  }, []);

  const fontsReady = (fontsLoaded || Boolean(fontError)) && apiReady;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="dark" />
            <RootNavigator fontsReady={fontsReady} />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
