import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import SyncBadge from "../common/SyncBadge";

function SearchIcon({ color }) {
    return (
        <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
}

function ComposeIcon({ color }) {
    return (
        <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
}

/**
 * ConversationHeader — top bar for the conversation list screen.
 * Props: syncState, searchQuery, onSearchChange, theme, onLogout, onCompose
 */
export default function ConversationHeader({ syncState, searchQuery, onSearchChange, theme: t }) {
    const insets = useSafeAreaInsets();

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: t.headerBg,
                    borderBottomColor: t.borderColor,
                    paddingTop: insets.top + 6,
                },
            ]}
        >
            {/* Title row */}
            <View style={styles.titleRow}>
                <View style={styles.titleWrap}>
                    {syncState === "ready" ? (
                        <Text style={[styles.appName, { color: t.accent }]}>FlowChat</Text>
                    ) : (
                        <SyncBadge syncState={syncState} theme={t} />
                    )}
                </View>
            </View>

            {/* Search bar */}
            <View style={[styles.searchWrap, { backgroundColor: t.inputBg, borderColor: t.borderColor }]}>
                <SearchIcon color={t.textMuted} />
                <TextInput
                    value={searchQuery}
                    onChangeText={onSearchChange}
                    placeholder="Search people..."
                    placeholderTextColor={t.textMuted}
                    style={[styles.searchInput, { color: t.text }]}
                    returnKeyType="search"
                    autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => onSearchChange("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={{ color: t.textMuted, fontSize: 16 }}>✕</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingBottom: 10,
        paddingHorizontal: 14,
        gap: 10,
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 2,
    },
    titleWrap: { flex: 1 },
    appName: {
        fontSize: 22,
        fontWeight: "900",
        letterSpacing: 0.5,
        textTransform: "uppercase",
    },
    logoutBtn: {
        padding: 4,
    },
    logoutText: {
        fontSize: 13,
        fontWeight: "600",
    },
    searchWrap: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 22,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 9,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14.5,
        padding: 0,
        margin: 0,
    },
});
