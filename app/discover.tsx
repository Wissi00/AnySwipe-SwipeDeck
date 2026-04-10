import { MediaCard } from "@/components/MediaCard";
import { createSwipeableData, SwipeDeck, useSwipeDeck } from "@/lib";
import { styles } from "@/styles/Discover.styles";
import { Ionicons } from "@expo/vector-icons";
import React, { useRef } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type MediaCardData = { color?: string };

const BATCH_SIZE = 12;
const LOAD_MORE_THRESHOLD = 6;

export default function Discover() {
    const { deckRef, swipeLeft, swipeRight, swipeUp, swipeDown, undo, appendData } = useSwipeDeck<MediaCardData>();

    const nextHueIndexRef = useRef(0);

    const loadBatch = () => {
        console.log("🛜 loading batch");

        const startIndex = nextHueIndexRef.current;
        const batch = Array.from({ length: BATCH_SIZE }).map((_, index) => {
            const h = ((startIndex + index) * 137.5) % 360;
            return createSwipeableData({ color: `hsl(${h}, 70%, 60%)` });
        });
        nextHueIndexRef.current += BATCH_SIZE;
        appendData(batch);
    };

    const handleSwipeLeft = (item: MediaCardData) => {
        console.log(`Action: Card swiped LEFT`, item);
    };

    const handleSwipeRight = (item: MediaCardData) => {
        console.log(`Action: Card swiped RIGHT`, item);
    };

    const handleSwipeUp = (item: MediaCardData) => {
        console.log(`Action: Card swiped UP`, item);
    };

    const handleSwipeDown = (item: MediaCardData) => {
        console.log(`Action: Card swiped DOWN`, item);
    };

    const handleRemainingChange = (count: number) => {
        console.log(`Remaining cards changed: ${count}`);
        if (count <= LOAD_MORE_THRESHOLD) loadBatch();
    };

    return (
        <SafeAreaView style={styles.container}>
            <SwipeDeck
                ref={deckRef}
                ItemComponent={MediaCard}
                onSwipeLeft={handleSwipeLeft}
                onSwipeRight={handleSwipeRight}
                onSwipeUp={handleSwipeUp}
                onSwipeDown={handleSwipeDown}
                onRemainingChange={handleRemainingChange}
            />

            <TouchableOpacity style={styles.undoButton} onPress={undo}>
                <Ionicons name="refresh" size={24} color="white" />
            </TouchableOpacity>

            <View style={styles.buttonRow}>
                <TouchableOpacity style={[styles.button, { backgroundColor: "#FF3B30" }]} onPress={swipeLeft}>
                    <Text style={styles.buttonText}>Left</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, { backgroundColor: "#4CD964" }]} onPress={swipeRight}>
                    <Text style={styles.buttonText}>Right</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, { backgroundColor: "#007AFF" }]} onPress={swipeUp}>
                    <Text style={styles.buttonText}>Up</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, { backgroundColor: "#FF9500" }]} onPress={swipeDown}>
                    <Text style={styles.buttonText}>Down</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
