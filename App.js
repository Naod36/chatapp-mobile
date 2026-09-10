import React, { Component } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View, Text, TouchableOpacity, Linking, AppState } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Updates from "expo-updates";
import { API_BASE } from "./src/services/api";

import { AppProvider, useApp } from "./src/context/AppContext";
import LoginScreen from "./src/screens/LoginScreen";
import ConversationListScreen from "./src/screens/ConversationListScreen";
import ChatScreen from "./src/screens/ChatScreen";
import NewMessageScreen from "./src/screens/NewMessageScreen";
import NewGroupScreen from "./src/screens/NewGroupScreen";

const Stack = createNativeStackNavigator();

class ErrorBoundary extends Component {
    state = { hasError: false, error: null };

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught App Error:", error, errorInfo);
    }

    handleReload = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={{ flex: 1, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center", padding: 24 }}>
                    <Text style={{ color: "#F8FAFC", fontSize: 20, fontWeight: "bold", marginBottom: 12 }}>
                        Something went wrong
                    </Text>
                    <Text style={{ color: "#94A3B8", textAlign: "center", marginBottom: 24, fontSize: 14 }}>
                        {this.state.error?.message || "An unexpected error occurred."}
                    </Text>
                    <TouchableOpacity
                        onPress={this.handleReload}
                        style={{ backgroundColor: "#3B82F6", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
                    >
                        <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>Reload App</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return this.props.children;
    }
}

import Constants from "expo-constants";

// Dynamically read build number from native APK (e.g. versionCode 1, 2, 3...)
const CURRENT_BUILD_NUMBER = parseInt(
    Constants.nativeBuildVersion || Constants.expoConfig?.android?.versionCode || 1,
    10
);

function UpdateBanner() {
    // In local dev mode, don't show update prompts
    if (__DEV__) return null;

    const insets = useSafeAreaInsets();
    const [latestRelease, setLatestRelease] = React.useState(null);
    const [dismissed, setDismissed] = React.useState(false);

    React.useEffect(() => {
        fetch(`${API_BASE}/releases/latest?platform=android`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data && data.build_number > CURRENT_BUILD_NUMBER) {
                    setLatestRelease(data);
                }
            })
            .catch(() => {});
    }, []);

    if (!latestRelease || dismissed) return null;

    const paddingTop = Math.max(insets.top + 4, 28);

    return (
        <View style={{
            backgroundColor: "#0284C7",
            paddingTop: paddingTop,
            paddingBottom: 10,
            paddingHorizontal: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 9999,
        }}>
            <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600", flex: 1, marginRight: 8 }} numberOfLines={1}>
                🚀 New Update Available (v{latestRelease.version})
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <TouchableOpacity
                    onPress={() => Linking.openURL(latestRelease.apk_url)}
                    style={{ backgroundColor: "#FFFFFF", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 }}
                >
                    <Text style={{ color: "#0284C7", fontSize: 12, fontWeight: "700" }}>Download</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDismissed(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700", opacity: 0.8 }}>✕</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

// Silently fetches JS-only OTA updates in the background and applies them
// while the app is backgrounded, so users never see a manual "update" prompt
// or have to redownload the APK for non-native changes.
function useSilentOtaUpdates() {
    React.useEffect(() => {
        if (__DEV__ || !Updates.isEnabled) return;

        let pendingApply = false;

        const checkAndFetch = async () => {
            try {
                const result = await Updates.checkForUpdateAsync();
                if (result.isAvailable) {
                    await Updates.fetchUpdateAsync();
                    pendingApply = true;
                }
            } catch {
                // Network hiccups are expected and must never surface to the user.
            }
        };

        checkAndFetch();

        const subscription = AppState.addEventListener("change", (state) => {
            if (state === "active") {
                checkAndFetch();
            } else if (state === "background" && pendingApply) {
                pendingApply = false;
                Updates.reloadAsync().catch(() => {});
            }
        });

        return () => subscription.remove();
    }, []);
}

function AppNavigator() {
    const { user, authLoading, login, theme: t } = useApp();
    useSilentOtaUpdates();

    if (authLoading) {
        return (
            <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" color={t.accent} />
                <StatusBar style={t.isDark ? "light" : "dark"} />
            </View>
        );
    }

    if (!user) {
        return (
            <>
                <StatusBar style={t.isDark ? "light" : "dark"} />
                <UpdateBanner />
                <LoginScreen onLoginSuccess={login} />
            </>
        );
    }

    const navTheme = {
        ...DefaultTheme,
        dark: t.isDark,
        colors: {
            ...DefaultTheme.colors,
            primary: t.accent,
            background: t.bg,
            card: t.headerBg,
            text: t.text,
            border: t.borderColor,
        },
    };

    return (
        <NavigationContainer theme={navTheme}>
            <StatusBar style={t.isDark ? "light" : "dark"} />
            <UpdateBanner />
            <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
                <Stack.Screen name="Conversations" component={ConversationListScreen} />
                <Stack.Screen name="Chat" component={ChatScreen} />
                <Stack.Screen name="NewMessage" component={NewMessageScreen} />
                <Stack.Screen name="NewGroup" component={NewGroupScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

export default function App() {
    return (
        <ErrorBoundary>
            <SafeAreaProvider>
                <AppProvider>
                    <AppNavigator />
                </AppProvider>
            </SafeAreaProvider>
        </ErrorBoundary>
    );
}
