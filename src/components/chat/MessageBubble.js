import React, { memo } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import MessageStatusIcon from "../common/MessageStatusIcon";
import VoicePlayer from "./VoicePlayer";
import { API_BASE } from "../../services/api";

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

function formatTime(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const SENDER_COLORS = [
  "#0284c7",
  "#818cf8",
  "#f43f5e",
  "#d97706",
  "#059669",
  "#7c3aed",
  "#db2777",
];
function senderColor(id) {
  if (!id) return SENDER_COLORS[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return SENDER_COLORS[Math.abs(h) % SENDER_COLORS.length];
}

function MessageBubble({
  msg,
  isOwn,
  isGroup,
  theme: t,
  currentUserId,
  participants,
  otherParticipant,
  userProfile,
  onToggleReaction,
  onLongPress,
}) {
  const isImage = msg.message_type === "image";
  const isVoice = msg.message_type === "voice" || msg.message_type === "audio";
  const isFile = msg.message_type === "file";
  const isVideo = msg.message_type === "video";

  const bubbleBg = isOwn ? t.userBubbleBg : t.otherBubbleBg;
  const textColor = isOwn ? t.userBubbleText : t.otherBubbleText;

  return (
    <TouchableOpacity
      style={[styles.row, isOwn ? styles.rowRight : styles.rowLeft]}
      onLongPress={() => onLongPress(msg)}
      activeOpacity={0.85}
      delayLongPress={300}
    >
      {/* Group received avatar */}
      {!isOwn && isGroup && (
        <View
          style={[
            styles.groupAvatar,
            { backgroundColor: senderColor(msg.sender_id || msg.user_id) },
          ]}
        >
          <Text style={styles.groupAvatarText}>
            {(msg.sender_name || "?")[0].toUpperCase()}
          </Text>
        </View>
      )}

      <View
        style={[
          styles.bubbleWrap,
          { alignItems: isOwn ? "flex-end" : "flex-start" },
        ]}
      >
        {/* Bubble */}
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: bubbleBg,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              borderBottomRightRadius: isOwn ? 4 : 18,
              borderBottomLeftRadius: isOwn ? 18 : 4,
            },
          ]}
        >
          {/* Group sender name */}
          {isGroup && !isOwn && msg.sender_name && (
            <Text
              style={[
                styles.senderName,
                { color: senderColor(msg.sender_id || msg.user_id) },
              ]}
            >
              {msg.sender_name}
            </Text>
          )}

          {/* Reply preview */}
          {msg.reply_to && (
            <View
              style={[
                styles.replyPreview,
                {
                  borderLeftColor: isOwn
                    ? t.isDark
                      ? "#818cf8"
                      : "#fff"
                    : t.accent,
                  backgroundColor: isOwn
                    ? "rgba(0,0,0,0.12)"
                    : "rgba(0,0,0,0.05)",
                },
              ]}
            >
              <Text
                style={[
                  styles.replyName,
                  { color: isOwn ? (t.isDark ? "#818cf8" : "#fff") : t.accent },
                ]}
                numberOfLines={1}
              >
                {msg.reply_to.sender_name || "Reply"}
              </Text>
              <Text
                style={[
                  styles.replyContent,
                  { color: isOwn ? "rgba(255,255,255,0.8)" : t.textMuted },
                ]}
                numberOfLines={1}
              >
                {msg.reply_to.content || "Media"}
              </Text>
            </View>
          )}

          {/* Image */}
          {isImage && (msg.media_url || msg.file_url) && (
            <Image
              source={{ uri: getAssetUrl(msg.media_url || msg.file_url) }}
              style={styles.imageAttachment}
              resizeMode="cover"
            />
          )}

          {/* Voice */}
          {isVoice && (msg.media_url || msg.file_url) && (
            <VoicePlayer
              src={getAssetUrl(msg.media_url || msg.file_url)}
              isOwn={isOwn}
              theme={t}
            />
          )}

          {/* File */}
          {isFile && (
            <View style={styles.mediaRow}>
              <Text style={{ fontSize: 16 }}>📎</Text>
              <Text
                style={[styles.mediaLabel, { color: textColor }]}
                numberOfLines={1}
              >
                {msg.file_name || "File"}
              </Text>
            </View>
          )}

          {/* Video */}
          {isVideo && (
            <View style={styles.mediaRow}>
              <Text style={{ fontSize: 16 }}>🎥</Text>
              <Text style={[styles.mediaLabel, { color: textColor }]}>
                Video
              </Text>
            </View>
          )}

          {/* Text */}
          {!!msg.content && (
            <Text style={[styles.msgText, { color: textColor }]}>
              {msg.content}
            </Text>
          )}
        </View>

        {/* Reaction Pills */}
        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <View
            style={[
              styles.reactionsRow,
              { justifyContent: isOwn ? "flex-end" : "flex-start" },
            ]}
          >
            {Object.entries(msg.reactions).map(([emoji, uids]) => {
              const hasReacted =
                Array.isArray(uids) && uids.includes(currentUserId);

              const reactUsers = uids.map((uid) => {
                const normUid = String(uid);
                if (normUid === currentUserId) {
                  return {
                    avatar: userProfile?.avatar_url,
                    initial: (userProfile?.username || "U")[0].toUpperCase(),
                  };
                }
                if (String(msg.sender_id || msg.user_id) === normUid) {
                  return {
                    avatar: msg.sender_avatar,
                    initial: (msg.sender_name || "?")[0].toUpperCase(),
                  };
                }
                const part = (participants || []).find(
                  (p) => String(p.user_id || p.id) === normUid,
                );
                if (part) {
                  return {
                    avatar: part.avatar_url,
                    initial: (part.display_name ||
                      part.username ||
                      "?")[0].toUpperCase(),
                  };
                }
                if (
                  otherParticipant &&
                  String(otherParticipant.user_id || otherParticipant.id) ===
                    normUid
                ) {
                  return {
                    avatar: otherParticipant.avatar_url,
                    initial: (otherParticipant.display_name ||
                      otherParticipant.username ||
                      "?")[0].toUpperCase(),
                  };
                }
                return { avatar: null, initial: "?" };
              });

              const shownUsers = reactUsers.slice(0, 3);

              return (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => onToggleReaction?.(msg, emoji)}
                  style={[
                    styles.reactionPill,
                    {
                      backgroundColor: hasReacted
                        ? t.isDark
                          ? "rgba(63,224,197,0.18)"
                          : "rgba(2,132,199,0.12)"
                        : t.isDark
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(0,0,0,0.04)",
                      borderColor: hasReacted ? "#3FE0C5" : t.borderColor,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={styles.avatarStack}>
                    {shownUsers.map((u, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.rxAvatar,
                          {
                            marginLeft: idx === 0 ? 0 : -6,
                            zIndex: shownUsers.length - idx,
                            backgroundColor: u.avatar
                              ? "transparent"
                              : "#4A3FE0",
                          },
                        ]}
                      >
                        {u.avatar ? (
                          <Image
                            source={{ uri: getAssetUrl(u.avatar) }}
                            style={styles.rxAvatarImg}
                          />
                        ) : (
                          <Text style={styles.rxAvatarText}>{u.initial}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                  {uids.length > 1 && (
                    <Text
                      style={[
                        styles.reactionCount,
                        { color: hasReacted ? "#3FE0C5" : t.textMuted },
                      ]}
                    >
                      {uids.length}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Footer: time + tick */}
        <View style={styles.footer}>
          <Text style={[styles.time, { color: t.textMuted }]}>
            {formatTime(msg.created_at || msg.timestamp)}{" "}
            {msg.is_edited ? "(edited)" : ""}
          </Text>
          <MessageStatusIcon
            status={msg.status}
            isOwn={isOwn}
            isDark={t.isDark}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default memo(MessageBubble);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginVertical: 3,
    paddingHorizontal: 12,
    alignItems: "flex-end",
    gap: 6,
  },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  groupAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginBottom: 16,
  },
  groupAvatarText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  bubbleWrap: {
    maxWidth: "76%",
    flexShrink: 1,
  },
  bubble: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
  },
  senderName: {
    fontSize: 11.5,
    fontWeight: "700",
    marginBottom: 3,
  },
  replyPreview: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 4,
    marginBottom: 6,
    borderRadius: 4,
  },
  replyName: { fontSize: 11, fontWeight: "700" },
  replyContent: { fontSize: 11, marginTop: 1 },
  imageAttachment: {
    width: 220,
    height: 180,
    borderRadius: 10,
    marginBottom: 4,
  },
  mediaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  mediaLabel: { fontSize: 13, fontWeight: "600" },
  msgText: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  reactionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 2,
  },
  rxAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#0B0E16",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  rxAvatarImg: {
    width: "100%",
    height: "100%",
  },
  rxAvatarText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "800",
  },
  reactionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 5,
    paddingRight: 8,
    paddingVertical: 3,
    borderRadius: 14,
    borderWidth: 1,
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 11,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 2,
  },
  time: {
    fontSize: 10.5,
    fontWeight: "500",
  },
});
