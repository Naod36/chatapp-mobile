const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes, settle } = require("./helpers.cjs");
const { blockPolicy } = require("../src/utils/blockPolicy");

function baseConversation() {
  return {
    id: "group1",
    conversation_id: "group1",
    type: "group",
    title: "Old Title",
    avatar_url: null,
    creator_id: "creator1",
    participants: [
      {
        user_id: "creator1",
        username: "creator1",
        display_name: "Creator One",
        role: "member",
      },
      {
        user_id: "admin1",
        username: "admin1",
        display_name: "Admin One",
        role: "admin",
      },
      {
        user_id: "admin2",
        username: "admin2",
        display_name: "Admin Two",
        role: "admin",
      },
      {
        user_id: "member1",
        username: "member1",
        display_name: "Member One",
        role: "member",
      },
      { user_id: "me", username: "me", display_name: "Me", role: "member" },
    ],
  };
}

class FakeFormData {
  constructor() {
    this.entries = [];
  }
  append(key, value) {
    this.entries.push([key, value]);
  }
}

function setup({
  viewerId = "me",
  blockedIds = [],
  blockedByIds = [],
  searchUsers = async () => [],
  pickerAsset = null,
} = {}) {
  const runner = harness();
  const sent = [];
  const updateCalls = [];
  const conv = baseConversation();

  const appState = {
    theme: {
      bg: "#fff",
      headerBg: "#fff",
      borderColor: "#ccc",
      text: "#000",
      textMuted: "#888",
      accent: "#6366f1",
      inputBg: "#eee",
      cardBg: "#fff",
    },
    user: { userId: viewerId, user_id: viewerId },
    conversations: [conv],
    setConversations(updater) {
      appState.conversations =
        typeof updater === "function" ? updater(appState.conversations) : updater;
    },
    isBlocked: (id) => blockedIds.includes(String(id)),
    isBlockedBy: (id) => blockedByIds.includes(String(id)),
    getBlockPolicy: (id) => blockPolicy(String(id), blockedIds, blockedByIds),
    blockStateReady: true,
    blockStateVersion: 0,
  };

  const mocks = {
    "react-native": {
      View: "View",
      Text: "Text",
      TextInput: "TextInput",
      ScrollView: "ScrollView",
      TouchableOpacity: "TouchableOpacity",
      TouchableWithoutFeedback: "TouchableWithoutFeedback",
      StyleSheet: { create: (s) => s, hairlineWidth: 1 },
      ActivityIndicator: "ActivityIndicator",
      Alert: { alert: () => {} },
      Modal: "Modal",
      Platform: { OS: "ios" },
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    },
    "expo-image-picker": {
      requestMediaLibraryPermissionsAsync: async () => ({ status: "granted" }),
      launchImageLibraryAsync: async () =>
        pickerAsset ? { canceled: false, assets: [pickerAsset] } : { canceled: true },
    },
    "react-native-svg": { __esModule: true, default: "Svg", Path: "Path" },
    "../context/AppContext": { useApp: () => appState },
    "../components/common/Avatar": { __esModule: true, default: "Avatar" },
    "../services/conversations": {
      conversationService: {
        updateGroup: async (id, data) => {
          updateCalls.push({ id, data });
          return { ...conv, ...data };
        },
        uploadFile: async () => ({ url: "/uploaded-group.jpg" }),
      },
    },
    "../services/user": {
      userService: { searchUsers },
    },
    "../services/websocket": {
      websocketService: {
        send: (message) => {
          sent.push(message);
          return true;
        },
      },
    },
  };

  const { default: GroupInfoScreen } = runner.load(
    "src/screens/GroupInfoScreen.js",
    mocks,
    { FormData: FakeFormData },
  );

  const navigation = { goBack: () => {}, navigate: () => {} };
  const route = { params: { conversation: conv } };
  const render = () => runner.render(() => GroupInfoScreen({ route, navigation }));

  return { runner, appState, sent, updateCalls, render, conv };
}

// ─── (a) Only admins/creator see promote/demote controls ────────────────────

test("a non-admin member sees no manage controls on other members", () => {
  const { render } = setup({ viewerId: "member1" });
  const tree = render();
  const manageButtons = nodes(tree).filter(
    (node) =>
      typeof node.props?.accessibilityLabel === "string" &&
      node.props.accessibilityLabel.startsWith("Manage "),
  );
  assert.equal(manageButtons.length, 0);
});

test("an admin viewer sees manage controls only for non-creator, non-self members", () => {
  const { render } = setup({ viewerId: "admin1" });
  const tree = render();
  const manageLabels = nodes(tree)
    .filter(
      (node) =>
        typeof node.props?.accessibilityLabel === "string" &&
        node.props.accessibilityLabel.startsWith("Manage "),
    )
    .map((node) => node.props.accessibilityLabel);
  assert.deepEqual(manageLabels, ["Manage Admin Two", "Manage Member One", "Manage Me"]);
});

test("the creator (even without role=admin) sees manage controls", () => {
  const { render } = setup({ viewerId: "creator1" });
  const tree = render();
  const manageLabels = nodes(tree)
    .filter(
      (node) =>
        typeof node.props?.accessibilityLabel === "string" &&
        node.props.accessibilityLabel.startsWith("Manage "),
    )
    .map((node) => node.props.accessibilityLabel);
  assert.deepEqual(manageLabels, [
    "Manage Admin One",
    "Manage Admin Two",
    "Manage Member One",
    "Manage Me",
  ]);
});

// ─── (b) Promote/demote sends the right action + updates state ──────────────

test("tapping a member opens the action sheet, and 'Make Admin' sends update_group_admin(true)", () => {
  const { render, sent, appState } = setup({ viewerId: "admin1" });
  let tree = render();
  const manageRow = nodes(tree).find(
    (node) => node.props?.accessibilityLabel === "Manage Member One",
  );
  assert.ok(manageRow);
  manageRow.props.onPress();

  tree = render();
  const makeAdminBtn = nodes(tree).find(
    (node) => node.props?.accessibilityLabel === "Make Admin",
  );
  assert.ok(makeAdminBtn);
  makeAdminBtn.props.onPress();

  const message = sent[sent.length - 1];
  assert.equal(message.action, "update_group_admin");
  assert.equal(message.conversation_id, "group1");
  assert.equal(message.target_user_id, "member1");
  assert.equal(message.is_admin, true);
  const updated = appState.conversations[0].participants.find(
    (p) => p.user_id === "member1",
  );
  assert.equal(updated.role, "admin");
});

test("'Dismiss as Admin' sends update_group_admin(false) for an existing admin", () => {
  const { render, sent, appState } = setup({ viewerId: "admin1" });
  let tree = render();
  const manageRow = nodes(tree).find(
    (node) => node.props?.accessibilityLabel === "Manage Admin Two",
  );
  manageRow.props.onPress();

  tree = render();
  const dismissBtn = nodes(tree).find(
    (node) => node.props?.accessibilityLabel === "Dismiss as Admin",
  );
  assert.ok(dismissBtn);
  dismissBtn.props.onPress();

  const message = sent[sent.length - 1];
  assert.equal(message.action, "update_group_admin");
  assert.equal(message.conversation_id, "group1");
  assert.equal(message.target_user_id, "admin2");
  assert.equal(message.is_admin, false);
  const updated = appState.conversations[0].participants.find(
    (p) => p.user_id === "admin2",
  );
  assert.equal(updated.role, "member");
});

// ─── (c) Add-member search filters existing participants + blocked users ────

test("add-member search excludes existing participants and blocked/blocked-by users", async () => {
  const searchUsers = async () => [
    { user_id: "member1", username: "member1", display_name: "Member One" }, // already in group
    { user_id: "blockeduser", username: "blockeduser", display_name: "Blocked User" },
    { user_id: "blockedbyuser", username: "blockedbyuser", display_name: "Blocked By User" },
    { user_id: "newuser", username: "newuser", display_name: "New User" },
  ];
  const { runner, render } = setup({
    viewerId: "admin1",
    blockedIds: ["blockeduser"],
    blockedByIds: ["blockedbyuser"],
    searchUsers,
  });

  let tree = render();
  const addMemberBtn = nodes(tree).find(
    (node) => node.props?.accessibilityLabel === "Add member",
  );
  assert.ok(addMemberBtn);
  addMemberBtn.props.onPress();

  tree = render();
  const searchInput = nodes(tree).find(
    (node) => node.props?.accessibilityLabel === "Search users to add",
  );
  assert.ok(searchInput);
  searchInput.props.onChangeText("new");

  tree = render();
  const timer = [...runner.timers.values()].find((entry) => entry.delay === 350);
  assert.ok(timer);
  await timer.callback();
  await settle();

  tree = render();
  const addRowLabels = nodes(tree)
    .filter(
      (node) =>
        typeof node.props?.accessibilityLabel === "string" &&
        node.props.accessibilityLabel.startsWith("Add ") &&
        node.props.accessibilityLabel !== "Add member",
    )
    .map((node) => node.props.accessibilityLabel);
  assert.deepEqual(addRowLabels, ["Add New User"]);
});

test("selecting a search result sends add_group_member and optimistically adds the participant", async () => {
  const searchUsers = async () => [
    { user_id: "newuser", username: "newuser", display_name: "New User" },
  ];
  const { runner, render, sent, appState } = setup({
    viewerId: "admin1",
    searchUsers,
  });

  let tree = render();
  nodes(tree)
    .find((node) => node.props?.accessibilityLabel === "Add member")
    .props.onPress();
  tree = render();
  nodes(tree)
    .find((node) => node.props?.accessibilityLabel === "Search users to add")
    .props.onChangeText("new");
  tree = render();
  const timer = [...runner.timers.values()].find((entry) => entry.delay === 350);
  await timer.callback();
  await settle();
  tree = render();

  const addRow = nodes(tree).find(
    (node) => node.props?.accessibilityLabel === "Add New User",
  );
  assert.ok(addRow);
  addRow.props.onPress();

  const message = sent[sent.length - 1];
  assert.equal(message.action, "add_group_member");
  assert.equal(message.conversation_id, "group1");
  assert.equal(message.target_user_id, "newuser");
  const added = appState.conversations[0].participants.find(
    (p) => p.user_id === "newuser",
  );
  assert.ok(added);
  assert.equal(added.role, "member");
});

// ─── (d) Editing title/avatar calls the update path correctly ───────────────

test("admin can edit and save the group title via the REST update path", async () => {
  const { render, sent, updateCalls, appState } = setup({ viewerId: "admin1" });
  let tree = render();
  const titleInput = nodes(tree).find(
    (node) => node.props?.accessibilityLabel === "Group title",
  );
  assert.ok(titleInput);
  titleInput.props.onChangeText("New Title");

  tree = render();
  const saveBtn = nodes(tree).find(
    (node) => node.props?.accessibilityLabel === "Save group title",
  );
  assert.ok(saveBtn);
  await saveBtn.props.onPress();

  const call = updateCalls[updateCalls.length - 1];
  assert.equal(call.id, "group1");
  assert.equal(call.data.title, "New Title");
  const message = sent[sent.length - 1];
  assert.equal(message.action, "update_group");
  assert.equal(message.conversation_id, "group1");
  assert.equal(message.title, "New Title");
  assert.equal(message.avatar_url, null);
  assert.equal(appState.conversations[0].title, "New Title");
});

test("the Save button is hidden until the title actually changes", () => {
  const { render } = setup({ viewerId: "admin1" });
  const tree = render();
  const saveBtn = nodes(tree).find(
    (node) => node.props?.accessibilityLabel === "Save group title",
  );
  assert.equal(saveBtn, undefined);
});

test("admin can change the group avatar, which uploads and calls updateGroup", async () => {
  const { render, sent, updateCalls, appState } = setup({
    viewerId: "admin1",
    pickerAsset: { uri: "file:///pic.jpg", fileName: "pic.jpg", mimeType: "image/jpeg" },
  });
  let tree = render();
  const avatarBtn = nodes(tree).find(
    (node) => node.props?.accessibilityLabel === "Change group photo",
  );
  assert.ok(avatarBtn);
  await avatarBtn.props.onPress();

  const call = updateCalls[updateCalls.length - 1];
  assert.equal(call.id, "group1");
  assert.equal(call.data.title, "Old Title");
  assert.equal(call.data.avatar_url, "/uploaded-group.jpg");
  const message = sent[sent.length - 1];
  assert.equal(message.action, "update_group");
  assert.equal(message.conversation_id, "group1");
  assert.equal(message.title, "Old Title");
  assert.equal(message.avatar_url, "/uploaded-group.jpg");
  assert.equal(appState.conversations[0].avatar_url, "/uploaded-group.jpg");
});

// ─── (e) A non-admin cannot edit title/avatar ────────────────────────────────

test("a non-admin viewer has no title input, avatar-change control, or add-member button", () => {
  const { render } = setup({ viewerId: "member1" });
  const tree = render();
  assert.equal(
    nodes(tree).some((node) => node.props?.accessibilityLabel === "Group title"),
    false,
  );
  assert.equal(
    nodes(tree).some(
      (node) => node.props?.accessibilityLabel === "Change group photo",
    ),
    false,
  );
  assert.equal(
    nodes(tree).some((node) => node.props?.accessibilityLabel === "Add member"),
    false,
  );
  // Read-only title text is still shown.
  assert.ok(
    nodes(tree).some(
      (node) =>
        Array.isArray(node.props?.children) &&
        node.props.children.includes("Old Title"),
    ),
  );
});
