import React from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

/**
 * MessageStatusIcon — renders tick icons for message delivery status.
 * Only renders for own messages.
 * Props: status ("sending"|"sent"|"delivered"|"read"), isOwn, isDark
 */
export default function MessageStatusIcon({ status, isOwn, isDark = false }) {
  if (!isOwn) return null;

  if (status === "sending") {
    // Clock
    const color = isDark ? "rgba(180,180,180,0.6)" : "rgba(255,255,255,0.7)";
    return (
      <Svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        style={{ marginLeft: 3 }}
      >
        <Path
          d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
          stroke={color}
          strokeWidth="2"
        />
        <Path
          d="M12 6V12L16 14"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  const isRead = status === "read";
  const color = isRead
    ? isDark
      ? "#818cf8"
      : "#a5f3fc"
    : isDark
      ? "rgba(180,180,180,0.75)"
      : "rgba(255,255,255,0.75)";

  if (status === "sent") {
    // Single tick
    return (
      <Svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        style={{ marginLeft: 3 }}
      >
        <Path
          d="M20 6L9 17l-5-5"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  // Double tick (delivered or read)
  return (
    <Svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      style={{ marginLeft: 3 }}
    >
      <Path
        d="M18 5L7 16l-5-5"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M22 5l-11 11-3-3"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
