const test = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./helpers.cjs");

test("getMessages history fetch passes mark_read=false", async () => {
  const runner = harness();
  const calls = [];
  const { conversationService } = runner.load("src/services/conversations.js", {
    "./api": {
      apiFetch: async (url) => {
        calls.push(url);
        return [];
      },
      uploadFileWithProgress: async () => ({}),
    },
  });
  await conversationService.getMessages("conv1");
  assert.match(calls[0], /mark_read=false/);
});

test("read receipts are deferred while backgrounded and sent on return to foreground", async () => {
  const runner = harness();
  const sent = [];
  let appStateChange;
  const appState = {
    currentState: "background",
    addEventListener: (event, callback) => {
      appStateChange = callback;
      return { remove() {} };
    },
  };
  const app = {
    user: { userId: "me", token: "t" },
    markConversationRead: (id) => sent.push(`ctx:${id}`),
    blockStateVersion: 1,
    blockStateReady: true,
    getBlockPolicy: () => ({ preventDirectInteraction: false }),
    isBlockedBy: () => false,
    blockedByUserIds: [],
  };
  const { useMessages } = runner.load("src/hooks/useMessages.js", {
    "react-native": { AppState: appState },
    "../context/AppContext": { useApp: () => app },
    "../services/conversations": {
      conversationService: {
        getMessages: async () => [],
        getPinnedMessages: async () => [],
      },
    },
    "../services/websocket": {
      websocketService: {
        send: (data) => sent.push(data.action),
        subscribe: () => () => {},
      },
    },
  });
  runner.render(() =>
    useMessages("conv1", null, {
      type: "direct",
      other_participant: { user_id: "peer" },
    }),
  );
  assert.ok(
    !sent.includes("read_conversation"),
    "no receipt while backgrounded",
  );

  appState.currentState = "active";
  appStateChange("active");
  assert.ok(sent.includes("read_conversation"), "receipt sent on foreground");
  assert.ok(sent.includes("ctx:conv1"));
  runner.unmount();
});
