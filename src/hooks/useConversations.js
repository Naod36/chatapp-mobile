import React, { useState, useEffect, useCallback } from "react";
import { conversationService } from "../services/conversations";
import { apiFetch } from "../services/api";
import { useApp } from "../context/AppContext";

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
  } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

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
  }, [searchQuery]);

  // ─── Start a direct conversation ──────────────────────────────────────────
  const startConversation = useCallback(
    async (targetUser) => {
      try {
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
    [setConversations],
  );

  return {
    conversations,
    syncState,
    loadConversations,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    startConversation,
    typingMap,
    presenceMap,
  };
}
