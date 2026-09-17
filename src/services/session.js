import AsyncStorage from "@react-native-async-storage/async-storage";

export const SESSION_EXPIRED_MESSAGE =
  "Your session has expired. Please log in again.";

const listeners = new Set();

export function onSessionExpired(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Called when a request comes back 401. Clears the stored session only if it
// still matches the token that failed (avoids clobbering a newer login that
// may have happened in the meantime) and notifies subscribers exactly once.
export async function expireSession(token) {
  if (!token) return false;
  const current = await AsyncStorage.getItem("chat_token");
  if (current !== token) return false;
  await AsyncStorage.multiRemove([
    "chat_token",
    "chat_userId",
    "chat_username",
  ]);
  listeners.forEach((listener) => listener());
  return true;
}
