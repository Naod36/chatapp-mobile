import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function EmptyState({ theme: t, isSearchEmpty }) {
    return (
        <View style={styles.wrap}>
            <Text style={styles.emoji}>{isSearchEmpty ? "🔍" : "💬"}</Text>
            <Text style={[styles.title, { color: t.text }]}>
                {isSearchEmpty ? "No users found" : "No conversations yet"}
            </Text>
            <Text style={[styles.sub, { color: t.textMuted }]}>
                {isSearchEmpty ? "Try a different search term" : "Search for a user to start chatting"}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
    emoji: { fontSize: 42, marginBottom: 14 },
    title: { fontSize: 17, fontWeight: "700", marginBottom: 6, textAlign: "center" },
    sub: { fontSize: 13.5, textAlign: "center", lineHeight: 20 },
});
