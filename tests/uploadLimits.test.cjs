const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes, settle } = require("./helpers.cjs");

test("uploadLimits: isOversizedUpload matches the real 50MB backend limit", () => {
  const runner = harness();
  const { MAX_UPLOAD_BYTES, isOversizedUpload } = runner.load(
    "src/utils/uploadLimits.js",
  );
  assert.equal(MAX_UPLOAD_BYTES, 50_000_000);
  assert.equal(isOversizedUpload(50_000_000), false);
  assert.equal(isOversizedUpload(50_000_001), true);
  assert.equal(isOversizedUpload(undefined), false);
  assert.equal(isOversizedUpload(null), false);
});

test("api.js's 413 message matches the real 50MB limit, not the old stale 25MB text", async () => {
  const runner = harness();
  const { apiFetch } = runner.load(
    "src/services/api.js",
    {
      "@react-native-async-storage/async-storage": {
        getItem: async () => null,
      },
      "./session.js": { expireSession: async () => {} },
    },
    {
      fetch: async () => ({
        ok: false,
        status: 413,
        headers: { get: () => "application/json" },
        json: async () => ({}),
      }),
    },
  );
  await assert.rejects(
    () => apiFetch("/upload"),
    (err) => {
      assert.match(err.message, /50 MB/);
      assert.doesNotMatch(err.message, /25 ?MB/);
      return true;
    },
  );
});

function messageInputMocks({
  launchImageLibraryAsync,
  getDocumentAsync,
  alerts = [],
} = {}) {
  const native = Object.fromEntries(
    [
      "View",
      "Text",
      "TextInput",
      "TouchableOpacity",
      "Image",
      "Modal",
      "TouchableWithoutFeedback",
      "ActivityIndicator",
    ].map((name) => [name, name]),
  );
  Object.assign(native, {
    StyleSheet: { create: (styles) => styles },
    Platform: { OS: "android" },
    Keyboard: { addListener: () => ({ remove() {} }) },
    Alert: { alert: (...args) => alerts.push(args) },
  });
  return {
    "../../services/notices": { alert: (...args) => alerts.push(args) },
    "react-native": native,
    "react-native-svg": {
      __esModule: true,
      default: "Svg",
      Path: "Path",
      Line: "Line",
      Circle: "Circle",
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ bottom: 0 }),
    },
    "expo-image-picker": {
      requestMediaLibraryPermissionsAsync: async () => ({ status: "granted" }),
      launchImageLibraryAsync,
    },
    "expo-document-picker": { getDocumentAsync },
    "rn-emoji-keyboard": { __esModule: true, default: "EmojiPicker" },
    "expo-blur": { BlurView: "BlurView" },
  };
}

function setupMessageInput({ pickerResult, documentResult } = {}) {
  const runner = harness();
  const alerts = [];
  const attachments = [];
  const multi = [];
  const launchImageLibraryAsync = async () => pickerResult;
  const getDocumentAsync = async () => documentResult;
  const { default: Input } = runner.load(
    "src/components/chat/MessageInput.js",
    messageInputMocks({ launchImageLibraryAsync, getDocumentAsync, alerts }),
  );
  const props = {
    value: "",
    theme: {},
    disabled: false,
    onSelectAttachment: (a) => attachments.push(a),
    onSelectMultipleImages: (a) => multi.push(a),
    assertInteractionAllowed() {},
  };
  const tree = runner.render(() => Input(props));
  const findByPress = (name) =>
    nodes(tree).find((node) => node.props?.onPress?.name === name);
  return {
    pickImageBtn: findByPress("handlePickImage"),
    pickDocBtn: findByPress("handlePickDocument"),
    attachments,
    multi,
    alerts,
  };
}

const OVER_LIMIT = 50_000_001;
const UNDER_LIMIT = 40_000_000;

test("a single oversized image is rejected client-side with a friendly alert, never reaching onSelectAttachment", async () => {
  const { pickImageBtn, attachments, alerts } = setupMessageInput({
    pickerResult: {
      canceled: false,
      assets: [
        {
          uri: "file://big.jpg",
          fileName: "big.jpg",
          type: "image",
          fileSize: OVER_LIMIT,
        },
      ],
    },
  });
  await pickImageBtn.props.onPress();
  await settle();
  assert.equal(attachments.length, 0);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0][0], "File too large");
  assert.match(alerts[0][1], /50 MB/);
});

test("an under-limit single image still attaches normally", async () => {
  const { pickImageBtn, attachments, alerts } = setupMessageInput({
    pickerResult: {
      canceled: false,
      assets: [
        {
          uri: "file://ok.jpg",
          fileName: "ok.jpg",
          type: "image",
          fileSize: UNDER_LIMIT,
        },
      ],
    },
  });
  await pickImageBtn.props.onPress();
  await settle();
  assert.equal(attachments.length, 1);
  assert.equal(alerts.length, 0);
});

test("in a multi-image batch, oversized images are skipped and the rest still send", async () => {
  const { pickImageBtn, multi, alerts } = setupMessageInput({
    pickerResult: {
      canceled: false,
      assets: [
        {
          uri: "file://a.jpg",
          fileName: "a.jpg",
          type: "image",
          fileSize: UNDER_LIMIT,
        },
        {
          uri: "file://big.jpg",
          fileName: "big.jpg",
          type: "image",
          fileSize: OVER_LIMIT,
        },
        {
          uri: "file://b.jpg",
          fileName: "b.jpg",
          type: "image",
          fileSize: UNDER_LIMIT,
        },
      ],
    },
  });
  await pickImageBtn.props.onPress();
  await settle();
  assert.equal(multi.length, 1);
  assert.deepEqual(
    multi[0].map((e) => e.name),
    ["a.jpg", "b.jpg"],
  );
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0][0], "File too large");
  assert.match(alerts[0][1], /1 of 3/);
});

test("an oversized document is rejected client-side with a friendly alert", async () => {
  const { pickDocBtn, attachments, alerts } = setupMessageInput({
    documentResult: {
      canceled: false,
      assets: [
        { uri: "file://report.pdf", name: "report.pdf", size: OVER_LIMIT },
      ],
    },
  });
  await pickDocBtn.props.onPress();
  await settle();
  assert.equal(attachments.length, 0);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0][0], "File too large");
  assert.match(alerts[0][1], /50 MB/);
});

test("an under-limit document still attaches normally", async () => {
  const { pickDocBtn, attachments, alerts } = setupMessageInput({
    documentResult: {
      canceled: false,
      assets: [
        { uri: "file://report.pdf", name: "report.pdf", size: UNDER_LIMIT },
      ],
    },
  });
  await pickDocBtn.props.onPress();
  await settle();
  assert.equal(attachments.length, 1);
  assert.equal(alerts.length, 0);
});
