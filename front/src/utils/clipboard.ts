/**
 * 使用隐藏文本框兜底复制文本
 *
 * @param text 需要复制到剪贴板的文本
 * @returns 返回 true 表示复制成功，返回 false 表示复制失败
 */
const copyByTextarea = (text: string) => {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.readOnly = true
  textarea.setAttribute('aria-hidden', 'true')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '-9999px'
  textarea.style.width = '1px'
  textarea.style.height = '1px'
  textarea.style.opacity = '0'
  textarea.style.fontSize = '16px'
  document.body.appendChild(textarea)

  // 1. 聚焦并选中文本，兼容 iOS Safari 和部分 WebView
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)

  try {
    // 2. 使用浏览器旧复制命令作为移动端兜底
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    // 3. 清理临时文本框
    document.body.removeChild(textarea)
  }
}

/**
 * 复制文本到系统剪贴板
 *
 * @param text 需要复制到剪贴板的文本
 * @returns 返回 true 表示复制成功，返回 false 表示复制失败
 */
export const copyText = async (text: string) => {
  const value = String(text || '')
  if (!value) return false

  try {
    // 1. 优先使用现代 Clipboard API，要求安全上下文和用户手势
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // 2. Clipboard API 失败时继续走兜底方案
  }

  return copyByTextarea(value)
}
