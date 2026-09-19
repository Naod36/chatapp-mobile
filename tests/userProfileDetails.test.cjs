const { test } = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes } = require("./helpers.cjs");
function setup() {
  const runner = harness();
  return runner.load("src/components/chat/ChatHeader.js", {
    "react-native": {
      View: "View",
      Text: "Text",
      TouchableOpacity: "Button",
      Modal: "Modal",
      ScrollView: "ScrollView",
      Platform: { OS: "android" },
      StyleSheet: { create: (value) => value },
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
    },
    "expo-blur": { BlurView: "BlurView" },
    "react-native-svg": {
      __esModule: true,
      default: "Svg",
      Circle: "Circle",
      Path: "Path",
    },
    "../common/Avatar": { __esModule: true, default: "Avatar" },
    "../../context/AppContext": {
      useApp: () => ({ theme: {}, getPresence: () => "offline" }),
    },
  });
}
test("both header name and avatar open the same profile and group actions remain distinct", () => {
  const { default: Header } = setup();
  let presses = 0;
  const onTitlePress = () => {
    presses++;
  };
  const tree = Header({
    conversation: { type: "direct", other_participant: { username: "peer" } },
    onTitlePress,
  });
  const actions = nodes(tree).filter((node) =>
    node.props.accessibilityLabel?.startsWith("Open user profile"),
  );
  assert.equal(actions.length, 2);
  actions.forEach((node) => node.props.onPress());
  assert.equal(presses, 2);
  assert.ok(
    nodes(Header({ conversation: { type: "group" }, onTitlePress })).some(
      (node) => node.props.accessibilityLabel === "Open group info",
    ),
  );
  assert.equal(
    nodes(Header({ conversation: { type: "direct" } })).filter((node) =>
      node.props.accessibilityLabel?.startsWith("Open user profile"),
    ).length,
    0,
  );
});
test("profile displays public fields only and redacts unavailable people", () => {
  const { UserProfileDetails } = setup();
  const person = {
    username: "peer",
    display_name: "Peer Name",
    bio: "Public bio",
    email: "private@example.com",
    phone: "secret-number",
  };
  let closed = false;
  const props = {
    person,
    visible: true,
    theme: {},
    onClose: () => {
      closed = true;
    },
  };
  const tree = UserProfileDetails(props);
  const text = (value) =>
    nodes(value)
      .filter((node) => node.type === "Text")
      .map((node) => node.props.children.flat().join(""))
      .join(" ");
  assert.match(text(tree), /Peer Name.*@peer.*Public bio/);
  assert.doesNotMatch(text(tree), /private@example.com|secret-number/);
  assert.doesNotMatch(
    text(UserProfileDetails({ ...props, unavailable: true })),
    /Peer Name|Public bio|@peer/,
  );
  nodes(tree)
    .find((node) => node.props.accessibilityLabel === "Close profile")
    .props.onPress();
  assert.equal(closed, true);
});
