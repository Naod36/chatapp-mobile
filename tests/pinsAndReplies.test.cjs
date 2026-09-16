const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes } = require("./helpers.cjs");

function setup() {
  const runner = harness();
  const state = {
    theme: { accent: "#6366f1" },
    user: { userId: "me" },
    blockStateReady: true,
    blockedByUserIds: [],
    isBlockedBy: () => false,
    getPresence: () => "offline",
    getBlockPolicy: () => ({ preventDirectInteraction: false }),
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
    "./VoicePlayer": { __esModule: true, default: "VoicePlayer" },
    "./SwipeToReply": { __esModule: true, default: "SwipeToReply" },
    "../../services/api": { API_BASE: "http://test.invalid" },
    "../../context/AppContext": { useApp: () => state },
  };
  return { runner, state, mocks };
}

test("each pinned chat has a marker and distinct styling; ordinary chats do not", () => {
  const { runner, mocks } = setup();
  const { default: Item } = runner.load(
    "src/components/conversations/ConversationItem.js",
    mocks,
  );
  for (const id of ["first", "second"]) {
    const tree = Item({ conversation: { id, type: "group" }, isPinned: true });
    assert.ok(
      nodes(tree).some(
        (node) => node.props.accessibilityLabel === "Pinned chat",
      ),
    );
    assert.equal(tree.props.style[2].borderLeftWidth, 3);
  }
  const ordinary = Item({ conversation: { id: "third", type: "group" } });
  assert.equal(
    nodes(ordinary).some(
      (node) => node.props.accessibilityLabel === "Pinned chat",
    ),
    false,
  );
});

test("ID-only reply displays quote, supports navigation and preserves identity privacy", () => {
  const { runner, state, mocks } = setup();
  const { default: Bubble } = runner.load(
    "src/components/chat/MessageBubble.js",
    mocks,
  );
  let jumpedTo;
  const props = {
    msg: {
      id: "reply",
      sender_id: "me",
      content: "My answer",
      reply_to_id: "original",
    },
    repliedMessage: {
      id: "original",
      sender_id: "peer",
      sender_name: "Peer",
      content: "Original question",
    },
    isOwn: true,
    currentUserId: "me",
    theme: { userBubbleText: "#ffffff" },
    onReplyPress: (id) => {
      jumpedTo = id;
    },
  };
  const render = () => nodes(Bubble(props));
  let rendered = render();
  const quote = rendered.find(
    (node) =>
      node.props.accessibilityLabel === "Reply to Peer: Original question",
  );
  assert.ok(quote);
  quote.props.onPress();
  assert.equal(jumpedTo, "original");
  state.isBlockedBy = (id) => id === "peer";
  rendered = render();
  assert.ok(
    rendered.some(
      (node) =>
        node.props.accessibilityLabel ===
        "Reply to Person Not Available: Original question",
    ),
  );
  props.repliedMessage = undefined;
  const unavailable = render().find(
    (node) =>
      node.props.accessibilityLabel ===
      "Reply to Reply: Original message unavailable",
  );
  assert.ok(unavailable.props.disabled);
});

test("swipe replies pass the message and preserve long press while disabled chats cannot swipe", () => {
  const { runner, mocks } = setup();
  const Bubble = runner.load(
    "src/components/chat/MessageBubble.js",
    mocks,
  ).default;
  let replied;
  let selected;
  const props = {
    msg: { id: "message", content: "Hello", sender_id: "peer" },
    theme: {},
    onSwipeReply: (message) => {
      replied = message;
    },
    onLongPress: (message) => {
      selected = message;
    },
  };
  const tree = Bubble(props);
  assert.equal(tree.props.enabled, true);
  tree.props.onReply();
  nodes(tree)
    .find((node) => node.props.onLongPress)
    .props.onLongPress();
  assert.equal(replied.id, "message");
  assert.equal(selected.id, "message");
  assert.equal(
    Bubble({ ...props, interactionsDisabled: true }).props.enabled,
    false,
  );
  for (const status of ["sending", "pending", "failed"]) {
    assert.equal(
      Bubble({ ...props, msg: { ...props.msg, status } }).props.enabled,
      false,
    );
  }
});

test("media replies have a meaningful preview and own messages are labeled You", () => {
  const { runner, mocks } = setup();
  const { default: Bubble } = runner.load(
    "src/components/chat/MessageBubble.js",
    mocks,
  );
  const tree = Bubble({
    msg: { sender_id: "peer", content: "Thanks", reply_to_id: "photo" },
    repliedMessage: { id: "photo", sender_id: "me", message_type: "image" },
    currentUserId: "me",
    theme: {},
  });
  assert.ok(
    nodes(tree).some(
      (node) => node.props.accessibilityLabel === "Reply to You: Photo",
    ),
  );
});
