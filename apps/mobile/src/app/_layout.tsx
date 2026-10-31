import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RealtimeBridge } from '@/components/RealtimeBridge';

export default function RootLayout() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 2 } } }));
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <RealtimeBridge />
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerTitleStyle: { fontWeight: '700' } }}>
          <Stack.Screen name="index" options={{ title: 'TransitLink' }} />
          <Stack.Screen name="student" options={{ title: 'My Bus', headerBackVisible: false }} />
          <Stack.Screen name="driver" options={{ title: 'Driver', headerBackVisible: false }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
