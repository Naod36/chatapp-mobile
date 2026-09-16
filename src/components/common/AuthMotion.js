import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

export function AuthBackground({ theme, reducedMotion }) {
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion) {
      drift.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 8000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 8000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [drift, reducedMotion]);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}
    >
      <Animated.View
        style={{
          position: "absolute",
          top: -120,
          bottom: -120,
          left: -120,
          right: -120,
          transform: [
            {
              translateX: drift.interpolate({
                inputRange: [0, 1],
                outputRange: [-90, 90],
              }),
            },
            {
              translateY: drift.interpolate({
                inputRange: [0, 1],
                outputRange: [-100, 100],
              }),
            },
          ],
        }}
      >
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="authFlow" cx="10%" cy="20%" rx="100%" ry="85%">
              <Stop offset="0" stopColor="#24588f" stopOpacity="0.48" />
              <Stop offset="0.4" stopColor="#19416f" stopOpacity="0.28" />
              <Stop offset="1" stopColor="#19416f" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#authFlow)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

export function AnimatedBrand({ theme, reducedMotion }) {
  const float = useRef(new Animated.Value(0)).current;
  const letters = useRef(
    Array.from({ length: 8 }, () => new Animated.Value(1)),
  ).current;
  useEffect(() => {
    if (reducedMotion) {
      float.setValue(0);
      letters.forEach((letter) => letter.setValue(1));
      return;
    }
    letters.forEach((letter) => letter.setValue(0));
    const reveal = Animated.stagger(
      65,
      letters.map((letter) =>
        Animated.timing(letter, {
          toValue: 1,
          duration: 650,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ),
    );
    const hover = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    reveal.start();
    hover.start();
    return () => {
      reveal.stop();
      hover.stop();
    };
  }, [float, letters, reducedMotion]);
  return (
    <View
      accessible
      accessibilityLabel="FlowChat"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flexShrink: 1,
      }}
    >
      <Animated.Image
        source={require("../../../assets/logo-mark-light-theme.png")}
        style={{
          width: 28,
          height: 28,
          tintColor: theme.accent,
          transform: [
            {
              translateY: float.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -5],
              }),
            },
            {
              rotate: float.interpolate({
                inputRange: [0, 1],
                outputRange: ["-4deg", "4deg"],
              }),
            },
          ],
        }}
      />
      <View
        style={{ flexDirection: "row", overflow: "hidden", paddingVertical: 8 }}
      >
        {Array.from("FlowChat").map((letter, index) => (
          <Animated.Text
            key={index}
            style={{
              fontSize: 22,
              fontWeight: "800",
              letterSpacing: 0,
              color: theme.text,
              opacity: letters[index],
              transform: [
                {
                  translateY: letters[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [26, 0],
                  }),
                },
              ],
            }}
          >
            {letter}
          </Animated.Text>
        ))}
      </View>
    </View>
  );
}
