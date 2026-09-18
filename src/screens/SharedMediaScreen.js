import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import * as VideoThumbnails from "expo-video-thumbnails";
import { useApp } from "../context/AppContext";
import { conversationService } from "../services/conversations";
import { API_BASE } from "../services/api";
import FullScreenImageViewer from "../components/chat/FullScreenImageViewer";

function BackIcon({ color }) {
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function FileIcon({ color }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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

function getAssetUrl(url) {
  if (!url) return null;
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:")
  )
    return url;
  return `${API_BASE}${url}`;
}

function PlayIcon({ color = "#fff" }) {
  return (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill={color}>
      <Path d="M8 5v14l11-7z" />
    </Svg>
  );
}

// Grid tile for a video message: generates a frame thumbnail on mount and
// falls back to a plain dark tile with a play icon when generation fails
// (e.g. web, or an older binary without the native module).
export function VideoThumb({ uri, onPress }) {
  const [thumbUri, setThumbUri] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (Platform.OS === "web" || !uri) return undefined;
    try {
      VideoThumbnails.getThumbnailAsync(uri, { time: 1000 })
        .then((result) => {
          if (!cancelled && result?.uri) setThumbUri(result.uri);
        })
        .catch(() => {});
    } catch {}
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return (
    <TouchableOpacity
      style={styles.thumbWrap}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Play video"
      onPress={onPress}
    >
      {thumbUri ? (
        <Image source={{ uri: thumbUri }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.videoPlaceholder]} />
      )}
      <View style={styles.playOverlay} pointerEvents="none">
        <PlayIcon />
      </View>
    </TouchableOpacity>
  );
}

/**
 * SharedMediaScreen — a conversation's shared images (grid) and files (list),
 * reachable from ChatOptionsMenu's "Shared Media" row.
 */
export default function SharedMediaScreen({ route, navigation }) {
  const { theme: t, isBlockedBy, blockStateReady } = useApp();
  const insets = useSafeAreaInsets();

  const params = route.params || {};
  const conversation = params.conversation;
  const passedMessages = params.messages;
  const convId = String(conversation?.id || conversation?.conversation_id);

  const [fetchedMessages, setFetchedMessages] = useState(null);
  const [loading, setLoading] = useState(!passedMessages);
  const [viewerIndex, setViewerIndex] = useState(null);

  useEffect(() => {
    if (passedMessages) return;
    let cancelled = false;
    setLoading(true);
    conversationService
      .getMessages(convId)
      .then((data) => {
        if (!cancelled) setFetchedMessages(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setFetchedMessages([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId]);

  const messages = passedMessages || fetchedMessages || [];

  const visibleMessages = useMemo(
    () =>
      messages.filter((m) => {
        const senderId = m.sender_id || m.user_id;
        return blockStateReady && !isBlockedBy(senderId);
      }),
    [messages, isBlockedBy, blockStateReady],
  );

  const imageMessages = useMemo(
    () =>
      visibleMessages.filter(
        (m) => m.message_type === "image" && (m.media_url || m.file_url),
      ),
    [visibleMessages],
  );

  const fileMessages = useMemo(
    () => visibleMessages.filter((m) => m.message_type === "file"),
    [visibleMessages],
  );

  const videoMessages = useMemo(
    () =>
      visibleMessages.filter(
        (m) => m.message_type === "video" && (m.media_url || m.file_url),
      ),
    [visibleMessages],
  );

  const openFile = useCallback((item) => {
    const url = getAssetUrl(item.media_url || item.file_url);
    if (url) Linking.openURL(url).catch(() => {});
  }, []);

  const renderImageThumb = useCallback(
    ({ item, index }) => (
      <TouchableOpacity
        style={styles.thumbWrap}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="View image"
        onPress={() => setViewerIndex(index)}
      >
        <Image
          source={{ uri: getAssetUrl(item.media_url || item.file_url) }}
          style={styles.thumb}
          resizeMode="cover"
        />
      </TouchableOpacity>
    ),
    [],
  );

  const isEmpty =
    !loading &&
    imageMessages.length === 0 &&
    fileMessages.length === 0 &&
    videoMessages.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <View
        style={[
          styles.header,
          {
            borderBottomColor: t.borderColor,
            backgroundColor: t.headerBg,
            paddingTop: insets.top + 10,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <BackIcon color={t.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.text }]}>
          Shared Media
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator
          style={{ marginTop: 24 }}
          size="small"
          color={t.accent}
        />
      ) : isEmpty ? (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyText, { color: t.textMuted }]}>
            No shared media in this conversation yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={imageMessages}
          key="shared-media-grid"
          numColumns={3}
          keyExtractor={(item, idx) =>
            String(item.id || item.message_id || idx)
          }
          renderItem={renderImageThumb}
          contentContainerStyle={styles.gridContent}
          ListHeaderComponent={
            <Text style={[styles.sectionHeader, { color: t.textMuted }]}>
              Images ({imageMessages.length})
            </Text>
          }
          ListFooterComponent={
            <View style={styles.filesSection}>
              {videoMessages.length > 0 && (
                <>
                  <Text style={[styles.sectionHeader, { color: t.textMuted }]}>
                    Videos ({videoMessages.length})
                  </Text>
                  <View style={styles.videoGrid}>
                    {videoMessages.map((item, idx) => (
                      <VideoThumb
                        key={String(item.id || item.message_id || idx)}
                        uri={getAssetUrl(item.media_url || item.file_url)}
                        onPress={() => openFile(item)}
                      />
                    ))}
                  </View>
                </>
              )}
              <Text style={[styles.sectionHeader, { color: t.textMuted }]}>
                Files ({fileMessages.length})
              </Text>
              {fileMessages.length === 0 ? (
                <Text style={[styles.emptySectionText, { color: t.textMuted }]}>
                  No files shared yet.
                </Text>
              ) : (
                fileMessages.map((item, idx) => (
                  <TouchableOpacity
                    key={String(item.id || item.message_id || idx)}
                    style={[
                      styles.fileRow,
                      { borderBottomColor: t.borderColor },
                    ]}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Open file ${item.file_name || "File"}`}
                    onPress={() => openFile(item)}
                  >
                    <FileIcon color={t.text} />
                    <Text
                      style={[styles.fileName, { color: t.text }]}
                      numberOfLines={1}
                    >
                      {item.file_name || "File"}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          }
        />
      )}

      <FullScreenImageViewer
        visible={viewerIndex !== null}
        images={imageMessages}
        startIndex={viewerIndex || 0}
        onClose={() => setViewerIndex(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700", marginLeft: 8 },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyText: { fontSize: 14, textAlign: "center" },
  gridContent: { paddingBottom: 40 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginHorizontal: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  thumbWrap: {
    width: "33.333%",
    aspectRatio: 1,
    padding: 1,
  },
  thumb: {
    flex: 1,
    borderRadius: 2,
  },
  videoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  videoPlaceholder: {
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  playOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  filesSection: { paddingBottom: 12 },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fileName: { fontSize: 14, fontWeight: "500", flex: 1 },
  emptySectionText: {
    fontSize: 13,
    marginHorizontal: 16,
    marginBottom: 8,
  },
});
