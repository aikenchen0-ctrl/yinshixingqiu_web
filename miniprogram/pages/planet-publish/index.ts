import {
  addPost as addLocalPost,
  getPlanetById,
  getPostById,
  PlanetFileAttachment,
  PlanetPost,
  updatePost as updateLocalPost,
  upsertRemotePlanets,
} from '../../utils/planet'
import { getStoredSession } from '../../utils/auth'
import { listLocalPlanetColumns } from '../../utils/column'
import {
  createPlanetPost,
  fetchPlanetHome,
  fetchPlanetMembers,
  fetchPlanetPostDetail,
  updatePlanetPost,
  uploadPlanetFile,
  uploadPlanetImage,
  fetchPlanetColumns,
} from '../../utils/planet-api'
import {
  navigateToPlanetIndex,
  normalizePlanetId,
  rememberActivePlanetId,
  resolvePlanetIdFromOptions,
} from '../../utils/planet-route'
import {
  createEmptyModerationNotice,
  type ModerationNoticeView,
  mapViewerModerationNotice,
} from '../../utils/post-moderation'
import { normalizeAssetUrl, normalizeRichTextAssetUrls } from '../../utils/request'

const PLANET_PUBLISH_REFRESH_KEY = 'planet_publish_refresh_v1'

interface EditorStatusPayload {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  header?: string
  list?: string
}

type PublishType = 'normal' | 'question' | 'checkin' | 'homework'

interface QuestionTargetMember {
  id: string
  name: string
  roleLabel: string
  avatarUrl: string
  description: string
  isOwner?: boolean
}

interface FileAttachmentItem {
  name: string
  url: string
  sizeText: string
  mimeType: string
}

interface ColumnOption {
  id: string
  title: string
}

type EditorContext = WechatMiniprogram.EditorContext

const MAX_TITLE_LENGTH = 40
const MAX_TEXT_LENGTH = 5000

let editorCtx: EditorContext | null = null
let pendingEditorHtml = ''

const publishTypeConfigMap: Record<
  PublishType,
  {
    pageTitle: string
    submitButtonText: string
    titlePlaceholder: string
    editorPlaceholder: string
    sectionHelperText: string
  }
> = {
  normal: {
    pageTitle: '发表帖子',
    submitButtonText: '发布帖子',
    titlePlaceholder: '写个标题，让大家一眼知道你想分享什么',
    editorPlaceholder: '写下你的想法、经验、结论或近况，支持图文和文件一起发',
    sectionHelperText: '普通帖子适合配截图、案例图、文档或资料包，方便大家快速理解内容。',
  },
  question: {
    pageTitle: '发表提问',
    submitButtonText: '发布提问',
    titlePlaceholder: '把问题标题写清楚，更容易获得回答',
    editorPlaceholder: '把背景、卡点和你试过的方法说清楚，方便大家更快回答',
    sectionHelperText: '提问场景建议补充截图或案例图，方便成员快速理解问题。',
  },
  checkin: {
    pageTitle: '发表打卡',
    submitButtonText: '发布打卡',
    titlePlaceholder: '给这次打卡起个标题，例如 第3天复盘 / 今天完成了什么',
    editorPlaceholder: '记录今天完成了什么、推进到了哪一步、遇到了什么问题，以及下一步准备怎么做',
    sectionHelperText: '打卡更适合配进度截图、结果图或关键笔记，方便后续复盘。',
  },
  homework: {
    pageTitle: '提交作业',
    submitButtonText: '发布作业',
    titlePlaceholder: '写上这份作业的主题或章节名',
    editorPlaceholder: '补充作业背景、你的思路、关键步骤和最后产出，方便老师与同学查看',
    sectionHelperText: '作业通常需要展示过程和成果，可以上传截图、海报或作品图。',
  },
}

const isPublishType = (value: string): value is PublishType =>
  value === 'normal' || value === 'question' || value === 'checkin' || value === 'homework'

const resolvePublishType = (value?: string): PublishType => {
  if (value && isPublishType(value)) {
    return value
  }
  return 'normal'
}

const buildQuestionTargetMembers = (planetId: string, ownerName: string, ownerAvatarUrl: string): QuestionTargetMember[] => {
  const normalizedOwnerName = (ownerName || '星主').replace(/老师$/, '').trim() || '星主'
  const safeOwnerAvatarUrl =
    ownerAvatarUrl ||
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80'

  const defaultMembers: QuestionTargetMember[] = [
    {
      id: `${planetId}_owner`,
      name: normalizedOwnerName,
      roleLabel: '星主',
      avatarUrl: safeOwnerAvatarUrl,
      description: '优先向星主提问，适合方向判断、关键卡点和策略问题。',
      isOwner: true,
    },
  ]

  return defaultMembers
}

const buildQuestionTargetDescription = (roleLabel: string, fallbackDescription: string) => {
  const normalizedRoleLabel = (roleLabel || '').trim()
  if (fallbackDescription) {
    return fallbackDescription
  }
  if (normalizedRoleLabel === '星主') {
    return '优先向星主提问，适合方向判断、关键卡点和策略问题。'
  }
  if (normalizedRoleLabel === '合伙人') {
    return '适合流程、活动规则和执行细节类问题。'
  }
  if (normalizedRoleLabel === '管理员' || normalizedRoleLabel === '运营') {
    return '适合群内安排、资料路径和执行跟进类问题。'
  }
  return '适合交流经验、补充思路或请教具体问题。'
}

const mapRemoteQuestionTargetMembers = (items: Array<Record<string, any>>) => {
  const normalizedItems = Array.isArray(items) ? items : []
  return normalizedItems
    .map((item) => {
      const id = typeof item.id === 'string' ? item.id : ''
      const name = typeof item.nickname === 'string' ? item.nickname.trim() : ''
      if (!id || !name) {
        return null
      }

      const roleLabel = typeof item.roleLabel === 'string' && item.roleLabel.trim() ? item.roleLabel.trim() : '成员'
      return {
        id,
        name,
        roleLabel,
        avatarUrl: typeof item.avatarUrl === 'string' ? item.avatarUrl : '',
        description: buildQuestionTargetDescription(
          roleLabel,
          typeof item.description === 'string' ? item.description.trim() : ''
        ),
        isOwner: item.isOwner === true,
      } as QuestionTargetMember
    })
    .filter((item): item is QuestionTargetMember => !!item)
}

const filterQuestionTargetMembers = (members: QuestionTargetMember[], keyword: string) => {
  const normalizedKeyword = keyword.trim().toLowerCase()
  if (!normalizedKeyword) {
    return members
  }

  const ownerMembers = members.filter((item) => item.isOwner)
  const otherMembers = members.filter((item) => !item.isOwner)

  const matcher = (item: QuestionTargetMember) =>
    item.name.toLowerCase().indexOf(normalizedKeyword) >= 0 ||
    item.roleLabel.toLowerCase().indexOf(normalizedKeyword) >= 0 ||
    item.description.toLowerCase().indexOf(normalizedKeyword) >= 0

  return ownerMembers.filter(matcher).concat(otherMembers.filter(matcher))
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const stripHtml = (html: string) =>
  html
    .replace(/<img[^>]*>/gi, ' [图片] ')
    .replace(/<\/(p|div|li|h1|h2|h3|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

const extractImageUrls = (html: string) => {
  const matched = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) || []
  const urls = matched
    .map((item) => {
      const srcMatch = item.match(/src=["']([^"']+)["']/i)
      return normalizeAssetUrl(srcMatch ? srcMatch[1] : '')
    })
    .filter((item) => /^https?:\/\//.test(item))

  return Array.from(new Set(urls)).slice(0, 9)
}

const buildSummary = (title: string, text: string) => {
  const normalizedText = text.replace(/\s+/g, ' ').trim()
  if (title && normalizedText) {
    return `${title} ${normalizedText}`.slice(0, 120)
  }
  return (title || normalizedText).slice(0, 120)
}

const toEditorHtml = (value: string) => {
  const content = String(value || '').trim()
  if (!content) {
    return ''
  }

  if (/<[a-z][\s\S]*>/i.test(content)) {
    return content
  }

  return content
    .split(/\n+/)
    .map((item) => `<p>${escapeHtml(item)}</p>`)
    .join('')
}

const stripLeadingTitleFromHtml = (html: string, title: string) => {
  const normalizedTitle = title.trim()
  if (!normalizedTitle || !html) {
    return html
  }

  const headingPattern = new RegExp(
    `^\\s*<(h1|h2|h3|p|div)[^>]*>\\s*${escapeRegExp(escapeHtml(normalizedTitle))}\\s*<\\/\\1>\\s*`,
    'i'
  )
  return html.replace(headingPattern, '').trim()
}

const stripImageTags = (html: string) => html.replace(/<img[^>]*>/gi, '').trim()
const isPersistedAttachmentUrl = (value: string) => /^https?:\/\//.test(value) || /^\//.test(value)
const formatFileSize = (size: number) => {
  if (!Number.isFinite(size) || size <= 0) {
    return '未知大小'
  }
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)}MB`
  }
  if (size >= 1024) {
    return `${Math.max(1, Math.round(size / 1024))}KB`
  }
  return `${Math.round(size)}B`
}

const extractImageUrlsFromPost = (post: Record<string, any>, richContent: string) => {
  const attachmentImages = Array.isArray(post.attachments)
    ? post.attachments
        .filter((item: unknown) => typeof item === 'string')
        .map((item: unknown) => normalizeAssetUrl(String(item)))
        .filter((item) => /^https?:\/\//.test(item))
    : []
  const richImages = extractImageUrls(richContent)
  return Array.from(new Set(attachmentImages.concat(richImages))).slice(0, 9)
}

const resolvePostCoverImageUrl = (post: Record<string, any>, metadata: Record<string, any>) =>
  normalizeAssetUrl(
    String(
      post.coverUrl ||
        (typeof metadata.coverUrl === 'string' ? metadata.coverUrl : '') ||
        (typeof metadata.coverImageUrl === 'string' ? metadata.coverImageUrl : '') ||
        ''
    )
  )

const parseRemotePostDraft = (post: Record<string, any>) => {
  const metadata = post.metadata && typeof post.metadata === 'object' ? post.metadata : {}
  const title = typeof post.title === 'string' ? post.title : ''
  const richContent = normalizeRichTextAssetUrls(typeof metadata.richContent === 'string' ? metadata.richContent : '')
  const cleanedHtml = stripImageTags(stripLeadingTitleFromHtml(richContent || toEditorHtml(String(post.contentText || '')), title))

  return {
    title: title.slice(0, MAX_TITLE_LENGTH),
    editorHtml: cleanedHtml,
    coverImageUrl: resolvePostCoverImageUrl(post, metadata),
    tags: Array.isArray(metadata.tags) ? metadata.tags.filter((item: unknown) => typeof item === 'string') : [],
    images: extractImageUrlsFromPost(post, richContent),
    fileAttachments: Array.isArray(metadata.fileAttachments)
      ? metadata.fileAttachments
          .map((item: unknown) => {
            if (!item || typeof item !== 'object') {
              return null
            }

            const fileItem = item as Record<string, unknown>
            const url = typeof fileItem.url === 'string' ? fileItem.url : ''
            if (!url) {
              return null
            }

            return {
              name: typeof fileItem.name === 'string' && fileItem.name.trim() ? fileItem.name.trim() : '未命名文件',
              url,
              sizeText:
                typeof fileItem.sizeText === 'string' && fileItem.sizeText.trim()
                  ? fileItem.sizeText.trim()
                  : formatFileSize(Number(fileItem.size || 0)),
              mimeType: typeof fileItem.mimeType === 'string' ? fileItem.mimeType : '',
            } as FileAttachmentItem
          })
          .filter((item: unknown): item is FileAttachmentItem => !!item)
          .slice(0, 5)
      : [],
    publishType: resolvePublishType(typeof metadata.publishType === 'string' ? metadata.publishType : ''),
    checkinStatus: typeof metadata.checkinStatus === 'string' ? metadata.checkinStatus : '',
    checkinProgress: typeof metadata.checkinProgress === 'string' ? metadata.checkinProgress : '',
    homeworkDeliverable: typeof metadata.homeworkDeliverable === 'string' ? metadata.homeworkDeliverable : '',
    homeworkDeadline: typeof metadata.homeworkDeadline === 'string' ? metadata.homeworkDeadline : '',
    questionTargetId: typeof metadata.questionTargetId === 'string' ? metadata.questionTargetId : '',
    questionTargetName: typeof metadata.questionTargetName === 'string' ? metadata.questionTargetName : '',
  }
}

const mapLocalFileAttachments = (items?: PlanetFileAttachment[]) =>
  Array.isArray(items)
    ? items
        .map((item) => ({
          name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : '未命名文件',
          url: typeof item.url === 'string' ? item.url : '',
          sizeText: typeof item.sizeText === 'string' ? item.sizeText : '',
          mimeType: typeof item.mimeType === 'string' ? item.mimeType : '',
        }))
        .filter((item) => item.url)
        .slice(0, 5)
    : []

const parseLocalPostDraft = (post: PlanetPost) => {
  const editorHtml =
    post.richContent && post.richContent.trim()
      ? normalizeRichTextAssetUrls(post.richContent.trim())
      : toEditorHtml(String(post.content || ''))

  return {
    title: String(post.title || '').slice(0, MAX_TITLE_LENGTH),
    editorHtml,
    coverImageUrl: normalizeAssetUrl(typeof post.coverImageUrl === 'string' ? post.coverImageUrl : ''),
    tags: Array.isArray(post.tags) ? post.tags.filter((item) => typeof item === 'string') : [],
    images: Array.isArray(post.images) ? post.images.filter(Boolean).slice(0, 9) : [],
    fileAttachments: mapLocalFileAttachments(post.fileAttachments),
    publishType: resolvePublishType(typeof post.publishType === 'string' ? post.publishType : ''),
    checkinStatus: typeof post.checkinStatus === 'string' ? post.checkinStatus : '',
    checkinProgress: typeof post.checkinProgress === 'string' ? post.checkinProgress : '',
    homeworkDeliverable: typeof post.homeworkDeliverable === 'string' ? post.homeworkDeliverable : '',
    homeworkDeadline: typeof post.homeworkDeadline === 'string' ? post.homeworkDeadline : '',
    questionTargetId: typeof post.questionTargetId === 'string' ? post.questionTargetId : '',
    questionTargetName: typeof post.questionTargetName === 'string' ? post.questionTargetName : '',
    columnId: typeof post.columnId === 'string' ? post.columnId : '',
    columnTitle: typeof post.columnTitle === 'string' ? post.columnTitle : '',
  }
}

const applyEditorHtml = (page: any, html: string) => {
  pendingEditorHtml = html
  if (!editorCtx) {
    return
  }

  editorCtx.setContents({
    html,
    success: () => {
      void page.syncEditorContent()
    },
  })
}

Page({
  data: {
    planetId: '',
    planetName: '饮视星球',
    postId: '',
    isEditMode: false,
    publishType: 'normal' as PublishType,
    isQuestionMode: false,
    isCheckinMode: false,
    isHomeworkMode: false,
    pageTitle: publishTypeConfigMap.normal.pageTitle,
    submitButtonText: publishTypeConfigMap.normal.submitButtonText,
    titlePlaceholder: publishTypeConfigMap.normal.titlePlaceholder,
    editorPlaceholder: publishTypeConfigMap.normal.editorPlaceholder,
    sectionHelperText: publishTypeConfigMap.normal.sectionHelperText,
    title: '',
    tagInput: '',
    coverImageUrl: '',
    checkinStatus: '',
    checkinProgress: '',
    homeworkDeliverable: '',
    homeworkDeadline: '',
    selectedQuestionTargetId: '',
    selectedQuestionTargetName: '',
    questionTargetMembers: [] as QuestionTargetMember[],
    filteredQuestionTargetMembers: [] as QuestionTargetMember[],
    questionTargetSearchValue: '',
    questionTargetPopupVisible: false,
    imagePreviewList: [] as string[],
    fileAttachmentList: [] as FileAttachmentItem[],
    editorReady: false,
    editorHtml: '',
    editorText: '',
    moderationNotice: createEmptyModerationNotice() as ModerationNoticeView,
    toolbarStatus: {
      bold: false,
      italic: false,
      underline: false,
      heading: false,
      bulletList: false,
    },
    submitting: false,
    uploadingCover: false,
    uploadingImages: false,
    uploadingFiles: false,
    columnOptions: [] as ColumnOption[],
    selectedColumnId: '',
    columnPickerVisible: false,
    selectedColumnTitle: '',
    selectedColumnIndex: -1,
  },

  async onLoad(options: Record<string, string>) {
    editorCtx = null
    pendingEditorHtml = ''

    const postId = options.postId || ''
    const planetId = resolvePlanetIdFromOptions(options, ['planetId', 'id', 'groupId'], !postId)
    if (!planetId && !postId) {
      navigateToPlanetIndex('请先选择星球')
      return
    }

    const publishType = resolvePublishType(options.publishType)
    const currentPlanet = planetId ? getPlanetById(planetId) : null
    const planetName =
      options.planetName
        ? decodeURIComponent(options.planetName)
        : currentPlanet && currentPlanet.name
          ? currentPlanet.name
          : '饮视星球'
    const ownerName = currentPlanet && currentPlanet.ownerName ? currentPlanet.ownerName : options.ownerName || '星主'
    const ownerAvatarUrl = currentPlanet && currentPlanet.avatarImageUrl ? currentPlanet.avatarImageUrl : ''
    const questionTargetMembers = planetId ? buildQuestionTargetMembers(planetId, ownerName, ownerAvatarUrl) : []
    const defaultQuestionTarget = questionTargetMembers[0]
    const publishTypeConfig = publishTypeConfigMap[publishType]

    this.setData({
      planetId,
      planetName,
      postId,
      isEditMode: !!postId,
      publishType,
      isQuestionMode: publishType === 'question',
      isCheckinMode: publishType === 'checkin',
      isHomeworkMode: publishType === 'homework',
      pageTitle: publishTypeConfig.pageTitle,
      submitButtonText: publishTypeConfig.submitButtonText,
      titlePlaceholder: publishTypeConfig.titlePlaceholder,
      editorPlaceholder: publishTypeConfig.editorPlaceholder,
      sectionHelperText: publishTypeConfig.sectionHelperText,
      questionTargetMembers,
      filteredQuestionTargetMembers: questionTargetMembers,
      questionTargetSearchValue: '',
      questionTargetPopupVisible: false,
      selectedQuestionTargetId: defaultQuestionTarget ? defaultQuestionTarget.id : '',
      selectedQuestionTargetName: defaultQuestionTarget ? defaultQuestionTarget.name : '',
    })

    if (planetId) {
      void this.syncPlanetContext(planetId)
    }

    // 加载专栏选项
    if (planetId) {
      void this.loadColumnOptions()
    }

    if (!postId) {
      if (publishType === 'question') {
        void this.loadQuestionTargetMembers()
      }
      return
    }

    try {
      const session = getStoredSession()
      const response = await fetchPlanetPostDetail(postId, false, session && session.sessionToken ? session.sessionToken : '')
      if (!response.ok || !response.data) {
        throw new Error('原帖子不存在')
      }

      const resolvedPlanetId = normalizePlanetId(
        response.data && typeof response.data.groupId === 'string' ? response.data.groupId : planetId
      )
      const draft = parseRemotePostDraft(response.data)
      applyEditorHtml(this, draft.editorHtml)
      const nextPublishType = draft.publishType || publishType
      const nextPublishTypeConfig = publishTypeConfigMap[nextPublishType]
      const matchedQuestionTarget = questionTargetMembers.find((item) => item.id === draft.questionTargetId)
      const resolvedQuestionTarget = matchedQuestionTarget || defaultQuestionTarget

      this.setData({
        planetId: resolvedPlanetId,
        publishType: nextPublishType,
        isQuestionMode: nextPublishType === 'question',
        isCheckinMode: nextPublishType === 'checkin',
        isHomeworkMode: nextPublishType === 'homework',
        pageTitle: nextPublishTypeConfig.pageTitle,
        submitButtonText: nextPublishTypeConfig.submitButtonText,
        titlePlaceholder: nextPublishTypeConfig.titlePlaceholder,
        editorPlaceholder: nextPublishTypeConfig.editorPlaceholder,
        sectionHelperText: nextPublishTypeConfig.sectionHelperText,
        title: draft.title,
        tagInput: draft.tags.join(', '),
        checkinStatus: draft.checkinStatus,
        checkinProgress: draft.checkinProgress,
        homeworkDeliverable: draft.homeworkDeliverable,
        homeworkDeadline: draft.homeworkDeadline,
        filteredQuestionTargetMembers: questionTargetMembers,
        questionTargetSearchValue: '',
        questionTargetPopupVisible: false,
        selectedQuestionTargetId:
          nextPublishType === 'question' && resolvedQuestionTarget ? resolvedQuestionTarget.id : '',
        selectedQuestionTargetName:
          nextPublishType === 'question'
            ? draft.questionTargetName || (resolvedQuestionTarget ? resolvedQuestionTarget.name : '')
            : '',
        coverImageUrl: draft.coverImageUrl,
        imagePreviewList: draft.images,
        fileAttachmentList: draft.fileAttachments,
        editorHtml: draft.editorHtml,
        editorText: stripHtml(draft.editorHtml),
        moderationNotice: mapViewerModerationNotice(response.data),
        selectedColumnId: response.data.metadata && typeof response.data.metadata.columnId === 'string' ? response.data.metadata.columnId : '',
      })

      // 加载专栏选项后，会更新 selectedColumnTitle 和 selectedColumnIndex

      if (resolvedPlanetId !== planetId) {
        void this.syncPlanetContext(resolvedPlanetId, {
          id: draft.questionTargetId,
          name: draft.questionTargetName,
        })
        void this.loadColumnOptions()
      }

      if (nextPublishType === 'question') {
        void this.loadQuestionTargetMembers({
          id: draft.questionTargetId,
          name: draft.questionTargetName,
        })
      }
    } catch (error) {
      const localPost = getPostById(postId)
      if (localPost) {
        const resolvedPlanetId = normalizePlanetId(localPost.planetId || planetId)
        const localPlanet = resolvedPlanetId ? getPlanetById(resolvedPlanetId) : null
        const localOwnerName =
          localPlanet && localPlanet.ownerName ? localPlanet.ownerName : ownerName
        const localOwnerAvatarUrl =
          localPlanet && localPlanet.avatarImageUrl ? localPlanet.avatarImageUrl : ownerAvatarUrl
        const localQuestionTargetMembers = resolvedPlanetId
          ? buildQuestionTargetMembers(resolvedPlanetId, localOwnerName, localOwnerAvatarUrl)
          : questionTargetMembers
        const localDefaultQuestionTarget = localQuestionTargetMembers[0]
        const draft = parseLocalPostDraft(localPost)
        const nextPublishType = draft.publishType || publishType
        const nextPublishTypeConfig = publishTypeConfigMap[nextPublishType]
        const matchedQuestionTarget = localQuestionTargetMembers.find((item) => item.id === draft.questionTargetId)
        const resolvedQuestionTarget = matchedQuestionTarget || localDefaultQuestionTarget

        applyEditorHtml(this, draft.editorHtml)
        this.setData({
          planetId: resolvedPlanetId || planetId,
          planetName:
            localPlanet && localPlanet.name ? localPlanet.name : this.data.planetName,
          questionTargetMembers: localQuestionTargetMembers,
          publishType: nextPublishType,
          isQuestionMode: nextPublishType === 'question',
          isCheckinMode: nextPublishType === 'checkin',
          isHomeworkMode: nextPublishType === 'homework',
          pageTitle: nextPublishTypeConfig.pageTitle,
          submitButtonText: nextPublishTypeConfig.submitButtonText,
          titlePlaceholder: nextPublishTypeConfig.titlePlaceholder,
          editorPlaceholder: nextPublishTypeConfig.editorPlaceholder,
          sectionHelperText: nextPublishTypeConfig.sectionHelperText,
          title: draft.title,
          tagInput: draft.tags.join(', '),
          checkinStatus: draft.checkinStatus,
          checkinProgress: draft.checkinProgress,
          homeworkDeliverable: draft.homeworkDeliverable,
          homeworkDeadline: draft.homeworkDeadline,
          filteredQuestionTargetMembers: localQuestionTargetMembers,
          questionTargetSearchValue: '',
          questionTargetPopupVisible: false,
          selectedQuestionTargetId:
            nextPublishType === 'question' && resolvedQuestionTarget ? resolvedQuestionTarget.id : '',
          selectedQuestionTargetName:
            nextPublishType === 'question'
              ? draft.questionTargetName || (resolvedQuestionTarget ? resolvedQuestionTarget.name : '')
              : '',
          coverImageUrl: draft.coverImageUrl,
          imagePreviewList: draft.images,
          fileAttachmentList: draft.fileAttachments,
          editorHtml: draft.editorHtml,
          editorText: stripHtml(draft.editorHtml),
          moderationNotice: createEmptyModerationNotice(),
          selectedColumnId: draft.columnId,
          selectedColumnTitle: draft.columnTitle,
          selectedColumnIndex: -1,
        })

        if (resolvedPlanetId && resolvedPlanetId !== planetId) {
          void this.syncPlanetContext(resolvedPlanetId, {
            id: draft.questionTargetId,
            name: draft.questionTargetName,
          })
          void this.loadColumnOptions()
        }

        return
      }

      wx.showToast({
        title: error instanceof Error ? error.message : '读取帖子失败',
        icon: 'none',
      })
    }
  },

  onUnload() {
    editorCtx = null
  },

  async syncPlanetContext(planetId: string, preferredTarget?: { id?: string; name?: string }) {
    if (!planetId) {
      return
    }

    rememberActivePlanetId(planetId)

    const session = getStoredSession()
    const localPlanet = getPlanetById(planetId)

    try {
      const response = await fetchPlanetHome({
        groupId: planetId,
        sessionToken: session && session.sessionToken ? session.sessionToken : '',
        userId: session && session.id ? session.id : '',
      })

      if (!response.ok || !response.data || !response.data.group || !response.data.owner) {
        return
      }

      const group = response.data.group
      const owner = response.data.owner
      const ownerName = String(owner.nickname || (localPlanet && localPlanet.ownerName) || '星主')
      const ownerAvatarUrl = normalizeAssetUrl(
        String(group.avatarUrl || owner.avatarUrl || (localPlanet && localPlanet.avatarImageUrl) || '')
      )
      const questionTargetMembers = buildQuestionTargetMembers(planetId, ownerName, ownerAvatarUrl)
      const matchedQuestionTarget =
        questionTargetMembers.find((item) => item.id === (preferredTarget && preferredTarget.id ? preferredTarget.id : this.data.selectedQuestionTargetId)) ||
        questionTargetMembers.find((item) => item.name === (preferredTarget && preferredTarget.name ? preferredTarget.name : this.data.selectedQuestionTargetName)) ||
        questionTargetMembers[0]

      upsertRemotePlanets([
        {
          id: planetId,
          name: String(group.name || (localPlanet && localPlanet.name) || this.data.planetName || '饮视星球'),
          avatarImageUrl: ownerAvatarUrl,
          coverImageUrl: normalizeAssetUrl(
            String(group.coverUrl || group.avatarUrl || (localPlanet && localPlanet.coverImageUrl) || '')
          ),
          intro: String(group.intro || (localPlanet && localPlanet.intro) || ''),
          price: Number(group.priceAmount || (localPlanet && localPlanet.price) || 0),
          priceLabel:
            group.joinType === 'FREE'
              ? '免费加入'
              : `¥ ${Number(group.priceAmount || (localPlanet && localPlanet.price) || 0)}/年`,
          joinType: group.billingPeriod === 'YEAR' ? 'rolling' : 'calendar',
          isFree: group.joinType === 'FREE',
          requireInviteCode: group.joinType === 'INVITE_ONLY',
          ownerName,
          ownerTagline: String(owner.bio || (localPlanet && localPlanet.ownerTagline) || ''),
          category: (localPlanet && localPlanet.category) || '其他',
          memberCount: Number(group.memberCount || (localPlanet && localPlanet.memberCount) || 0),
          postCount: Number(group.contentCount || (localPlanet && localPlanet.postCount) || 0),
          createdAt: String(group.createdAt || (localPlanet && localPlanet.createdAt) || '').slice(0, 10),
          joined:
            typeof (localPlanet && localPlanet.joined) === 'boolean'
              ? Boolean(localPlanet && localPlanet.joined)
              : Boolean(response.data.membership && response.data.membership.isActive),
        },
      ])

      this.setData({
        planetId,
        planetName: String(group.name || this.data.planetName || '饮视星球'),
        questionTargetMembers,
        filteredQuestionTargetMembers: filterQuestionTargetMembers(
          questionTargetMembers,
          this.data.questionTargetSearchValue
        ),
        selectedQuestionTargetId: matchedQuestionTarget ? matchedQuestionTarget.id : '',
        selectedQuestionTargetName: matchedQuestionTarget ? matchedQuestionTarget.name : '',
      })
    } catch {
      // 发帖页优先保证可编辑，概览同步失败时保留本地回退数据
    }
  },

  onTitleInput(e: WechatMiniprogram.Input) {
    this.setData({
      title: e.detail.value.slice(0, MAX_TITLE_LENGTH),
    })
  },

  onTagInput(e: WechatMiniprogram.Input) {
    this.setData({
      tagInput: e.detail.value.slice(0, 60),
    })
  },

  onCheckinStatusInput(e: WechatMiniprogram.Input) {
    this.setData({
      checkinStatus: (e.detail.value || '').slice(0, 20),
    })
  },

  onCheckinProgressInput(e: WechatMiniprogram.Input) {
    this.setData({
      checkinProgress: (e.detail.value || '').slice(0, 20),
    })
  },

  onHomeworkDeliverableInput(e: WechatMiniprogram.Input) {
    this.setData({
      homeworkDeliverable: (e.detail.value || '').slice(0, 30),
    })
  },

  onHomeworkDeadlineInput(e: WechatMiniprogram.Input) {
    this.setData({
      homeworkDeadline: (e.detail.value || '').slice(0, 20),
    })
  },

  onQuestionTargetSelect(e: WechatMiniprogram.TouchEvent) {
    const targetId = String(e.currentTarget.dataset.id || '')
    if (!targetId) {
      return
    }

    const targetMember = this.data.questionTargetMembers.find((item) => item.id === targetId)
    if (!targetMember) {
      return
    }

    this.setData({
      selectedQuestionTargetId: targetMember.id,
      selectedQuestionTargetName: targetMember.name,
      questionTargetPopupVisible: false,
      questionTargetSearchValue: '',
      filteredQuestionTargetMembers: this.data.questionTargetMembers,
    })
  },

  onOpenQuestionTargetPopup() {
    if (!this.data.isQuestionMode) {
      return
    }

    this.setData({
      questionTargetPopupVisible: true,
      questionTargetSearchValue: '',
      filteredQuestionTargetMembers: this.data.questionTargetMembers,
    })
  },

  onCloseQuestionTargetPopup() {
    if (!this.data.questionTargetPopupVisible) {
      return
    }

    this.setData({
      questionTargetPopupVisible: false,
      questionTargetSearchValue: '',
      filteredQuestionTargetMembers: this.data.questionTargetMembers,
    })
  },

  onQuestionTargetPopupTap() {},

  onQuestionTargetSearchInput(e: WechatMiniprogram.Input) {
    const questionTargetSearchValue = e.detail.value || ''
    this.setData({
      questionTargetSearchValue,
      filteredQuestionTargetMembers: filterQuestionTargetMembers(this.data.questionTargetMembers, questionTargetSearchValue),
    })
  },

  onColumnChange(e: WechatMiniprogram.BaseEvent & { detail: { value: number | string } }) {
    const index = Number(e.detail.value)
    if (Number.isNaN(index) || index < 0 || index >= this.data.columnOptions.length) {
      return
    }

    const selectedColumn = this.data.columnOptions[index]
    this.setData({
      selectedColumnId: selectedColumn.id,
      selectedColumnTitle: selectedColumn.title,
      selectedColumnIndex: index,
    })
  },

  async loadQuestionTargetMembers(preferredTarget?: { id?: string; name?: string }) {
    const session = getStoredSession()
    if (!session || !session.sessionToken || !this.data.planetId) {
      return
    }

    try {
      const response = await fetchPlanetMembers(this.data.planetId, session.sessionToken)
      if (!response.ok || !response.data || !Array.isArray(response.data.items)) {
        return
      }

      const remoteMembers = mapRemoteQuestionTargetMembers(response.data.items)
      if (!remoteMembers.length) {
        return
      }

      const matchedSelectedMember =
        remoteMembers.find((item) => item.id === (preferredTarget && preferredTarget.id ? preferredTarget.id : this.data.selectedQuestionTargetId)) ||
        remoteMembers.find((item) => item.name === (preferredTarget && preferredTarget.name ? preferredTarget.name : this.data.selectedQuestionTargetName)) ||
        remoteMembers[0]

      this.setData({
        questionTargetMembers: remoteMembers,
        filteredQuestionTargetMembers: filterQuestionTargetMembers(remoteMembers, this.data.questionTargetSearchValue),
        selectedQuestionTargetId: matchedSelectedMember ? matchedSelectedMember.id : '',
        selectedQuestionTargetName: matchedSelectedMember ? matchedSelectedMember.name : '',
      })
    } catch (error) {
      console.warn('loadQuestionTargetMembers failed', error)
    }
  },

  async loadColumnOptions() {
    const session = getStoredSession()
    if (!this.data.planetId) {
      return
    }

    try {
      if (!session || !session.sessionToken) {
        throw new Error('使用本地专栏')
      }

      const response = await fetchPlanetColumns({
        groupId: this.data.planetId,
        sessionToken: session.sessionToken,
        userId: session.id,
      })

      if (!response.ok || !response.data || !Array.isArray(response.data.items)) {
        return
      }

      const columns: ColumnOption[] = response.data.items.map((item) => ({
        id: item.id,
        title: item.title,
      }))

      // 如果当前已选择专栏，找到对应的标题和索引
      let selectedColumnTitle = ''
      let selectedColumnIndex = -1
      if (this.data.selectedColumnId) {
        const foundIndex = columns.findIndex((col) => col.id === this.data.selectedColumnId)
        if (foundIndex >= 0) {
          selectedColumnTitle = columns[foundIndex].title
          selectedColumnIndex = foundIndex
        }
      }

      this.setData({
        columnOptions: columns,
        selectedColumnTitle,
        selectedColumnIndex,
      })
    } catch {
      const localColumns = listLocalPlanetColumns(this.data.planetId)
      const columns: ColumnOption[] = localColumns.items.map((item) => ({
        id: item.id,
        title: item.title,
      }))

      let selectedColumnTitle = this.data.selectedColumnTitle
      let selectedColumnIndex = -1
      if (this.data.selectedColumnId) {
        const foundIndex = columns.findIndex((col) => col.id === this.data.selectedColumnId)
        if (foundIndex >= 0) {
          selectedColumnTitle = columns[foundIndex].title
          selectedColumnIndex = foundIndex
        }
      }

      this.setData({
        columnOptions: columns,
        selectedColumnTitle,
        selectedColumnIndex,
      })
    }
  },

  onEditorReady() {
    wx.createSelectorQuery()
      .in(this)
      .select('#planet-editor')
      .context((res) => {
        const context = res && 'context' in res ? (res.context as EditorContext) : null
        editorCtx = context

        this.setData({
          editorReady: !!context,
        })

        if (context && pendingEditorHtml) {
          applyEditorHtml(this, pendingEditorHtml)
        }
      })
      .exec()
  },

  onEditorInput() {
    void this.syncEditorContent()
  },

  onEditorStatusChange(e: WechatMiniprogram.BaseEvent & { detail: EditorStatusPayload }) {
    const status = e.detail || {}

    this.setData({
      toolbarStatus: {
        bold: !!status.bold,
        italic: !!status.italic,
        underline: !!status.underline,
        heading: String(status.header || '').toUpperCase() === 'H2',
        bulletList: status.list === 'bullet',
      },
    })
  },

  async syncEditorContent() {
    if (!editorCtx) {
      return null
    }

    return new Promise<{ html: string; text: string } | null>((resolve) => {
      editorCtx!.getContents({
        success: (res) => {
          const html = (res && res.html ? res.html : '').trim()
          const text = (res && res.text ? res.text : '').trim().slice(0, MAX_TEXT_LENGTH)

          this.setData({
            editorHtml: html,
            editorText: text,
          })

          resolve({
            html,
            text,
          })
        },
        fail: () => resolve(null),
      })
    })
  },

  execFormat(command: string, value?: string) {
    if (!editorCtx) {
      wx.showToast({
        title: '编辑器还没准备好',
        icon: 'none',
      })
      return
    }

    editorCtx.format(command, value)
  },

  onToolbarTap(e: WechatMiniprogram.TouchEvent) {
    const command = String(e.currentTarget.dataset.command || '')
    const value = e.currentTarget.dataset.value

    if (!command || !editorCtx) {
      return
    }

    if (command === 'clear') {
      editorCtx.clear({
        success: () => {
          this.setData({
            editorHtml: '',
            editorText: '',
            toolbarStatus: {
              bold: false,
              italic: false,
              underline: false,
              heading: false,
              bulletList: false,
            },
          })
        },
      })
      return
    }

    if (command === 'insertDivider') {
      editorCtx.insertDivider({})
      return
    }

    if (command === 'removeFormat') {
      editorCtx.removeFormat({})
      return
    }

    this.execFormat(command, typeof value === 'string' ? value : undefined)
  },

  async onChooseImages() {
    const session = getStoredSession()
    const remainCount = Math.max(0, 9 - this.data.imagePreviewList.length)
    if (!remainCount) {
      wx.showToast({
        title: '最多上传9张图片',
        icon: 'none',
      })
      return
    }

    try {
      const chooseResult = await new Promise<WechatMiniprogram.ChooseMediaSuccessCallbackResult>((resolve, reject) => {
        wx.chooseMedia({
          count: remainCount,
          mediaType: ['image'],
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject,
        })
      })

      const files = Array.isArray(chooseResult.tempFiles) ? chooseResult.tempFiles : []
      if (!files.length) {
        return
      }

      this.setData({
        uploadingImages: true,
      })

      wx.showLoading({
        title: '上传图片中',
        mask: true,
      })

      const uploadedUrls: string[] = []
      let usedLocalFallback = false
      for (const file of files) {
        if (!file.tempFilePath) {
          continue
        }

        if (session && session.sessionToken) {
          try {
            const response = await uploadPlanetImage(file.tempFilePath, session.sessionToken)
            if (response.ok && response.data && response.data.url) {
              uploadedUrls.push(response.data.url)
              continue
            }
          } catch {}
        }

        usedLocalFallback = true
        uploadedUrls.push(file.tempFilePath)
      }

      const imagePreviewList = Array.from(new Set(this.data.imagePreviewList.concat(uploadedUrls))).slice(0, 9)
      this.setData({
        imagePreviewList,
      })

      if (usedLocalFallback) {
        wx.showToast({
          title: '已加入本地图片草稿',
          icon: 'none',
        })
      }
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '图片上传失败',
        icon: 'none',
      })
    } finally {
      wx.hideLoading()
      this.setData({
        uploadingImages: false,
      })
    }
  },

  async onChooseCoverImage() {
    const session = getStoredSession()

    try {
      const chooseResult = await new Promise<WechatMiniprogram.ChooseMediaSuccessCallbackResult>((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject,
        })
      })

      const files = Array.isArray(chooseResult.tempFiles) ? chooseResult.tempFiles : []
      const targetFile = files[0]
      if (!targetFile || !targetFile.tempFilePath) {
        return
      }

      this.setData({
        uploadingCover: true,
      })

      wx.showLoading({
        title: '上传封面中',
        mask: true,
      })

      let coverImageUrl = targetFile.tempFilePath
      let usedLocalFallback = true

      if (session && session.sessionToken) {
        try {
          const response = await uploadPlanetImage(targetFile.tempFilePath, session.sessionToken)
          if (response.ok && response.data && response.data.url) {
            coverImageUrl = response.data.url
            usedLocalFallback = false
          }
        } catch {}
      }

      this.setData({
        coverImageUrl,
      })

      if (usedLocalFallback) {
        wx.showToast({
          title: '已加入本地封面草稿',
          icon: 'none',
        })
      }
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '封面上传失败',
        icon: 'none',
      })
    } finally {
      wx.hideLoading()
      this.setData({
        uploadingCover: false,
      })
    }
  },

  onRemoveCoverImage() {
    if (!this.data.coverImageUrl) {
      return
    }

    this.setData({
      coverImageUrl: '',
    })
  },

  onRemoveImage(e: WechatMiniprogram.TouchEvent) {
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isFinite(index) || index < 0) {
      return
    }

    const nextList = this.data.imagePreviewList.filter((_, currentIndex) => currentIndex !== index)
    this.setData({
      imagePreviewList: nextList,
    })
  },

  async onChooseFiles() {
    const session = getStoredSession()
    const remainCount = Math.max(0, 5 - this.data.fileAttachmentList.length)
    if (!remainCount) {
      wx.showToast({
        title: '最多上传5个文件',
        icon: 'none',
      })
      return
    }

    try {
      const chooseResult = await new Promise<WechatMiniprogram.ChooseMessageFileSuccessCallbackResult>((resolve, reject) => {
        wx.chooseMessageFile({
          count: remainCount,
          type: 'file',
          success: resolve,
          fail: reject,
        })
      })

      const files = Array.isArray(chooseResult.tempFiles) ? chooseResult.tempFiles : []
      if (!files.length) {
        return
      }

      this.setData({
        uploadingFiles: true,
      })

      wx.showLoading({
        title: '上传文件中',
        mask: true,
      })

      const uploadedFiles: FileAttachmentItem[] = []
      let usedLocalFallback = false
      for (const file of files) {
        const tempFilePath = 'path' in file && typeof file.path === 'string' ? file.path : ''
        if (!tempFilePath) {
          continue
        }

        if (session && session.sessionToken) {
          try {
            const response = await uploadPlanetFile(tempFilePath, session.sessionToken)
            if (response.ok && response.data && response.data.url) {
              uploadedFiles.push({
                name:
                  response.data.filename ||
                  ('name' in file && typeof file.name === 'string' ? file.name : '未命名文件'),
                url: response.data.url,
                sizeText: formatFileSize(response.data.size || ('size' in file ? Number(file.size || 0) : 0)),
                mimeType: response.data.mimeType || '',
              })
              continue
            }
          } catch {}
        }

        usedLocalFallback = true
        uploadedFiles.push({
          name: 'name' in file && typeof file.name === 'string' ? file.name : '未命名文件',
          url: tempFilePath,
          sizeText: formatFileSize('size' in file ? Number(file.size || 0) : 0),
          mimeType: 'type' in file && typeof file.type === 'string' ? file.type : '',
        })
      }

      const fileAttachmentList = this.data.fileAttachmentList
        .concat(uploadedFiles)
        .filter((item, index, list) => list.findIndex((current) => current.url === item.url) === index)
        .slice(0, 5)

      this.setData({
        fileAttachmentList,
      })

      if (usedLocalFallback) {
        wx.showToast({
          title: '已加入本地文件草稿',
          icon: 'none',
        })
      }
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '文件上传失败',
        icon: 'none',
      })
    } finally {
      wx.hideLoading()
      this.setData({
        uploadingFiles: false,
      })
    }
  },

  onRemoveFile(e: WechatMiniprogram.TouchEvent) {
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isFinite(index) || index < 0) {
      return
    }

    const nextList = this.data.fileAttachmentList.filter((_, currentIndex) => currentIndex !== index)
    this.setData({
      fileAttachmentList: nextList,
    })
  },

  async onSubmit() {
    if (this.data.submitting) {
      return
    }

    const session = getStoredSession()
    const editorContent = await this.syncEditorContent()
    const title = this.data.title.trim()
    const editorHtml = editorContent ? editorContent.html : this.data.editorHtml
    const editorText = editorContent ? editorContent.text : this.data.editorText
    const normalizedText = stripHtml(editorHtml || editorText)

    const tags = this.data.tagInput
      .split(/[\s,，]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 4)
    const nextImages = this.data.imagePreviewList
    const nextFiles = this.data.fileAttachmentList
    const attachments = nextImages
      .concat(nextFiles.map((item) => item.url))
      .filter((item) => isPersistedAttachmentUrl(item))
    const summary = buildSummary(title, normalizedText)
    const richContent = editorHtml
    const coverImageUrl = this.data.coverImageUrl
    const selectedQuestionTarget =
      this.data.publishType === 'question'
        ? this.data.questionTargetMembers.find((item) => item.id === this.data.selectedQuestionTargetId) || null
        : null

    if (this.data.publishType === 'question' && !selectedQuestionTarget) {
      wx.showToast({
        title: '请选择被提问成员',
        icon: 'none',
      })
      return
    }

    if (!normalizedText && !nextImages.length && !nextFiles.length) {
      wx.showToast({
        title: '请先填写正文或上传附件',
        icon: 'none',
      })
      return
    }

    this.setData({
      submitting: true,
    })

    try {
      let useLocalFallback = false
      const payload = {
        postId: this.data.postId,
        groupId: this.data.planetId,
        userId: session && session.id ? session.id : '',
        sessionToken: session && session.sessionToken ? session.sessionToken : '',
        title,
        summary,
        contentText: normalizedText,
        attachments,
        metadata: {
          tags,
          publishType: this.data.publishType,
          richContent,
          coverUrl: coverImageUrl || '',
          images: nextImages,
          hasFile: nextFiles.length > 0,
          fileAttachments: nextFiles.map((item) => ({
            name: item.name,
            url: item.url,
            sizeText: item.sizeText,
            mimeType: item.mimeType,
          })),
          fileName: nextFiles.length ? nextFiles[0].name : '',
          checkinStatus: this.data.isCheckinMode ? this.data.checkinStatus.trim() : '',
          checkinProgress: this.data.isCheckinMode ? this.data.checkinProgress.trim() : '',
          homeworkDeliverable: this.data.isHomeworkMode ? this.data.homeworkDeliverable.trim() : '',
          homeworkDeadline: this.data.isHomeworkMode ? this.data.homeworkDeadline.trim() : '',
          questionTargetId: selectedQuestionTarget ? selectedQuestionTarget.id : '',
          questionTargetName: selectedQuestionTarget ? selectedQuestionTarget.name : '',
          columnId: this.data.selectedColumnId || undefined,
        },
      }

      const hasLocalAssets =
        (!!coverImageUrl && !isPersistedAttachmentUrl(coverImageUrl)) ||
        nextImages.some((item) => !isPersistedAttachmentUrl(item)) ||
        nextFiles.some((item) => !isPersistedAttachmentUrl(item.url))

      try {
        if (!session || !session.id || !session.sessionToken || hasLocalAssets) {
          throw new Error('使用本地草稿发布')
        }

        const response =
          this.data.isEditMode && this.data.postId
            ? await updatePlanetPost(payload)
            : await createPlanetPost(payload)

        if (!response.ok) {
          throw new Error(this.data.isEditMode ? '修改失败' : '发布失败')
        }
      } catch {
        useLocalFallback = true
        const localPayload = {
          title,
          content: normalizedText,
          richContent,
          coverImageUrl,
          tags,
          images: nextImages,
          fileAttachments: nextFiles,
          publishType: this.data.publishType,
          checkinStatus: this.data.isCheckinMode ? this.data.checkinStatus.trim() : '',
          checkinProgress: this.data.isCheckinMode ? this.data.checkinProgress.trim() : '',
          homeworkDeliverable: this.data.isHomeworkMode ? this.data.homeworkDeliverable.trim() : '',
          homeworkDeadline: this.data.isHomeworkMode ? this.data.homeworkDeadline.trim() : '',
          questionTargetId: selectedQuestionTarget ? selectedQuestionTarget.id : '',
          questionTargetName: selectedQuestionTarget ? selectedQuestionTarget.name : '',
          columnId: this.data.selectedColumnId || '',
          columnTitle: this.data.selectedColumnTitle || '',
          author: session && session.nickname ? session.nickname : '',
          avatar: session && session.avatarUrl ? session.avatarUrl : '',
        }

        if (this.data.isEditMode && this.data.postId) {
          const updatedPost = updateLocalPost({
            id: this.data.postId,
            ...localPayload,
          })

          if (!updatedPost) {
            throw new Error('本地帖子不存在')
          }
        } else {
          addLocalPost({
            planetId: this.data.planetId,
            ...localPayload,
          })
        }
      }

      wx.setStorageSync(PLANET_PUBLISH_REFRESH_KEY, this.data.planetId)

      wx.showToast({
        title: useLocalFallback
          ? this.data.isEditMode
            ? '已保存本地修改'
            : '已保存本地帖子'
          : this.data.isEditMode
            ? '修改成功'
            : '发布成功',
        icon: 'success',
      })

      setTimeout(() => {
        const pages = getCurrentPages()
        if (pages.length > 1) {
          wx.navigateBack({
            delta: 1,
          })
          return
        }

        wx.redirectTo({
          url: `/pages/planet/home?id=${this.data.planetId}&name=${encodeURIComponent(this.data.planetName)}&source=joined`,
        })
      }, 280)
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '发布失败，请稍后再试',
        icon: 'none',
      })
    } finally {
      setTimeout(() => {
        this.setData({
          submitting: false,
        })
      }, 300)
    }
  },
})
