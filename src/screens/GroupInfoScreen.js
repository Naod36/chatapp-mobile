import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import Svg, { Path } from "react-native-svg";
import { useApp } from "../context/AppContext";
import Avatar from "../components/common/Avatar";
import { conversationService } from "../services/conversations";
import { userService } from "../services/user";
import { websocketService } from "../services/websocket";
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
function CameraIcon({ color }) {
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7h3l1.5-2h7L17 7h3a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <Path d="M12 17a4 4 0 100-8 4 4 0 000 8z" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

/**
 * GroupInfoScreen — group avatar/title editing, member roster, admin
 * promote/demote, and adding new members to an existing group.
 */
export default function GroupInfoScreen({ route, navigation }) {
  const {
    theme: t,
    user,
    conversations,
    setConversations,
    isBlocked,
    isBlockedBy,
    getBlockPolicy,
    blockStateReady,
    blockStateVersion,
  } = useApp();
  const insets = useSafeAreaInsets();

  const routeConversation = route.params.conversation;
  const conversation =
    conversations.find(
      (item) =>
        String(item.id || item.conversation_id) ===
        String(routeConversation.id || routeConversation.conversation_id),
    ) || routeConversation;
  const convId = String(conversation.id || conversation.conversation_id);
  const currentUserId = String(user?.userId || user?.user_id || "");
  const creatorId = String(conversation.creator_id || "");
  const participants = conversation.participants || [];

  const currentParticipant = participants.find(
    (p) => String(p.user_id || p.id) === currentUserId,
  );
  const isAdmin =
    creatorId === currentUserId ||
    currentParticipant?.role === "admin" ||
    currentParticipant?.role === "creator";

  const visibleUser = (person) =>
    redactUser(person, (identity) => !blockStateReady || isBlockedBy(identity));

  const [titleInput, setTitleInput] = useState(conversation.title || "");
  const [savingTitle, setSavingTitle] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [actionSheetTarget, setActionSheetTarget] = useState(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setTitleInput(conversation.title || "");
  }, [convId]); // eslint-disable-line

  const titleDirty = titleInput.trim() !== (conversation.title || "").trim();

  const patchConversation = useCallback(
    (patch) => {
      setConversations((prev) =>
        prev.map((c) =>
          String(c.id || c.conversation_id) === convId
            ? { ...c, ...patch }
            : c,
        ),
      );
    },
    [convId, setConversations],
  );

  const handleSaveTitle = useCallback(async () => {
    const trimmed = titleInput.trim();
    if (!trimmed || !titleDirty) return;
    setSavingTitle(true);
    try {
      websocketService.send({
        action: "update_group",
        conversation_id: convId,
        title: trimmed,
        avatar_url: conversation.avatar_url || null,
      });
      patchConversation({ title: trimmed });
      await conversationService.updateGroup(convId, { title: trimmed });
    } catch (err) {
      Alert.alert("Error", err.message || "Failed to update group title");
    } finally {
      setSavingTitle(false);
    }
  }, [titleInput, titleDirty, convId, conversation.avatar_url, patchConversation]);

  const handlePickAvatar = useCallback(async () => {
    if (!isAdmin || uploadingAvatar) return;
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Needed",
          "FlowChat needs access to your photo library to change the group photo.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setUploadingAvatar(true);

      const formData = new FormData();
      if (
        Platform.OS === "web" ||
        asset.uri.startsWith("blob:") ||
        asset.uri.startsWith("data:")
      ) {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const fileObj = new File(
          [blob],
          asset.fileName || `group_${Date.now()}.jpg`,
          { type: asset.mimeType || blob.type || "image/jpeg" },
        );
        formData.append("file", fileObj);
      } else {
        formData.append("file", {
          uri: asset.uri,
          name: asset.fileName || `group_${Date.now()}.jpg`,
          type: asset.mimeType || "image/jpeg",
        });
      }

      const uploadRes = await conversationService.uploadFile(formData);
      const avatarUrl = uploadRes?.url;
      if (!avatarUrl) throw new Error("Upload did not return a file URL");

      const nextTitle = titleInput.trim() || conversation.title || "";
      websocketService.send({
        action: "update_group",
        conversation_id: convId,
        title: nextTitle,
        avatar_url: avatarUrl,
      });
      patchConversation({ avatar_url: avatarUrl });
      await conversationService.updateGroup(convId, {
        title: nextTitle,
        avatar_url: avatarUrl,
      });
    } catch (err) {
      Alert.alert("Error", err.message || "Failed to update group photo");
    } finally {
      setUploadingAvatar(false);
    }
  }, [isAdmin, uploadingAvatar, convId, titleInput, conversation.title, patchConversation]);

  const openMemberActions = useCallback(
    (participant) => {
      const pid = String(participant.user_id || participant.id);
      if (!isAdmin || pid === currentUserId || pid === creatorId) return;
      setActionSheetTarget(participant);
    },
    [isAdmin, currentUserId, creatorId],
  );

  const handleToggleAdmin = useCallback(
    (participant, makeAdmin) => {
      const pid = participant.user_id || participant.id;
      websocketService.send({
        action: "update_group_admin",
        conversation_id: convId,
        target_user_id: pid,
        is_admin: makeAdmin,
      });
      setConversations((prev) =>
        prev.map((c) => {
          if (String(c.id || c.conversation_id) !== convId) return c;
          const nextParticipants = (c.participants || []).map((p) =>
            String(p.user_id || p.id) === String(pid)
              ? { ...p, role: makeAdmin ? "admin" : "member" }
              : p,
          );
          return { ...c, participants: nextParticipants };
        }),
      );
      setActionSheetTarget(null);
    },
    [convId, setConversations],
  );

  useEffect(() => {
    if (!addMemberOpen || !query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await userService.searchUsers(query.trim());
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, addMemberOpen, blockStateVersion]);

  const existingIds = new Set(
    participants.map((p) => String(p.user_id || p.id)),
  );

  const filteredResults = results.filter((person) => {
    const uid = String(person.user_id || person.id);
    if (existingIds.has(uid)) return false;
    if (!blockStateReady) return true;
    if (isBlocked(uid) || isBlockedBy(uid)) return false;
    return !getBlockPolicy(uid).preventDirectInteraction;
  });

  const handleAddMember = useCallback(
    (userItem) => {
      const uid = userItem.user_id || userItem.id;
      websocketService.send({
        action: "add_group_member",
        conversation_id: convId,
        target_user_id: uid,
      });
      const newParticipant = {
        user_id: uid,
        username: userItem.username,
        display_name: userItem.display_name || userItem.username,
        avatar_url: userItem.avatar_url || null,
        role: "member",
      };
      setConversations((prev) =>
        prev.map((c) => {
          if (String(c.id || c.conversation_id) !== convId) return c;
          const already = (c.participants || []).some(
            (p) => String(p.user_id || p.id) === String(uid),
          );
          if (already) return c;
          return {
            ...c,
            participants: [...(c.participants || []), newParticipant],
          };
        }),
      );
      setAddMemberOpen(false);
      setQuery("");
      setResults([]);
    },
    [convId, setConversations],
  );

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <View
        style={[
          styles.header,
          {
            borderBottomColor: t.borderColor,
            backgroundColor: t.headerBg,
            paddingTop: insets.top + 10,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <BackIcon color={t.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.text }]}>Group Info</Text>
        {isAdmin && (
          <TouchableOpacity
            onPress={() => setAddMemberOpen((open) => !open)}
            style={styles.addMemberBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Add member"
          >
            <Text style={[styles.addMemberLabel, { color: t.accent }]}>
              + Add
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.avatarSection}>
          <TouchableOpacity
            onPress={handlePickAvatar}
            disabled={!isAdmin || uploadingAvatar}
            accessibilityRole={isAdmin ? "button" : undefined}
            accessibilityLabel={isAdmin ? "Change group photo" : undefined}
            style={styles.avatarWrap}
          >
            <Avatar
              uri={conversation.avatar_url}
              name={conversation.title || conversation.display_name}
              size={84}
              isGroup
            />
            {isAdmin && (
              <View
                style={[styles.cameraBadge, { backgroundColor: t.accent, borderColor: t.bg }]}
              >
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <CameraIcon color="#fff" />
                )}
              </View>
            )}
          </TouchableOpacity>

          {isAdmin ? (
            <View style={styles.titleEditRow}>
              <TextInput
                value={titleInput}
                onChangeText={setTitleInput}
                placeholder="Group name"
                placeholderTextColor={t.textMuted}
                style={[
                  styles.titleInput,
                  {
                    color: t.text,
                    backgroundColor: t.inputBg,
                    borderColor: t.borderColor,
                  },
                ]}
                maxLength={80}
                accessibilityLabel="Group title"
              />
              {titleDirty && (
                <TouchableOpacity
                  onPress={handleSaveTitle}
                  disabled={savingTitle}
                  style={[styles.saveBtn, { backgroundColor: t.accent }]}
                  accessibilityRole="button"
                  accessibilityLabel="Save group title"
                >
                  {savingTitle ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnLabel}>Save</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Text style={[styles.groupTitleText, { color: t.text }]}>
              {conversation.title || conversation.display_name || "Group"}
            </Text>
          )}

          <Text style={[styles.memberCount, { color: t.textMuted }]}>
            {participants.length} members
          </Text>
        </View>

        {addMemberOpen && (
          <View
            style={[styles.addMemberPanel, { borderColor: t.borderColor }]}
          >
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
                placeholder="Search users to add..."
                placeholderTextColor={t.textMuted}
                style={[styles.searchInput, { color: t.text }]}
                autoCorrect={false}
                autoFocus
                accessibilityLabel="Search users to add"
              />
            </View>
            {searching ? (
              <ActivityIndicator
                style={{ marginTop: 16 }}
                size="small"
                color={t.accent}
              />
            ) : (
              filteredResults.map(visibleUser).map((item) => (
                <TouchableOpacity
                  key={String(item.user_id || item.id)}
                  style={[styles.row, { borderBottomColor: t.borderColor }]}
                  onPress={() => handleAddMember(item)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${item.display_name || item.username}`}
                >
                  <Avatar
                    uri={item.avatar_url}
                    name={item.display_name || item.username}
                    size={40}
                  />
                  <View style={styles.info}>
                    <Text style={[styles.name, { color: t.text }]}>
                      {item.display_name || item.username}
                    </Text>
                    <Text style={[styles.handle, { color: t.textMuted }]}>
                      @{item.username}
                    </Text>
                  </View>
                  <Text style={[styles.addLabel, { color: t.accent }]}>
                    + Add
                  </Text>
                </TouchableOpacity>
              ))
            )}
            {!searching && query.trim() && filteredResults.length === 0 && (
              <Text style={[styles.emptyText, { color: t.textMuted }]}>
                No users found
              </Text>
            )}
          </View>
        )}

        <View style={styles.membersSection}>
          <Text style={[styles.sectionLabel, { color: t.textMuted }]}>
            MEMBERS
          </Text>
          {participants.map(visibleUser).map((participant) => {
            const pid = String(participant.user_id || participant.id);
            const isCreator = pid === creatorId;
            const isParticipantAdmin =
              isCreator || participant.role === "admin";
            const isSelf = pid === currentUserId;
            const canManage = isAdmin && !isSelf && !isCreator;
            return (
              <TouchableOpacity
                key={pid}
                style={[styles.row, { borderBottomColor: t.borderColor }]}
                onPress={() => openMemberActions(participant)}
                disabled={!canManage}
                activeOpacity={canManage ? 0.6 : 1}
                accessibilityRole={canManage ? "button" : undefined}
                accessibilityLabel={
                  canManage
                    ? `Manage ${participant.display_name || participant.username}`
                    : undefined
                }
              >
                <Avatar
                  uri={participant.avatar_url}
                  name={participant.display_name || participant.username}
                  size={44}
                />
                <View style={styles.info}>
                  <Text style={[styles.name, { color: t.text }]}>
                    {participant.display_name || participant.username}
                    {isSelf ? " (You)" : ""}
                  </Text>
                  <Text style={[styles.handle, { color: t.textMuted }]}>
                    @{participant.username}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    isCreator
                      ? styles.creatorBadge
                      : isParticipantAdmin
                        ? { backgroundColor: t.accent + "26" }
                        : { backgroundColor: t.borderColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      {
                        color: isCreator
                          ? "#eab308"
                          : isParticipantAdmin
                            ? t.accent
                            : t.textMuted,
                      },
                    ]}
                  >
                    {isCreator ? "Creator" : isParticipantAdmin ? "Admin" : "Member"}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={!!actionSheetTarget}
        onRequestClose={() => setActionSheetTarget(null)}
      >
        <TouchableWithoutFeedback onPress={() => setActionSheetTarget(null)}>
          <View style={styles.sheetBackdrop}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.sheetPanel,
                  { backgroundColor: t.cardBg, borderColor: t.borderColor },
                ]}
              >
                {actionSheetTarget && (
                  <>
                    <Text
                      style={[styles.sheetPreview, { color: t.textMuted }]}
                    >
                      {actionSheetTarget.display_name ||
                        actionSheetTarget.username}
                    </Text>
                    <View
                      style={[
                        styles.sheetDivider,
                        { backgroundColor: t.borderColor },
                      ]}
                    />
                    <TouchableOpacity
                      style={styles.sheetAction}
                      onPress={() =>
                        handleToggleAdmin(
                          actionSheetTarget,
                          !(actionSheetTarget.role === "admin"),
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel={
                        actionSheetTarget.role === "admin"
                          ? "Dismiss as Admin"
                          : "Make Admin"
                      }
                    >
                      <Text
                        style={[styles.sheetActionText, { color: t.text }]}
                      >
                        {actionSheetTarget.role === "admin"
                          ? "Dismiss as Admin"
                          : "Make Admin"}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity
                  style={[
                    styles.sheetAction,
                    styles.sheetCancel,
                    { borderTopColor: t.borderColor },
                  ]}
                  onPress={() => setActionSheetTarget(null)}
                >
                  <Text style={[styles.sheetActionText, { color: t.textMuted }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700", flex: 1 },
  addMemberBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  addMemberLabel: { fontSize: 14, fontWeight: "700" },
  avatarSection: { alignItems: "center", paddingVertical: 24, gap: 8 },
  avatarWrap: { position: "relative" },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  titleEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    width: "100%",
  },
  titleInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  saveBtnLabel: { color: "#fff", fontWeight: "700", fontSize: 13 },
  groupTitleText: { fontSize: 18, fontWeight: "800" },
  memberCount: { fontSize: 12.5 },
  addMemberPanel: {
    marginHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0, margin: 0 },
  emptyText: { textAlign: "center", paddingVertical: 16, fontSize: 13 },
  membersSection: { paddingTop: 4 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
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
  addLabel: { fontSize: 13, fontWeight: "700" },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  creatorBadge: { backgroundColor: "rgba(234, 179, 8, 0.15)" },
  badgeText: { fontSize: 11, fontWeight: "800" },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  sheetPanel: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  sheetPreview: {
    fontSize: 13,
    padding: 14,
    paddingBottom: 10,
    fontWeight: "700",
  },
  sheetDivider: { height: 1 },
  sheetAction: {
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  sheetCancel: { borderTopWidth: 1 },
  sheetActionText: { fontSize: 15, fontWeight: "600" },
});
