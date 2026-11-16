// Small browser-only stores. Nothing here is sent to the API.
const PROGRESS_KEY = "mypace-jeju-progress:";
const DRAFT_KEY = "mypace-jeju-onboarding";

function read<T>(storage: () => Storage, key: string): T | null {
  try {
    const raw = storage().getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: unknown) {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, JSON.stringify(value));
  } catch {
    /* storage can be unavailable (private mode, quota); the feature just degrades */
  }
}

const session = () => window.sessionStorage;

/** Trip progress for this tab, so an accidental reload mid-trip does not jump back to stop 1.
 *  `signature` ties it to the exact item list; a re-plan or a reset makes it stale. */
export type TripProgress = { order: number; finished: boolean; signature: string };
export const saveTripProgress = (courseId: string, p: TripProgress | null) => write(session, PROGRESS_KEY + courseId, p);
export const loadTripProgress = (courseId: string) => read<TripProgress>(session, PROGRESS_KEY + courseId);

export const saveOnboardingDraft = (draft: unknown) => write(session, DRAFT_KEY, draft);
export const loadOnboardingDraft = <T,>() => read<T>(session, DRAFT_KEY);
