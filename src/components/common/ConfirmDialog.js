import React from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onCancel}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingHorizontal: 12,
          paddingTop: insets.top + 12,
          paddingBottom: Math.max(insets.bottom, 12),
        }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20 }}
          style={{
            width: "100%",
            maxWidth: 560,
            maxHeight: "80%",
            flexGrow: 0,
            backgroundColor: t.bg,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: t.borderColor,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: t.text,
              marginBottom: 8,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: t.textMuted,
              lineHeight: 22,
              marginBottom: 20,
            }}
          >
            {message}
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "flex-end",
              gap: 12,
            }}
          >
            <TouchableOpacity
              onPress={onCancel}
              accessibilityRole="button"
              style={{
                minHeight: 48,
                maxWidth: "100%",
                justifyContent: "center",
                paddingVertical: 12,
                paddingHorizontal: 14,
              }}
            >
              <Text
                style={{ fontSize: 15, fontWeight: "500", color: t.textMuted }}
              >
                {cancelLabel}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              accessibilityRole="button"
              style={{
                minHeight: 48,
                maxWidth: "100%",
                justifyContent: "center",
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 8,
                backgroundColor: destructive ? "#ac343f" : t.buttonBg,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
