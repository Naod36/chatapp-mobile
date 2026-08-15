import React, { useState, useRef, useCallback } from "react";
import {
    View,
    FlatList,
    StyleSheet,
    Text,
    KeyboardAvoidingView,
    Platform,
    Alert,
    Clipboard,
} from "react-native";

import { useApp } from "../context/AppContext";
import { useMessages } from "../hooks/useMessages";
import { conversationService } from "../services/conversations";
import ChatHeader from "../components/chat/ChatHeader";
import MessageBubble from "../components/chat/MessageBubble";
import MessageInput from "../components/chat/MessageInput";
import PinnedBanner from "../components/chat/PinnedBanner";
import PinChoiceModal from "../components/chat/PinChoiceModal";
import PinnedListModal from "../components/chat/PinnedListModal";
import TypingIndicator from "../components/chat/TypingIndicator";
import ContextMenu from "../components/chat/ContextMenu";

export default function ChatScreen({ route, navigation }) {
    const { theme: t, user, typingMap } = useApp();
    const { conversation } = route.params;
    const convId = String(conversation.id || conversation.conversation_id);
    const currentUserId = String(user?.userId || user?.user_id || "");
    const isGroup = conversation.type === "group";
    const currentParticipant = (conversation?.participants || []).find(p => String(p.user_id || p.id) === String(currentUserId));
    const isAdmin = !isGroup || String(conversation?.creator_id) === String(currentUserId) || currentParticipant?.role === "admin" || currentParticipant?.role === "creator";

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
    } = useMessages(convId, conversation.pinned_message_id);

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

    const flatListRef = useRef(null);

    const handleToggleReaction = useCallback((msg, emoji) => {
        const msgId = String(msg.id || msg.message_id);
        toggleReaction(msgId, emoji);
    }, [toggleReaction]);

    // ─── Scroll to message ───────────────────────────────────────────────────
    const scrollToMessageId = useCallback((msgId) => {
        if (!msgId) return;
        const index = messages.findIndex(m => String(m.id || m.message_id) === String(msgId));
        if (index !== -1 && flatListRef.current) {
            flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
        }
    }, [messages]);

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

    const handleReply = useCallback(() => {
        setReplyingTo(selectedMsg);
        closeContextMenu();
    }, [selectedMsg, closeContextMenu]);

    const handleEdit = useCallback(() => {
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
        if (!selectedMsg) return;
        const msgId = String(selectedMsg.id || selectedMsg.message_id);
        const isCurrentlyPinned = pinnedMessages.some(p => String(p.message_id || p.id) === msgId);

        if (isCurrentlyPinned) {
            unpinMessage(msgId);
            closeContextMenu();
        } else {
            // Open PinChoiceModal
            setPinChoiceVisible(true);
            setContextMenuVisible(false);
        }
    }, [selectedMsg, pinnedMessages, unpinMessage, closeContextMenu]);

    const handleConfirmPin = useCallback((scope, notify = true) => {
        if (!selectedMsg) return;
        const msgId = String(selectedMsg.id || selectedMsg.message_id);
        pinMessage(msgId, scope, notify);
        setPinChoiceVisible(false);
        setSelectedMsg(null);
    }, [selectedMsg, pinMessage]);

    const handleDelete = useCallback(async () => {
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
        const replyId = replyingTo ? String(replyingTo.id || replyingTo.message_id) : null;

        let mediaUrl = null;
        let msgType = "text";
        let fileName = null;

        if (attachment) {
            setIsUploading(true);
            setUploadProgress({ percentage: 0, loadedFormatted: "0 MB", totalFormatted: attachment.sizeFormatted || "file" });
            try {
                const formData = new FormData();
                if (attachment.file) {
                    formData.append("file", attachment.file);
                } else if (Platform.OS === 'web' || attachment.uri?.startsWith('blob:') || attachment.uri?.startsWith('data:')) {
                    const response = await fetch(attachment.uri);
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

                const res = await conversationService.uploadFile(formData, (progress) => {
                    setUploadProgress(progress);
                });
                mediaUrl = res?.url || res?.file_url || res?.media_url;
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

        await sendMessage(text, replyId, msgType, mediaUrl, fileName);
        setInputText("");
        setAttachment(null);
        setReplyingTo(null);
    }, [inputText, attachment, replyingTo, editingMessage, editMessage, sendMessage]);

    // ─── Render ───────────────────────────────────────────────────────────────
    const isTypingActive = typingUser || (typingMap?.[convId] ? true : null);
    const selectedMsgIsPinned = selectedMsg ? pinnedMessages.some(p => String(p.message_id || p.id) === String(selectedMsg.id || selectedMsg.message_id)) : false;

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: t.chatPaneBg || t.bg }]}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ChatHeader
                conversation={conversation}
                typingUser={typingUser}
                onBack={() => navigation.goBack()}
            />

            <PinnedBanner
                pinnedMessages={pinnedMessages}
                activeIndex={activePinIndex}
                theme={t}
                onCycle={handleCyclePinned}
                onOpenList={() => setPinnedListVisible(true)}
                onUnpinActive={(msg) => unpinMessage(msg.message_id || msg.id, msg.scope)}
            />

            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item, idx) => String(item.id || item.message_id || idx)}
                onScrollToIndexFailed={() => {}}
                renderItem={({ item }) => {
                    const senderId = String(item.sender_id || item.user_id || "");
                    const isOwn = senderId === currentUserId;
                    return (
                        <MessageBubble
                            msg={item}
                            isOwn={isOwn}
                            isGroup={isGroup}
                            theme={t}
                            currentUserId={currentUserId}
                            participants={conversation.participants}
                            otherParticipant={conversation.other_participant}
                            userProfile={user}
                            onToggleReaction={handleToggleReaction}
                            onLongPress={openContextMenu}
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
                            <Text style={{ fontSize: 36, marginBottom: 12 }}>👋</Text>
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
                replyingTo={replyingTo}
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
            />

            <ContextMenu
                visible={contextMenuVisible}
                message={selectedMsg}
                isOwn={selectedMsg ? String(selectedMsg.sender_id) === currentUserId : false}
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
                onUnpinMessage={(msg) => unpinMessage(msg.message_id || msg.id, msg.scope)}
                onClose={() => setPinnedListVisible(false)}
            />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
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
