import { MediaCard } from "@/components/MediaCard";
import { createSwipeableData, SwipeDeck, useSwipeDeck } from "@/lib";
import { styles } from "@/styles/Discover.styles";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type MediaCardData = { color: string };

export default function Discover() {
    const { deckRef, swipeLeft, swipeRight, swipeUp, swipeDown, undo } = useSwipeDeck<MediaCardData>();

    const totalCreatedCardsRef = useRef(12);

    const generateBatch = (startIndex: number) =>
        Array.from({ length: 12 }).map((_, index) => {
            const h = ((startIndex + index) * 137.5) % 360;
            return createSwipeableData({ color: `hsl(${h}, 70%, 60%)` });
        });

    const [cardsData, setCardsData] = useState(() => generateBatch(0));
    const swipedStackRef = useRef<MediaCardData[]>([]);

    useEffect(() => {
        if (cardsData.length <= 6) {
            console.log("Action: Loading more cards...");
            const nextID = totalCreatedCardsRef.current;
            setCardsData((prev) => [...prev, ...generateBatch(nextID)]);
            totalCreatedCardsRef.current += 12;
        }
    }, [cardsData.length]);

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

    const addRemovedCardToHistoryAndCheckLoadMore = (item: MediaCardData) => {
        swipedStackRef.current.push(item);
        setCardsData((prev) => prev.filter((c) => c.data !== item));
        console.log(`HISTORY: Card removed, stack size: ${swipedStackRef.current.length}`);
    };

    const handleUndo = () => {
        const itemToRestore = swipedStackRef.current.pop();
        undo(itemToRestore);
    };

    return (
        <SafeAreaView style={styles.container}>
            <SwipeDeck
                ref={deckRef}
                data={cardsData}
                ItemComponent={MediaCard}
                onSwipeLeft={handleSwipeLeft}
                onSwipeRight={handleSwipeRight}
                onSwipeUp={handleSwipeUp}
                onSwipeDown={handleSwipeDown}
                onCardRemoved={addRemovedCardToHistoryAndCheckLoadMore}
            />

            <TouchableOpacity style={styles.undoButton} onPress={handleUndo}>
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
