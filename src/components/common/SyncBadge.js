import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";

/**
 * SyncBadge — small pill showing connection state.
 * Props: syncState ("connecting"|"updating"|"ready"), theme
 */
export default function SyncBadge({ syncState, theme: t }) {
    if (syncState === "ready") return null;

    const label = syncState === "connecting" ? "Connecting..." : "Updating...";

    return (
        <View style={[styles.badge, { backgroundColor: t.cardBg, borderColor: t.borderColor }]}>
            <View style={[styles.dot, { backgroundColor: t.textMuted }]} />
            <Text style={[styles.label, { color: t.textMuted }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
        alignSelf: "center",
        marginBottom: 4,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    label: {
        fontSize: 11,
        fontWeight: "600",
    },
});
