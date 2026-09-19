import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import { userService } from "../../services/user";
import { websocketService } from "../../services/websocket";
import { presenceFields, statusExpiry } from "../../utils/presence";

export default function PresenceSettings({ theme, visible }) {
  const [draft, setDraft] = useState(null);
  const [expiry, setExpiry] = useState("keep");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [menu, setMenu] = useState(null);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let owner;
    setDraft(null);
    setMessage("");
    const load = () =>
      userService
        .getProfile()
        .then((profile) => {
          if (cancelled) return;
          owner = profile.user_id;
          setDraft(presenceFields(profile));
          setExpiry("keep");
        })
        .catch((error) => {
          if (!cancelled) setMessage(error.message);
        });
    load();
    const listener = (event) => {
      if (
        event.event === "user_status" &&
        String(event.user_id) === String(owner)
      ) {
        setDraft(presenceFields(event));
        setExpiry("keep");
      }
    };
    websocketService.subscribe(listener);
    return () => {
      cancelled = true;
      websocketService.unsubscribe(listener);
    };
  }, [visible]);
  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const result = await userService.updatePresence({
        presence_visibility: draft.presence_visibility || "default",
        custom_status: draft.custom_status || "",
        status_emoji: draft.status_emoji || "",
        status_expires_at: statusExpiry(expiry, draft.status_expires_at),
      });
      setDraft(presenceFields(result));
      setExpiry("keep");
      setMessage("Status saved");
    } catch (error) {
      setMessage(error.message || "Unable to save status");
    } finally {
      setSaving(false);
    }
  };
  const choices =
    menu === "status"
      ? [
          ["", "None"],
          ["Busy", "Busy"],
          ["Sleeping", "Sleeping"],
          ["Away", "Away"],
          ["Custom status", "Custom"],
        ]
      : [
          ["keep", draft?.status_expires_at ? "Keep current expiry" : "Never"],
          ["1", "1 hour"],
          ["8", "8 hours"],
          ["today", "Today"],
          ["never", "Never"],
        ];
  const field = {
    color: theme.text,
    fontSize: 16,
    backgroundColor: theme.inputBg || theme.cardBg,
    borderColor: theme.borderColor,
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    minHeight: 48,
  };
  const label = { color: theme.text, fontSize: 16, lineHeight: 22 };
  return (
    <View style={{ paddingVertical: 18, gap: 12 }}>
      <Text style={{ color: theme.accent, fontSize: 14, fontWeight: "600" }}>
        Presence and status
      </Text>
      {draft && (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={[label, { flex: 1, minWidth: 0 }]}>
              Invisible (hide online and last seen)
            </Text>
            <Switch
              accessibilityLabel="Invisible"
              disabled={saving}
              value={draft.presence_visibility === "invisible"}
              onValueChange={(value) =>
                setDraft({
                  ...draft,
                  presence_visibility: value ? "invisible" : "default",
                })
              }
            />
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Status preset"
            disabled={saving}
            onPress={() => setMenu("status")}
            style={field}
          >
            <Text style={label}>{draft.custom_status || "None"}</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              accessibilityLabel="Status emoji"
              placeholder="Emoji"
              placeholderTextColor={theme.textMuted}
              editable={!saving}
              maxLength={16}
              value={draft.status_emoji || ""}
              onChangeText={(value) =>
                setDraft({ ...draft, status_emoji: value })
              }
              style={[field, { width: 76 }]}
            />
            <TextInput
              accessibilityLabel="Custom status"
              placeholder="Custom status"
              placeholderTextColor={theme.textMuted}
              editable={!saving}
              maxLength={80}
              value={draft.custom_status || ""}
              onChangeText={(value) =>
                setDraft({ ...draft, custom_status: value })
              }
              style={[field, { flex: 1, minWidth: 0 }]}
            />
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Clear status after"
            disabled={saving}
            onPress={() => setMenu("expiry")}
            style={field}
          >
            <Text style={label}>
              Clear status:{" "}
              {expiry === "keep"
                ? draft.status_expires_at
                  ? "Keep current expiry"
                  : "Never"
                : expiry === "today"
                  ? "Today"
                  : expiry === "never"
                    ? "Never"
                    : `${expiry} hour${expiry === "1" ? "" : "s"}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={saving}
            onPress={save}
            style={[
              field,
              { backgroundColor: theme.accent, alignItems: "center" },
            ]}
          >
            <Text style={{ color: "white", fontWeight: "600" }}>
              {saving ? "Saving..." : "Save status"}
            </Text>
          </TouchableOpacity>
        </>
      )}
      {!!message && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: theme.textMuted }}
        >
          {message}
        </Text>
      )}
      <Modal
        visible={!!menu}
        transparent
        animationType="fade"
        onRequestClose={() => setMenu(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            padding: 24,
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <ScrollView
            style={{
              flexGrow: 0,
              maxHeight: "80%",
              borderRadius: 8,
              backgroundColor: theme.cardBg || theme.bg,
            }}
            contentContainerStyle={{ padding: 16 }}
          >
            {choices.map(([value, label]) => (
              <TouchableOpacity
                key={value}
                accessibilityRole="button"
                onPress={() => {
                  if (menu === "status")
                    setDraft({
                      ...draft,
                      custom_status: value,
                      status_emoji: "",
                    });
                  else setExpiry(value);
                  setMenu(null);
                }}
                style={{ padding: 16, minHeight: 48 }}
              >
                <Text
                  style={{ color: theme.text, fontSize: 16, lineHeight: 22 }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setMenu(null)}
              style={{ padding: 16 }}
            >
              <Text style={{ color: theme.accent }}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
