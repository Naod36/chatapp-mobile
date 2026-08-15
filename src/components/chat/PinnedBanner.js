import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

/**
 * PinnedBanner — Telegram-style pinned message banner.
 * Props: pinnedMessages (array), activeIndex (number), theme, onCycle, onOpenList, onUnpinActive
 */
export default function PinnedBanner({
    pinnedMessages = [],
    activeIndex = 0,
    theme: t,
    onCycle,
    onOpenList,
    onUnpinActive,
}) {
    if (!pinnedMessages || pinnedMessages.length === 0) return null;

    const safeIndex = activeIndex >= pinnedMessages.length ? 0 : activeIndex;
    const message = pinnedMessages[safeIndex] || pinnedMessages[0];
    const totalCount = pinnedMessages.length;

    const snippet = message.content || (
        message.message_type === "image" ? "📷 Image" :
        (message.message_type === "audio" || message.message_type === "voice" ? "🎙️ Voice Message" : "📁 Attachment")
    );

    const isPersonal = message.scope === "personal";

    return (
        <View style={[styles.banner, { backgroundColor: t.cardBg, borderBottomColor: t.borderColor }]}>
            {/* Cycle / Main content touchable */}
            <TouchableOpacity style={styles.mainArea} onPress={onCycle} activeOpacity={0.8}>
                <View style={styles.iconCol}>
                    <Text style={{ fontSize: 14 }}>📌</Text>
                    {totalCount > 1 && (
                        <Text style={[styles.counter, { color: t.accent }]}>
                            {safeIndex + 1}/{totalCount}
                        </Text>
                    )}
                </View>

                <View style={styles.content}>
                    <View style={styles.labelRow}>
                        <Text style={[styles.label, { color: t.accent }]}>PINNED MESSAGE</Text>
                        <Text style={[styles.scopeTag, { color: isPersonal ? "#6366f1" : "#10b981" }]}>
                            {isPersonal ? "• Personal" : "• Shared"}
                        </Text>
                    </View>
                    <Text style={[styles.text, { color: t.text }]} numberOfLines={1}>
                        {snippet}
                    </Text>
                </View>
            </TouchableOpacity>

            {/* List button (show all) */}
            {totalCount > 1 && (
                <TouchableOpacity
                    onPress={onOpenList}
                    style={styles.actionBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Text style={[styles.btnText, { color: t.accent }]}>≡</Text>
                </TouchableOpacity>
            )}

            {/* Unpin current */}
            <TouchableOpacity
                onPress={() => onUnpinActive?.(message)}
                style={styles.actionBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Text style={[styles.btnText, { color: t.textMuted }]}>✕</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderBottomWidth: 1,
    },
    mainArea: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
    },
    iconCol: {
        alignItems: "center",
        marginRight: 10,
        minWidth: 24,
    },
    counter: {
        fontSize: 9,
        fontWeight: "800",
        marginTop: 1,
    },
    content: { flex: 1 },
    labelRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    label: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
    scopeTag: { fontSize: 10, fontWeight: "600", marginLeft: 4 },
    text: { fontSize: 13, marginTop: 1, fontWeight: "500" },
    actionBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    btnText: { fontSize: 16, fontWeight: "700" },
});
