export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type Profile = {
  id: string;
  email: string;
  name: string;
  kind: "staff" | "agency";
  role: string;
  financeAccess: boolean;
  twoFactor: boolean;
  agencyId: string | null;
  agencyName: string | null;
  permissions: {
    canCreateListings: boolean;
    canUploadReels: boolean;
    canManageEnquiries: boolean;
    canViewProjects: boolean;
    publishRequiresApproval: boolean;
  } | null;
};

export type Session = { accessToken: string; user: Profile };

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("placein-session");
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (typeof session?.accessToken === "string" && session.user?.id &&
        ["staff", "agency"].includes(session.user.kind)) return session as Session;
  } catch {
    // A damaged saved session should return to sign-in, not crash the app.
  }
  localStorage.removeItem("placein-session");
  return null;
}

export function saveSession(session: Session | null) {
  if (!session) localStorage.removeItem("placein-session");
  else localStorage.setItem("placein-session", JSON.stringify(session));
}

const credentialPaths = ["/api/auth/login", "/api/auth/forgot-password", "/api/auth/reset-password", "/api/auth/accept-invite"];

export async function api(path: string, options: { method?: string; body?: unknown; token?: string } = {}) {
  const signingIn = credentialPaths.some((item) => path === item || path.startsWith(`${item}?`));
  const token = signingIn ? undefined : (options.token ?? loadSession()?.accessToken);
  const response = await fetch(`${API}${path}`, {
    method: options.method || "GET",
    headers: {
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(" ") : data?.message;
    throw new Error(message || `Request failed (${response.status})`);
  }
  return data;
}

export function uploadFile(file: File, onProgress?: (ratio: number) => void) {
  const token = loadSession()?.accessToken;
  return new Promise<{ url: string; size: number; originalName: string }>((resolve, reject) => {
    const body = new FormData();
    body.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/api/uploads`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      let data: any = null;
      try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { data = null; }
      if (xhr.status < 200 || xhr.status >= 300) {
        const message = Array.isArray(data?.message) ? data.message.join(" ") : data?.message;
        reject(new Error(message || `Request failed (${xhr.status})`));
        return;
      }
      const url = String(data?.url || "");
      resolve({
        url: url.startsWith("http") ? url : `${API}${url}`,
        size: Number(data?.size || file.size),
        originalName: String(data?.originalName || file.name),
      });
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(body);
  });
}

export async function downloadCsv(kind: string) {
  const token = loadSession()?.accessToken;
  const response = await fetch(`${API}/api/exports/${kind}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Export failed");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${kind}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
