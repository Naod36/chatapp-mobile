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
  return module.exports.AccountPanel;
}

function setup({ getProfile, updateProfile } = {}) {
  const runner = harness();
  const updateCalls = [];
  const userService = {
    getProfile:
      getProfile || (async () => ({ display_name: "Ann", bio: "", is_public: true })),
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
    Alert: { alert: () => {} },
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
    PanResponder: { create: () => ({ panHandlers: {} }) },
    useWindowDimensions: () => ({ height: 800, width: 400 }),
  });
  const mocks = {
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
        unblockUser: async () => {},
        isBlockedBy: () => false,
        blockedUserIds: [],
        blockStateVersion: 1,
        blockStateReady: true,
        changeTheme: () => {},
      }),
    },
    "../hooks/useConversations": { useConversations: () => ({}) },
    "../components/conversations/ConversationHeader": {
      __esModule: true,
      default: "ConversationHeader",
    },
    "../components/conversations/ConversationFolders": {
      __esModule: true,
      default: "ConversationFolders",
      CONVERSATION_FOLDERS: [],
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
    "../components/common/ConfirmDialog": {
      __esModule: true,
      default: "ConfirmDialog",
    },
    "../services/conversations": {
      conversationService: { uploadFile: async () => ({ url: "/x" }) },
    },
    "../services/user": { userService },
    "../services/api": { API_BASE: "http://test.invalid" },
  };
  const AccountPanel = loadAccountPanel(runner, mocks);
  return { runner, AccountPanel, userService, updateCalls };
}

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
  return nodes(tree).find(
    (node) => node.props?.onPress?.name === "handleSave",
  );
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
