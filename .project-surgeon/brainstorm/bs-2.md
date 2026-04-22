# Brainstorm BS-2: Backend Review Scope For Prompt 02
Date: 2026-04-03T00:30:41.5875832+08:00
Mode: Reduced (3 steps)

## Step 1: Research Findings
- The current task is explicitly scoped to `backend`, so the review should stay within `backend/src/server.js`, `backend/src/services`, `backend/prisma/schema.prisma`, and `backend/scripts`, while only using frontend files as consumption evidence.
- The main blind spots for this stack are not framework-level CVEs but business-boundary gaps: identity source drift, paid-content access control, mock payment being mistaken for a completed payment chain, and schema tables being mistaken for delivered capabilities.
- Runtime verification must be treated separately from static review because `verifyJoinFlow.js` depends on a live PostgreSQL instance at `localhost:5432`.

## Step 4: Multi-Perspective Evaluation
- Product view: the shortest path to a runnable first phase is preserving the current monolith shape and ranking gaps by closure impact, not by table count.
- Security view: the highest-risk files are `server.js`, `joinFlowService.js`, `contentService.js`, and `authService.js` because they define identity trust, content visibility, and payment state changes.
- Data model view: `schema.prisma` is ahead of implementation; coverage must be judged by route and service consumption, not by model presence.
- Operations view: `verifyJoinFlow.js`, `deleteGroup.js`, and `seedDemoData.js` are useful tooling, but they do not reduce the need for real admin or payment endpoints.
- Integration view: `server.js` must be read together with consuming services because auth data currently flows through query params, headers, and request bodies.
- Planning view: this review scope is sufficient for Prompt 03 because it covers the exact modules that determine whether phase-one backend work can close the mini-program and admin flows.

## Step 5: Self-Interrogation
- Are we missing critical integration points? The only required cross-checks are frontend consumption files and the seed script; both were reviewed as evidence, so no additional backend module is blocking this audit.
- Could scope bias hide real issues? Yes, if we treated stats, renewal, and notification tables as delivered capabilities. The review explicitly avoids that by mapping schema models to services and scripts.
- Could dimension priority hide operational gaps? Partially, so the report keeps debug/order exposure and script runtime dependency visible even though Prompt 02 is primarily a business-closure audit.

## Step 7: Synthesis / Decision
- Proceed with a targeted backend review centered on five hotspots: `backend/src/server.js`, `backend/src/services/joinFlowService.js`, `backend/src/services/contentService.js`, `backend/src/services/authService.js`, and `backend/prisma/schema.prisma`.
- Confidence is sufficient for Prompt 02 because the review now has both code-path evidence and a failed runtime verification showing that the database-backed join flow has not been validated on April 3, 2026.
- Recommended handoff for Prompt 03 remains unchanged: identity unification, content read gating, real payment, real admin stats, then minimal ops endpoints.
