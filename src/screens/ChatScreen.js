import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
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
  Share,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import * as FileSystem from "expo-file-system/legacy";
import * as Clip from "expo-clipboard";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";

import { useApp } from "../context/AppContext";
import { useMessages } from "../hooks/useMessages";
import { conversationService } from "../services/conversations";
import { API_BASE } from "../services/api";
import { refreshMutedConversationsCache } from "../services/notifications";
import ChatHeader from "../components/chat/ChatHeader";
import ConfirmDialog from "../components/common/ConfirmDialog";
import ChatOptionsMenu from "../components/chat/ChatOptionsMenu";
import MessageBubble from "../components/chat/MessageBubble";
import MessageInput from "../components/chat/MessageInput";
import PinnedBanner from "../components/chat/PinnedBanner";
import PinChoiceModal from "../components/chat/PinChoiceModal";
import PinnedListModal from "../components/chat/PinnedListModal";
import TypingIndicator from "../components/chat/TypingIndicator";
import FullScreenImageViewer from "../components/chat/FullScreenImageViewer";
import ContextMenu from "../components/chat/ContextMenu";
import { redactMessage } from "../utils/blockPolicy";
import { lightTap, selectionTap, successTap } from "../utils/haptics.js";

function getAssetUrl(url) {
  if (!url) return null;
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:")
  )
    return url;
  return `${API_BASE}${url}`;
}

// Shared by Copy/Save/Share media actions: downloads a message's remote media to a local cache file.
async function downloadMediaToCache(remoteUrl) {
  const filename =
    remoteUrl.split("/").pop().split("?")[0] || `media-${Date.now()}`;
  const localUri = `${FileSystem.cacheDirectory}${filename}`;
  const result = await FileSystem.downloadAsync(remoteUrl, localUri);
  return result.uri;
}

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
  const [isChatMuted, setIsChatMuted] = useState(false);

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

  useEffect(() => {
    AsyncStorage.getItem("@flowchat_muted_conversations")
      .then((raw) => {
        const ids = raw ? JSON.parse(raw) : [];
        setIsChatMuted(ids.includes(convId));
      })
      .catch(() => {});
  }, [convId]);

  const handleToggleChatMute = useCallback(async () => {
    const raw = await AsyncStorage.getItem("@flowchat_muted_conversations");
    const ids = raw ? JSON.parse(raw) : [];
    const next = isChatMuted
      ? ids.filter((id) => id !== convId)
      : [...ids.filter((id) => id !== convId), convId];
    await AsyncStorage.setItem(
      "@flowchat_muted_conversations",
      JSON.stringify(next),
    );
    setIsChatMuted(!isChatMuted);
    refreshMutedConversationsCache();
  }, [convId, isChatMuted]);

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
    retryMessage,
    discardMessage,
    toggleReaction,
    handleTypingStart,
    handleTypingStop,
    assertInteractionAllowed,
    suppressReceipts,
  } = useMessages(convId, conversation.pinned_message_id, conversation);

  const [inputText, setInputText] = useState("");

  // ─── Per-conversation drafts (MA01) ───────────────────────────────────────
  // Keyed by user so switching accounts never leaks another user's draft.
  const draftKey = `@flowchat_draft_${currentUserId}_${convId}`;
  const draftLoadedRef = useRef(false);
  const inputTextRef = useRef(inputText);
  inputTextRef.current = inputText;
  useEffect(() => {
    draftLoadedRef.current = false;
    AsyncStorage.getItem(draftKey)
      .then((saved) => {
        if (saved && !inputTextRef.current) setInputText(saved);
      })
      .catch(() => {})
      .finally(() => {
        draftLoadedRef.current = true;
      });
  }, [draftKey]);
  useEffect(() => {
    if (!draftLoadedRef.current) return;
    const timer = setTimeout(() => {
      if (inputText) AsyncStorage.setItem(draftKey, inputText).catch(() => {});
      else AsyncStorage.removeItem(draftKey).catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [inputText, draftKey]);

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
  const [batchProgress, setBatchProgress] = useState(null);
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [messageSearchIndex, setMessageSearchIndex] = useState(0);
  const [imageViewerIndex, setImageViewerIndex] = useState(null);

  const imageMessages = useMemo(
    () =>
      messages.filter(
        (m) => m.message_type === "image" && (m.media_url || m.file_url),
      ),
    [messages],
  );

  const openImageViewer = useCallback(
    (msg) => {
      const msgId = String(msg.id || msg.message_id);
      const index = imageMessages.findIndex(
        (m) => String(m.id || m.message_id) === msgId,
      );
      if (index >= 0) setImageViewerIndex(index);
    },
    [imageMessages],
  );

  const closeImageViewer = useCallback(() => setImageViewerIndex(null), []);

  // ─── Preserve reading position ────────────────────────────────────────────
  // Only auto-scroll to the newest message when the reader is already near
  // the bottom; otherwise track how many new messages arrived so a "jump to
  // latest" affordance can be shown instead of yanking them down mid-read.
  const flatListRef = useRef(null);
  const nearBottomRef = useRef(true);
  const previousMessageIdsRef = useRef(new Set());
  const hasInitializedRef = useRef(false);
  const [unseenCount, setUnseenCount] = useState(0);

  useEffect(() => {
    hasInitializedRef.current = false;
    previousMessageIdsRef.current = new Set();
    nearBottomRef.current = true;
    setUnseenCount(0);
  }, [convId]);

  useEffect(() => {
    if (messages.length === 0) return;
    const currentIds = new Set(
      messages.map((m) => String(m.id || m.message_id)),
    );
    const addedIds = [...currentIds].filter(
      (id) => !previousMessageIdsRef.current.has(id),
    );
    previousMessageIdsRef.current = currentIds;

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      requestAnimationFrame(() =>
        flatListRef.current?.scrollToEnd({ animated: false }),
      );
      return;
    }
    if (pinnedMessages.length > 0) return;
    if (nearBottomRef.current) {
      flatListRef.current?.scrollToEnd({ animated: true });
      setUnseenCount(0);
    } else if (addedIds.length > 0) {
      setUnseenCount((count) => count + addedIds.length);
    }
  }, [messages, pinnedMessages.length]);

  const handleListScroll = useCallback((event) => {
    const { contentOffset, contentSize, layoutMeasurement } =
      event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - contentOffset.y - layoutMeasurement.height;
    const isNearBottom = distanceFromBottom < 120;
    nearBottomRef.current = isNearBottom;
    if (isNearBottom) setUnseenCount(0);
  }, []);

  const jumpToLatest = useCallback(() => {
    nearBottomRef.current = true;
    setUnseenCount(0);
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

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
      selectionTap();
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
    lightTap();
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
      lightTap();
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

  const handleShareImage = useCallback(async () => {
    const msg = selectedMsg;
    closeContextMenu();
    const imageUrl = msg && getAssetUrl(msg.media_url || msg.file_url);
    if (!imageUrl) return;
    try {
      const localUri = await downloadMediaToCache(imageUrl);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(localUri);
        return;
      }
      const shareOptions =
        Platform.OS === "ios" ? { url: imageUrl } : { message: imageUrl };
      await Share.share(shareOptions);
    } catch (error) {
      Alert.alert("Action failed", error.message);
    }
  }, [selectedMsg, closeContextMenu]);

  const handleCopyImage = useCallback(async () => {
    const msg = selectedMsg;
    closeContextMenu();
    const imageUrl = msg && getAssetUrl(msg.media_url || msg.file_url);
    if (!imageUrl) return;
    try {
      const localUri = await downloadMediaToCache(imageUrl);
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await Clip.setImageAsync(base64);
      Alert.alert("Copied", "Image copied to clipboard.");
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to copy image");
    }
  }, [selectedMsg, closeContextMenu]);

  const handleSaveMedia = useCallback(async () => {
    const msg = selectedMsg;
    closeContextMenu();
    const mediaUrl = msg && getAssetUrl(msg.media_url || msg.file_url);
    if (!mediaUrl) return;
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission required",
          "Please grant photo library access to save media.",
        );
        return;
      }
      const localUri = await downloadMediaToCache(mediaUrl);
      await MediaLibrary.saveToLibraryAsync(localUri);
      Alert.alert("Saved", "Media saved to your gallery.");
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to save media");
    }
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

  const handleRetrySend = useCallback(async () => {
    if (!selectedMsg || !canInteract()) return;
    const msg = selectedMsg;
    closeContextMenu();
    try {
      await retryMessage(msg);
    } catch (err) {
      Alert.alert("Message not sent", err.message || "Retry failed.");
    }
  }, [selectedMsg, retryMessage, canInteract, closeContextMenu]);

  const handleDiscardFailed = useCallback(() => {
    if (!selectedMsg) return;
    discardMessage(selectedMsg.id || selectedMsg.message_id);
    closeContextMenu();
  }, [selectedMsg, discardMessage, closeContextMenu]);

  // ─── Send ─────────────────────────────────────────────────────────────────
  const buildAttachmentFormData = useCallback(async (att, controller) => {
    const formData = new FormData();
    if (att.file) {
      formData.append("file", att.file);
    } else if (
      Platform.OS === "web" ||
      att.uri?.startsWith("blob:") ||
      att.uri?.startsWith("data:")
    ) {
      const response = await fetch(att.uri, { signal: controller.signal });
      const blob = await response.blob();
      const fileObj = new File([blob], att.name || "upload", {
        type: att.type || blob.type || "application/octet-stream",
      });
      formData.append("file", fileObj);
    } else {
      formData.append("file", {
        uri: att.uri,
        name: att.name || "upload",
        type: att.type || "application/octet-stream",
      });
    }
    return formData;
  }, []);

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
          const formData = await buildAttachmentFormData(
            attachment,
            controller,
          );

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
      AsyncStorage.removeItem(draftKey).catch(() => {});
      successTap();
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
    draftKey,
  ]);

  // ─── Batch send multiple picked images ────────────────────────────────────
  const handleSendMultipleImages = useCallback(
    async (assets) => {
      if (!assets || assets.length === 0) return;
      if (sendControllerRef.current || !canInteract()) return;
      const controller = new AbortController();
      sendControllerRef.current = controller;
      setIsUploading(true);
      const total = assets.length;
      const failedNames = [];
      try {
        for (let i = 0; i < total; i++) {
          const asset = assets[i];
          setBatchProgress({ current: i + 1, total });
          setUploadProgress(null);
          try {
            assertInteractionAllowed();
            if (controller.signal.aborted) throw new Error("Send cancelled.");
            const formData = await buildAttachmentFormData(asset, controller);
            const res = await conversationService.uploadFile(
              formData,
              (progress) => setUploadProgress(progress),
              controller.signal,
            );
            const mediaUrl = res?.url || res?.file_url || res?.media_url;
            if (!mediaUrl) throw new Error("Upload did not return a file URL.");
            await sendMessage(
              "",
              null,
              "image",
              mediaUrl,
              asset.name,
              controller.signal,
            );
          } catch (err) {
            failedNames.push(asset.name || `Image ${i + 1}`);
          }
        }
        if (failedNames.length > 0) {
          Alert.alert(
            "Some images failed to send",
            `Failed: ${failedNames.join(", ")}`,
          );
        }
      } finally {
        sendControllerRef.current = null;
        setIsUploading(false);
        setUploadProgress(null);
        setBatchProgress(null);
      }
    },
    [canInteract, assertInteractionAllowed, buildAttachmentFormData, sendMessage],
  );

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
        onMorePress={canBlock || isGroup ? handleMorePress : undefined}
        onTitlePress={
          isGroup
            ? () => navigation.navigate("GroupInfo", { conversation })
            : undefined
        }
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
              onImagePress={openImageViewer}
              suppressReceipts={suppressReceipts}
              interactionsDisabled={directDisabled}
            />
          );
        }}
        onContentSizeChange={() => {}}
        onLayout={() => {}}
        onScroll={handleListScroll}
        scrollEventThrottle={100}
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

      {unseenCount > 0 && (
        <TouchableOpacity
          style={[styles.jumpToLatest, { backgroundColor: t.accent }]}
          onPress={jumpToLatest}
          accessibilityRole="button"
          accessibilityLabel={`${unseenCount} new message${unseenCount === 1 ? "" : "s"}, jump to latest`}
          activeOpacity={0.85}
        >
          <Text style={styles.jumpToLatestText}>
            {unseenCount} new message{unseenCount === 1 ? "" : "s"}
          </Text>
        </TouchableOpacity>
      )}

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
        onSelectMultipleImages={handleSendMultipleImages}
        onClearAttachment={() => setAttachment(null)}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        batchProgress={batchProgress}
        disabled={directDisabled}
        assertInteractionAllowed={assertInteractionAllowed}
      />

      <FullScreenImageViewer
        visible={imageViewerIndex !== null}
        images={imageMessages}
        startIndex={imageViewerIndex || 0}
        onClose={closeImageViewer}
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
        onShareImage={handleShareImage}
        onCopyImage={handleCopyImage}
        onSaveImage={handleSaveMedia}
        onSaveVideo={handleSaveMedia}
        onPin={handlePinRequest}
        onDelete={handleDelete}
        onRetrySend={handleRetrySend}
        onDiscardFailed={handleDiscardFailed}
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
        isMuted={isChatMuted}
        onToggleMute={handleToggleChatMute}
        onToggleBlock={() => setShowBlockConfirm(true)}
        isGroup={isGroup}
        canBlock={canBlock}
        onGroupInfo={() => navigation.navigate("GroupInfo", { conversation })}
        onSharedMedia={() =>
          navigation.navigate("SharedMedia", { conversation, messages })
        }
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
  jumpToLatest: {
    alignSelf: "center",
    marginBottom: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  jumpToLatestText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
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
