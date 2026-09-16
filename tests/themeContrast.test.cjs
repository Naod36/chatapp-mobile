const test = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./helpers.cjs");
const { THEMES } = harness().load("src/theme/colors.js");
function luminance(hex) {
  const components = hex
    .slice(1)
    .match(/../g)
    .map((part) => {
      const channel = parseInt(part, 16) / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    });
  return (
    components[0] * 0.2126 + components[1] * 0.7152 + components[2] * 0.0722
  );
}
for (const mode of ["light", "dark"]) {
  test(`${mode} theme reading surfaces meet WCAG AA text contrast`, () => {
    const theme = THEMES[mode];
    const pairs = [
      ["onAccent", "buttonBg"],
      ["userBubbleText", "userBubbleBg"],
      ["otherBubbleText", "otherBubbleBg"],
    ];
    for (const foreground of [
      "text",
      "textMuted",
      "accent",
      "danger",
      "success",
      "warning",
    ]) {
      for (const background of [
        "bg",
        "cardBg",
        "headerBg",
        "inputBg",
        "chatPaneBg",
      ])
        pairs.push([foreground, background]);
    }
    for (const [foreground, background] of pairs) {
      const values = [
        luminance(theme[foreground]),
        luminance(theme[background]),
      ].sort((first, second) => second - first);
      const ratio = (values[0] + 0.05) / (values[1] + 0.05);
      assert.ok(
        ratio >= 4.5,
        `${foreground} on ${background}: ${ratio.toFixed(2)}:1`,
      );
    }
  });
}
