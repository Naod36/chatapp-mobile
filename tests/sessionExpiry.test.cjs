const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes, settle } = require("./helpers.cjs");

function memoryAsyncStorage(initial = {}) {
  const store = { ...initial };
  return {
    store,
    getItem: async (key) => (key in store ? store[key] : null),
    setItem: async (key, value) => {
      store[key] = value;
    },
    multiRemove: async (keys) => {
      for (const key of keys) delete store[key];
    },
    removeItem: async (key) => {
      delete store[key];
    },
  };
}

test("expireSession clears the stored token only when it matches the failing request's token", async () => {
  const runner = harness();
  const storage = memoryAsyncStorage({
    chat_token: "abc",
    chat_userId: "u1",
    chat_username: "alice",
  });
  const { expireSession, onSessionExpired } = runner.load(
    "src/services/session.js",
    { "@react-native-async-storage/async-storage": storage },
  );
  const fired = [];
  const unsubscribe = onSessionExpired(() => fired.push(true));

  // Stale/mismatched token (e.g. a newer login already replaced it) must not clear or notify.
  storage.store.chat_token = "newer-token";
  const staleResult = await expireSession("abc");
  assert.equal(staleResult, false);
  assert.equal(storage.store.chat_token, "newer-token");
  assert.equal(fired.length, 0);

  // Matching token clears storage and notifies once.
  const result = await expireSession("newer-token");
  assert.equal(result, true);
  assert.equal(storage.store.chat_token, undefined);
  assert.equal(storage.store.chat_userId, undefined);
  assert.equal(storage.store.chat_username, undefined);
  assert.equal(fired.length, 1);

  unsubscribe();
});

test("apiFetch triggers expireSession on a 401 but not on other errors", async () => {
  const runner = harness();
  const storage = memoryAsyncStorage({ chat_token: "abc" });
  const expireCalls = [];
  const { apiFetch } = runner.load(
    "src/services/api.js",
    {
      "@react-native-async-storage/async-storage": storage,
      "./session.js": {
        expireSession: async (token) => {
          expireCalls.push(token);
        },
      },
    },
    {
      fetch: async (url, config) => ({
        ok: false,
        status: 401,
        headers: { get: () => "application/json" },
        json: async () => ({ message: "expired" }),
      }),
    },
  );
  await assert.rejects(() => apiFetch("/me"));
  assert.deepEqual(expireCalls, ["abc"]);
});

test("apiFetch does not call expireSession for a non-401 error", async () => {
  const runner = harness();
  const storage = memoryAsyncStorage({ chat_token: "abc" });
  const expireCalls = [];
  const { apiFetch } = runner.load(
    "src/services/api.js",
    {
      "@react-native-async-storage/async-storage": storage,
      "./session.js": {
        expireSession: async (token) => {
          expireCalls.push(token);
        },
      },
    },
    {
      fetch: async () => ({
        ok: false,
        status: 500,
        headers: { get: () => "application/json" },
        json: async () => ({ message: "server error" }),
      }),
    },
  );
  await assert.rejects(() => apiFetch("/me"));
  assert.deepEqual(expireCalls, []);
});

test("AppContext logs out and surfaces the expiry message when the session expires", async () => {
  const runner = harness();
  let sessionListener;
  const logoutCalls = [];
  const { AppProvider } = runner.load("src/context/AppContext.js", {
    "react-native": {
      AppState: {
        currentState: "active",
        addEventListener: () => ({ remove() {} }),
      },
      Appearance: {
        getColorScheme: () => "light",
        addChangeListener: () => ({ remove() {} }),
      },
    },
    "@react-native-async-storage/async-storage": { getItem: async () => null },
    "../services/auth": {
      authService: {
        getCurrentUser: async () => null,
        logout: async () => {
          logoutCalls.push(true);
        },
      },
    },
    "../services/conversations": {
      conversationService: { listConversations: async () => [] },
    },
    "../services/user": {
      userService: {
        getBlockedUsers: async () => [],
        getBlockedByUsers: async () => [],
      },
    },
    "../services/websocket": {
      websocketService: {
        connect() {},
        closeAll() {},
        subscribe: () => () => {},
      },
    },
    "../services/notifications": {
      registerForPushNotificationsAsync: async () => null,
      registerPushToken() {},
    },
    "../services/session.js": {
      onSessionExpired: (listener) => {
        sessionListener = listener;
        return () => {
          sessionListener = null;
        };
      },
      SESSION_EXPIRED_MESSAGE: "Your session has expired. Please log in again.",
    },
    "../theme/colors": { THEMES: { light: {} } },
  });
  const render = () =>
    runner.render(() => AppProvider({ children: null })).props.value;
  render();
  await settle();

  let ctx = render();
  assert.equal(ctx.sessionExpiredMessage, null);

  sessionListener();
  await settle();
  ctx = render();
  assert.equal(ctx.user, null);
  assert.equal(
    ctx.sessionExpiredMessage,
    "Your session has expired. Please log in again.",
  );
  assert.equal(logoutCalls.length, 1);

  ctx.clearSessionExpiredMessage();
  ctx = render();
  assert.equal(ctx.sessionExpiredMessage, null);
  runner.unmount();
});

test("LoginScreen seeds its error banner from initialError once and reports it consumed", () => {
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
  let shownCalls = 0;
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
    "../services/auth": { authService: {} },
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
  const tree = runner.render(() =>
    LoginScreen({
      onLoginSuccess: () => {},
      initialError: "Your session has expired. Please log in again.",
      onInitialErrorShown: () => {
        shownCalls += 1;
      },
    }),
  );
  const errorText = nodes(tree)
    .filter((n) => n.type === "Text")
    .flatMap((n) => n.props.children)
    .find((c) => c === "Your session has expired. Please log in again.");
  assert.ok(errorText, "expected the seeded error to render");
  assert.equal(shownCalls, 1);
  runner.unmount();
});
