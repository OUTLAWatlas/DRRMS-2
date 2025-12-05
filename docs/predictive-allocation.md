# AI-Powered Predictive Allocation — Phase 0 Plan

This document scopes the foundational work required before we prototype ML-powered allocation. It focuses on (a) capturing the right historical signals, (b) shaping a service surface that can run forecasts and store recommendations, and (c) wiring predictable APIs/UI contracts.

---

## 1. Objectives

1. Persist the time-series context needed for demand forecasting (requests, fulfillment latency, inventory, weather overlays).
2. Provide a repeatable feature engineering pipeline that both the classical heuristic engine and future ML models can reuse.
3. Introduce storage + APIs for model outputs so operators can review, accept, or dismiss predictive recommendations without replacing the current prioritization flow.

---

## 2. Data Requirements & Tables

| Table | Purpose | Key Columns |
| --- | --- | --- |
| `request_event_log` | Append-only log for every status change, allocation, or distribution touching a rescue request. Enables lead-time/latency calculations. | `request_id`, `event_type`, `payload`, `actor_id`, `created_at` |
| `demand_feature_snapshots` | Aggregated bucketed metrics per geography/resource to feed forecasting models. | `bucket_start`, `bucket_end`, `region`, `resource_type`, `request_count`, `pending`, `in_progress`, `fulfilled`, `avg_people`, `avg_severity_score`, `median_wait_mins`, `inventory_available`, `open_allocations`, `weather_alert_level`, `precipitation_mm`, `wind_speed_kph`, `humidity`, `created_at` |
| `request_feature_snapshots` | Per-request feature vector captures the state when a prediction is generated; lets us audit/label future models. | `request_id`, `snapshot_at`, `people_count`, `priority`, `severity_score`, `weather_layer`, `travel_time_min`, `supply_pressure`, `model_features (JSON)` |
| `predictive_model_runs` | Metadata for each training/inference run. | `id`, `model_name`, `version`, `run_type (training|inference)`, `status`, `metrics_json`, `started_at`, `completed_at` |
| `predictive_recommendations` | Stores model outputs surfaced to operators. | `id`, `request_id` (nullable for region-level forecasts), `region`, `resource_type`, `suggested_quantity`, `confidence`, `impact_score`, `lead_time_minutes`, `status (suggested|queued|applied|dismissed|expired)`, `rationale`, `model_run_id`, `feature_snapshot_id`, `valid_from`, `valid_until`, `created_at`, `updated_at` |
| `predictive_feedback` | Captures human feedback (accept/dismiss + notes) to use as training labels. | `recommendation_id`, `action`, `actor_id`, `notes`, `created_at` |

Additional supporting indexes:
- Unique constraint on `demand_feature_snapshots (bucket_start, region, resource_type)` so backfills can safely upsert.
- TTL/retention plan (e.g., keep 180 days of feature snapshots; archive older data via background job).

---

## 3. Feature Engineering Pipeline

1. **Event capture** – On every rescue request/warehouse mutation, emit a normalized event (request submitted, status updated, allocation booked, dispatch recorded). Persist immediately in `request_event_log`.
2. **Bucket aggregation job** – Every 15 minutes, aggregate the last period into `demand_feature_snapshots`. Required metrics:
   - Counts: total requests, pending, in_progress, fulfilled, cancelled.
   - Severity stats: avg/median severity score (map categorical severity to 1–4), std dev.
   - People stats: avg headcount, p90 headcount.
   - Fulfillment latency: median minutes from pending → in_progress/fulfilled.
   - Resource pressure: total inventory per resource type, open allocations, reorder breaches.
   - Weather overlays: highest alert level touching the region, precipitation/wind/humidity averages.
3. **Per-request snapshots** – When generating a recommendation, save the raw feature vector to `request_feature_snapshots` for traceability and future supervised training.

### Baseline heuristic v0.2

The current `predictive-allocation` service now blends the live request signal with the trailing 6-hour `demand_feature_snapshots` window:

- For each active request, we normalize its region (city prefix) and inferred resource type.
- Historical averages (pending count, request count, average people/severity, inventory, and latest weather alert) are loaded per region/resource combo.
- Suggested quantity scales with demand pressure (pending+request vs. inventory), severity, and weather risk; confidence incorporates data density + alert levels.
- The computed feature vector (demand pressure, averages, alert score, etc.) is stored in `request_feature_snapshots.model_features` for auditability.

This keeps the pipeline heuristic-driven while grounding recommendations in actual trends, making it easier to compare future ML models against a meaningful baseline.

---

## 4. Forecasting & Recommendation Service

Proposed module: `server/services/predictive-allocation.ts`

Responsibilities:
1. **Scheduler integration** – Similar to `live-feed-scheduler`, run inference every X minutes (configurable). Skip in test envs.
2. **Feature retrieval** – Read the latest `demand_feature_snapshots`/`request_feature_snapshots` windows into in-memory feature tensors. Start with simple heuristics/baselines (moving averages, Prophet/ARIMA via Python microservice, or gradient boosting via `scikit-learn` exported model file).
3. **Recommendation creation** – For each high-risk region/request, compute suggested resource type + quantity + lead time. Save to `predictive_recommendations` referencing the relevant feature snapshot + model run.
4. **Lifecycle management** – Mark recommendations `expired` when `valid_until` < now, or when request state changes. Accepting/dismissing via API should create a `predictive_feedback` row and update the recommendation status.

---

## 5. API Surface & Shared Types

- `GET /api/predictive/recommendations?limit=20&region=` → Returns `{ recommendations: PredictiveRecommendation[] }`.
- `POST /api/predictive/recommendations/:id/feedback` → Body `{ action: "applied" | "dismissed", note?: string }`. Updates status + logs feedback.
- `POST /api/predictive/runs/trigger` (admin-only) → Optional manual trigger for ad-hoc inference/retraining.

Shared types in `shared/api.ts`:
```ts
export type PredictiveRecommendationStatus = "suggested" | "queued" | "applied" | "dismissed" | "expired";
export type PredictiveRecommendation = {
  id: number;
  requestId: number | null;
  region: string;
  resourceType: string;
  suggestedQuantity: number;
  confidence: number;
  impactScore: number;
  leadTimeMinutes: number;
  rationale?: string | null;
  validFrom: number;
  validUntil: number | null;
  status: PredictiveRecommendationStatus;
  modelVersion: string;
};
```

---

## 6. Client Integration Checklist

1. **Hooks** – `usePredictiveAllocationsQuery()` hitting the new endpoint; `usePredictiveFeedbackMutation()` for accept/dismiss.
2. **UI** – In Admin + Rescue portals, add a "Predicted Demand" panel that:
   - Lists top N recommendations with resource badges, confidence %, countdown timer to valid-until.
   - Provides actions: Apply (calls existing recommendation/apply pipeline), Queue dispatch, Dismiss.
   - Surfaces explanation (rationale, key drivers such as "Pending requests spiked 32% while inventory < 25% threshold").
3. **Notifications** – When a high-impact prediction lands, push to the existing notification system to alert dispatchers.

---

## 7. Sequenced Next Steps

1. **Schema work (This sprint)**
   - Add tables listed above + migrations + shared types.
   - Expose Drizzle helpers for inserting/updating snapshots + recommendations.

2. **Event capture + snapshot jobs**
   - Hook request/resource mutations to emit `request_event_log` entries.
   - Implement the 15-min aggregation job (can run inside the backend process initially).

3. **Baseline inference stub**
   - Implement `predictive-allocation` service that creates placeholder recommendations (e.g., simple rule-based) to exercise the API/UI flow.
   - Store operator feedback for labeling.

4. **Model integration**
   - Decide modeling stack (quick path: Python service invoked via CLI or Node binding) and define feature contract.
   - Track metrics per `predictive_model_runs`.

5. **Shadow mode rollout**
   - Keep recommendations read-only initially; compare predictions vs. actuals.
   - Once precision reaches target, enable one-click application tied into the allocation workflow.

---

By landing this plan we have clear targets for schema, services, and UI so multiple contributors can work in parallel without blocking on data ambiguities.
