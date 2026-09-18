const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes, settle } = require("./helpers.cjs");

function textContents(tree) {
  return nodes(tree)
    .filter((n) => n.type === "Text")
    .map((n) =>
      Array.isArray(n.props.children)
        ? n.props.children.join("")
        : String(n.props.children ?? ""),
    );
}

function baseMessages() {
  return [
    {
      id: "m1",
      message_type: "image",
      media_url: "/uploads/img1.jpg",
      sender_id: "them",
    },
    {
      id: "m2",
      message_type: "image",
      media_url: "/uploads/img2.jpg",
      sender_id: "me",
    },
    {
      id: "m3",
      message_type: "file",
      file_url: "/uploads/doc1.pdf",
      file_name: "doc1.pdf",
      sender_id: "them",
    },
    {
      id: "m4",
      message_type: "text",
      content: "hello",
      sender_id: "me",
    },
  ];
}

function setup({
  messages = baseMessages(),
  passMessages = true,
  blockedByIds = [],
  blockStateReady = true,
  getMessages = async () => [],
} = {}) {
  const runner = harness();
  const openedUrls = [];

  const conversation = {
    id: "conv1",
    conversation_id: "conv1",
    type: "direct",
  };

  const appState = {
    theme: {
      bg: "#fff",
      headerBg: "#fff",
      borderColor: "#ccc",
      text: "#000",
      textMuted: "#888",
      accent: "#6366f1",
    },
    isBlockedBy: (id) => blockedByIds.includes(String(id)),
    blockStateReady,
  };

  const mocks = {
    "react-native": {
      View: "View",
      Text: "Text",
      Image: "Image",
      FlatList: "FlatList",
      TouchableOpacity: "TouchableOpacity",
      StyleSheet: { create: (s) => s, hairlineWidth: 1 },
      ActivityIndicator: "ActivityIndicator",
      Linking: {
        openURL: (url) => {
          openedUrls.push(url);
          return Promise.resolve();
        },
      },
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    },
    "react-native-svg": { __esModule: true, default: "Svg", Path: "Path" },
    "expo-video-thumbnails": {
      getThumbnailAsync: async () => ({ uri: "file://thumb.jpg" }),
    },
    "../context/AppContext": { useApp: () => appState },
    "../services/conversations": {
      conversationService: { getMessages },
    },
    "../services/api": { API_BASE: "http://test.invalid" },
    "../components/chat/FullScreenImageViewer": {
      __esModule: true,
      default: "FullScreenImageViewer",
    },
  };

  const { default: SharedMediaScreen } = runner.load(
    "src/screens/SharedMediaScreen.js",
    mocks,
  );

  const navigation = { goBack: () => {} };
  const route = {
    params: passMessages ? { conversation, messages } : { conversation },
  };
  const render = () =>
    runner.render(() => SharedMediaScreen({ route, navigation }));

  return { runner, render, openedUrls };
}

// ─── (a) images/files separated with correct counts ─────────────────────────

test("images and files are separated into sections with correct counts", () => {
  const { render } = setup();
  const tree = render();
  const flatList = nodes(tree).find((n) => n.type === "FlatList");
  assert.ok(flatList);
  assert.equal(flatList.props.data.length, 2);
  assert.equal(flatList.props.numColumns, 3);

  const headerTexts = textContents(flatList.props.ListHeaderComponent);
  const footerTexts = textContents(flatList.props.ListFooterComponent);
  assert.ok(headerTexts.some((t) => t.includes("Images (2)")));
  assert.ok(footerTexts.some((t) => t.includes("Files (1)")));
});

// ─── (b) tapping a thumbnail opens the viewer at the correct startIndex ─────

test("tapping a thumbnail opens FullScreenImageViewer at the tapped image's index", () => {
  const { render } = setup();
  let tree = render();
  const flatList = nodes(tree).find((n) => n.type === "FlatList");
  const secondImage = flatList.props.data[1];
  assert.equal(secondImage.id, "m2");

  const thumbEl = flatList.props.renderItem({ item: secondImage, index: 1 });
  assert.equal(thumbEl.props.accessibilityLabel, "View image");
  thumbEl.props.onPress();

  tree = render();
  const viewer = nodes(tree).find((n) => n.type === "FullScreenImageViewer");
  assert.ok(viewer);
  assert.equal(viewer.props.visible, true);
  assert.equal(viewer.props.startIndex, 1);
  assert.equal(viewer.props.images.length, 2);
  assert.equal(viewer.props.images[1].id, "m2");
});

// ─── (c) zero images and zero files shows the empty state ───────────────────

test("a conversation with no images and no files shows the empty state", () => {
  const { render } = setup({
    messages: [
      { id: "t1", message_type: "text", content: "hi", sender_id: "me" },
    ],
  });
  const tree = render();
  const texts = textContents(tree);
  assert.ok(
    texts.some((t) => t.includes("No shared media in this conversation yet.")),
  );
  assert.equal(
    nodes(tree).find((n) => n.type === "FlatList"),
    undefined,
  );
});

// ─── (d) media from a blocked-by/hidden sender is excluded ──────────────────

test("media from a blocked-by sender is excluded from the gallery", () => {
  const { render } = setup({ blockedByIds: ["them"] });
  const tree = render();
  const flatList = nodes(tree).find((n) => n.type === "FlatList");
  assert.equal(flatList.props.data.length, 1);
  assert.equal(flatList.props.data[0].id, "m2");

  // Only m2 (sender "me") remains an image; m1 (sender "them") and m3 (file, "them") are excluded.
  const headerTexts = textContents(flatList.props.ListHeaderComponent);
  const footerTexts = textContents(flatList.props.ListFooterComponent);
  assert.ok(headerTexts.some((t) => t.includes("Images (1)")));
  assert.ok(footerTexts.some((t) => t.includes("Files (0)")));
});

test("when blockStateReady is false, all media is conservatively excluded", () => {
  const { render } = setup({ blockStateReady: false });
  const tree = render();
  const texts = textContents(tree);
  assert.ok(
    texts.some((t) => t.includes("No shared media in this conversation yet.")),
  );
});

// ─── (e) tapping a file attempts to open it via Linking.openURL ─────────────

test("tapping a file opens it via Linking.openURL using the resolved asset URL", () => {
  const { render, openedUrls } = setup();
  const tree = render();
  const flatList = nodes(tree).find((n) => n.type === "FlatList");
  const fileRow = nodes(flatList.props.ListFooterComponent).find(
    (n) => n.props?.accessibilityLabel === "Open file doc1.pdf",
  );
  assert.ok(fileRow);
  fileRow.props.onPress();
  assert.deepEqual(openedUrls, ["http://test.invalid/uploads/doc1.pdf"]);
});

// ─── SharedMediaScreen also fetches messages itself when none are passed ────

test("fetches messages itself via conversationService.getMessages when route.params.messages is absent", async () => {
  const fetched = baseMessages();
  const { render } = setup({
    passMessages: false,
    getMessages: async () => fetched,
  });
  let tree = render();
  // Loading state first.
  assert.ok(nodes(tree).some((n) => n.type === "ActivityIndicator"));

  await settle();
  await settle();

  tree = render();
  const flatList = nodes(tree).find((n) => n.type === "FlatList");
  assert.ok(flatList);
  const headerTexts = textContents(flatList.props.ListHeaderComponent);
  const footerTexts = textContents(flatList.props.ListFooterComponent);
  assert.ok(headerTexts.some((t) => t.includes("Images (2)")));
  assert.ok(footerTexts.some((t) => t.includes("Files (1)")));
});

// ─── "Shared Media" row in ChatOptionsMenu navigates correctly ──────────────

test("ChatOptionsMenu shows a 'Shared Media' row that closes the menu and navigates", () => {
  const runner = harness();
  const mocks = {
    "react-native": {
      View: "View",
      Text: "Text",
      TouchableOpacity: "TouchableOpacity",
      StyleSheet: { create: (s) => s, absoluteFill: {} },
      Modal: "Modal",
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    },
  };
  const { default: ChatOptionsMenu } = runner.load(
    "src/components/chat/ChatOptionsMenu.js",
    mocks,
  );

  let closed = false;
  let navigated = false;
  const theme = {
    cardBg: "#fff",
    borderColor: "#ccc",
    text: "#000",
    danger: "#f00",
  };

  const tree = runner.render(() =>
    ChatOptionsMenu({
      visible: true,
      onClose: () => {
        closed = true;
      },
      theme,
      isBlocked: false,
      onToggleBlock: () => {},
      isPinned: false,
      onTogglePin: () => {},
      isMuted: false,
      onToggleMute: () => {},
      isGroup: false,
      onSharedMedia: () => {
        navigated = true;
      },
      canBlock: true,
    }),
  );

  const row = nodes(tree).find(
    (n) => n.props?.accessibilityLabel === "Shared media",
  );
  assert.ok(row);
  row.props.onPress();
  assert.equal(closed, true);
  assert.equal(navigated, true);
});
