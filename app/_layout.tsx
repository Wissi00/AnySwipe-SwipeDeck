import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ReanimatedLogLevel, configureReanimatedLogger } from 'react-native-reanimated';

configureReanimatedLogger({
    level: ReanimatedLogLevel.warn, // Switch this to 'error' if you want to be even stricter, but 'warn' is the default
    strict: false, // This disables the "Reading from value during render" check
});

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
