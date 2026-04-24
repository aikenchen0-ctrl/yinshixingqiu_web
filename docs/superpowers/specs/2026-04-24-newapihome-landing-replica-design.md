# newapihome Landing Replica Design

- Date: 2026-04-24
- Scope: `/home/youshaocong/hgfs/xueyinMiniapp/newapihome`
- Goal: Build a standalone static homepage that recreates the visual structure, tone, and motion language of `https://zx1.deepwl.net/` as closely as practical without copying its bundled application code.

## Problem Brief

`newapihome/` currently has no usable page implementation. The user wants a homepage placed directly under that folder, not integrated into `miniprogram` or `admin-web`, and wants the result to be as close as possible to the reference site's homepage, including motion.

The solution needs to work as a plain static page that can be opened directly or served by a basic static host. Because this repo lives in a shared-folder workflow, the implementation also needs explicit post-write verification that the expected files really exist in the shared directory.

## Constraints Matrix

- Must live under `newapihome/`.
- Must be standalone static assets.
- Must favor visual and motion fidelity over framework parity.
- Must not depend on the reference site's packed React bundle.
- Must be maintainable enough for later text/logo replacement.
- Must tolerate desktop and mobile viewport changes.
- Must verify that shared-folder writes actually landed on disk.

## Approaches Considered

### 1. Pure HTML and CSS

Use fixed DOM nodes and CSS keyframes only.

Pros:
- Lowest complexity.
- Minimal JavaScript.

Cons:
- Hard to reproduce the reference's scattered floating text field with convincing variance.
- Weak adaptability across viewport sizes.

### 2. DOM text field with CSS motion and light JavaScript orchestration

Use a static HTML shell, a centered logo layer, and JavaScript-generated floating text nodes whose positions, sizes, and animation delays are assigned at runtime.

Pros:
- Best cost-to-fidelity ratio.
- Still simple static hosting.
- Easy to tune spacing, opacity, animation, and text inventory.

Cons:
- Slightly more code than a pure CSS page.

### 3. Canvas-based particle/text engine

Render the floating field in canvas and layer DOM content above it.

Pros:
- Highest motion freedom.

Cons:
- Unnecessary complexity for a single landing page.
- Harder to maintain and edit later.

## Chosen Design

Approach 2 is the implementation target.

The page will mimic the reference in these visible ways:

- Full black background with a high-contrast centered white logo.
- Sparse, space-like distribution of short white marketing phrases around the canvas.
- Motion that feels slow, ambient, and premium rather than busy.
- Weak central breathing motion on the logo and staggered float/fade motion on surrounding phrases.
- Minimal structure so the experience reads like a brand splash/landing page instead of a conventional marketing site.

## File Layout

Files to create:

- `newapihome/index.html`
- `newapihome/styles.css`
- `newapihome/script.js`

Optional local asset:

- `newapihome/logo.svg`

If the reference logo is not reused directly, a simplified geometric white SVG mark will be created so the page still preserves the same visual role and balance.

## Page Structure

### Root Layers

The page uses three visual layers:

1. Background layer
   - solid black background
   - subtle radial glow/vignette so the center does not feel flat

2. Floating text layer
   - absolutely positioned phrases around the stage
   - variable font size, opacity, blur, and drift speed
   - some phrases intentionally enter or exit the viewport edge to match the reference's loose composition

3. Center focus layer
   - centered logo
   - optional tiny subcopy below or above only if needed for visual balance

### Content Inventory

The floating copy set will be based on phrases observed from the reference, such as:

- `探索无限`
- `模型即服务`
- `AI 赋能`
- `API 聚合`
- `创作不绕路`
- `一站式 AI 工作台`
- `智能提速 降本增效`
- `好用省心更专业`
- `企业级稳定可靠`
- `数据安全`
- `接入简单`
- `效率翻倍`
- `智能体验`
- `高效创作不绕路`
- `灵感即生产力`
- `秒级响应`
- `安全合规可审计`
- `从想法到落地`
- `智能编排 一键触达`

The final phrase list may be slightly expanded so the stage density feels closer to the reference at large desktop sizes.

## Motion Design

### Floating Copy

Each phrase receives:

- randomized but bounded position
- size tier
- opacity tier
- animation duration
- animation delay
- subtle X/Y drift distance

Animation behavior:

- slow float on a multi-second loop
- very light fade modulation
- no aggressive parallax
- no heavy particle simulation

This keeps the effect close to the reference's ambient branded splash instead of looking like a screensaver.

### Center Logo

The logo uses:

- soft fade-in on load
- small breathing scale loop
- optional low-strength glow

The logo remains visually dominant. The surrounding copy should never compete with it.

## Responsive Behavior

### Desktop

- Preserve broad empty space.
- Allow off-edge phrases for the same sparse-field impression.
- Keep logo visually centered.

### Mobile

- Reduce phrase count.
- Clamp phrase sizes more aggressively.
- Keep the logo centered and legible.
- Prevent text overlaps from becoming unreadable.

Runtime JavaScript will regenerate or adjust positions on resize using viewport-based bounds.

## Implementation Notes

- Use semantic HTML but keep DOM minimal.
- Use CSS custom properties for color, glow, timing, and typography scales.
- Use plain JavaScript with no build step.
- Avoid external dependencies.
- Use deterministic fallback positions if random placement collides too heavily.
- Keep all files ASCII-only unless an existing file already needs otherwise. Chinese copy inside page content is justified and required.

## Validation Plan

Implementation will be considered ready when all of the following are true:

- `newapihome/index.html`, `styles.css`, and `script.js` exist in the shared folder.
- The page opens locally as a static file or via a simple static server.
- Desktop screenshots visibly match the reference's overall structure and mood.
- Mobile width remains legible and centered.
- Animations run without obvious layout jumps.
- Shared-folder existence is verified after writing.

## Risks And Mitigations

### Risk: Overfitting to the reference bundle

Mitigation:
- Recreate appearance and motion language, not their framework internals.

### Risk: Random placement produces collisions

Mitigation:
- Use bounded placement zones, minimum spacing checks, and reduced copy counts on smaller screens.

### Risk: Shared-folder writes appear successful but are stale

Mitigation:
- Verify exact files with shell listing and content inspection after writing.

## Out Of Scope

- Rebuilding the reference site's full application shell.
- Reproducing hidden business logic behind the reference bundle.
- Integrating this page into `miniprogram`, `admin-web`, or backend routes in this task.
