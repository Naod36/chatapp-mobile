import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

function PlayIcon({ color }) {
  return (
    <Svg width="14" height="14" viewBox="0 0 24 24" fill={color}>
      <Path d="M8 5v14l11-7z" />
    </Svg>
  );
}

function PauseIcon({ color }) {
  return (
    <Svg width="14" height="14" viewBox="0 0 24 24" fill={color}>
      <Rect x="6" y="4" width="4" height="16" rx="1" />
      <Rect x="14" y="4" width="4" height="16" rx="1" />
    </Svg>
  );
}

/**
 * VoicePlayer — Cross-platform Waveform audio player with real audio peak decoding matching the desktop web design.
 */
export default function VoicePlayer({ src, isOwn, theme: t }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);

  const htmlAudioRef = useRef(null);
  const expoSoundRef = useRef(null);

  // 28 waveform peak height bars
  const [peaks, setPeaks] = useState(() => [
    30, 50, 25, 75, 40, 85, 60, 35, 70, 50, 90, 65, 30, 80, 45, 30, 70, 50, 30,
    60, 80, 40, 25, 55, 30, 45, 25, 35,
  ]);

  // Extract real audio peaks from the audio file
  useEffect(() => {
    if (!src) return;
    let isCancelled = false;

    fetch(src)
      .then((res) => res.arrayBuffer())
      .then((buffer) => {
        if (typeof window === "undefined") return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const audioCtx = new AudioCtx();
        return audioCtx.decodeAudioData(buffer);
      })
      .then((audioBuffer) => {
        if (isCancelled || !audioBuffer) return;
        const rawData = audioBuffer.getChannelData(0);
        const sampleCount = 28;
        const blockSize = Math.floor(rawData.length / sampleCount);
        const extracted = [];

        for (let i = 0; i < sampleCount; i++) {
          const start = i * blockSize;
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(rawData[start + j] || 0);
          }
          const avg = sum / blockSize;
          const heightPercent = Math.min(
            100,
            Math.max(15, Math.floor(avg * 400)),
          );
          extracted.push(heightPercent);
        }
        if (extracted.length === 28) {
          setPeaks(extracted);
        }
      })
      .catch(() => {
        // Keep default if decode fails
      });

    return () => {
      isCancelled = true;
    };
  }, [src]);

  useEffect(() => {
    if (Platform.OS === "web" && src) {
      const audio = new window.Audio(src);
      htmlAudioRef.current = audio;

      const onLoadedMetadata = () => {
        if (audio.duration && !isNaN(audio.duration)) {
          setDurationMillis(audio.duration * 1000);
        }
      };
      const onTimeUpdate = () => {
        setPositionMillis(audio.currentTime * 1000);
      };
      const onEnded = () => {
        setIsPlaying(false);
        setPositionMillis(0);
      };

      audio.addEventListener("loadedmetadata", onLoadedMetadata);
      audio.addEventListener("timeupdate", onTimeUpdate);
      audio.addEventListener("ended", onEnded);

      return () => {
        audio.pause();
        audio.removeEventListener("loadedmetadata", onLoadedMetadata);
        audio.removeEventListener("timeupdate", onTimeUpdate);
        audio.removeEventListener("ended", onEnded);
      };
    }
  }, [src]);

  useEffect(() => {
    return () => {
      if (expoSoundRef.current) {
        expoSoundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const togglePlay = async () => {
    if (Platform.OS === "web") {
      const audio = htmlAudioRef.current;
      if (!audio) return;
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch(console.error);
      }
      return;
    }

    // Native mobile logic (iOS/Android)
    try {
      const { Audio } = require("expo-av");
      if (expoSoundRef.current) {
        const status = await expoSoundRef.current.getStatusAsync();
        if (status.isLoaded) {
          if (isPlaying) {
            await expoSoundRef.current.pauseAsync();
          } else {
            if (status.positionMillis >= status.durationMillis) {
              await expoSoundRef.current.setPositionAsync(0);
            }
            await expoSoundRef.current.playAsync();
          }
          return;
        }
      }

      setIsLoading(true);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: src },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            setPositionMillis(status.positionMillis || 0);
            setDurationMillis(status.durationMillis || 0);
            setIsPlaying(status.isPlaying);
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPositionMillis(0);
            }
          }
        },
      );
      expoSoundRef.current = newSound;
      setIsLoading(false);
    } catch (err) {
      console.error("Audio playback error:", err);
      setIsLoading(false);
    }
  };

  const handleSeek = async (barIndex) => {
    if (!durationMillis) return;
    const targetMillis = Math.floor((barIndex / peaks.length) * durationMillis);
    setPositionMillis(targetMillis);

    if (Platform.OS === "web") {
      if (htmlAudioRef.current) {
        htmlAudioRef.current.currentTime = targetMillis / 1000;
      }
    } else if (expoSoundRef.current) {
      await expoSoundRef.current.setPositionAsync(targetMillis);
    }
  };

  const formatTime = (ms) => {
    if (!ms || isNaN(ms)) return "0:00";
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = Math.floor(totalSecs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progressRatio = durationMillis ? positionMillis / durationMillis : 0;
  const activeBarsCount = Math.floor(progressRatio * peaks.length);

  const btnBg = isOwn ? "rgba(255, 255, 255, 0.2)" : t.buttonBg;
  const barActiveColor = isOwn ? "#ffffff" : t.accent;
  const barInactiveColor = isOwn
    ? "rgba(255, 255, 255, 0.35)"
    : t.isDark
      ? "rgba(255, 255, 255, 0.2)"
      : "rgba(0, 0, 0, 0.2)";
  const textColor = isOwn ? "#ffffff" : t.text;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={togglePlay}
        disabled={isLoading}
        style={[styles.playBtn, { backgroundColor: btnBg }]}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : isPlaying ? (
          <PauseIcon color="#ffffff" />
        ) : (
          <PlayIcon color="#ffffff" />
        )}
      </TouchableOpacity>

      <View style={styles.waveWrap}>
        <View style={styles.waveRow}>
          {peaks.map((heightPercent, idx) => {
            const isActive = idx <= activeBarsCount;
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => handleSeek(idx)}
                style={styles.barTouchArea}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.waveBar,
                    {
                      height: `${heightPercent}%`,
                      backgroundColor: isActive
                        ? barActiveColor
                        : barInactiveColor,
                    },
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.timeRow}>
          <Text style={[styles.timeText, { color: textColor }]}>
            {formatTime(positionMillis || durationMillis)}
          </Text>
          <Text
            style={[
              styles.typeText,
              { color: isOwn ? "rgba(255,255,255,0.7)" : t.textMuted },
            ]}
          >
            Voice Message
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 220,
    paddingVertical: 4,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  waveWrap: {
    flex: 1,
    gap: 4,
  },
  waveRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 24,
    gap: 2,
  },
  barTouchArea: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  waveBar: {
    width: "100%",
    minHeight: 4,
    maxHeight: 22,
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  typeText: {
    fontSize: 10.5,
  },
});
