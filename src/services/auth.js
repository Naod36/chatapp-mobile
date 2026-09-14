import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { API_BASE } from "./api";

async function handleResponse(response, defaultMsg) {
  let data;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text().catch(() => "");
  }

  if (!response.ok) {
    if (!data) {
      throw new Error(
        defaultMsg ||
          "Authentication server error. Please check your connection.",
      );
    }
    if (typeof data === "object") {
      const msg = data.message || data.error || defaultMsg;
      throw new Error(msg);
    }
    if (typeof data === "string" && data.trim()) {
      if (data.includes("<html") || data.includes("<!DOCTYPE")) {
        throw new Error(
          defaultMsg || "Authentication failed due to a server error.",
        );
      }
      throw new Error(data.trim());
    }
    throw new Error(defaultMsg);
  }

  return data;
}

export const authService = {
  async login(identifier, password) {
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await handleResponse(
        response,
        "Invalid credentials. Please try again.",
      );

      await AsyncStorage.setItem("chat_token", data.token);
      await AsyncStorage.setItem("chat_userId", data.user_id);
      await AsyncStorage.setItem("chat_username", data.username);

      return {
        ...data,
        userId: data.user_id,
      };
    } catch (err) {
      if (
        err.name === "TypeError" ||
        (err.message &&
          (err.message.includes("NetworkError") ||
            err.message.includes("Failed to fetch")))
      ) {
        throw new Error(
          `Unable to reach the backend server at ${API_BASE}. Please check your connection.`,
        );
      }
      throw err;
    }
  },

  async signup(username, email, password) {
    try {
      const response = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await handleResponse(
        response,
        "Could not create account. Please check your details.",
      );

      await AsyncStorage.setItem("chat_token", data.token);
      await AsyncStorage.setItem("chat_userId", data.user_id);
      await AsyncStorage.setItem("chat_username", data.username);

      return {
        ...data,
        userId: data.user_id,
      };
    } catch (err) {
      if (
        err.name === "TypeError" ||
        (err.message &&
          (err.message.includes("NetworkError") ||
            err.message.includes("Failed to fetch")))
      ) {
        throw new Error(
          `Unable to reach the backend server at ${API_BASE}. Please check your connection.`,
        );
      }
      throw err;
    }
  },

  async googleLogin(credential) {
    try {
      const response = await fetch(`${API_BASE}/auth/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ credential }),
      });

      const data = await handleResponse(
        response,
        "Google sign-in failed. Please try again.",
      );

      await AsyncStorage.setItem("chat_token", data.token);
      await AsyncStorage.setItem("chat_userId", data.user_id);
      await AsyncStorage.setItem("chat_username", data.username);

      return {
        ...data,
        userId: data.user_id,
      };
    } catch (err) {
      if (
        err.name === "TypeError" ||
        (err.message &&
          (err.message.includes("NetworkError") ||
            err.message.includes("Failed to fetch")))
      ) {
        throw new Error(
          `Unable to reach the backend server. Please check your connection.`,
        );
      }
      throw err;
    }
  },

  async logout() {
    await AsyncStorage.removeItem("chat_token");
    await AsyncStorage.removeItem("chat_userId");
    await AsyncStorage.removeItem("chat_username");
    if (Platform.OS !== "web") {
      try {
        // Clears the cached native Google session so the next sign-in shows the account picker
        // instead of silently reusing the same account.
        await GoogleSignin.signOut();
      } catch {
        // No cached Google session, or native module unavailable (e.g. Expo Go).
      }
    }
  },

  async isAuthenticated() {
    const token = await AsyncStorage.getItem("chat_token");
    return !!token;
  },

  async getCurrentUser() {
    const id = await AsyncStorage.getItem("chat_userId");
    const username = await AsyncStorage.getItem("chat_username");
    const token = await AsyncStorage.getItem("chat_token");
    if (!token || !id) return null;
    return {
      userId: id,
      user_id: id,
      username: username,
      token: token,
    };
  },
};
