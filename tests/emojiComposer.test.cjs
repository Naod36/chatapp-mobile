const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes } = require("./helpers.cjs");

test("emoji picker opens, replaces selected text, respects length and closes on block", () => {
  const runner = harness();
  const native = Object.fromEntries(["View", "Text", "TextInput", "TouchableOpacity", "Image", "Modal", "TouchableWithoutFeedback", "ActivityIndicator"].map((name) => [name, name]));
  let dismissals = 0;
  Object.assign(native, {
    StyleSheet: { create: (styles) => styles }, Platform: { OS: "android" },
    Keyboard: { addListener: () => ({ remove() {} }), dismiss: () => dismissals++ },
  });
  const { default: Input } = runner.load("src/components/chat/MessageInput.js", {
    "react-native": native,
    "react-native-svg": { __esModule: true, default: "Svg", Path: "Path", Line: "Line", Circle: "Circle" },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 0 }) },
    "expo-image-picker": {}, "expo-document-picker": {},
    "rn-emoji-keyboard": { __esModule: true, default: "EmojiPicker" },
    "expo-blur": { BlurView: "BlurView" },
  });
  let changes = 0;
  const props = { value: "hello world", theme: {}, onChangeText: (text) => { props.value = text; changes++; } };
  const render = () => nodes(runner.render(() => Input(props)));
  let tree = render();
  tree.find((node) => node.type === "TextInput").props.onSelectionChange({ nativeEvent: { selection: { start: 6, end: 11 } } });
  tree.find((node) => node.props.accessibilityLabel === "Choose emoji").props.onPress();
  tree = render();
  const picker = tree.find((node) => node.type === "EmojiPicker");
  assert.equal(picker.props.open, true);
  assert.equal(picker.props.enableSearchBar, true);
  assert.equal(dismissals, 1);
  picker.props.onEmojiSelected({ emoji: "\u{1F600}" });
  assert.equal(props.value, "hello \u{1F600}");
  tree = render();
  assert.equal(tree.find((node) => node.type === "EmojiPicker").props.open, false);
  assert.equal(tree.find((node) => node.type === "TextInput").props.selection.start, 8);
  props.value = "a".repeat(4000);
  tree = render();
  tree.find((node) => node.type === "TextInput").props.onSelectionChange({ nativeEvent: { selection: { start: 4000, end: 4000 } } });
  tree.find((node) => node.type === "EmojiPicker").props.onEmojiSelected({ emoji: "\u{1F600}" });
  assert.equal(changes, 1);
  props.disabled = true;
  assert.equal(render().some((node) => node.type === "EmojiPicker"), false);
  picker.props.onEmojiSelected({ emoji: "\u{1F600}" });
  assert.equal(changes, 1);
  runner.unmount();
});