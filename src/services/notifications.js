import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { apiFetch } from "./api";

// Controls how notifications are presented while the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const MESSAGE_CATEGORY_ID = "message";
export const REPLY_ACTION_ID = "REPLY";

// Registers a "message" notification category with an inline text-reply action,
// so users can reply directly from the notification (Android RemoteInput / iOS
// UNTextInputNotificationAction) without opening the app.
export async function registerNotificationCategoriesAsync() {
  if (Platform.OS === "web") return;
  try {
    await Notifications.setNotificationCategoryAsync(MESSAGE_CATEGORY_ID, [
      {
        identifier: REPLY_ACTION_ID,
        buttonTitle: "Reply",
        textInput: {
          submitButtonTitle: "Send",
          placeholder: "Type a message...",
        },
      },
    ]);
  } catch (err) {
    console.warn("Failed to register notification categories:", err.message);
  }
}

// Requests permission and returns an Expo push token for this device, or null
// if permission was denied / running in an environment that doesn't support push
// (web, simulators).
export async function registerForPushNotificationsAsync() {
  if (Platform.OS === "web") return null;
  if (!Device.isDevice) return null;

  await registerNotificationCategoriesAsync();

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#22c55e",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  try {
    const projectId =
      Constants?.easConfig?.projectId ??
      Constants?.expoConfig?.extra?.eas?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    return tokenResponse.data;
  } catch (err) {
    console.warn("Failed to get Expo push token:", err.message);
    return null;
  }
}

// Sends this device's push token to the backend so it can be used to deliver
// notifications to this user while they're offline.
export async function registerPushToken(token) {
  if (!token) return;
  try {
    await apiFetch("/push-tokens", {
      method: "POST",
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
  } catch (err) {
    console.warn("Failed to register push token with backend:", err.message);
  }
}
