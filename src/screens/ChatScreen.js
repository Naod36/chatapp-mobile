import React, { useState, useRef, useCallback, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Image,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Clipboard,
  Keyboard,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { useApp } from "../context/AppContext";
import { useMessages } from "../hooks/useMessages";
import { conversationService } from "../services/conversations";
import ChatHeader from "../components/chat/ChatHeader";
import ConfirmDialog from "../components/common/ConfirmDialog";
import ChatOptionsMenu from "../components/chat/ChatOptionsMenu";
import MessageBubble from "../components/chat/MessageBubble";
import MessageInput from "../components/chat/MessageInput";
import PinnedBanner from "../components/chat/PinnedBanner";
import PinChoiceModal from "../components/chat/PinChoiceModal";
import PinnedListModal from "../components/chat/PinnedListModal";
import TypingIndicator from "../components/chat/TypingIndicator";
import ContextMenu from "../components/chat/ContextMenu";
import { redactMessage } from "../utils/blockPolicy";

function EmptyChatIcon({ color }) {
  return (
    <Svg width="40" height="40" viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function ChatScreen({ route, navigation }) {
  const {
    theme: t,
    user,
    isBlocked,
    isBlockedBy,
    blockUser,
    unblockUser,
    conversations,
    blockStateReady,
    blockStateVersion,
  } = useApp();
  const conversation =
    conversations.find(
      (item) =>
        String(item.id || item.conversation_id) ===
        String(
          route.params.conversation.id ||
            route.params.conversation.conversation_id,
        ),
    ) || route.params.conversation;
  const convId = String(conversation.id || conversation.conversation_id);
  const currentUserId = String(user?.userId || user?.user_id || "");
  const isGroup = conversation.type === "group";
  const currentParticipant = (conversation?.participants || []).find(
    (p) => String(p.user_id || p.id) === String(currentUserId),
  );
  const isAdmin =
    !isGroup ||
    String(conversation?.creator_id) === String(currentUserId) ||
    currentParticipant?.role === "admin" ||
    currentParticipant?.role === "creator";

  const otherUser = conversation?.other_participant;
  const otherUserId = String(otherUser?.user_id || otherUser?.id || "");
  const canBlock = !isGroup && !!otherUserId;
  const isUserBlocked = canBlock && isBlocked(otherUserId);
  const isBlockedByThem =
    canBlock && (!blockStateReady || isBlockedBy(otherUserId));
  const directDisabled =
    !isGroup && (!blockStateReady || isUserBlocked || isBlockedByThem);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [isChatPinned, setIsChatPinned] = useState(false);

  const handleToggleBlock = useCallback(async () => {
    setShowBlockConfirm(false);
    try {
      if (isUserBlocked) {
        await unblockUser(otherUserId);
        Alert.alert("Unblocked", "Your block has been removed.");
      } else {
        await blockUser(otherUserId);
        Alert.alert("Blocked", "This user can no longer message you.");
      }
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to update block status");
    }
  }, [isUserBlocked, otherUserId, blockUser, unblockUser]);

  const handleMorePress = useCallback(() => {
    setShowOptionsMenu(true);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("@flowchat_pinned_conversations")
      .then((raw) => {
        const ids = raw ? JSON.parse(raw) : [];
        setIsChatPinned(ids.includes(convId));
      })
      .catch(() => {});
  }, [convId]);

  const handleToggleChatPin = useCallback(async () => {
    const raw = await AsyncStorage.getItem("@flowchat_pinned_conversations");
    const ids = raw ? JSON.parse(raw) : [];
    const next = isChatPinned
      ? ids.filter((id) => id !== convId)
      : [...ids.filter((id) => id !== convId), convId];
    await AsyncStorage.setItem(
      "@flowchat_pinned_conversations",
      JSON.stringify(next),
    );
    setIsChatPinned(!isChatPinned);
  }, [convId, isChatPinned]);

  const {
    messages,
    loading,
    pinnedMessages,
    typingUser,
    sendMessage,
    editMessage,
    pinMessage,
    unpinMessage,
    deleteMessage,
    toggleReaction,
    handleTypingStart,
    handleTypingStop,
    assertInteractionAllowed,
    suppressReceipts,
  } = useMessages(convId, conversation.pinned_message_id, conversation);

  const [inputText, setInputText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [pinChoiceVisible, setPinChoiceVisible] = useState(false);
  const [pinnedListVisible, setPinnedListVisible] = useState(false);
  const [activePinIndex, setActivePinIndex] = useState(0);

  const [attachment, setAttachment] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [messageSearchIndex, setMessageSearchIndex] = useState(0);

  const flatListRef = useRef(null);
  const sendControllerRef = useRef(null);
  const canInteract = useCallback(() => {
    try {
      assertInteractionAllowed();
      return true;
    } catch (error) {
      Alert.alert("Unavailable", error.message);
      return false;
    }
  }, [assertInteractionAllowed]);
  const showMutationError = (error) =>
    Alert.alert("Action failed", error.message);

  useEffect(() => {
    if (!directDisabled) return;
    sendControllerRef.current?.abort();
    setAttachment(null);
    setReplyingTo(null);
    setEditingMessage(null);
    setPinChoiceVisible(false);
  }, [directDisabled, blockStateVersion]);

  useEffect(() => () => sendControllerRef.current?.abort(), [convId]);

  const searchMatches = messageSearchQuery.trim()
    ? messages.filter((message) =>
        String(message.content || "")
          .toLowerCase()
          .includes(messageSearchQuery.trim().toLowerCase()),
      )
    : [];

  useEffect(() => {
    if (!searchMatches.length) return;
    const match = searchMatches[messageSearchIndex % searchMatches.length];
    const matchIndex = messages.findIndex(
      (message) =>
        String(message.id || message.message_id) ===
        String(match.id || match.message_id),
    );
    if (matchIndex >= 0) {
      flatListRef.current?.scrollToIndex({
        index: matchIndex,
        animated: true,
        viewPosition: 0.5,
      });
    }
  }, [messageSearchIndex, messageSearchQuery, messages]);

  const cycleSearch = useCallback(
    (direction) => {
      if (!searchMatches.length) return;
      setMessageSearchIndex(
        (index) =>
          (index + direction + searchMatches.length) % searchMatches.length,
      );
    },
    [searchMatches.length],
  );

  const handleToggleReaction = useCallback(
    (msg, emoji) => {
      if (!canInteract()) return;
      const msgId = String(msg.id || msg.message_id);
      toggleReaction(msgId, emoji);
    },
    [toggleReaction],
  );

  // ─── Scroll to message ───────────────────────────────────────────────────
  const scrollToMessageId = useCallback(
    (msgId) => {
      if (!msgId) return;
      const index = messages.findIndex(
        (m) => String(m.id || m.message_id) === String(msgId),
      );
      if (index !== -1 && flatListRef.current) {
        flatListRef.current.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.5,
        });
      }
    },
    [messages],
  );

  // ─── Cycle pinned messages ───────────────────────────────────────────────
  const handleCyclePinned = useCallback(() => {
    if (!pinnedMessages || pinnedMessages.length === 0) return;
    const nextIndex = (activePinIndex + 1) % pinnedMessages.length;
    setActivePinIndex(nextIndex);
    const targetPin = pinnedMessages[nextIndex];
    if (targetPin) {
      scrollToMessageId(targetPin.message_id || targetPin.id);
    }
  }, [pinnedMessages, activePinIndex, scrollToMessageId]);

  // ─── Context Menu Handlers ────────────────────────────────────────────────
  const openContextMenu = useCallback((msg) => {
    setSelectedMsg(msg);
    setContextMenuVisible(true);
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenuVisible(false);
    setSelectedMsg(null);
  }, []);

  const beginReply = useCallback(
    (message) => {
      if (!message || !canInteract()) return;
      setEditingMessage(null);
      setReplyingTo(message);
      closeContextMenu();
    },
    [canInteract, closeContextMenu],
  );

  const handleReply = useCallback(() => {
    beginReply(selectedMsg);
  }, [selectedMsg, beginReply]);

  const handleEdit = useCallback(() => {
    if (!canInteract()) return;
    if (selectedMsg && selectedMsg.content) {
      setEditingMessage(selectedMsg);
      setInputText(selectedMsg.content);
    }
    closeContextMenu();
  }, [selectedMsg, closeContextMenu]);

  const handleCopy = useCallback(() => {
    if (selectedMsg?.content) {
      Clipboard.setString(selectedMsg.content);
    }
    closeContextMenu();
  }, [selectedMsg, closeContextMenu]);

  const handlePinRequest = useCallback(() => {
    if (!canInteract()) return;
    if (!selectedMsg) return;
    const msgId = String(selectedMsg.id || selectedMsg.message_id);
    const isCurrentlyPinned = pinnedMessages.some(
      (p) => String(p.message_id || p.id) === msgId,
    );

    if (isCurrentlyPinned) {
      unpinMessage(msgId).catch(showMutationError);
      closeContextMenu();
    } else {
      // Open PinChoiceModal
      setPinChoiceVisible(true);
      setContextMenuVisible(false);
    }
  }, [selectedMsg, pinnedMessages, unpinMessage, closeContextMenu]);

  const handleConfirmPin = useCallback(
    (scope, notify = true) => {
      if (!canInteract()) return;
      if (!selectedMsg) return;
      const msgId = String(selectedMsg.id || selectedMsg.message_id);
      pinMessage(msgId, scope, notify).catch(showMutationError);
      setPinChoiceVisible(false);
      setSelectedMsg(null);
    },
    [selectedMsg, pinMessage],
  );

  const handleDelete = useCallback(async () => {
    if (!canInteract()) return;
    if (!selectedMsg) return;
    const msgId = String(selectedMsg.id || selectedMsg.message_id);
    const isOwn = String(selectedMsg.sender_id) === currentUserId;
    if (!isOwn) {
      Alert.alert("Error", "You can only delete your own messages.");
      closeContextMenu();
      return;
    }
    try {
      await deleteMessage(msgId);
    } catch (err) {
      Alert.alert("Error", err.message || "Failed to delete message");
    }
    closeContextMenu();
  }, [selectedMsg, currentUserId, deleteMessage, closeContextMenu]);

  // ─── Send ─────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (sendControllerRef.current || !canInteract()) return;
    const controller = new AbortController();
    sendControllerRef.current = controller;
    setIsUploading(true);
    try {
      const text = inputText.trim();

      if (editingMessage) {
        if (text) {
          const msgId = String(editingMessage.id || editingMessage.message_id);
          editMessage(msgId, text);
        }
        setEditingMessage(null);
        setInputText("");
        return;
      }

      if (!text && !attachment) return;
      const replyId = replyingTo
        ? String(replyingTo.id || replyingTo.message_id)
        : null;

      let mediaUrl = null;
      let msgType = "text";
      let fileName = null;

      if (attachment) {
        setIsUploading(true);
        setUploadProgress({
          percentage: 0,
          loadedFormatted: "0 MB",
          totalFormatted: attachment.sizeFormatted || "file",
        });
        try {
          const formData = new FormData();
          if (attachment.file) {
            formData.append("file", attachment.file);
          } else if (
            Platform.OS === "web" ||
            attachment.uri?.startsWith("blob:") ||
            attachment.uri?.startsWith("data:")
          ) {
            const response = await fetch(attachment.uri, {
              signal: controller.signal,
            });
            const blob = await response.blob();
            const fileObj = new File([blob], attachment.name || "upload", {
              type: attachment.type || blob.type || "application/octet-stream",
            });
            formData.append("file", fileObj);
          } else {
            formData.append("file", {
              uri: attachment.uri,
              name: attachment.name || "upload",
              type: attachment.type || "application/octet-stream",
            });
          }

          assertInteractionAllowed();
          if (controller.signal.aborted) throw new Error("Send cancelled.");
          const res = await conversationService.uploadFile(
            formData,
            (progress) => {
              setUploadProgress(progress);
            },
            controller.signal,
          );
          mediaUrl = res?.url || res?.file_url || res?.media_url;
          if (!mediaUrl) throw new Error("Upload did not return a file URL.");
          fileName = attachment.name;
          msgType = attachment.mediaType;
        } catch (err) {
          Alert.alert("Upload Error", err.message || "Failed to upload file");
          setIsUploading(false);
          setUploadProgress(null);
          return;
        }
        setIsUploading(false);
        setUploadProgress(null);
      }

      assertInteractionAllowed();
      if (controller.signal.aborted) throw new Error("Send cancelled.");
      await sendMessage(
        text,
        replyId,
        msgType,
        mediaUrl,
        fileName,
        controller.signal,
      );
      setInputText("");
      setAttachment(null);
      setReplyingTo(null);
    } catch (error) {
      Alert.alert(
        "Message not sent",
        error.message || "The server rejected this message.",
      );
    } finally {
      sendControllerRef.current = null;
      setIsUploading(false);
      setUploadProgress(null);
    }
  }, [
    inputText,
    attachment,
    replyingTo,
    editingMessage,
    editMessage,
    sendMessage,
  ]);

  // ─── Scroll to end on Keyboard show ──────────────────────────────────────
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const subscription = Keyboard.addListener(showEvent, () => {
      if (messages.length > 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 80);
      }
    });
    return () => subscription.remove();
  }, [messages]);

  // ─── Render ───────────────────────────────────────────────────────────────
  const isTypingActive = !directDisabled && blockStateReady ? typingUser : null;
  const messagesById = new Map(
    messages.map((message) => [
      String(message.id || message.message_id),
      message,
    ]),
  );
  const selectedMsgIsPinned = selectedMsg
    ? pinnedMessages.some(
        (p) =>
          String(p.message_id || p.id) ===
          String(selectedMsg.id || selectedMsg.message_id),
      )
    : false;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: t.chatPaneBg || t.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Image
        source={require("../../assets/chat-wallpaper.png")}
        resizeMode="repeat"
        pointerEvents="none"
        accessible={false}
        style={[
          StyleSheet.absoluteFill,
          { width: "100%", height: "100%", opacity: t.isDark ? 0.14 : 0.2 },
        ]}
      />
      <ChatHeader
        onSearchPress={() => setMessageSearchOpen((open) => !open)}
        conversation={conversation}
        typingUser={isTypingActive}
        disableTyping={directDisabled || !blockStateReady}
        onBack={() => navigation.goBack()}
        onMorePress={canBlock ? handleMorePress : undefined}
        isBlocked={isBlockedByThem}
      />

      {messageSearchOpen && (
        <View
          style={[
            styles.messageSearchBar,
            { backgroundColor: t.cardBg, borderColor: t.borderColor },
          ]}
        >
          <TextInput
            autoFocus
            value={messageSearchQuery}
            onChangeText={(value) => {
              setMessageSearchQuery(value);
              setMessageSearchIndex(0);
            }}
            placeholder="Search messages..."
            placeholderTextColor={t.textMuted}
            style={[styles.messageSearchInput, { color: t.text }]}
          />
          <Text style={{ color: t.textMuted, fontSize: 12 }}>
            {searchMatches.length
              ? `${messageSearchIndex + 1}/${searchMatches.length}`
              : "0 results"}
          </Text>
          <TouchableOpacity onPress={() => cycleSearch(-1)}>
            <Text style={{ color: t.accent, fontSize: 18 }}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => cycleSearch(1)}>
            <Text style={{ color: t.accent, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setMessageSearchOpen(false);
              setMessageSearchQuery("");
            }}
          >
            <Text style={{ color: t.textMuted, fontSize: 16 }}>×</Text>
          </TouchableOpacity>
        </View>
      )}

      <PinnedBanner
        pinnedMessages={pinnedMessages}
        activeIndex={activePinIndex}
        theme={t}
        onCycle={handleCyclePinned}
        onOpenList={() => setPinnedListVisible(true)}
        onUnpinActive={
          directDisabled
            ? undefined
            : (msg) =>
                unpinMessage(msg.message_id || msg.id, msg.scope).catch(
                  showMutationError,
                )
        }
      />

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, idx) => String(item.id || item.message_id || idx)}
        onScrollToIndexFailed={() => {}}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const senderId = String(item.sender_id || item.user_id || "");
          const isOwn = senderId === currentUserId;
          return (
            <MessageBubble
              msg={item}
              repliedMessage={messagesById.get(String(item.reply_to_id))}
              onReplyPress={scrollToMessageId}
              isOwn={isOwn}
              isGroup={isGroup}
              theme={t}
              currentUserId={currentUserId}
              participants={conversation.participants}
              otherParticipant={conversation.other_participant}
              userProfile={user}
              onToggleReaction={handleToggleReaction}
              onLongPress={openContextMenu}
              onSwipeReply={beginReply}
              suppressReceipts={suppressReceipts}
              interactionsDisabled={directDisabled}
            />
          );
        }}
        onContentSizeChange={() => {
          if (messages.length > 0 && pinnedMessages.length === 0) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
        onLayout={() => {
          if (messages.length > 0 && pinnedMessages.length === 0) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
        contentContainerStyle={[styles.listContent, { paddingBottom: 12 }]}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyWrap}>
              <View style={{ marginBottom: 12, opacity: 0.6 }}>
                <EmptyChatIcon color={t.textMuted} />
              </View>
              <Text style={[styles.emptyText, { color: t.textMuted }]}>
                No messages yet. Say hello!
              </Text>
            </View>
          )
        }
      />

      <TypingIndicator username={isTypingActive} theme={t} />

      <MessageInput
        value={inputText}
        onChangeText={setInputText}
        onSend={handleSend}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
        theme={t}
        replyingTo={redactMessage(replyingTo, isBlockedBy)}
        onCancelReply={() => setReplyingTo(null)}
        editingMessage={editingMessage}
        onCancelEdit={() => {
          setEditingMessage(null);
          setInputText("");
        }}
        attachment={attachment}
        onSelectAttachment={setAttachment}
        onClearAttachment={() => setAttachment(null)}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        disabled={directDisabled}
        assertInteractionAllowed={assertInteractionAllowed}
      />

      <ContextMenu
        visible={contextMenuVisible}
        interactionsDisabled={directDisabled}
        message={selectedMsg}
        isOwn={
          selectedMsg ? String(selectedMsg.sender_id) === currentUserId : false
        }
        isPinned={selectedMsgIsPinned}
        theme={t}
        onReact={handleToggleReaction}
        onReply={handleReply}
        onEdit={handleEdit}
        onCopy={handleCopy}
        onPin={handlePinRequest}
        onDelete={handleDelete}
        onClose={closeContextMenu}
      />

      <PinChoiceModal
        visible={pinChoiceVisible}
        theme={t}
        isGroup={isGroup}
        isAdmin={isAdmin}
        onSelectOption={handleConfirmPin}
        onClose={() => setPinChoiceVisible(false)}
      />

      <PinnedListModal
        visible={pinnedListVisible}
        pinnedMessages={pinnedMessages}
        theme={t}
        onSelectMessage={(msg) => scrollToMessageId(msg.message_id || msg.id)}
        onUnpinMessage={
          directDisabled
            ? undefined
            : (msg) =>
                unpinMessage(msg.message_id || msg.id, msg.scope).catch(
                  showMutationError,
                )
        }
        onClose={() => setPinnedListVisible(false)}
      />

      <ChatOptionsMenu
        visible={showOptionsMenu}
        onClose={() => setShowOptionsMenu(false)}
        theme={t}
        isBlocked={isUserBlocked}
        isPinned={isChatPinned}
        onTogglePin={handleToggleChatPin}
        onToggleBlock={() => setShowBlockConfirm(true)}
      />

      <ConfirmDialog
        visible={showBlockConfirm}
        title={isUserBlocked ? "Unblock User" : "Block User"}
        message={
          isUserBlocked
            ? "Allow this user to message you again?"
            : "This user won't be able to message you, and you won't be able to message them."
        }
        confirmLabel={isUserBlocked ? "Unblock" : "Block"}
        destructive
        onConfirm={handleToggleBlock}
        onCancel={() => setShowBlockConfirm(false)}
        theme={t}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  messageSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 12,
  },
  messageSearchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  listContent: {
    flexGrow: 1,
    paddingTop: 10,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 80,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
