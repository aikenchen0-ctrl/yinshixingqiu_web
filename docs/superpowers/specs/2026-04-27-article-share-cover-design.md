# Article Share Cover Selection Design

## Goal

For the WeChat article detail page, make the title-right share button open a cover-selection flow first. The user should be able to choose one image from the article content, then share that image with a mini program entrance that opens the current article detail page.

## Scope

- In scope:
  - WeChat article detail page only
  - Title-right share button behavior
  - Extracting candidate cover images from article content
  - Letting the user choose one candidate image
  - Sharing the chosen image with article deep link entrance
- Out of scope:
  - Planet article page
  - Server-side article schema changes
  - New persistent user settings

## Constraints

- Native `button open-type="share"` immediately enters mini program card sharing and does not fit a pre-share image picker flow.
- `wx.showShareImageMenu` supports image sharing with mini program entrance, but requires a local or temp image path.
- Article body images may come from remote URLs, so the selected image must be downloaded before opening the share image menu.
- Some articles may have no body images. The flow needs a fallback.

## Chosen Approach

Replace the current title-right share button behavior for WeChat articles:

1. Tap share button.
2. Build image candidates from the current article detail data.
3. Show an action sheet or bottom-sheet style selector listing the available images.
4. After selection, download the chosen image to a temp file.
5. Call `wx.showShareImageMenu` with:
   - `path`: downloaded temp image path
   - `needShowEntrance: true`
   - `entrancePath`: current article detail path

This gives the user explicit control over the cover while still preserving a direct way back into the article.

## Candidate Image Rules

Candidate order:

1. Images found in WeChat rich content body
2. Inline WeChat card cover images inside body blocks
3. Article `coverImage` as final fallback

Normalization rules:

- Remove empty values
- Normalize asset URLs before use
- De-duplicate by normalized URL string
- Keep original order from the article body

If the final candidate list is empty:

- Show a toast like `文章里没有可分享的图片`
- Do not open the share menu

## UI Behavior

- Keep the share icon in the current title-right position.
- Change it from `open-type="share"` to a normal tap handler.
- Use a lightweight picker first.
- Recommended picker content:
  - `封面 1`, `封面 2`, `封面 3` style labels for the action sheet
  - If there is only one candidate, skip the picker and share directly

This keeps the change minimal and avoids building a heavy custom modal in the first implementation.

## Data Changes

Add article-detail view data derived from existing content:

- `shareImageCandidates: string[]`

Derive this on the article detail mapping side so the page consumes a ready-to-use candidate list instead of reparsing rich content during every tap.

## Implementation Areas

Likely files:

- `miniprogram/utils/article-view.ts`
  - extract and expose share image candidates
- `miniprogram/pages/articles/detail.ts`
  - handle share tap
  - show chooser
  - download selected image
  - call `wx.showShareImageMenu`
- `miniprogram/pages/articles/detail.wxml`
  - switch from native share button to tap-triggered button

## Error Handling

- If article data is still loading, ignore tap.
- If image download fails, show `封面下载失败，请重试`.
- If `wx.showShareImageMenu` is unavailable, show a compatible fallback message.
- If the user cancels the chooser, do nothing.

## Testing

Manual checks:

1. WeChat article with multiple body images:
   - tap share
   - picker appears
   - choose one image
   - share image menu opens with mini program entrance
2. WeChat article with one image:
   - tap share
   - no picker
   - share image menu opens directly
3. WeChat article with no body image but with cover:
   - share uses cover fallback
4. WeChat article with no usable image:
   - toast shown
   - no crash
5. Planet article detail page:
   - no behavior regression

Code checks:

- `npm run check:miniprogram`

## Risks

- Some remote image hosts may refuse download from the mini program runtime.
- Action sheet can only show text labels, not previews. That is acceptable for the first iteration, but a later version could upgrade to a custom image-preview picker if needed.
