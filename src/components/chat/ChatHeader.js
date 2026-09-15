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
import Avatar from "../common/Avatar";
import { useApp } from "../../context/AppContext";

/**
 * ChatHeader — top navigation bar for the chat screen.
 * Shows: back button, avatar + online dot, name, status/typing subtitle.
 */
export default function ChatHeader({ conversation, typingUser, onBack, onMorePress }) {
  const insets = useSafeAreaInsets();
  const { theme: t, getPresence, typingMap, updateBannerVisible } = useApp();

  const convIdStr = String(
    conversation?.id || conversation?.conversation_id || "",
  );
  const isGroup = conversation?.type === "group";
  const isSaved =
    !conversation?.other_participant && conversation?.type === "direct";
  const otherUser = conversation?.other_participant;

  const name = isGroup
    ? conversation?.title || conversation?.display_name || "Group Chat"
    : isSaved
      ? "Saved Messages"
      : otherUser?.display_name || otherUser?.username || "Chat";

  const avatarUri = isGroup ? conversation?.avatar_url : otherUser?.avatar_url;

  const otherUserId = String(otherUser?.user_id || otherUser?.id || "");
  const presenceStatus = getPresence(otherUserId);
  const isOnline =
    !isGroup &&
    !isSaved &&
    (presenceStatus === "online" ||
      otherUser?.status === "online" ||
      conversation?.status === "online");

  const isTyping = Boolean(typingUser || typingMap?.[convIdStr]);

  let subtitle = "";
  if (isTyping) {
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
                color: typingUser || isOnline ? "#22c55e" : t.textMuted,
              },
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

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
