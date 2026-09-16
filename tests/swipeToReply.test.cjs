const assert = require("node:assert/strict");
const test = require("node:test");
const { harness } = require("./helpers.cjs");

function setup() {
  const runner = harness();
  let handlers;
  let offset = 0;
  let replies = 0;
  const component = runner.load("src/components/chat/SwipeToReply.js", {
    "react-native": {
      View: "View",
      StyleSheet: { create: (value) => value },
      PanResponder: {
        create: (value) => {
          handlers = value;
          return { panHandlers: value };
        },
      },
      Animated: {
        View: "AnimatedView",
        Value: class {
          setValue(value) {
            offset = value;
          }
          stopAnimation() {}
          interpolate() {
            return 0;
          }
        },
        spring: (value, config) => ({
          start: () => value.setValue(config.toValue),
        }),
      },
    },
    "react-native-svg": { default: "Svg", Path: "Path" },
  }).default;
  const render = (enabled = true, onReply = () => replies++) =>
    runner.render(() => component({ enabled, onReply, color: "blue" }));
  render();
  return { handlers, render, replies: () => replies, offset: () => offset };
}

const gesture = (dx, dy = 0, numberActiveTouches = 1) => ({
  dx,
  dy,
  numberActiveTouches,
});

test("captures only deliberate single-finger right swipes", () => {
  const { handlers } = setup();
  const captures = handlers.onMoveShouldSetPanResponderCapture;
  assert.equal(captures(null, gesture(20)), true);
  for (const movement of [
    gesture(5),
    gesture(-70),
    gesture(20, 60),
    gesture(20, 0, 2),
  ]) {
    assert.equal(captures(null, movement), false);
  }
});

test("replies once on threshold release and clamps and resets translation", () => {
  const state = setup();
  state.handlers.onPanResponderGrant();
  state.handlers.onPanResponderMove(null, gesture(150));
  assert.equal(state.offset(), 88);
  assert.equal(state.replies(), 0);
  state.handlers.onPanResponderRelease(null, gesture(70));
  state.handlers.onPanResponderRelease(null, gesture(70));
  assert.equal(state.replies(), 1);
  assert.equal(state.offset(), 0);
});

test("short, vertical, interrupted and multitouch gestures never reply", () => {
  for (const mode of ["short", "vertical", "terminated", "multitouch"]) {
    const state = setup();
    state.handlers.onPanResponderGrant();
    if (mode === "terminated") state.handlers.onPanResponderTerminate();
    if (mode === "multitouch")
      state.handlers.onPanResponderMove(null, gesture(80, 0, 2));
    state.handlers.onPanResponderRelease(
      null,
      gesture(mode === "short" ? 63 : 80, mode === "vertical" ? 90 : 0),
    );
    assert.equal(state.replies(), 0, mode);
    assert.equal(state.offset(), 0, mode);
  }
});

test("blocking mid-swipe cancels reply and latest callback is used", () => {
  const state = setup();
  state.handlers.onPanResponderGrant();
  state.render(false);
  state.handlers.onPanResponderRelease(null, gesture(80));
  assert.equal(state.replies(), 0);
  assert.equal(
    state.handlers.onMoveShouldSetPanResponderCapture(null, gesture(80)),
    false,
  );
  let latestReplies = 0;
  state.render(true, () => latestReplies++);
  state.handlers.onPanResponderGrant();
  state.handlers.onPanResponderRelease(null, gesture(80));
  assert.equal(latestReplies, 1);
});
