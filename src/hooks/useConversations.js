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
    const { conversations, setConversations, syncState, loadConversations, user, typingMap, presenceMap } = useApp();


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
                const results = await apiFetch(`/users/search?query=${encodeURIComponent(searchQuery.trim())}`);
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
    const startConversation = useCallback(async (targetUser) => {
        try {
            const conv = await conversationService.createConversation(
                targetUser.user_id || targetUser.id
            );
            setConversations(prev => {
                if (prev.some(c => String(c.id) === String(conv.id))) return prev;
                return [conv, ...prev];
            });
            setSearchQuery("");
            return conv;
        } catch (err) {
            console.error("startConversation error:", err.message);
            throw err;
        }
    }, [setConversations]);

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

