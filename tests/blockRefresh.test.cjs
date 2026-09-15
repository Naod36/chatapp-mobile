const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createBlockRefresh } = require("../src/utils/blockRefresh");

test("overlapping event/poll refreshes skip stale results and coalesce", async () => {
  const requests = [];
  const applied = [];
  const sync = createBlockRefresh(() => new Promise((resolve) => requests.push(resolve)), (value) => applied.push(value));
  const pending = sync.refresh();
  sync.refresh();
  sync.refresh();
  assert.equal(requests.length, 1);
  requests[0]("stale");
  await Promise.resolve();
  assert.equal(requests.length, 2);
  requests[1]("current");
  await pending;
  assert.deepEqual(applied, ["current"]);
  sync.stop();
});

test("logout discards an in-flight result and aborts its request", async () => {
  let resolveRequest;
  let requestSignal;
  const applied = [];
  const sync = createBlockRefresh((signal) => {
    requestSignal = signal;
    return new Promise((resolve) => { resolveRequest = resolve; });
  }, (value) => applied.push(value));
  const pending = sync.refresh();
  sync.stop();
  resolveRequest("old account");
  await pending;
  assert.equal(requestSignal.aborted, true);
  assert.deepEqual(applied, []);
});