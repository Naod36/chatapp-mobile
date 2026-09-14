import React from "react";
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, SafeAreaView } from "react-native";
import Svg, { Path } from "react-native-svg";

function PinIcon({ color, size = 16 }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M12 17v5M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
}

/**
 * PinnedListModal — View list of all pinned messages in a conversation.
 * Props: visible, pinnedMessages, theme, onSelectMessage, onUnpinMessage, onClose
 */
export default function PinnedListModal({ visible, pinnedMessages = [], theme: t, onSelectMessage, onUnpinMessage, onClose }) {
    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: t.borderColor, backgroundColor: t.cardBg }]}>
                    <Text style={[styles.title, { color: t.text }]}>Pinned Messages ({pinnedMessages.length})</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Text style={[styles.closeText, { color: t.textMuted }]}>✕</Text>
                    </TouchableOpacity>
                </View>

                {/* List */}
                <FlatList
                    data={pinnedMessages}
                    keyExtractor={(item) => String(item.pin_id || item.id || item.message_id)}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item, index }) => {
                        const snippet = item.content || (
                            item.message_type === "image" ? "Image" :
                            (item.message_type === "audio" || item.message_type === "voice" ? "Voice Message" : "Attachment")
                        );
                        const isPersonal = item.scope === "personal";

                        return (
                            <TouchableOpacity
                                style={[styles.itemCard, { backgroundColor: t.cardBg, borderColor: t.borderColor }]}
                                onPress={() => {
                                    onSelectMessage(item);
                                    onClose();
                                }}
                                activeOpacity={0.7}
                            >
                                <View style={styles.itemMain}>
                                    <View style={styles.itemHeader}>
                                        <Text style={[styles.senderName, { color: t.accent }]}>
                                            {item.sender_name || "User"}
                                        </Text>
                                        <View style={[styles.scopeBadge, { backgroundColor: isPersonal ? "#6366f120" : "#10b98120" }]}>
                                            <Text style={[styles.scopeText, { color: isPersonal ? "#6366f1" : "#10b981" }]}>
                                                {isPersonal ? "Personal" : "Shared"}
                                            </Text>
                                        </View>
                                    </View>

                                    <Text style={[styles.itemText, { color: t.text }]} numberOfLines={2}>
                                        {snippet}
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    style={styles.unpinBtn}
                                    onPress={() => onUnpinMessage(item)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={{ color: t.textMuted, fontSize: 15, fontWeight: "700" }}>✕</Text>
                                </TouchableOpacity>
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <View style={{ marginBottom: 8, opacity: 0.6 }}>
                                <PinIcon color={t.textMuted} size={32} />
                            </View>
                            <Text style={[styles.emptyText, { color: t.textMuted }]}>No pinned messages</Text>
                        </View>
                    }
                />
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 17,
        fontWeight: "700",
    },
    closeBtn: {
        padding: 6,
    },
    closeText: {
        fontSize: 18,
        fontWeight: "600",
    },
    listContent: {
        padding: 14,
    },
    itemCard: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 10,
    },
    itemMain: {
        flex: 1,
        marginRight: 10,
    },
    itemHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 4,
    },
    senderName: {
        fontSize: 13,
        fontWeight: "700",
    },
    scopeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    scopeText: {
        fontSize: 10,
        fontWeight: "700",
    },
    itemText: {
        fontSize: 14,
        lineHeight: 19,
    },
    unpinBtn: {
        padding: 6,
    },
    emptyWrap: {
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        marginTop: 60,
    },
    emptyText: {
        fontSize: 14,
    },
});
