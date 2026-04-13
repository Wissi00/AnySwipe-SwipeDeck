import { MediaCard } from "@/components/MediaCard";
import { createSwipeableData, SwipeDeck, useSwipeDeck } from "@/lib/index";
import { styles } from "@/styles/Discover.styles";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useRef } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type MediaCardData = { id: string };

const BATCH_SIZE = 7;
const LOAD_MORE_THRESHOLD = 3;

export default function Discover() {
  const router = useRouter();
  const { deckRef, swipeLeft, swipeRight, swipeUp, swipeDown, undo, appendData } = useSwipeDeck<MediaCardData>();

  const nextHueIndexRef = useRef(0);

  const loadBatch = () => {
    console.log("🛜 loading batch");

    const startIndex = nextHueIndexRef.current;
    const batch = Array.from({ length: BATCH_SIZE }).map((_, index) => {
      return createSwipeableData({ id: String(startIndex + index + 1) });
    });
    nextHueIndexRef.current += BATCH_SIZE;
    appendData(batch);
  };

  const handleCardPress = (item: MediaCardData) => {
    router.push({ pathname: "/details", params: { cardId: item.id } });
  };

  const handleSwipeLeft = (item: MediaCardData) => {
   //console.log(`Action: Card swiped LEFT`, item);
  };

  const handleSwipeRight = (item: MediaCardData) => {
    //console.log(`Action: Card swiped RIGHT`, item);
  };

  const handleSwipeUp = (item: MediaCardData) => {
    //console.log(`Action: Card swiped UP`, item);
  };

  const handleSwipeDown = (item: MediaCardData) => {
    //console.log(`Action: Card swiped DOWN`, item);
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
        onCardPress={handleCardPress}
        onRemainingChange={handleRemainingChange}
        overlayConfig={{
          left: { color: "#FF3B30", icon : <Ionicons name="close" size={48} color="white" /> },
          right: { color: "#4CD964", icon : <Ionicons name="checkmark" size={48} color="white" /> },
          up: { color: "#FFD60A", icon : <Ionicons name="arrow-up" size={48} color="white" /> },
          down: { color: "#007AFF", icon : <Ionicons name="arrow-down" size={48} color="white" /> },
        }}
        debug
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
