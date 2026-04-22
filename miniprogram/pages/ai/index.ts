import { request } from '../../utils/request'
import { mdToNodes } from '../../utils/markdown'

interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  content: string
  htmlNodes?: string
  modeLabel?: string
  coverageHint?: string
  suggestions?: string[]
  sources?: { title: string; date: string; snippet: string }[]
}

interface AskAIResponse {
  ok: boolean
  message?: string
  data?: {
    answer: string
    sources: { title: string; date: string; snippet: string }[]
    mode: string
    modeLabel?: string
    coverageHint?: string
    suggestions?: string[]
  }
}

const INITIAL_MESSAGE = '你好，我是血饮知识库训练的 AI 助手。你可以直接问中美博弈、金融货币、俄乌欧亚、中东或内政经济等主题。'
const QUICK_PROMPTS = [
  '怎么看美联储加息和A股？',
  '如何理解中美博弈的长期主线？',
  '俄乌欧亚局势的关键变量是什么？',
  '中东局势会怎样影响全球能源与金融？',
  '内政经济当前最值得跟踪的矛盾是什么？',
]

function buildModeLabel(mode: string) {
  if (mode === 'llm') return '已结合知识库资料归纳'
  if (mode === 'kb_fallback') return '当前为知识库直答模式'
  if (mode === 'kb_empty') return '当前问题超出知识库覆盖，可改问血饮长期主题'
  if (mode === 'kb_error') return '知识库暂时不可用，当前返回的是降级提示'
  return ''
}

Page({
  data: {
    messages: [
      {
        id: 'm1',
        role: 'ai',
        content: INITIAL_MESSAGE,
        htmlNodes: mdToNodes(INITIAL_MESSAGE),
      },
    ] as ChatMessage[],
    quickPrompts: QUICK_PROMPTS,
    inputValue: '',
    loading: false,
    scrollIntoView: 'msg-m1',
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({
      inputValue: String(e.detail.value || ''),
    })
  },

  onQuickPromptTap(e: WechatMiniprogram.BaseEvent) {
    if (this.data.loading) return

    const question = String(e.currentTarget.dataset.question || '').trim()
    if (!question) return

    this.setData({
      inputValue: question,
    })
  },

  onSuggestionTap(e: WechatMiniprogram.BaseEvent) {
    const question = String(e.currentTarget.dataset.question || '').trim()
    if (!question || this.data.loading) return

    void this.sendQuestion(question)
  },

  async sendQuestion(content: string) {
    const normalizedContent = String(content || '').trim()
    if (!normalizedContent) {
      wx.showToast({
        title: '请输入问题',
        icon: 'none',
      })
      return
    }

    if (this.data.loading) return

    const userMessage: ChatMessage = {
      id: `u${Date.now()}`,
      role: 'user',
      content: normalizedContent,
    }
    const nextMessages = [...this.data.messages, userMessage]

    this.setData({
      messages: nextMessages,
      inputValue: '',
      loading: true,
      scrollIntoView: `msg-${userMessage.id}`,
    })

    try {
      const aiResponse = await this.askAI(normalizedContent, nextMessages)

      const aiMessage: ChatMessage = {
        id: `a${Date.now()}`,
        role: 'ai',
        content: aiResponse.answer,
        htmlNodes: mdToNodes(aiResponse.answer),
        modeLabel: aiResponse.modeLabel || buildModeLabel(aiResponse.mode),
        coverageHint: aiResponse.coverageHint || '',
        suggestions: Array.isArray(aiResponse.suggestions) ? aiResponse.suggestions : [],
        sources: aiResponse.sources,
      }

      this.setData({
        messages: [...nextMessages, aiMessage],
        loading: false,
        scrollIntoView: `msg-${aiMessage.id}`,
      })
    } catch (err) {
      console.error('KB search error:', err)
      const message =
        err instanceof Error && /timeout/i.test(err.message)
          ? '思考时间有点长，请再等一下或换个更具体的问题。'
          : err instanceof Error
            ? err.message
            : '抱歉，真实 AI 问答暂时不可用，请稍后重试。'
      const errorMessage: ChatMessage = {
        id: `a${Date.now()}`,
        role: 'ai',
        content: message,
        htmlNodes: mdToNodes(message),
      }
      this.setData({
        messages: [...nextMessages, errorMessage],
        loading: false,
        scrollIntoView: `msg-${errorMessage.id}`,
      })
    }
  },

  async onSend() {
    await this.sendQuestion(this.data.inputValue)
  },

  async askAI(query: string, messages: ChatMessage[]) {
    const history = messages.slice(-6).map((item) => ({
      role: item.role,
      content: item.content,
    }))

    const res = await request<AskAIResponse>({
      url: '/api/ai/ask',
      method: 'POST',
      timeout: 90000,
      data: {
        query,
        history,
      },
    })

    if (!res.ok || !res.data || !res.data.answer) {
      throw new Error(res.message || '真实 AI 问答暂时不可用，请稍后重试。')
    }

    return res.data
  },
})
