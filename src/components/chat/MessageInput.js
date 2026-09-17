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
import Svg, { Path, Line, Circle } from "react-native-svg";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import EmojiPicker from "rn-emoji-keyboard";
import {
  UPLOAD_SIZE_ERROR,
  isOversizedUpload,
} from "../../utils/uploadLimits.js";

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

function SmileIcon({ color }) {
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
      <Circle cx="9" cy="9" r="1" fill={color} />
      <Circle cx="15" cy="9" r="1" fill={color} />
      <Path
        d="M8 14a4 4 0 008 0"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
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
  onSelectMultipleImages,
  onClearAttachment,
  isUploading,
  uploadProgress,
  batchProgress,
  disabled = false,
  assertInteractionAllowed,
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
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const selectionRef = useRef({ start: value.length, end: value.length });
  const [emojiSelection, setEmojiSelection] = useState(undefined);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const replyTargetId = replyingTo?.id || replyingTo?.message_id;
  useEffect(() => {
    if (replyTargetId && !disabled && !isRecording) inputRef.current?.focus();
  }, [replyTargetId, disabled, isRecording]);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const timerRef = useRef(null);
  const webMediaRecorderRef = useRef(null);
  const webAudioChunksRef = useRef([]);
  const nativeRecordingRef = useRef(null);
  const operationRef = useRef({ generation: 0, disabled, mounted: true });
  const permissionRef = useRef(assertInteractionAllowed);
  permissionRef.current = assertInteractionAllowed;
  if (disabled && !operationRef.current.disabled)
    operationRef.current.generation += 1;
  operationRef.current.disabled = disabled;

  const operationAllowed = (generation = operationRef.current.generation) => {
    if (
      !operationRef.current.mounted ||
      operationRef.current.disabled ||
      generation !== operationRef.current.generation
    )
      return false;
    try {
      permissionRef.current?.();
      return true;
    } catch {
      return false;
    }
  };

  const disposeRecording = async () => {
    const mediaRecorder = webMediaRecorderRef.current;
    webMediaRecorderRef.current = null;
    if (mediaRecorder) {
      mediaRecorder.onstop = null;
      mediaRecorder.ondataavailable = null;
      if (mediaRecorder.state !== "inactive") mediaRecorder.stop();
      mediaRecorder.stream?.getTracks().forEach((track) => track.stop());
    }
    webAudioChunksRef.current = [];
    const nativeRecorder = nativeRecordingRef.current;
    nativeRecordingRef.current = null;
    if (nativeRecorder) {
      const { Audio } = require("expo-av");
      try {
        await nativeRecorder.stopAndUnloadAsync();
      } catch {}
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(
        () => {},
      );
    }
  };

  useEffect(() => {
    operationRef.current.mounted = true;
    if (disabled) {
      disposeRecording();
      setIsRecording(false);
      setRecording(null);
      setRecordingSecs(0);
      setPickerVisible(false);
      setEmojiPickerVisible(false);
    }
    return () => {
      operationRef.current.mounted = false;
      operationRef.current.generation += 1;
      disposeRecording();
    };
  }, [disabled]);

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
    if (!operationAllowed()) return;
    const generation = ++operationRef.current.generation;
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
        if (!operationAllowed(generation)) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
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
      if (!operationAllowed(generation)) return;
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
      if (!operationAllowed(generation)) {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        return;
      }

      const { recording: newRec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      if (!operationAllowed(generation)) {
        await newRec.stopAndUnloadAsync().catch(() => {});
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        return;
      }
      nativeRecordingRef.current = newRec;
      setRecording(newRec);
      setIsRecording(true);
      setRecordingSecs(0);
    } catch (err) {
      Alert.alert("Error", "Could not start voice recording: " + err.message);
    }
  };

  const stopAndSendRecording = async () => {
    if (!operationAllowed()) {
      await disposeRecording();
      return;
    }
    const generation = operationRef.current.generation;
    const secs = recordingSecs;
    if (Platform.OS === "web") {
      const mediaRecorder = webMediaRecorderRef.current;
      if (!mediaRecorder) return;
      setIsRecording(false);

      mediaRecorder.onstop = () => {
        mediaRecorder.stream?.getTracks().forEach((track) => track.stop());
        webMediaRecorderRef.current = null;
        if (!operationAllowed(generation)) return;
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
    const nativeRecorder = nativeRecordingRef.current;
    if (!nativeRecorder) return;
    nativeRecordingRef.current = null;
    try {
      setIsRecording(false);
      const { Audio } = require("expo-av");
      await nativeRecorder.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = nativeRecorder.getURI();
      setRecording(null);
      setRecordingSecs(0);

      if (uri && operationAllowed(generation)) {
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
    operationRef.current.generation += 1;
    await disposeRecording();
    setIsRecording(false);
    setRecording(null);
    setRecordingSecs(0);
  };

  const formatRecTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleChange = (text) => {
    if (!operationAllowed()) return;
    onChangeText(text);
    if (text.length > 0) {
      onTypingStart?.();
    } else {
      onTypingStop?.();
    }
  };

  const handleSend = () => {
    if (!canSend || !operationAllowed()) return;
    onTypingStop?.();
    onSend();
  };

  const handleEmojiSelected = ({ emoji }) => {
    if (!operationAllowed()) return;
    const start = Math.min(selectionRef.current.start, value.length);
    const end = Math.min(selectionRef.current.end, value.length);
    const nextValue = value.slice(0, start) + emoji + value.slice(end);
    if (nextValue.length > 4000) return;
    handleChange(nextValue);
    const nextSelection = {
      start: start + emoji.length,
      end: start + emoji.length,
    };
    selectionRef.current = nextSelection;
    setEmojiSelection(nextSelection);
    setEmojiPickerVisible(false);
    inputRef.current?.focus();
  };

  const handlePickImage = async () => {
    if (!operationAllowed()) return;
    const generation = operationRef.current.generation;
    setPickerVisible(false);
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!operationAllowed(generation)) return;
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
        allowsMultipleSelection: true,
        selectionLimit: 10,
      });

      if (
        operationAllowed(generation) &&
        !result.canceled &&
        result.assets &&
        result.assets.length > 0
      ) {
        const toEntry = (asset) => {
          const isVideo = asset.type === "video";
          const sizeInBytes = asset.fileSize || asset.size || asset.file?.size;
          return {
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
          };
        };

        if (result.assets.length > 1) {
          const images = result.assets
            .filter((asset) => asset.type !== "video")
            .map(toEntry);
          const oversized = images.filter((entry) =>
            isOversizedUpload(entry.size),
          );
          const validImages = images.filter(
            (entry) => !isOversizedUpload(entry.size),
          );
          if (oversized.length > 0) {
            Alert.alert(
              "File too large",
              `${oversized.length} of ${images.length} images ${oversized.length === 1 ? "was" : "were"} skipped: ${UPLOAD_SIZE_ERROR}`,
            );
          }
          if (validImages.length > 1) {
            onSelectMultipleImages?.(validImages);
            return;
          }
          if (validImages.length === 1) {
            onSelectAttachment?.(validImages[0]);
            return;
          }
          if (oversized.length > 0) return;
          // Only videos were picked alongside others; fall back to the first asset.
          onSelectAttachment?.(toEntry(result.assets[0]));
          return;
        }

        const singleEntry = toEntry(result.assets[0]);
        if (isOversizedUpload(singleEntry.size)) {
          Alert.alert("File too large", UPLOAD_SIZE_ERROR);
          return;
        }
        onSelectAttachment?.(singleEntry);
      }
    } catch (err) {
      Alert.alert("Error", "Could not pick image/video: " + err.message);
    }
  };

  const handlePickDocument = async () => {
    if (!operationAllowed()) return;
    const generation = operationRef.current.generation;
    setPickerVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (
        operationAllowed(generation) &&
        !result.canceled &&
        result.assets &&
        result.assets.length > 0
      ) {
        const asset = result.assets[0];
        const sizeInBytes = asset.size || asset.fileSize || asset.file?.size;
        if (isOversizedUpload(sizeInBytes)) {
          Alert.alert("File too large", UPLOAD_SIZE_ERROR);
          return;
        }
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

  if (disabled) {
    return (
      <View
        style={[
          styles.outerWrap,
          {
            backgroundColor: t.bg,
            borderTopColor: t.borderColor,
            paddingBottom: dynamicPaddingBottom,
            paddingTop: 14,
            alignItems: "center",
          },
        ]}
      >
        <Text style={{ color: t.textMuted, fontSize: 13, fontWeight: "600" }}>
          You can't message this user
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.outerWrap,
        {
          backgroundColor: "transparent",
          borderTopWidth: 0,
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

      {/* Batch image send progress */}
      {batchProgress && (
        <View
          style={[
            styles.previewBar,
            { backgroundColor: t.cardBg, borderColor: t.borderColor },
          ]}
        >
          <View style={styles.previewTextWrap}>
            <Text style={[styles.previewName, { color: t.text }]}>
              {`Sending ${batchProgress.current} of ${batchProgress.total}...`}
            </Text>
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
              </View>
            ) : null}
          </View>
        </View>
      )}

      {/* Attachment preview bar */}
      {!batchProgress && attachment && (
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
        <View
          style={[
            styles.inputRow,
            { backgroundColor: t.inputBg, borderColor: t.borderColor },
          ]}
        >
          <TouchableOpacity
            onPress={cancelRecording}
            accessibilityRole="button"
            accessibilityLabel="Cancel recording"
            style={styles.attachBtn}
          >
            <Text
              style={{ color: t.textMuted, fontWeight: "700", fontSize: 14 }}
            >
              ✕
            </Text>
          </TouchableOpacity>

          <View style={[styles.inputWrap, styles.recordingActiveWrap]}>
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
            accessibilityRole="button"
            accessibilityLabel="Send voice message"
            style={[styles.sendBtn, { backgroundColor: t.buttonBg }]}
          >
            <SendIcon color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View
          style={[
            styles.inputRow,
            { backgroundColor: t.inputBg, borderColor: t.borderColor },
          ]}
        >
          <TouchableOpacity
            onPress={() => {
              if (!operationAllowed()) return;
              Keyboard.dismiss();
              setEmojiPickerVisible(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Choose emoji"
            accessibilityState={{ expanded: emojiPickerVisible }}
            style={styles.attachBtn}
          >
            <SmileIcon color={t.textMuted} />
          </TouchableOpacity>

          <View style={styles.inputWrap}>
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={handleChange}
              selection={emojiSelection}
              onSelectionChange={({ nativeEvent }) => {
                selectionRef.current = nativeEvent.selection;
                setEmojiSelection(undefined);
              }}
              placeholder="Message"
              placeholderTextColor={t.textMuted}
              style={[styles.input, { color: t.text }]}
              multiline
              maxLength={4000}
              returnKeyType="default"
              blurOnSubmit={false}
            />
          </View>

          <TouchableOpacity
            onPress={() => setPickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Attach file"
            style={styles.attachBtn}
            activeOpacity={0.7}
          >
            <PaperclipIcon color={t.textMuted} />
          </TouchableOpacity>

          {canSend ? (
            <TouchableOpacity
              onPress={handleSend}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              disabled={!canSend}
              style={[
                styles.sendBtn,
                { backgroundColor: canSend ? t.buttonBg : t.cardBg },
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
              accessibilityRole="button"
              accessibilityLabel="Record voice message"
              style={[styles.sendBtn, { backgroundColor: t.buttonBg }]}
              activeOpacity={0.8}
            >
              <MicIcon color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      )}

      <EmojiPicker
        open={emojiPickerVisible && !disabled}
        onClose={() => setEmojiPickerVisible(false)}
        onEmojiSelected={handleEmojiSelected}
        enableSearchBar
        enableRecentlyUsed
        categoryPosition="top"
        theme={{
          container: t.cardBg,
          header: t.text,
          knob: t.textMuted,
          skinTonesContainer: t.inputBg,
          category: {
            icon: t.textMuted,
            iconActive: t.accent,
            container: t.cardBg,
            containerActive: t.inputBg,
          },
          search: {
            background: t.inputBg,
            text: t.text,
            placeholder: t.textMuted,
            icon: t.textMuted,
          },
        }}
      />

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
    gap: 2,
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 4,
    padding: 4,
    borderWidth: 1,
    borderRadius: 28,
    minHeight: 54,
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  inputWrap: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    paddingHorizontal: 4,
    paddingVertical: 12,
    minHeight: 44,
  },
  input: {
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 106,
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
