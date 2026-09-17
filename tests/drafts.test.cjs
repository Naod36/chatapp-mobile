const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes, settle } = require("./helpers.cjs");

function setupChatScreen(storeInitial = {}) {
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
    Keyboard: { addListener: () => ({ remove() {} }) },
    Share: { share: async () => {} },
  });
  const mocks = {
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
