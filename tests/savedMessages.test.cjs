const { test } = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./helpers.cjs");

function fixture(conversations = []) {
  const runner = harness();
  const calls = [];
  const context = {
    user: { userId: "me", token: "session" },
    conversations,
    setConversations: (update) => {
      context.conversations = update(context.conversations);
    },
    blockStateReady: true,
    getBlockPolicy: () => {
      throw new Error("Self-chat must not use recipient blocking");
    },
    isBlockedBy: () => false,
  };
  const service = {
    createConversation: async (identity) => {
      calls.push(identity);
      return { conversation_id: "saved" };
    },
  };
  const { useConversations } = runner.load("src/hooks/useConversations.js", {
    "../context/AppContext": { useApp: () => context },
    "../services/conversations": { conversationService: service },
    "../services/api": { apiFetch: async () => [] },
  });
  return {
    context,
    calls,
    service,
    render: () => runner.render(useConversations),
  };
}

test("Saved Messages creates a self-chat and inserts it into the list", async () => {
  const state = fixture();
  const conversation = await state.render().openSavedMessages();
  assert.deepEqual(state.calls, ["me"]);
  assert.equal(conversation.other_participant, null);
  assert.equal(conversation.id, "saved");
  assert.equal(state.context.conversations[0], conversation);
  assert.equal(state.render().openingSavedMessages, false);
  assert.equal(await state.render().openSavedMessages(), conversation);
  assert.equal(state.calls.length, 1);
});

test("Saved Messages reuses an existing web self-chat without losing metadata", async () => {
  const existing = {
    id: "web-self",
    type: "direct",
    other_participant: null,
    last_message: { content: "note" },
  };
  const state = fixture([existing]);
  assert.equal(await state.render().openSavedMessages(), existing);
  assert.equal(state.calls.length, 0);
});

test("repeated taps do not create parallel requests and failure permits retry", async () => {
  const state = fixture();
  let rejectRequest;
  state.service.createConversation = () =>
    new Promise((resolve, reject) => {
      rejectRequest = reject;
    });
  const opening = state.render().openSavedMessages();
  assert.equal(state.render().openingSavedMessages, true);
  assert.equal(await state.render().openSavedMessages(), null);
  rejectRequest(new Error("Offline"));
  await assert.rejects(opening, /Offline/);
  assert.equal(state.render().openingSavedMessages, false);
  assert.equal(state.context.conversations.length, 0);
  state.service.createConversation = async () => ({ conversation_id: "retry" });
  assert.equal((await state.render().openSavedMessages()).id, "retry");
});

test("late self-chat creation cannot populate another account", async () => {
  const state = fixture();
  let complete;
  state.service.createConversation = () =>
    new Promise((resolve) => {
      complete = resolve;
    });
  const opening = state.render().openSavedMessages();
  state.context.user = { user_id: "other", token: "other-session" };
  state.render();
  complete({ conversation_id: "old-account-chat" });
  assert.equal(await opening, null);
  assert.equal(state.context.conversations.length, 0);
});

test("invalid creation response leaves the list unchanged", async () => {
  const state = fixture();
  state.service.createConversation = async () => ({});
  await assert.rejects(
    state.render().openSavedMessages(),
    /Could not open Saved Messages/,
  );
  assert.equal(state.context.conversations.length, 0);
  assert.equal(state.render().openingSavedMessages, false);
});

test("self-chat supports text and uploaded attachments under existing blocking policy", async () => {
  const runner = harness();
  const { blockPolicy } = require("../src/utils/blockPolicy.js");
  const sent = [];
  const { useMessages } = runner.load("src/hooks/useMessages.js", {
    "react-native": {
      AppState: {
        currentState: "active",
        addEventListener: () => ({ remove() {} }),
      },
    },
    "../context/AppContext": {
      useApp: () => ({
        user: { userId: "me", token: "session" },
        markConversationRead() {},
        blockStateReady: true,
        blockedByUserIds: [],
        isBlockedBy: () => false,
        getBlockPolicy: (identity) =>
          blockPolicy(identity, ["blocked-peer"], []),
      }),
    },
    "../services/websocket": {
      websocketService: { send() {}, subscribe: () => () => {} },
    },
    "../services/conversations": {
      conversationService: {
        getMessages: async () => [],
        getPinnedMessages: async () => [],
        sendMessage: async (...args) => {
          sent.push(args);
          return { id: `message-${sent.length}` };
        },
      },
    },
  });
  const messages = runner.render(() =>
    useMessages("saved", null, { type: "direct", other_participant: null }),
  );
  await messages.sendMessage("My note");
  await messages.sendMessage(
    "",
    null,
    "image",
    "https://test.invalid/photo.jpg",
    "photo.jpg",
  );
  assert.equal(sent[0][0], "saved");
  assert.equal(sent[0][1], "My note");
  assert.equal(sent[1][2], "image");
  assert.equal(sent[1][4], "https://test.invalid/photo.jpg");
  runner.unmount();
});
