function createBlockRefresh(load, apply, onError = () => {}) {
  let pending = null;
  let dirty = false;
  let stopped = false;
  let controller;
  return {
    refresh() {
      if (stopped) return Promise.resolve();
      dirty = true;
      if (pending) return pending;
      pending = (async () => {
        while (dirty && !stopped) {
          dirty = false;
          controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          try {
            const result = await load(controller.signal);
            if (!stopped && !dirty) apply(result);
          } catch (error) {
            if (!stopped) onError(error);
          } finally {
            clearTimeout(timeout);
          }
        }
      })().finally(() => {
        pending = null;
      });
      return pending;
    },
    stop() {
      stopped = true;
      controller?.abort();
    },
  };
}

module.exports = { createBlockRefresh };
