export interface JobState {
  status: "idle" | "ok" | "error";
  lastRanAt: string | null;
  lastError: string | null;
}

const state: JobState = {
  status: "idle",
  lastRanAt: null,
  lastError: null,
};

export function getJobState(): JobState {
  return { ...state };
}

export function setJobSuccess(timestamp: string): void {
  state.status = "ok";
  state.lastRanAt = timestamp;
  state.lastError = null;
}

export function setJobError(timestamp: string, error: string): void {
  state.status = "error";
  state.lastRanAt = timestamp;
  state.lastError = error;
}
