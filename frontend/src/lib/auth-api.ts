import type { AuthUser } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

const LOGIN_URL = `${API_BASE_URL}/api/auth/login/`;

export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(LOGIN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: username.trim(),
      password,
    }),
  });

  if (!res.ok) {
    let message = "Invalid username or password.";
    try {
      const data = (await res.json()) as {
        detail?: string;
        non_field_errors?: string[];
        username?: string[];
        password?: string[];
      };
      if (typeof data.detail === "string") message = data.detail;
      else if (Array.isArray(data.non_field_errors) && data.non_field_errors[0]) message = data.non_field_errors[0];
      else if (Array.isArray(data.username) && data.username[0]) message = data.username[0];
      else if (Array.isArray(data.password) && data.password[0]) message = data.password[0];
    } catch {
      // keep default message
    }
    throw new Error(message);
  }

  const data = (await res.json()) as { token: string; user: AuthUser };
  return {
    token: data.token,
    user: data.user,
  };
}
