import React, { useState, useEffect, useCallback, useRef } from "react";
import { conversationService } from "../services/conversations";
import { apiFetch } from "../services/api";
import { useApp } from "../context/AppContext";
import { redactUser } from "../utils/blockPolicy";

/**
 * useConversations — provides conversations state management.
 * The actual live conversations state lives in AppContext; this hook
 * exposes helpers for the conversation list screen.
 */
export function useConversations() {
  const {
    conversations,
    setConversations,
    syncState,
    loadConversations,
    user,
    typingMap,
    presenceMap,
    getBlockPolicy,
    blockStateReady,
    blockStateVersion,
    isBlockedBy,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [openingSavedMessages, setOpeningSavedMessages] = useState(false);
  const savedRequestRef = useRef(null);
  const accountRef = useRef(user);
  accountRef.current = user;

  const openSavedMessages = useCallback(async () => {
    if (savedRequestRef.current) return null;
    const accountId = user?.userId || user?.user_id;
    if (!accountId || !user?.token) throw new Error("Please sign in again.");
    const request = {};
    savedRequestRef.current = request;
    setOpeningSavedMessages(true);
    try {
      const existing = conversations.find(
        (conversation) =>
          conversation.type === "direct" &&
          !conversation.other_participant &&
          (conversation.id || conversation.conversation_id) &&
          conversation.id !== "virtual-saved-messages",
      );
      const result = existing
        ? { conversation_id: existing.id || existing.conversation_id }
        : await conversationService.createConversation(accountId);
      if (
        accountRef.current?.token !== user.token ||
        (accountRef.current?.userId || accountRef.current?.user_id) !==
          accountId
      )
        return null;
      if (!result?.conversation_id)
        throw new Error("Could not open Saved Messages. Please try again.");
      const conversation = existing || {
        id: result.conversation_id,
        conversation_id: result.conversation_id,
        type: "direct",
        display_name: "Saved Messages",
        other_participant: null,
        unread_count: 0,
      };
      setConversations((previous) =>
        previous.some(
          (entry) =>
            String(entry.id || entry.conversation_id) ===
            String(result.conversation_id),
        )
          ? previous
          : [conversation, ...previous],
      );
      setSearchQuery("");
      return conversation;
    } finally {
      savedRequestRef.current = null;
      setOpeningSavedMessages(false);
    }
  }, [conversations, user, setConversations]);

  // ─── User search ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await apiFetch(
          `/users/search?query=${encodeURIComponent(searchQuery.trim())}`,
        );
        setSearchResults(Array.isArray(results) ? results : []);
      } catch (err) {
        console.error("User search error:", err.message);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, blockStateVersion]);

  // ─── Start a direct conversation ──────────────────────────────────────────
  const startConversation = useCallback(
    async (targetUser) => {
      try {
        if (
          !blockStateReady ||
          getBlockPolicy(targetUser.user_id || targetUser.id)
            .preventDirectInteraction
        ) {
          throw new Error(
            "Direct messaging is unavailable for this conversation.",
          );
        }
        const result = await conversationService.createConversation(
          targetUser.user_id || targetUser.id,
        );
        // The create endpoint only returns { conversation_id }; build a full
        // conversation object from data we already have so the chat header
        // shows the right name/avatar immediately instead of "Chat".
        const conv = {
          id: result.conversation_id,
          conversation_id: result.conversation_id,
          type: "direct",
          other_participant: {
            user_id: targetUser.user_id || targetUser.id,
            username: targetUser.username,
            display_name: targetUser.display_name,
            avatar_url: targetUser.avatar_url,
          },
        };
        setConversations((prev) => {
          if (prev.some((c) => String(c.id) === String(conv.id))) return prev;
          return [conv, ...prev];
        });
        setSearchQuery("");
        return conv;
      } catch (err) {
        console.error("startConversation error:", err.message);
        throw err;
      }
    },
    [setConversations, getBlockPolicy, blockStateReady],
  );

  return {
    conversations,
    syncState,
    loadConversations,
    searchQuery,
    setSearchQuery,
    searchResults: searchResults.map((person) =>
      redactUser(
        person,
        (identity) => !blockStateReady || isBlockedBy(identity),
      ),
    ),
    isSearching,
    startConversation,
    openSavedMessages,
    openingSavedMessages,
    typingMap,
    presenceMap,
  };
}
