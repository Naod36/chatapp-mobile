import React, { memo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import Avatar from "../common/Avatar";
import MessageStatusIcon from "../common/MessageStatusIcon";
import { useApp } from "../../context/AppContext";

function formatTime(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0)
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

/**
 * ConversationItem — a single row in the conversation list.
 * Props: conversation, onPress, typingMap, theme, user
 */
function ConversationItem({
  conversation: c,
  onPress,
  isTyping,
  isPinned = false,
  isMuted = false,
}) {
  const {
    theme: t,
    getPresence,
    user,
    isBlockedBy,
    getBlockPolicy,
    blockStateReady,
    blockedByUserIds,
  } = useApp();
  const isGroup = c.type === "group";
  const isSaved =
    c.id === "virtual-saved-messages" ||
    (c.type === "direct" && !c.other_participant);

  const otherUser = c.other_participant;
  const otherUserId = String(otherUser?.user_id || otherUser?.id || "");
  // Mask only when THEY blocked ME — if I blocked them, I still see them normally.
  const blocked =
    !isGroup && !isSaved && (!blockStateReady || isBlockedBy(otherUserId));
  const directDisabled =
    !isGroup &&
    (!blockStateReady || getBlockPolicy(otherUserId).preventDirectInteraction);
  const suppressReceipts =
    !blockStateReady ||
    directDisabled ||
    (isGroup && blockedByUserIds.length > 0);
  isTyping = blockStateReady && !directDisabled && isTyping;

  const presenceStatus = getPresence(otherUserId);
  const isOnline =
    !isGroup &&
    !isSaved &&
    !blocked &&
    (presenceStatus === "online" ||
      otherUser?.status === "online" ||
      c.status === "online");

  // isTyping comes from the parent via props (see ConversationListScreen renderItem)
  const hasUnread = (c.unread_count || 0) > 0;

  const name = blocked
    ? "Person Not Available"
    : isSaved
      ? "Saved Messages"
      : c.display_name ||
        c.title ||
        otherUser?.display_name ||
        otherUser?.username ||
        "Chat";

  // Derive preview text — check multiple possible field names from API
  let rawPreview = c.last_message_content || c.last_message?.content || "";
  if (!rawPreview && c.last_message) {
    const mt = c.last_message.message_type;
    if (mt === "image") rawPreview = "Image";
    else if (mt === "voice" || mt === "audio") rawPreview = "Voice message";
    else if (mt === "file") rawPreview = c.last_message.file_name || "File";
    else if (mt === "video") rawPreview = "Video";
  }

  const preview = blocked
    ? "You can no longer message this person"
    : isTyping
      ? "typing..."
      : rawPreview ||
        (isGroup
          ? `${c.participants?.length || 0} members`
          : "No messages yet");

  const isOwnLastMsg =
    c.last_message && String(c.last_message.sender_id) === String(user?.userId);

  return (
    <TouchableOpacity
      style={[
        styles.row,
        { borderBottomColor: t.borderColor },
        isPinned && {
          backgroundColor: t.accent + "10",
          borderLeftWidth: 3,
          borderLeftColor: t.accent,
          paddingLeft: 11,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Avatar
        uri={blocked ? null : isGroup ? c.avatar_url : otherUser?.avatar_url}
        name={name}
        size={50}
        isOnline={isOnline}
        borderColor={t.bg}
        isGroup={isGroup}
        isSaved={isSaved}
      />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text
            style={[styles.time, { color: hasUnread ? t.accent : t.textMuted }]}
          >
            {isSaved ? "" : formatTime(c.last_message_time)}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.previewRow}>
            {!suppressReceipts && !isTyping && isOwnLastMsg && (
              <MessageStatusIcon
                status={c.last_message?.status}
                isOwn
                isDark={t.isDark}
              />
            )}
            <Text
              style={[
                styles.preview,
                {
                  color: isTyping ? t.accent : hasUnread ? t.text : t.textMuted,
                  fontWeight: isTyping || hasUnread ? "600" : "400",
                },
              ]}
              numberOfLines={1}
            >
              {preview}
            </Text>
          </View>

          {isPinned && (
            <View
              accessibilityLabel="Pinned chat"
              style={{ marginRight: hasUnread || isMuted ? 8 : 0 }}
            >
              <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <Path
                  d="M16 3l5 5-4 1-4 4v4l-3-3-6 6 6-6-3-3h4l4-4z"
                  stroke={t.accent}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          )}
          {isMuted && (
            <View
              accessibilityLabel="Muted chat"
              style={{ marginRight: hasUnread ? 8 : 0 }}
            >
              <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <Path
                  d="M15 8a3 3 0 00-6 0v4l-2 3h10l-2-3V8z"
                  stroke={t.textMuted}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d="M3 3l18 18"
                  stroke={t.textMuted}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          )}
          {hasUnread && (
            <View style={[styles.badge, { backgroundColor: t.buttonBg }]}>
              <Text style={styles.badgeText}>
                {c.unread_count > 99 ? "99+" : c.unread_count}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default memo(ConversationItem);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
    marginRight: 6,
  },
  time: {
    fontSize: 11,
    fontWeight: "500",
    flexShrink: 0,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 3,
    marginRight: 6,
  },
  preview: {
    fontSize: 13.5,
    flex: 1,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
});
