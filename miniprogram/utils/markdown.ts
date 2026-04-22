/**
 * 轻量级 Markdown 解析器
 * 将 Markdown 文本转换为微信小程序 rich-text 组件可识别的 HTML 字符串
 * 
 * 微信小程序 rich-text 限制：
 * 1. 支持的标签：div, p, span, b, strong, em, i, code 等
 * 2. 不支持 ul/ol/li，要用 div 替代
 * 3. 不支持 rpx 单位，要用 px
 * 4. 部分 CSS 属性不支持
 */

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 处理行内格式（加粗、斜体、代码）
 */
function processInline(text: string): string {
  // 先转义 HTML
  text = escapeHtml(text)
  
  // 行内代码 `code`
  text = text.replace(/`([^`]+)`/g, '<code style="background:rgba(47,245,180,0.1);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:20px;">$1</code>')
  
  // 加粗 **text** 或 __text__
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#2ff5b4;font-weight:bold;">$1</strong>')
  text = text.replace(/__(.+?)__/g, '<strong style="color:#2ff5b4;font-weight:bold;">$1</strong>')
  
  // 斜体 *text* 或 _text_
  text = text.replace(/\*(.+?)\*/g, '<em style="font-style:italic;">$1</em>')
  text = text.replace(/_(.+?)_/g, '<em style="font-style:italic;">$1</em>')
  
  return text
}

/**
 * 将 Markdown 转换为 HTML 字符串（兼容微信小程序 rich-text）
 */
export function mdToHtml(md: string): string {
  if (!md || typeof md !== 'string') {
    return ''
  }

  const lines = md.split('\n')
  let html = ''
  let inList = false
  
  function closeList() {
    if (inList) {
      html += '</div>'
      inList = false
    }
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // 空行
    if (line.trim() === '') {
      closeList()
      continue
    }
    
    // 标题
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/s)
    if (headingMatch) {
      closeList()
      const level = headingMatch[1].length
      const content = processInline(headingMatch[2])
      const fontSize = [36, 32, 28, 26, 24, 22][level - 1]
      const fontWeight = level <= 3 ? '800' : '600'
      const color = level <= 2 ? '#2ff5b4' : '#e6f0ff'
      
      html += `<div style="font-size:${fontSize}px;font-weight:${fontWeight};color:${color};margin:16px 0 8px 0;">${content}</div>`
      continue
    }
    
    // 无序列表
    const ulMatch = line.match(/^[\s]*[-*+]\s+(.+)/s)
    if (ulMatch) {
      if (!inList) {
        html += '<div style="padding-left:20px;margin:8px 0;">'
        inList = true
      }
      html += `<div style="margin:4px 0;">• ${processInline(ulMatch[1])}</div>`
      continue
    }
    
    // 有序列表
    const olMatch = line.match(/^[\s]*(\d+)\.\s+(.+)/s)
    if (olMatch) {
      if (!inList) {
        html += '<div style="padding-left:20px;margin:8px 0;">'
        inList = true
      }
      html += `<div style="margin:4px 0;">${olMatch[1]}. ${processInline(olMatch[2])}</div>`
      continue
    }
    
    // 分割线
    if (line.trim() === '---' || line.trim() === '***') {
      closeList()
      html += '<div style="height:1px;background:rgba(255,255,255,0.08);margin:12px 0;"></div>'
      continue
    }
    
    // 引用块
    const blockquoteMatch = line.match(/^>\s+(.+)/s)
    if (blockquoteMatch) {
      closeList()
      html += `<div style="border-left:3px solid #2ff5b4;padding-left:16px;margin:8px 0;color:rgba(230,240,255,0.7);">${processInline(blockquoteMatch[1])}</div>`
      continue
    }
    
    // 普通文本段落
    closeList()
    html += `<div style="margin:6px 0;line-height:1.6;">${processInline(line)}</div>`
  }
  
  // 确保最后的列表被关闭
  closeList()
  
  return html
}

/**
 * 将 Markdown 文本转换为 rich-text 可使用的格式（HTML 字符串）
 */
export function mdToNodes(md: string): string {
  return mdToHtml(md)
}
