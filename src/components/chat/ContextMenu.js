import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from "react-native";

const REACTION_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🔥"];

/**
 * ContextMenu — long-press message action modal.
 * Props: visible, message, isOwn, theme, onReact, onReply, onCopy, onEdit, onPin, onDelete, onClose
 */
export default function ContextMenu({
  visible,
  message,
  isOwn,
  isPinned,
  theme: t,
  onReact,
  onReply,
  onCopy,
  onEdit,
  onPin,
  onDelete,
  onClose,
  interactionsDisabled = false,
}) {
  if (!message) return null;

  const actions = [
    { label: "Reply", onPress: onReply },
    ...(isOwn && message.content
      ? [{ label: "Edit Message", onPress: onEdit }]
      : []),
    { label: "Copy Text", onPress: onCopy, disabled: !message.content },
    {
      label: isPinned || message.is_pinned ? "Unpin Message" : "Pin Message",
      onPress: onPin,
    },
    ...(isOwn ? [{ label: "Delete", onPress: onDelete, danger: true }] : []),
  ].filter((action) => !interactionsDisabled || action.onPress === onCopy);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.panel,
                { backgroundColor: t.cardBg, borderColor: t.borderColor },
              ]}
            >
              {/* Emoji Quick Reactions Bar */}
              {!interactionsDisabled && (
                <View
                  style={[
                    styles.emojiBar,
                    { borderBottomColor: t.borderColor },
                  ]}
                >
                  {REACTION_EMOJIS.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={styles.emojiBtn}
                      onPress={() => {
                        onReact?.(message, emoji);
                        onClose();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 22 }}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Preview of selected message */}
              {message.content ? (
                <Text
                  style={[styles.preview, { color: t.textMuted }]}
                  numberOfLines={2}
                >
                  {message.content}
                </Text>
              ) : null}

              <View
                style={[styles.divider, { backgroundColor: t.borderColor }]}
              />

              {actions.map((action, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.action, action.disabled && { opacity: 0.4 }]}
                  onPress={() => {
                    if (!action.disabled) {
                      action.onPress();
                    }
                  }}
                  disabled={action.disabled}
                >
                  <Text
                    style={[
                      styles.actionText,
                      { color: action.danger ? t.danger : t.text },
                    ]}
                  >
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={[
                  styles.action,
                  styles.cancelAction,
                  { borderTopColor: t.borderColor },
                ]}
                onPress={onClose}
              >
                <Text style={[styles.actionText, { color: t.textMuted }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  panel: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  emojiBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  emojiBtn: {
    padding: 6,
    borderRadius: 12,
  },
  preview: {
    fontSize: 13,
    padding: 14,
    paddingBottom: 10,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    marginHorizontal: 0,
  },
  action: {
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  cancelAction: {
    borderTopWidth: 1,
  },
  actionText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
