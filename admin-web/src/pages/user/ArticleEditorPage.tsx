import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, MouseEvent } from 'react'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { CharacterCount, Placeholder } from '@tiptap/extensions'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  getPlanetHome,
  uploadPlanetImage,
  uploadPlanetVideo,
  type GroupHomePayload,
  type PlanetVideoUploadResult,
} from '../../services/planetWebService'
import {
  getArticleDetail,
  saveArticle,
  type ArticleContentSource,
  type ArticleItem,
} from '../../services/articleWebService'
import { VideoBlock } from './VideoBlock'

const MAX_CONTENT_LENGTH = 5000
const MAX_IMAGE_COUNT = 9
const MAX_VIDEO_COUNT = 5
const VIDEO_FILE_EXTENSION_PATTERN = /\.(mp4|m4v|mov|webm|ogv|ogg)$/i
type ArticleAccessType = 'free' | 'paid'
type ArticlePreviewMode = 'paragraph' | 'ratio'

interface EditorSnapshot {
  html: string
  text: string
}

interface EditorVideoAttachment {
  name: string
  url: string
  poster: string
  mimeType: string
}

interface ArticlePublishAccessMetadata {
  accessType: ArticleAccessType
  priceAmount: number
  priceLabel: string
  isUnlocked: boolean
  previewMode: ArticlePreviewMode
  previewValue: number
  previewRichContent: string
  previewText: string
  contentParagraphCount: number
  previewParagraphCount: number
}

function parsePositiveNumber(value: string) {
  const normalized = value.trim()
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

const emptyEditorSnapshot: EditorSnapshot = {
  html: '',
  text: '',
}

const defaultToolbarState = {
  bold: false,
  italic: false,
  underline: false,
  heading2: false,
  heading3: false,
  bulletList: false,
  orderedList: false,
  blockquote: false,
  link: false,
  alignLeft: false,
  alignCenter: false,
  alignRight: false,
  characters: 0,
}

function parsePositiveInteger(value: string) {
  const normalized = value.trim()
  if (!/^\d+$/.test(normalized)) {
    return null
  }

  const parsed = Number(normalized)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function validateArticleAccessConfig(
  accessType: ArticleAccessType,
  previewMode: ArticlePreviewMode,
  priceInput: string,
  previewValueInput: string,
) {
  if (accessType === 'free') {
    return {
      priceAmount: null,
      previewValue: null,
      errorMessage: '',
    }
  }

  const priceAmount = parsePositiveInteger(priceInput)
  if (priceAmount === null) {
    return {
      priceAmount: null,
      previewValue: null,
      errorMessage: '付费文章需要填写大于 0 的整数售价',
    }
  }

  const previewValue =
    previewMode === 'ratio' ? parsePositiveNumber(previewValueInput) : parsePositiveInteger(previewValueInput)
  if (previewValue === null) {
    return {
      priceAmount,
      previewValue: null,
      errorMessage: previewMode === 'ratio' ? '付费文章需要填写 0 到 1 之间的试看比例' : '付费文章需要填写大于 0 的试看段数',
    }
  }

  if (previewMode === 'ratio' && previewValue > 1) {
    return {
      priceAmount,
      previewValue: null,
      errorMessage: '试看比例不能大于 1，建议填写 0.1 到 1 之间的小数',
    }
  }

  return {
    priceAmount,
    previewValue,
    errorMessage: '',
  }
}

function normalizeTags(value: string) {
  return value
    .split(/[\s,，]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
}

function isImageFile(file: File) {
  return file.type.startsWith('image/')
}

function isVideoFile(file: File) {
  return file.type.startsWith('video/') || VIDEO_FILE_EXTENSION_PATTERN.test(file.name)
}

function isSupportedEditorUploadFile(file: File) {
  return isImageFile(file) || isVideoFile(file)
}

function buildSummary(title: string, summary: string, content: string) {
  const manualSummary = summary.trim()
  if (manualSummary) {
    return manualSummary.slice(0, 120)
  }

  const normalizedContent = content.replace(/\s+/g, ' ').trim()
  if (normalizedContent) {
    return normalizedContent.slice(0, 120)
  }

  return title.trim().slice(0, 120)
}

function extractImageUrls(html: string) {
  const matches = Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi))
  const urls = matches
    .map((match) => match[1]?.trim() || '')
    .filter(Boolean)

  return Array.from(new Set(urls)).slice(0, MAX_IMAGE_COUNT)
}

function extractVideoAttachments(html: string) {
  if (!html.trim() || typeof DOMParser === 'undefined') {
    return []
  }

  const document = new DOMParser().parseFromString(html, 'text/html')
  const seenUrls = new Set<string>()

  return Array.from(document.querySelectorAll('video[src]'))
    .map((node, index) => {
      const url = node.getAttribute('src')?.trim() || ''
      const poster = node.getAttribute('poster')?.trim() || ''
      const name = node.getAttribute('data-name')?.trim() || node.getAttribute('title')?.trim() || `视频 ${index + 1}`
      const mimeType = node.getAttribute('data-mime-type')?.trim() || node.getAttribute('type')?.trim() || ''

      return {
        name,
        url,
        poster,
        mimeType,
      } as EditorVideoAttachment
    })
    .filter((item) => {
      if (!item.url || seenUrls.has(item.url)) {
        return false
      }

      seenUrls.add(item.url)
      return true
    })
    .slice(0, MAX_VIDEO_COUNT)
}

function normalizeEditorHtml(html: string) {
  const normalized = html.trim()
  if (!normalized || normalized === '<p></p>') {
    return ''
  }

  return normalized
}

function escapeHtmlText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatArticlePriceLabel(priceAmount: number) {
  const normalizedPrice = Number.isFinite(priceAmount) ? Math.max(0, Math.round(priceAmount)) : 0
  return normalizedPrice > 0 ? `¥${normalizedPrice}` : '免费'
}

function collectArticleBlockHtmlList(html: string) {
  const normalizedHtml = normalizeEditorHtml(html)
  if (!normalizedHtml || typeof DOMParser === 'undefined') {
    return [] as string[]
  }

  const document = new DOMParser().parseFromString(normalizedHtml, 'text/html')
  const blockTags = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'pre', 'figure', 'video', 'img', 'hr'])

  return Array.from(document.body.childNodes)
    .map((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const textContent = node.textContent?.trim() || ''
        return textContent ? `<p>${escapeHtmlText(textContent)}</p>` : ''
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return ''
      }

      const element = node as HTMLElement
      const tagName = element.tagName.toLowerCase()
      const textContent = element.textContent?.replace(/\s+/g, ' ').trim() || ''
      const hasMeaningfulMedia = tagName === 'img' || tagName === 'hr' || tagName === 'video' || tagName === 'figure'

      if (!blockTags.has(tagName) && !textContent) {
        return ''
      }

      if (!textContent && !hasMeaningfulMedia) {
        return ''
      }

      return element.outerHTML
    })
    .filter(Boolean)
}

function splitEditorTextToParagraphs(text: string) {
  return String(text || '')
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildPreviewParagraphCount(totalParagraphCount: number, previewMode: ArticlePreviewMode, previewValue: number) {
  if (totalParagraphCount <= 0) {
    return 0
  }

  if (previewMode === 'paragraph') {
    return Math.max(1, Math.min(totalParagraphCount, previewValue))
  }

  const normalizedRatio = Math.max(0.1, Math.min(1, previewValue))
  return Math.max(1, Math.min(totalParagraphCount, Math.ceil(totalParagraphCount * normalizedRatio)))
}

function buildArticlePublishAccessMetadata(
  accessType: ArticleAccessType,
  previewMode: ArticlePreviewMode,
  snapshot: EditorSnapshot,
  priceAmount: number,
  previewValue: number,
): ArticlePublishAccessMetadata {
  const richContentBlocks = collectArticleBlockHtmlList(snapshot.html)
  const textParagraphs = splitEditorTextToParagraphs(snapshot.text)
  const contentParagraphCount = Math.max(richContentBlocks.length, textParagraphs.length)

  if (accessType === 'free') {
    const fullPreviewValue = Math.max(contentParagraphCount, 1)

    return {
      accessType: 'free',
      priceAmount: 0,
      priceLabel: '免费',
      isUnlocked: true,
      previewMode,
      previewValue: fullPreviewValue,
      previewRichContent: snapshot.html,
      previewText: snapshot.text,
      contentParagraphCount,
      previewParagraphCount: contentParagraphCount,
    }
  }

  const previewParagraphCount = buildPreviewParagraphCount(contentParagraphCount, previewMode, previewValue)
  const previewRichContent = richContentBlocks.slice(0, previewParagraphCount).join('')
  const previewText = textParagraphs.slice(0, previewParagraphCount).join('\n')

  return {
    accessType: 'paid',
    priceAmount,
    priceLabel: formatArticlePriceLabel(priceAmount),
    isUnlocked: false,
    previewMode,
    previewValue,
    previewRichContent,
    previewText,
    contentParagraphCount,
    previewParagraphCount,
  }
}

function readEditorSnapshot(editor: Editor): EditorSnapshot {
  return {
    html: normalizeEditorHtml(editor.getHTML()),
    text: editor.getText({ blockSeparator: '\n' }).trim(),
  }
}

function clampSelection(editor: Editor, selection: { from: number; to: number } | null) {
  if (!selection) return null

  const maxPosition = editor.state.doc.content.size
  const from = Math.max(0, Math.min(selection.from, maxPosition))
  const to = Math.max(from, Math.min(selection.to, maxPosition))

  return { from, to }
}

function ToolbarButton({
  active = false,
  disabled = false,
  label,
  onAction,
  title,
}: {
  active?: boolean
  disabled?: boolean
  label: string
  onAction: () => void
  title: string
}) {
  function handleMouseDown(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    if (disabled) return
    onAction()
  }

  return (
    <button
      className={active ? 'article-editor-tool is-active' : 'article-editor-tool'}
      disabled={disabled}
      onMouseDown={handleMouseDown}
      title={title}
      type="button"
    >
      {label}
    </button>
  )
}

export function ArticleEditorPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { groupId } = useParams()
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null)
  const hydratedArticleIdRef = useRef('')

  const [home, setHome] = useState<GroupHomePayload | null>(null)
  const [editingArticle, setEditingArticle] = useState<ArticleItem | null>(null)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [contentSource, setContentSource] = useState<ArticleContentSource>('planet')
  const [accessType, setAccessType] = useState<ArticleAccessType>('free')
  const [priceInput, setPriceInput] = useState('')
  const [previewMode, setPreviewMode] = useState<ArticlePreviewMode>('paragraph')
  const [previewValueInput, setPreviewValueInput] = useState('')
  const [editorSnapshot, setEditorSnapshot] = useState<EditorSnapshot>(emptyEditorSnapshot)
  const [loadingHome, setLoadingHome] = useState(true)
  const [loadingArticle, setLoadingArticle] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const resolvedGroupId = String(groupId || '').trim()
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const articleId = searchParams.get('articleId') || ''
  const returnToAdmin = searchParams.get('from') === 'admin'
  const backTarget = returnToAdmin
    ? `/activity/content?groupId=${encodeURIComponent(resolvedGroupId || editingArticle?.groupId || '')}`
    : resolvedGroupId
      ? `/group/${resolvedGroupId}`
      : '/group_data'
  const backLabel = returnToAdmin ? '返回后台' : '返回星球'
  const pageTitle = articleId ? '编辑文章' : '创作文章'
  const submitLabel = articleId ? '保存' : '发布'
  const submitButtonLabel = submitting ? (articleId ? '保存中...' : '发布中...') : submitLabel
  const tags = normalizeTags(tagInput)
  const normalizedTitle = title.trim()
  const inlineImageUrls = extractImageUrls(editorSnapshot.html)
  const inlineVideoAttachments = extractVideoAttachments(editorSnapshot.html)
  const resolvedSummary = buildSummary(normalizedTitle, summary, editorSnapshot.text)
  const canPublish = Boolean(home?.role.canPublish)
  const headerStatusText = loadingArticle ? '正在回填文章...' : loadingHome ? '正在加载权限...' : canPublish ? pageTitle : '无发布权限'
  const currentGroupLabel = loadingHome ? '正在加载星球信息...' : home?.group.name || '当前星球'
  const accessValidation = validateArticleAccessConfig(accessType, previewMode, priceInput, previewValueInput)
  const previewValueFieldConfig = useMemo(
    () =>
      previewMode === 'ratio'
        ? {
            inputMode: 'decimal' as const,
            min: '0.1',
            placeholder: '输入 0.1 到 1 之间的小数',
            step: '0.1',
            unit: '比例',
          }
        : {
            inputMode: 'numeric' as const,
            min: '1',
            placeholder: '输入可见段数',
            step: '1',
            unit: '段',
          },
    [previewMode],
  )
  const accessOverview =
    accessType === 'free'
      ? '免费全文'
      : accessValidation.errorMessage
        ? '付费配置待完成'
        : previewMode === 'ratio'
          ? `付费 ¥${accessValidation.priceAmount} / ${Math.round((accessValidation.previewValue || 0) * 100)}% 试看`
          : `付费 ¥${accessValidation.priceAmount} / 前 ${accessValidation.previewValue} 段试看`
  const accessSummaryText =
    accessType === 'free'
      ? '免费全文模式下不强制填写售价和试看。'
      : `${typeof accessValidation.priceAmount === 'number' ? `售价 ¥${accessValidation.priceAmount}` : '待设置售价'}，${
          typeof accessValidation.previewValue === 'number'
            ? previewMode === 'ratio'
              ? `开放 ${Math.round(accessValidation.previewValue * 100)}% 内容`
              : `前 ${accessValidation.previewValue} 段可见`
            : previewMode === 'ratio'
              ? '待设置试看比例'
              : '待设置试看段数'
        }`
  const accessNoteText =
    accessType === 'free'
      ? '当前为免费全文模式，用户可直接阅读完整内容。'
      : previewMode === 'ratio'
        ? '当前为付费试看模式，发布前会校验售价和试看比例。建议比例填写 0.1 到 1 之间的小数。'
        : '当前为付费试看模式，发布前会校验售价和试看段数。'

  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Underline,
      Link.configure({
        autolink: true,
        defaultProtocol: 'https',
        linkOnPaste: true,
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: 'article-rich-editor-image',
        },
      }),
      VideoBlock.configure({
        HTMLAttributes: {
          class: 'article-rich-editor-video',
        },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            return '小标题'
          }

          return '从这里开始输入正文'
        },
      }),
      CharacterCount.configure({
        limit: MAX_CONTENT_LENGTH,
      }),
    ],
    content: '<p></p>',
    editorProps: {
      handlePaste(view, event) {
        const files = Array.from(event.clipboardData?.files || []).filter(isSupportedEditorUploadFile)
        if (!files.length) {
          return false
        }

        const { from, to } = view.state.selection
        const nextSelection = { from, to }
        savedSelectionRef.current = nextSelection
        void uploadAndInsertMedia(files, nextSelection)
        return true
      },
      handleDrop(view, event) {
        const files = Array.from(event.dataTransfer?.files || []).filter(isSupportedEditorUploadFile)
        if (!files.length) {
          return false
        }

        const coordinates = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        })
        const nextSelection = coordinates
          ? {
              from: coordinates.pos,
              to: coordinates.pos,
            }
          : {
              from: view.state.selection.from,
              to: view.state.selection.to,
            }

        savedSelectionRef.current = nextSelection
        void uploadAndInsertMedia(files, nextSelection)
        return true
      },
    },
    onCreate: ({ editor: currentEditor }) => {
      setEditorSnapshot(readEditorSnapshot(currentEditor))
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      const { from, to } = currentEditor.state.selection
      savedSelectionRef.current = { from, to }
    },
    onUpdate: ({ editor: currentEditor }) => {
      const { from, to } = currentEditor.state.selection
      savedSelectionRef.current = { from, to }
      setEditorSnapshot(readEditorSnapshot(currentEditor))
    },
  })

  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor.isActive('bold'),
      italic: currentEditor.isActive('italic'),
      underline: currentEditor.isActive('underline'),
      heading2: currentEditor.isActive('heading', { level: 2 }),
      heading3: currentEditor.isActive('heading', { level: 3 }),
      bulletList: currentEditor.isActive('bulletList'),
      orderedList: currentEditor.isActive('orderedList'),
      blockquote: currentEditor.isActive('blockquote'),
      link: currentEditor.isActive('link'),
      alignLeft: currentEditor.isActive({ textAlign: 'left' }),
      alignCenter: currentEditor.isActive({ textAlign: 'center' }),
      alignRight: currentEditor.isActive({ textAlign: 'right' }),
      characters: currentEditor.storage.characterCount.characters(),
    }),
  }) ?? defaultToolbarState

  const publishDisabled = loadingHome || loadingArticle || uploading || submitting || !resolvedGroupId || !canPublish || !editor

  function syncSnapshot() {
    if (!editor) return
    setEditorSnapshot(readEditorSnapshot(editor))
  }

  function rememberSelection() {
    if (!editor) return
    const { from, to } = editor.state.selection
    savedSelectionRef.current = { from, to }
  }

  function insertImageAtSelection(url: string, selection: { from: number; to: number } | null) {
    if (!editor) return

    const savedSelection = clampSelection(editor, selection)
    const chain = editor.chain().focus()
    if (savedSelection) {
      chain.setTextSelection(savedSelection)
    }

    chain
      .setImage({
        src: url,
        alt: '文章配图',
      })
      .createParagraphNear()
      .run()

    syncSnapshot()
  }

  function insertVideoAtSelection(video: PlanetVideoUploadResult, selection: { from: number; to: number } | null) {
    if (!editor) return

    const savedSelection = clampSelection(editor, selection)
    const chain = editor.chain().focus()
    if (savedSelection) {
      chain.setTextSelection(savedSelection)
    }

    chain
      .setVideoBlock({
        src: video.url,
        title: video.filename || '文章视频',
        name: video.filename || '文章视频',
        mimeType: video.mimeType || '',
      })
      .createParagraphNear()
      .run()

    syncSnapshot()
  }

  async function uploadAndInsertMedia(files: File[], selection: { from: number; to: number } | null) {
    if (!editor) {
      setError('编辑器还没有准备好')
      return false
    }

    const supportedFiles = files.filter(isSupportedEditorUploadFile)
    if (!supportedFiles.length) {
      return false
    }

    const currentHtml = editor.getHTML() || editorSnapshot.html
    const currentImages = extractImageUrls(currentHtml)
    const currentVideos = extractVideoAttachments(currentHtml)
    let remainingImageSlots = Math.max(0, MAX_IMAGE_COUNT - currentImages.length)
    let remainingVideoSlots = Math.max(0, MAX_VIDEO_COUNT - currentVideos.length)
    const nextFiles: File[] = []
    let skippedImageCount = 0
    let skippedVideoCount = 0

    for (const file of supportedFiles) {
      if (isImageFile(file)) {
        if (remainingImageSlots > 0) {
          nextFiles.push(file)
          remainingImageSlots -= 1
        } else {
          skippedImageCount += 1
        }
        continue
      }

      if (isVideoFile(file)) {
        if (remainingVideoSlots > 0) {
          nextFiles.push(file)
          remainingVideoSlots -= 1
        } else {
          skippedVideoCount += 1
        }
      }
    }

    if (!nextFiles.length) {
      if (skippedImageCount && skippedVideoCount) {
        setNotice(`图片最多 ${MAX_IMAGE_COUNT} 张，视频最多 ${MAX_VIDEO_COUNT} 个`)
        return true
      }

      if (skippedImageCount) {
        setNotice(`最多插入 ${MAX_IMAGE_COUNT} 张图片`)
        return true
      }

      if (skippedVideoCount) {
        setNotice(`最多插入 ${MAX_VIDEO_COUNT} 个视频`)
        return true
      }

      return false
    }

    setUploading(true)
    setError('')
    setNotice('')

    let nextSelection = selection
    let insertedImageCount = 0
    let insertedVideoCount = 0

    try {
      for (const file of nextFiles) {
        if (isImageFile(file)) {
          const url = await uploadPlanetImage(file)
          insertImageAtSelection(url, nextSelection)
          insertedImageCount += 1
        } else {
          const video = await uploadPlanetVideo(file)
          insertVideoAtSelection(video, nextSelection)
          insertedVideoCount += 1
        }

        nextSelection = null
      }

      const summaryParts = [
        insertedImageCount ? `${insertedImageCount} 张图片` : '',
        insertedVideoCount ? `${insertedVideoCount} 个视频` : '',
      ].filter(Boolean)
      const suffixParts = [
        skippedImageCount ? `图片已达 ${MAX_IMAGE_COUNT} 张上限` : '',
        skippedVideoCount ? `视频已达 ${MAX_VIDEO_COUNT} 个上限` : '',
      ].filter(Boolean)

      setNotice(`已插入${summaryParts.join('、')}${suffixParts.length ? `，${suffixParts.join('，')}` : ''}`)
      return true
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '媒体上传失败')
      return true
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    if (!notice) return undefined

    const timer = window.setTimeout(() => {
      setNotice('')
    }, 2400)

    return () => {
      window.clearTimeout(timer)
    }
  }, [notice])

  useEffect(() => {
    if (!articleId) {
      hydratedArticleIdRef.current = ''
      setEditingArticle(null)
      setLoadingArticle(false)
      return undefined
    }

    let cancelled = false
    setLoadingArticle(true)
    setError('')

    getArticleDetail(articleId, false)
      .then((payload) => {
        if (cancelled) return
        setEditingArticle(payload)
      })
      .catch((loadError: Error) => {
        if (cancelled) return
        setEditingArticle(null)
        setError(loadError.message || '加载文章详情失败')
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingArticle(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [articleId])

  useEffect(() => {
    if (!resolvedGroupId) {
      navigate('/group_data', { replace: true })
      return undefined
    }

    let cancelled = false

    async function loadHome() {
      setLoadingHome(true)
      setError('')

      try {
        const payload = await getPlanetHome(resolvedGroupId)
        if (cancelled) return
        setHome(payload)
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : '加载星球信息失败')
      } finally {
        if (!cancelled) {
          setLoadingHome(false)
        }
      }
    }

    void loadHome()

    return () => {
      cancelled = true
    }
  }, [navigate, resolvedGroupId])

  useEffect(() => {
    if (!editor || !editingArticle || hydratedArticleIdRef.current === editingArticle.id) {
      return
    }

    hydratedArticleIdRef.current = editingArticle.id

    setTitle(editingArticle.title || '')
    setSummary(editingArticle.summary || '')
    setTagInput(Array.isArray(editingArticle.tags) ? editingArticle.tags.join(' ') : '')
    setContentSource(editingArticle.contentSource === 'wechat' ? 'wechat' : 'planet')

    const nextAccessType: ArticleAccessType = editingArticle.access?.accessType === 'paid' ? 'paid' : 'free'
    const nextPreviewMode: ArticlePreviewMode = editingArticle.access?.previewMode === 'ratio' ? 'ratio' : 'paragraph'
    const nextPreviewValue = editingArticle.access?.previewValue || editingArticle.preview?.previewValue || 0

    setAccessType(nextAccessType)
    setPriceInput(nextAccessType === 'paid' && editingArticle.access?.priceAmount ? String(editingArticle.access.priceAmount) : '')
    setPreviewMode(nextPreviewMode)
    setPreviewValueInput(nextAccessType === 'paid' && nextPreviewValue ? String(nextPreviewValue) : '')

    editor.commands.setContent(
      normalizeEditorHtml(editingArticle.richContent || '') ||
        (editingArticle.contentText
          ? `<p>${escapeHtmlText(editingArticle.contentText).replace(/\n/g, '</p><p>')}</p>`
          : '<p></p>'),
      { emitUpdate: false },
    )
    setEditorSnapshot(readEditorSnapshot(editor))
  }, [editingArticle, editor])

  function handleImageButtonMouseDown(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    if (!editor || uploading || inlineImageUrls.length >= MAX_IMAGE_COUNT) return
    rememberSelection()
    imageInputRef.current?.click()
  }

  function handleVideoButtonMouseDown(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    if (!editor || uploading || inlineVideoAttachments.length >= MAX_VIDEO_COUNT) return
    rememberSelection()
    videoInputRef.current?.click()
  }

  async function handleImagePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.currentTarget.value = ''

    if (!file) return
    await uploadAndInsertMedia([file], savedSelectionRef.current)
  }

  async function handleVideoPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.currentTarget.value = ''

    if (!file) return
    await uploadAndInsertMedia([file], savedSelectionRef.current)
  }

  function handleSetLink() {
    if (!editor) return

    const previousUrl = String(editor.getAttributes('link').href || '')
    const nextUrl = window.prompt('输入链接地址；留空则取消链接', previousUrl)
    if (nextUrl === null) return

    const normalizedUrl = nextUrl.trim()
    if (!normalizedUrl) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      syncSnapshot()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: normalizedUrl }).run()
    syncSnapshot()
  }

  function handleClearFormat() {
    if (!editor) return
    editor.chain().focus().unsetAllMarks().clearNodes().run()
    syncSnapshot()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!resolvedGroupId) {
      setError('缺少星球信息')
      return
    }

    if (!editor) {
      setError('编辑器还没有准备好')
      return
    }

    const latestSnapshot = readEditorSnapshot(editor)
    const latestImages = extractImageUrls(latestSnapshot.html)
    const latestVideos = extractVideoAttachments(latestSnapshot.html)
    const latestVideoUrls = latestVideos.map((item) => item.url)
    const latestSummary = buildSummary(normalizedTitle, summary, latestSnapshot.text)

    setEditorSnapshot(latestSnapshot)

    if (!normalizedTitle) {
      setError('请输入文章标题')
      return
    }

    if (!latestSnapshot.text && !latestImages.length && !latestVideos.length) {
      setError('请先填写正文、插入图片，或插入视频')
      return
    }

    if (toolbarState.characters > MAX_CONTENT_LENGTH) {
      setError(`正文最多 ${MAX_CONTENT_LENGTH} 字`)
      return
    }

    if (!canPublish) {
      setError('当前账号没有发帖权限')
      return
    }

    if (accessValidation.errorMessage) {
      setError(accessValidation.errorMessage)
      return
    }

    const articleAccessMetadata = buildArticlePublishAccessMetadata(
      accessType,
      previewMode,
      latestSnapshot,
      accessValidation.priceAmount ?? 0,
      accessValidation.previewValue ?? 0,
    )

    setSubmitting(true)
    setError('')
    setNotice('')

    try {
      await saveArticle({
        articleId: articleId || undefined,
        groupId: resolvedGroupId,
        title: normalizedTitle,
        summary: latestSummary,
        contentText: latestSnapshot.text,
        attachments: latestImages,
        contentSource: contentSource === 'wechat' ? 'wechat' : 'planet',
        coverUrl: latestImages[0] || latestVideos[0]?.poster || '',
        richContent: latestSnapshot.html,
        tags,
        access: articleAccessMetadata,
        preview: {
          previewText: articleAccessMetadata.previewText,
          previewRichContent: articleAccessMetadata.previewRichContent,
          previewMode: articleAccessMetadata.previewMode,
          previewValue: articleAccessMetadata.previewValue,
          contentParagraphCount: articleAccessMetadata.contentParagraphCount,
          previewParagraphCount: articleAccessMetadata.previewParagraphCount,
        },
        metadata: {
          images: latestImages,
          videos: latestVideoUrls,
          videoAttachments: latestVideos,
        },
      })
      navigate(backTarget, { replace: true })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : articleId ? '保存文章失败' : '发布文章失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="zsxq-page-shell article-editor-shell">
      {notice ? <div className="group-top-toast">{notice}</div> : null}

      <main className="article-editor-page">
        <form className="article-editor-layout" id="article-editor-form" onSubmit={handleSubmit}>
          <header className="article-editor-header">
            <div className="article-editor-header-left">
              <div className="article-editor-brand">饮视星球</div>
              <div className="article-editor-header-trail">
                <span>{pageTitle}</span>
                <span className="article-editor-header-separator">|</span>
                <button
                  className="article-editor-back"
                  onClick={() => navigate(backTarget)}
                  type="button"
                >
                  {backLabel}
                </button>
                <span className="article-editor-header-separator">/</span>
                <span>{currentGroupLabel}</span>
              </div>
            </div>

            <div className="article-editor-header-right">
              <span className="article-editor-status">{headerStatusText}</span>
              <button className="article-editor-header-publish" disabled={publishDisabled} type="submit">
                {submitButtonLabel}
              </button>
            </div>
          </header>

          <div className="article-editor-workspace">
            <section className="article-editor-document">
              <div className="article-editor-topline">
                <input
                  className="article-editor-title-input"
                  maxLength={80}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="请在这里输入标题"
                  value={title}
                />

                <div className="article-editor-top-stats">
                  <span>正文内容</span>
                  <strong>{toolbarState.characters}/{MAX_CONTENT_LENGTH}</strong>
                </div>
              </div>

              <div className="article-editor-toolbar-meta">
                <span className="article-editor-toolbar-caption">正文工具</span>
                <div className="article-editor-toolbar-stats">
                  <span>图片 {inlineImageUrls.length}/{MAX_IMAGE_COUNT}</span>
                  <span>视频 {inlineVideoAttachments.length}/{MAX_VIDEO_COUNT}</span>
                </div>
              </div>

              <div className="article-editor-toolbar" aria-label="文章编辑工具栏">
                <ToolbarButton active={toolbarState.heading2} disabled={!editor} label="H2" onAction={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} title="二级标题" />
                <ToolbarButton active={toolbarState.heading3} disabled={!editor} label="H3" onAction={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} title="三级标题" />
                <ToolbarButton active={toolbarState.bold} disabled={!editor} label="B" onAction={() => editor?.chain().focus().toggleBold().run()} title="加粗" />
                <ToolbarButton active={toolbarState.italic} disabled={!editor} label="I" onAction={() => editor?.chain().focus().toggleItalic().run()} title="斜体" />
                <ToolbarButton active={toolbarState.underline} disabled={!editor} label="U" onAction={() => editor?.chain().focus().toggleUnderline().run()} title="下划线" />
                <ToolbarButton active={toolbarState.link} disabled={!editor} label="链接" onAction={handleSetLink} title="插入链接" />
                <span className="article-editor-toolbar-divider" />
                <ToolbarButton active={toolbarState.bulletList} disabled={!editor} label="列表" onAction={() => editor?.chain().focus().toggleBulletList().run()} title="无序列表" />
                <ToolbarButton active={toolbarState.orderedList} disabled={!editor} label="1." onAction={() => editor?.chain().focus().toggleOrderedList().run()} title="有序列表" />
                <ToolbarButton active={toolbarState.blockquote} disabled={!editor} label="引用" onAction={() => editor?.chain().focus().toggleBlockquote().run()} title="引用" />
                <ToolbarButton disabled={!editor} label="线" onAction={() => editor?.chain().focus().setHorizontalRule().run()} title="插入分割线" />
                <span className="article-editor-toolbar-divider" />
                <ToolbarButton active={toolbarState.alignLeft} disabled={!editor} label="左" onAction={() => editor?.chain().focus().setTextAlign('left').run()} title="左对齐" />
                <ToolbarButton active={toolbarState.alignCenter} disabled={!editor} label="中" onAction={() => editor?.chain().focus().setTextAlign('center').run()} title="居中" />
                <ToolbarButton active={toolbarState.alignRight} disabled={!editor} label="右" onAction={() => editor?.chain().focus().setTextAlign('right').run()} title="右对齐" />
                <span className="article-editor-toolbar-divider" />
                <button
                  className="article-editor-tool"
                  disabled={!editor || uploading || inlineImageUrls.length >= MAX_IMAGE_COUNT}
                  onMouseDown={handleImageButtonMouseDown}
                  title="上传图片并插入到当前位置"
                  type="button"
                >
                  {uploading ? '上传中' : '图片'}
                </button>
                <button
                  className="article-editor-tool"
                  disabled={!editor || uploading || inlineVideoAttachments.length >= MAX_VIDEO_COUNT}
                  onMouseDown={handleVideoButtonMouseDown}
                  title="上传视频并插入到当前位置"
                  type="button"
                >
                  {uploading ? '上传中' : '视频'}
                </button>
                <ToolbarButton disabled={!editor} label="清样式" onAction={handleClearFormat} title="清除当前段落样式" />
                <ToolbarButton disabled={!editor} label="撤销" onAction={() => editor?.chain().focus().undo().run()} title="撤销" />
                <ToolbarButton disabled={!editor} label="重做" onAction={() => editor?.chain().focus().redo().run()} title="重做" />
              </div>

              <input accept="image/*" hidden onChange={handleImagePick} ref={imageInputRef} type="file" />
              <input
                accept="video/mp4,video/quicktime,video/webm,video/ogg,.mp4,.mov,.m4v,.webm,.ogv,.ogg"
                hidden
                onChange={handleVideoPick}
                ref={videoInputRef}
                type="file"
              />

              <div className="article-rich-editor">
                <BubbleMenu
                  editor={editor}
                  options={{
                    placement: 'top',
                  }}
                  shouldShow={({ editor: currentEditor, from, to }) =>
                    currentEditor.isEditable &&
                    from !== to &&
                    !currentEditor.isActive('image') &&
                    !currentEditor.isActive('videoBlock')
                  }
                >
                  <div className="article-editor-bubble-menu">
                    <ToolbarButton active={toolbarState.bold} label="B" onAction={() => editor?.chain().focus().toggleBold().run()} title="加粗" />
                    <ToolbarButton active={toolbarState.italic} label="I" onAction={() => editor?.chain().focus().toggleItalic().run()} title="斜体" />
                    <ToolbarButton active={toolbarState.underline} label="U" onAction={() => editor?.chain().focus().toggleUnderline().run()} title="下划线" />
                    <ToolbarButton active={toolbarState.link} label="链接" onAction={handleSetLink} title="插入链接" />
                    <ToolbarButton label="引用" onAction={() => editor?.chain().focus().toggleBlockquote().run()} title="引用" />
                  </div>
                </BubbleMenu>

                <FloatingMenu
                  editor={editor}
                  options={{
                    placement: 'left-start',
                  }}
                  shouldShow={({ editor: currentEditor, state }) => {
                    const { $from, empty } = state.selection
                    if (!currentEditor.isEditable || !empty) {
                      return false
                    }

                    return $from.parent.isTextblock && !$from.parent.textContent.trim()
                  }}
                >
                  <div className="article-editor-floating-menu">
                    <button className="article-editor-floating-action" onMouseDown={handleImageButtonMouseDown} type="button">
                      图片
                    </button>
                    <button className="article-editor-floating-action" onMouseDown={handleVideoButtonMouseDown} type="button">
                      视频
                    </button>
                    <button
                      className="article-editor-floating-action"
                      onMouseDown={(event) => {
                        event.preventDefault()
                        editor?.chain().focus().toggleHeading({ level: 2 }).run()
                      }}
                      type="button"
                    >
                      H2
                    </button>
                    <button
                      className="article-editor-floating-action"
                      onMouseDown={(event) => {
                        event.preventDefault()
                        editor?.chain().focus().toggleBulletList().run()
                      }}
                      type="button"
                    >
                      列表
                    </button>
                    <button
                      className="article-editor-floating-action"
                      onMouseDown={(event) => {
                        event.preventDefault()
                        editor?.chain().focus().toggleBlockquote().run()
                      }}
                      type="button"
                    >
                      引用
                    </button>
                  </div>
                </FloatingMenu>

                <EditorContent editor={editor} />
              </div>

              {error ? <div className="article-editor-error">{error}</div> : null}

              <div className="article-editor-footer">
                <div className="article-editor-footer-tools">
                  <button
                    className="article-editor-inline-action"
                    disabled={!editor || uploading || inlineImageUrls.length >= MAX_IMAGE_COUNT}
                    onMouseDown={handleImageButtonMouseDown}
                    type="button"
                  >
                    添加图片
                  </button>
                  <button
                    className="article-editor-inline-action"
                    disabled={!editor || uploading || inlineVideoAttachments.length >= MAX_VIDEO_COUNT}
                    onMouseDown={handleVideoButtonMouseDown}
                    type="button"
                  >
                    添加视频
                  </button>
                  <span className="article-editor-footer-tip">{notice || '支持粘贴、拖拽上传图片和视频'}</span>
                </div>

                <div className="article-editor-footer-actions">
                  <button
                    className="article-editor-secondary"
                    onClick={() => navigate(backTarget)}
                    type="button"
                  >
                    取消
                  </button>
                  <button className="article-editor-primary" disabled={publishDisabled} type="submit">
                    {submitButtonLabel}
                  </button>
                </div>
              </div>
            </section>

            <aside className="article-editor-aside">
              <button className="article-editor-markdown-switch" disabled type="button">
                切换到 Markdown 模式（内测）
              </button>

              <div className="article-editor-meta-card">
                <div className="article-editor-side-label">文章信息</div>

                <label className="article-editor-side-field">
                  <span>内容来源</span>
                  <select
                    className="article-editor-side-select"
                    onChange={(event) => setContentSource(event.target.value as ArticleContentSource)}
                    value={contentSource}
                  >
                    <option value="wechat">微信文章</option>
                    <option value="planet">知识星球</option>
                  </select>
                </label>

                <label className="article-editor-side-field">
                  <span>摘要</span>
                  <input
                    maxLength={120}
                    onChange={(event) => setSummary(event.target.value)}
                    placeholder="可选，不填会从正文自动提取"
                    value={summary}
                  />
                </label>

                <label className="article-editor-side-field">
                  <span>标签</span>
                  <input
                    onChange={(event) => setTagInput(event.target.value)}
                    placeholder="多个标签用空格或逗号分隔"
                    value={tagInput}
                  />
                </label>

                <p className="article-editor-side-summary">
                  {resolvedSummary || '从这里开始输入正文，系统会自动生成摘要。'}
                </p>
              </div>

              <div className="article-editor-meta-card">
                <div className="article-editor-side-label">访问控制</div>

                <div className="article-editor-access-toggle" role="radiogroup" aria-label="文章访问方式">
                  <button
                    aria-pressed={accessType === 'free'}
                    className={accessType === 'free' ? 'article-editor-access-toggle-button is-active' : 'article-editor-access-toggle-button'}
                    onClick={() => setAccessType('free')}
                    type="button"
                  >
                    免费全文
                  </button>
                  <button
                    aria-pressed={accessType === 'paid'}
                    className={accessType === 'paid' ? 'article-editor-access-toggle-button is-active' : 'article-editor-access-toggle-button'}
                    onClick={() => setAccessType('paid')}
                    type="button"
                  >
                    付费试看
                  </button>
                </div>

                <p className="article-editor-access-summary">{accessSummaryText}</p>

                <label className="article-editor-side-field">
                  <span>售价</span>
                  <div
                    className={
                      accessType === 'free'
                        ? 'article-editor-side-input-with-unit is-disabled'
                        : 'article-editor-side-input-with-unit'
                    }
                  >
                    <input
                      disabled={accessType === 'free'}
                      inputMode="numeric"
                      min="1"
                      onChange={(event) => setPriceInput(event.target.value)}
                      placeholder="输入整数金额"
                      step="1"
                      type="number"
                      value={priceInput}
                    />
                    <em>元</em>
                  </div>
                </label>

                <label className="article-editor-side-field">
                  <span>试看方式</span>
                  <select
                    className="article-editor-side-select"
                    disabled={accessType === 'free'}
                  onChange={(event) => setPreviewMode(event.target.value as ArticlePreviewMode)}
                  value={previewMode}
                >
                  <option value="paragraph">前 N 段可见</option>
                  <option value="ratio">按内容比例试看</option>
                </select>
              </label>

                <label className="article-editor-side-field">
                  <span>试看值</span>
                  <div
                    className={
                      accessType === 'free'
                        ? 'article-editor-side-input-with-unit is-disabled'
                        : 'article-editor-side-input-with-unit'
                    }
                  >
                    <input
                      disabled={accessType === 'free'}
                      inputMode={previewValueFieldConfig.inputMode}
                      min={previewValueFieldConfig.min}
                      onChange={(event) => setPreviewValueInput(event.target.value)}
                      placeholder={previewValueFieldConfig.placeholder}
                      step={previewValueFieldConfig.step}
                      type="number"
                      value={previewValueInput}
                    />
                    <em>{previewValueFieldConfig.unit}</em>
                  </div>
                </label>

                {accessValidation.errorMessage ? (
                  <div className="article-editor-access-error">{accessValidation.errorMessage}</div>
                ) : (
                  <div className="article-editor-access-note">{accessNoteText}</div>
                )}
              </div>

              <div className="article-editor-meta-card">
                <div className="article-editor-side-label">文章概览</div>
                <div className="article-editor-publish-meta">
                  <span>标题 {normalizedTitle ? `${normalizedTitle.length}/80` : '未填写'}</span>
                  <span>正文 {toolbarState.characters}/{MAX_CONTENT_LENGTH}</span>
                  <span>图片 {inlineImageUrls.length}/{MAX_IMAGE_COUNT}</span>
                  <span>视频 {inlineVideoAttachments.length}/{MAX_VIDEO_COUNT}</span>
                  <span>来源 {contentSource === 'wechat' ? '微信文章' : '知识星球'}</span>
                  <span>访问 {accessOverview}</span>
                </div>

                {tags.length ? (
                  <div className="article-editor-tag-list">
                    {tags.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                ) : (
                  <div className="article-editor-preview-empty">尚未添加标签</div>
                )}
              </div>
            </aside>
          </div>
        </form>
      </main>
    </div>
  )
}
