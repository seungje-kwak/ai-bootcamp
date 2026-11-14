// The frontend only talks to FastAPI (1.3). Base URL comes from NEXT_PUBLIC_API_URL.
import type { Area, Course, Place, ReplanReason, UserProfileInput } from "./types";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
const TIMEOUT_MS = 45_000; // 11.1

export class ApiError extends Error {
  status: number;
  code: string | null;
  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      signal: ctrl.signal,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, null, "Network error");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let code: string | null = null;
    let message = res.statusText;
    try {
      const body = await res.json();
      // 9.2: branch on detail.code only when it is a string (422 has an array)
      if (body?.detail && typeof body.detail.code === "string") {
        code = body.detail.code;
        message = body.detail.message;
      }
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, code, message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  areas: () => request<{ areas: Area[] }>("/areas"),
  // With area_id: only that area's places (the course map). Without: every place in Jeju.
  places: (area_id?: string) =>
    request<{ places: Place[] }>(area_id ? `/places?area_id=${encodeURIComponent(area_id)}` : "/places"),
  createCourse: (user_profile: UserProfileInput, area_id: string, start_time: string, end_time: string) =>
    request<Course>("/courses", {
      method: "POST",
      body: JSON.stringify({ user_profile, area_id, start_time, end_time }),
    }),
  getCourse: (id: string) => request<Course>(`/courses/${encodeURIComponent(id)}`),
  replan: (id: string, reason: ReplanReason, current_order: number) =>
    request<Course>(`/courses/${encodeURIComponent(id)}/replan`, {
      method: "POST",
      body: JSON.stringify({ reason, current_order }),
    }),
  purchase: (course_id: string) =>
    request<Course>("/purchase", { method: "POST", body: JSON.stringify({ course_id }) }),
};
