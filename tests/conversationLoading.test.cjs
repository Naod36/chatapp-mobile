const { test } = require("node:test");
const assert = require("node:assert/strict");
const { harness, settle } = require("./helpers.cjs");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

async function conversationFixture() {
  const runner = harness();
  let incoming = ["peer"];
  let outgoing = [];
  let event;
  let logoutCount = 0;
  const service = { listConversations: async () => [] };
  const { AppProvider } = runner.load("src/context/AppContext.js", {
    "react-native": {
      AppState: {
        currentState: "active",
        addEventListener: () => ({ remove() {} }),
      },
    },
    "@react-native-async-storage/async-storage": { getItem: async () => null },
    "../services/auth": {
      authService: {
        getCurrentUser: async () => null,
        logout: async () => {
          logoutCount++;
        },
      },
    },
    "../services/conversations": { conversationService: service },
    "../services/user": {
      userService: {
        getBlockedUsers: async () => outgoing.map((user_id) => ({ user_id })),
        getBlockedByUsers: async () => incoming,
        blockUser: async (identity) => {
          outgoing = [...outgoing, identity];
        },
        unblockUser: async (identity) => {
          outgoing = outgoing.filter((entry) => entry !== identity);
        },
      },
    },
    "../services/websocket": {
      websocketService: {
        connect() {},
        closeAll() {},
        subscribe: (handler) => {
          event = handler;
          return () => {};
        },
      },
    },
    "../services/notifications": {
      registerForPushNotificationsAsync: async () => null,
      registerPushToken() {},
    },
    "../theme/colors": { THEMES: { light: {} } },
  });
  const render = () =>
    runner.render(() => AppProvider({ children: null })).props.value;
  render();
  await settle();
  render().login({ userId: "me", token: "first-token" });
  render();
  await settle();
  render();
  const requests = [];
  service.listConversations = () => {
    const request = deferred();
    requests.push(request);
    return request.promise;
  };
  return {
    runner,
    render,
    requests,
    logoutCount: () => logoutCount,
    changeIncoming: (next) => {
      incoming = next;
      event({ event: "block_state_changed" });
    },
  };
}

const identity = (name) => [
  {
    conversation_id: "chat",
    type: "direct",
    other_participant: {
      user_id: "peer",
      display_name: name,
      avatar_url: name === "Person Not Available" ? null : "/peer.jpg",
    },
  },
];

test("conversation loads resolved in reverse request order keep the newest result", async () => {
  const fixture = await conversationFixture();
  const older = fixture.render().loadConversations();
  const newer = fixture.render().loadConversations();
  fixture.requests[1].resolve(identity("Restored Name"));
  await newer;
  fixture.requests[0].resolve(identity("Person Not Available"));
  await older;
  const context = fixture.render();
  assert.equal(
    context.conversations[0].other_participant.display_name,
    "Restored Name",
  );
  assert.equal(context.conversations[0].id, "chat");
  assert.equal(context.syncState, "ready");
  fixture.runner.unmount();
});

test("late pre-unblock redaction cannot replace restored identity, even after unchanged polling", async () => {
  const fixture = await conversationFixture();
  const older = fixture.render().loadConversations();
  fixture.changeIncoming([]);
  await settle();
  assert.equal(fixture.requests.length, 2);
  fixture.requests[1].resolve(identity("Restored Name"));
  await settle();
  fixture.requests[0].resolve(identity("Person Not Available"));
  await older;
  const poll = [...fixture.runner.timers.values()].find(
    (timer) => timer.delay === 12000,
  );
  poll.callback();
  await settle();
  const context = fixture.render();
  assert.equal(context.isBlockedBy("peer"), false);
  assert.equal(
    context.conversations[0].other_participant.display_name,
    "Restored Name",
  );
  assert.equal(
    context.conversations[0].other_participant.avatar_url,
    "/peer.jpg",
  );
  assert.equal(fixture.requests.length, 2);
  fixture.runner.unmount();
});

test("local block and unblock refreshes reject late conversation responses in reverse order", async () => {
  const fixture = await conversationFixture();
  await fixture.render().blockUser("peer");
  assert.equal(fixture.requests.length, 1);
  await fixture.render().unblockUser("peer");
  assert.equal(fixture.requests.length, 2);
  fixture.requests[1].resolve(identity("Current Name"));
  await settle();
  fixture.requests[0].resolve(identity("Old Name"));
  await settle();
  assert.equal(
    fixture.render().conversations[0].other_participant.display_name,
    "Current Name",
  );
  fixture.runner.unmount();
});

test("stale conversation errors cannot log out or finish a newer refresh", async () => {
  const fixture = await conversationFixture();
  const older = fixture.render().loadConversations();
  const newer = fixture.render().loadConversations();
  fixture.requests[0].reject(new Error("401 session has expired"));
  await older;
  assert.equal(fixture.logoutCount(), 0);
  assert.equal(fixture.render().syncState, "updating");
  fixture.requests[1].resolve(identity("Current Name"));
  await newer;
  assert.equal(fixture.render().syncState, "ready");
  fixture.runner.unmount();
});

test("logout invalidates conversation results and old loaders before rerender", async () => {
  const fixture = await conversationFixture();
  const context = fixture.render();
  const pending = context.loadConversations();
  await context.logout();
  await context.loadConversations();
  assert.equal(fixture.requests.length, 1);
  fixture.requests[0].resolve(identity("Old Account"));
  await pending;
  assert.equal(fixture.render().conversations.length, 0);
  assert.equal(fixture.render().user, null);
  fixture.runner.unmount();
});

test("login invalidates old conversation results before the new auth effect starts", async () => {
  const fixture = await conversationFixture();
  const context = fixture.render();
  const pending = context.loadConversations();
  context.login({ userId: "other", token: "second-token" });
  fixture.requests[0].resolve(identity("Old Account"));
  await pending;
  assert.equal(fixture.render().conversations.length, 0);
  await settle();
  const latest = fixture.requests.at(-1);
  latest.resolve(identity("New Account"));
  await settle();
  for (const request of fixture.requests.slice(1, -1))
    request.resolve(identity("Stale New Account"));
  await settle();
  assert.equal(
    fixture.render().conversations[0].other_participant.display_name,
    "New Account",
  );
  fixture.runner.unmount();
});
