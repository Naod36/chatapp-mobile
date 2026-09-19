const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes, settle } = require("./helpers.cjs");

function setupChatScreen(storeInitial = {}, messages = []) {
  const runner = harness();
  const store = { ...storeInitial };
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
    Keyboard: { addListener: () => ({ remove() {} }), dismiss() {} },
    Share: { share: async () => {} },
  });
  const mocks = {
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "react-native": native,
    "react-native-svg": { __esModule: true, default: "Svg", Path: "Path" },
    "@react-native-async-storage/async-storage": {
      getItem: async (key) => (key in store ? store[key] : null),
      setItem: async (key, value) => {
        store[key] = value;
      },
      removeItem: async (key) => {
        delete store[key];
      },
    },
    "../context/AppContext": { useApp: () => app },
    "../services/api": { API_BASE: "http://test.invalid" },
    "../hooks/useMessages": {
      useMessages: () => ({
        messages,
        pinnedMessages: [],
        typingUser: null,
        sendMessage: async () => {},
        assertInteractionAllowed: () => {},
      }),
    },
    "../services/conversations": {
      conversationService: { uploadFile: async () => ({ url: "/x" }) },
    },
    "../utils/haptics.js": {
      lightTap() {},
      selectionTap() {},
      successTap() {},
    },
    "../services/notifications": {
      refreshMutedConversationsCache: () => {},
    },
    "expo-file-system/legacy": {
      cacheDirectory: "file://cache/",
      EncodingType: { Base64: "base64" },
      downloadAsync: async (uri, fileUri) => ({ uri: fileUri }),
      readAsStringAsync: async () => "base64",
    },
    "expo-clipboard": { setImageAsync: async () => {} },
    "expo-media-library": {
      requestPermissionsAsync: async () => ({ granted: true }),
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
  const input = (tree) => nodes(tree).find((n) => n.type === "MessageInput");
  const fireTimers = () => {
    for (const [id, timer] of [...runner.timers]) {
      runner.timers.delete(id);
      timer.callback();
    }
  };
  return { runner, render, input, store, fireTimers };
}

const DRAFT_KEY = "@flowchat_draft_me_chat";

test("search controls have independent 48px targets, cycle matches and preserve drafts", async () => {
  const fixture = setupChatScreen({ [DRAFT_KEY]: "keep me" }, [
    { id: "one", content: "hello first" },
    { id: "two", content: "hello second" },
  ]);
  fixture.render();
  await settle();
  nodes(fixture.render())
    .find((node) => node.type === "ChatHeader")
    .props.onSearchPress();
  const control = (label) =>
    nodes(fixture.render()).find(
      (node) => node.props.accessibilityLabel === label,
    );
  assert.equal(control("Next match").props.disabled, true);
  assert.equal(fixture.input(fixture.render()), undefined);
  assert.equal(
    nodes(fixture.render()).some((node) => node.type === "ChatHeader"),
    false,
  );
  control("Search messages").props.onChangeText("hello");
  for (const label of ["Previous match", "Next match", "Close search"]) {
    const style = control(label).props.style;
    const dimensions = Array.isArray(style) ? style[0] : style;
    assert.equal(dimensions.width, 48);
    assert.equal(dimensions.height, 48);
  }
  const counter = () =>
    nodes(fixture.render()).find(
      (node) => node.props.accessibilityLiveRegion === "polite",
    ).props.children[0];
  assert.equal(counter(), "1 of 2");
  const messageList = nodes(fixture.render()).find(
    (node) => node.type === "FlatList",
  );
  const scrolls = [];
  messageList.props.ref.current = {
    scrollToEnd() {},
    scrollToOffset: (options) => scrolls.push(["offset", options.offset]),
    scrollToIndex: (options) => scrolls.push(["index", options.index]),
  };
  messageList.props.onScrollToIndexFailed({ index: 1, averageItemLength: 80 });
  fixture.fireTimers();
  assert.deepEqual(scrolls, [
    ["offset", 80],
    ["index", 1],
  ]);
  control("Next match").props.onPress();
  assert.equal(counter(), "2 of 2");
  control("Next match").props.onPress();
  assert.equal(counter(), "1 of 2");
  control("Previous match").props.onPress();
  assert.equal(counter(), "2 of 2");
  control("Show as List").props.onPress();
  const results = nodes(fixture.render()).find(
    (node) => node.props.accessibilityLabel === "Search results",
  );
  assert.equal(results.props.data.length, 2);
  results.props
    .renderItem({ item: results.props.data[0], index: 0 })
    .props.onPress();
  assert.equal(counter(), "1 of 2");
  assert.equal(control("Search results"), undefined);
  control("Clear search").props.onPress();
  assert.equal(control("Search messages").props.value, "");
  assert.ok(control("Close search"));
  control("Search messages").props.onChangeText("missing");
  assert.equal(counter(), "No matches");
  assert.equal(control("Previous match").props.disabled, true);
  control("Close search").props.onPress();
  assert.equal(control("Next match"), undefined);
  assert.equal(fixture.input(fixture.render()).props.value, "keep me");
  fixture.runner.unmount();
});

test("typed text is saved as a per-conversation draft after the debounce", async () => {
  const fixture = setupChatScreen();
  let tree = fixture.render();
  await settle();
  fixture.input(tree).props.onChangeText("half-written thought");
  tree = fixture.render();
  fixture.fireTimers();
  await settle();
  assert.equal(fixture.store[DRAFT_KEY], "half-written thought");
  fixture.runner.unmount();
});

test("an existing draft is restored into the composer on open", async () => {
  const fixture = setupChatScreen({ [DRAFT_KEY]: "saved draft" });
  let tree = fixture.render();
  await settle();
  tree = fixture.render();
  assert.equal(fixture.input(tree).props.value, "saved draft");
  fixture.runner.unmount();
});

test("clearing the composer removes the stored draft", async () => {
  const fixture = setupChatScreen({ [DRAFT_KEY]: "old draft" });
  let tree = fixture.render();
  await settle();
  tree = fixture.render();
  fixture.input(tree).props.onChangeText("");
  fixture.render();
  fixture.fireTimers();
  await settle();
  assert.equal(fixture.store[DRAFT_KEY], undefined);
  fixture.runner.unmount();
});
