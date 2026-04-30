# Vendor Compatibility Integration

This repository includes several vendor-specific compatibility paths that are
selected by upstream `baseURL`.

## Host Rules

- `kkidc.com`
  - Treated as a wrapped Doubao video provider.
- `api.apimart.ai`
  - Treated as a wrapped video provider using the Apimart-compatible routes.
- `duomiapi.com`
  - Treated as a Duomi-compatible provider.
- `claw.dualseason.com`
  - Treated as both:
    - an Apimart-style wrapped video provider
    - a Duomi-compatible provider for task, image, and Suno passthrough flows

## Video Compatibility

### Wrapped Doubao Video

Used for `kkidc.com`, `api.apimart.ai`, and `claw.dualseason.com`.

- Provider selection is based on `baseURL`.
- `kkidc.com`
  - Submit: `POST /v1/video/generations`
  - Fetch: `GET /v1/video/generations/:task_id`
- `api.apimart.ai`
  - Submit: `POST /v1/videos/generations`
  - Fetch: `GET /v1/tasks/:task_id`
- `claw.dualseason.com`
  - Submit: `POST /v1/videos/generations`
  - Fetch: `GET /v1/tasks/:task_id`

The wrapped Doubao video flow is used when the routed model name starts with:

- `doubao-seedance`
- `seed-2`

## Duomi-Compatible Video

Used for `duomiapi.com` and `claw.dualseason.com`.

- Submit: `POST /v1/videos/generations`
- Fetch: `GET /v1/videos/tasks/:task_id`

This compatibility path is shared by:

- Gemini task adaptor
- Vertex task adaptor
- Sora task adaptor

## Task Query Compatibility

These task query routes are supported:

- `GET /v1/tasks/:task_id`
- `GET /v1/videos/tasks/:task_id`
- `GET /v1/video/generations/:task_id`
- `GET /v1/videos/:task_id`

Behavior:

- Query by local `task_id`
- Fallback query by stored upstream task id
- If local task is missing and the host is Duomi-compatible, query the upstream
  task endpoint directly

## OpenAI Image Async Compatibility

Used for `duomiapi.com` and `claw.dualseason.com`.

- Detects async task-style image responses
- Polls `GET /v1/tasks/:task_id`
- Converts the final response back into OpenAI image response format

## Suno Passthrough Compatibility

Used for Duomi-compatible hosts.

- `POST /api/suno/generate`
- `GET /api/suno/feed?task_id=...`

Routing rule:

- Prefer channels whose type is `SunoAPI`
- Otherwise fall back to any Duomi-compatible enabled channel

## Model Aliases Added

### Doubao / Seedance / Seed-2

- `doubao-seedance-2.0`
- `doubao-seedance-2.0-fast`
- `doubao-seedance-2.0-face`
- `doubao-seedance-2.0-fast-face`
- `seed-2`
- `seed-2-vision`
- `seed-2-fast`
- `seed-2-fast-vision`

### Gemini / Vertex

- `veo3.1-fast`
- `veo3.1-pro`

### Sora

- `sora-2-temporary`

### XAI

- `grok-video`

## Notes

- `claw.dualseason.com` is intentionally included in both wrapped video and
  Duomi-compatible checks.
- This is useful when the same domain exposes multiple vendor-compatible route
  shapes.
