const { test } = require("node:test");
const assert = require("node:assert/strict");
const { blockPolicy } = require("../src/utils/blockPolicy");
const { redactMessage, UNAVAILABLE_NAME } = require("../src/utils/blockPolicy");
const { redactUser } = require("../src/utils/blockPolicy");

test("cached search and group participants lose all displayed identity fallbacks", () => {
  const person = { user_id: "A", username: "secret", display_name: "Secret Name", avatar_url: "private.jpg", status: "online", last_seen: "today" };
  const result = redactUser(person, (identity) => identity === "A");
  assert.equal(result.display_name, UNAVAILABLE_NAME);
  assert.equal(result.username, UNAVAILABLE_NAME);
  assert.equal(result.avatar_url, null);
  assert.equal(result.status, "offline");
  assert.equal(result.last_seen, null);
  assert.equal(redactUser(person, () => false), person);
});

test("messages, replies and pin identities redact directionally without deleting history", () => {
  const original = { sender_id: "B", sender_name: "Bee", content: "history", pinned_by_user_id: "A", pinned_by_name: "Ay",
    reply_to: { sender_id: "A", sender_name: "Ay", sender_avatar: "private.jpg", content: "quoted history" } };
  const result = redactMessage(original, (identity) => identity === "A");
  assert.equal(result.sender_name, "Bee");
  assert.equal(result.content, "history");
  assert.equal(result.pinned_by_name, UNAVAILABLE_NAME);
  assert.equal(result.reply_to.sender_name, UNAVAILABLE_NAME);
  assert.equal(result.reply_to.sender_avatar, null);
  assert.equal(result.reply_to.content, "quoted history");
  assert.equal(original.reply_to.sender_name, "Ay");
});

test("A blocks B: A sees B normally but cannot interact directly", () => {
  assert.deepEqual(blockPolicy("B", ["B"], []), {
    hideIdentity: false, preventDirectInteraction: true, canUnblock: true,
  });
});

test("A blocks B: B cannot see A's identity or interact directly", () => {
  assert.deepEqual(blockPolicy("A", [], ["A"]), {
    hideIdentity: true, preventDirectInteraction: true, canUnblock: false,
  });
});

test("mutual blocks keep own unblock available", () => {
  assert.deepEqual(blockPolicy(7, ["7"], ["7"]), {
    hideIdentity: true, preventDirectInteraction: true, canUnblock: true,
  });
  assert.equal(blockPolicy(7, [], ["7"]).preventDirectInteraction, true);
});

test("groups remain usable but incoming blocker identities stay hidden", () => {
  assert.deepEqual(blockPolicy("A", ["A"], ["A"], true), {
    hideIdentity: true, preventDirectInteraction: false, canUnblock: true,
  });
  assert.equal(blockPolicy("B", ["B"], [], true).hideIdentity, false);
  assert.equal(blockPolicy("A", [], []).preventDirectInteraction, false);
});