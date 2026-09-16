const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes } = require("./helpers.cjs");

test("refresh badge uses the existing indicator and restores the normal states", () => {
  const runner = harness();
  const { default: Badge } = runner.load("src/components/common/SyncBadge.js", {
    "react-native": {
      View: "View",
      Text: "Text",
      StyleSheet: { create: (styles) => styles },
      Animated: {
        View: "AnimatedView",
        Value: function (value) {
          this.value = value;
        },
        timing: () => ({}),
        sequence: () => ({}),
        loop: () => ({ start() {}, stop() {} }),
      },
    },
  });
  for (const [syncState, expected] of [
    ["refreshing", "Refreshing..."],
    ["connecting", "Connecting..."],
    ["updating", "Updating..."],
  ]) {
    const tree = runner.render(() => Badge({ syncState, theme: {} }));
    assert.ok(
      nodes(tree).some(
        (node) =>
          node.type === "Text" && node.props.children.includes(expected),
      ),
    );
  }
  assert.equal(
    runner.render(() => Badge({ syncState: "ready", theme: {} })),
    null,
  );
  runner.unmount();
});
