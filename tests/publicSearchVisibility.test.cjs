const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");
const { harness, nodes, settle } = require("./helpers.cjs");

// AccountPanel isn't exported directly by ConversationListScreen.js (only the
// screen default export is), so we transform the real source ourselves and
// tack on an extra `module.exports.AccountPanel = AccountPanel;` line to reach
// the unexported inner component, reusing the same mocking approach as
// helpers.cjs's `load()`.
function loadAccountPanel(runner, mocks) {
  const filename = path.resolve(
    __dirname,
    "../src/screens/ConversationListScreen.js",
  );
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename,
    configFile: false,
    babelrc: false,
    plugins: [
      require.resolve("@babel/plugin-transform-modules-commonjs"),
      require.resolve("@babel/plugin-transform-react-jsx"),
    ],
  });
  const module = { exports: {} };
  vm.runInNewContext(
    `${code}\nmodule.exports.AccountPanel = AccountPanel;`,
    {
      module,
      exports: module.exports,
      console,
      AbortController,
      Date,
      FormData,
      setTimeout: () => 0,
      clearTimeout() {},
      setInterval: () => 0,
      clearInterval() {},
      require: (name) => {
        if (name === "react") return runner.react;
        if (name in mocks) return mocks[name];
        if (name.startsWith("."))
          return require(path.resolve(path.dirname(filename), name));
        throw new Error(`Unmocked dependency: ${name}`);
      },
    },
    { filename },
  );
  return module.exports;
}

function setup({
  getProfile,
  updateProfile,
  openSavedMessages,
  biometricSupported = false,
} = {}) {
  const runner = harness();
  const updateCalls = [];
  const alerts = [];
  const userService = {
    getProfile:
      getProfile ||
      (async () => ({ display_name: "Ann", bio: "", is_public: true })),
    updateProfile:
      updateProfile ||
      (async (data) => {
        updateCalls.push(data);
        return data;
      }),
    getBlockedUsers: async () => [],
    updateNotificationPreference: async () => {},
    changePassword: async () => {},
    requestEmailChange: async () => {},
    deleteAccount: async () => {},
  };
  const native = Object.fromEntries(
    [
      "View",
      "Text",
      "TextInput",
      "FlatList",
      "RefreshControl",
      "TouchableOpacity",
      "Modal",
      "ScrollView",
      "ActivityIndicator",
      "KeyboardAvoidingView",
      "Switch",
    ].map((name) => [name, name]),
  );
  Object.assign(native, {
    StyleSheet: { create: (styles) => styles },
    Alert: { alert: (...args) => alerts.push(args) },
    Platform: { OS: "ios" },
    Animated: {
      View: "AnimatedView",
      Value: function (value) {
        this.value = value;
        this.setValue = () => {};
      },
      timing: () => ({ start: (cb) => cb && cb() }),
      spring: () => ({ start: (cb) => cb && cb() }),
    },
    PanResponder: {
      create: (handlers) => ({ panHandlers: { testPanHandlers: handlers } }),
    },
    useWindowDimensions: () => ({ height: 800, width: 400 }),
  });
  const mocks = {
    "../services/notices": { alert: (...args) => alerts.push(args) },
    "react-native": native,
    "@react-native-async-storage/async-storage": { getItem: async () => null },
    "@react-navigation/native": { useFocusEffect: () => {} },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    },
    "expo-blur": { BlurView: "BlurView" },
    "react-native-svg": {
      __esModule: true,
      default: "Svg",
      Path: "Path",
      Circle: "Circle",
    },
    "expo-constants": {},
    "expo-application": {},
    "expo-updates": {},
    "expo-image-picker": {
      requestMediaLibraryPermissionsAsync: async () => ({ status: "granted" }),
      launchImageLibraryAsync: async () => ({ canceled: true }),
    },
    "../context/AppContext": {
      useApp: () => ({
        theme: {},
        unblockUser: async () => {},
        isBlockedBy: () => false,
        blockedUserIds: [],
        blockStateVersion: 1,
        blockStateReady: true,
        changeTheme: () => {},
      }),
    },
    "../hooks/useConversations": {
      useConversations: () => ({
        conversations: [],
        searchQuery: "",
        openSavedMessages,
        openingSavedMessages: false,
      }),
    },
    "../components/conversations/ConversationHeader": {
      __esModule: true,
      default: "ConversationHeader",
    },
    "../components/conversations/ConversationFolders": {
      __esModule: true,
      default: "ConversationFolders",
      CONVERSATION_FOLDERS: ["all", "unread", "chats", "groups"].map((id) => ({
        id,
      })),
      conversationsInFolder: () => [],
    },
    "../components/conversations/ConversationItem": {
      __esModule: true,
      default: "ConversationItem",
    },
    "../components/conversations/EmptyState": {
      __esModule: true,
      default: "EmptyState",
    },
    "../components/common/Avatar": { __esModule: true, default: "Avatar" },
    "../components/common/PresenceSettings": {
      __esModule: true,
      default: "PresenceSettings",
    },
    "../components/common/ConfirmDialog": {
      __esModule: true,
      default: "ConfirmDialog",
    },
    "../services/conversations": {
      conversationService: { uploadFile: async () => ({ url: "/x" }) },
    },
    "../services/user": { userService },
    "../services/api": { API_BASE: "http://test.invalid" },
    "../components/common/BiometricLock.js": {
      isBiometricAvailable: async () => biometricSupported,
      isBiometricLockEnabled: async () => false,
      setBiometricLockEnabled: async () => {},
      authenticate: async () => ({ success: true }),
    },
  };
  const { AccountPanel, default: Screen } = loadAccountPanel(runner, mocks);
  return { runner, AccountPanel, Screen, userService, updateCalls, alerts };
}

test("biometric settings stack readable text beside a reserved switch", async () => {
  const { runner, AccountPanel } = setup({ biometricSupported: true });
  const render = () =>
    runner.render(() => AccountPanel({ visible: true, theme: {}, user: {} }));
  render();
  await settle();
  const tree = render();
  const row = nodes(tree).find(
    (node) =>
      node.type === "View" &&
      node.props.children.some(
        (child) => child?.props?.accessibilityLabel === "Biometric Lock",
      ),
  );
  assert.ok(row);
  const column = row.props.children[0];
  assert.equal(column.props.style.flexDirection, "column");
  assert.equal(column.props.style.flex, 1);
  assert.equal(column.props.style.minWidth, 0);
  assert.equal(row.props.style.gap, 12);
  const titleStyle = Object.assign({}, ...column.props.children[0].props.style);
  assert.equal(titleStyle.fontSize, 16);
  assert.equal(titleStyle.fontWeight, "400");
});

test("Saved Messages shortcut is available during profile loading and exposes busy state", () => {
  const { runner, AccountPanel } = setup({
    getProfile: () => new Promise(() => {}),
  });
  let presses = 0;
  const props = {
    onSavedMessages: () => {
      presses++;
    },
    openingSavedMessages: false,
  };
  const button = () =>
    nodes(renderPanel(runner, AccountPanel, props)).find(
      (node) => node.props.accessibilityLabel === "Saved Messages",
    );
  assert.ok(button());
  button().props.onPress();
  assert.equal(presses, 1);
  props.openingSavedMessages = true;
  assert.equal(button().props.disabled, true);
  assert.equal(button().props.accessibilityState.busy, true);
  runner.unmount();
});

test("Saved Messages closes account menu and navigates only after successful opening", async () => {
  const conversation = { id: "self", type: "direct", other_participant: null };
  let complete;
  const { runner, AccountPanel, Screen } = setup({
    openSavedMessages: () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  });
  const navigations = [];
  const render = () =>
    runner.render(() =>
      Screen({
        navigation: {
          navigate: (...args) => navigations.push(args),
        },
      }),
    );
  const panel = () =>
    nodes(render()).find((node) => node.type === AccountPanel);
  nodes(render())
    .find((node) => node.type === "ConversationHeader")
    .props.onAccountPress();
  const opening = panel().props.onSavedMessages();
  assert.equal(panel().props.visible, true);
  assert.equal(navigations.length, 0);
  complete(conversation);
  await opening;
  assert.equal(panel().props.visible, false);
  assert.equal(navigations[0][0], "Chat");
  assert.equal(navigations[0][1].conversation, conversation);
  runner.unmount();
});

test("Saved Messages failure keeps account menu open for retry", async () => {
  const { runner, AccountPanel, Screen, alerts } = setup({
    openSavedMessages: async () => {
      throw new Error("Offline");
    },
  });
  const render = () =>
    runner.render(() =>
      Screen({
        navigation: {
          navigate: () => assert.fail("Must not navigate on failure"),
        },
      }),
    );
  nodes(render())
    .find((node) => node.type === "ConversationHeader")
    .props.onAccountPress();
  await nodes(render())
    .find((node) => node.type === AccountPanel)
    .props.onSavedMessages();
  assert.equal(
    nodes(render()).find((node) => node.type === AccountPanel).props.visible,
    true,
  );
  assert.deepEqual(alerts, [["Saved Messages", "Offline"]]);
  runner.unmount();
});

test("list swipes and tab taps share selection and account panel disables paging", () => {
  const { runner, Screen } = setup();
  const render = () => runner.render(() => Screen({ navigation: {} }));
  const folders = () =>
    nodes(render()).find((node) => node.type === "ConversationFolders");
  const handlers = () =>
    nodes(render()).find((node) => node.props.testPanHandlers)?.props
      .testPanHandlers;
  const left = { dx: -80, dy: 4, numberActiveTouches: 1 };
  assert.equal(folders().props.selectedId, "all");
  assert.equal(handlers().onMoveShouldSetPanResponderCapture(null, left), true);
  handlers().onPanResponderRelease(null, left);
  assert.equal(folders().props.selectedId, "unread");
  folders().props.onSelect("groups");
  handlers().onPanResponderRelease(null, left);
  assert.equal(folders().props.selectedId, "groups");
  nodes(render())
    .find((node) => node.type === "ConversationHeader")
    .props.onAccountPress();
  assert.equal(
    handlers().onMoveShouldSetPanResponderCapture(null, left),
    false,
  );
  runner.unmount();
});

function renderPanel(runner, AccountPanel, props) {
  return runner.render(() =>
    AccountPanel({ visible: true, onClose() {}, theme: {}, ...props }),
  );
}

function findToggle(tree) {
  return nodes(tree).find(
    (node) => node.props?.accessibilityLabel === "Public Search Visibility",
  );
}

function findSave(tree) {
  return nodes(tree).find((node) => node.props?.onPress?.name === "handleSave");
}

test("toggle reflects the profile's is_public value, defaulting to visible when undefined", async () => {
  for (const [is_public, expected] of [
    [true, true],
    [false, false],
    [undefined, true],
  ]) {
    const { runner, AccountPanel } = setup({
      getProfile: async () => ({
        display_name: "Ann",
        bio: "",
        ...(is_public === undefined ? {} : { is_public }),
      }),
    });
    renderPanel(runner, AccountPanel);
    await settle();
    const tree = renderPanel(runner, AccountPanel);
    const toggle = findToggle(tree);
    assert.ok(toggle, "toggle should render");
    assert.equal(toggle.props.value, expected);
    assert.equal(toggle.props.accessibilityRole, "switch");
    assert.equal(toggle.props.accessibilityState.checked, expected);
    runner.unmount();
  }
});

test("toggling and saving calls updateProfile with the new is_public value", async () => {
  const { runner, AccountPanel, updateCalls } = setup();
  renderPanel(runner, AccountPanel);
  await settle();
  let tree = renderPanel(runner, AccountPanel);
  assert.equal(findToggle(tree).props.value, true);

  findToggle(tree).props.onValueChange(false);
  tree = renderPanel(runner, AccountPanel);
  assert.equal(findToggle(tree).props.value, false);
  assert.equal(findToggle(tree).props.accessibilityState.checked, false);

  const save = findSave(tree);
  assert.ok(save, "save action should be discoverable");
  await save.props.onPress();

  assert.equal(updateCalls.length, 1);
  assert.equal(updateCalls[0].is_public, false);
  runner.unmount();
});

test("a failed save surfaces the error without throwing and keeps the toggled value", async () => {
  const { runner, AccountPanel } = setup({
    updateProfile: async () => {
      throw new Error("network down");
    },
  });
  renderPanel(runner, AccountPanel);
  await settle();
  let tree = renderPanel(runner, AccountPanel);
  findToggle(tree).props.onValueChange(false);
  tree = renderPanel(runner, AccountPanel);

  const save = findSave(tree);
  await assert.doesNotReject(save.props.onPress());

  tree = renderPanel(runner, AccountPanel);
  const errorNode = nodes(tree).find(
    (node) =>
      node.type === "Text" &&
      node.props.children.some(
        (child) => typeof child === "string" && child.includes("network down"),
      ),
  );
  assert.ok(errorNode, "error message should render");
  assert.equal(findToggle(tree).props.value, false);
  assert.equal(findToggle(tree).props.accessibilityState.checked, false);
  runner.unmount();
});
