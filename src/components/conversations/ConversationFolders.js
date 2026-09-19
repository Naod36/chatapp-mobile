import React, { useRef, useEffect } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  StyleSheet,
  View,
} from "react-native";

export const CONVERSATION_FOLDERS = [
  { id: "all", label: "All", matches: () => true },
  {
    id: "unread",
    label: "Unread",
    matches: (conversation) => (conversation.unread_count || 0) > 0,
    emptyText: "No unread chats",
  },
  {
    id: "chats",
    label: "Chats",
    matches: (conversation) => conversation.type === "direct",
    emptyText: "No private chats yet",
  },
  {
    id: "groups",
    label: "Groups",
    matches: (conversation) => conversation.type === "group",
    emptyText: "No groups yet",
  },
];

export function conversationsInFolder(conversations, folderId, pinnedIds = []) {
  const folder =
    CONVERSATION_FOLDERS.find((item) => item.id === folderId) ||
    CONVERSATION_FOLDERS[0];
  const pins = new Set(pinnedIds.map(String));
  return conversations
    .filter(folder.matches)
    .sort(
      (first, second) =>
        Number(pins.has(String(second.id || second.conversation_id))) -
        Number(pins.has(String(first.id || first.conversation_id))),
    );
}

export function folderUnreadCount(conversations, folderId) {
  const seen = new Set();
  return conversationsInFolder(conversations, folderId).reduce(
    (total, conversation) => {
      const identity = String(conversation.id || conversation.conversation_id);
      if (seen.has(identity)) return total;
      seen.add(identity);
      return total + Math.max(0, Number(conversation.unread_count) || 0);
    },
    0,
  );
}

export default function ConversationFolders({
  selectedId,
  onSelect,
  theme,
  conversations = [],
}) {
  const scrollRef = useRef(null);
  const layouts = useRef({});
  const revealSelected = () => {
    const layout = layouts.current[selectedId];
    if (layout)
      scrollRef.current?.scrollTo({
        x: Math.max(0, layout.x - 12),
        animated: true,
      });
  };
  useEffect(revealSelected, [selectedId]);
  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[
        styles.bar,
        {
          backgroundColor: theme.headerBg,
          borderBottomColor: theme.borderColor,
        },
      ]}
      contentContainerStyle={styles.tabs}
    >
      {CONVERSATION_FOLDERS.map((folder) => {
        const selected = folder.id === selectedId;
        const unread = folderUnreadCount(conversations, folder.id);
        return (
          <TouchableOpacity
            key={folder.id}
            onLayout={({ nativeEvent }) => {
              layouts.current[folder.id] = nativeEvent.layout;
              if (selected) revealSelected();
            }}
            accessibilityRole="tab"
            accessibilityLabel={
              unread
                ? `${folder.label}, ${unread} unread messages`
                : folder.label
            }
            accessibilityState={{ selected }}
            onPress={() => onSelect(folder.id)}
            activeOpacity={0.7}
            style={[
              styles.tab,
              { borderBottomColor: selected ? theme.accent : "transparent" },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: selected ? theme.accent : theme.textMuted },
              ]}
            >
              {folder.label}
            </Text>
            {unread > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.buttonBg }]}>
                <Text style={styles.badgeText}>
                  {unread > 99 ? "99+" : unread}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexGrow: 0,
    flexShrink: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabs: { flexGrow: 1, paddingHorizontal: 12 },
  tab: {
    flexDirection: "row",
    gap: 6,
    flexGrow: 1,
    minWidth: 80,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 3,
  },
  label: { fontSize: 14, fontWeight: "700" },
  badge: {
    minWidth: 28,
    height: 22,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#fff" },
});
