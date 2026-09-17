import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Animated,
  PanResponder,
  StyleSheet,
  Dimensions,
  BackHandler,
  Platform,
} from "react-native";
import { API_BASE } from "../../services/api";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_DELAY_MS = 280;

function getAssetUrl(url) {
  if (!url) return null;
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:")
  )
    return url;
  return `${API_BASE}${url}`;
}

// Euclidean distance between the first two active touches — used to derive
// a pinch scale factor without pulling in a gesture-handling dependency.
export function getTouchDistance(touches) {
  if (!touches || touches.length < 2) return 0;
  const [a, b] = touches;
  const dx = a.pageX - b.pageX;
  const dy = a.pageY - b.pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function clampScale(scale, min = MIN_SCALE, max = MAX_SCALE) {
  return Math.min(max, Math.max(min, scale));
}

// A single swipeable page: hand-rolled pinch-to-zoom + pan + double-tap,
// reset whenever it stops being the active page (see `isActive`).
export function ZoomableImage({ uri, width, height, isActive }) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const gesture = useRef({
    scale: 1,
    baseScale: 1,
    translateX: 0,
    translateY: 0,
    baseTranslateX: 0,
    baseTranslateY: 0,
    initialDistance: 0,
    lastTap: 0,
  });

  const resetZoom = useCallback(() => {
    gesture.current = {
      scale: 1,
      baseScale: 1,
      translateX: 0,
      translateY: 0,
      baseTranslateX: 0,
      baseTranslateY: 0,
      initialDistance: 0,
      lastTap: 0,
    };
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
      }),
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
      }),
    ]).start();
  }, [scale, translateX, translateY]);

  useEffect(() => {
    if (!isActive) resetZoom();
  }, [isActive, resetZoom]);

  const zoomTo = useCallback(
    (target) => {
      gesture.current.scale = target;
      gesture.current.baseScale = target;
      const animations = [
        Animated.spring(scale, {
          toValue: target,
          useNativeDriver: true,
          friction: 8,
        }),
      ];
      if (target === 1) {
        gesture.current.translateX = 0;
        gesture.current.translateY = 0;
        gesture.current.baseTranslateX = 0;
        gesture.current.baseTranslateY = 0;
        animations.push(
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }),
        );
      }
      Animated.parallel(animations).start();
    },
    [scale, translateX, translateY],
  );

  const responder = useRef(null);
  if (!responder.current) {
    responder.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: (_, state) =>
        state.numberActiveTouches === 2 || gesture.current.scale > 1,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches || [];
        if (touches.length === 2) {
          gesture.current.initialDistance = getTouchDistance(touches);
        }
      },
      onPanResponderMove: (evt, state) => {
        const touches = evt.nativeEvent.touches || [];
        if (touches.length === 2) {
          const distance = getTouchDistance(touches);
          if (!gesture.current.initialDistance) {
            gesture.current.initialDistance = distance;
            return;
          }
          const nextScale = clampScale(
            gesture.current.baseScale *
              (distance / gesture.current.initialDistance),
          );
          gesture.current.scale = nextScale;
          scale.setValue(nextScale);
        } else if (touches.length === 1 && gesture.current.scale > 1) {
          const nextX = gesture.current.baseTranslateX + state.dx;
          const nextY = gesture.current.baseTranslateY + state.dy;
          gesture.current.translateX = nextX;
          gesture.current.translateY = nextY;
          translateX.setValue(nextX);
          translateY.setValue(nextY);
        }
      },
      onPanResponderRelease: () => {
        gesture.current.baseScale = gesture.current.scale;
        gesture.current.baseTranslateX = gesture.current.translateX;
        gesture.current.baseTranslateY = gesture.current.translateY;
        gesture.current.initialDistance = 0;
        if (gesture.current.scale < MIN_SCALE) zoomTo(MIN_SCALE);
      },
      onPanResponderTerminate: () => {
        gesture.current.baseScale = gesture.current.scale;
        gesture.current.baseTranslateX = gesture.current.translateX;
        gesture.current.baseTranslateY = gesture.current.translateY;
        gesture.current.initialDistance = 0;
      },
    });
  }

  const handleTap = () => {
    const now = Date.now();
    if (now - gesture.current.lastTap < DOUBLE_TAP_DELAY_MS) {
      gesture.current.lastTap = 0;
      zoomTo(gesture.current.scale > 1 ? MIN_SCALE : DOUBLE_TAP_SCALE);
    } else {
      gesture.current.lastTap = now;
    }
  };

  return (
    <View
      style={{ width, height, alignItems: "center", justifyContent: "center" }}
      {...responder.current.panHandlers}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleTap}
        style={{
          width,
          height,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Animated.Image
          source={{ uri }}
          resizeMode="contain"
          style={{
            width,
            height,
            transform: [{ translateX }, { translateY }, { scale }],
          }}
        />
      </TouchableOpacity>
    </View>
  );
}

/**
 * FullScreenImageViewer — full-screen Modal image gallery for a conversation's
 * image messages. Props: visible, images (image-type message list), startIndex,
 * onClose.
 */
export default function FullScreenImageViewer({
  visible,
  images = [],
  startIndex = 0,
  onClose,
}) {
  const { width, height } = Dimensions.get("window");
  const [currentIndex, setCurrentIndex] = useState(startIndex);

  useEffect(() => {
    if (visible) setCurrentIndex(startIndex);
  }, [visible, startIndex]);

  useEffect(() => {
    if (!visible || Platform.OS === "web" || !BackHandler) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onClose?.();
        return true;
      },
    );
    return () => subscription.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  const handleMomentumScrollEnd = (evt) => {
    const offsetX = evt.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    setCurrentIndex(Math.max(0, Math.min(images.length - 1, index)));
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          keyExtractor={(item, index) =>
            String(item.id || item.message_id || index)
          }
          onMomentumScrollEnd={handleMomentumScrollEnd}
          renderItem={({ item, index }) => (
            <ZoomableImage
              uri={getAssetUrl(item.media_url || item.file_url)}
              width={width}
              height={height}
              isActive={index === currentIndex}
            />
          )}
        />

        <TouchableOpacity
          style={[styles.closeBtn, { top: Platform.OS === "ios" ? 52 : 24 }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close image viewer"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        {images.length > 1 && (
          <View
            style={styles.counterWrap}
            accessibilityLabel={`Image ${currentIndex + 1} of ${images.length}`}
          >
            <Text style={styles.counterText}>
              {`${currentIndex + 1} / ${images.length}`}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
  },
  closeBtn: {
    position: "absolute",
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  closeText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  counterWrap: {
    position: "absolute",
    alignSelf: "center",
    bottom: 36,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  counterText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
