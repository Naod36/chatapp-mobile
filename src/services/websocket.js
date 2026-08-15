import { WS_BASE } from "./api";

let socketInstance = null;
let currentToken = null;
const listeners = new Set();
const openCallbacks = new Set();
const closeCallbacks = new Set();

export const websocketService = {
    connect(token, onMessage, onOpen, onClose, onError) {
        if (!token) {
            console.error("WebSocket connection requires an auth token.");
            return null;
        }

        if (onMessage) listeners.add(onMessage);
        if (onOpen) openCallbacks.add(onOpen);
        if (onClose) closeCallbacks.add(onClose);

        if (socketInstance && currentToken === token && (socketInstance.readyState === WebSocket.OPEN || socketInstance.readyState === WebSocket.CONNECTING)) {
            if (socketInstance.readyState === WebSocket.OPEN && onOpen) {
                try { onOpen(); } catch(e){}
            }
            return socketInstance;
        }

        if (socketInstance) {
            try { socketInstance.close(); } catch(e){}
        }

        currentToken = token;
        socketInstance = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`);

        socketInstance.onopen = (event) => {
            console.log("WebSocket connected.");
            openCallbacks.forEach(cb => { try { cb(event); } catch(e){} });
        };

        socketInstance.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                listeners.forEach(cb => { try { cb(data); } catch(e){} });
            } catch (err) {
                console.error("Failed to parse WebSocket message:", err);
            }
        };

        socketInstance.onclose = (event) => {
            console.log("WebSocket disconnected.");
            closeCallbacks.forEach(cb => { try { cb(event); } catch(e){} });
        };

        socketInstance.onerror = (error) => {
            console.error("WebSocket error:", error);
            if (onError) onError(error);
        };

        return socketInstance;
    },

    subscribe(onMessage) {
        if (onMessage) listeners.add(onMessage);
        return () => {
            listeners.delete(onMessage);
        };
    },

    send(data) {
        if (socketInstance && socketInstance.readyState === WebSocket.OPEN) {
            socketInstance.send(typeof data === "string" ? data : JSON.stringify(data));
            return true;
        }
        return false;
    },

    unsubscribe(onMessage) {
        if (onMessage) listeners.delete(onMessage);
    },

    closeAll() {
        if (socketInstance) {
            try { socketInstance.close(); } catch(e){}
            socketInstance = null;
            currentToken = null;
        }
        listeners.clear();
        openCallbacks.clear();
        closeCallbacks.clear();
    }
};
