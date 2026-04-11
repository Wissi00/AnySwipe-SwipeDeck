import { styles } from '@/styles/MediaCard.styles';
import React from 'react';
import { Text, View, ViewStyle } from 'react-native';

interface MediaCardProps {
    style?: ViewStyle;
    id: string;
}

export const MediaCard: React.FC<MediaCardProps> = ({ style, id }) => {
    return (
        <View
            style={[
                styles.card,
                { backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
                style,
            ]}
        >
            <Text style={{ fontSize: 72, fontWeight: '700' }}>{id}</Text>
        </View>
    );
};
    