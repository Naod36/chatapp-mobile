import { useEffect, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { websocketService } from "../services/websocket";

/**
 * useWebSocket — ensures the singleton WebSocket is connected for the current user.
 * This hook should be mounted once at the screen/navigator level.
 * Lower-level components subscribe via websocketService.subscribe() directly.
 */
export function useWebSocket() {
    const { user } = useApp();

    useEffect(() => {
        if (!user?.token) return;
        websocketService.connect(user.token);
    }, [user?.token]);

    const send = useCallback((payload) => {
        return websocketService.send(payload);
    }, []);

    return { send };
}
