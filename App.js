import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";

import { AppProvider, useApp } from "./src/context/AppContext";
import LoginScreen from "./src/screens/LoginScreen";
import ConversationListScreen from "./src/screens/ConversationListScreen";
import ChatScreen from "./src/screens/ChatScreen";
import NewMessageScreen from "./src/screens/NewMessageScreen";
import NewGroupScreen from "./src/screens/NewGroupScreen";

const Stack = createNativeStackNavigator();

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
        <AppProvider>
            <AppNavigator />
        </AppProvider>
    );
}
