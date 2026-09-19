import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Appearance } from "react-native";
import { blockPolicy } from "../utils/blockPolicy";
import { createBlockRefresh } from "../utils/blockRefresh";
import { authService } from "../services/auth";
import { conversationService } from "../services/conversations";
import { userService } from "../services/user";
import { websocketService } from "../services/websocket";
import {
  registerForPushNotificationsAsync,
  registerPushToken,
} from "../services/notifications";
import {
  onSessionExpired,
  SESSION_EXPIRED_MESSAGE,
} from "../services/session.js";
import { THEMES } from "../theme/colors";
import { applyPresence } from "../utils/presence";

const AppContext = createContext(null);
const THEME_KEY = "@flowchat_theme_key";

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [themePreference, setThemePreference] = useState("light"); // "light" | "dark" | "system"
  const [systemScheme, setSystemScheme] = useState(
    () => Appearance?.getColorScheme?.() || "light",
  );
  const [syncState, setSyncState] = useState("connecting");
  const [presenceMap, setPresenceMap] = useState({});
  const [typingMap, setTypingMap] = useState({});
  const [updateBannerVisible, setUpdateBannerVisible] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState([]);
  const [blockedByUserIds, setBlockedByUserIds] = useState([]);
  const [blockStateVersion, setBlockStateVersion] = useState(0);
  const [blockStateReady, setBlockStateReady] = useState(false);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState(null);
  const relationsRef = useRef({ outgoing: [], incoming: [], ready: false });
  const blockRefreshRef = useRef(null);
  const conversationGenerationRef = useRef(0);
  const authTokenRef = useRef(null);
  const unreadRevisionsRef = useRef(new Map());
  const seenMessagesRef = useRef(new Set());

  const themeKey =
    themePreference === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : themePreference;
  const t = THEMES[themeKey] || THEMES.light;

  // ─── Auth ────────────────────────────────────────────────────────────────
  useEffect(() => {
    authService
      .getCurrentUser()
      .then((u) => {
        if (u) {
          conversationGenerationRef.current += 1;
          authTokenRef.current = u.token;
          setUser(u);
        }
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, []);

  const login = useCallback((userData) => {
    unreadRevisionsRef.current.clear();
    seenMessagesRef.current.clear();
    conversationGenerationRef.current += 1;
    authTokenRef.current = userData.token;
    setUser({
      userId: userData.userId || userData.user_id,
      user_id: userData.userId || userData.user_id,
      username: userData.username,
      token: userData.token,
    });
  }, []);

  const logout = useCallback(async () => {
    unreadRevisionsRef.current.clear();
    seenMessagesRef.current.clear();
    conversationGenerationRef.current += 1;
    authTokenRef.current = null;
    blockRefreshRef.current?.stop();
    blockRefreshRef.current = null;
    relationsRef.current = { outgoing: [], incoming: [], ready: false };
    setBlockStateReady(false);
    try {
      websocketService.closeAll();
    } catch (e) {}
    try {
      await authService.logout();
    } catch (e) {}
    setUser(null);
    setConversations([]);
    setPresenceMap({});
    setTypingMap({});
    setBlockedUserIds([]);
    setBlockedByUserIds([]);
  }, []);

  const clearSessionExpiredMessage = useCallback(() => {
    setSessionExpiredMessage(null);
  }, []);

  // ─── Expired-session recovery ───────────────────────────────────────────
  // Fired by services/api.js when a request comes back 401: forces a full
  // logout (clearing polling/WebSocket/state) and surfaces a message on the
  // login screen instead of leaving the user stuck re-hitting the same 401.
  useEffect(() => {
    const unsubscribe = onSessionExpired(() => {
      setSessionExpiredMessage(SESSION_EXPIRED_MESSAGE);
      logout();
    });
    return unsubscribe;
  }, [logout]);

  // ─── Theme ───────────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((saved) => {
        if (saved === "system") setThemePreference("system");
        else if (saved && THEMES[saved])
          setThemePreference(THEMES[saved].isDark ? "dark" : "light");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (themePreference !== "system") return;
    const subscription = Appearance?.addChangeListener?.(({ colorScheme }) =>
      setSystemScheme(colorScheme || "light"),
    );
    return () => subscription?.remove?.();
  }, [themePreference]);

  const changeTheme = useCallback(async (newKey) => {
    const nextKey =
      newKey === "system"
        ? "system"
        : THEMES[newKey]
          ? THEMES[newKey].isDark
            ? "dark"
            : "light"
          : null;
    if (!nextKey) return;
    setThemePreference(nextKey);
    await AsyncStorage.setItem(THEME_KEY, nextKey).catch(() => {});
  }, []);

  const typingTimersRef = useRef({});

  // ─── Conversations ───────────────────────────────────────────────────────
  const loadConversations = useCallback(
    async (showUpdating = true) => {
      if (!user?.token || user.token !== authTokenRef.current) return;
      const generation = ++conversationGenerationRef.current;
      const unreadRevisions = new Map(unreadRevisionsRef.current);
      const isCurrent = () =>
        generation === conversationGenerationRef.current &&
        user.token === authTokenRef.current;
      if (showUpdating) setSyncState("updating");
      try {
        const data = await conversationService.listConversations();
        if (!isCurrent()) return;
        const normalized = (data || []).map((c) => ({
          ...c,
          id: c.id || c.conversation_id,
          conversation_id: c.conversation_id || c.id,
        }));
        setConversations((previous) =>
          normalized.map((conversation) => {
            const identity = String(conversation.id);
            if (
              unreadRevisions.get(identity) ===
              unreadRevisionsRef.current.get(identity)
            )
              return conversation;
            const live = previous.find(
              (entry) => String(entry.id || entry.conversation_id) === identity,
            );
            return live
              ? {
                  ...conversation,
                  unread_count: live.unread_count,
                  last_message: live.last_message,
                  last_message_content: live.last_message_content,
                  last_message_time: live.last_message_time,
                }
              : conversation;
          }),
        );
      } catch (err) {
        if (!isCurrent()) return;
        console.warn("loadConversations notice:", err.message);
        if (
          err.message?.includes("session has expired") ||
          err.message?.includes("401") ||
          err.message?.includes("Access denied")
        ) {
          logout();
        }
      } finally {
        if (isCurrent()) setSyncState("ready");
      }
    },
    [user?.token],
  );

  useEffect(
    () => () => {
      conversationGenerationRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (user?.token) {
      setSyncState("connecting");
      loadConversations(false);
    }
  }, [user?.token]); // eslint-disable-line

  // ─── Push notifications: register this device's token once logged in ────
  useEffect(() => {
    if (!user?.token) return;
    let cancelled = false;
    registerForPushNotificationsAsync().then((pushToken) => {
      if (!cancelled && pushToken) {
        registerPushToken(pushToken);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.token]);

  // ─── Blocked users ────────────────────────────────────────────────────────
  const applyRelations = useCallback((outgoing, incoming) => {
    outgoing = [...new Set(outgoing.map(String))].sort();
    incoming = [...new Set(incoming.map(String))].sort();
    const previous = relationsRef.current;
    const changed =
      !previous.ready ||
      JSON.stringify([outgoing, incoming]) !==
        JSON.stringify([previous.outgoing, previous.incoming]);
    relationsRef.current = { outgoing, incoming, ready: true };
    setBlockedUserIds(outgoing);
    setBlockedByUserIds(incoming);
    setBlockStateReady(true);
    if (changed) {
      conversationGenerationRef.current += 1;
      setPresenceMap({});
      setTypingMap({});
      setBlockStateVersion((version) => version + 1);
      loadConversationsRef.current(false);
    }
  }, []);

  const refreshBlockState = useCallback(
    () => blockRefreshRef.current?.refresh(),
    [],
  );
  const refreshBlockedUsers = refreshBlockState;
  const refreshBlockedByUsers = refreshBlockState;

  useEffect(() => {
    relationsRef.current = { outgoing: [], incoming: [], ready: false };
    setBlockedUserIds([]);
    setBlockedByUserIds([]);
    setBlockStateReady(false);
    if (!user?.token) return;
    const refresh = createBlockRefresh(
      async (signal) =>
        Promise.all([
          userService.getBlockedUsers(signal),
          userService.getBlockedByUsers(signal),
        ]),
      ([outgoing, incoming]) =>
        applyRelations(
          (outgoing || []).map((person) => person.user_id || person.id),
          incoming || [],
        ),
      (error) => console.warn("Block state refresh:", error.message),
    );
    blockRefreshRef.current = refresh;
    refresh.refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh.refresh();
    });
    const timer = setInterval(() => {
      if (!AppState.currentState || AppState.currentState === "active")
        refresh.refresh();
    }, 12000);
    return () => {
      refresh.stop();
      if (blockRefreshRef.current === refresh) blockRefreshRef.current = null;
      clearInterval(timer);
      subscription.remove();
    };
  }, [user?.token, applyRelations]);

  const getBlockPolicy = useCallback((userId, isGroup = false) => {
    const relation = relationsRef.current;
    return blockPolicy(userId, relation.outgoing, relation.incoming, isGroup);
  }, []);

  const isBlocked = useCallback(
    (userId) => blockedUserIds.includes(String(userId || "")),
    [blockedUserIds],
  );

  const blockUser = useCallback(
    async (userId) => {
      const owner = blockRefreshRef.current;
      await userService.blockUser(userId);
      if (owner !== blockRefreshRef.current) return;
      const { outgoing, incoming } = relationsRef.current;
      applyRelations([...outgoing, String(userId)], incoming);
      await refreshBlockState();
    },
    [applyRelations, refreshBlockState],
  );

  const unblockUser = useCallback(
    async (userId) => {
      const owner = blockRefreshRef.current;
      await userService.unblockUser(userId);
      if (owner !== blockRefreshRef.current) return;
      const { outgoing, incoming } = relationsRef.current;
      applyRelations(
        outgoing.filter((id) => id !== String(userId)),
        incoming,
      );
      await refreshBlockState();
    },
    [applyRelations, refreshBlockState],
  );

  const isBlockedBy = useCallback(
    (userId) => blockedByUserIds.includes(String(userId || "")),
    [blockedByUserIds],
  );

  // ─── WebSocket: connect once when token available ────────────────────────
  useEffect(() => {
    if (!user?.token) return;
    websocketService.connect(
      user.token,
      null, // handlers registered separately below via subscribe
      () => {
        refreshBlockState();
        loadConversationsRef.current(true);
      },
      () => setSyncState("connecting"),
      (err) => console.warn("WS Error:", err),
    );
  }, [user?.token]);

  // ─── WebSocket: subscribe to messages (re-registers when deps change) ────
  // Keep a stable user ref so the handler closure always has current userId
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const conversationsRef = useRef(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const loadConversationsRef = useRef(loadConversations);
  useEffect(() => {
    loadConversationsRef.current = loadConversations;
  }, [loadConversations]);

  useEffect(() => {
    if (!user?.token) return;

    const handler = (data) => {
      const currentUserId = String(
        userRef.current?.userId || userRef.current?.user_id || "",
      );
      const event = data.event || data.type || data.action;
      if (event === "block_state_changed") {
        refreshBlockState();
        return;
      }

      // ── New message ──────────────────────────────────────────────────
      if (event === "new_message") {
        const rawConvId = data.conversation_id || data.message?.conversation_id;
        const msg = data.message || data;
        if (!rawConvId) return;
        const convIdStr = String(rawConvId);

        const messageId = msg.message_id || msg.id;
        const messageKey = messageId ? `${convIdStr}:${messageId}` : null;
        if (messageKey && seenMessagesRef.current.has(messageKey)) return;
        if (messageKey) {
          seenMessagesRef.current.add(messageKey);
          if (seenMessagesRef.current.size > 2000)
            seenMessagesRef.current.delete(
              seenMessagesRef.current.values().next().value,
            );
        }
        unreadRevisionsRef.current.set(
          convIdStr,
          (unreadRevisionsRef.current.get(convIdStr) || 0) + 1,
        );

        // Derive a clean text preview
        let preview = "";
        if (msg.content) preview = msg.content;
        else if (msg.message_type === "image") preview = "Image";
        else if (msg.message_type === "voice" || msg.message_type === "audio")
          preview = "Voice message";
        else if (msg.message_type === "file") preview = msg.file_name || "File";
        else if (msg.message_type === "video") preview = "Video";

        setConversations((prev) => {
          const idx = prev.findIndex(
            (c) => String(c.id || c.conversation_id) === convIdStr,
          );
          if (idx === -1) {
            // Unknown conv — reload list
            loadConversationsRef.current(false);
            return prev;
          }
          const updated = [...prev];
          if (
            messageId &&
            String(
              updated[idx].last_message?.id ||
                updated[idx].last_message?.message_id ||
                "",
            ) === String(messageId)
          )
            return prev;
          const conv = {
            ...updated[idx],
            id: updated[idx].id || updated[idx].conversation_id,
            conversation_id: updated[idx].conversation_id || updated[idx].id,
            last_message: msg,
            last_message_content: preview,
            last_message_time: msg.created_at || new Date().toISOString(),
            unread_count:
              String(msg.sender_id) !== currentUserId
                ? (Number(updated[idx].unread_count) || 0) + 1
                : updated[idx].unread_count,
          };
          updated.splice(idx, 1);
          updated.unshift(conv);
          return updated;
        });

        // ── Presence ─────────────────────────────────────────────────────
      } else if (event === "user_status") {
        const uid = String(data.user_id || data.userId || "");
        const status = data.status;
        if (!uid || !status || getBlockPolicy(uid).hideIdentity) return;
        setPresenceMap((prev) => ({ ...prev, [uid]: status }));
        setConversations((previous) =>
          previous.map((conversation) => applyPresence(conversation, data)),
        );

        // ── Typing ───────────────────────────────────────────────────────
      } else if (event === "typing" || event === "typing_status") {
        const rawConvId = data.conversation_id;
        if (!rawConvId) return;
        const convIdStr = String(rawConvId);
        const senderId = String(data.user_id || data.sender_id || "");
        if (senderId && senderId === currentUserId) return;
        if (!senderId || getBlockPolicy(senderId).hideIdentity) return;
        const isTyping = data.is_typing ?? data.typing ?? false;

        setTypingMap((prev) => ({ ...prev, [convIdStr]: isTyping }));
        if (typingTimersRef.current[convIdStr]) {
          clearTimeout(typingTimersRef.current[convIdStr]);
        }
        if (isTyping) {
          typingTimersRef.current[convIdStr] = setTimeout(() => {
            setTypingMap((prev) => ({ ...prev, [convIdStr]: false }));
          }, 4000);
        }

        // ── Read / delivered ─────────────────────────────────────────────
      } else if (event === "read_update" || event === "message_delivered") {
        if (event !== "read_update" || String(data.user_id) !== currentUserId)
          return;
        const convIdStr = String(data.conversation_id || "");
        if (!convIdStr) return;
        unreadRevisionsRef.current.set(
          convIdStr,
          (unreadRevisionsRef.current.get(convIdStr) || 0) + 1,
        );
        setConversations((prev) =>
          prev.map((c) =>
            String(c.id) === convIdStr ? { ...c, unread_count: 0 } : c,
          ),
        );

        // ── Group admin promoted/demoted ────────────────────────────────
      } else if (event === "group_admin_updated") {
        const convIdStr = String(data.conversation_id || "");
        const targetId = String(data.target_user_id || "");
        if (!convIdStr || !targetId) return;
        setConversations((prev) =>
          prev.map((c) => {
            if (String(c.id || c.conversation_id) !== convIdStr) return c;
            const participants = (c.participants || []).map((p) =>
              String(p.user_id || p.id) === targetId
                ? { ...p, role: data.is_admin ? "admin" : "member" }
                : p,
            );
            return { ...c, participants };
          }),
        );

        // ── Group member added ───────────────────────────────────────────
      } else if (event === "group_member_added") {
        const convIdStr = String(data.conversation_id || "");
        const targetId = String(data.target_user_id || "");
        if (!convIdStr || !targetId) return;
        const conv = conversationsRef.current.find(
          (c) => String(c.id || c.conversation_id) === convIdStr,
        );
        const alreadyMember = (conv?.participants || []).some(
          (p) => String(p.user_id || p.id) === targetId,
        );
        // The event only carries the target user id; refresh from the
        // server to pick up their username/avatar/display_name.
        if (!alreadyMember) loadConversationsRef.current(false);

        // ── Group title/avatar updated ────────────────────────────────────
      } else if (event === "group_updated") {
        const convIdStr = String(data.conversation_id || "");
        if (!convIdStr) return;
        setConversations((prev) =>
          prev.map((c) =>
            String(c.id || c.conversation_id) === convIdStr
              ? {
                  ...c,
                  title: data.title ?? c.title,
                  avatar_url: data.avatar_url ?? c.avatar_url,
                }
              : c,
          ),
        );
      }
    };

    const unsubscribe = websocketService.subscribe(handler);
    return () => unsubscribe();
  }, [user?.token]);

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const markConversationRead = useCallback((convId) => {
    const identity = String(convId);
    unreadRevisionsRef.current.set(
      identity,
      (unreadRevisionsRef.current.get(identity) || 0) + 1,
    );
    setConversations((prev) =>
      prev.map((c) =>
        String(c.id) === String(convId) ? { ...c, unread_count: 0 } : c,
      ),
    );
  }, []);

  const getPresence = useCallback(
    (userId) => {
      if (!userId || !blockStateReady || isBlockedBy(userId)) return "offline";
      return presenceMap[String(userId)] || "offline";
    },
    [presenceMap, blockStateReady, isBlockedBy],
  );

  const value = {
    user,
    authLoading,
    login,
    logout,
    sessionExpiredMessage,
    clearSessionExpiredMessage,
    themeKey,
    themePreference,
    theme: t,
    changeTheme,
    conversations,
    setConversations,
    syncState,
    loadConversations,
    markConversationRead,
    presenceMap,
    getPresence,
    typingMap,
    updateBannerVisible,
    setUpdateBannerVisible,
    blockedUserIds,
    isBlocked,
    blockUser,
    unblockUser,
    refreshBlockedUsers,
    blockedByUserIds,
    isBlockedBy,
    refreshBlockedByUsers,
    refreshBlockState,
    blockStateVersion,
    blockStateReady,
    getBlockPolicy,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
