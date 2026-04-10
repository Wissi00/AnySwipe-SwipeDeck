import { styles } from '@/styles/MediaCard.styles';
import React from 'react';
import { View, ViewStyle } from 'react-native';

interface MediaCardProps {
    style?: ViewStyle;
    color?: string;
}

export const MediaCard: React.FC<MediaCardProps> = ({ style, color = '#FFF' }) => {
    return (
        <View style={[styles.card, { backgroundColor: color }, style]} />
    );
};
