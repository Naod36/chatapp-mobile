import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Image,
  Modal,
  TouchableWithoutFeedback,
  Alert,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import Svg, { Path, Line } from "react-native-svg";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

function ImageIcon({ color, size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-1"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"
        stroke={color}
        strokeWidth="2"
      />
      <Path
        d="M21 15l-5-5L5 21"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DocumentIcon({ color, size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13 2v7h7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function VideoIcon({ color, size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M23 7l-7 5 7 5V7z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PaperclipIcon({ color }) {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <Path
        d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SendIcon({ color }) {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 2L11 13"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M22 2L15 22 11 13 2 9l20-7z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MicIcon({ color }) {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19 10v2a7 7 0 0 1-14 0v-2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="12"
        y1="19"
        x2="12"
        y2="23"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="8"
        y1="23"
        x2="16"
        y2="23"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";

/**
 * MessageInput — bottom bar for composing, attaching media, recording voice, and sending messages.
 */
export default function MessageInput({
  value,
  onChangeText,
  onSend,
  onTypingStart,
  onTypingStop,
  theme: t,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  attachment,
  onSelectAttachment,
  onClearAttachment,
  isUploading,
  uploadProgress,
}) {
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardVisible(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const dynamicPaddingBottom = keyboardVisible
    ? Platform.OS === "ios"
      ? 8
      : 6
    : Math.max(insets.bottom, Platform.OS === "ios" ? 16 : 8);
  const inputRef = useRef(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const timerRef = useRef(null);
  const webMediaRecorderRef = useRef(null);
  const webAudioChunksRef = useRef([]);

  const hasText = value.trim().length > 0;
  const canSend = (hasText || attachment || editingMessage) && !isUploading;

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingSecs((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      if (Platform.OS === "web") {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          Alert.alert(
            "Error",
            "Audio recording is not supported on this browser.",
          );
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        webAudioChunksRef.current = [];
        const mediaRecorder = new MediaRecorder(stream);
        webMediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            webAudioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
        setRecordingSecs(0);
        return;
      }

      // Native mobile logic
      const { Audio } = require("expo-av");
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Needed",
          "Microphone access is required to record voice messages.",
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(newRec);
      setIsRecording(true);
      setRecordingSecs(0);
    } catch (err) {
      Alert.alert("Error", "Could not start voice recording: " + err.message);
    }
  };

  const stopAndSendRecording = async () => {
    const secs = recordingSecs;
    if (Platform.OS === "web") {
      const mediaRecorder = webMediaRecorderRef.current;
      if (!mediaRecorder) return;
      setIsRecording(false);

      mediaRecorder.onstop = () => {
        const blob = new Blob(webAudioChunksRef.current, {
          type: "audio/webm",
        });
        const file = new File([blob], `voice_${Date.now()}.webm`, {
          type: "audio/webm",
        });
        const uri = URL.createObjectURL(blob);

        if (mediaRecorder.stream) {
          mediaRecorder.stream.getTracks().forEach((track) => track.stop());
        }

        setRecordingSecs(0);
        onSelectAttachment?.({
          uri,
          name: `voice_${Date.now()}.webm`,
          type: "audio/webm",
          mediaType: "voice",
          file,
          sizeFormatted: `${secs}s voice message`,
        });
      };

      mediaRecorder.stop();
      return;
    }

    // Native mobile logic
    if (!recording) return;
    try {
      setIsRecording(false);
      const { Audio } = require("expo-av");
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recording.getURI();
      setRecording(null);
      setRecordingSecs(0);

      if (uri) {
        onSelectAttachment?.({
          uri,
          name: `voice_${Date.now()}.m4a`,
          type: "audio/m4a",
          mediaType: "voice",
          sizeFormatted: `${secs}s voice message`,
        });
      }
    } catch (err) {
      Alert.alert("Error", "Failed to stop recording: " + err.message);
    }
  };

  const cancelRecording = async () => {
    if (Platform.OS === "web") {
      const mediaRecorder = webMediaRecorderRef.current;
      if (mediaRecorder && mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      }
      setIsRecording(false);
      setRecordingSecs(0);
      return;
    }

    if (!recording) return;
    try {
      setIsRecording(false);
      const { Audio } = require("expo-av");
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      setRecording(null);
      setRecordingSecs(0);
    } catch (err) {
      setIsRecording(false);
      setRecording(null);
    }
  };

  const formatRecTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleChange = (text) => {
    onChangeText(text);
    if (text.length > 0) {
      onTypingStart?.();
    } else {
      onTypingStop?.();
    }
  };

  const handleSend = () => {
    if (!canSend) return;
    onTypingStop?.();
    onSend();
  };

  const handlePickImage = async () => {
    setPickerVisible(false);
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Needed",
          "FlowChat needs access to your photo library to share photos and videos.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const isVideo = asset.type === "video";
        const sizeInBytes = asset.fileSize || asset.size || asset.file?.size;
        onSelectAttachment?.({
          uri: asset.uri,
          name:
            asset.fileName ||
            asset.name ||
            (isVideo ? `video_${Date.now()}.mp4` : `photo_${Date.now()}.jpg`),
          type: asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg"),
          mediaType: isVideo ? "video" : "image",
          file: asset.file,
          size: sizeInBytes,
          sizeFormatted: formatFileSize(sizeInBytes),
        });
      }
    } catch (err) {
      Alert.alert("Error", "Could not pick image/video: " + err.message);
    }
  };

  const handlePickDocument = async () => {
    setPickerVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const sizeInBytes = asset.size || asset.fileSize || asset.file?.size;
        onSelectAttachment?.({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || "application/octet-stream",
          mediaType: "file",
          file: asset.file,
          size: sizeInBytes,
          sizeFormatted: formatFileSize(sizeInBytes),
        });
      }
    } catch (err) {
      Alert.alert("Error", "Could not pick document: " + err.message);
    }
  };

  return (
    <View
      style={[
        styles.outerWrap,
        {
          backgroundColor: t.bg,
          borderTopColor: t.borderColor,
          paddingBottom: dynamicPaddingBottom,
        },
      ]}
    >
      {/* Editing bar */}
      {editingMessage && (
        <View
          style={[
            styles.replyBar,
            { backgroundColor: t.cardBg, borderColor: t.borderColor },
          ]}
        >
          <View style={styles.replyBarInner}>
            <Text
              style={[styles.replyLabel, { color: t.accent }]}
              numberOfLines={1}
            >
              Editing message
            </Text>
            <Text
              style={[styles.replyContent, { color: t.textMuted }]}
              numberOfLines={1}
            >
              {editingMessage.content}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onCancelEdit}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.replyClose, { color: t.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Reply bar */}
      {replyingTo && (
        <View
          style={[
            styles.replyBar,
            { backgroundColor: t.cardBg, borderColor: t.borderColor },
          ]}
        >
          <View style={styles.replyBarInner}>
            <Text
              style={[styles.replyLabel, { color: t.accent }]}
              numberOfLines={1}
            >
              ↩ Replying to {replyingTo.sender_name || "message"}
            </Text>
            <Text
              style={[styles.replyContent, { color: t.textMuted }]}
              numberOfLines={1}
            >
              {replyingTo.content || "Media"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onCancelReply}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.replyClose, { color: t.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Attachment preview bar */}
      {attachment && (
        <View
          style={[
            styles.previewBar,
            { backgroundColor: t.cardBg, borderColor: t.borderColor },
          ]}
        >
          {attachment.mediaType === "image" ? (
            <Image
              source={{ uri: attachment.uri }}
              style={styles.previewImage}
            />
          ) : (
            <View
              style={[
                styles.previewIconWrap,
                { backgroundColor: t.accent + "20" },
              ]}
            >
              {attachment.mediaType === "video" ? (
                <VideoIcon color={t.accent} size={20} />
              ) : attachment.mediaType === "voice" ? (
                <MicIcon color={t.accent} />
              ) : (
                <PaperclipIcon color={t.accent} />
              )}
            </View>
          )}
          <View style={styles.previewTextWrap}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={[
                  styles.previewName,
                  { color: t.text, flex: 1, marginRight: 8 },
                ]}
                numberOfLines={1}
              >
                {attachment.name}
              </Text>
              {attachment.sizeFormatted ? (
                <Text
                  style={{ fontSize: 11, fontWeight: "700", color: t.accent }}
                >
                  {attachment.sizeFormatted}
                </Text>
              ) : null}
            </View>

            {uploadProgress ? (
              <View style={{ marginTop: 4 }}>
                <View
                  style={{
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: t.isDark
                      ? "rgba(255,255,255,0.12)"
                      : "rgba(0,0,0,0.1)",
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      height: "100%",
                      backgroundColor: t.accent,
                      width: `${uploadProgress.percentage}%`,
                    }}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 10.5,
                    marginTop: 3,
                    fontWeight: "600",
                    color: t.textMuted,
                  }}
                >
                  Uploading {uploadProgress.percentage}% (
                  {uploadProgress.loadedFormatted} /{" "}
                  {uploadProgress.totalFormatted})
                </Text>
              </View>
            ) : (
              <Text style={[styles.previewType, { color: t.textMuted }]}>
                {attachment.mediaType.toUpperCase()} attachment ready to send
              </Text>
            )}
          </View>
          {!isUploading && (
            <TouchableOpacity
              onPress={onClearAttachment}
              style={styles.clearBtn}
            >
              <Text
                style={{ color: t.textMuted, fontSize: 16, fontWeight: "700" }}
              >
                ✕
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Input row or Voice Recording active row */}
      {isRecording ? (
        <View style={[styles.inputRow, { backgroundColor: t.bg }]}>
          <TouchableOpacity
            onPress={cancelRecording}
            style={[
              styles.attachBtn,
              { backgroundColor: t.cardBg, borderColor: t.borderColor },
            ]}
          >
            <Text
              style={{ color: t.textMuted, fontWeight: "700", fontSize: 14 }}
            >
              ✕
            </Text>
          </TouchableOpacity>

          <View
            style={[
              styles.inputWrap,
              styles.recordingActiveWrap,
              { backgroundColor: t.cardBg, borderColor: t.accent },
            ]}
          >
            <BlurView
              intensity={t.isDark ? 45 : 65}
              tint={t.isDark ? "dark" : "light"}
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { zIndex: -1 }]}
            />
            <View style={styles.redDot} />
            <Text style={[styles.recordingTimeText, { color: t.text }]}>
              {formatRecTime(recordingSecs)}
            </Text>
            <View style={styles.liveWaveform}>
              {[40, 75, 35, 90, 60, 100, 45, 80, 50, 35, 70, 40].map(
                (h, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.liveBar,
                      {
                        height: `${Math.min(100, Math.max(25, (h * (((recordingSecs + idx) % 4) + 1)) % 100))}%`,
                        backgroundColor: t.accent,
                      },
                    ]}
                  />
                ),
              )}
            </View>
          </View>

          <TouchableOpacity
            onPress={stopAndSendRecording}
            style={[styles.sendBtn, { backgroundColor: t.accent }]}
          >
            <SendIcon color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.inputRow, { backgroundColor: t.bg }]}>
          {/* Paperclip attach button */}
          <TouchableOpacity
            onPress={() => setPickerVisible(true)}
            style={[
              styles.attachBtn,
              { backgroundColor: t.cardBg, borderColor: t.borderColor },
            ]}
            activeOpacity={0.7}
          >
            <PaperclipIcon color={t.accent} />
          </TouchableOpacity>

          <View
            style={[
              styles.inputWrap,
              { backgroundColor: t.inputBg, borderColor: t.borderColor },
            ]}
          >
            <BlurView
              intensity={t.isDark ? 40 : 60}
              tint={t.isDark ? "dark" : "light"}
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { zIndex: -1 }]}
            />
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={handleChange}
              placeholder="Message..."
              placeholderTextColor={t.textMuted}
              style={[styles.input, { color: t.text }]}
              multiline
              maxLength={4000}
              returnKeyType="default"
              blurOnSubmit={false}
            />
          </View>

          {canSend ? (
            <TouchableOpacity
              onPress={handleSend}
              disabled={!canSend}
              style={[
                styles.sendBtn,
                { backgroundColor: canSend ? t.accent : t.cardBg },
              ]}
              activeOpacity={0.8}
            >
              {isUploading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <SendIcon color={canSend ? "#fff" : t.textMuted} />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={startRecording}
              style={[styles.sendBtn, { backgroundColor: t.accent }]}
              activeOpacity={0.8}
            >
              <MicIcon color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Attachment Modal */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setPickerVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.modalSheet,
                  {
                    backgroundColor: t.cardBg,
                    borderColor: t.borderColor,
                    paddingBottom: Math.max(
                      insets.bottom + 16,
                      Platform.OS === "ios" ? 40 : 24,
                    ),
                  },
                ]}
              >
                <Text style={[styles.modalTitle, { color: t.text }]}>
                  Attach Media
                </Text>
                <TouchableOpacity
                  style={[
                    styles.optionRow,
                    { borderBottomColor: t.borderColor },
                  ]}
                  onPress={handlePickImage}
                >
                  <View style={{ marginRight: 12 }}>
                    <ImageIcon color={t.accent} size={22} />
                  </View>
                  <View>
                    <Text style={[styles.optionText, { color: t.text }]}>
                      Photo or Video
                    </Text>
                    <Text style={[styles.optionSub, { color: t.textMuted }]}>
                      Choose from your gallery
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={handlePickDocument}
                >
                  <View style={{ marginRight: 12 }}>
                    <DocumentIcon color={t.accent} size={22} />
                  </View>
                  <View>
                    <Text style={[styles.optionText, { color: t.text }]}>
                      Document or File
                    </Text>
                    <Text style={[styles.optionSub, { color: t.textMuted }]}>
                      Choose from device files
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    borderTopWidth: 1,
    paddingBottom: Platform.OS === "ios" ? 24 : 8,
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  replyBarInner: { flex: 1 },
  replyLabel: { fontSize: 11.5, fontWeight: "700" },
  replyContent: { fontSize: 12, marginTop: 2 },
  replyClose: { fontSize: 16, paddingHorizontal: 4 },
  previewBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    marginHorizontal: 10,
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  previewImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  previewIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  previewTextWrap: {
    flex: 1,
  },
  previewName: {
    fontSize: 13,
    fontWeight: "600",
  },
  previewType: {
    fontSize: 11,
    marginTop: 2,
  },
  clearBtn: {
    padding: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  inputWrap: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 130,
  },
  input: {
    fontSize: 15,
    lineHeight: 20,
    padding: 0,
    margin: 0,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  recordingActiveWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 0,
    paddingBottom: 0,
    height: 44,
    gap: 8,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ef4444",
  },
  recordingTimeText: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  liveWaveform: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 20,
    gap: 3,
    marginLeft: 6,
  },
  liveBar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 15,
    fontWeight: "600",
  },
  optionSub: {
    fontSize: 12,
    marginTop: 2,
  },
});
