import React from "react";
import { ScrollView, Text, TouchableOpacity, StyleSheet } from "react-native";

export const CONVERSATION_FOLDERS = [
  { id: "all", label: "All", matches: () => true },
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

export default function ConversationFolders({ selectedId, onSelect, theme }) {
  return (
    <ScrollView
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
        return (
          <TouchableOpacity
            key={folder.id}
            accessibilityRole="tab"
            accessibilityLabel={folder.label}
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
    flexGrow: 1,
    minWidth: 80,
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 3,
  },
  label: { fontSize: 14, fontWeight: "700" },
});
