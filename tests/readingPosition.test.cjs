const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes, settle } = require("./helpers.cjs");

function setupChatScreen() {
  const runner = harness();
  let currentMessages = [];
  let currentPinned = [];
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
    Platform: { OS: "android" },
    Alert: { alert: () => {} },
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
        messages: currentMessages,
        pinnedMessages: currentPinned,
        typingUser: null,
        sendMessage: async () => {},
        assertInteractionAllowed: () => {},
      }),
    },
    "../services/conversations": {
      conversationService: { uploadFile: async () => ({ url: "/x" }) },
    },
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
  const { default: Screen } = runner.load("src/screens/ChatScreen.js", mocks, {
    requestAnimationFrame: (cb) => cb(),
  });
  const render = () =>
    runner.render(() =>
      Screen({ route: { params: { conversation } }, navigation: {} }),
    );
  const scrollCalls = [];
  const attachFakeList = (tree) => {
    const list = nodes(tree).find((n) => n.type === "FlatList");
    if (list.props.ref && !list.props.ref.current) {
      list.props.ref.current = {
        scrollToEnd: (...args) => scrollCalls.push(args),
      };
    }
    return list;
  };
  const jumpPill = (tree) =>
    nodes(tree).find(
      (n) =>
        n.type === "TouchableOpacity" &&
        typeof n.props.accessibilityLabel === "string" &&
        n.props.accessibilityLabel.includes("new message"),
    );
  return {
    runner,
    render,
    attachFakeList,
    jumpPill,
    scrollCalls,
    setMessages: (msgs) => {
      currentMessages = msgs;
    },
    setPinned: (pins) => {
      currentPinned = pins;
    },
    scrollFarFromBottom: (list) =>
      list.props.onScroll({
        nativeEvent: {
          contentOffset: { y: 0 },
          contentSize: { height: 2000 },
          layoutMeasurement: { height: 400 },
        },
      }),
    scrollToBottomEvent: (list) =>
      list.props.onScroll({
        nativeEvent: {
          contentOffset: { y: 1600 },
          contentSize: { height: 2000 },
          layoutMeasurement: { height: 400 },
        },
      }),
  };
}

const msg = (id) => ({ id, sender_id: "peer", content: id });

test("first non-empty render performs an initial scroll to bottom", () => {
  const fixture = setupChatScreen();
  let tree = fixture.render();
  fixture.attachFakeList(tree);
  fixture.setMessages([msg("1"), msg("2")]);
  tree = fixture.render();
  assert.equal(fixture.scrollCalls.length, 1);
  fixture.runner.unmount();
});

test("near the bottom, a new incoming message auto-scrolls and shows no jump-to-latest pill", () => {
  const fixture = setupChatScreen();
  let tree = fixture.render();
  fixture.attachFakeList(tree);
  fixture.setMessages([msg("1")]);
  tree = fixture.render();
  const before = fixture.scrollCalls.length;

  fixture.setMessages([msg("1"), msg("2")]);
  tree = fixture.render();
  assert.equal(fixture.scrollCalls.length, before + 1);
  assert.equal(fixture.jumpPill(tree), undefined);
  fixture.runner.unmount();
});

test("scrolled up, a new incoming message does not auto-scroll and shows the jump-to-latest pill", () => {
  const fixture = setupChatScreen();
  let tree = fixture.render();
  fixture.attachFakeList(tree);
  fixture.setMessages([msg("1")]);
  tree = fixture.render();
  const list = fixture.attachFakeList(tree);
  fixture.scrollFarFromBottom(list);
  const before = fixture.scrollCalls.length;

  fixture.setMessages([msg("1"), msg("2")]);
  tree = fixture.render();
  tree = fixture.render();
  assert.equal(
    fixture.scrollCalls.length,
    before,
    "no forced scroll while reading history",
  );
  const pill = fixture.jumpPill(tree);
  assert.ok(pill, "expected a jump-to-latest pill");
  assert.match(pill.props.accessibilityLabel, /1 new message/);
  fixture.runner.unmount();
});

test("tapping jump-to-latest scrolls to bottom and clears the pill", () => {
  const fixture = setupChatScreen();
  let tree = fixture.render();
  fixture.attachFakeList(tree);
  fixture.setMessages([msg("1")]);
  tree = fixture.render();
  const list = fixture.attachFakeList(tree);
  fixture.scrollFarFromBottom(list);
  fixture.setMessages([msg("1"), msg("2"), msg("3")]);
  tree = fixture.render();
  tree = fixture.render();
  const before = fixture.scrollCalls.length;

  const pill = fixture.jumpPill(tree);
  pill.props.onPress();
  tree = fixture.render();
  assert.equal(fixture.scrollCalls.length, before + 1);
  assert.equal(fixture.jumpPill(tree), undefined);
  fixture.runner.unmount();
});

test("scrolling back to the bottom manually clears an accumulated unseen count", () => {
  const fixture = setupChatScreen();
  let tree = fixture.render();
  fixture.attachFakeList(tree);
  fixture.setMessages([msg("1")]);
  tree = fixture.render();
  let list = fixture.attachFakeList(tree);
  fixture.scrollFarFromBottom(list);
  fixture.setMessages([msg("1"), msg("2")]);
  tree = fixture.render();
  tree = fixture.render();
  assert.ok(fixture.jumpPill(tree));

  list = fixture.attachFakeList(tree);
  fixture.scrollToBottomEvent(list);
  tree = fixture.render();
  assert.equal(fixture.jumpPill(tree), undefined);
  fixture.runner.unmount();
});

test("edits/reactions with no new message ids do not increment the unseen count", () => {
  const fixture = setupChatScreen();
  let tree = fixture.render();
  fixture.attachFakeList(tree);
  fixture.setMessages([msg("1"), msg("2")]);
  tree = fixture.render();
  const list = fixture.attachFakeList(tree);
  fixture.scrollFarFromBottom(list);
  const before = fixture.scrollCalls.length;

  // Same ids, different content (e.g. a reaction/edit) — no new ids added.
  fixture.setMessages([{ ...msg("1"), content: "edited" }, msg("2")]);
  tree = fixture.render();
  assert.equal(fixture.scrollCalls.length, before);
  assert.equal(fixture.jumpPill(tree), undefined);
  fixture.runner.unmount();
});

test("an active pinned banner suppresses auto-scroll, matching prior behavior", () => {
  const fixture = setupChatScreen();
  let tree = fixture.render();
  fixture.attachFakeList(tree);
  fixture.setMessages([msg("1")]);
  fixture.setPinned([{ id: "p1", message_id: "1" }]);
  tree = fixture.render();
  const before = fixture.scrollCalls.length;

  fixture.setMessages([msg("1"), msg("2")]);
  tree = fixture.render();
  assert.equal(fixture.scrollCalls.length, before);
  fixture.runner.unmount();
});
