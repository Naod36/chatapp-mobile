import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet, TouchableWithoutFeedback } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";

function PersonIcon({ color }) {
    return (
        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2" />
            <Path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
}

function PeopleIcon({ color }) {
    return (
        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx="9" cy="7" r="4" stroke={color} strokeWidth="2" />
            <Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
}

/**
 * PinChoiceModal — Choice prompt when pinning a message.
 * Supports scope selection (personal vs shared) and group notify choice (notify vs silent).
 */
export default function PinChoiceModal({ visible, theme: t, isGroup = false, isAdmin = true, onSelectOption, onClose }) {
    const [step, setStep] = useState("scope"); // "scope" | "notify"

    useEffect(() => {
        if (visible) {
            setStep("scope");
        }
    }, [visible]);

    if (!visible) return null;

    const canPinShared = !isGroup || isAdmin;

    const handleSelectShared = () => {
        if (isGroup) {
            setStep("notify");
        } else {
            onSelectOption("shared", true);
        }
    };

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={[styles.dialog, { backgroundColor: t.cardBg, borderColor: t.borderColor }]}>
                            {step === "scope" ? (
                                <>
                                    <Text style={[styles.title, { color: t.text }]}>Pin Message</Text>
                                    <Text style={[styles.subtitle, { color: t.textMuted }]}>
                                        Choose how you want to pin this message in this chat.
                                    </Text>

                                    <TouchableOpacity
                                        style={[styles.optionBtn, { backgroundColor: t.inputBg || t.bg }]}
                                        onPress={() => onSelectOption("personal", false)}
                                    >
                                        <View style={styles.optionIconWrap}>
                                            <PersonIcon color={t.text} />
                                        </View>
                                        <View style={styles.optionContent}>
                                            <Text style={[styles.optionTitle, { color: t.text }]}>Pin for me</Text>
                                            <Text style={[styles.optionDesc, { color: t.textMuted }]}>
                                                Only visible to you in this chat
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    {canPinShared && (
                                        <TouchableOpacity
                                            style={[styles.optionBtn, { backgroundColor: t.inputBg || t.bg }]}
                                            onPress={handleSelectShared}
                                        >
                                            <View style={styles.optionIconWrap}>
                                                <PeopleIcon color={t.text} />
                                            </View>
                                            <View style={styles.optionContent}>
                                                <Text style={[styles.optionTitle, { color: t.text }]}>
                                                    {isGroup ? "Pin for everyone" : "Pin for both of us"}
                                                </Text>
                                                <Text style={[styles.optionDesc, { color: t.textMuted }]}>
                                                    Visible to all members in this chat
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}

                                    <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                                        <Text style={[styles.cancelText, { color: t.textMuted }]}>Cancel</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <Text style={[styles.title, { color: t.text }]}>Notify Members?</Text>
                                    <Text style={[styles.subtitle, { color: t.textMuted }]}>
                                        Choose whether to send an in-app notification to all members about this pin.
                                    </Text>

                                    <TouchableOpacity
                                        style={[styles.optionBtn, { backgroundColor: t.inputBg || t.bg }]}
                                        onPress={() => onSelectOption("shared", true)}
                                    >
                                        <Text style={styles.optionIcon}>🔔</Text>
                                        <View style={styles.optionContent}>
                                            <Text style={[styles.optionTitle, { color: t.text }]}>Notify members</Text>
                                            <Text style={[styles.optionDesc, { color: t.textMuted }]}>
                                                Send notification to all group members
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.optionBtn, { backgroundColor: t.inputBg || t.bg }]}
                                        onPress={() => onSelectOption("shared", false)}
                                    >
                                        <Text style={styles.optionIcon}>🔕</Text>
                                        <View style={styles.optionContent}>
                                            <Text style={[styles.optionTitle, { color: t.text }]}>Silent pin</Text>
                                            <Text style={[styles.optionDesc, { color: t.textMuted }]}>
                                                Pin without sending a notification
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setStep("scope")}>
                                        <Text style={[styles.cancelText, { color: t.textMuted }]}>Back</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    dialog: {
        width: "100%",
        maxWidth: 340,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 5,
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 16,
    },
    optionBtn: {
        flexDirection: "row",
        alignItems: "center",
        padding: 14,
        borderRadius: 12,
        marginBottom: 10,
    },
    optionIcon: {
        fontSize: 22,
        marginRight: 12,
    },
    optionIconWrap: {
        marginRight: 12,
    },
    optionContent: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 15,
        fontWeight: "600",
    },
    optionDesc: {
        fontSize: 12,
        marginTop: 2,
    },
    cancelBtn: {
        alignItems: "center",
        paddingVertical: 10,
        marginTop: 6,
    },
    cancelText: {
        fontSize: 14,
        fontWeight: "500",
    },
});
