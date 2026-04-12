import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Details() {
  const router = useRouter();
  const { cardId } = useLocalSearchParams();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>Card Details</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.cardPreview}>
          <Text style={styles.cardNumber}>{cardId}</Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.label}>Card ID</Text>
          <Text style={styles.value}>{cardId}</Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.label}>Description</Text>
          <Text style={styles.value}>
            This is card number {cardId} from the demo deck. You tapped this card to open this details screen!
          </Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Back to Deck</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  cardPreview: {
    height: 200,
    borderRadius: 12,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  cardNumber: {
    fontSize: 48,
    fontWeight: "bold",
    color: "white",
  },
  infoSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#999",
    marginBottom: 8,
  },
  value: {
    fontSize: 16,
    color: "white",
    lineHeight: 24,
  },
  button: {
    marginTop: "auto",
    marginBottom: 24,
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
