const { test } = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes } = require("./helpers.cjs");

test("mobile settings save visibility and presets, sync another device, and show errors", async () => {
  const runner = harness();
  let listener;
  let saved;
  let fail = false;
  const { default: Settings } = runner.load(
    "src/components/common/PresenceSettings.js",
    {
      "react-native": Object.fromEntries(
        [
          "View",
          "Text",
          "TextInput",
          "Switch",
          "TouchableOpacity",
          "Modal",
          "ScrollView",
        ].map((name) => [name, name]),
      ),
      "../../utils/presence": runner.load("src/utils/presence.js"),
      "../../services/user": {
        userService: {
          getProfile: async () => ({
            user_id: "self",
            presence_visibility: "default",
          }),
          updatePresence: async (value) => {
            if (fail) throw new Error("Unavailable");
            saved = value;
            return value;
          },
        },
      },
      "../../services/websocket": {
        websocketService: {
          subscribe: (callback) => {
            listener = callback;
          },
          unsubscribe: () => {
            listener = null;
          },
        },
      },
    },
  );
  const render = () =>
    runner.render(() => Settings({ visible: true, theme: {} }));
  render();
  await Promise.resolve();
  let tree = render();
  const control = (label) =>
    nodes(tree).find((node) => node.props.accessibilityLabel === label);
  const button = (label) =>
    nodes(tree).find(
      (node) =>
        node.type === "TouchableOpacity" &&
        nodes(node).some(
          (child) =>
            child.type === "Text" &&
            child.props.children.flat().includes(label),
        ),
    );
  control("Invisible").props.onValueChange(true);
  tree = render();
  control("Status preset").props.onPress();
  tree = render();
  button("Busy").props.onPress();
  tree = render();
  await button("Save status").props.onPress();
  tree = render();
  assert.equal(saved.presence_visibility, "invisible");
  assert.equal(saved.custom_status, "Busy");
  assert.equal(saved.status_expires_at, null);
  listener({
    event: "user_status",
    user_id: "self",
    presence_visibility: "default",
    custom_status: "Sleeping",
  });
  tree = render();
  assert.equal(control("Custom status").props.value, "Sleeping");
  assert.equal(control("Invisible").props.value, false);
  fail = true;
  await button("Save status").props.onPress();
  tree = render();
  assert.ok(
    nodes(tree).some(
      (node) =>
        node.type === "Text" && node.props.children.includes("Unavailable"),
    ),
  );
  runner.unmount();
  assert.equal(listener, null);
});
