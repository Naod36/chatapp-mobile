import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import * as Alert from "../services/notices";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useApp } from "../context/AppContext";
import Avatar from "../components/common/Avatar";
import { apiFetch } from "../services/api";
import { conversationService } from "../services/conversations";
import { redactUser } from "../utils/blockPolicy";

function BackIcon({ color }) {
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function SearchIcon({ color }) {
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function CheckIcon({ color }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17l-5-5"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function NewGroupScreen({ navigation }) {
  const {
    theme: t,
    setConversations,
    isBlockedBy,
    blockStateReady,
    blockStateVersion,
  } = useApp();
  const visibleUser = (person) =>
    redactUser(person, (identity) => !blockStateReady || isBlockedBy(identity));
  const insets = useSafeAreaInsets();
  const [groupName, setGroupName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState([]); // array of user objects
  const [creating, setCreating] = useState(false);

  // Search users
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiFetch(
          `/users/search?query=${encodeURIComponent(query.trim())}`,
        );
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, blockStateVersion]);

  const toggleUser = useCallback((userItem) => {
    const uid = String(userItem.user_id || userItem.id);
    setSelected((prev) => {
      if (prev.some((u) => String(u.user_id || u.id) === uid)) {
        return prev.filter((u) => String(u.user_id || u.id) !== uid);
      }
      return [...prev, userItem];
    });
  }, []);

  const isSelected = (userItem) => {
    const uid = String(userItem.user_id || userItem.id);
    return selected.some((u) => String(u.user_id || u.id) === uid);
  };

  const handleCreate = useCallback(async () => {
    if (!groupName.trim()) {
      Alert.alert("Name required", "Please enter a group name.");
      return;
    }
    if (selected.length === 0) {
      Alert.alert("Members required", "Add at least one member to the group.");
      return;
    }
    setCreating(true);
    try {
      const memberIds = selected.map((u) => u.user_id || u.id);
      const result = await conversationService.createGroup(
        groupName.trim(),
        memberIds,
      );
      // The create endpoint only returns { conversation_id }; build a full
      // conversation object from data we already have so the chat header
      // shows the group name immediately instead of "Chat".
      const group = {
        id: result.conversation_id,
        conversation_id: result.conversation_id,
        type: "group",
        title: groupName.trim(),
        participants: selected.map((u) => ({
          user_id: u.user_id || u.id,
          username: u.username,
          display_name: u.display_name,
          avatar_url: u.avatar_url,
        })),
      };
      setConversations((prev) => {
        if (prev.some((c) => String(c.id) === String(group.id))) return prev;
        return [group, ...prev];
      });
      navigation.replace("Chat", { conversation: group });
    } catch (err) {
      Alert.alert("Error", err.message || "Failed to create group");
    } finally {
      setCreating(false);
    }
  }, [groupName, selected, navigation, setConversations]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: t.bg, paddingTop: insets.top },
      ]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: t.borderColor, backgroundColor: t.headerBg },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <BackIcon color={t.accent} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: t.text }]}>New Group</Text>
        <TouchableOpacity
          onPress={handleCreate}
          disabled={creating}
          style={styles.createBtn}
        >
          {creating ? (
            <ActivityIndicator size="small" color={t.accent} />
          ) : (
            <Text style={[styles.createLabel, { color: t.accent }]}>
              Create
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Group name input */}
      <View
        style={[styles.groupNameWrap, { borderBottomColor: t.borderColor }]}
      >
        <TextInput
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Group name (required)"
          placeholderTextColor={t.textMuted}
          style={[
            styles.groupNameInput,
            {
              color: t.text,
              backgroundColor: t.inputBg,
              borderColor: t.borderColor,
            },
          ]}
          maxLength={80}
          returnKeyType="done"
        />
      </View>

      {/* Selected member chips */}
      {selected.length > 0 && (
        <View style={[styles.chips, { borderBottomColor: t.borderColor }]}>
          {selected.map((u) => (
            <TouchableOpacity
              key={String(u.user_id || u.id)}
              style={[
                styles.chip,
                { backgroundColor: t.accent + "22", borderColor: t.accent },
              ]}
              onPress={() => toggleUser(u)}
            >
              <Text style={[styles.chipText, { color: t.accent }]}>
                {visibleUser(u).display_name || visibleUser(u).username} ×
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search members */}
      <View
        style={[
          styles.searchWrap,
          { backgroundColor: t.inputBg, borderColor: t.borderColor },
        ]}
      >
        <SearchIcon color={t.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search to add as a member..."
          placeholderTextColor={t.textMuted}
          style={[styles.searchInput, { color: t.text }]}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => setQuery("")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ color: t.textMuted, fontSize: 18, lineHeight: 20 }}>
              ×
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Results */}
      {searching ? (
        <ActivityIndicator
          style={{ marginTop: 30 }}
          size="large"
          color={t.accent}
        />
      ) : (
        <FlatList
          data={results.map(visibleUser)}
          keyExtractor={(item) => String(item.user_id || item.id)}
          renderItem={({ item }) => {
            const sel = isSelected(item);
            return (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: t.borderColor }]}
                onPress={() => toggleUser(item)}
                activeOpacity={0.75}
              >
                <Avatar
                  uri={item.avatar_url}
                  name={item.display_name || item.username}
                  size={44}
                />
                <View style={styles.info}>
                  <Text style={[styles.name, { color: t.text }]}>
                    {item.display_name || item.username}
                  </Text>
                  <Text style={[styles.handle, { color: t.textMuted }]}>
                    @{item.username}
                  </Text>
                </View>
                <View
                  style={[
                    styles.checkCircle,
                    {
                      borderColor: sel ? t.accent : t.borderColor,
                      backgroundColor: sel ? t.buttonBg : "transparent",
                    },
                  ]}
                >
                  {sel && <CheckIcon color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            query.trim() && !searching ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: t.textMuted }]}>
                  No users found
                </Text>
              </View>
            ) : null
          }
          contentContainerStyle={{ flexGrow: 1 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 17, fontWeight: "700", flex: 1 },
  createBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  createLabel: { fontSize: 15, fontWeight: "700" },
  groupNameWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupNameInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "600",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: { fontSize: 13, fontWeight: "600" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    margin: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0, margin: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "700" },
  handle: { fontSize: 12.5, marginTop: 2 },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", paddingTop: 50 },
  emptyText: { fontSize: 14 },
});
