import React, { Component } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View, Text, TouchableOpacity } from "react-native";

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

function AppNavigator() {
    const { user, authLoading, login, theme: t } = useApp();

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
            <AppProvider>
                <AppNavigator />
            </AppProvider>
        </ErrorBoundary>
    );
}
