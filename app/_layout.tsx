import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="discover" />
                <Stack.Screen name="details" />
            </Stack>
            <StatusBar style="light" />
        </SafeAreaProvider>
    );
}
