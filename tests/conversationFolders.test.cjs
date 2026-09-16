const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes } = require("./helpers.cjs");

function setup() {
  return harness().load("src/components/conversations/ConversationFolders.js", {
    "react-native": {
      ScrollView: "ScrollView",
      Text: "Text",
      TouchableOpacity: "TouchableOpacity",
      StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
    },
  });
}

test("folders separate chats and groups and leave the source list unchanged", () => {
  const { conversationsInFolder } = setup();
  const conversations = [
    { id: "private", type: "direct" },
    { conversation_id: "group", type: "group" },
    { id: "future", type: "channel" },
  ];
  const ids = (folder) =>
    Array.from(
      conversationsInFolder(conversations, folder),
      (item) => item.id || item.conversation_id,
    );
  assert.deepEqual(ids("all"), ["private", "group", "future"]);
  assert.deepEqual(ids("chats"), ["private"]);
  assert.deepEqual(ids("groups"), ["group"]);
  assert.deepEqual(ids("unknown"), ids("all"));
  assert.equal(conversations.length, 3);
  assert.equal(conversations[0].id, "private");
  assert.equal(conversationsInFolder([], "groups").length, 0);
});

test("pinned ordering is preserved inside each folder without changing recency order", () => {
  const { conversationsInFolder } = setup();
  const conversations = [
    { id: "recent", type: "direct" },
    { id: "older", type: "direct" },
    { id: 3, type: "direct" },
    { conversation_id: "group", type: "group" },
  ];
  const result = conversationsInFolder(conversations, "chats", ["group", "3"]);
  assert.deepEqual(
    Array.from(result, (item) => item.id),
    [3, "recent", "older"],
  );
  assert.equal(conversations[0].id, "recent");
});

test("tabs expose their selection and switch folders", () => {
  const { default: Folders, CONVERSATION_FOLDERS } = setup();
  let selectedId = "all";
  for (const folder of CONVERSATION_FOLDERS) {
    const tree = Folders({
      selectedId,
      onSelect: (id) => {
        selectedId = id;
      },
      theme: {},
    });
    const tabs = nodes(tree).filter(
      (node) => node.props.accessibilityRole === "tab",
    );
    assert.equal(tabs.length, 3);
    assert.equal(
      tabs.filter((tab) => tab.props.accessibilityState.selected).length,
      1,
    );
    tabs
      .find((tab) => tab.props.accessibilityLabel === folder.label)
      .props.onPress();
    assert.equal(selectedId, folder.id);
  }
});
