const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes } = require("./helpers.cjs");
const notices = require("../src/services/notices");
const fs = require("node:fs");
const path = require("node:path");
const parser = require("@babel/parser");

test("app source never imports native Alert", () => {
  const root = path.resolve(__dirname, "../src");
  for (const name of fs.readdirSync(root, { recursive: true })) {
    if (!name.endsWith(".js")) continue;
    const ast = parser.parse(fs.readFileSync(path.join(root, name), "utf8"), {
      sourceType: "unambiguous",
      plugins: ["jsx"],
    });
    for (const statement of ast.program.body) {
      if (
        statement.type !== "ImportDeclaration" ||
        statement.source.value !== "react-native"
      )
        continue;
      assert.equal(
        statement.specifiers.some(
          (specifier) => specifier.imported?.name === "Alert",
        ),
        false,
        name,
      );
    }
  }
});

test("confirmations remain actionable in a safe-area bottom sheet", () => {
  const runner = harness();
  let confirmed = 0;
  let cancelled = 0;
  const Dialog = runner.load("src/components/common/ConfirmDialog.js", {
    "react-native": {
      Modal: "Modal",
      View: "View",
      Text: "Text",
      TouchableOpacity: "Button",
      ScrollView: "ScrollView",
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 24, bottom: 34 }),
    },
  }).default;
  const tree = runner.render(() =>
    Dialog({
      visible: true,
      theme: {},
      onConfirm: () => confirmed++,
      onCancel: () => cancelled++,
    }),
  );
  assert.equal(tree.props.children[0].props.style.justifyContent, "flex-end");
  assert.equal(tree.props.children[0].props.style.paddingBottom, 34);
  const buttons = nodes(tree).filter((node) => node.type === "Button");
  assert.ok(buttons.every((button) => button.props.style.minHeight === 48));
  buttons[1].props.onPress();
  assert.equal(confirmed, 1);
  tree.props.onRequestClose();
  assert.equal(cancelled, 1);
});

test("notices queue, preserve actions, and ignore repeated presses", () => {
  let deleted = 0;
  let cancelled = 0;
  const received = [];
  const unsubscribe = notices.subscribe((notice) => received.push(notice));
  const remove = {
    text: "Delete",
    style: "destructive",
    onPress: () => deleted++,
  };
  notices.alert("Delete?", "This cannot be undone", [
    { text: "Cancel", style: "cancel", onPress: () => cancelled++ },
    remove,
  ]);
  const first = notices.getNotice();
  notices.alert("Upload Error", "Check your connection");
  assert.equal(notices.getNotice(), first);
  notices.dismissNotice(first.id);
  assert.equal(deleted, 0);
  assert.equal(cancelled, 1);
  notices.dismissNotice(first.id, remove);
  assert.equal(deleted, 0);
  const second = notices.getNotice();
  assert.equal(second.title, "Upload Error");
  notices.dismissNotice(second.id);
  notices.alert("Delete?", "", [remove]);
  notices.dismissNotice(notices.getNotice().id, remove);
  assert.equal(deleted, 1);
  assert.equal(notices.getNotice(), null);
  unsubscribe();
  assert.equal(received.at(-1), null);
});

test("notice is themed, top aligned, safe-area aware and dismissible", () => {
  const runner = harness();
  const theme = {
    cardBg: "#123456",
    text: "#ffffff",
    textMuted: "#eeeeee",
    accent: "#abcdef",
  };
  const Host = runner.load("src/components/common/NoticeHost.js", {
    "react-native": {
      Modal: "Modal",
      View: "View",
      Text: "Text",
      TouchableOpacity: "Button",
      ScrollView: "ScrollView",
      StyleSheet: { create: (styles) => styles },
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 24, bottom: 16 }),
    },
    "../../context/AppContext": { useApp: () => ({ theme }) },
    "../../services/notices": notices,
  }).default;
  runner.render(Host);
  notices.alert("Upload Error", "Check your connection");
  const tree = runner.render(Host);
  const overlay = tree.props.children[0];
  const style = Object.assign({}, ...overlay.props.style);
  assert.equal(style.justifyContent, "flex-start");
  assert.equal(style.paddingTop, 36);
  const panel = overlay.props.children[0];
  assert.equal(
    Object.assign({}, ...panel.props.style).backgroundColor,
    theme.cardBg,
  );
  const dismiss = nodes(tree).find((node) => node.type === "Button");
  assert.equal(dismiss.props.style.minHeight, 48);
  dismiss.props.onPress();
  assert.equal(runner.render(Host), null);
  runner.unmount();
});
