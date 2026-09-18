const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes, settle } = require("./helpers.cjs");

function messageInputMocks({ launchImageLibraryAsync, alerts = [] } = {}) {
  const native = Object.fromEntries(
    [
      "View",
      "Text",
      "TextInput",
      "TouchableOpacity",
      "Image",
      "Modal",
      "TouchableWithoutFeedback",
      "ActivityIndicator",
    ].map((name) => [name, name]),
  );
  Object.assign(native, {
    StyleSheet: { create: (styles) => styles },
    Platform: { OS: "android" },
    Keyboard: { addListener: () => ({ remove() {} }) },
    Alert: { alert: (...args) => alerts.push(args) },
  });
  return {
    "react-native": native,
    "react-native-svg": {
      __esModule: true,
      default: "Svg",
      Path: "Path",
      Line: "Line",
      Circle: "Circle",
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ bottom: 0 }),
    },
    "expo-image-picker": {
      requestMediaLibraryPermissionsAsync: async () => ({ status: "granted" }),
      launchImageLibraryAsync,
    },
    "expo-document-picker": {},
    "rn-emoji-keyboard": { __esModule: true, default: "EmojiPicker" },
    "expo-blur": { BlurView: "BlurView" },
  };
}

function setupMessageInput(pickerResult) {
  const runner = harness();
  const alerts = [];
  const calls = [];
  const attachments = [];
  const multi = [];
  const launchImageLibraryAsync = async (options) => {
    calls.push(options);
    return pickerResult;
  };
  const { default: Input } = runner.load(
    "src/components/chat/MessageInput.js",
    messageInputMocks({ launchImageLibraryAsync, alerts }),
  );
  const props = {
    value: "",
    theme: {},
    disabled: false,
    onSelectAttachment: (a) => attachments.push(a),
    onSelectMultipleImages: (a) => multi.push(a),
    assertInteractionAllowed() {},
  };
  const tree = runner.render(() => Input(props));
  const pickBtn = nodes(tree).find(
    (node) => node.props?.onPress?.name === "handlePickImage",
  );
  return { pickBtn, calls, attachments, multi, alerts };
}

test("picking images requests allowsMultipleSelection and a selectionLimit", async () => {
  const { pickBtn, calls } = setupMessageInput({ canceled: true });
  await pickBtn.props.onPress();
  await settle();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].allowsMultipleSelection, true);
  assert.equal(calls[0].selectionLimit, 10);
});

test("selecting multiple images routes them through onSelectMultipleImages, not onSelectAttachment", async () => {
  const { pickBtn, attachments, multi } = setupMessageInput({
    canceled: false,
    assets: [
      { uri: "file://a.jpg", fileName: "a.jpg", type: "image" },
      { uri: "file://b.jpg", fileName: "b.jpg", type: "image" },
      { uri: "file://c.jpg", fileName: "c.jpg", type: "image" },
    ],
  });
  await pickBtn.props.onPress();
  await settle();
  assert.equal(attachments.length, 0);
  assert.equal(multi.length, 1);
  assert.equal(multi[0].length, 3);
  assert.deepEqual(
    multi[0].map((entry) => entry.name),
    ["a.jpg", "b.jpg", "c.jpg"],
  );
  assert.ok(multi[0].every((entry) => entry.mediaType === "image"));
});

test("a single-image selection still follows the original single-attachment path", async () => {
  const { pickBtn, attachments, multi } = setupMessageInput({
    canceled: false,
    assets: [{ uri: "file://solo.jpg", fileName: "solo.jpg", type: "image" }],
  });
  await pickBtn.props.onPress();
  await settle();
  assert.equal(multi.length, 0);
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].name, "solo.jpg");
  assert.equal(attachments[0].mediaType, "image");
});

// ─── ChatScreen batch-send wiring ───────────────────────────────────────────

function setupChatScreen({ blocked = false } = {}) {
  const runner = harness();
  let blockedFlag = blocked;
  const sendCalls = [];
  const uploadCalls = [];
  const uploadResolvers = [];
  const alerts = [];
  const conversation = {
    id: "chat",
    type: "direct",
    other_participant: { user_id: "peer" },
  };
  const app = {
    theme: {},
    user: { userId: "me" },
    conversations: [conversation],
    blockStateReady: true,
    blockStateVersion: 1,
    isBlocked: () => blockedFlag,
    isBlockedBy: () => false,
    blockUser() {},
    unblockUser() {},
  };
  const native = Object.fromEntries(
    [
      "View",
      "Image",
      "FlatList",
      "Text",
      "TextInput",
      "TouchableOpacity",
      "KeyboardAvoidingView",
    ].map((name) => [name, name]),
  );
  Object.assign(native, {
    StyleSheet: { create: (styles) => styles },
    Platform: { OS: "android" },
    Alert: { alert: (...args) => alerts.push(args) },
    Clipboard: { setString() {} },
    Keyboard: { addListener: () => ({ remove() {} }) },
    Share: { share: async () => {} },
  });
  const mocks = {
    "react-native": native,
    "react-native-svg": { __esModule: true, default: "Svg", Path: "Path" },
    "@react-native-async-storage/async-storage": { getItem: async () => null },
    "../context/AppContext": { useApp: () => app },
    "../services/api": { API_BASE: "http://test.invalid" },
    "../hooks/useMessages": {
      useMessages: () => ({
        messages: [],
        pinnedMessages: [],
        typingUser: null,
        sendMessage: async (...args) => {
          if (blockedFlag) throw new Error("Messaging unavailable");
          sendCalls.push(args);
        },
        assertInteractionAllowed: () => {
          if (blockedFlag) throw new Error("Messaging unavailable");
        },
      }),
    },
    "../services/conversations": {
      conversationService: {
        uploadFile: (formData, onProgress, signal) => {
          return new Promise((resolve, reject) => {
            uploadCalls.push({ formData, signal });
            uploadResolvers.push({ resolve, reject });
          });
        },
      },
    },
    "../utils/haptics.js": { lightTap() {}, selectionTap() {}, successTap() {} },
    "../services/notifications": {
      refreshMutedConversationsCache: () => {},
    },
    "expo-file-system/legacy": {
      cacheDirectory: "file://cache/",
      EncodingType: { Base64: "base64" },
      downloadAsync: async (uri, fileUri) => ({ uri: fileUri }),
      readAsStringAsync: async () => "base64imagedata",
    },
    "expo-clipboard": { setImageAsync: async () => {} },
    "expo-media-library": {
      requestPermissionsAsync: async () => ({
        granted: true,
        status: "granted",
      }),
      saveToLibraryAsync: async () => {},
    },
    "expo-sharing": {
      isAvailableAsync: async () => true,
      shareAsync: async () => {},
    },
  };
  for (const name of [
    "ChatHeader",
    "ChatOptionsMenu",
    "MessageBubble",
    "MessageInput",
    "PinnedBanner",
    "PinChoiceModal",
    "PinnedListModal",
    "TypingIndicator",
    "ContextMenu",
    "FullScreenImageViewer",
  ]) {
    mocks[`../components/chat/${name}`] = { __esModule: true, default: name };
  }
  mocks["../components/common/ConfirmDialog"] = {
    __esModule: true,
    default: "ConfirmDialog",
  };
  mocks["../../assets/chat-wallpaper.png"] = 1;
  const { default: Screen } = runner.load("src/screens/ChatScreen.js", mocks);
  const render = () =>
    runner.render(() =>
      Screen({ route: { params: { conversation } }, navigation: {} }),
    );
  return {
    runner,
    render,
    sendCalls,
    uploadCalls,
    uploadResolvers,
    alerts,
    setBlocked: (v) => {
      blockedFlag = v;
    },
  };
}

function asset(name) {
  return { uri: `file://${name}`, name, mediaType: "image" };
}

test("batch sends images sequentially, one upload in flight at a time, with N of M progress", async () => {
  const fixture = setupChatScreen();
  let tree = fixture.render();
  const input = () => nodes(tree).find((n) => n.type === "MessageInput");

  const pending = input().props.onSelectMultipleImages([
    asset("a.jpg"),
    asset("b.jpg"),
    asset("c.jpg"),
  ]);
  await settle();
  assert.equal(fixture.uploadCalls.length, 1);
  tree = fixture.render();
  assert.equal(input().props.batchProgress.current, 1);
  assert.equal(input().props.batchProgress.total, 3);

  fixture.uploadResolvers[0].resolve({ url: "/a.jpg" });
  await settle();
  await settle();
  assert.equal(fixture.uploadCalls.length, 2);
  tree = fixture.render();
  assert.equal(input().props.batchProgress.current, 2);
  assert.equal(input().props.batchProgress.total, 3);

  fixture.uploadResolvers[1].resolve({ url: "/b.jpg" });
  await settle();
  await settle();
  assert.equal(fixture.uploadCalls.length, 3);
  tree = fixture.render();
  assert.equal(input().props.batchProgress.current, 3);
  assert.equal(input().props.batchProgress.total, 3);

  fixture.uploadResolvers[2].resolve({ url: "/c.jpg" });
  await pending;
  tree = fixture.render();
  assert.equal(input().props.batchProgress, null);
  assert.equal(fixture.sendCalls.length, 3);
  for (const [, , type] of fixture.sendCalls) assert.equal(type, "image");
  fixture.runner.unmount();
});

test("a failed image in the batch does not stop the remaining images from being attempted", async () => {
  const fixture = setupChatScreen();
  let tree = fixture.render();
  const input = () => nodes(tree).find((n) => n.type === "MessageInput");

  const pending = input().props.onSelectMultipleImages([
    asset("a.jpg"),
    asset("b.jpg"),
    asset("c.jpg"),
  ]);
  await settle();
  fixture.uploadResolvers[0].reject(new Error("network error"));
  await settle();
  await settle();
  assert.equal(fixture.uploadCalls.length, 2);
  fixture.uploadResolvers[1].resolve({ url: "/b.jpg" });
  await settle();
  await settle();
  assert.equal(fixture.uploadCalls.length, 3);
  fixture.uploadResolvers[2].resolve({ url: "/c.jpg" });
  await pending;

  assert.equal(fixture.sendCalls.length, 2);
  const failureAlert = fixture.alerts.find(
    ([title]) => title === "Some images failed to send",
  );
  assert.ok(failureAlert);
  assert.ok(failureAlert[1].includes("a.jpg"));
  fixture.runner.unmount();
});

test("blocking mid-batch aborts remaining uploads", async () => {
  const fixture = setupChatScreen();
  let tree = fixture.render();
  const input = () => nodes(tree).find((n) => n.type === "MessageInput");

  const pending = input().props.onSelectMultipleImages([
    asset("a.jpg"),
    asset("b.jpg"),
    asset("c.jpg"),
  ]);
  await settle();
  assert.equal(fixture.uploadCalls.length, 1);

  fixture.setBlocked(true);
  fixture.render();
  assert.equal(fixture.uploadCalls[0].signal.aborted, true);

  fixture.uploadResolvers[0].resolve({ url: "/a.jpg" });
  await settle();
  await settle();
  await settle();
  await pending;

  // No further uploads were attempted once blocked mid-batch.
  assert.equal(fixture.uploadCalls.length, 1);
  assert.equal(fixture.sendCalls.length, 0);
  const failureAlert = fixture.alerts.find(
    ([title]) => title === "Some images failed to send",
  );
  assert.ok(failureAlert);
  fixture.runner.unmount();
});
