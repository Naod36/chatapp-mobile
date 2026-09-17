import AsyncStorage from "@react-native-async-storage/async-storage";
import { expireSession } from "./session.js";
import { UPLOAD_REJECTED_ERROR } from "../utils/uploadLimits.js";

export const API_BASE = "https://chatapp-backend-chyk.onrender.com";
export const WS_BASE = "wss://chatapp-backend-chyk.onrender.com";

function parseErrorMessage(response, data) {
  if (response.status === 413) {
    return UPLOAD_REJECTED_ERROR;
  }
  if (response.status === 422) {
    return "Invalid request payload. Please check your details and try again.";
  }
  if (response.status === 401) {
    return "Your session has expired. Please log in again.";
  }
  if (response.status === 403) {
    return "Access denied. You do not have permission for this request.";
  }
  if (response.status === 404) {
    return "The requested backend route was not found.";
  }
  if (response.status >= 500) {
    return "A backend server error occurred. Please try again later.";
  }

  if (data && typeof data === "object") {
    if (data.message) return data.message;
    if (data.error) return data.error;
  }

  if (typeof data === "string" && data.trim()) {
    if (data.includes("<html") || data.includes("<!DOCTYPE")) {
      return `Request failed with server status code ${response.status}.`;
    }
    return data.trim();
  }

  return `Request failed with status ${response.status}. Please try again.`;
}

export async function apiFetch(endpoint, options = {}) {
  const token = await AsyncStorage.getItem("chat_token");

  const headers = {
    ...options.headers,
  };

  const isFormData =
    options.body &&
    (options.body instanceof FormData ||
      typeof options.body.append === "function");
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);

    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } else {
      data = await response.text().catch(() => "");
    }

    if (!response.ok) {
      if (response.status === 401) {
        expireSession(token).catch(() => {});
      }
      const errMsg = parseErrorMessage(response, data);
      throw new Error(errMsg);
    }

    return data;
  } catch (err) {
    if (
      err.name === "TypeError" ||
      err.message?.includes("Failed to fetch") ||
      err.message?.includes("NetworkError")
    ) {
      throw new Error(
        "Unable to connect to the FlowChat server. Please check your internet connection.",
      );
    }
    throw err;
  }
}

export async function uploadFileWithProgress(
  formData,
  onProgress,
  signal = null,
) {
  const token = await AsyncStorage.getItem("chat_token");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const cleanup = () => signal?.removeEventListener("abort", abort);
    if (signal?.aborted) {
      reject(new Error("Upload cancelled."));
      return;
    }
    signal?.addEventListener("abort", abort);
    xhr.onabort = () => {
      cleanup();
      reject(new Error("Upload cancelled."));
    };

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const loaded = event.loaded;
          const total = event.total;
          const percentage = Math.round((loaded / total) * 100);
          const loadedMB = (loaded / (1024 * 1024)).toFixed(1);
          const totalMB = (total / (1024 * 1024)).toFixed(1);

          onProgress({
            loaded,
            total,
            percentage,
            loadedFormatted: `${loadedMB} MB`,
            totalFormatted: `${totalMB} MB`,
          });
        }
      };
    }

    xhr.onload = () => {
      cleanup();
      let data;
      const contentType = xhr.getResponseHeader("content-type");
      if (contentType && contentType.includes("application/json")) {
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          data = null;
        }
      } else {
        data = xhr.responseText;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        if (xhr.status === 401) {
          expireSession(token).catch(() => {});
        }
        const errMsg = parseErrorMessage({ status: xhr.status }, data);
        reject(new Error(errMsg));
      }
    };

    xhr.onerror = () => {
      cleanup();
      reject(
        new Error(
          "Network error during file upload. Please check your connection.",
        ),
      );
    };

    xhr.open("POST", `${API_BASE}/upload`);
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }
    xhr.send(formData);
  });
}
