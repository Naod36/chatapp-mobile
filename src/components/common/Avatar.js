import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { API_BASE } from "../../services/api";

function BookmarkIcon({ size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z" fill="#fff" />
    </Svg>
  );
}

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

const AVATAR_COLORS = [
  "#39647b",
  "#56617d",
  "#725773",
  "#875367",
  "#326d60",
  "#795e3f",
  "#8a4d49",
  "#396b70",
];

function getColorForName(name) {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Avatar component with optional online presence dot.
 * Props:
 *   uri        - image URL (relative or absolute)
 *   name       - display name (for initial fallback)
 *   size       - diameter in px (default 42)
 *   isOnline   - shows green dot if true
 *   borderColor - color of the online dot border (matches parent bg)
 *   style      - extra container styles
 */
export default function Avatar({
  uri,
  name,
  size = 42,
  isOnline = false,
  borderColor = "#fff",
  style,
  isGroup = false,
  isSaved = false,
}) {
  const resolvedUri = getAssetUrl(uri);
  const initial = name?.[0]?.toUpperCase() || (isGroup ? "G" : "?");
  const bgColor = isSaved
    ? "#875367"
    : isGroup
      ? "#56617d"
      : getColorForName(name);

  const dotSize = Math.max(10, size * 0.26);

  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bgColor,
          },
        ]}
      >
        {isSaved ? (
          <BookmarkIcon size={size * 0.42} />
        ) : resolvedUri ? (
          <Image
            source={{ uri: resolvedUri }}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
            }}
            resizeMode="cover"
          />
        ) : (
          <Text
            style={{
              color: "#fff",
              fontSize: size * 0.38,
              fontWeight: "800",
            }}
          >
            {initial}
          </Text>
        )}
      </View>

      {isOnline && (
        <View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              borderWidth: 2,
              borderColor,
              bottom: 0,
              right: 0,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  dot: {
    position: "absolute",
    backgroundColor: "#39836c",
  },
});
