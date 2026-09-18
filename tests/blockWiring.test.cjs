const { test } = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes, settle } = require("./helpers.cjs");
const { blockPolicy } = require("../src/utils/blockPolicy");

function messageFixture(outgoing = [], incoming = [], type = "direct") {
  const runner = harness();
  const sent = [];
  const requests = [];
  const listeners = new Set();
  const app = {
    user: { userId: "me", token: "local-test" },
    blockStateReady: true,
    blockStateVersion: 1,
    blockedByUserIds: incoming,
    markConversationRead() {},
    getBlockPolicy: (identity) => blockPolicy(identity, outgoing, incoming),
    isBlockedBy: (identity) => incoming.includes(String(identity)),
  };
  const service = {
    getMessages: async () => {
      requests.push("messages");
      return [
        {
          id: "history",
          sender_id: "peer",
          sender_name: "Real Name",
          content: "kept",
          status: "read",
        },
      ];
    },
    getPinnedMessages: async () => {
      requests.push("pins");
      return [];
    },
    sendMessage: async () => {
      requests.push("send");
      throw new Error("Rejected by server");
    },
    deleteMessage: async () => {
      requests.push("delete");
    },
    pinMessage: async () => {
      requests.push("pin");
    },
    unpinMessage: async () => {
      requests.push("unpin");
    },
  };
  const { useMessages } = runner.load("src/hooks/useMessages.js", {
    "react-native": {
      AppState: {
        currentState: "active",
        addEventListener: () => ({ remove() {} }),
      },
    },
    "../context/AppContext": { useApp: () => app },
    "../services/conversations": { conversationService: service },
    "../services/websocket": {
      websocketService: {
        send: (data) => {
          sent.push(data);
          return true;
        },
        subscribe: (callback) => {
          listeners.add(callback);
          return () => listeners.delete(callback);
        },
      },
    },
  });
  const render = () =>
    runner.render(() =>
      useMessages("conversation", null, {
        type,
        other_participant: { user_id: "peer" },
      }),
    );
  return { runner, app, requests, service, sent, listeners, render };
}

for (const direction of ["outgoing", "incoming", "mutual"]) {
  test(`${direction}: hook blocks direct send, typing, receipts and mutations but retains history`, async () => {
    const fixture = messageFixture(
      direction !== "incoming" ? ["peer"] : [],
      direction !== "outgoing" ? ["peer"] : [],
    );
    let hook = fixture.render();
    await settle();
    hook = fixture.render();
    assert.equal(hook.messages[0].content, "kept");
    assert.equal(
      hook.messages[0].sender_name,
      direction === "outgoing" ? "Real Name" : "Person Not Available",
    );
    assert.equal(hook.suppressReceipts, true);
    await assert.rejects(hook.sendMessage("no"), /unavailable/);
    await assert.rejects(hook.pinMessage("history"), /unavailable/);
    await assert.rejects(hook.unpinMessage("history"), /unavailable/);
    await assert.rejects(hook.deleteMessage("history"), /unavailable/);
    assert.throws(() => hook.editMessage("history", "edit"), /unavailable/);
    assert.throws(() => hook.toggleReaction("history", "test"), /unavailable/);
    hook.handleTypingStart();
    for (const listener of fixture.listeners)
      listener({
        event: "typing",
        conversation_id: "conversation",
        user_id: "peer",
        username: "Real Name",
        is_typing: true,
      });
    assert.equal(fixture.render().typingUser, null);
    assert.equal(fixture.sent.length, 0);
    fixture.runner.unmount();
  });
}

test("group messaging stays usable; blocker typing stays hidden", async () => {
  const fixture = messageFixture([], ["peer"], "group");
  let hook = fixture.render();
  fixture.service.sendMessage = async () => ({
    id: "confirmed",
    content: "group text",
  });
  await hook.sendMessage("group text");
  for (const listener of fixture.listeners)
    listener({
      event: "typing",
      conversation_id: "conversation",
      user_id: "peer",
      username: "Real Name",
      is_typing: true,
    });
  hook = fixture.render();
  assert.equal(hook.typingUser, null);
  assert.ok(hook.messages.some((message) => message.id === "confirmed"));
  fixture.runner.unmount();
});

test("rejected sends stay failed and are never reported as success", async () => {
  const fixture = messageFixture();
  const hook = fixture.render();
  await settle();
  await assert.rejects(hook.sendMessage("preserve draft"), /Rejected/);
  assert.equal(
    fixture
      .render()
      .messages.find((message) => message.content === "preserve draft").status,
    "failed",
  );
  assert.equal(
    fixture.sent.some((data) => data.action === "send_message"),
    false,
  );
  fixture.runner.unmount();
});

for (const echoOrder of ["none", "before", "after"]) {
  test(`minimal REST acknowledgment preserves full message with echo ${echoOrder}`, async () => {
    const fixture = messageFixture();
    fixture.render();
    await settle();
    let acknowledge;
    fixture.service.sendMessage = () =>
      new Promise((resolve) => {
        acknowledge = resolve;
      });
    const pending = fixture
      .render()
      .sendMessage("caption", "parent", "image", "/image.jpg", "image.jpg");
    const optimistic = fixture
      .render()
      .messages.find((message) => message.status === "sending");
    const echo = {
      ...optimistic,
      id: "server-id",
      message_id: "server-id",
      status: "sent",
      sender_name: "Server Name",
      created_at: "2026-09-15T12:00:00.000Z",
    };
    const emitEcho = () => {
      for (const listener of fixture.listeners)
        listener({
          event: "new_message",
          conversation_id: "conversation",
          message: echo,
        });
    };
    if (echoOrder === "before") {
      emitEcho();
      for (const listener of fixture.listeners)
        listener({ event: "read_update", conversation_id: "conversation" });
    }
    acknowledge({ message_id: "server-id", status: "sent" });
    await pending;
    if (echoOrder === "after") emitEcho();
    const messages = fixture
      .render()
      .messages.filter((message) => message.id !== "history");
    assert.equal(messages.length, 1);
    const message = messages[0];
    assert.equal(message.id, "server-id");
    assert.equal(message.message_id, "server-id");
    for (const field of [
      "content",
      "sender_id",
      "user_id",
      "message_type",
      "media_url",
      "file_url",
      "file_name",
      "reply_to_id",
    ]) {
      assert.equal(message[field], optimistic[field], field);
    }
    assert.equal(
      message.created_at,
      echoOrder === "none" ? optimistic.created_at : echo.created_at,
    );
    assert.equal(message.status, echoOrder === "before" ? "read" : "sent");
    if (echoOrder !== "none") assert.equal(message.sender_name, "Server Name");
    emitEcho();
    assert.equal(
      fixture.render().messages.filter((message) => message.id === "server-id")
        .length,
      1,
    );
    assert.equal(
      fixture.render().messages.find((message) => message.id === "server-id")
        .status,
      echoOrder === "before" ? "read" : "sent",
    );
    for (const listener of fixture.listeners)
      listener({ event: "message_delivered", conversation_id: "conversation" });
    echo.status = "read";
    emitEcho();
    assert.equal(
      fixture.render().messages.find((message) => message.id === "server-id")
        .status,
      "read",
    );
    fixture.runner.unmount();
  });
}

test("failed media send retains the full optimistic message", async () => {
  const fixture = messageFixture();
  fixture.render();
  await settle();
  let rejectSend;
  fixture.service.sendMessage = () =>
    new Promise((resolve, reject) => {
      rejectSend = reject;
    });
  const pending = fixture
    .render()
    .sendMessage("caption", "parent", "image", "/image.jpg", "image.jpg");
  const optimistic = fixture
    .render()
    .messages.find((message) => message.status === "sending");
  rejectSend(new Error("Rejected by server"));
  await assert.rejects(pending, /Rejected by server/);
  const failed = fixture
    .render()
    .messages.find((message) => message.id === optimistic.id);
  assert.deepEqual(
    { ...failed },
    { ...optimistic, status: "failed", send_error: "Rejected by server" },
  );
  fixture.runner.unmount();
});

test("relation revision refetches both messages and pins; unblock restores identity", async () => {
  const incoming = ["peer"];
  const fixture = messageFixture([], incoming);
  fixture.render();
  await settle();
  assert.equal(
    fixture.render().messages[0].sender_name,
    "Person Not Available",
  );
  incoming.splice(0);
  fixture.app.blockStateVersion += 1;
  fixture.render();
  await settle();
  assert.equal(fixture.render().messages[0].sender_name, "Real Name");
  assert.equal(
    fixture.requests.filter((entry) => entry === "messages").length,
    2,
  );
  assert.equal(fixture.requests.filter((entry) => entry === "pins").length, 2);
  fixture.runner.unmount();
});

test("blocking aborts an in-flight send", async () => {
  const outgoing = [];
  const fixture = messageFixture(outgoing);
  const hook = fixture.render();
  await settle();
  let signal;
  fixture.service.sendMessage = (...args) =>
    new Promise((resolve, reject) => {
      signal = args[6];
      signal.addEventListener("abort", () => reject(new Error("Cancelled")));
    });
  const pending = hook.sendMessage("in flight");
  outgoing.push("peer");
  fixture.app.blockStateVersion += 1;
  fixture.render();
  await assert.rejects(pending, /Cancelled/);
  assert.equal(signal.aborted, true);
  fixture.runner.unmount();
});

test("context menu retains copy but no mutation or reaction buttons when disabled", () => {
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
  const tree = Menu({
    message: { content: "history" },
    theme: {},
    isOwn: true,
    interactionsDisabled: true,
    onCopy() {},
    onReply() {},
    onEdit() {},
    onPin() {},
    onDelete() {},
  });
  const text = nodes(tree)
    .filter((node) => node.type === "Text")
    .flatMap((node) => node.props.children);
  assert.ok(text.includes("Copy Text"));
  for (const forbidden of ["Reply", "Edit Message", "Delete", "Pin Message"])
    assert.ok(!text.includes(forbidden));
});

test("AppContext refreshes on event, reconnect, foreground and 12-second polling; mutual unblock makes one request", async () => {
  const runner = harness();
  let outgoing = [];
  let incoming = [];
  let reads = 0;
  let unblocks = 0;
  let conversationReads = 0;
  let focus;
  let reconnect;
  let event;
  const appState = {
    currentState: "active",
    addEventListener: (name, callback) => {
      focus = callback;
      return { remove() {} };
    },
  };
  const { AppProvider } = runner.load("src/context/AppContext.js", {
    "react-native": {
      AppState: appState,
      Appearance: {
        getColorScheme: () => "light",
        addChangeListener: () => ({ remove() {} }),
      },
    },
    "@react-native-async-storage/async-storage": { getItem: async () => null },
    "../services/auth": {
      authService: { getCurrentUser: async () => null, logout: async () => {} },
    },
    "../services/conversations": {
      conversationService: {
        listConversations: async () => {
          conversationReads++;
          return [];
        },
      },
    },
    "../services/user": {
      userService: {
        getBlockedUsers: async () => {
          reads++;
          return outgoing.map((user_id) => ({ user_id }));
        },
        getBlockedByUsers: async () => incoming,
        blockUser: async (identity) => {
          outgoing.push(identity);
        },
        unblockUser: async (identity) => {
          unblocks++;
          outgoing = outgoing.filter((entry) => entry !== identity);
        },
      },
    },
    "../services/websocket": {
      websocketService: {
        connect: (token, handler, opened) => {
          reconnect = opened;
        },
        subscribe: (handler) => {
          event = handler;
          return () => {};
        },
        closeAll() {},
      },
    },
    "../utils/haptics.js": { lightTap() {}, selectionTap() {}, successTap() {} },
    "../services/notifications": {
      registerForPushNotificationsAsync: async () => null,
      registerPushToken() {},
    },
    "../theme/colors": { THEMES: { light: {} } },
  });
  const render = () =>
    runner.render(() => AppProvider({ children: null })).props.value;
  let context = render();
  await settle();
  context.login({ userId: "me", token: "local-test" });
  render();
  await settle();
  context = render();
  assert.equal(context.blockStateReady, true);
  const before = reads;
  outgoing = ["peer"];
  incoming = ["peer"];
  event({ event: "block_state_changed" });
  await settle();
  context = render();
  assert.equal(context.isBlocked("peer"), true);
  assert.equal(context.isBlockedBy("peer"), true);
  assert.equal(context.getBlockPolicy("peer").canUnblock, true);
  await context.unblockUser("peer");
  context = render();
  assert.equal(unblocks, 1);
  assert.equal(context.isBlocked("peer"), false);
  assert.equal(context.getBlockPolicy("peer").preventDirectInteraction, true);
  reconnect();
  await settle();
  focus("active");
  await settle();
  const poll = [...runner.timers.values()].find(
    (timer) => timer.delay === 12000,
  );
  assert.ok(poll);
  poll.callback();
  await settle();
  assert.equal(reads, before + 5);
  assert.ok(conversationReads >= 3);
  appState.currentState = "background";
  poll.callback();
  await settle();
  assert.equal(reads, before + 5);
  runner.unmount();
});

test("native recording created after a block is unloaded and never attached", async () => {
  const runner = harness();
  let finishCreation;
  let stopped = 0;
  let attachments = 0;
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
    Alert: { alert() {} },
  });
  const { default: Input } = runner.load(
    "src/components/chat/MessageInput.js",
    {
      "react-native": native,
      "react-native-svg": {
        __esModule: true,
        default: "Svg",
        Path: "Path",
        Line: "Line",
      },
      "react-native-safe-area-context": {
        useSafeAreaInsets: () => ({ bottom: 0 }),
      },
      "expo-image-picker": {},
      "expo-document-picker": {},
      "rn-emoji-keyboard": { default: "EmojiPicker", __esModule: true },
      "expo-blur": { BlurView: "BlurView" },
      "expo-av": {
        Audio: {
          requestPermissionsAsync: async () => ({ status: "granted" }),
          setAudioModeAsync: async () => {},
          RecordingOptionsPresets: { HIGH_QUALITY: {} },
          Recording: {
            createAsync: () =>
              new Promise((resolve) => {
                finishCreation = resolve;
              }),
          },
        },
      },
    },
  );
  const props = {
    value: "",
    theme: {},
    disabled: false,
    onSelectAttachment: () => attachments++,
    assertInteractionAllowed() {},
  };
  const tree = runner.render(() => Input(props));
  const recordButton = nodes(tree).find(
    (node) => node.props?.onPress?.name === "startRecording",
  );
  assert.ok(recordButton);
  const pending = recordButton.props.onPress();
  await settle();
  props.disabled = true;
  runner.render(() => Input(props));
  finishCreation({
    recording: {
      stopAndUnloadAsync: async () => {
        stopped++;
      },
    },
  });
  await pending;
  assert.equal(stopped, 1);
  assert.equal(attachments, 0);
  runner.unmount();
});

test("message rendering hides blocker reaction avatars and receipts in groups", () => {
  const runner = harness();
  const { default: Bubble } = runner.load(
    "src/components/chat/MessageBubble.js",
    {
      "react-native": {
        View: "View",
        Text: "Text",
        Image: "Image",
        TouchableOpacity: "TouchableOpacity",
        StyleSheet: { create: (styles) => styles },
      },
      "react-native-svg": { __esModule: true, default: "Svg", Path: "Path" },
      "../common/MessageStatusIcon": { __esModule: true, default: "Receipt" },
      "./VoicePlayer": { __esModule: true, default: "VoicePlayer" },
      "./SwipeToReply": { __esModule: true, default: "SwipeToReply" },
      "../../services/api": { API_BASE: "http://test.invalid" },
      "../../context/AppContext": {
        useApp: () => ({
          blockStateReady: true,
          isBlockedBy: (identity) => identity === "peer",
        }),
      },
    },
  );
  const tree = Bubble({
    msg: {
      sender_id: "peer",
      sender_name: "Private Name",
      sender_avatar: "private.jpg",
      status: "read",
      reactions: { test: ["peer"] },
      content: "history",
    },
    theme: {},
    isGroup: true,
    suppressReceipts: true,
    currentUserId: "me",
    participants: [{ user_id: "peer", avatar_url: "private.jpg" }],
  });
  const rendered = nodes(tree);
  assert.equal(
    rendered.some((node) => node.type === "Receipt"),
    false,
  );
  assert.equal(
    rendered.some(
      (node) =>
        node.type === "Image" &&
        node.props.source?.uri?.includes("private.jpg"),
    ),
    false,
  );
  const text = rendered
    .filter((node) => node.type === "Text")
    .flatMap((node) => node.props.children);
  assert.ok(text.includes("Person Not Available"));
  assert.ok(!text.includes("Private Name"));
  assert.ok(text.includes("history"));
});

test("ChatScreen aborts uploads on a block, prevents the follow-up send and gates its separate typing row", async () => {
  const runner = harness();
  let blocked = false;
  let finishUpload;
  let uploadSignal;
  let sends = 0;
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
    isBlocked: () => blocked,
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
  });
  const mocks = {
    "react-native": native,
    "react-native-svg": { __esModule: true, default: "Svg", Path: "Path" },
    "@react-native-async-storage/async-storage": { getItem: async () => null },
    "../context/AppContext": { useApp: () => app },
    "../hooks/useMessages": {
      useMessages: () => ({
        messages: [],
        pinnedMessages: [],
        typingUser: "Private Name",
        sendMessage: async () => {
          sends++;
        },
        assertInteractionAllowed: () => {
          if (blocked) throw new Error("blocked");
        },
      }),
    },
    "../services/conversations": {
      conversationService: {
        uploadFile: (data, progress, signal) => {
          uploadSignal = signal;
          return new Promise((resolve) => {
            finishUpload = resolve;
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
  let tree = render();
  const wallpaper = nodes(tree).find(
    (node) => node.type === "Image" && node.props.source === 1,
  );
  const wallpaperStyle = Object.assign({}, ...wallpaper.props.style);
  assert.equal(wallpaperStyle.width, "100%");
  assert.equal(wallpaperStyle.height, "100%");
  assert.equal(wallpaper.props.resizeMode, "repeat");
  assert.equal(wallpaper.props.pointerEvents, "none");
  nodes(tree)
    .find((node) => node.type === "MessageInput")
    .props.onSelectAttachment({
      file: new Blob(["local test"]),
      name: "test.txt",
      mediaType: "file",
    });
  tree = render();
  const pending = nodes(tree)
    .find((node) => node.type === "MessageInput")
    .props.onSend();
  await settle();
  assert.ok(uploadSignal);
  blocked = true;
  app.blockStateVersion++;
  tree = render();
  assert.equal(uploadSignal.aborted, true);
  assert.equal(
    nodes(tree).find((node) => node.type === "TypingIndicator").props.username,
    null,
  );
  assert.equal(
    nodes(tree).find((node) => node.type === "MessageInput").props.disabled,
    true,
  );
  assert.equal(
    nodes(tree).find((node) => node.type === "ContextMenu").props
      .interactionsDisabled,
    true,
  );
  finishUpload({ url: "/unused-upload" });
  await pending;
  assert.equal(sends, 0);
  assert.ok(alerts.some(([title]) => title === "Message not sent"));
  runner.unmount();
});

test("upload transport actually aborts XHR and rejects instead of completing", async () => {
  const runner = harness();
  let xhr;
  class FakeXHR {
    constructor() {
      xhr = this;
      this.upload = {};
    }
    open() {}
    setRequestHeader() {}
    send() {
      this.sent = true;
    }
    abort() {
      this.aborted = true;
      this.onabort();
    }
  }
  const { uploadFileWithProgress } = runner.load(
    "src/services/api.js",
    {
      "@react-native-async-storage/async-storage": {
        getItem: async () => "local-test",
      },
    },
    { XMLHttpRequest: FakeXHR },
  );
  const controller = new AbortController();
  const pending = uploadFileWithProgress(
    new FormData(),
    () => {},
    controller.signal,
  );
  await settle();
  controller.abort();
  await assert.rejects(pending, /Upload cancelled/);
  assert.equal(xhr.aborted, true);
});

test("account unblock is routed through context, not a second service mutation", () => {
  const source = require("node:fs").readFileSync(
    require("node:path").join(
      __dirname,
      "../src/screens/ConversationListScreen.js",
    ),
    "utf8",
  );
  assert.ok(source.includes("await unblockUser(userId)"));
  assert.ok(!source.includes("userService.unblockUser("));
});
