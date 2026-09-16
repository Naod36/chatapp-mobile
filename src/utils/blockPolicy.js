const UNAVAILABLE_NAME = "Person Not Available";

function blockPolicy(userId, outgoing = [], incoming = [], isGroup = false) {
  const identity = String(userId ?? "");
  const blocked = outgoing.includes(identity);
  const blockedBy = incoming.includes(identity);
  return {
    hideIdentity: blockedBy,
    preventDirectInteraction: !isGroup && (blocked || blockedBy),
    canUnblock: blocked,
  };
}

function redactMessage(message, isHidden) {
  if (!message) return message;
  const result = { ...message };
  if (isHidden(message.sender_id || message.user_id)) {
    result.sender_name = UNAVAILABLE_NAME;
    result.sender_username = UNAVAILABLE_NAME;
    result.sender_avatar = null;
    result.sender_avatar_url = null;
    result.avatar_url = null;
  }
  if (isHidden(message.pinned_by_user_id)) {
    result.pinned_by_name = UNAVAILABLE_NAME;
    result.pinned_by_username = UNAVAILABLE_NAME;
    result.pinned_by_avatar = null;
  }
  if (message.reply_to)
    result.reply_to = redactMessage(message.reply_to, isHidden);
  return result;
}

function redactUser(person, isHidden) {
  if (!person || !isHidden(person.user_id || person.id)) return person;
  return {
    ...person,
    username: UNAVAILABLE_NAME,
    display_name: UNAVAILABLE_NAME,
    name: UNAVAILABLE_NAME,
    avatar_url: null,
    avatar: null,
    status: "offline",
    last_seen: null,
    bio: null,
  };
}

module.exports = { blockPolicy, UNAVAILABLE_NAME, redactMessage, redactUser };
