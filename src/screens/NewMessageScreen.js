import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
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

export default function NewMessageScreen({ navigation }) {
  const {
    theme: t,
    setConversations,
    isBlockedBy,
    getBlockPolicy,
    blockStateReady,
    blockStateVersion,
  } = useApp();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [starting, setStarting] = useState(null); // userId being started

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

  const handleStart = useCallback(
    async (targetUser) => {
      const uid = targetUser.user_id || targetUser.id;
      setStarting(uid);
      try {
        if (!blockStateReady || getBlockPolicy(uid).preventDirectInteraction)
          throw new Error(
            "Direct messaging is unavailable for this conversation.",
          );
        const result = await conversationService.createConversation(uid);
        const conv = {
          ...result,
          id: result.id || result.conversation_id,
          type: "direct",
          other_participant: targetUser,
        };
        setConversations((prev) => {
          if (prev.some((c) => String(c.id) === String(conv.id))) return prev;
          return [conv, ...prev];
        });
        navigation.replace("Chat", { conversation: conv });
      } catch (err) {
        Alert.alert("Unavailable", err.message);
      } finally {
        setStarting(null);
      }
    },
    [navigation, setConversations, getBlockPolicy, blockStateReady],
  );

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
        <Text style={[styles.title, { color: t.text }]}>New Message</Text>
      </View>

      {/* Search input */}
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
          placeholder="Search by username or name..."
          placeholderTextColor={t.textMuted}
          style={[styles.searchInput, { color: t.text }]}
          autoFocus
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
          style={{ marginTop: 40 }}
          size="large"
          color={t.accent}
        />
      ) : (
        <FlatList
          data={results.map((person) =>
            redactUser(
              person,
              (identity) => !blockStateReady || isBlockedBy(identity),
            ),
          )}
          keyExtractor={(item) => String(item.user_id || item.id)}
          renderItem={({ item }) => {
            const uid = item.user_id || item.id;
            const isLoading = starting === uid;
            return (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: t.borderColor }]}
                onPress={() => handleStart(item)}
                disabled={isLoading}
                activeOpacity={0.75}
              >
                <Avatar
                  uri={item.avatar_url}
                  name={item.display_name || item.username}
                  size={46}
                />
                <View style={styles.info}>
                  <Text style={[styles.name, { color: t.text }]}>
                    {item.display_name || item.username}
                  </Text>
                  <Text style={[styles.handle, { color: t.textMuted }]}>
                    @{item.username}
                  </Text>
                </View>
                {isLoading ? (
                  <ActivityIndicator size="small" color={t.accent} />
                ) : (
                  <Text style={[styles.action, { color: t.accent }]}>
                    Message
                  </Text>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            query.trim() && !searching ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: t.textMuted }]}>
                  No users found for "{query}"
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
  title: { fontSize: 17, fontWeight: "700" },
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
  action: { fontSize: 13.5, fontWeight: "600" },
  empty: { alignItems: "center", paddingTop: 50 },
  emptyText: { fontSize: 14 },
});
