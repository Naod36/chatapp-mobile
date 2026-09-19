import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context/AppContext";
import { subscribe, getNotice, dismissNotice } from "../../services/notices";

export default function NoticeHost() {
  const { theme } = useApp();
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState(getNotice);
  useEffect(() => subscribe(setNotice), []);
  if (!notice) return null;
  const actions = notice.buttons?.length
    ? notice.buttons
    : [{ text: "Dismiss" }];
  const close = () => dismissNotice(notice.id);
  return (
    <Modal
      transparent
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View
        style={[
          styles.overlay,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 },
        ]}
      >
        <View
          accessibilityViewIsModal
          style={[
            styles.notice,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.borderColor,
              borderLeftColor: theme.accent,
            },
          ]}
        >
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.copy}
          >
            <Text
              accessibilityRole="header"
              accessibilityLiveRegion="polite"
              style={[styles.title, { color: theme.text }]}
            >
              {notice.title}
            </Text>
            {!!notice.message && (
              <Text style={[styles.message, { color: theme.textMuted }]}>
                {notice.message}
              </Text>
            )}
            <View style={styles.actions}>
              {actions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  accessibilityRole="button"
                  onPress={() => dismissNotice(notice.id, action)}
                  style={styles.action}
                >
                  <Text
                    style={[
                      styles.actionText,
                      {
                        color:
                          action.style === "destructive"
                            ? theme.danger
                            : theme.accent,
                      },
                    ]}
                  >
                    {action.text || "OK"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  notice: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "70%",
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 8,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  content: { flexGrow: 0 },
  copy: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  message: { fontSize: 14, lineHeight: 21, marginTop: 4 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
  },
  action: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: "center",
    maxWidth: "100%",
  },
  actionText: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
});
