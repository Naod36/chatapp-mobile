import { apiFetch } from "./api";

export const userService = {
    async getProfile() {
        return apiFetch("/me");
    },

    async updateProfile(profileData) {
        return apiFetch("/users/profile", {
            method: "PUT",
            body: JSON.stringify(profileData),
        });
    },

    async searchUsers(query) {
        return apiFetch(`/users/search?query=${encodeURIComponent(query)}`);
    },

    async updateNotificationPreference(enabled) {
        return apiFetch("/users/me/notifications", {
            method: "PATCH",
            body: JSON.stringify({ enabled }),
        });
    },

    async changePassword(newPassword) {
        return apiFetch("/auth/change-password", {
            method: "POST",
            body: JSON.stringify({ new_password: newPassword }),
        });
    },

    async requestEmailChange(newEmail) {
        return apiFetch("/users/me/email", {
            method: "POST",
            body: JSON.stringify({ new_email: newEmail }),
        });
    },

    async getBlockedUsers() {
        return apiFetch("/users/blocked");
    },

    async getBlockedByUsers() {
        return apiFetch("/users/blocked-by");
    },

    async blockUser(userId) {
        return apiFetch(`/users/block/${userId}`, { method: "POST" });
    },

    async unblockUser(userId) {
        return apiFetch(`/users/block/${userId}`, { method: "DELETE" });
    },

    async deleteAccount() {
        return apiFetch("/me", { method: "DELETE" });
    },
};

