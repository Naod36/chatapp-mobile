const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes, settle } = require("./helpers.cjs");

// ─── ContextMenu.js: media-action gating + quick-reaction emoji list ───────

function setupContextMenu() {
  const runner = harness();
  const native = Object.fromEntries(
    [
      "Modal",
      "View",
      "Text",
      "TouchableOpacity",
      "TouchableWithoutFeedback",
    ].map((name) => [name, name]),
  );
  native.StyleSheet = { create: (styles) => styles };
  const { default: Menu } = runner.load("src/components/chat/ContextMenu.js", {
    "react-native": native,
  });
  return { Menu };
}

function actionLabels(tree) {
  return nodes(tree)
    .filter((n) => n.type === "Text")
    .flatMap((n) => n.props.children);
}

const baseMenuProps = {
  theme: {},
  isOwn: false,
  onReply() {},
  onCopy() {},
  onEdit() {},
  onPin() {},
  onDelete() {},
  onShareImage() {},
  onCopyImage() {},
  onSaveImage() {},
  onSaveVideo() {},
};

test("Copy Image, Share Image and Save Image appear only for image-type messages", () => {
  const { Menu } = setupContextMenu();

  const imageTree = Menu({
    ...baseMenuProps,
    message: { message_type: "image", media_url: "/a.jpg" },
  });
  const imageLabels = actionLabels(imageTree);
  assert.ok(imageLabels.includes("Copy Image"));
  assert.ok(imageLabels.includes("Share Image"));
  assert.ok(imageLabels.includes("Save Image"));
  assert.ok(!imageLabels.includes("Save Video"));

  for (const type of ["text", "voice", "file"]) {
    const tree = Menu({
      ...baseMenuProps,
      message: { message_type: type, content: "hi" },
    });
    const labels = actionLabels(tree);
    assert.ok(
      !labels.includes("Copy Image"),
      `Copy Image should not appear for ${type}`,
    );
    assert.ok(
      !labels.includes("Share Image"),
      `Share Image should not appear for ${type}`,
    );
    assert.ok(
      !labels.includes("Save Image"),
      `Save Image should not appear for ${type}`,
    );
    assert.ok(
      !labels.includes("Save Video"),
      `Save Video should not appear for ${type}`,
    );
  }
});

test("Save Video appears only for video-type messages", () => {
  const { Menu } = setupContextMenu();

  const videoTree = Menu({
    ...baseMenuProps,
    message: { message_type: "video", media_url: "/a.mp4" },
  });
  const videoLabels = actionLabels(videoTree);
  assert.ok(videoLabels.includes("Save Video"));
  assert.ok(!videoLabels.includes("Copy Image"));
  assert.ok(!videoLabels.includes("Share Image"));
  assert.ok(!videoLabels.includes("Save Image"));

  for (const type of ["text", "voice", "file", "image"]) {
    const tree = Menu({
      ...baseMenuProps,
      message: { message_type: type, content: "hi", media_url: "/a" },
    });
    assert.ok(
      !actionLabels(tree).includes("Save Video"),
      `Save Video should not appear for ${type}`,
    );
  }
});

function findAction(tree, label) {
  return nodes(tree).find(
    (n) =>
      n.type === "TouchableOpacity" &&
      nodes(n).some(
        (child) =>
          child.type === "Text" && child.props.children.includes(label),
      ),
  );
}

test("pressing Share Image invokes onShareImage", () => {
  const { Menu } = setupContextMenu();
  let shared = 0;
  const tree = Menu({
    ...baseMenuProps,
    message: { message_type: "image", media_url: "/a.jpg" },
    onShareImage: () => shared++,
  });
  const action = findAction(tree, "Share Image");
  assert.ok(action);
  action.props.onPress();
  assert.equal(shared, 1);
});

test("pressing Copy Image invokes onCopyImage", () => {
  const { Menu } = setupContextMenu();
  let copied = 0;
  const tree = Menu({
    ...baseMenuProps,
    message: { message_type: "image", media_url: "/a.jpg" },
    onCopyImage: () => copied++,
  });
  const action = findAction(tree, "Copy Image");
  assert.ok(action);
  action.props.onPress();
  assert.equal(copied, 1);
});

test("pressing Save Image invokes onSaveImage", () => {
  const { Menu } = setupContextMenu();
  let saved = 0;
  const tree = Menu({
    ...baseMenuProps,
    message: { message_type: "image", media_url: "/a.jpg" },
    onSaveImage: () => saved++,
  });
  const action = findAction(tree, "Save Image");
  assert.ok(action);
  action.props.onPress();
  assert.equal(saved, 1);
});

test("pressing Save Video invokes onSaveVideo", () => {
  const { Menu } = setupContextMenu();
  let saved = 0;
  const tree = Menu({
    ...baseMenuProps,
    message: { message_type: "video", media_url: "/a.mp4" },
    onSaveVideo: () => saved++,
  });
  const action = findAction(tree, "Save Video");
  assert.ok(action);
  action.props.onPress();
  assert.equal(saved, 1);
});

test("quick-reaction bar has exactly 8 emojis including \uD83D\uDE00 and \uD83D\uDE21", () => {
  const { Menu } = setupContextMenu();
  const tree = Menu({
    theme: {},
    isOwn: false,
    interactionsDisabled: false,
    message: { message_type: "text", content: "hi" },
    onReply() {},
    onCopy() {},
    onEdit() {},
    onPin() {},
    onDelete() {},
    onReact() {},
  });
  const emojiTexts = nodes(tree)
    .filter(
      (n) =>
        n.type === "Text" && n.props.style && n.props.style.fontSize === 22,
    )
    .flatMap((n) => n.props.children);
  assert.equal(emojiTexts.length, 8);
  assert.ok(emojiTexts.includes("\u{1F600}")); // 😀
  assert.ok(emojiTexts.includes("\u{1F621}")); // 😡
  for (const original of [
    "\u2764\uFE0F",
    "\uD83D\uDC4D",
    "\uD83D\uDE02",
    "\uD83D\uDE2E",
    "\uD83D\uDE22",
    "\uD83D\uDD25",
  ]) {
    assert.ok(
      emojiTexts.includes(original),
      `missing original emoji ${original}`,
    );
  }
});

// ─── ChatScreen wiring: download-then-share/copy/save handlers ─────────────

function setupChatScreen({
  platformOS = "ios",
  sharingAvailable = true,
  downloadShouldFail = false,
  mediaPermissionGranted = true,
} = {}) {
  const runner = harness();
  const shareCalls = [];
  const shareAsyncCalls = [];
  const downloadCalls = [];
  const readAsStringCalls = [];
  const setImageAsyncCalls = [];
  const requestPermissionsCalls = [];
  const saveToLibraryCalls = [];
  const alerts = [];
  const conversation = {
    id: "chat1",
    type: "direct",
    other_participant: { user_id: "peer" },
  };
  const app = {
    theme: {},
    user: { userId: "me" },
    conversations: [conversation],
    blockStateReady: true,
    blockStateVersion: 1,
    isBlocked: () => false,
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
    Platform: { OS: platformOS },
    Alert: { alert: (...args) => alerts.push(args) },
    Clipboard: { setString() {} },
    Keyboard: { addListener: () => ({ remove() {} }) },
    Share: {
      share: async (options) => {
        shareCalls.push(options);
        return { action: "sharedAction" };
      },
    },
  });
  const mocks = {
    "react-native": native,
    "react-native-svg": { __esModule: true, default: "Svg", Path: "Path" },
    "@react-native-async-storage/async-storage": { getItem: async () => null },
    "expo-file-system/legacy": {
      cacheDirectory: "file://cache/",
      EncodingType: { Base64: "base64" },
      downloadAsync: async (uri, fileUri) => {
        downloadCalls.push({ uri, fileUri });
        if (downloadShouldFail) throw new Error("network down");
        return { uri: fileUri };
      },
      readAsStringAsync: async (uri, options) => {
        readAsStringCalls.push({ uri, options });
        return "base64imagedata";
      },
    },
    "expo-clipboard": {
      setImageAsync: async (base64) => {
        setImageAsyncCalls.push(base64);
      },
    },
    "expo-media-library": {
      requestPermissionsAsync: async () => {
        requestPermissionsCalls.push(true);
        return {
          granted: mediaPermissionGranted,
          status: mediaPermissionGranted ? "granted" : "denied",
        };
      },
      saveToLibraryAsync: async (uri) => {
        saveToLibraryCalls.push(uri);
      },
    },
    "expo-sharing": {
      isAvailableAsync: async () => sharingAvailable,
      shareAsync: async (uri) => {
        shareAsyncCalls.push(uri);
      },
    },
    "../context/AppContext": { useApp: () => app },
    "../services/api": { API_BASE: "http://test.invalid" },
    "../hooks/useMessages": {
      useMessages: () => ({
        messages: [],
        pinnedMessages: [],
        typingUser: null,
        sendMessage: async () => {},
        assertInteractionAllowed: () => {},
      }),
    },
    "../services/conversations": {
      conversationService: { uploadFile: async () => ({ url: "/x" }) },
    },
    "../utils/haptics.js": { lightTap() {}, selectionTap() {}, successTap() {} },
    "../services/notifications": {
      refreshMutedConversationsCache: () => {},
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
    shareCalls,
    shareAsyncCalls,
    downloadCalls,
    readAsStringCalls,
    setImageAsyncCalls,
    requestPermissionsCalls,
    saveToLibraryCalls,
    alerts,
  };
}

function selectMessage(fixture, tree, message) {
  const flatList = nodes(tree).find((n) => n.type === "FlatList");
  const bubbleEl = flatList.props.renderItem({ item: message });
  bubbleEl.props.onLongPress(message);
  return fixture.render();
}

const imageMessage = {
  id: "img1",
  message_type: "image",
  media_url: "/photo.jpg",
  sender_id: "peer",
};

const videoMessage = {
  id: "vid1",
  message_type: "video",
  media_url: "/clip.mp4",
  sender_id: "peer",
};

test("handleShareImage downloads then calls Sharing.shareAsync when sharing is available", async () => {
  const fixture = setupChatScreen({ sharingAvailable: true });
  let tree = fixture.render();
  tree = selectMessage(fixture, tree, imageMessage);
  const contextMenu = nodes(tree).find((n) => n.type === "ContextMenu");
  await contextMenu.props.onShareImage();
  await settle();
  assert.equal(fixture.downloadCalls.length, 1);
  assert.equal(fixture.downloadCalls[0].uri, "http://test.invalid/photo.jpg");
  assert.equal(fixture.shareAsyncCalls.length, 1);
  assert.equal(fixture.shareAsyncCalls[0], fixture.downloadCalls[0].fileUri);
  assert.equal(fixture.shareCalls.length, 0);
  fixture.runner.unmount();
});

test("handleShareImage falls back to Share.share({url}) on iOS when Sharing is unavailable", async () => {
  const fixture = setupChatScreen({
    platformOS: "ios",
    sharingAvailable: false,
  });
  let tree = fixture.render();
  tree = selectMessage(fixture, tree, imageMessage);
  const contextMenu = nodes(tree).find((n) => n.type === "ContextMenu");
  await contextMenu.props.onShareImage();
  await settle();
  assert.equal(fixture.downloadCalls.length, 1);
  assert.equal(fixture.shareAsyncCalls.length, 0);
  assert.equal(fixture.shareCalls.length, 1);
  assert.equal(fixture.shareCalls[0].url, "http://test.invalid/photo.jpg");
  assert.equal(fixture.shareCalls[0].message, undefined);
  fixture.runner.unmount();
});

test("handleShareImage falls back to Share.share({message}) on Android when Sharing is unavailable", async () => {
  const fixture = setupChatScreen({
    platformOS: "android",
    sharingAvailable: false,
  });
  let tree = fixture.render();
  tree = selectMessage(fixture, tree, imageMessage);
  const contextMenu = nodes(tree).find((n) => n.type === "ContextMenu");
  await contextMenu.props.onShareImage();
  await settle();
  assert.equal(fixture.shareCalls.length, 1);
  assert.equal(fixture.shareCalls[0].message, "http://test.invalid/photo.jpg");
  assert.equal(fixture.shareCalls[0].url, undefined);
  fixture.runner.unmount();
});

test("handleCopyImage downloads, reads base64 and calls Clipboard.setImageAsync with success feedback", async () => {
  const fixture = setupChatScreen();
  let tree = fixture.render();
  tree = selectMessage(fixture, tree, imageMessage);
  const contextMenu = nodes(tree).find((n) => n.type === "ContextMenu");
  await contextMenu.props.onCopyImage();
  await settle();
  assert.equal(fixture.downloadCalls.length, 1);
  assert.equal(fixture.readAsStringCalls.length, 1);
  assert.equal(fixture.readAsStringCalls[0].options.encoding, "base64");
  assert.equal(fixture.setImageAsyncCalls.length, 1);
  assert.equal(fixture.setImageAsyncCalls[0], "base64imagedata");
  assert.equal(fixture.alerts.length, 1);
  assert.equal(fixture.alerts[0][0], "Copied");
  fixture.runner.unmount();
});

test("handleCopyImage surfaces an error alert on failure without crashing", async () => {
  const fixture = setupChatScreen({ downloadShouldFail: true });
  let tree = fixture.render();
  tree = selectMessage(fixture, tree, imageMessage);
  const contextMenu = nodes(tree).find((n) => n.type === "ContextMenu");
  await assert.doesNotReject(contextMenu.props.onCopyImage());
  await settle();
  assert.equal(fixture.setImageAsyncCalls.length, 0);
  assert.equal(fixture.alerts.length, 1);
  assert.equal(fixture.alerts[0][0], "Error");
  fixture.runner.unmount();
});

test("handleSaveMedia shows an explanatory alert and does not download/save when permission is denied", async () => {
  const fixture = setupChatScreen({ mediaPermissionGranted: false });
  let tree = fixture.render();
  tree = selectMessage(fixture, tree, imageMessage);
  const contextMenu = nodes(tree).find((n) => n.type === "ContextMenu");
  await contextMenu.props.onSaveImage();
  await settle();
  assert.equal(fixture.requestPermissionsCalls.length, 1);
  assert.equal(fixture.downloadCalls.length, 0);
  assert.equal(fixture.saveToLibraryCalls.length, 0);
  assert.equal(fixture.alerts.length, 1);
  assert.equal(fixture.alerts[0][0], "Permission required");
  fixture.runner.unmount();
});

test("handleSaveMedia (Save Image) downloads and saves to the library on permission grant", async () => {
  const fixture = setupChatScreen({ mediaPermissionGranted: true });
  let tree = fixture.render();
  tree = selectMessage(fixture, tree, imageMessage);
  const contextMenu = nodes(tree).find((n) => n.type === "ContextMenu");
  await contextMenu.props.onSaveImage();
  await settle();
  assert.equal(fixture.downloadCalls.length, 1);
  assert.equal(fixture.saveToLibraryCalls.length, 1);
  assert.equal(fixture.saveToLibraryCalls[0], fixture.downloadCalls[0].fileUri);
  assert.equal(fixture.alerts.length, 1);
  assert.equal(fixture.alerts[0][0], "Saved");
  fixture.runner.unmount();
});

test("handleSaveMedia (Save Video) downloads and saves to the library on permission grant", async () => {
  const fixture = setupChatScreen({ mediaPermissionGranted: true });
  let tree = fixture.render();
  tree = selectMessage(fixture, tree, videoMessage);
  const contextMenu = nodes(tree).find((n) => n.type === "ContextMenu");
  await contextMenu.props.onSaveVideo();
  await settle();
  assert.equal(fixture.downloadCalls.length, 1);
  assert.equal(fixture.downloadCalls[0].uri, "http://test.invalid/clip.mp4");
  assert.equal(fixture.saveToLibraryCalls.length, 1);
  assert.equal(fixture.alerts.length, 1);
  assert.equal(fixture.alerts[0][0], "Saved");
  fixture.runner.unmount();
});

// --- MA02: failed-message recovery actions ----------------------------------

test("a failed message offers Retry Send, Copy Text and Discard only", () => {
  const { Menu } = setupContextMenu();
  let retried = 0;
  let discarded = 0;
  const tree = Menu({
    ...baseMenuProps,
    isOwn: true,
    onRetrySend: () => retried++,
    onDiscardFailed: () => discarded++,
    message: { message_type: "text", content: "hello", status: "failed" },
  });
  const labels = actionLabels(tree);
  assert.ok(labels.includes("Retry Send"));
  assert.ok(labels.includes("Discard"));
  assert.ok(labels.includes("Copy Text"));
  for (const absent of ["Reply", "Edit Message", "Pin Message", "Delete"]) {
    assert.ok(!labels.includes(absent), `${absent} should be hidden for failed`);
  }
  const press = (label) =>
    nodes(tree)
      .filter((n) => n.type === "TouchableOpacity")
      .find((n) =>
        nodes(n)
          .filter((c) => c.type === "Text")
          .flatMap((c) => c.props.children)
          .includes(label),
      )
      .props.onPress();
  press("Retry Send");
  press("Discard");
  assert.equal(retried, 1);
  assert.equal(discarded, 1);
});

test("a normal message does not show Retry Send or Discard", () => {
  const { Menu } = setupContextMenu();
  const labels = actionLabels(
    Menu({
      ...baseMenuProps,
      message: { message_type: "text", content: "hello", status: "sent" },
    }),
  );
  assert.ok(!labels.includes("Retry Send"));
  assert.ok(!labels.includes("Discard"));
});
