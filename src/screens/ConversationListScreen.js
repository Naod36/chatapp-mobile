import React, { useState, useCallback, useEffect, useRef } from "react";
import {
    View, Text, TextInput, FlatList, TouchableOpacity,
    StyleSheet, Alert, Animated, Platform, Modal, ScrollView,
    ActivityIndicator, KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle } from "react-native-svg";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useApp } from "../context/AppContext";
import { useConversations } from "../hooks/useConversations";
import ConversationHeader from "../components/conversations/ConversationHeader";
import ConversationItem from "../components/conversations/ConversationItem";
import EmptyState from "../components/conversations/EmptyState";
import Avatar from "../components/common/Avatar";
import otaConfig from "../config/otaVersion.json";
import { conversationService } from "../services/conversations";
import { userService } from "../services/user";
import { API_BASE } from "../services/api";

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function PencilIcon({ color, size = 22 }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
}
function GroupIcon({ color, size = 22 }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx="9" cy="7" r="4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
}
function SunIcon({ color, size = 20 }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="5" stroke={color} strokeWidth="2" />
            <Path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </Svg>
    );
}
function MoonIcon({ color, size = 20 }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
}
function UserIcon({ color, size = 22 }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
}
function LogoutIcon({ color, size = 20 }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M16 17l5-5-5-5M21 12H9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
}

// ─── Theme Quick Picker ────────────────────────────────────────────────────────

const THEME_KEYS = ["light", "dark", "emeraldDark", "amethystDark", "sunsetOLED"];
const THEME_COLORS = {
    light: "#f8fafc",
    dark: "#0f172a",
    emeraldDark: "#047857",
    amethystDark: "#7E22CE",
    sunsetOLED: "#E11D48",
};

// ─── Account Panel ────────────────────────────────────────────────────────────

function AccountPanel({ visible, onClose, theme: t, onLogout }) {
    const insets = useSafeAreaInsets();
    const slideAnim = useRef(new Animated.Value(600)).current;

    const [profile, setProfile] = useState({ display_name: "", bio: "", avatar_url: "" });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState(null);

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
            userService.getProfile()
                .then(p => {
                    if (p) setProfile({
                        display_name: p.display_name || p.username || "",
                        bio: p.bio || "",
                        avatar_url: p.avatar_url || "",
                    });
                })
                .catch(e => setError(e.message))
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
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            setError(e.message || "Failed to save profile");
        } finally {
            setSaving(false);
        }
    };

    const handleLogoutPress = () => {
        if (Platform.OS === "web") {
            // Skip confirm on web — window.confirm can be unreliable.
            // The panel's close button gives the user an easy cancel path.
            onClose();
            onLogout();
        } else {
            Alert.alert("Sign Out", "Are you sure you want to sign out?", [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Sign Out", style: "destructive", onPress: () => {
                        onClose();
                        onLogout();
                    }
                },
            ]);
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
                        backgroundColor: t.cardBg,
                        borderColor: t.borderColor,
                        paddingBottom: insets.bottom + 16,
                        transform: [{ translateY: slideAnim }],
                    },
                ]}
            >
                {/* Handle bar */}
                <View style={[styles.handle, { backgroundColor: t.borderColor }]} />

                {/* Header */}
                <View style={styles.sheetHeader}>
                    <Text style={[styles.sheetTitle, { color: t.text }]}>Account</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text style={[styles.closeBtn, { color: t.textMuted }]}>✕</Text>
                    </TouchableOpacity>
                </View>

                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>

                        {/* Avatar */}
                        <View style={styles.avatarRow}>
                            <Avatar
                                uri={profile.avatar_url ? (profile.avatar_url.startsWith("http") ? profile.avatar_url : `${API_BASE}${profile.avatar_url}`) : null}
                                name={profile.display_name || "?"}
                                size={72}
                            />
                            <Text style={[styles.avatarHint, { color: t.textMuted }]}>
                                Update avatar via your web profile
                            </Text>
                        </View>

                        {loading ? (
                            <ActivityIndicator color={t.accent} style={{ marginTop: 24 }} />
                        ) : (
                            <>
                                {/* Display Name */}
                                <Text style={[styles.fieldLabel, { color: t.textMuted }]}>Display Name</Text>
                                <TextInput
                                    value={profile.display_name}
                                    onChangeText={v => setProfile(p => ({ ...p, display_name: v }))}
                                    placeholder="Your display name"
                                    placeholderTextColor={t.textMuted}
                                    style={[styles.input, { color: t.text, backgroundColor: t.inputBg, borderColor: t.borderColor }]}
                                    autoCorrect={false}
                                />

                                {/* Bio */}
                                <Text style={[styles.fieldLabel, { color: t.textMuted }]}>Bio</Text>
                                <TextInput
                                    value={profile.bio}
                                    onChangeText={v => setProfile(p => ({ ...p, bio: v }))}
                                    placeholder="Tell people about yourself..."
                                    placeholderTextColor={t.textMuted}
                                    style={[styles.input, styles.bioInput, { color: t.text, backgroundColor: t.inputBg, borderColor: t.borderColor }]}
                                    multiline
                                    numberOfLines={3}
                                    autoCorrect={false}
                                />

                                {/* Error */}
                                {error && (
                                    <Text style={styles.errorText}>{error}</Text>
                                )}

                                {/* Save button */}
                                <TouchableOpacity
                                    onPress={handleSave}
                                    disabled={saving}
                                    style={[styles.saveBtn, { backgroundColor: t.accent, opacity: saving ? 0.6 : 1 }]}
                                    activeOpacity={0.8}
                                >
                                    {saving ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.saveBtnText}>{saved ? "✓ Saved!" : "Save Changes"}</Text>
                                    )}
                                </TouchableOpacity>

                                {/* Divider */}
                                <View style={[styles.divider, { backgroundColor: t.borderColor }]} />

                                {/* Sign Out */}
                                <TouchableOpacity
                                    onPress={handleLogoutPress}
                                    style={[styles.logoutBtn, { borderColor: "#ef4444" + "40" }]}
                                    activeOpacity={0.8}
                                >
                                    <LogoutIcon color="#ef4444" size={18} />
                                    <Text style={styles.logoutBtnText}>Sign Out</Text>
                                </TouchableOpacity>

                                {/* App Version & OTA Info */}
                                <View style={{ alignItems: "center", marginTop: 20, marginBottom: 4 }}>
                                    <Text style={{ fontSize: 11.5, fontWeight: "600", color: t.textMuted }}>
                                        FlowChat v{Constants.expoConfig?.version || "1.0.3"} (Build {Constants.expoConfig?.android?.versionCode || Constants.nativeBuildVersion || "3"})
                                    </Text>
                                    {(() => {
                                        const otaTime = Updates.createdAt
                                            ? new Date(Updates.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                            : null;
                                        const otaHash = Updates.updateId ? Updates.updateId.substring(0, 8) : (__DEV__ ? "dev-live" : "embedded");
                                        return (
                                            <Text style={{ fontSize: 10.5, marginTop: 3, color: t.textMuted, opacity: 0.75, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}>
                                                OTA #{otaConfig.otaNumber} ({otaConfig.lastUpdated}) • {otaHash}{otaTime ? ` • ${otaTime}` : ''}
                                            </Text>
                                        );
                                    })()}
                                </View>
                            </>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            </Animated.View>
        </Modal>
    );
}

// ─── Bottom Dock ──────────────────────────────────────────────────────────────

function BottomDock({ theme: t, navigation, onAccountPress }) {
    const { changeTheme, themeKey } = useApp();
    const insets = useSafeAreaInsets();
    const [showThemePicker, setShowThemePicker] = useState(false);

    const ThemeToggleIcon = t.isDark ? SunIcon : MoonIcon;

    return (
        <View style={styles.dockWrapper}>
            {/* Theme picker slide-up tray */}
            {showThemePicker && (
                <View style={[styles.themeTray, { backgroundColor: t.cardBg, borderColor: t.borderColor }]}>
                    <Text style={[styles.trayLabel, { color: t.textMuted }]}>SELECT THEME</Text>
                    <View style={styles.swatchRow}>
                        {THEME_KEYS.map(key => (
                            <TouchableOpacity
                                key={key}
                                onPress={() => { changeTheme(key); setShowThemePicker(false); }}
                                style={[
                                    styles.swatch,
                                    { backgroundColor: THEME_COLORS[key] },
                                    themeKey === key && styles.swatchActive,
                                ]}
                            />
                        ))}
                    </View>
                </View>
            )}

            {/* Floating dock pill */}
            <View style={[styles.dock, {
                backgroundColor: t.cardBg,
                borderColor: t.borderColor,
                shadowColor: t.isDark ? "#000" : "#aaa",
                marginBottom: insets.bottom + 10,
            }]}>
                {/* New DM */}
                <TouchableOpacity
                    style={styles.dockItem}
                    onPress={() => navigation.navigate("NewMessage")}
                    activeOpacity={0.7}
                >
                    <View style={[styles.iconCircle, { backgroundColor: t.accent + "18" }]}>
                        <PencilIcon color={t.accent} size={20} />
                    </View>
                    <Text style={[styles.dockLabel, { color: t.textMuted }]}>Message</Text>
                </TouchableOpacity>

                {/* New Group */}
                <TouchableOpacity
                    style={styles.dockItem}
                    onPress={() => navigation.navigate("NewGroup")}
                    activeOpacity={0.7}
                >
                    <View style={[styles.iconCircle, { backgroundColor: t.accent + "18" }]}>
                        <GroupIcon color={t.accent} size={20} />
                    </View>
                    <Text style={[styles.dockLabel, { color: t.textMuted }]}>Group</Text>
                </TouchableOpacity>

                {/* Theme */}
                <TouchableOpacity
                    style={styles.dockItem}
                    onPress={() => setShowThemePicker(v => !v)}
                    activeOpacity={0.7}
                >
                    <View style={[styles.iconCircle, { backgroundColor: t.accent + "18" }]}>
                        <ThemeToggleIcon color={t.accent} size={20} />
                    </View>
                    <Text style={[styles.dockLabel, { color: t.textMuted }]}>Theme</Text>
                </TouchableOpacity>

                {/* Account */}
                <TouchableOpacity
                    style={styles.dockItem}
                    onPress={onAccountPress}
                    activeOpacity={0.7}
                >
                    <View style={[styles.iconCircle, { backgroundColor: t.accent + "18" }]}>
                        <UserIcon color={t.accent} size={20} />
                    </View>
                    <Text style={[styles.dockLabel, { color: t.textMuted }]}>Account</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ConversationListScreen({ navigation }) {
    const { theme: t, logout } = useApp();
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
    } = useConversations();

    const [accountOpen, setAccountOpen] = useState(false);

    const handleSelectConversation = useCallback((conv) => {
        navigation.navigate("Chat", { conversation: conv });
    }, [navigation]);

    const handleStartConversation = useCallback(async (userItem) => {
        try {
            const conv = await startConversation(userItem);
            setSearchQuery("");
            navigation.navigate("Chat", { conversation: conv });
        } catch (err) {
            Alert.alert("Error", err.message || "Failed to start conversation");
        }
    }, [startConversation, navigation, setSearchQuery]);

    const handleLogout = useCallback(() => {
        logout().catch(err => console.warn("Logout error:", err));
    }, [logout]);

    const showSearch = searchQuery.trim().length > 0;

    return (
        <View style={[styles.container, { backgroundColor: t.bg }]}>
            <ConversationHeader
                syncState={syncState}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                theme={t}
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
                            <Avatar uri={item.avatar_url} name={item.display_name || item.username} size={44} />
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
                        isSearching
                            ? <Text style={[styles.searchingText, { color: t.textMuted }]}>Searching...</Text>
                            : <EmptyState theme={t} isSearchEmpty />
                    }
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
                />
            ) : (
                <FlatList
                    data={conversations}
                    extraData={typingMap}
                    keyExtractor={(item) => String(item.id || item.conversation_id)}
                    renderItem={({ item }) => {
                        const cid = String(item.id || item.conversation_id || "");
                        return (
                            <ConversationItem
                                conversation={item}
                                onPress={() => handleSelectConversation(item)}
                                isTyping={Boolean(typingMap[cid])}
                            />
                        );
                    }}
                    ListEmptyComponent={syncState === "connecting" ? null : <EmptyState theme={t} />}
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
                />
            )}

            <BottomDock theme={t} navigation={navigation} onAccountPress={() => setAccountOpen(true)} />

            <AccountPanel
                visible={accountOpen}
                onClose={() => setAccountOpen(false)}
                theme={t}
                onLogout={handleLogout}
            />
        </View>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },
    searchRow: {
        flexDirection: "row", alignItems: "center",
        paddingHorizontal: 14, paddingVertical: 12,
        gap: 12, borderBottomWidth: StyleSheet.hairlineWidth,
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
        alignItems: "center",
        pointerEvents: "box-none",
    },
    dock: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 32,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 12,
    },
    dockItem: {
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
    },
    iconCircle: {
        width: 46,
        height: 46,
        borderRadius: 23,
        alignItems: "center",
        justifyContent: "center",
    },
    dockLabel: {
        fontSize: 11,
        fontWeight: "600",
        letterSpacing: 0.2,
    },

    // Theme tray
    themeTray: {
        alignSelf: "center",
        borderRadius: 18,
        borderWidth: 1,
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
        borderColor: "#0284c7",
        transform: [{ scale: 1.15 }],
    },

    // Account Panel / Modal
    backdrop: {
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
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
        maxHeight: "88%",
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
    avatarHint: {
        fontSize: 12,
        textAlign: "center",
        opacity: 0.7,
    },
    fieldLabel: {
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.8,
        marginBottom: 6,
        textTransform: "uppercase",
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 11,
        fontSize: 15,
        marginBottom: 18,
    },
    bioInput: {
        height: 90,
        textAlignVertical: "top",
        paddingTop: 11,
    },
    errorText: {
        color: "#ef4444",
        fontSize: 13,
        marginBottom: 12,
        textAlign: "center",
    },
    saveBtn: {
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 6,
    },
    saveBtnText: {
        color: "#fff",
        fontWeight: "800",
        fontSize: 15,
        letterSpacing: 0.3,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginVertical: 20,
    },
    logoutBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        borderRadius: 14,
        borderWidth: 1.5,
        paddingVertical: 13,
    },
    logoutBtnText: {
        color: "#ef4444",
        fontWeight: "800",
        fontSize: 15,
    },
});
