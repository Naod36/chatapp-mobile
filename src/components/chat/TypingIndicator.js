import React from "react";
import { View, Text, StyleSheet } from "react-native";

/**
 * TypingIndicator — animated "..." dots row shown when someone is typing.
 * Props: username (string), theme
 */
export default function TypingIndicator({ username, theme: t }) {
    if (!username) return null;

    const textLabel = typeof username === "string" ? `${username} is typing…` : "typing…";

    return (
        <View style={styles.wrap}>
            <View style={[styles.bubble, { backgroundColor: t.otherBubbleBg }]}>
                <Text style={[styles.text, { color: t.accent }]}>
                    💬 {textLabel}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        paddingHorizontal: 14,
        paddingVertical: 4,
        alignSelf: "flex-start",
    },
    bubble: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 16,
        borderTopLeftRadius: 4,
    },
    text: {
        fontSize: 12.5,
        fontWeight: "600",
    },
});
