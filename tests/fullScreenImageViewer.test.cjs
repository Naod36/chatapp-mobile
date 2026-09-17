const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes } = require("./helpers.cjs");

// Tracks Animated.Value instances created during the *first* render of a
// component (mount). Subsequent re-renders re-evaluate `new Animated.Value(1)`
// as an argument expression before useRef's memoization check discards it, so
// we stop collecting once we have the three real ones (scale, translateX,
// translateY, in that construction order).
function makeValueTracker() {
  const instances = [];
  class TrackedValue {
    constructor(initial) {
      this.value = initial;
      if (instances.length < 3) instances.push(this);
    }
    setValue(v) {
      this.value = v;
    }
    stopAnimation() {}
    interpolate() {
      return 0;
    }
  }
  return { TrackedValue, instances };
}

function baseNativeMocks(TrackedValue, captureResponder) {
  return {
    "react-native": {
      Modal: "Modal",
      View: "View",
      Text: "Text",
      TouchableOpacity: "TouchableOpacity",
      FlatList: "FlatList",
      Animated: {
        Value: TrackedValue,
        Image: "AnimatedImage",
        spring: (value, config) => ({
          start: () => value.setValue(config.toValue),
        }),
        parallel: (animations) => ({
          start: () => animations.forEach((a) => a.start()),
        }),
      },
      PanResponder: {
        create: (config) => {
          captureResponder(config);
          return { panHandlers: config };
        },
      },
      StyleSheet: { create: (s) => s },
      Dimensions: { get: () => ({ width: 400, height: 800 }) },
      BackHandler: { addEventListener: () => ({ remove: () => {} }) },
      Platform: { OS: "ios" },
    },
    "../../services/api": { API_BASE: "http://test.invalid" },
  };
}

function setupZoomable() {
  const runner = harness();
  const { TrackedValue, instances } = makeValueTracker();
  let responderConfig;
  const mod = runner.load(
    "src/components/chat/FullScreenImageViewer.js",
    baseNativeMocks(TrackedValue, (config) => {
      responderConfig = config;
    }),
  );
  const props = (overrides) => ({
    uri: "http://test.invalid/img.jpg",
    width: 400,
    height: 800,
    isActive: true,
    ...overrides,
  });
  const render = (overrides) =>
    runner.render(() => mod.ZoomableImage(props(overrides)));
  return {
    runner,
    mod,
    render,
    values: instances,
    getResponder: () => responderConfig,
  };
}

function setupViewer(overrides = {}) {
  const runner = harness();
  const { TrackedValue } = makeValueTracker();
  const mod = runner.load(
    "src/components/chat/FullScreenImageViewer.js",
    baseNativeMocks(TrackedValue, () => {}),
  );
  const props = {
    visible: true,
    images: [],
    startIndex: 0,
    onClose: () => {},
    ...overrides,
  };
  const render = () => runner.render(() => mod.default(props));
  return { runner, mod, render };
}

const touch = (pageX, pageY) => ({ pageX, pageY });
const gesture = (touches, dx = 0, dy = 0) => [
  { nativeEvent: { touches } },
  { dx, dy },
];

test("getTouchDistance computes Euclidean distance and returns 0 for fewer than 2 touches", () => {
  const { mod } = setupZoomable();
  assert.equal(mod.getTouchDistance(undefined), 0);
  assert.equal(mod.getTouchDistance([]), 0);
  assert.equal(mod.getTouchDistance([touch(0, 0)]), 0);
  assert.equal(mod.getTouchDistance([touch(0, 0), touch(3, 4)]), 5);
});

test("clampScale clamps at both bounds and passes through in-range values", () => {
  const { mod } = setupZoomable();
  assert.equal(mod.clampScale(0.2, 1, 4), 1);
  assert.equal(mod.clampScale(10, 1, 4), 4);
  assert.equal(mod.clampScale(2.5, 1, 4), 2.5);
});

test("two-finger pinch scales the image via onPanResponderMove and clamps to MAX_SCALE", () => {
  const { render, getResponder, values } = setupZoomable();
  render();
  const responder = getResponder();
  const [grantEvt] = gesture([touch(0, 0), touch(0, 100)]);
  responder.onPanResponderGrant(grantEvt);
  const [moveEvt, moveState] = gesture([touch(0, 0), touch(0, 200)]);
  responder.onPanResponderMove(moveEvt, moveState);
  assert.equal(values[0].value, 2);
  const [bigMoveEvt, bigMoveState] = gesture([touch(0, 0), touch(0, 900)]);
  responder.onPanResponderMove(bigMoveEvt, bigMoveState);
  assert.equal(values[0].value, 4);
});

test("double-tap zooms to ~2.5x and a following double-tap zooms back to 1x", () => {
  let now = 1_000_000;
  const FakeDate = { now: () => now };
  const runner = harness();
  const { TrackedValue, instances } = makeValueTracker();
  const mod = runner.load(
    "src/components/chat/FullScreenImageViewer.js",
    baseNativeMocks(TrackedValue, () => {}),
    { Date: FakeDate },
  );
  const tree = runner.render(() =>
    mod.ZoomableImage({
      uri: "http://test.invalid/img.jpg",
      width: 400,
      height: 800,
      isActive: true,
    }),
  );
  const tap = nodes(tree).find((n) => n.type === "TouchableOpacity").props
    .onPress;

  tap();
  now += 100;
  tap();
  assert.equal(instances[0].value, 2.5);

  now += 100;
  tap();
  now += 100;
  tap();
  assert.equal(instances[0].value, 1);
});

test("zoom and pan reset when isActive becomes false", () => {
  const { render, getResponder, values } = setupZoomable();
  render({ isActive: true });
  const responder = getResponder();
  const [grantEvt] = gesture([touch(0, 0), touch(0, 100)]);
  responder.onPanResponderGrant(grantEvt);
  const [moveEvt, moveState] = gesture([touch(0, 0), touch(0, 200)]);
  responder.onPanResponderMove(moveEvt, moveState);
  assert.equal(values[0].value, 2);

  render({ isActive: false });
  assert.equal(values[0].value, 1);
  assert.equal(values[1].value, 0);
  assert.equal(values[2].value, 0);
});

test("counter shows 'N / M' only with more than one image, close button fires onClose, and starts at startIndex", () => {
  let closed = 0;
  const images = [
    { id: "1", media_url: "/a.jpg" },
    { id: "2", media_url: "/b.jpg" },
  ];
  const { render } = setupViewer({
    images,
    startIndex: 1,
    onClose: () => closed++,
  });
  const tree = render();

  const texts = nodes(tree)
    .filter((n) => n.type === "Text")
    .flatMap((n) => n.props.children);
  assert.ok(texts.includes("2 / 2"));

  const closeBtn = nodes(tree).find(
    (n) =>
      n.type === "TouchableOpacity" &&
      n.props.accessibilityLabel === "Close image viewer",
  );
  assert.ok(closeBtn);
  closeBtn.props.onPress();
  assert.equal(closed, 1);

  const flatList = nodes(tree).find((n) => n.type === "FlatList");
  assert.equal(flatList.props.initialScrollIndex, 1);
  assert.equal(flatList.props.data.length, 2);
});

test("counter is hidden when there is only one image", () => {
  const images = [{ id: "1", media_url: "/a.jpg" }];
  const { render } = setupViewer({ images });
  const tree = render();
  const counter = nodes(tree).find(
    (n) =>
      typeof n.props.accessibilityLabel === "string" &&
      n.props.accessibilityLabel.startsWith("Image "),
  );
  assert.equal(counter, undefined);
});
