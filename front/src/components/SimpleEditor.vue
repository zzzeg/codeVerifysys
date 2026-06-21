<!--
  作者：xxx
-->
<script setup lang="ts">
import { nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import { RefreshLeft, RefreshRight } from '@element-plus/icons-vue'

const headingOptions = [
  { label: '正文', value: 'paragraph' },
  { label: 'H1', value: 'h1' },
  { label: 'H2', value: 'h2' },
  { label: 'H3', value: 'h3' },
  { label: 'H4', value: 'h4' },
  { label: 'H5', value: 'h5' },
] as const

const fontSizeOptions = ['12px', '13px', '14px', '15px', '16px', '19px', '22px', '24px', '29px', '32px', '40px', '48px'] as const
const predefinedColorOptions = [
  '#ff4500',
  '#ff8c00',
  '#ffd700',
  '#90ee90',
  '#00ced1',
  '#1e90ff',
  '#c71585',
  'rgba(255, 69, 0, 0.68)',
  'rgb(255, 120, 0)',
  'hsv(51, 100, 98)',
  'hsva(120, 40, 94, 0.5)',
  'hsl(181, 100%, 37%)',
  'hsla(209, 100%, 56%, 0.73)',
  '#c7158577'
] as const

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {}
              }
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
          ({ chain }) => chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize:
        () =>
          ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    }
  },
})

const props = defineProps<{
  modelValue: string
  placeholder?: string
  minHeight?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const linkEditorVisible = ref(false)
const linkTextInputRef = ref<HTMLInputElement>()
const headingDropdownVisible = ref(false)
const fontSizeDropdownVisible = ref(false)
const textColorPickerValue = ref('')
const highlightColorPickerValue = ref('')
const linkForm = reactive({
  text: '',
  url: '',
})
const linkSelection = ref<{ from: number; to: number } | null>(null)
const linkInsertPosition = ref<number | null>(null)

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3, 4, 5],
      },
    }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    FontSize,
    Image.configure({ inline: false, allowBase64: true }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
    }),
    Placeholder.configure({ placeholder: props.placeholder || '请输入内容...' }),
  ],
  onUpdate: ({ editor: currentEditor }) => {
    emit('update:modelValue', currentEditor.getHTML())
  },
})

watch(() => props.modelValue, (value) => {
  if (editor.value && editor.value.getHTML() !== value) {
    editor.value.commands.setContent(value)
  }
})

onBeforeUnmount(() => {
  editor.value?.destroy()
})

/**
 * 切换加粗状态
 * @param 无
 * @returns 无
 */
function toggleBold() {
  editor.value?.chain().focus().toggleBold().run()
}

/**
 * 切换斜体状态
 * @param 无
 * @returns 无
 */
function toggleItalic() {
  editor.value?.chain().focus().toggleItalic().run()
}

/**
 * 切换删除线状态
 * @param 无
 * @returns 无
 */
function toggleStrike() {
  editor.value?.chain().focus().toggleStrike().run()
}

/**
 * 切换行内代码状态
 * @param 无
 * @returns 无
 */
function toggleCode() {
  editor.value?.chain().focus().toggleCode().run()
}

/**
 * 切换无序列表状态
 * @param 无
 * @returns 无
 */
function toggleBulletList() {
  editor.value?.chain().focus().toggleBulletList().run()
}

/**
 * 切换有序列表状态
 * @param 无
 * @returns 无
 */
function toggleOrderedList() {
  editor.value?.chain().focus().toggleOrderedList().run()
}

/**
 * 切换引用状态
 * @param 无
 * @returns 无
 */
function toggleBlockquote() {
  editor.value?.chain().focus().toggleBlockquote().run()
}

/**
 * 切换代码块状态
 * @param 无
 * @returns 无
 */
function toggleCodeBlock() {
  editor.value?.chain().focus().toggleCodeBlock().run()
}

/**
 * 设置段落或标题类型
 * @param value 目标类型
 * @returns 无
 */
function setBlockType(value: string) {
  if (!editor.value) {
    return
  }

  // 1. 正文模式切回段落
  // 2. H 标签模式按级别设置标题
  if (value === 'paragraph') {
    editor.value.chain().focus().setParagraph().run()
  } else {
    const level = Number(value.replace('h', '')) as 1 | 2 | 3 | 4 | 5
    editor.value.chain().focus().setHeading({ level }).run()
  }
  headingDropdownVisible.value = false
}

/**
 * 插入分割线
 * @param 无
 * @returns 无
 */
function setHorizontalRule() {
  editor.value?.chain().focus().setHorizontalRule().run()
}

/**
 * 撤销编辑操作
 * @param 无
 * @returns 无
 */
function undo() {
  editor.value?.chain().focus().undo().run()
}

/**
 * 重做编辑操作
 * @param 无
 * @returns 无
 */
function redo() {
  editor.value?.chain().focus().redo().run()
}

/**
 * 设置文字颜色
 * @param color 颜色值
 * @returns 无
 */
function setTextColor(color: string) {
  textColorPickerValue.value = color
  editor.value?.chain().focus().setColor(color).run()
}

/**
 * 清除文字颜色
 * @param 无
 * @returns 无
 */
function unsetTextColor() {
  textColorPickerValue.value = ''
  editor.value?.chain().focus().unsetColor().run()
}

/**
 * 设置背景颜色
 * @param color 颜色值
 * @returns 无
 */
function setHighlightColor(color: string) {
  highlightColorPickerValue.value = color
  editor.value?.chain().focus().setHighlight({ color }).run()
}

/**
 * 清除背景颜色
 * @param 无
 * @returns 无
 */
function unsetHighlightColor() {
  highlightColorPickerValue.value = ''
  editor.value?.chain().focus().unsetHighlight().run()
}

/**
 * 设置字号
 * @param fontSize 字号值
 * @returns 无
 */
function setFontSize(fontSize: string) {
  editor.value?.chain().focus().setFontSize(fontSize).run()
  fontSizeDropdownVisible.value = false
}

/**
 * 清除字号
 * @param 无
 * @returns 无
 */
function unsetFontSize() {
  editor.value?.chain().focus().unsetFontSize().run()
  fontSizeDropdownVisible.value = false
}

/**
 * 插入本地图片到编辑器
 * @param 无
 * @returns 无
 */
function insertImage() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) {
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('图片不能超过 2MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      editor.value?.chain().focus().setImage({ src: reader.result as string }).run()
    }
    reader.readAsDataURL(file)
  }
  input.click()
}

/**
 * 打开链接编辑面板
 * @param 无
 * @returns 无
 */
function openLinkEditor() {
  if (!editor.value) {
    return
  }

  // 1. 如果当前光标位于链接内，先扩展到整段链接，方便统一编辑
  editor.value.chain().focus().extendMarkRange('link').run()
  const { from, to } = editor.value.state.selection
  const selectedText = editor.value.state.doc.textBetween(from, to, ' ').trim()

  // 2. 记录当前选区与插入点
  linkSelection.value = from === to ? null : { from, to }
  linkInsertPosition.value = from
  // 3. 已选中文本时自动带出文本，未选中时允许用户自行输入链接文本
  linkForm.text = selectedText
  linkForm.url = String(editor.value.getAttributes('link').href || 'https://')
  linkEditorVisible.value = true

  nextTick(() => {
    linkTextInputRef.value?.focus()
    if (selectedText) {
      linkTextInputRef.value?.select()
    }
  })
}

/**
 * 移除当前选区链接
 * @param 无
 * @returns 无
 */
function unsetLink() {
  editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
}

/**
 * 关闭链接编辑面板
 * @param 无
 * @returns 无
 */
function closeLinkEditor() {
  linkEditorVisible.value = false
  linkSelection.value = null
  linkInsertPosition.value = null
  linkForm.text = ''
  linkForm.url = ''
}

/**
 * 确认写入链接内容
 * @param 无
 * @returns 无
 */
function confirmLink() {
  if (!editor.value) {
    closeLinkEditor()
    return
  }

  const text = linkForm.text.trim()
  const url = normalizeLink(linkForm.url)

  if (!text) {
    ElMessage.warning('请输入链接文本')
    return
  }
  if (!url) {
    ElMessage.warning('请输入链接地址')
    return
  }

  const linkHtml = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`

  // 1. 有选区时覆盖当前选中文本
  // 2. 无选区时在当前光标位置直接插入用户输入的链接文本
  // 3. 插入完成后关闭面板并清空状态
  if (linkSelection.value) {
    editor.value
      .chain()
      .focus()
      .setTextSelection(linkSelection.value)
      .deleteSelection()
      .insertContent(linkHtml)
      .run()
  } else {
    editor.value
      .chain()
      .focus()
      .insertContentAt(linkInsertPosition.value ?? editor.value.state.selection.from, linkHtml)
      .run()
  }

  closeLinkEditor()
}

/**
 * 查看当前链接
 * @param 无
 * @returns 无
 */
function openCurrentLink() {
  const href = String(editor.value?.getAttributes('link').href || '').trim()
  if (!href) {
    ElMessage.warning('当前链接地址为空')
    return
  }
  window.open(href, '_blank', 'noopener,noreferrer')
}

/**
 * 判断是否显示链接操作悬浮条
 * @param options Tiptap气泡菜单上下文
 * @returns 是否显示
 */
function shouldShowLinkActions(options: { editor: { isActive: (name: string) => boolean } }) {
  return options.editor.isActive('link') && !linkEditorVisible.value
}

/**
 * 判断是否显示链接编辑面板
 * @param 无
 * @returns 是否显示
 */
function shouldShowLinkEditor() {
  return linkEditorVisible.value && Boolean(editor.value)
}

/**
 * 标准化链接地址
 * @param value 用户输入的链接地址
 * @returns 可用链接地址
 */
function normalizeLink(value: string) {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return ''
  }
  if (/^(https?:)?\/\//i.test(trimmedValue) || /^mailto:/i.test(trimmedValue)) {
    return trimmedValue
  }
  return `https://${trimmedValue}`
}

/**
 * 转义HTML特殊字符
 * @param value 原始文本
 * @returns 转义后的安全文本
 */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 返回气泡层挂载节点
 * @param 无
 * @returns 挂载节点
 */
function getBubbleAppendTarget() {
  return document.body
}

/**
 * 获取当前段落类型名称
 * @param 无
 * @returns 段落类型名称
 */
function getCurrentBlockLabel() {
  if (!editor.value) {
    return '正文'
  }
  const matchHeading = headingOptions.find((item) => item.value !== 'paragraph' && isActive('heading', { level: Number(item.value.replace('h', '')) }))
  return matchHeading?.label || '正文'
}

/**
 * 获取当前字号名称
 * @param 无
 * @returns 字号名称
 */
function getCurrentFontSizeLabel() {
  const fontSize = String(editor.value?.getAttributes('textStyle').fontSize || '')
  return fontSize || '默认字号'
}

/**
 * 判断当前文字颜色是否为默认值
 * @param 无
 * @returns 是否为默认值
 */
function isDefaultTextColor() {
  return !String(editor.value?.getAttributes('textStyle').color || '').trim()
}

/**
 * 判断当前背景颜色是否为默认值
 * @param 无
 * @returns 是否为默认值
 */
function isDefaultHighlightColor() {
  return !String(editor.value?.getAttributes('highlight').color || '').trim()
}

/**
 * 同步文字颜色选择器的值
 * @param color 颜色值
 * @returns 无
 */
function handleTextColorChange(color: string | null) {
  if (!color) {
    unsetTextColor()
    return
  }
  setTextColor(color)
}

/**
 * 同步背景颜色选择器的值
 * @param color 颜色值
 * @returns 无
 */
function handleHighlightColorChange(color: string | null) {
  if (!color) {
    unsetHighlightColor()
    return
  }
  setHighlightColor(color)
}

/**
 * 判断当前选区是否命中指定格式
 * @param name 节点或标记名称
 * @param attrs 节点属性
 * @returns 是否命中
 */
function isActive(name: string, attrs?: Record<string, unknown>) {
  return editor.value?.isActive(name, attrs) ?? false
}
</script>

<template>
  <div class="simple-editor" :style="{ '--simple-editor-min-height': props.minHeight || '300px' }">
    <div v-if="editor" class="simple-editor-toolbar">
      <el-tooltip content="撤销" :show-after="500"><el-button :icon="RefreshLeft" link @click="undo" /></el-tooltip>
      <el-tooltip content="重做" :show-after="500"><el-button :icon="RefreshRight" link @click="redo" /></el-tooltip>
      <span class="toolbar-divider" />
      <el-tooltip content="加粗" :show-after="500"><el-button :class="{ active: isActive('bold') }" link
          @click="toggleBold"><b>B</b></el-button></el-tooltip>
      <el-tooltip content="斜体" :show-after="500"><el-button :class="{ active: isActive('italic') }" link
          @click="toggleItalic"><i>I</i></el-button></el-tooltip>
      <el-tooltip content="删除线" :show-after="500"><el-button :class="{ active: isActive('strike') }" link
          @click="toggleStrike"><s>S</s></el-button></el-tooltip>
      <el-tooltip content="行内代码" :show-after="500"><el-button :class="{ active: isActive('code') }" link
          @click="toggleCode"><code>&lt;/&gt;</code></el-button></el-tooltip>
      <el-tooltip content="添加链接" :show-after="500"><el-button :class="{ active: isActive('link') }" link
          @click="openLinkEditor">链接</el-button></el-tooltip>
      <span class="toolbar-divider" />
      <el-tooltip content="设置段落类型" :show-after="500">
        <el-dropdown v-model:visible="headingDropdownVisible" trigger="click" placement="bottom-start">
          <button type="button" class="toolbar-dropdown-btn" :class="{ active: isActive('heading') }">
            {{ getCurrentBlockLabel() }}
            <span class="toolbar-dropdown-arrow">▼</span>
          </button>
          <template #dropdown>
            <el-dropdown-menu class="editor-dropdown-menu heading-dropdown-menu">
              <el-dropdown-item v-for="item in headingOptions" :key="item.value" @click="setBlockType(item.value)">
                <span :class="['heading-option-label', `heading-option-${item.value}`]">{{ item.label }}</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-tooltip>
      <el-tooltip content="设置文字颜色" :show-after="500">
        <div class="toolbar-color-picker">
          <button type="button" class="toolbar-color-trigger-btn" :class="{ active: !isDefaultTextColor() }">
            <span class="toolbar-color-trigger">
              <span class="toolbar-color-indicator">A</span>
              <span class="toolbar-dropdown-arrow">▼</span>
            </span>
          </button>
          <el-color-picker v-model="textColorPickerValue" class="toolbar-color-picker-control"
            :predefine="[...predefinedColorOptions]" show-alpha @change="handleTextColorChange" />
        </div>
      </el-tooltip>
      <el-tooltip content="设置背景颜色" :show-after="500">
        <div class="toolbar-color-picker">
          <button type="button" class="toolbar-color-trigger-btn" :class="{ active: !isDefaultHighlightColor() }">
            <span class="toolbar-color-trigger">
              <span class="toolbar-color-indicator" style="text-decoration: underline;">A</span>
              <span class="toolbar-dropdown-arrow">▼</span>
            </span>
          </button>
          <el-color-picker v-model="highlightColorPickerValue" class="toolbar-color-picker-control"
            :predefine="[...predefinedColorOptions]" show-alpha @change="handleHighlightColorChange" />
        </div>
      </el-tooltip>
      <el-tooltip content="设置字号" :show-after="500">
        <el-dropdown v-model:visible="fontSizeDropdownVisible" trigger="click" placement="bottom-start">
          <button type="button" class="toolbar-dropdown-btn">
            {{ getCurrentFontSizeLabel() }}
            <span class="toolbar-dropdown-arrow">▼</span>
          </button>
          <template #dropdown>
            <el-dropdown-menu class="editor-dropdown-menu font-size-dropdown-menu">
              <el-dropdown-item @click="unsetFontSize">默认字号</el-dropdown-item>
              <el-dropdown-item v-for="fontSize in fontSizeOptions" :key="fontSize" @click="setFontSize(fontSize)">
                {{ fontSize }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-tooltip>
      <span class="toolbar-divider" />
      <el-tooltip content="无序列表" :show-after="500"><el-button :class="{ active: isActive('bulletList') }" link
          @click="toggleBulletList">• 列表</el-button></el-tooltip>
      <el-tooltip content="有序列表" :show-after="500"><el-button :class="{ active: isActive('orderedList') }" link
          @click="toggleOrderedList">1. 列表</el-button></el-tooltip>
      <el-tooltip content="引用" :show-after="500"><el-button :class="{ active: isActive('blockquote') }" link
          @click="toggleBlockquote">❝</el-button></el-tooltip>
      <el-tooltip content="代码块" :show-after="500"><el-button :class="{ active: isActive('codeBlock') }" link
          @click="toggleCodeBlock">{ }</el-button></el-tooltip>
      <el-tooltip content="分割线" :show-after="500"><el-button link @click="setHorizontalRule">—</el-button></el-tooltip>
      <span class="toolbar-divider" />
      <el-tooltip content="插入图片" :show-after="500"><el-button link @click="insertImage">🖼</el-button></el-tooltip>
    </div>
    <BubbleMenu v-if="editor" :editor="editor" plugin-key="link-action-menu" :should-show="shouldShowLinkActions"
      :tippy-options="{ duration: 120, placement: 'bottom-start', interactive: true, appendTo: getBubbleAppendTarget, zIndex: 5000 }"
      class="link-bubble-menu">
      <div class="link-action-panel">
        <el-tooltip content="修改链接" :show-after="300">
          <button type="button" class="link-action-btn" @click="openLinkEditor">✎</button>
        </el-tooltip>
        <el-tooltip content="取消链接" :show-after="300">
          <button type="button" class="link-action-btn" @click="unsetLink">⛓</button>
        </el-tooltip>
        <el-tooltip content="查看链接" :show-after="300">
          <button type="button" class="link-action-btn" @click="openCurrentLink">↗</button>
        </el-tooltip>
      </div>
    </BubbleMenu>
    <BubbleMenu v-if="editor && linkEditorVisible" :editor="editor" plugin-key="link-editor-menu"
      :should-show="shouldShowLinkEditor"
      :tippy-options="{ duration: 120, placement: 'bottom-start', interactive: true, trigger: 'manual', appendTo: getBubbleAppendTarget, zIndex: 5000 }"
      class="link-bubble-menu">
      <div class="link-editor-panel">
        <div class="link-editor-head">
          <span>添加链接</span>
          <button type="button" class="link-close-btn" @mousedown.prevent @click.stop="closeLinkEditor">×</button>
        </div>
        <label class="link-editor-label">
          <span>链接文本</span>
          <input ref="linkTextInputRef" v-model="linkForm.text" class="link-editor-input" type="text" />
        </label>
        <label class="link-editor-label">
          <span>链接地址</span>
          <input v-model="linkForm.url" class="link-editor-input" type="text" placeholder="https://example.com" />
        </label>
        <div class="link-editor-actions">
          <el-button type="primary" @click="confirmLink">确定</el-button>
        </div>
      </div>
    </BubbleMenu>
    <EditorContent :editor="editor" class="simple-editor-content" />
  </div>
</template>

<style scoped lang="scss">
.simple-editor {
  --simple-editor-min-height: 200px;
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 4px;
  overflow: hidden;
  min-height: var(--simple-editor-min-height);
  background: #fff;
}

.simple-editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--el-border-color, #dcdfe6);
  background: #fff;
}

.simple-editor-toolbar .el-button {
  font-size: 13px;
  min-width: 32px;
  height: 30px;
  border-radius: 6px;
  color: #606266;
}

.simple-editor-toolbar .el-button:hover {
  background: #f0f0f0;
}

.simple-editor-toolbar .el-button.active {
  background: #e6fffb;
  color: #0d9488;
}

.toolbar-dropdown-btn {
  display: inline-flex;
  align-items: center;
  height: 30px;
  padding: 0 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #606266;
  font-size: 13px;
  cursor: pointer;
}

.el-tooltip__trigger {
  border-radius: 6px;
  overflow: hidden;
}

.el-tooltip__trigger:hover {
  background: #f0f0f0;
}

.toolbar-dropdown-btn.active {
  background: #e6fffb;
  color: #0d9488;
}

.toolbar-dropdown-arrow {
  font-size: 10px;
  transform: scale(0.9);
}

.toolbar-color-picker {
  position: relative;
  display: inline-flex;
  height: 30px;
  padding: 0 2px;
}

.toolbar-color-trigger-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  height: 30px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;

  span {
    display: flex;
  }
}

.toolbar-color-trigger-btn:hover {
  background: #f0f0f0;
}

.toolbar-color-trigger-btn.active {
  background: #e5e7eb;
}

.toolbar-color-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 12px;
  font-size: 16px;
  line-height: 1;
  color: #606266;
}

.toolbar-divider {
  width: 1px;
  height: 18px;
  background: #dcdfe6;
  margin: 0 4px;
}

.simple-editor-content {
  padding: 12px 16px;
  min-height: calc(var(--simple-editor-min-height) - 20px);
}

.simple-editor-content :deep(.tiptap) {
  outline: none;
  min-height: calc(var(--simple-editor-min-height) - 40px);
  line-height: 1.75;
  color: #303133;
}

.simple-editor-content :deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: #adb5bd;
  pointer-events: none;
  height: 0;
}

.simple-editor-content :deep(.tiptap h1) {
  font-size: 1.8em;
  font-weight: 700;
  margin: 0.6em 0;
}

.simple-editor-content :deep(.tiptap h2) {
  font-size: 1.4em;
  font-weight: 700;
  margin: 0.5em 0;
}

.simple-editor-content :deep(.tiptap h3) {
  font-size: 1.15em;
  font-weight: 700;
  margin: 0.4em 0;
}

.simple-editor-content :deep(.tiptap ul),
.simple-editor-content :deep(.tiptap ol) {
  padding-left: 1.5em;
  margin: 0.4em 0;
}

.simple-editor-content :deep(.tiptap blockquote) {
  border-left: 3px solid #14b8a6;
  margin: 0.6em 0;
  padding: 0.4em 0 0.4em 1em;
  color: #666;
}

.simple-editor-content :deep(.tiptap pre) {
  background: #1e293b;
  color: #e2e8f0;
  border-radius: 8px;
  padding: 12px 16px;
  overflow-x: auto;
  font-size: 13px;
  margin: 0.6em 0;
}

.simple-editor-content :deep(.tiptap code) {
  background: #f1f5f9;
  border-radius: 4px;
  padding: 2px 5px;
  font-size: 0.9em;
}

.simple-editor-content :deep(.tiptap a) {
  color: #2563eb;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: text;
  pointer-events: none;
}

.simple-editor-content :deep(.tiptap pre code) {
  background: none;
  padding: 0;
}

.simple-editor-content :deep(.tiptap img) {
  max-width: 100%;
  border-radius: 8px;
  margin: 0.5em 0;
}

.simple-editor-content :deep(.tiptap hr) {
  border: none;
  border-top: 2px solid #e2e8f0;
  margin: 1em 0;
}

.link-bubble-menu {
  display: block;
}

.link-action-panel {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
  position: relative;
  z-index: 5000;
}

.link-action-btn {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #4b5563;
  font-size: 17px;
  cursor: pointer;
}

.link-action-btn:hover {
  background: #f3f4f6;
}

.link-editor-panel {
  width: 300px;
  padding: 14px 16px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
  position: relative;
  z-index: 5000;
}

.link-editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  color: #374151;
  font-size: 14px;
  font-weight: 600;
}

.link-close-btn {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #6b7280;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.link-close-btn:hover {
  background: #f3f4f6;
}

.link-editor-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
  color: #4b5563;
  font-size: 13px;
}

.link-editor-input {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  outline: none;
  font-size: 14px;
  color: #111827;
  box-sizing: border-box;
}

.link-editor-input:focus {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.12);
}

.link-editor-actions {
  display: flex;
  justify-content: flex-start;
}

.editor-dropdown-menu {
  max-height: 320px;
  overflow-y: auto;
}

.heading-dropdown-menu :deep(.el-dropdown-menu__item),
.font-size-dropdown-menu :deep(.el-dropdown-menu__item) {
  min-width: 112px;
}

.heading-option-label {
  display: inline-flex;
  align-items: center;
  min-width: 56px;
  color: #374151;
}

.heading-option-h1 {
  font-size: 32px;
  font-weight: 700;
}

.heading-option-h2 {
  font-size: 26px;
  font-weight: 700;
}

.heading-option-h3 {
  font-size: 22px;
  font-weight: 700;
}

.heading-option-h4 {
  font-size: 18px;
  font-weight: 700;
}

.heading-option-h5 {
  font-size: 16px;
  font-weight: 700;
}

.heading-option-paragraph {
  font-size: 14px;
}

:deep(.toolbar-color-picker-control) {
  position: absolute;
  inset: 0;
  opacity: 0;
}

:deep(.toolbar-color-picker-control > .el-color-picker__trigger) {
  width: 100%;
  height: 30px;
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
}

.toolbar-color-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #606266;
  line-height: 1;
}
</style>
