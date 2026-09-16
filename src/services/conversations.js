import { apiFetch, uploadFileWithProgress } from "./api";

export const conversationService = {
  async createConversation(recipientId) {
    return apiFetch("/conversations", {
      method: "POST",
      body: JSON.stringify({ recipient_id: recipientId }),
    });
  },

  async createGroup(title, participantIds, avatarUrl = null) {
    return apiFetch("/conversations/group", {
      method: "POST",
      body: JSON.stringify({
        title,
        participant_ids: participantIds,
        avatar_url: avatarUrl,
      }),
    });
  },

  async listConversations() {
    return apiFetch("/conversations");
  },

  async getMessages(conversationId) {
    return apiFetch(`/conversations/${conversationId}/messages`);
  },

  async getPinnedMessages(conversationId) {
    return apiFetch(`/conversations/${conversationId}/pins`);
  },

  async sendMessage(
    conversationId,
    content,
    messageType = "text",
    replyToId = null,
    mediaUrl = null,
    fileName = null,
    signal = null,
  ) {
    return apiFetch(`/conversations/${conversationId}/messages`, {
      method: "POST",
      signal,
      body: JSON.stringify({
        content,
        message_type: messageType,
        reply_to_id: replyToId,
        media_url: mediaUrl,
        file_url: mediaUrl,
        file_name: fileName,
      }),
    });
  },

  async updateGroup(conversationId, data) {
    return apiFetch(`/conversations/${conversationId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async uploadFile(fileFormData, onProgress, signal = null) {
    if (onProgress) {
      return uploadFileWithProgress(fileFormData, onProgress, signal);
    }
    return apiFetch("/upload", {
      method: "POST",
      signal,
      body: fileFormData,
    });
  },

  async deleteMessage(messageId) {
    return apiFetch(`/messages/${messageId}`, {
      method: "DELETE",
    });
  },

  async pinMessage(conversationId, messageId, scope = "shared", notify = true) {
    return apiFetch(`/conversations/${conversationId}/pin`, {
      method: "POST",
      body: JSON.stringify({ message_id: messageId, scope, notify }),
    });
  },

  async unpinMessage(conversationId, messageId) {
    return apiFetch(`/conversations/${conversationId}/pin/${messageId}`, {
      method: "DELETE",
    });
  },

  async leaveConversation(conversationId) {
    return apiFetch(`/conversations/${conversationId}/leave`, {
      method: "POST",
    });
  },
};
