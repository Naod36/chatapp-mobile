import React, { useEffect, useRef } from "react";
import { Animated, PanResponder, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

export default function SwipeToReply({ children, enabled, onReply, color }) {
  const translation = useRef(new Animated.Value(0)).current;
  const latest = useRef({ enabled, onReply });
  latest.current = { enabled, onReply };
  const active = useRef(false);
  const responder = useRef(null);

  if (!responder.current) {
    const reset = () => {
      active.current = false;
      Animated.spring(translation, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 90,
      }).start();
    };
    responder.current = PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        latest.current.enabled &&
        gesture.numberActiveTouches === 1 &&
        gesture.dx > 12 &&
        gesture.dx > Math.abs(gesture.dy) * 1.7,
      onPanResponderGrant: () => {
        translation.stopAnimation();
        active.current = true;
      },
      onPanResponderMove: (_, gesture) => {
        if (!latest.current.enabled || gesture.numberActiveTouches !== 1) {
          reset();
          return;
        }
        if (active.current)
          translation.setValue(Math.max(0, Math.min(88, gesture.dx)));
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldReply =
          active.current &&
          latest.current.enabled &&
          gesture.dx >= 64 &&
          gesture.dx > Math.abs(gesture.dy) * 1.7;
        reset();
        if (shouldReply) latest.current.onReply?.();
      },
      onPanResponderTerminate: reset,
      onPanResponderTerminationRequest: () => true,
    });
  }

  useEffect(() => {
    if (!enabled) {
      active.current = false;
      translation.stopAnimation();
      translation.setValue(0);
    }
  }, [enabled, translation]);
  useEffect(() => () => translation.stopAnimation(), [translation]);

  return (
    <View {...responder.current.panHandlers}>
      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.indicator,
          {
            opacity: translation.interpolate({
              inputRange: [0, 24, 64],
              outputRange: [0, 0.3, 1],
              extrapolate: "clamp",
            }),
          },
        ]}
      >
        <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <Path
            d="M9 10H6l4-4M6 10l4 4m-1-4h6a5 5 0 015 5v3"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: translation }] }}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  indicator: {
    position: "absolute",
    left: 20,
    top: "50%",
    marginTop: -11,
  },
});
