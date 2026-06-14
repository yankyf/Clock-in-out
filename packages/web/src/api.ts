import type {
  Category,
  CategoryRate,
  LoginResponse,
  Role,
  TimeEntry,
  TimeEntryInput,
  User,
} from "@clock/shared";

export interface CreateUserInput {
  email: string;
  name: string;
  role: Role;
  password: string;
}
export interface UpdateUserInput {
  name?: string;
  role?: Role;
  password?: string;
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "clock.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const resp = await request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(resp.token);
    return resp;
  },
  me: () => request<User>("/auth/me"),
  listEntries: (userId?: string) =>
    request<TimeEntry[]>(`/entries${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`),
  saveEntry: (e: TimeEntryInput & { userId?: string }) =>
    request<TimeEntry>(`/entries/${e.id}`, {
      method: "PUT",
      body: JSON.stringify(e),
    }),
  deleteEntry: (id: string) =>
    request<TimeEntry>(`/entries/${id}`, { method: "DELETE" }),
  listRates: (userId?: string) =>
    request<CategoryRate[]>(`/rates${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`),
  saveRate: (category: Category, ratePerHour: number, userId?: string) =>
    request<CategoryRate>(`/rates/${category}${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`, {
      method: "PUT",
      body: JSON.stringify({ ratePerHour }),
    }),
  listUsers: () => request<User[]>("/users"),
  createUser: (input: CreateUserInput) =>
    request<User>("/users", { method: "POST", body: JSON.stringify(input) }),
  updateUser: (id: string, input: UpdateUserInput) =>
    request<User>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
};
