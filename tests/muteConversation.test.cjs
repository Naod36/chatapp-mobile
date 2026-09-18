const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes, settle } = require("./helpers.cjs");

const MUTE_KEY = "@flowchat_muted_conversations";

function makeAsyncStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: async (key) => (store.has(key) ? store.get(key) : null),
    setItem: async (key, value) => {
      store.set(key, value);
    },
    _store: store,
  };
}

// ─── (a) ChatScreen's mute toggle persists/removes the conversation id ──────

function setupChatScreen({ mutedIds = [] } = {}) {
  const runner = harness();
  const asyncStorage = makeAsyncStorage({
    [MUTE_KEY]: JSON.stringify(mutedIds),
  });
  let refreshCalls = 0;
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
    Platform: { OS: "android" },
    Alert: { alert: () => {} },
    Clipboard: { setString() {} },
    Keyboard: { addListener: () => ({ remove() {} }) },
    Share: { share: async () => {} },
  });
  const mocks = {
    "react-native": native,
    "react-native-svg": { __esModule: true, default: "Svg", Path: "Path" },
    "@react-native-async-storage/async-storage": asyncStorage,
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
      refreshMutedConversationsCache: () => {
        refreshCalls++;
      },
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
    asyncStorage,
    getRefreshCalls: () => refreshCalls,
  };
}

test("toggling mute persists the conversation id, toggling again removes it", async () => {
  const fixture = setupChatScreen();
  let tree = fixture.render();
  await settle();
  tree = fixture.render();
  const menu = () => nodes(tree).find((n) => n.type === "ChatOptionsMenu");

  assert.equal(menu().props.isMuted, false);
  await menu().props.onToggleMute();
  tree = fixture.render();
  assert.deepEqual(JSON.parse(fixture.asyncStorage._store.get(MUTE_KEY)), [
    "chat1",
  ]);
  assert.equal(menu().props.isMuted, true);
  assert.equal(fixture.getRefreshCalls(), 1);

  await menu().props.onToggleMute();
  tree = fixture.render();
  assert.deepEqual(JSON.parse(fixture.asyncStorage._store.get(MUTE_KEY)), []);
  assert.equal(menu().props.isMuted, false);
  assert.equal(fixture.getRefreshCalls(), 2);
  fixture.runner.unmount();
});

test("mute state is loaded from storage on mount", async () => {
  const fixture = setupChatScreen({ mutedIds: ["chat1"] });
  let tree = fixture.render();
  await settle();
  tree = fixture.render();
  const menu = nodes(tree).find((n) => n.type === "ChatOptionsMenu");
  assert.equal(menu.props.isMuted, true);
  fixture.runner.unmount();
});

// ─── (b) ChatOptionsMenu row label + callback ───────────────────────────────

function setupChatOptionsMenu() {
  const runner = harness();
  const mocks = {
    "react-native": {
      View: "View",
      Text: "Text",
      TouchableOpacity: "TouchableOpacity",
      StyleSheet: { create: (s) => s },
      Modal: "Modal",
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    },
  };
  const { default: Menu } = runner.load(
    "src/components/chat/ChatOptionsMenu.js",
    mocks,
  );
  return { Menu };
}

test("ChatOptionsMenu shows Mute Chat when unmuted and calls onToggleMute", () => {
  const { Menu } = setupChatOptionsMenu();
  let toggled = 0;
  const tree = Menu({
    visible: true,
    theme: {
      cardBg: "#fff",
      borderColor: "#ccc",
      text: "#000",
      danger: "#f00",
    },
    isMuted: false,
    onToggleMute: () => toggled++,
    onClose: () => {},
    isPinned: false,
    onTogglePin: () => {},
    isBlocked: false,
    onToggleBlock: () => {},
    canBlock: true,
  });
  const texts = nodes(tree)
    .filter((n) => n.type === "Text")
    .flatMap((n) => n.props.children);
  assert.ok(texts.includes("Mute Chat"));
  assert.ok(!texts.includes("Unmute Chat"));
  const row = nodes(tree).find(
    (n) => n.props.accessibilityLabel === "Mute chat",
  );
  row.props.onPress();
  assert.equal(toggled, 1);
});

test("ChatOptionsMenu shows Unmute Chat when muted and calls onToggleMute", () => {
  const { Menu } = setupChatOptionsMenu();
  let toggled = 0;
  const tree = Menu({
    visible: true,
    theme: {
      cardBg: "#fff",
      borderColor: "#ccc",
      text: "#000",
      danger: "#f00",
    },
    isMuted: true,
    onToggleMute: () => toggled++,
    onClose: () => {},
    isPinned: false,
    onTogglePin: () => {},
    isBlocked: false,
    onToggleBlock: () => {},
    canBlock: true,
  });
  const texts = nodes(tree)
    .filter((n) => n.type === "Text")
    .flatMap((n) => n.props.children);
  assert.ok(texts.includes("Unmute Chat"));
  assert.ok(!texts.includes("Mute Chat"));
  const row = nodes(tree).find(
    (n) => n.props.accessibilityLabel === "Unmute chat",
  );
  row.props.onPress();
  assert.equal(toggled, 1);
});

// ─── (c) ConversationItem muted indicator ───────────────────────────────────

function setupConversationItem() {
  const runner = harness();
  const state = {
    theme: { accent: "#6366f1", textMuted: "#888" },
    user: { userId: "me" },
    blockStateReady: true,
    blockedByUserIds: [],
    isBlockedBy: () => false,
    getBlockPolicy: () => ({ preventDirectInteraction: false }),
    getPresence: () => "offline",
  };
  const mocks = {
    "react-native": {
      View: "View",
      Text: "Text",
      Image: "Image",
      TouchableOpacity: "TouchableOpacity",
      StyleSheet: { create: (styles) => styles },
    },
    "react-native-svg": { __esModule: true, default: "Svg", Path: "Path" },
    "../common/Avatar": { __esModule: true, default: "Avatar" },
    "../common/MessageStatusIcon": { __esModule: true, default: "Receipt" },
    "../../context/AppContext": { useApp: () => state },
  };
  const { default: Item } = runner.load(
    "src/components/conversations/ConversationItem.js",
    mocks,
  );
  return { Item };
}

test("ConversationItem shows a muted indicator only when muted", () => {
  const { Item } = setupConversationItem();
  const muted = Item({
    conversation: { id: "a", type: "group" },
    isMuted: true,
  });
  assert.ok(
    nodes(muted).some((n) => n.props.accessibilityLabel === "Muted chat"),
  );
  const unmuted = Item({
    conversation: { id: "a", type: "group" },
    isMuted: false,
  });
  assert.equal(
    nodes(unmuted).some((n) => n.props.accessibilityLabel === "Muted chat"),
    false,
  );
  const defaulted = Item({ conversation: { id: "a", type: "group" } });
  assert.equal(
    nodes(defaulted).some((n) => n.props.accessibilityLabel === "Muted chat"),
    false,
  );
});

// ─── (d) notification suppression for muted conversations ──────────────────

function setupNotifications(mutedIds = []) {
  const runner = harness();
  let handlerConfig;
  const mocks = {
    "react-native": { Platform: { OS: "android" } },
    "expo-notifications": {
      setNotificationHandler: (config) => {
        handlerConfig = config;
      },
      setNotificationCategoryAsync: async () => {},
      setNotificationChannelAsync: async () => {},
      getPermissionsAsync: async () => ({ status: "granted" }),
      requestPermissionsAsync: async () => ({ status: "granted" }),
      getExpoPushTokenAsync: async () => ({ data: "token" }),
      AndroidImportance: { MAX: 5 },
    },
    "expo-device": { isDevice: true },
    "expo-constants": { easConfig: {}, expoConfig: { extra: { eas: {} } } },
    "@react-native-async-storage/async-storage": {
      getItem: async (key) =>
        key === MUTE_KEY ? JSON.stringify(mutedIds) : null,
    },
    "./api": { apiFetch: async () => {} },
  };
  const mod = runner.load("src/services/notifications.js", mocks);
  return { mod, getHandlerConfig: () => handlerConfig };
}

test("notification handling skips alert/sound for a muted conversation but shows it for others", async () => {
  const { mod, getHandlerConfig } = setupNotifications(["muted-convo"]);
  await mod.refreshMutedConversationsCache();
  const config = getHandlerConfig();

  const mutedResult = await config.handleNotification({
    request: { content: { data: { conversation_id: "muted-convo" } } },
  });
  assert.equal(mutedResult.shouldShowAlert, false);
  assert.equal(mutedResult.shouldPlaySound, false);
  assert.equal(mutedResult.shouldShowBanner, false);
  assert.equal(mutedResult.shouldShowList, false);

  const activeResult = await config.handleNotification({
    request: { content: { data: { conversation_id: "other-convo" } } },
  });
  assert.equal(activeResult.shouldShowAlert, true);
  assert.equal(activeResult.shouldPlaySound, true);
});

test("isConversationMuted reflects the refreshed cache", async () => {
  const { mod } = setupNotifications(["a", "b"]);
  assert.equal(mod.isConversationMuted("a"), false); // not refreshed yet
  await mod.refreshMutedConversationsCache();
  assert.equal(mod.isConversationMuted("a"), true);
  assert.equal(mod.isConversationMuted("b"), true);
  assert.equal(mod.isConversationMuted("z"), false);
});
