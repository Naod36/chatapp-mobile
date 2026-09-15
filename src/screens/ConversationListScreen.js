import React, { useState, useCallback, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  TextInput,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Platform,
  Modal,
  PanResponder,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Switch,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import Svg, { Path, Circle } from "react-native-svg";
import Constants from "expo-constants";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import * as ImagePicker from "expo-image-picker";
import { useApp } from "../context/AppContext";
import { useConversations } from "../hooks/useConversations";
import ConversationHeader from "../components/conversations/ConversationHeader";
import ConversationItem from "../components/conversations/ConversationItem";
import EmptyState from "../components/conversations/EmptyState";
import Avatar from "../components/common/Avatar";
import ConfirmDialog from "../components/common/ConfirmDialog";
import otaConfig from "../config/otaVersion.json";
import { conversationService } from "../services/conversations";
import { userService } from "../services/user";
import { API_BASE } from "../services/api";

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function PencilIcon({ color, size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function GroupIcon({ color, size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx="9"
        cy="7"
        r="4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function SunIcon({ color, size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="5" stroke={color} strokeWidth="2" />
      <Path
        d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}
function MoonIcon({ color, size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function UserIcon({ color, size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12"
        cy="8"
        r="4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4 20c0-4 3.582-7 8-7s8 3 8 7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function LogoutIcon({ color, size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 17l5-5-5-5M21 12H9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChevronRightIcon({ color, size = 16 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 6l6 6-6 6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function CameraIcon({ color, size = 16 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="13" r="4" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

// ─── Theme Quick Picker ────────────────────────────────────────────────────────

// ─── Account Panel ────────────────────────────────────────────────────────────

function AccountPanel({
  visible,
  onClose,
  theme: t,
  onLogout,
  onProfileUpdated,
}) {
  const { unblockUser, isBlockedBy, blockedUserIds, blockStateVersion, blockStateReady, changeTheme } = useApp();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const slideAnim = useRef(new Animated.Value(600)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 4,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) slideAnim.setValue(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 100 || gesture.vy > 0.8) {
          Animated.timing(slideAnim, {
            toValue: 600,
            duration: 200,
            useNativeDriver: true,
          }).start(() => onClose());
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
          }).start();
        }
      },
    }),
  ).current;

  const [profile, setProfile] = useState({
    display_name: "",
    bio: "",
    avatar_url: "",
  });
  const [originalProfile, setOriginalProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMessage, setEmailMessage] = useState(null);

  const [showBlockedList, setShowBlockedList] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [unblockingUserId, setUnblockingUserId] = useState(null);

  useEffect(() => {
    if (!visible || !showBlockedList) return;
    let cancelled = false;
    userService.getBlockedUsers().then((list) => {
      if (!cancelled) setBlockedUsers(list || []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [visible, showBlockedList, blockStateVersion]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const hasChanges =
    originalProfile &&
    (profile.display_name !== originalProfile.display_name ||
      profile.bio !== originalProfile.bio);

  useEffect(() => {
    if (visible) {
      // Slide up
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
      // Fetch profile
      setLoading(true);
      setError(null);
      setSaved(false);
      userService
        .getProfile()
        .then((p) => {
          if (p) {
            const next = {
              display_name: p.display_name || p.username || "",
              bio: p.bio || "",
              avatar_url: p.avatar_url || "",
            };
            setProfile(next);
            setOriginalProfile(next);
            setNotificationsEnabled(p.notifications_enabled !== false);
            onProfileUpdated?.(p);
          }
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      // Slide down
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handlePickAvatar = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Needed",
          "FlowChat needs access to your photo library to change your profile picture.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setUploadingAvatar(true);
      setError(null);

      const formData = new FormData();
      if (
        Platform.OS === "web" ||
        asset.uri.startsWith("blob:") ||
        asset.uri.startsWith("data:")
      ) {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const fileObj = new File(
          [blob],
          asset.fileName || `avatar_${Date.now()}.jpg`,
          {
            type: asset.mimeType || blob.type || "image/jpeg",
          },
        );
        formData.append("file", fileObj);
      } else {
        formData.append("file", {
          uri: asset.uri,
          name: asset.fileName || `avatar_${Date.now()}.jpg`,
          type: asset.mimeType || "image/jpeg",
        });
      }

      const uploadRes = await conversationService.uploadFile(formData);
      const avatarUrl = uploadRes?.url;
      if (!avatarUrl) throw new Error("Upload did not return a file URL");

      const updated = { ...profile, avatar_url: avatarUrl };
      await userService.updateProfile({ ...updated, status: "online" });
      setProfile(updated);
      setOriginalProfile(updated);
      onProfileUpdated?.(updated);
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to update profile picture");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await userService.updateProfile({
        display_name: profile.display_name,
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        status: "online",
      });
      setOriginalProfile(profile);
      setSaved(true);
      onProfileUpdated?.(profile);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoutPress = () => {
    setShowSignOutConfirm(true);
  };

  const handleConfirmLogout = () => {
    setShowSignOutConfirm(false);
    onClose();
    onLogout();
  };

  const handleToggleNotifications = async (value) => {
    setNotificationsEnabled(value);
    setNotifSaving(true);
    try {
      await userService.updateNotificationPreference(value);
    } catch (e) {
      setNotificationsEnabled(!value);
      Alert.alert(
        "Error",
        e.message || "Failed to update notification preference",
      );
    } finally {
      setNotifSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordMessage(null);
    if (newPassword.length < 8) {
      setPasswordMessage({
        type: "error",
        text: "Password must be at least 8 characters",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Passwords do not match" });
      return;
    }
    setPasswordSaving(true);
    try {
      await userService.changePassword(newPassword);
      setPasswordMessage({ type: "success", text: "Password updated" });
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordMessage(null);
      }, 1500);
    } catch (e) {
      setPasswordMessage({
        type: "error",
        text: e.message || "Failed to update password",
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleRequestEmailChange = async () => {
    setEmailMessage(null);
    const trimmed = newEmail.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setEmailMessage({ type: "error", text: "Enter a valid email address" });
      return;
    }
    setEmailSaving(true);
    try {
      await userService.requestEmailChange(trimmed);
      setEmailMessage({
        type: "success",
        text: "Check your new inbox for a confirmation link",
      });
      setNewEmail("");
    } catch (e) {
      setEmailMessage({
        type: "error",
        text: e.message || "Failed to request email change",
      });
    } finally {
      setEmailSaving(false);
    }
  };

  const handleToggleBlockedList = async () => {
    const opening = !showBlockedList;
    setShowBlockedList(opening);
    if (opening) {
      setBlockedLoading(true);
      try {
        const list = await userService.getBlockedUsers();
        setBlockedUsers(list || []);
      } catch (e) {
        Alert.alert("Error", e.message || "Failed to load blocked users");
      } finally {
        setBlockedLoading(false);
      }
    }
  };

  const handleUnblockUser = async (userId) => {
    if (unblockingUserId) return;
    setUnblockingUserId(String(userId));
    try {
      await unblockUser(userId);
      setBlockedUsers((prev) => prev.filter((u) => String(u.user_id) !== String(userId)));
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to unblock user");
    } finally {
      setUnblockingUserId(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (deletingAccount) return;
    setDeletingAccount(true);
    try {
      await userService.deleteAccount();
      setShowDeleteConfirm(false);
      onClose();
      onLogout();
    } catch (e) {
      setDeletingAccount(false);
      Alert.alert("Error", e.message || "Failed to delete account");
    }
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Slide-up sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: t.bg,
            borderColor: t.borderColor,
            paddingBottom: insets.bottom + 16,
            height: windowHeight * 0.88,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Handle bar (drag down to dismiss) */}
        <View {...panResponder.panHandlers}>
          <View style={[styles.handle, { backgroundColor: t.borderColor }]} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: t.text }]}>Account</Text>
            {!loading && (
              <TouchableOpacity
                onPress={handleSave}
                disabled={!hasChanges || saving}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {saving ? (
                  <ActivityIndicator color={t.accent} size="small" />
                ) : (
                  <Text
                    style={[
                      styles.headerSaveText,
                      {
                        color: saved
                          ? t.success
                          : hasChanges
                            ? t.accent
                            : t.textMuted,
                        opacity: hasChanges || saved ? 1 : 0.45,
                      },
                    ]}
                  >
                    {saved ? "Saved" : "Save"}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, minHeight: 0 }}
        >
          <ScrollView
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={styles.sheetBody}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {/* Avatar */}
            <View style={styles.avatarRow}>
              <View style={{ width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ width: 44 }} />
              <TouchableOpacity
                onPress={handlePickAvatar}
                disabled={uploadingAvatar}
                activeOpacity={0.75}
                style={styles.avatarTouchable}
              >
                <Avatar
                  uri={
                    profile.avatar_url
                      ? profile.avatar_url.startsWith("http")
                        ? profile.avatar_url
                        : `${API_BASE}${profile.avatar_url}`
                      : null
                  }
                  name={profile.display_name || "?"}
                  size={64}
                />
                {uploadingAvatar ? (
                  <View
                    style={[
                      styles.avatarOverlay,
                      { backgroundColor: "rgba(0,0,0,0.45)" },
                    ]}
                  >
                    <ActivityIndicator color="#fff" size="small" />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.avatarBadge,
                      { backgroundColor: t.buttonBg, borderColor: t.bg },
                    ]}
                  >
                    <CameraIcon color="#fff" size={13} />
                  </View>
                )}
              </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => changeTheme(t.isDark ? "light" : "dark")}
                  accessibilityRole="button"
                  accessibilityLabel={t.isDark ? "Switch to light theme" : "Switch to dark theme"}
                  {...(Platform.OS === "web" ? { title: t.isDark ? "Switch to light theme" : "Switch to dark theme" } : {})}
                  style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: t.accent + "18" }}
                >
                  {t.isDark ? <SunIcon color={t.accent} /> : <MoonIcon color={t.accent} />}
                </TouchableOpacity>
              </View>
              <Text style={[styles.avatarHint, { color: t.textMuted }]}>
                Tap to change photo
              </Text>
            </View>

            {loading ? (
              <ActivityIndicator color={t.accent} style={{ marginTop: 24 }} />
            ) : (
              <>
                {/* Error */}
                {error && <Text style={[styles.errorText, { color: t.danger }]}>{error}</Text>}

                {/* Profile group */}
                <Text style={[styles.groupLabel, { color: t.textMuted }]}>
                  Profile
                </Text>
                <View
                  style={[
                    styles.groupCard,
                    { backgroundColor: t.cardBg, borderColor: t.borderColor },
                  ]}
                >
                  <View style={styles.groupRow}>
                    <Text
                      style={[styles.groupRowLabel, { color: t.textMuted }]}
                    >
                      Name
                    </Text>
                    <TextInput
                      value={profile.display_name}
                      onChangeText={(v) =>
                        setProfile((p) => ({ ...p, display_name: v }))
                      }
                      placeholder="Your display name"
                      placeholderTextColor={t.textMuted}
                      style={[styles.groupInput, { color: t.text }]}
                      autoCorrect={false}
                    />
                  </View>
                  <View
                    style={[
                      styles.groupDivider,
                      { backgroundColor: t.borderColor },
                    ]}
                  />
                  <View style={[styles.groupRow, styles.groupRowBio]}>
                    <Text
                      style={[styles.groupRowLabel, { color: t.textMuted }]}
                    >
                      Bio
                    </Text>
                    <TextInput
                      value={profile.bio}
                      onChangeText={(v) =>
                        setProfile((p) => ({ ...p, bio: v }))
                      }
                      placeholder="Tell people about yourself..."
                      placeholderTextColor={t.textMuted}
                      style={[
                        styles.groupInput,
                        styles.groupBioInput,
                        { color: t.text },
                      ]}
                      multiline
                      numberOfLines={2}
                      autoCorrect={false}
                    />
                  </View>
                </View>

                {/* Preferences group */}
                <Text
                  style={[
                    styles.groupLabel,
                    { color: t.textMuted, marginTop: 20 },
                  ]}
                >
                  Preferences
                </Text>
                <View
                  style={[
                    styles.groupCard,
                    { backgroundColor: t.cardBg, borderColor: t.borderColor },
                  ]}
                >
                  <View style={styles.settingsRow}>
                    <View style={styles.settingsRowLeft}>
                      <Text style={[styles.settingsRowText, { color: t.text }]}>
                        Push Notifications
                      </Text>
                    </View>
                    <Switch
                      value={notificationsEnabled}
                      onValueChange={handleToggleNotifications}
                      disabled={notifSaving}
                      trackColor={{ false: t.borderColor, true: t.accent }}
                      thumbColor="#fff"
                    />
                  </View>
                </View>

                {/* Privacy & Security group */}
                <Text
                  style={[
                    styles.groupLabel,
                    { color: t.textMuted, marginTop: 20 },
                  ]}
                >
                  Privacy &amp; Security
                </Text>
                <View
                  style={[
                    styles.groupCard,
                    { backgroundColor: t.cardBg, borderColor: t.borderColor },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => setShowPasswordForm((v) => !v)}
                    style={styles.settingsRow}
                    activeOpacity={0.6}
                  >
                    <View style={styles.settingsRowLeft}>
                      <Text style={[styles.settingsRowText, { color: t.text }]}>
                        Change Password
                      </Text>
                    </View>
                    <ChevronRightIcon color={t.textMuted} size={15} />
                  </TouchableOpacity>

                  {showPasswordForm && (
                    <View style={styles.inlineFormWrap}>
                      <TextInput
                        value={newPassword}
                        onChangeText={setNewPassword}
                        placeholder="New password"
                        placeholderTextColor={t.textMuted}
                        secureTextEntry
                        style={[styles.groupInput, { color: t.text }]}
                      />
                      <View
                        style={[
                          styles.groupDivider,
                          { backgroundColor: t.borderColor, marginVertical: 8 },
                        ]}
                      />
                      <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Confirm new password"
                        placeholderTextColor={t.textMuted}
                        secureTextEntry
                        style={[styles.groupInput, { color: t.text }]}
                      />
                      {passwordMessage && (
                        <Text
                          style={[
                            styles.inlineFormMessage,
                            {
                              color:
                                passwordMessage.type === "error"
                                  ? t.danger
                                  : t.success,
                            },
                          ]}
                        >
                          {passwordMessage.text}
                        </Text>
                      )}
                      <TouchableOpacity
                        onPress={handleChangePassword}
                        disabled={passwordSaving}
                        style={[
                          styles.inlineFormBtn,
                          {
                            backgroundColor: t.buttonBg,
                            opacity: passwordSaving ? 0.6 : 1,
                          },
                        ]}
                      >
                        {passwordSaving ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.inlineFormBtnText}>
                            Update Password
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  <View
                    style={[
                      styles.groupDivider,
                      { backgroundColor: t.borderColor },
                    ]}
                  />

                  <TouchableOpacity
                    onPress={() => setShowEmailForm((v) => !v)}
                    style={styles.settingsRow}
                    activeOpacity={0.6}
                  >
                    <View style={styles.settingsRowLeft}>
                      <Text style={[styles.settingsRowText, { color: t.text }]}>
                        Change Email
                      </Text>
                    </View>
                    <ChevronRightIcon color={t.textMuted} size={15} />
                  </TouchableOpacity>

                  {showEmailForm && (
                    <View style={styles.inlineFormWrap}>
                      <TextInput
                        value={newEmail}
                        onChangeText={setNewEmail}
                        placeholder="New email address"
                        placeholderTextColor={t.textMuted}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={[styles.groupInput, { color: t.text }]}
                      />
                      {emailMessage && (
                        <Text
                          style={[
                            styles.inlineFormMessage,
                            {
                              color:
                                emailMessage.type === "error"
                                  ? t.danger
                                  : t.success,
                            },
                          ]}
                        >
                          {emailMessage.text}
                        </Text>
                      )}
                      <TouchableOpacity
                        onPress={handleRequestEmailChange}
                        disabled={emailSaving}
                        style={[
                          styles.inlineFormBtn,
                          {
                            backgroundColor: t.buttonBg,
                            opacity: emailSaving ? 0.6 : 1,
                          },
                        ]}
                      >
                        {emailSaving ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.inlineFormBtnText}>
                            Send Confirmation
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  <View
                    style={[
                      styles.groupDivider,
                      { backgroundColor: t.borderColor },
                    ]}
                  />

                  <TouchableOpacity
                    onPress={handleToggleBlockedList}
                    style={styles.settingsRow}
                    activeOpacity={0.6}
                  >
                    <View style={styles.settingsRowLeft}>
                      <Text style={[styles.settingsRowText, { color: t.text }]}>
                        Blocked Users
                      </Text>
                    </View>
                    <ChevronRightIcon color={t.textMuted} size={15} />
                  </TouchableOpacity>

                  {showBlockedList && (
                    <View style={styles.inlineFormWrap}>
                      {blockedLoading ? (
                        <ActivityIndicator color={t.accent} />
                      ) : blockedUsers.length === 0 ? (
                        <Text style={{ color: t.textMuted, fontSize: 13 }}>
                          You haven't blocked anyone.
                        </Text>
                      ) : (
                        blockedUsers.filter((person) => blockedUserIds.includes(String(person.user_id))).map((u) => (
                          <View key={u.user_id} style={styles.blockedRow}>
                            <Text
                              style={{ color: t.text, fontSize: 14, flex: 1 }}
                              numberOfLines={1}
                            >
                              {!blockStateReady || isBlockedBy(u.user_id) ? "Person Not Available" : u.display_name || u.username}
                            </Text>
                            <TouchableOpacity
                              onPress={() => handleUnblockUser(u.user_id)}
                              disabled={!!unblockingUserId}
                            >
                              <Text
                                style={{
                                  color: t.accent,
                                  fontSize: 13,
                                  fontWeight: "700",
                                }}
                              >
                                Unblock
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </View>

                {/* Session group — more account settings can be added here */}
                <Text
                  style={[
                    styles.groupLabel,
                    { color: t.textMuted, marginTop: 20 },
                  ]}
                >
                  Session
                </Text>
                <View
                  style={[
                    styles.groupCard,
                    { backgroundColor: t.cardBg, borderColor: t.borderColor },
                  ]}
                >
                  <TouchableOpacity
                    onPress={handleLogoutPress}
                    style={styles.settingsRow}
                    activeOpacity={0.6}
                  >
                    <View style={styles.settingsRowLeft}>
                      <LogoutIcon color={t.danger} size={17} />
                      <Text
                        style={[styles.settingsRowText, { color: t.danger }]}
                      >
                        Sign Out
                      </Text>
                    </View>
                    <ChevronRightIcon color={t.textMuted} size={15} />
                  </TouchableOpacity>
                </View>

                {/* Danger zone */}
                <Text
                  style={[
                    styles.groupLabel,
                    { color: t.textMuted, marginTop: 20 },
                  ]}
                >
                  Danger Zone
                </Text>
                <View
                  style={[
                    styles.groupCard,
                    { backgroundColor: t.cardBg, borderColor: t.borderColor },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => setShowDeleteConfirm(true)}
                    style={styles.settingsRow}
                    activeOpacity={0.6}
                  >
                    <View style={styles.settingsRowLeft}>
                      <Text
                        style={[styles.settingsRowText, { color: t.danger }]}
                      >
                        Delete Account
                      </Text>
                    </View>
                    <ChevronRightIcon color={t.textMuted} size={15} />
                  </TouchableOpacity>
                </View>

                {/* App Version & OTA Info */}
                <OtaInfoPanel theme={t} />
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>

      <ConfirmDialog
        visible={showSignOutConfirm}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign Out"
        destructive
        onConfirm={handleConfirmLogout}
        onCancel={() => setShowSignOutConfirm(false)}
        theme={t}
      />

      <ConfirmDialog
        visible={showDeleteConfirm}
        title="Delete Account"
        message="This will deactivate your account and log you out. Are you sure?"
        confirmLabel={deletingAccount ? "Deleting..." : "Delete Account"}
        destructive
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
        theme={t}
      />
    </Modal>
  );
}

// ─── OTA Info Panel ───────────────────────────────────────────────────────────

function OtaInfoPanel({ theme: t }) {
  // "idle" | "checking" | "applying" | "none" | "error"
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (state !== "none" && state !== "error") return;
    const timer = setTimeout(() => {
      setState("idle");
      setMessage(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [state]);

  const otaCreatedAt = Updates.createdAt ? new Date(Updates.createdAt) : null;
  const otaDateLabel = otaCreatedAt
    ? otaCreatedAt.toLocaleDateString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : __DEV__
      ? "dev"
      : "embedded";
  const otaTimeLabel = otaCreatedAt
    ? otaCreatedAt.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const otaHash = Updates.updateId
    ? Updates.updateId.substring(0, 8)
    : __DEV__
      ? "dev-live"
      : "embedded";

  const handleCheckForUpdate = async () => {
    if (__DEV__ || !Updates.isEnabled) {
      setState("error");
      setMessage("OTA updates are unavailable in this build.");
      return;
    }
    setState("checking");
    setMessage(null);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setState("none");
        setMessage("You're already on the latest update.");
        return;
      }
      setState("applying");
      setMessage("Update found — downloading...");
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (err) {
      setState("error");
      setMessage(err.message || "Failed to check for updates.");
    }
  };

  const isBusy = state === "checking" || state === "applying";

  return (
    <View
      style={{
        alignItems: "center",
        marginTop: 20,
        marginBottom: 4,
        width: "100%",
      }}
    >
      <Text style={{ fontSize: 11.5, fontWeight: "600", color: t.textMuted }}>
        FlowChat v{Constants.expoConfig?.version || "1.0.3"} (Build{" "}
        {Application.nativeBuildVersion ||
          Constants.expoConfig?.android?.versionCode ||
          "3"}
        )
      </Text>
      <Text
        style={{
          fontSize: 10.5,
          marginTop: 3,
          color: t.textMuted,
          opacity: 0.75,
          fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
        }}
      >
        OTA #{otaConfig.otaNumber} · {otaDateLabel}
        {otaTimeLabel ? ` · ${otaTimeLabel}` : ""} · {otaHash}
      </Text>

      <TouchableOpacity
        onPress={handleCheckForUpdate}
        disabled={isBusy}
        activeOpacity={0.8}
        style={{
          marginTop: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 8,
          backgroundColor: t.isDark
            ? "rgba(255,255,255,0.08)"
            : "rgba(0,0,0,0.05)",
          opacity: isBusy ? 0.7 : 1,
        }}
      >
        {isBusy && <ActivityIndicator size="small" color={t.accent} />}
        <Text style={{ fontSize: 11, fontWeight: "700", color: t.accent }}>
          {state === "checking"
            ? "Checking for updates..."
            : state === "applying"
              ? "Applying update..."
              : "Check for Updates"}
        </Text>
      </TouchableOpacity>

      {message && (state === "none" || state === "error") && (
        <Text
          style={{
            fontSize: 10.5,
            marginTop: 6,
            color: state === "error" ? t.danger : t.textMuted,
          }}
        >
          {message}
        </Text>
      )}
    </View>
  );
}

// ─── Bottom Dock ──────────────────────────────────────────────────────────────

function BottomDock({ theme: t, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.dockWrapper} pointerEvents="box-none">
      {/* Floating dock pill */}
      <View
        style={[
          styles.dock,
          {
            backgroundColor: t.cardBg,
            borderColor: t.borderColor,
            shadowColor: t.isDark ? "#000" : "#aaa",
            marginBottom: insets.bottom + 70,
          },
        ]}
      >
        <BlurView
          intensity={t.isDark ? 45 : 65}
          tint={t.isDark ? "dark" : "light"}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { zIndex: -1 }]}
        />
        {/* New DM */}
        <TouchableOpacity
          style={styles.dockIconBtn}
          onPress={() => navigation.navigate("NewMessage")}
          activeOpacity={0.7}
        >
          <View
            style={[styles.iconCircle, { backgroundColor: t.accent + "18" }]}
          >
            <PencilIcon color={t.accent} size={22} />
          </View>
        </TouchableOpacity>

        {/* New Group */}
        <TouchableOpacity
          style={styles.dockIconBtn}
          onPress={() => navigation.navigate("NewGroup")}
          activeOpacity={0.7}
        >
          <View
            style={[styles.iconCircle, { backgroundColor: t.accent + "18" }]}
          >
            <GroupIcon color={t.accent} size={22} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ConversationListScreen({ navigation }) {
  const { theme: t, logout } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const {
    conversations,
    syncState,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    startConversation,
    typingMap,
    presenceMap,
    loadConversations,
  } = useConversations();

  const [accountOpen, setAccountOpen] = useState(false);
  const [myProfile, setMyProfile] = useState(null);
  const [pinnedConversationIds, setPinnedConversationIds] = useState([]);

  useEffect(() => {
    userService
      .getProfile()
      .then((p) => p && setMyProfile(p))
      .catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    AsyncStorage.getItem("@flowchat_pinned_conversations")
      .then((raw) => {
        const ids = raw ? JSON.parse(raw) : [];
        if (active) setPinnedConversationIds(Array.isArray(ids) ? ids.map(String) : []);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []));

  const handleSelectConversation = useCallback(
    (conv) => {
      navigation.navigate("Chat", { conversation: conv });
    },
    [navigation],
  );

  const handleStartConversation = useCallback(
    async (userItem) => {
      try {
        const conv = await startConversation(userItem);
        setSearchQuery("");
        navigation.navigate("Chat", { conversation: conv });
      } catch (err) {
        Alert.alert("Error", err.message || "Failed to start conversation");
      }
    },
    [startConversation, navigation, setSearchQuery],
  );

  const handleLogout = useCallback(() => {
    logout().catch((err) => console.warn("Logout error:", err));
  }, [logout]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadConversations(false);
    } finally {
      setRefreshing(false);
    }
  }, [loadConversations]);

  const showSearch = searchQuery.trim().length > 0;

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <ConversationHeader
        syncState={refreshing ? "refreshing" : syncState}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        theme={t}
        avatarUri={myProfile?.avatar_url}
        displayName={myProfile?.display_name}
        onAccountPress={() => setAccountOpen(true)}
      />

      {showSearch ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => String(item.user_id || item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.searchRow, { borderBottomColor: t.borderColor }]}
              onPress={() => handleStartConversation(item)}
              activeOpacity={0.75}
            >
              <Avatar
                uri={item.avatar_url}
                name={item.display_name || item.username}
                size={44}
              />
              <View style={styles.searchInfo}>
                <Text style={[styles.searchName, { color: t.text }]}>
                  {item.display_name || item.username}
                </Text>
                <Text style={[styles.searchHandle, { color: t.textMuted }]}>
                  @{item.username}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            isSearching ? (
              <Text style={[styles.searchingText, { color: t.textMuted }]}>
                Searching...
              </Text>
            ) : (
              <EmptyState theme={t} isSearchEmpty />
            )
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        />
      ) : (
        <FlatList
          data={[...conversations].sort((a, b) => {
            const aPinned = pinnedConversationIds.includes(
              String(a.id || a.conversation_id),
            );
            const bPinned = pinnedConversationIds.includes(
              String(b.id || b.conversation_id),
            );
            return Number(bPinned) - Number(aPinned);
          })}
          extraData={typingMap}
          keyExtractor={(item) => String(item.id || item.conversation_id)}
          renderItem={({ item }) => {
            const cid = String(item.id || item.conversation_id || "");
            return (
              <ConversationItem
                conversation={item}
                isPinned={pinnedConversationIds.includes(cid)}
                onPress={() => handleSelectConversation(item)}
                isTyping={Boolean(typingMap[cid])}
              />
            );
          }}
          ListEmptyComponent={
            syncState === "connecting" ? null : <EmptyState theme={t} />
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={t.accent}
              colors={[t.accent]}
              progressBackgroundColor={t.bg}
            />
          }
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        />
      )}

      <BottomDock theme={t} navigation={navigation} />

      <AccountPanel
        visible={accountOpen}
        onClose={() => setAccountOpen(false)}
        theme={t}
        onLogout={handleLogout}
        onProfileUpdated={setMyProfile}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInfo: { flex: 1 },
  searchName: { fontSize: 15, fontWeight: "700" },
  searchHandle: { fontSize: 12.5, marginTop: 2 },
  searchingText: { textAlign: "center", padding: 20, fontSize: 14 },

  // Dock
  dockWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "flex-end",
    paddingRight: 16,
    pointerEvents: "box-none",
  },
  dock: {
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 32,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  dockIconBtn: {
    paddingVertical: 6,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },

  // Theme tray
  themeTrayTop: {
    position: "absolute",
    right: 14,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 10,
    zIndex: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  themeTray: {
    alignSelf: "center",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 8,
    gap: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  trayLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textAlign: "center",
    marginBottom: 4,
  },
  swatchRow: {
    flexDirection: "row",
    gap: 10,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchActive: {
    borderColor: "#6366f1",
    transform: [{ scale: 1.15 }],
  },

  // Account Panel / Modal
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  closeBtn: {
    fontSize: 18,
    fontWeight: "700",
    padding: 4,
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  avatarRow: {
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  avatarTouchable: {
    width: 72,
    height: 72,
  },
  avatarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHint: {
    fontSize: 12,
    textAlign: "center",
    opacity: 0.7,
  },
  headerSaveText: {
    fontSize: 15,
    fontWeight: "700",
  },
  groupLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.7,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  groupCard: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  groupRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  groupRowBio: {
    paddingBottom: 12,
  },
  groupRowLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    marginBottom: 3,
  },
  groupInput: {
    fontSize: 15,
    padding: 0,
    margin: 0,
  },
  groupBioInput: {
    height: 44,
    textAlignVertical: "top",
  },
  groupDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
    marginBottom: 12,
    textAlign: "center",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  settingsRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  settingsRowText: {
    fontSize: 15,
    fontWeight: "600",
  },
  inlineFormWrap: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  inlineFormMessage: {
    fontSize: 12.5,
    marginTop: 8,
  },
  inlineFormBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  inlineFormBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  blockedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
});
