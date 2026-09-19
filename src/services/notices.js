const listeners = new Set();
let queue = [];
let nextId = 0;

function getNotice() {
  return queue[0] || null;
}

function notify() {
  listeners.forEach((listener) => listener(getNotice()));
}

function subscribe(listener) {
  listeners.add(listener);
  listener(getNotice());
  return () => listeners.delete(listener);
}

function alert(title, message = "", buttons, options = {}) {
  queue.push({ id: ++nextId, title, message, buttons, options });
  notify();
}

function dismissNotice(id, button) {
  const notice = getNotice();
  if (!notice || notice.id !== id) return;
  queue = queue.slice(1);
  notify();
  if (button) button.onPress?.();
  else {
    notice.buttons?.find((action) => action.style === "cancel")?.onPress?.();
    notice.options.onDismiss?.();
  }
}

module.exports = { alert, subscribe, getNotice, dismissNotice };
