import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * ChatOptionsMenu — dropdown opened from the chat header's "⋮" button.
 * Add future per-conversation actions (mute, etc.) as additional rows here.
 */
export default function ChatOptionsMenu({
  visible,
  onClose,
  theme: t,
  isBlocked,
  onToggleBlock,
  isPinned,
  onTogglePin,
}) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      />
      <View
        style={[
          styles.menu,
          {
            top: insets.top + 64,
            backgroundColor: t.cardBg,
            borderColor: t.borderColor,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.6}
          onPress={() => {
            onClose();
            onTogglePin();
          }}
        >
          <Text style={[styles.rowText, { color: t.text }]}>
            {isPinned ? "Unpin Chat" : "Pin Chat"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.6}
          onPress={() => {
            onClose();
            onToggleBlock();
          }}
        >
          <Text style={[styles.rowText, { color: t.danger }]}>
            {isBlocked ? "Unblock User" : "Block User"}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: "absolute",
    right: 16,
    minWidth: 180,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowText: {
    fontSize: 14.5,
    fontWeight: "600",
  },
});
