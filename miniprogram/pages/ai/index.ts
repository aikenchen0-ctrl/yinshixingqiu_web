interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  content: string
}

Page({
  data: {
    messages: [
      {
        id: 'm1',
        role: 'ai',
        content: '你好，我是血饮训练的AI智能体。请描述你的资产安全问题。',
      },
    ] as ChatMessage[],
    inputValue: '',
  },
  onInput(e: WechatMiniprogram.Input) {
    this.setData({
      inputValue: e.detail.value,
    })
  },
  onSend() {
    const content = this.data.inputValue.trim()
    if (!content) {
      wx.showToast({
        title: '请输入问题',
        icon: 'none',
      })
      return
    }
    const userMessage: ChatMessage = {
      id: `u${Date.now()}`,
      role: 'user',
      content,
    }
    const nextMessages = [...this.data.messages, userMessage]
    this.setData({
      messages: nextMessages,
      inputValue: '',
    })
    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: `a${Date.now()}`,
        role: 'ai',
        content: '已收到问题，建议先进行资产边界梳理，再评估交易风控策略。',
      }
      this.setData({
        messages: [...nextMessages, aiMessage],
      })
    }, 400)
  },
})
