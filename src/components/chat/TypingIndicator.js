import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";

function useBounceDot(delay) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop;
    const timer = setTimeout(() => {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    }, delay);
    return () => {
      clearTimeout(timer);
      loop?.stop();
    };
  }, [value, delay]);

  return value;
}

function Dot({ delay, color }) {
  const value = useBounceDot(delay);
  const translateY = value.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -5],
  });
  const opacity = value.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: color, opacity, transform: [{ translateY }] }]}
    />
  );
}

/**
 * TypingIndicator — animated bouncing 3-dot row shown when someone is typing,
 * matching the web app's typing animation.
 * Props: username (truthy = someone is typing), theme
 */
export default function TypingIndicator({ username, theme: t }) {
  if (!username) return null;

  return (
    <View style={styles.wrap}>
      <View style={[styles.bubble, { backgroundColor: t.otherBubbleBg }]}>
        <Dot delay={0} color={t.success} />
        <Dot delay={200} color={t.success} />
        <Dot delay={400} color={t.success} />
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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderTopLeftRadius: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
