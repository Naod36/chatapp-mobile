const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function harness() {
  const slots = [];
  const effects = [];
  const timers = new Map();
  let cursor = 0;
  let timerId = 0;
  const changed = (before, after) => !before || !after || before.length !== after.length || after.some((value, index) => !Object.is(value, before[index]));
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    createContext: () => ({ Provider: "Provider" }),
    memo: (component) => component,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, (next) => { slots[index].value = typeof next === "function" ? next(slots[index].value) : next; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!slots[index] || changed(slots[index].deps, deps)) slots[index] = { value: callback, deps };
      return slots[index].value;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || changed(slots[index].deps, deps)) {
        const previous = slots[index];
        slots[index] = { deps };
        effects.push(() => {
          previous?.cleanup?.();
          slots[index].cleanup = effect();
        });
      }
    },
  };
  react.default = react;
  const setTimer = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; };
  return {
    react, timers,
    render(render) {
      cursor = 0;
      const result = render();
      effects.splice(0).forEach((effect) => effect());
      return result;
    },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); },
    load(relative, mocks = {}, globals = {}) {
      const filename = path.resolve(__dirname, "..", relative);
      const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
        filename, configFile: false, babelrc: false,
        plugins: [require.resolve("@babel/plugin-transform-modules-commonjs"), require.resolve("@babel/plugin-transform-react-jsx")],
      });
      const module = { exports: {} };
      vm.runInNewContext(code, {
        module, exports: module.exports, console, AbortController, Date, FormData,
        setTimeout: setTimer, clearTimeout: (id) => timers.delete(id),
        setInterval: setTimer, clearInterval: (id) => timers.delete(id),
        require: (name) => {
          if (name === "react") return react;
          if (name in mocks) return mocks[name];
          if (name.startsWith(".")) return require(path.resolve(path.dirname(filename), name));
          throw new Error(`Unmocked dependency: ${name}`);
        },
        ...globals,
      }, { filename });
      return module.exports;
    },
  };
}

function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const settle = () => new Promise((resolve) => setImmediate(resolve));
module.exports = { harness, nodes, settle };