import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import Svg, { Circle, Path } from "react-native-svg";
import Avatar from "../common/Avatar";
import { useApp } from "../../context/AppContext";

/**
 * ChatHeader — top navigation bar for the chat screen.
 * Shows: back button, avatar + online dot, name, status/typing subtitle.
 */
export default function ChatHeader({
  conversation,
  typingUser,
  onBack,
  onMorePress,
  onSearchPress,
  isBlocked = false,
  disableTyping = false,
}) {
  const insets = useSafeAreaInsets();
  const { theme: t, getPresence, updateBannerVisible } = useApp();

  const isGroup = conversation?.type === "group";
  const isSaved =
    !conversation?.other_participant && conversation?.type === "direct";
  const otherUser = conversation?.other_participant;

  const name = isBlocked
    ? "Person Not Available"
    : isGroup
      ? conversation?.title || conversation?.display_name || "Group Chat"
      : isSaved
        ? "Saved Messages"
        : otherUser?.display_name || otherUser?.username || "Chat";

  const avatarUri = isBlocked
    ? null
    : isGroup
      ? conversation?.avatar_url
      : otherUser?.avatar_url;

  const otherUserId = String(otherUser?.user_id || otherUser?.id || "");
  const presenceStatus = getPresence(otherUserId);
  const isOnline =
    !isBlocked &&
    !isGroup &&
    !isSaved &&
    (presenceStatus === "online" ||
      otherUser?.status === "online" ||
      conversation?.status === "online");

  const isTyping = !isBlocked && !disableTyping && Boolean(typingUser);

  let subtitle = "";
  if (isBlocked) {
    subtitle = "";
  } else if (isTyping) {
    subtitle = "typing...";
  } else if (isOnline) {
    subtitle = "online";
  } else if (isGroup) {
    subtitle = `${conversation?.participants?.length || 0} members`;
  }

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: t.headerBg,
          borderColor: t.borderColor,
          marginTop: (updateBannerVisible ? 0 : insets.top) + 8,
        },
      ]}
    >
      <BlurView
        intensity={t.isDark ? 45 : 65}
        tint={t.isDark ? "dark" : "light"}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { zIndex: -1 }]}
      />
      <TouchableOpacity
        style={styles.backBtn}
        onPress={onBack}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={[styles.backIcon, { color: t.accent }]}>‹</Text>
      </TouchableOpacity>

      <Avatar
        uri={avatarUri}
        name={name}
        size={40}
        isOnline={isOnline}
        borderColor={t.headerBg}
        isGroup={isGroup}
        isSaved={isSaved}
      />

      <View style={styles.titleArea}>
        <Text style={[styles.titleText, { color: t.text }]} numberOfLines={1}>
          {name}
        </Text>
        {subtitle ? (
          <Text
            style={[
              styles.subtitleText,
              {
                color: typingUser || isOnline ? t.success : t.textMuted,
              },
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {onSearchPress && (
        <TouchableOpacity
          onPress={onSearchPress}
          accessibilityRole="button"
          accessibilityLabel="Search messages"
          style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          {...(Platform.OS === "web" ? { title: "Search messages" } : {})}
        >
          <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <Circle cx="10.5" cy="10.5" r="6.5" stroke={t.textMuted} strokeWidth="2" />
            <Path d="M16 16l5 5" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" />
          </Svg>
        </TouchableOpacity>
      )}
      {onMorePress && (
        <TouchableOpacity
          onPress={onMorePress}
          style={styles.moreBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.moreIcon, { color: t.textMuted }]}>⋮</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  backBtn: {
    paddingRight: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  backIcon: {
    fontSize: 34,
    lineHeight: 36,
    fontWeight: "300",
  },
  titleArea: {
    flex: 1,
    justifyContent: "center",
  },
  titleText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  subtitleText: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1,
  },
  moreBtn: {
    paddingLeft: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  moreIcon: {
    fontSize: 20,
    fontWeight: "700",
  },
});
