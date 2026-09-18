import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

// All fire-and-forget: haptics must never block or fail an interaction,
// including on web or an older binary without the native module.
export function lightTap() {
  if (Platform.OS === "web") return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } catch {}
}

export function selectionTap() {
  if (Platform.OS === "web") return;
  try {
    Haptics.selectionAsync().catch(() => {});
  } catch {}
}

export function successTap() {
  if (Platform.OS === "web") return;
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
  } catch {}
}
