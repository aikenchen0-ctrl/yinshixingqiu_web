# Course Web Video Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual video URL entry in the admin course lesson page with upload-only video selection that writes the uploaded URL back into `lessonForm.videoUrl`.

**Architecture:** Keep the existing course lesson save payload and backend upload API unchanged. Implement the upload-only flow entirely inside `admin-web/src/pages/admin/CourseManagementPage.tsx`, reusing `uploadPlanetVideo(file)` and adding a small amount of upload-specific UI plus matching styles in `admin-web/src/styles.css`.

**Tech Stack:** React 19 + TypeScript in `admin-web`, existing shared `planetWebService`, Vite production build for verification.

---

## File Map

- Modify: `admin-web/src/pages/admin/CourseManagementPage.tsx`
  - Add upload state, file input ref, upload handlers, upload-only video UI, and save-button disable logic.
- Modify: `admin-web/src/styles.css`
  - Add styles for the upload block, upload hint, and read-only uploaded-video status area.
- Read: `admin-web/src/services/planetWebService.ts`
  - Reuse `uploadPlanetVideo(file)` exactly as-is; no service changes are needed.

### Task 1: Add upload state and handlers to the course lesson page

**Files:**
- Modify: `admin-web/src/pages/admin/CourseManagementPage.tsx`
- Read: `admin-web/src/services/planetWebService.ts`

- [ ] **Step 1: Write the failing integration scaffold**

Update the course page imports and save-button disabled logic first so the build will fail on the missing upload symbols you are about to implement.

Add these import changes near the top of `admin-web/src/pages/admin/CourseManagementPage.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { uploadPlanetVideo } from '../../services/planetWebService'
```

Then update the lesson save button so it references the new upload state before it exists:

```tsx
<button
  className="admin-resource-submit"
  disabled={savingLesson || uploadingLessonVideo}
  onClick={() => void handleSaveLesson()}
  type="button"
>
  {savingLesson ? '保存中...' : lessonForm.lessonId ? '更新课节' : '创建课节'}
</button>
```

Expected result of this step: `uploadingLessonVideo` is referenced but not defined yet.

- [ ] **Step 2: Run the admin build to verify it fails**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp
npm run build:admin
```

Expected: TypeScript build fails with an error equivalent to `Cannot find name 'uploadingLessonVideo'`.

- [ ] **Step 3: Write the minimal upload state and handlers**

Add the upload ref and state near the other React state declarations:

```tsx
const [uploadingLessonVideo, setUploadingLessonVideo] = useState(false)
const lessonVideoInputRef = useRef<HTMLInputElement | null>(null)
```

Add these helpers inside `CourseWorkbenchPage`, close to the other form actions:

```tsx
function resetLessonVideoInput() {
  if (lessonVideoInputRef.current) {
    lessonVideoInputRef.current.value = ''
  }
}

function handleLessonVideoUploadTrigger() {
  if (!selectedCourse || uploadingLessonVideo || savingLesson || lessonForm.lessonType !== 'VIDEO') {
    return
  }

  lessonVideoInputRef.current?.click()
}

async function handleLessonVideoFileChange(event: ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0]
  if (!file) {
    resetLessonVideoInput()
    return
  }

  setUploadingLessonVideo(true)
  setError('')
  setNotice('')

  try {
    const uploaded = await uploadPlanetVideo(file)
    setLessonForm((previous) => ({
      ...previous,
      videoUrl: uploaded.url,
    }))
    setNotice('课程视频已上传')
  } catch (requestError) {
    setError(requestError instanceof Error ? requestError.message : '视频上传失败')
  } finally {
    setUploadingLessonVideo(false)
    resetLessonVideoInput()
  }
}
```

Keep the existing lesson-type switch behavior that clears `videoUrl` when switching away from `VIDEO`:

```tsx
setLessonForm((previous) => ({
  ...previous,
  lessonType: nextLessonType,
  videoUrl: nextLessonType === 'VIDEO' ? previous.videoUrl : '',
  contentText: nextLessonType === 'ARTICLE' ? previous.contentText : '',
}))
```

- [ ] **Step 4: Run the admin build to verify the state layer passes**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp
npm run build:admin
```

Expected: The previous `uploadingLessonVideo` undefined error is gone. If the build still fails, it should now be due only to the next planned JSX symbols if you added them early.

- [ ] **Step 5: Commit the state-layer checkpoint**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp
git add admin-web/src/pages/admin/CourseManagementPage.tsx
git commit -m "feat: add course lesson video upload state"
```

Expected: commit contains only the course management page state/handler changes.

### Task 2: Replace manual video URL entry with upload-only UI

**Files:**
- Modify: `admin-web/src/pages/admin/CourseManagementPage.tsx`
- Modify: `admin-web/src/styles.css`

- [ ] **Step 1: Write the failing JSX change**

Replace the old video URL text input in `admin-web/src/pages/admin/CourseManagementPage.tsx`:

```tsx
{lessonForm.lessonType === 'VIDEO' ? (
  <label className="admin-resource-field admin-resource-field-span-2">
    <span>视频地址</span>
    <input
      onChange={(event) => setLessonForm((previous) => ({ ...previous, videoUrl: event.target.value }))}
      placeholder="https://...mp4"
      type="text"
      value={lessonForm.videoUrl}
    />
  </label>
) : null}
```

with this upload-only block that references the handlers from Task 1 and new CSS classes:

```tsx
{lessonForm.lessonType === 'VIDEO' ? (
  <div className="admin-resource-field admin-resource-field-span-2 course-admin-video-upload-field">
    <span>课程视频</span>

    <div className="course-admin-video-upload-row">
      <button
        className="admin-resource-secondary"
        disabled={!selectedCourse || uploadingLessonVideo || savingLesson}
        onClick={handleLessonVideoUploadTrigger}
        type="button"
      >
        {uploadingLessonVideo ? '上传中...' : lessonForm.videoUrl ? '重新上传视频' : '上传视频'}
      </button>
      <span className="course-admin-video-upload-hint">支持 MP4、MOV、M4V、WebM、OGG，最大 80MB</span>
    </div>

    <div className={`course-admin-video-upload-status ${lessonForm.videoUrl ? 'is-ready' : 'is-empty'}`}>
      <strong>{lessonForm.videoUrl ? '已上传视频' : '暂未上传视频'}</strong>
      <span>{lessonForm.videoUrl || '上传后会自动回填当前课节的视频地址'}</span>
    </div>

    <input
      accept="video/mp4,video/quicktime,video/x-m4v,video/webm,video/ogg,.mp4,.mov,.m4v,.webm,.ogg"
      hidden
      onChange={handleLessonVideoFileChange}
      ref={lessonVideoInputRef}
      type="file"
    />
  </div>
) : null}
```

Expected result of this step: the page now depends on CSS classes that do not exist yet.

- [ ] **Step 2: Run the admin build to verify the JSX layer still type-checks**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp
npm run build:admin
```

Expected: PASS. This confirms the upload-only JSX is valid before you style it.

- [ ] **Step 3: Add the upload-only styles**

Append these rules near the existing `.course-admin-form-grid` and `.course-admin-form-actions` block in `admin-web/src/styles.css`:

```css
.course-admin-video-upload-field {
  gap: 10px;
}

.course-admin-video-upload-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.course-admin-video-upload-hint {
  color: rgba(15, 23, 42, 0.64);
  font-size: 13px;
  line-height: 1.6;
}

.course-admin-video-upload-status {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(248, 250, 252, 0.9);
}

.course-admin-video-upload-status.is-ready {
  border-color: rgba(16, 185, 129, 0.28);
  background: rgba(236, 253, 245, 0.88);
}

.course-admin-video-upload-status strong {
  color: #0f172a;
  font-size: 14px;
}

.course-admin-video-upload-status span {
  color: rgba(15, 23, 42, 0.72);
  font-size: 13px;
  line-height: 1.6;
  word-break: break-all;
}
```

- [ ] **Step 4: Run the admin build to verify the full UI passes**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp
npm run build:admin
```

Expected: PASS with a successful Vite production build.

- [ ] **Step 5: Commit the upload-only UI checkpoint**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp
git add admin-web/src/pages/admin/CourseManagementPage.tsx admin-web/src/styles.css
git commit -m "feat: add upload-only course lesson video UI"
```

Expected: commit contains the final course lesson video upload UI and styles.

### Task 3: Verify the end-to-end admin workflow manually

**Files:**
- Modify: `admin-web/src/pages/admin/CourseManagementPage.tsx`
- Modify: `admin-web/src/styles.css`

- [ ] **Step 1: Run the final static verification**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp
npm run build:admin
```

Expected: PASS

- [ ] **Step 2: Start the admin app locally**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp/admin-web
npm run dev -- --host 0.0.0.0
```

Expected: Vite prints a local URL and a LAN URL for the admin app.

- [ ] **Step 3: Verify the new-video upload flow**

Open the admin course lesson page and confirm all of the following:

```text
1. Pick a course, click “新建课节”, and switch the lesson type to “视频课”.
2. Confirm the old editable “视频地址” input no longer appears.
3. Confirm the page shows an “上传视频” button and the empty-state text “暂未上传视频”.
4. Choose a valid MP4/MOV/M4V/WebM/OGG file smaller than 80MB.
5. Confirm the button changes to “上传中...” while the request is in flight.
6. Confirm the status block updates to “已上传视频” and shows the returned URL.
7. Confirm the primary save button stays disabled during upload and re-enables after upload completes.
```

Expected: the uploaded URL appears in the read-only status block and the lesson can be saved without manual URL entry.

- [ ] **Step 4: Verify edit-and-replace behavior**

Check an existing video lesson:

```text
1. Click “编辑” on an existing视频课.
2. Confirm the current uploaded URL is shown in the read-only status block.
3. Click “重新上传视频”.
4. Select a different valid video file.
5. Confirm the status block updates to the new returned URL after upload succeeds.
```

Expected: replacing an existing video updates `lessonForm.videoUrl` without exposing a free-text URL input.

- [ ] **Step 5: Verify the failure path**

Use one of these negative checks:

```text
1. Upload a file larger than 80MB, or
2. Upload an unsupported file type renamed as a video, or
3. Temporarily point the admin app at an unavailable backend.
```

Expected:

```text
- The page shows an inline error message.
- The previous video URL, if any, stays unchanged.
- The upload button returns to an idle state.
- You can click the upload button again and retry.
```

- [ ] **Step 6: Commit the verified result**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp
git add admin-web/src/pages/admin/CourseManagementPage.tsx admin-web/src/styles.css
git commit -m "feat: switch course lesson videos to upload-only flow"
```

Expected: the final commit contains only the course lesson upload feature changes.
