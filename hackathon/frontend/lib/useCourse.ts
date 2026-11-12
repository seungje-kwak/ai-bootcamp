"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import type { Course } from "./types";

export type LoadState = { kind: "loading" } | { kind: "ok" } | { kind: "notfound" } | { kind: "error" };

export function useCourse(id: string) {
  const [course, setCourse] = useState<Course | null>(null);
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      setCourse(await api.getCourse(id));
      setState({ kind: "ok" });
    } catch (e) {
      setState({ kind: e instanceof ApiError && e.code === "COURSE_NOT_FOUND" ? "notfound" : "error" });
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return { course, setCourse, state, reload: load };
}
