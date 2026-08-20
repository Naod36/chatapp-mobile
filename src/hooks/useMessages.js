import { useState, useEffect, useRef, useCallback } from "react";
import { conversationService } from "../services/conversations";
import { websocketService } from "../services/websocket";
import { useApp } from "../context/AppContext";

/**
 * useMessages — manages message list and pinned messages for a conversation.
 */
export function useMessages(convId, conversationPinnedId = null) {
    const { user, markConversationRead } = useApp();
    const currentUserId = String(user?.userId || user?.user_id || "");

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pinnedMessages, setPinnedMessages] = useState([]);
    const [typingUser, setTypingUser] = useState(null);

    const typingTimerRef = useRef(null);

    // ─── Initial load ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!convId) return;
        let cancelled = false;
        setLoading(true);

        // Fetch messages and pinned messages concurrently
        Promise.all([
            conversationService.getMessages(convId).catch(() => []),
            conversationService.getPinnedMessages(convId).catch(() => []),
        ])
            .then(([msgsData, pinsData]) => {
                if (cancelled) return;
                const sortedMsgs = (msgsData || []).sort(
                    (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
                );
                setMessages(sortedMsgs);

                if (Array.isArray(pinsData) && pinsData.length > 0) {
                    setPinnedMessages(pinsData);
                } else if (conversationPinnedId) {
                    const fallback = sortedMsgs.find(m => String(m.id || m.message_id) === String(conversationPinnedId));
                    if (fallback) {
                        setPinnedMessages([{ ...fallback, scope: "shared" }]);
                    }
                } else {
                    setPinnedMessages([]);
                }
            })
            .catch(err => console.error("useMessages load error:", err.message))
            .finally(() => { if (!cancelled) setLoading(false); });

        // Mark conversation as read on open
        websocketService.send({ action: "read_conversation", conversation_id: convId });
        markConversationRead(convId);

        return () => { cancelled = true; };
    }, [convId, conversationPinnedId]); // eslint-disable-line

    // ─── WebSocket subscription ───────────────────────────────────────────────
    useEffect(() => {
        if (!convId || !user?.token) return;

        const isCurrentConv = (data) => {
            const id = data.conversation_id || data.message?.conversation_id;
            return String(id || "").toLowerCase() === String(convId || "").toLowerCase();
        };

        const handler = (data) => {
            const event = data.event || data.type || data.action;

            if (event === "new_message" && isCurrentConv(data)) {
                const msg = data.message || data;
                const msgId = msg.id || msg.message_id;

                setMessages(prev => {
                    if (msgId && prev.some(m => String(m.id || m.message_id) === String(msgId))) {
                        return prev;
                    }
                    if (String(msg.sender_id) === currentUserId) {
                        const tempIdx = prev.findIndex(
                            m => String(m.id || "").startsWith("temp-")
                        );
                        if (tempIdx !== -1) {
                            const updated = [...prev];
                            updated[tempIdx] = { ...msg, status: msg.status || "sent" };
                            return updated;
                        }
                    }
                    return [...prev, { ...msg, status: msg.status || "sent" }];
                });

                if (String(msg.sender_id) !== currentUserId) {
                    websocketService.send({ action: "read_conversation", conversation_id: convId });
                    markConversationRead(convId);
                }
            } else if (event === "message_sent" && isCurrentConv(data)) {
                setMessages(prev => prev.map(m => {
                    if (String(m.id || "").startsWith("temp-") && String(m.sender_id) === currentUserId) {
                        return { ...m, id: data.message_id, message_id: data.message_id, status: data.status || "sent" };
                    }
                    return m;
                }));
            } else if (event === "message_delivered" && isCurrentConv(data)) {
                setMessages(prev => prev.map(m =>
                    m.status !== "read" ? { ...m, status: "delivered" } : m
                ));
            } else if (event === "read_update" && isCurrentConv(data)) {
                setMessages(prev => prev.map(m => ({ ...m, status: "read" })));
            } else if (event === "message_deleted" && isCurrentConv(data)) {
                const deletedId = String(data.message_id);
                setMessages(prev => prev.filter(
                    m => String(m.id || m.message_id) !== deletedId
                ));
                setPinnedMessages(prev => prev.filter(
                    p => String(p.message_id || p.id) !== deletedId
                ));
            } else if (event === "message_edited" && isCurrentConv(data)) {
                const msgId = String(data.message_id);
                setMessages(prev => prev.map(m =>
                    String(m.id || m.message_id) === msgId
                        ? { ...m, content: data.content, is_edited: true }
                        : m
                ));
                setPinnedMessages(prev => prev.map(p =>
                    String(p.message_id || p.id) === msgId
                        ? { ...p, content: data.content }
                        : p
                ));
            } else if (event === "message_pinned" && isCurrentConv(data)) {
                const msgId = String(data.message_id);
                const scope = data.scope || "shared";
                const pUser = String(data.pinned_by_user_id || "");

                // Check personal scope filtering (ignore if personal and not for current user)
                if (scope === "personal" && pUser && pUser !== currentUserId) {
                    return;
                }

                const pinnedObj = data.pinned_message || {
                    message_id: msgId,
                    id: msgId,
                    conversation_id: convId,
                    scope,
                    pinned_by_user_id: pUser,
                };

                setPinnedMessages(prev => {
                    const filtered = prev.filter(p => String(p.message_id || p.id) !== msgId);
                    return [pinnedObj, ...filtered];
                });
            } else if (event === "message_unpinned" && isCurrentConv(data)) {
                const unpinnedId = String(data.message_id);
                setPinnedMessages(prev => prev.filter(
                    p => String(p.message_id || p.id) !== unpinnedId
                ));
            } else if (event === "message_reacted" && isCurrentConv(data)) {
                const msgId = String(data.message_id);
                const reactUserId = String(data.user_id);
                const emoji = data.emoji;

                setMessages(prev => prev.map(m => {
                    if (String(m.id || m.message_id) !== msgId) return m;
                    const currentRx = { ...(m.reactions || {}) };
                    const userList = [...(currentRx[emoji] || [])];
                    const uIdx = userList.indexOf(reactUserId);
                    if (uIdx !== -1) {
                        userList.splice(uIdx, 1);
                    } else {
                        userList.push(reactUserId);
                    }
                    if (userList.length > 0) {
                        currentRx[emoji] = userList;
                    } else {
                        delete currentRx[emoji];
                    }
                    return { ...m, reactions: Object.keys(currentRx).length > 0 ? currentRx : null };
                }));
            } else if ((event === "typing" || event === "typing_status") && isCurrentConv(data)) {
                const senderId = String(data.user_id || data.sender_id || "");
                if (senderId === currentUserId) return;
                const isTyping = data.is_typing ?? data.typing ?? false;
                if (isTyping) {
                    setTypingUser(data.username || data.sender_name || "Someone");
                    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
                    typingTimerRef.current = setTimeout(() => setTypingUser(null), 4000);
                } else {
                    setTypingUser(null);
                }
            }
        };

        const unsubscribe = websocketService.subscribe(handler);
        return () => {
            unsubscribe();
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        };
    }, [convId, user?.token, currentUserId]); // eslint-disable-line

    // ─── Reactions ────────────────────────────────────────────────────────────
    const toggleReaction = useCallback((msgId, emoji) => {
        if (!convId || !msgId || !emoji) return;
        websocketService.send({
            action: "react_message",
            conversation_id: convId,
            message_id: msgId,
            emoji,
        });
    }, [convId]);

    // ─── Send message ─────────────────────────────────────────────────────────
    const sendMessage = useCallback(async (text = "", replyToId = null, messageType = "text", mediaUrl = null, fileName = null) => {
        const contentStr = text?.trim() || "";
        if (!contentStr && !mediaUrl) return;
        if (!convId) return;

        const tempId = `temp-${Date.now()}`;
        const tempMsg = {
            id: tempId,
            message_id: tempId,
            sender_id: currentUserId,
            user_id: currentUserId,
            content: contentStr,
            message_type: messageType,
            media_url: mediaUrl,
            file_url: mediaUrl,
            file_name: fileName,
            created_at: new Date().toISOString(),
            reply_to_id: replyToId,
            status: "sending",
        };

        setMessages(prev => [...prev, tempMsg]);

        const sent = websocketService.send({
            action: "send_message",
            conversation_id: convId,
            content: contentStr,
            message_type: messageType,
            media_url: mediaUrl,
            file_url: mediaUrl,
            file_name: fileName,
            reply_to_id: replyToId,
        });

        if (!sent) {
            try {
                const confirmed = await conversationService.sendMessage(convId, contentStr, messageType, replyToId, mediaUrl, fileName);
                if (confirmed) {
                    setMessages(prev => prev.map(m =>
                        m.id === tempId ? { ...confirmed, status: "sent" } : m
                    ));
                }
            } catch (err) {
                console.error("Send via REST failed:", err.message);
                setMessages(prev => prev.filter(m => m.id !== tempId));
            }
        }
    }, [convId, currentUserId]);

    // ─── Edit message ─────────────────────────────────────────────────────────
    const editMessage = useCallback((msgId, newContent) => {
        if (!convId || !msgId || !newContent?.trim()) return;
        websocketService.send({
            action: "edit_message",
            conversation_id: convId,
            message_id: msgId,
            content: newContent.trim(),
        });
        setMessages(prev => prev.map(m =>
            String(m.id || m.message_id) === String(msgId)
                ? { ...m, content: newContent.trim(), is_edited: true }
                : m
        ));
    }, [convId]);

    // ─── Pin message ──────────────────────────────────────────────────────────
    const pinMessage = useCallback(async (msgId, scope = "shared", notify = true) => {
        if (!convId || !msgId) return;
        const targetMsg = messages.find(m => String(m.id || m.message_id) === String(msgId)) || {
            id: msgId,
            message_id: msgId,
            content: "Pinned message",
        };

        const pinItem = {
            ...targetMsg,
            message_id: msgId,
            conversation_id: convId,
            scope,
            notify,
            pinned_by_user_id: currentUserId,
        };

        // Optimistically update
        setPinnedMessages(prev => [pinItem, ...prev.filter(p => String(p.message_id || p.id) !== String(msgId))]);

        // WS send
        websocketService.send({
            action: "pin_message",
            conversation_id: String(convId),
            message_id: String(msgId),
            scope,
            notify,
        });

        // REST fallback
        try {
            await conversationService.pinMessage(convId, msgId, scope, notify);
        } catch (e) {
            // WS primary handles state
        }
    }, [convId, messages, currentUserId]);

    // ─── Unpin message ────────────────────────────────────────────────────────
    const unpinMessage = useCallback(async (msgId, scope = null) => {
        if (!convId || !msgId) return;

        // Optimistically update
        setPinnedMessages(prev => prev.filter(p => String(p.message_id || p.id) !== String(msgId)));

        // WS send
        websocketService.send({
            action: "unpin_message",
            conversation_id: String(convId),
            message_id: String(msgId),
            scope,
        });

        // REST fallback
        try {
            await conversationService.unpinMessage(convId, msgId);
        } catch (e) {
            // WS primary
        }
    }, [convId]);

    // ─── Delete message ───────────────────────────────────────────────────────
    const deleteMessage = useCallback(async (msgId) => {
        try {
            await conversationService.deleteMessage(msgId);
            setMessages(prev => prev.filter(m => String(m.id || m.message_id) !== String(msgId)));
            setPinnedMessages(prev => prev.filter(p => String(p.message_id || p.id) !== String(msgId)));
        } catch (err) {
            throw err;
        }
    }, []);

    // ─── Typing broadcast ─────────────────────────────────────────────────────
    const typingBroadcastTimerRef = useRef(null);
    const lastTypingRef = useRef(0);

    const broadcastTyping = useCallback((isTyping) => {
        websocketService.send({
            action: "typing",
            conversation_id: convId,
            is_typing: isTyping,
        });
    }, [convId]);

    const handleTypingStart = useCallback(() => {
        const now = Date.now();
        if (now - lastTypingRef.current > 2000) {
            lastTypingRef.current = now;
            broadcastTyping(true);
        }
        if (typingBroadcastTimerRef.current) clearTimeout(typingBroadcastTimerRef.current);
        typingBroadcastTimerRef.current = setTimeout(() => broadcastTyping(false), 3000);
    }, [broadcastTyping]);

    const handleTypingStop = useCallback(() => {
        if (typingBroadcastTimerRef.current) clearTimeout(typingBroadcastTimerRef.current);
        broadcastTyping(false);
    }, [broadcastTyping]);

    return {
        messages,
        loading,
        pinnedMessages,
        setPinnedMessages,
        typingUser,
        sendMessage,
        editMessage,
        pinMessage,
        unpinMessage,
        deleteMessage,
        toggleReaction,
        handleTypingStart,
        handleTypingStop,
    };
}
