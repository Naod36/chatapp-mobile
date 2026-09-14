import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService } from "../services/auth";
import { conversationService } from "../services/conversations";
import { websocketService } from "../services/websocket";
import {
  registerForPushNotificationsAsync,
  registerPushToken,
} from "../services/notifications";
import { THEMES } from "../theme/colors";

const AppContext = createContext(null);
const THEME_KEY = "@flowchat_theme_key";

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [themeKey, setThemeKey] = useState("light");
  const [syncState, setSyncState] = useState("connecting");
  const [presenceMap, setPresenceMap] = useState({});
  const [typingMap, setTypingMap] = useState({});
  const [updateBannerVisible, setUpdateBannerVisible] = useState(false);

  const t = THEMES[themeKey] || THEMES.light;

  // ─── Auth ────────────────────────────────────────────────────────────────
  useEffect(() => {
    authService
      .getCurrentUser()
      .then((u) => {
        if (u) setUser(u);
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, []);

  const login = useCallback((userData) => {
    setUser({
      userId: userData.userId || userData.user_id,
      user_id: userData.userId || userData.user_id,
      username: userData.username,
      token: userData.token,
    });
  }, []);

  const logout = useCallback(async () => {
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
  }, []);

  // ─── Theme ───────────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((saved) => {
        if (saved && THEMES[saved]) setThemeKey(saved);
      })
      .catch(() => {});
  }, []);

  const changeTheme = useCallback(async (newKey) => {
    if (!THEMES[newKey]) return;
    setThemeKey(newKey);
    await AsyncStorage.setItem(THEME_KEY, newKey).catch(() => {});
  }, []);

  const typingTimersRef = useRef({});

  // ─── Conversations ───────────────────────────────────────────────────────
  const loadConversations = useCallback(
    async (showUpdating = true) => {
      if (!user?.token) return;
      if (showUpdating) setSyncState("updating");
      try {
        const data = await conversationService.listConversations();
        const normalized = (data || []).map((c) => ({
          ...c,
          id: c.id || c.conversation_id,
          conversation_id: c.conversation_id || c.id,
        }));
        setConversations(normalized);
      } catch (err) {
        console.warn("loadConversations notice:", err.message);
        if (
          err.message?.includes("session has expired") ||
          err.message?.includes("401") ||
          err.message?.includes("Access denied")
        ) {
          logout();
        }
      } finally {
        setSyncState("ready");
      }
    },
    [user?.token],
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

  // ─── WebSocket: connect once when token available ────────────────────────
  useEffect(() => {
    if (!user?.token) return;
    websocketService.connect(
      user.token,
      null, // handlers registered separately below via subscribe
      () => loadConversations(true), // reconnected: show "updating" while re-syncing, then "ready"
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

      // ── New message ──────────────────────────────────────────────────
      if (event === "new_message") {
        const rawConvId = data.conversation_id || data.message?.conversation_id;
        const msg = data.message || data;
        if (!rawConvId) return;
        const convIdStr = String(rawConvId);

        // Derive a clean text preview
        let preview = "";
        if (msg.content) preview = msg.content;
        else if (msg.message_type === "image") preview = "Image";
        else if (msg.message_type === "voice" || msg.message_type === "audio")
          preview = "Voice message";
        else if (msg.message_type === "file")
          preview = msg.file_name || "File";
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
          const conv = {
            ...updated[idx],
            id: updated[idx].id || updated[idx].conversation_id,
            conversation_id: updated[idx].conversation_id || updated[idx].id,
            last_message: msg,
            last_message_content: preview,
            last_message_time: msg.created_at || new Date().toISOString(),
            unread_count:
              String(msg.sender_id) !== currentUserId
                ? (updated[idx].unread_count || 0) + 1
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
        if (!uid || !status) return;
        setPresenceMap((prev) => ({ ...prev, [uid]: status }));
        setConversations((prev) =>
          prev.map((c) => {
            const otherId = String(
              c.other_participant?.user_id || c.other_participant?.id || "",
            );
            if (otherId && otherId === uid) {
              return {
                ...c,
                status,
                other_participant: { ...c.other_participant, status },
              };
            }
            return c;
          }),
        );

        // ── Typing ───────────────────────────────────────────────────────
      } else if (event === "typing" || event === "typing_status") {
        const rawConvId = data.conversation_id;
        if (!rawConvId) return;
        const convIdStr = String(rawConvId);
        const senderId = String(data.user_id || data.sender_id || "");
        if (senderId && senderId === currentUserId) return;
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
        const convIdStr = String(data.conversation_id || "");
        if (!convIdStr) return;
        setConversations((prev) =>
          prev.map((c) =>
            String(c.id) === convIdStr ? { ...c, unread_count: 0 } : c,
          ),
        );
      }
    };

    const unsubscribe = websocketService.subscribe(handler);
    return () => unsubscribe();
  }, [user?.token]);

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const markConversationRead = useCallback((convId) => {
    setConversations((prev) =>
      prev.map((c) =>
        String(c.id) === String(convId) ? { ...c, unread_count: 0 } : c,
      ),
    );
  }, []);

  const getPresence = useCallback(
    (userId) => {
      if (!userId) return "offline";
      return presenceMap[String(userId)] || "offline";
    },
    [presenceMap],
  );

  const value = {
    user,
    authLoading,
    login,
    logout,
    themeKey,
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
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
