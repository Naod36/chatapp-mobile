import { AppState } from "react-native";
import { WS_BASE } from "./api";

let socketInstance = null;
let currentToken = null;
let pingIntervalTimer = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let isIntentionallyClosed = false;

const listeners = new Set();
const openCallbacks = new Set();
const closeCallbacks = new Set();

// Listen to React Native AppState changes (Foreground vs Background)
let appState = AppState.currentState;
AppState.addEventListener("change", (nextAppState) => {
    if (appState.match(/inactive|background/) && nextAppState === "active") {
        console.log("App returned to foreground — checking WebSocket health...");
        if (currentToken && (!socketInstance || socketInstance.readyState === WebSocket.CLOSED || socketInstance.readyState === WebSocket.CLOSING)) {
            websocketService.reconnect();
        }
    }
    appState = nextAppState;
});

function startHeartbeat() {
    stopHeartbeat();
    pingIntervalTimer = setInterval(() => {
        if (socketInstance && socketInstance.readyState === WebSocket.OPEN) {
            try {
                socketInstance.send(JSON.stringify({ action: "ping" }));
            } catch (err) {
                console.error("Failed to send WebSocket heartbeat ping:", err);
            }
        }
    }, 25000); // 25s ping keeps Render cloud connection active
}

function stopHeartbeat() {
    if (pingIntervalTimer) {
        clearInterval(pingIntervalTimer);
        pingIntervalTimer = null;
    }
}

function scheduleReconnect() {
    if (reconnectTimer || isIntentionallyClosed || !currentToken) return;

    // Exponential backoff: 1s, 2s, 4s, 8s, max 16s
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 16000);
    reconnectAttempts++;
    console.log(`Scheduling WebSocket reconnect attempt #${reconnectAttempts} in ${delay}ms...`);

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (currentToken && !isIntentionallyClosed) {
            websocketService.connect(currentToken);
        }
    }, delay);
}

export const websocketService = {
    connect(token, onMessage, onOpen, onClose, onError) {
        if (!token) {
            console.error("WebSocket connection requires an auth token.");
            return null;
        }

        if (onMessage) listeners.add(onMessage);
        if (onOpen) openCallbacks.add(onOpen);
        if (onClose) closeCallbacks.add(onClose);

        // If socket is already open or connecting with the same token, return existing
        if (socketInstance && currentToken === token && (socketInstance.readyState === WebSocket.OPEN || socketInstance.readyState === WebSocket.CONNECTING)) {
            if (socketInstance.readyState === WebSocket.OPEN && onOpen) {
                try { onOpen(); } catch (e) { }
            }
            return socketInstance;
        }

        if (socketInstance) {
            try {
                stopHeartbeat();
                socketInstance.close();
            } catch (e) { }
        }

        currentToken = token;
        isIntentionallyClosed = false;
        console.log("Connecting WebSocket to:", `${WS_BASE}/ws`);
        socketInstance = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`);

        socketInstance.onopen = (event) => {
            console.log("WebSocket connected successfully.");
            reconnectAttempts = 0; // reset retry counter on success
            startHeartbeat();

            openCallbacks.forEach(cb => { try { cb(event); } catch (e) { } });
        };

        socketInstance.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.event === "pong" || data.action === "pong") return; // Ignore heartbeat responses
                listeners.forEach(cb => { try { cb(data); } catch (e) { } });
            } catch (err) {
                console.error("Failed to parse WebSocket message:", err);
            }
        };

        socketInstance.onclose = (event) => {
            console.log("WebSocket disconnected.");
            stopHeartbeat();
            closeCallbacks.forEach(cb => { try { cb(event); } catch (e) { } });

            if (!isIntentionallyClosed) {
                scheduleReconnect();
            }
        };

        socketInstance.onerror = (error) => {
            console.error("WebSocket error:", error);
            if (onError) onError(error);
        };

        return socketInstance;
    },

    reconnect() {
        if (!currentToken) return;
        console.log("Force-reconnecting WebSocket...");
        if (socketInstance) {
            try {
                stopHeartbeat();
                socketInstance.close();
            } catch (e) { }
            socketInstance = null;
        }
        reconnectAttempts = 0;
        this.connect(currentToken);
    },

    subscribe(onMessage) {
        if (onMessage) listeners.add(onMessage);
        return () => {
            listeners.delete(onMessage);
        };
    },

    send(data) {
        if (socketInstance && socketInstance.readyState === WebSocket.OPEN) {
            try {
                socketInstance.send(typeof data === "string" ? data : JSON.stringify(data));
                return true;
            } catch (err) {
                console.error("WebSocket send error:", err);
                return false;
            }
        }
        return false;
    },

    unsubscribe(onMessage) {
        if (onMessage) listeners.delete(onMessage);
    },

    closeAll() {
        isIntentionallyClosed = true;
        stopHeartbeat();
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (socketInstance) {
            try { socketInstance.close(); } catch (e) { }
            socketInstance = null;
            currentToken = null;
        }
        listeners.clear();
        openCallbacks.clear();
        closeCallbacks.clear();
    }
};
