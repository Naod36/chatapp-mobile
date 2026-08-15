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
    }
};
