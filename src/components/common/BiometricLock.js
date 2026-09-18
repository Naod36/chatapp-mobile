import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LOCK_KEY = "@flowchat_biometric_lock";
// Re-lock only after the app has been backgrounded for at least this long.
const LOCK_AFTER_MS = 30_000;

export async function isBiometricLockEnabled() {
  try {
    return (await AsyncStorage.getItem(LOCK_KEY)) === "true";
  } catch {
    return false;
  }
}

export async function setBiometricLockEnabled(enabled) {
  if (enabled) await AsyncStorage.setItem(LOCK_KEY, "true");
  else await AsyncStorage.removeItem(LOCK_KEY);
}

export async function isBiometricAvailable() {
  if (Platform.OS === "web") return false;
  try {
    const [hasHardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && enrolled;
  } catch {
    return false;
  }
}

export function authenticate(promptMessage = "Unlock FlowChat") {
  return LocalAuthentication.authenticateAsync({ promptMessage });
}

/**
 * BiometricLockGate — full-screen overlay requiring biometric/passcode auth
 * on cold start and after the app has been backgrounded past the timeout.
 * Renders nothing when the setting is off or the platform is unsupported.
 */
export default function BiometricLockGate({ theme: t }) {
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const backgroundedAt = useRef(null);

  useEffect(() => {
    if (Platform.OS === "web") return undefined;
    isBiometricLockEnabled().then((enabled) => {
      if (enabled) setLocked(true);
    });
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state === "background") {
        backgroundedAt.current = Date.now();
      } else if (state === "active" && backgroundedAt.current) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (away >= LOCK_AFTER_MS && (await isBiometricLockEnabled())) {
          setLocked(true);
        }
      }
    });
    return () => subscription.remove();
  }, []);

  const unlock = useCallback(async () => {
    setChecking(true);
    try {
      const result = await authenticate();
      if (result?.success) setLocked(false);
    } catch {
      // Stay locked; the user can retry with the button.
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (locked) unlock();
  }, [locked, unlock]);

  if (!locked) return null;

  return (
    <View style={[styles.overlay, { backgroundColor: t?.bg || "#101923" }]}>
      <Text style={[styles.title, { color: t?.text || "#f0f3f8" }]}>
        FlowChat is locked
      </Text>
      <Text style={[styles.subtitle, { color: t?.textMuted || "#b6c1d2" }]}>
        Unlock with your fingerprint, face, or device passcode.
      </Text>
      {checking ? (
        <ActivityIndicator color={t?.accent || "#9bc4ff"} size="small" />
      ) : (
        <TouchableOpacity
          style={[styles.unlockBtn, { backgroundColor: t?.accent || "#305f9e" }]}
          onPress={unlock}
          accessibilityRole="button"
          accessibilityLabel="Unlock FlowChat"
        >
          <Text style={styles.unlockText}>Unlock</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
    zIndex: 1000,
    elevation: 1000,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 13.5,
    textAlign: "center",
    marginBottom: 12,
  },
  unlockBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  unlockText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
