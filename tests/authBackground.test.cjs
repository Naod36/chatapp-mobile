const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes } = require("./helpers.cjs");

test("login gradient stays outside the viewport throughout its drift", () => {
  const runner = harness();
  const { AuthBackground } = runner.load(
    "src/components/common/AuthMotion.js",
    {
      "react-native": {
        View: "View",
        StyleSheet: { absoluteFill: {} },
        Easing: { sin: {}, inOut: () => ({}) },
        Animated: {
          View: "AnimatedView",
          Value: function () {
            this.interpolate = (config) => config;
            this.setValue = () => {};
          },
          timing: () => ({}),
          sequence: () => ({}),
          loop: () => ({ start() {}, stop() {} }),
        },
      },
      "react-native-svg": {
        __esModule: true,
        default: "Svg",
        Defs: "Defs",
        RadialGradient: "RadialGradient",
        Rect: "Rect",
        Stop: "Stop",
      },
    },
  );
  const tree = runner.render(() =>
    AuthBackground({ theme: {}, reducedMotion: false }),
  );
  const style = nodes(tree).find((node) => node.type === "AnimatedView").props
    .style;
  assert.equal(
    style.transform.some((transform) => "rotate" in transform),
    false,
  );
  const horizontal = style.transform.find((transform) => transform.translateX)
    .translateX.outputRange;
  const vertical = style.transform.find((transform) => transform.translateY)
    .translateY.outputRange;
  for (const offset of horizontal) {
    assert.ok(style.left + offset < 0);
    assert.ok(style.right - offset < 0);
  }
  for (const offset of vertical) {
    assert.ok(style.top + offset < 0);
    assert.ok(style.bottom - offset < 0);
  }
  assert.equal(tree.props.pointerEvents, "none");
  runner.unmount();
});
