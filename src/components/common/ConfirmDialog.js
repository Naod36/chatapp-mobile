import React from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";

// Custom in-app confirmation modal. Intentionally not using React Native's
// Alert.alert here — react-native-web does not render multi-button Alert
// configs (Cancel + destructive action), so it silently no-ops on web.
export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
  theme: t,
}) {
  if (!visible) return null;
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 340,
            backgroundColor: t.bg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: t.borderColor,
            padding: 20,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: t.text,
              marginBottom: 8,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: t.textMuted,
              lineHeight: 18,
              marginBottom: 20,
            }}
          >
            {message}
          </Text>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: 12,
            }}
          >
            <TouchableOpacity
              onPress={onCancel}
              style={{ paddingVertical: 8, paddingHorizontal: 14 }}
            >
              <Text
                style={{ fontSize: 13, fontWeight: "700", color: t.textMuted }}
              >
                {cancelLabel}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 8,
                backgroundColor: destructive ? "#ef4444" : t.accent,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
