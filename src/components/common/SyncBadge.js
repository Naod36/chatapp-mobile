import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";

/**
 * SyncBadge — small pill showing connection state.
 * Props: syncState ("connecting"|"updating"|"ready"), theme
 */
export default function SyncBadge({ syncState, theme: t }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.3,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  if (syncState === "ready") return null;

  const label = syncState === "refreshing" ? "Refreshing..."
    : syncState === "connecting" ? "Connecting..." : "Updating...";

  return (
    <View style={styles.badge}>
      <Animated.View
        style={[styles.dot, { backgroundColor: t.accent, opacity: pulse }]}
      />
      <Text style={[styles.label, { color: t.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontSize: 15,
    fontWeight: "400",
    letterSpacing: 0.2,
  },
});
