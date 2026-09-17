const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes, settle } = require("./helpers.cjs");

// Recursively looks for a TouchableOpacity whose nested text content includes `text`.
// Needed for elements (like the sign-up/sign-in switch link) that don't carry an
// accessibilityLabel, since nodes()/accessibilityLabel lookups won't find them.
function findByText(tree, text) {
  const stack = [tree];
  while (stack.length) {
    const item = stack.pop();
    if (Array.isArray(item)) {
      stack.push(...item);
      continue;
    }
    if (!item || typeof item !== "object") continue;
    if (item.type === "TouchableOpacity") {
      const substack = [item.props?.children];
      while (substack.length) {
        const sub = substack.pop();
        if (Array.isArray(sub)) {
          substack.push(...sub);
          continue;
        }
        if (typeof sub === "string" && sub.includes(text)) return item;
        if (sub && typeof sub === "object") substack.push(sub.props?.children);
      }
    }
    stack.push(item.props?.children);
  }
  return undefined;
}

function loadLoginScreen(authService) {
  const runner = harness();
  const native = Object.fromEntries(
    [
      "View",
      "Text",
      "TextInput",
      "TouchableOpacity",
      "ActivityIndicator",
      "ScrollView",
      "Image",
      "KeyboardAvoidingView",
    ].map((name) => [name, name]),
  );
  Object.assign(native, {
    StyleSheet: { create: (styles) => styles },
    Platform: { OS: "web" },
    Dimensions: { get: () => ({ width: 375, height: 812 }) },
    Alert: { alert() {} },
    AccessibilityInfo: {
      isReduceMotionEnabled: async () => true,
      addEventListener: () => ({ remove() {} }),
    },
    Animated: {
      View: "AnimatedView",
      Value: function (initial) {
        this._value = initial;
        this.setValue = () => {};
        this.interpolate = (config) => config;
      },
      timing: () => ({ start() {}, stop() {} }),
      spring: () => ({ start() {}, stop() {} }),
      sequence: () => ({ start() {}, stop() {} }),
      stagger: () => ({ start() {}, stop() {} }),
      parallel: () => ({ start() {}, stop() {} }),
      loop: () => ({ start() {}, stop() {} }),
    },
  });
  const { default: LoginScreen } = runner.load("src/screens/LoginScreen.js", {
    "react-native": native,
    "expo-web-browser": { maybeCompleteAuthSession: () => {} },
    "expo-auth-session": {
      useAutoDiscovery: () => ({}),
      makeRedirectUri: () => "redirect://",
      useAuthRequest: () => [{}, null, () => {}],
    },
    "@react-native-google-signin/google-signin": {
      GoogleSignin: {
        configure() {},
        hasPlayServices: async () => true,
        signIn: async () => ({}),
      },
      isSuccessResponse: () => false,
      isErrorWithCode: () => false,
      statusCodes: { SIGN_IN_CANCELLED: "cancelled" },
    },
    "react-native-svg": {
      __esModule: true,
      default: "Svg",
      Path: "Path",
      Defs: "Defs",
      LinearGradient: "LinearGradient",
      Stop: "Stop",
    },
    "expo-blur": { BlurView: "BlurView" },
    "../services/auth": { authService },
    "../theme/colors": {
      THEMES: {
        dark: {
          bg: "#000",
          text: "#fff",
          textMuted: "#aaa",
          accent: "#6366f1",
          danger: "#f00",
          cardBg: "#111",
          inputBorder: "#333",
        },
      },
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
    },
    "../components/common/AuthMotion": {
      AuthBackground: "AuthBackground",
      AnimatedBrand: "AnimatedBrand",
    },
  });
  return { runner, LoginScreen };
}

function baseAuthService(overrides = {}) {
  return {
    login: async () => {},
    signup: async () => {},
    googleLogin: async () => {},
    forgotPassword: async () => ({ message: "sent" }),
    resetPassword: async () => ({ message: "ok" }),
    ...overrides,
  };
}

test("forgot password link only shows in login mode, not signup mode", () => {
  const { runner, LoginScreen } = loadLoginScreen(baseAuthService());
  const props = { onLoginSuccess: () => {} };

  let tree = runner.render(() => LoginScreen(props));
  assert.ok(
    nodes(tree).some(
      (n) => n.props?.accessibilityLabel === "Forgot password?",
    ),
  );

  const toggle = findByText(tree, "Create an Account");
  assert.ok(toggle, "expected to find the sign-up switch link");
  toggle.props.onPress();

  tree = runner.render(() => LoginScreen(props));
  assert.equal(
    nodes(tree).some(
      (n) => n.props?.accessibilityLabel === "Forgot password?",
    ),
    false,
  );
  runner.unmount();
});

test("step 1 sends the reset email and advances to step 2 on success", async () => {
  const calls = [];
  const { runner, LoginScreen } = loadLoginScreen(
    baseAuthService({
      forgotPassword: async (email) => {
        calls.push(email);
        return { message: "sent" };
      },
    }),
  );
  const props = { onLoginSuccess: () => {} };

  let tree = runner.render(() => LoginScreen(props));
  nodes(tree)
    .find((n) => n.props?.accessibilityLabel === "Forgot password?")
    .props.onPress();

  tree = runner.render(() => LoginScreen(props));
  nodes(tree)
    .find((n) => n.props?.accessibilityLabel === "Reset email")
    .props.onChangeText("user@example.com");

  tree = runner.render(() => LoginScreen(props));
  await nodes(tree).find(
    (n) => n.props?.accessibilityLabel === "Send reset link",
  ).props.onPress();
  await settle();

  tree = runner.render(() => LoginScreen(props));
  assert.deepEqual(calls, ["user@example.com"]);
  assert.ok(
    nodes(tree).some((n) => n.props?.accessibilityLabel === "Reset token"),
  );
  assert.ok(
    nodes(tree).some((n) => n.props?.accessibilityLabel === "New password"),
  );
  const step1Texts = nodes(tree)
    .filter((n) => n.type === "Text")
    .flatMap((n) => n.props.children);
  assert.ok(
    step1Texts.some(
      (t) => typeof t === "string" && t.includes("reset token has been sent"),
    ),
  );
  runner.unmount();
});

test("step 2 resets the password with the entered token and shows success", async () => {
  const resetCalls = [];
  const { runner, LoginScreen } = loadLoginScreen(
    baseAuthService({
      resetPassword: async (token, password) => {
        resetCalls.push([token, password]);
        return { message: "ok" };
      },
    }),
  );
  const props = { onLoginSuccess: () => {} };

  let tree = runner.render(() => LoginScreen(props));
  nodes(tree)
    .find((n) => n.props?.accessibilityLabel === "Forgot password?")
    .props.onPress();
  tree = runner.render(() => LoginScreen(props));
  nodes(tree)
    .find((n) => n.props?.accessibilityLabel === "Reset email")
    .props.onChangeText("user@example.com");
  tree = runner.render(() => LoginScreen(props));
  await nodes(tree).find(
    (n) => n.props?.accessibilityLabel === "Send reset link",
  ).props.onPress();
  await settle();
  tree = runner.render(() => LoginScreen(props));

  nodes(tree)
    .find((n) => n.props?.accessibilityLabel === "Reset token")
    .props.onChangeText("abc123");
  tree = runner.render(() => LoginScreen(props));
  nodes(tree)
    .find((n) => n.props?.accessibilityLabel === "New password")
    .props.onChangeText("NewPassw0rd!");
  tree = runner.render(() => LoginScreen(props));

  await nodes(tree).find(
    (n) => n.props?.accessibilityLabel === "Reset password",
  ).props.onPress();
  await settle();
  tree = runner.render(() => LoginScreen(props));

  assert.deepEqual(resetCalls, [["abc123", "NewPassw0rd!"]]);
  const step2Texts = nodes(tree)
    .filter((n) => n.type === "Text")
    .flatMap((n) => n.props.children);
  assert.ok(
    step2Texts.some(
      (t) =>
        typeof t === "string" && t.includes("Your password has been updated"),
    ),
  );

  const backBtn = nodes(tree).find(
    (n) => n.props?.accessibilityLabel === "Back to sign in",
  );
  assert.ok(backBtn);
  backBtn.props.onPress();
  tree = runner.render(() => LoginScreen(props));
  assert.ok(
    nodes(tree).some(
      (n) => n.props?.accessibilityLabel === "Forgot password?",
    ),
  );
  assert.equal(
    nodes(tree).some((n) => n.props?.accessibilityLabel === "Reset token"),
    false,
  );
  runner.unmount();
});

test("a forgotPassword failure is surfaced as an error and stays on step 1", async () => {
  const { runner, LoginScreen } = loadLoginScreen(
    baseAuthService({
      forgotPassword: async () => {
        throw new Error("Could not reach server");
      },
    }),
  );
  const props = { onLoginSuccess: () => {} };

  let tree = runner.render(() => LoginScreen(props));
  nodes(tree)
    .find((n) => n.props?.accessibilityLabel === "Forgot password?")
    .props.onPress();
  tree = runner.render(() => LoginScreen(props));
  nodes(tree)
    .find((n) => n.props?.accessibilityLabel === "Reset email")
    .props.onChangeText("user@example.com");
  tree = runner.render(() => LoginScreen(props));

  await nodes(tree).find(
    (n) => n.props?.accessibilityLabel === "Send reset link",
  ).props.onPress();
  await settle();
  tree = runner.render(() => LoginScreen(props));

  const errorTexts = nodes(tree)
    .filter((n) => n.type === "Text")
    .flatMap((n) => n.props.children);
  assert.ok(errorTexts.includes("Could not reach server"));
  // Flow did not crash and did not silently advance to step 2.
  assert.equal(
    nodes(tree).some((n) => n.props?.accessibilityLabel === "Reset token"),
    false,
  );
  assert.ok(
    nodes(tree).some((n) => n.props?.accessibilityLabel === "Reset email"),
  );
  runner.unmount();
});

test("a resetPassword failure is surfaced as an error and stays on step 2", async () => {
  const { runner, LoginScreen } = loadLoginScreen(
    baseAuthService({
      resetPassword: async () => {
        throw new Error("Invalid or expired token");
      },
    }),
  );
  const props = { onLoginSuccess: () => {} };

  let tree = runner.render(() => LoginScreen(props));
  nodes(tree)
    .find((n) => n.props?.accessibilityLabel === "Forgot password?")
    .props.onPress();
  tree = runner.render(() => LoginScreen(props));
  nodes(tree)
    .find((n) => n.props?.accessibilityLabel === "Reset email")
    .props.onChangeText("user@example.com");
  tree = runner.render(() => LoginScreen(props));
  await nodes(tree).find(
    (n) => n.props?.accessibilityLabel === "Send reset link",
  ).props.onPress();
  await settle();
  tree = runner.render(() => LoginScreen(props));

  nodes(tree)
    .find((n) => n.props?.accessibilityLabel === "Reset token")
    .props.onChangeText("bad-token");
  tree = runner.render(() => LoginScreen(props));
  nodes(tree)
    .find((n) => n.props?.accessibilityLabel === "New password")
    .props.onChangeText("NewPassw0rd!");
  tree = runner.render(() => LoginScreen(props));

  await nodes(tree).find(
    (n) => n.props?.accessibilityLabel === "Reset password",
  ).props.onPress();
  await settle();
  tree = runner.render(() => LoginScreen(props));

  const errorTexts = nodes(tree)
    .filter((n) => n.type === "Text")
    .flatMap((n) => n.props.children);
  assert.ok(errorTexts.includes("Invalid or expired token"));
  // Still on step 2, did not advance to the "done" success screen.
  assert.ok(
    nodes(tree).some((n) => n.props?.accessibilityLabel === "Reset token"),
  );
  assert.equal(
    nodes(tree).some(
      (n) => n.props?.accessibilityLabel === "Back to sign in",
    ),
    false,
  );
  runner.unmount();
});

test("cancel returns from the forgot-password flow back to the normal login form", () => {
  const { runner, LoginScreen } = loadLoginScreen(baseAuthService());
  const props = { onLoginSuccess: () => {} };

  let tree = runner.render(() => LoginScreen(props));
  nodes(tree)
    .find((n) => n.props?.accessibilityLabel === "Forgot password?")
    .props.onPress();
  tree = runner.render(() => LoginScreen(props));
  assert.ok(
    nodes(tree).some((n) => n.props?.accessibilityLabel === "Reset email"),
  );

  nodes(tree)
    .find((n) => n.props?.accessibilityLabel === "Cancel password reset")
    .props.onPress();
  tree = runner.render(() => LoginScreen(props));

  assert.equal(
    nodes(tree).some((n) => n.props?.accessibilityLabel === "Reset email"),
    false,
  );
  assert.ok(
    nodes(tree).some(
      (n) => n.props?.accessibilityLabel === "Forgot password?",
    ),
  );
  assert.ok(
    nodes(tree).some((n) => n.props?.accessibilityLabel === "Password"),
  );
  runner.unmount();
});
