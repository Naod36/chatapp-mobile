const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes, settle } = require("./helpers.cjs");

function loadGate({ enabled = true, authResult = { success: true } } = {}) {
  const runner = harness();
  let appStateChange;
  const authCalls = [];
  const store = { "@flowchat_biometric_lock": enabled ? "true" : null };
  const mod = runner.load("src/components/common/BiometricLock.js", {
    "react-native": {
      View: "View",
      Text: "Text",
      TouchableOpacity: "TouchableOpacity",
      ActivityIndicator: "ActivityIndicator",
      StyleSheet: { create: (s) => s },
      Platform: { OS: "android" },
      AppState: {
        currentState: "active",
        addEventListener: (event, callback) => {
          appStateChange = callback;
          return { remove() {} };
        },
      },
    },
    "expo-local-authentication": {
      hasHardwareAsync: async () => true,
      isEnrolledAsync: async () => true,
      authenticateAsync: async () => {
        authCalls.push(true);
        return authResult;
      },
    },
    "@react-native-async-storage/async-storage": {
      getItem: async (key) => store[key] ?? null,
      setItem: async (key, value) => {
        store[key] = value;
      },
      removeItem: async (key) => {
        delete store[key];
      },
    },
  });
  const Gate = mod.default;
  const render = () => runner.render(() => Gate({ theme: {} }));
  return {
    runner,
    render,
    authCalls,
    store,
    mod,
    appStateChange: (state) => appStateChange(state),
  };
}

test("locked on cold start when enabled, auto-authenticates and unlocks on success", async () => {
  const fixture = loadGate({ enabled: true, authResult: { success: true } });
  fixture.render();
  await settle();
  let tree = fixture.render();
  await settle();
  tree = fixture.render();
  assert.equal(fixture.authCalls.length >= 1, true);
  assert.equal(tree, null, "gate hides after successful auth");
  fixture.runner.unmount();
});

test("stays locked when auth fails and offers a retry button", async () => {
  const fixture = loadGate({ enabled: true, authResult: { success: false } });
  fixture.render();
  await settle();
  fixture.render();
  await settle();
  const tree = fixture.render();
  assert.notEqual(tree, null, "gate stays visible after failed auth");
  const unlockBtn = nodes(tree).find(
    (n) => n.props?.accessibilityLabel === "Unlock FlowChat",
  );
  assert.ok(unlockBtn, "retry unlock button present");
  fixture.runner.unmount();
});

test("renders nothing when the setting is disabled", async () => {
  const fixture = loadGate({ enabled: false });
  fixture.render();
  await settle();
  const tree = fixture.render();
  assert.equal(tree, null);
  assert.equal(fixture.authCalls.length, 0);
  fixture.runner.unmount();
});

test("setBiometricLockEnabled persists and clears the stored flag", async () => {
  const fixture = loadGate({ enabled: false });
  await fixture.mod.setBiometricLockEnabled(true);
  assert.equal(fixture.store["@flowchat_biometric_lock"], "true");
  assert.equal(await fixture.mod.isBiometricLockEnabled(), true);
  await fixture.mod.setBiometricLockEnabled(false);
  assert.equal(await fixture.mod.isBiometricLockEnabled(), false);
});
