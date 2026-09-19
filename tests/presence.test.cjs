const { test } = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./helpers.cjs");
const { presenceLabel, customStatus, applyPresence, statusExpiry } =
  harness().load("src/utils/presence.js");

test("invisible hides online and last seen while retaining informational status", () => {
  assert.equal(
    presenceLabel({
      presence_visibility: "invisible",
      status: "online",
      last_seen: "yesterday",
      custom_status: "Busy",
    }),
    "Busy · Status unavailable",
  );
  assert.equal(presenceLabel({ status: "online" }), "Online");
  assert.equal(
    presenceLabel(
      { status: "offline", last_seen: "yesterday" },
      (date) => `Last seen ${date}`,
    ),
    "Last seen yesterday",
  );
});

test("expiry and blocking clear status text", () => {
  assert.equal(
    customStatus({
      custom_status: "Sleeping",
      status_expires_at: "2020-01-01",
    }),
    "",
  );
  assert.equal(
    customStatus({ custom_status: "Busy", identity_hidden: true }),
    "",
  );
  assert.equal(statusExpiry("8", null, 0), "1970-01-01T08:00:00.000Z");
  assert.equal(statusExpiry("never"), null);
  const { redactUser } = require("../src/utils/blockPolicy.js");
  const hidden = redactUser(
    {
      user_id: "peer",
      custom_status: "Busy",
      status_emoji: "!",
      status_expires_at: "2099-01-01",
    },
    () => true,
  );
  assert.equal(hidden.custom_status, "");
  assert.equal(hidden.status_emoji, "");
  assert.equal(hidden.status_expires_at, null);
});

test("realtime updates clear last seen and update group participants", () => {
  const peer = { user_id: "peer", status: "online", last_seen: "yesterday" };
  const result = applyPresence(
    { other_participant: peer, participants: [peer] },
    {
      user_id: "peer",
      status: "hidden",
      last_seen: null,
      custom_status: "Away",
    },
  );
  assert.equal(result.other_participant.last_seen, null);
  assert.equal(result.participants[0].custom_status, "Away");
});
