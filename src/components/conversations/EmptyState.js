import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";

function SearchIcon({ color }) {
  return (
    <Svg width="36" height="36" viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" />
      <Path
        d="M21 21l-4.3-4.3"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function ChatIcon({ color }) {
  return (
    <Svg width="36" height="36" viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function EmptyState({ theme: t, isSearchEmpty }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        {isSearchEmpty ? (
          <SearchIcon color={t.textMuted} />
        ) : (
          <ChatIcon color={t.textMuted} />
        )}
      </View>
      <Text style={[styles.title, { color: t.text }]}>
        {isSearchEmpty ? "No users found" : "No conversations yet"}
      </Text>
      <Text style={[styles.sub, { color: t.textMuted }]}>
        {isSearchEmpty
          ? "Try a different search term"
          : "Search for a user to start chatting"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  iconWrap: { marginBottom: 14, opacity: 0.6 },
  title: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  sub: { fontSize: 13.5, textAlign: "center", lineHeight: 20 },
});
