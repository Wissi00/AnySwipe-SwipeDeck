import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    card: {
        width: 300,
        aspectRatio: 2.5 / 3.5, // Standard playing card ratio
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
});
