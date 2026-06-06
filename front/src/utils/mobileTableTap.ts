/**
 * 判断元素是否为可编辑输入元素
 *
 * @param element 待判断的 DOM 元素
 * @returns 返回 true 表示元素会持有输入焦点
 */
const isEditableElement = (element: Element | null): element is HTMLElement => {
  if (!element || !(element instanceof HTMLElement)) return false
  const tagName = element.tagName.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || element.isContentEditable
}

/**
 * 判断当前设备是否更接近触摸交互
 *
 * @returns 返回 true 表示当前环境主要使用粗指针或触摸
 */
const isTouchLikeDevice = () => {
  return window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
}

/**
 * 初始化移动端表格点击修复
 *
 * @returns 返回清理函数，用于移除事件监听
 */
export const setupMobileTableTapFix = () => {
  if (!isTouchLikeDevice()) return () => undefined

  /**
   * 处理表格内交互控件触摸前的焦点释放
   *
   * @param event 指针按下事件
   * @returns 无返回值
   */
  const handlePointerDown = (event: PointerEvent) => {
    const target = event.target instanceof Element ? event.target : null
    const tableArea = target?.closest('.el-table')

    if (!tableArea || isEditableElement(target)) return

    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!isEditableElement(activeElement) || activeElement.contains(target)) return

    // 1. 在真正 click 触发前释放输入焦点，减少移动端键盘收起吞掉第一次点击的概率
    activeElement.blur()
  }

  document.addEventListener('pointerdown', handlePointerDown, true)

  return () => {
    document.removeEventListener('pointerdown', handlePointerDown, true)
  }
}
