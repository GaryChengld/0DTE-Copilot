# Task 03 — Add Job Status to Health Check API ✅ COMPLETED (2026-03-23)

## Goal

Expose the market ingestion job's runtime state through the existing `GET /api/status` endpoint so operators can confirm the job is running and catch errors without tailing logs.

## Updated Response Format

```json
{
  "status": "ok",
  "timestamp": "2026-03-23T10:30:00-04:00",
  "uptime": 42,
  "db": "ok",
  "latencyMs": 4.2,
  "job": {
    "status": "ok",
    "lastRanAt": "2026-03-23T10:30:00-04:00",
    "lastError": null
  }
}
```

### `job.status` values

| Value | Meaning |
|---|---|
| `"idle"` | Job is scheduled but has not fired yet (server just started, or outside RTH) |
| `"ok"` | Last execution completed successfully |
| `"error"` | Last execution threw an error |

### Top-level `status` field

- `"ok"` — db ok AND job is `"ok"` or `"idle"`
- `"degraded"` — db error OR job is `"error"`

## Steps

### 1. Job State Module (`server/src/jobs/jobState.ts`)

Create a shared state object to track job health. Export read and write functions so the job and the route stay decoupled.

```ts
export interface JobState {
  status: "idle" | "ok" | "error";
  lastRanAt: string | null;  // ISO 8601 ET timestamp
  lastError: string | null;
}
```

- Export `getJobState(): JobState` — returns current state (read-only copy)
- Export `setJobSuccess(timestamp: string): void` — sets status to `"ok"`, updates `lastRanAt`, clears `lastError`
- Export `setJobError(timestamp: string, error: string): void` — sets status to `"error"`, updates `lastRanAt`, sets `lastError`
- Initial state: `{ status: "idle", lastRanAt: null, lastError: null }`

### 2. Update Cron Job (`server/src/jobs/marketIngestion.ts`)

- Import `setJobSuccess` and `setJobError` from `jobState.ts`
- On successful snapshot: call `setJobSuccess(snapshot.timestamp)`
- On caught error: call `setJobError(currentETTimestamp, err.message)`

### 3. Update Status Route (`server/src/routes/status.ts`)

- Import `getJobState` from `../jobs/jobState.js`
- Include `job: getJobState()` in the response
- Update top-level `status`:
  - `"ok"` if db is ok AND job status is not `"error"`
  - `"degraded"` if db is error OR job status is `"error"`

## Done When

- `GET /api/status` returns a `job` field with `status`, `lastRanAt`, and `lastError`
- `job.status` starts as `"idle"` on server start
- After a successful cron tick it becomes `"ok"` with a populated `lastRanAt`
- After a failed cron tick it becomes `"error"` with a populated `lastError`
- Top-level `status` reflects `"degraded"` when job is in error state
- TypeScript compiles without errors (`npm run build`)
