const { test } = require("node:test");
const assert = require("node:assert/strict");
const { isFolderSwipe, swipedFolder } = require("../src/utils/folderSwipe");
const folders = ["all", "unread", "chats", "groups"];
const left = { dx: -80, dy: 6, numberActiveTouches: 1 };
const right = { dx: 80, dy: 6, numberActiveTouches: 1 };

test("left advances and right goes back without wrapping", () => {
  assert.equal(swipedFolder(folders, "all", left), "unread");
  assert.equal(swipedFolder(folders, "unread", left), "chats");
  assert.equal(swipedFolder(folders, "chats", left), "groups");
  assert.equal(swipedFolder(folders, "groups", left), "groups");
  assert.equal(swipedFolder(folders, "groups", right), "chats");
  assert.equal(swipedFolder(folders, "all", right), "all");
});

test("vertical scrolling, short drags, and multi-touch do not claim paging", () => {
  assert.equal(isFolderSwipe(left), true);
  assert.equal(
    isFolderSwipe({ dx: 10, dy: 90, numberActiveTouches: 1 }),
    false,
  );
  assert.equal(isFolderSwipe({ ...left, numberActiveTouches: 2 }), false);
  assert.equal(swipedFolder(folders, "all", { dx: -30, dy: 0 }), "all");
  assert.equal(swipedFolder(folders, "all", { dx: -60, dy: 80 }), "all");
});
