import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import Svg, { Circle, Path } from "react-native-svg";
import Avatar from "../common/Avatar";
import { useApp } from "../../context/AppContext";
import { presenceLabel } from "../../utils/presence";

export function UserProfileDetails({
  visible,
  person,
  unavailable,
  onClose,
  theme,
}) {
  const insets = useSafeAreaInsets();
  const { getPresence } = useApp();
  const identity = person?.user_id || person?.id;
  const online =
    !unavailable &&
    person?.presence_visibility !== "invisible" &&
    person?.status !== "hidden" &&
    getPresence(identity) !== "hidden" &&
    (getPresence(identity) === "online" || person?.status === "online");
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
          }}
        >
          <Text
            style={{
              flex: 1,
              fontSize: 18,
              fontWeight: "700",
              color: theme.text,
            }}
          >
            Profile
          </Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close profile"
            style={{
              minWidth: 64,
              minHeight: 48,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: theme.accent, fontWeight: "600" }}>Done</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
          {unavailable || !person ? (
            <Text style={{ color: theme.text }}>Person Not Available</Text>
          ) : (
            <>
              <Avatar
                uri={person.avatar_url}
                name={person.display_name || person.username}
                size={96}
                isOnline={online}
              />
              <Text
                selectable
                style={{ fontSize: 22, fontWeight: "700", color: theme.text }}
              >
                {person.display_name || person.username}
              </Text>
              {!!person.username && (
                <Text
                  selectable
                  style={{ fontSize: 16, color: theme.textMuted }}
                >
                  @{person.username}
                </Text>
              )}
              <Text style={{ color: online ? theme.success : theme.textMuted }}>
                {presenceLabel(
                  person,
                  (date) => `Last seen ${new Date(date).toLocaleString()}`,
                )}
              </Text>
              {!!person.bio && (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: theme.textMuted, fontSize: 14 }}>
                    Bio
                  </Text>
                  <Text
                    selectable
                    style={{ color: theme.text, fontSize: 16, lineHeight: 24 }}
                  >
                    {person.bio}
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

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
  onTitlePress,
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
    presenceStatus !== "hidden" &&
    otherUser?.presence_visibility !== "invisible" &&
    otherUser?.status !== "hidden" &&
    (presenceStatus === "online" ||
      otherUser?.status === "online" ||
      conversation?.status === "online");

  const isTyping = !isBlocked && !disableTyping && Boolean(typingUser);

  let subtitle = "";
  if (isBlocked) {
    subtitle = "";
  } else if (isTyping) {
    subtitle = "typing...";
  } else if (isGroup) {
    subtitle = `${conversation?.participants?.length || 0} members`;
  } else if (!isSaved) {
    subtitle = presenceLabel(
      otherUser,
      (date) => `Last seen ${new Date(date).toLocaleString()}`,
    );
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

      <TouchableOpacity
        onPress={onTitlePress}
        disabled={!onTitlePress}
        accessibilityRole={onTitlePress ? "button" : undefined}
        accessibilityLabel={
          onTitlePress
            ? isGroup
              ? "Open group info from avatar"
              : "Open user profile from avatar"
            : undefined
        }
        style={{
          minWidth: 48,
          minHeight: 48,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Avatar
          uri={avatarUri}
          name={name}
          size={40}
          isOnline={isOnline}
          borderColor={t.headerBg}
          isGroup={isGroup}
          isSaved={isSaved}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.titleArea}
        activeOpacity={onTitlePress ? 0.7 : 1}
        disabled={!onTitlePress}
        onPress={onTitlePress}
        accessibilityRole={onTitlePress ? "button" : undefined}
        accessibilityLabel={
          onTitlePress
            ? isGroup
              ? "Open group info"
              : "Open user profile"
            : undefined
        }
      >
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
      </TouchableOpacity>

      {onSearchPress && (
        <TouchableOpacity
          onPress={onSearchPress}
          accessibilityRole="button"
          accessibilityLabel="Search messages"
          style={{
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          {...(Platform.OS === "web" ? { title: "Search messages" } : {})}
        >
          <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <Circle
              cx="10.5"
              cy="10.5"
              r="6.5"
              stroke={t.textMuted}
              strokeWidth="2"
            />
            <Path
              d="M16 16l5 5"
              stroke={t.textMuted}
              strokeWidth="2"
              strokeLinecap="round"
            />
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
    minHeight: 48,
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
