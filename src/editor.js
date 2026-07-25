/**
 * محرر RTL بصيغة Markdown لتطبيق Standard Notes — نمط WYSIWYG
 *
 * يعرض التنسيق مباشرةً (نقاط فعلية، نص عريض، كود منسّق…) بلا رموز خام،
 * بينما يُخزّن المحتوى في الملاحظة بصيغة Markdown.
 *
 * شريط الأدوات: عريض (B) / مائل (I) / تحته خط (U)، النقاط، الترقيم،
 * مقسّم الصفحات، الكود، التراجع (العودة للوراء)، وزر إظهار مصدر Markdown.
 */

import ComponentRelay from '@standardnotes/component-relay'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import TurndownService from 'turndown'

// --------------------------------------------------------------------------
// عناصر الواجهة
// --------------------------------------------------------------------------

const editor = document.getElementById('editor') // contenteditable (WYSIWYG)
const source = document.getElementById('source') // textarea (مصدر Markdown)

// --------------------------------------------------------------------------
// محوّلات Markdown ⇄ HTML
// --------------------------------------------------------------------------

const turndown = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
})

// الإبقاء على <u> (لا يوجد له مقابل في Markdown القياسي)
turndown.addRule('underline', {
  filter: ['u'],
  replacement: (content) => `<u>${content}</u>`,
})

// شطب النص ~~ (GitHub Flavored Markdown)
turndown.addRule('strikethrough', {
  filter: ['del', 's', 'strike'],
  replacement: (content) => `~~${content}~~`,
})

function markdownToHtml(md) {
  const dirty = marked.parse(md || '', { breaks: true, gfm: true })
  return DOMPurify.sanitize(dirty, { ADD_ATTR: ['dir'] })
}

function htmlToMarkdown(html) {
  return turndown.turndown(html || '').trim()
}

// --------------------------------------------------------------------------
// جسر التواصل مع Standard Notes
// --------------------------------------------------------------------------

let workingNote = null
let componentRelay = null
let lastSavedMarkdown = null
let saveTimer = null

function saveNote(markdown) {
  if (!componentRelay || !workingNote) return
  if (markdown === lastSavedMarkdown) return
  lastSavedMarkdown = markdown
  componentRelay.saveItemWithPresave(workingNote, () => {
    workingNote.content.text = markdown
  })
}

/** جدولة حفظ مؤجّل لتقليل عدد عمليات الكتابة */
function scheduleSave(markdown) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveNote(markdown), 350)
}

/** ضبط اتجاه كل فقرة تلقائيًا (RTL للعربية، LTR للإنجليزية) */
function applyAutoDir() {
  editor
    .querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre')
    .forEach((el) => el.setAttribute('dir', 'auto'))
}

function loadMarkdownIntoEditor(md) {
  editor.innerHTML = markdownToHtml(md) || '<p><br></p>'
  applyAutoDir()
  source.value = md || ''
  lastSavedMarkdown = md || ''
}

function initComponentRelay() {
  componentRelay = new ComponentRelay({
    initialPermissions: [{ name: 'stream-context-item' }],
    targetWindow: window,
    onReady: () => {
      document.documentElement.classList.add('sn-ready')
      const platform = componentRelay.platform
      if (platform) document.body.setAttribute('data-platform', platform)
    },
  })

  componentRelay.streamContextItem((note) => {
    if (!note) return
    workingNote = note
    if (note.isMetadataUpdate) return
    const incoming = note.content.text || ''
    // لا نعيد التحميل إذا كان النص هو نفسه الذي كتبناه للتوّ (تجنّب فقدان المؤشر)
    if (incoming !== lastSavedMarkdown) {
      loadMarkdownIntoEditor(incoming)
    }
  })
}

try {
  initComponentRelay()
} catch (e) {
  console.warn('Component relay unavailable, running standalone:', e)
}

// --------------------------------------------------------------------------
// المزامنة عند التحرير
// --------------------------------------------------------------------------

let sourceMode = false

editor.addEventListener('input', () => {
  if (sourceMode) return
  applyAutoDir()
  const md = htmlToMarkdown(editor.innerHTML)
  source.value = md
  scheduleSave(md)
  updateToolbarState()
})

source.addEventListener('input', () => {
  if (!sourceMode) return
  scheduleSave(source.value)
})

// --------------------------------------------------------------------------
// أوامر شريط الأدوات
// --------------------------------------------------------------------------

function exec(command, value = null) {
  editor.focus()
  document.execCommand(command, false, value)
  applyAutoDir()
  const md = htmlToMarkdown(editor.innerHTML)
  source.value = md
  scheduleSave(md)
  updateToolbarState()
}

/** إدراج كتلة/سطر كود حسب التحديد */
function insertCode() {
  editor.focus()
  const sel = window.getSelection()
  const text = sel && sel.toString()
  if (text && !text.includes('\n')) {
    // كود مضمّن
    document.execCommand('insertHTML', false, `<code>${escapeHtml(text)}</code>`)
  } else {
    // كتلة كود
    const content = escapeHtml(text || 'الكود هنا')
    document.execCommand('insertHTML', false, `<pre><code>${content}</code></pre><p><br></p>`)
  }
  const md = htmlToMarkdown(editor.innerHTML)
  source.value = md
  scheduleSave(md)
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const actions = {
  bold: () => exec('bold'),
  italic: () => exec('italic'),
  underline: () => exec('underline'),
  strike: () => exec('strikeThrough'),
  bullet: () => exec('insertUnorderedList'),
  ordered: () => exec('insertOrderedList'),
  divider: () => exec('insertHorizontalRule'),
  code: insertCode,
  undo: () => exec('undo'),
  redo: () => exec('redo'),
}

document.querySelectorAll('[data-action]').forEach((btn) => {
  // منع فقدان التحديد عند الضغط (يعمل للفأرة واللمس)
  btn.addEventListener('pointerdown', (e) => e.preventDefault())
  btn.addEventListener('mousedown', (e) => e.preventDefault())
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    const fn = actions[btn.dataset.action]
    if (fn) fn()
  })
})

// --------------------------------------------------------------------------
// إبراز الأزرار النشطة حسب موضع المؤشر
// --------------------------------------------------------------------------

const stateMap = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strike: 'strikeThrough',
  bullet: 'insertUnorderedList',
  ordered: 'insertOrderedList',
}

function updateToolbarState() {
  document.querySelectorAll('[data-action]').forEach((btn) => {
    const cmd = stateMap[btn.dataset.action]
    if (!cmd) return
    let active = false
    try {
      active = document.queryCommandState(cmd)
    } catch (_) {}
    btn.classList.toggle('is-active', active)
  })
}

document.addEventListener('selectionchange', () => {
  if (!sourceMode) updateToolbarState()
})

// --------------------------------------------------------------------------
// زر إظهار/إخفاء مصدر Markdown
// --------------------------------------------------------------------------

const toggleBtn = document.getElementById('toggle-source')
if (toggleBtn) {
  toggleBtn.addEventListener('pointerdown', (e) => e.preventDefault())
  toggleBtn.addEventListener('click', () => {
    sourceMode = !sourceMode
    document.body.classList.toggle('source-mode', sourceMode)
    toggleBtn.classList.toggle('is-active', sourceMode)
    if (sourceMode) {
      // WYSIWYG → مصدر
      source.value = htmlToMarkdown(editor.innerHTML)
    } else {
      // مصدر → WYSIWYG
      loadMarkdownIntoEditor(source.value)
      lastSavedMarkdown = source.value // منع إعادة تحميل غير ضرورية
    }
  })
}

// تحميل مبدئي (وضع مستقل للتجربة)
loadMarkdownIntoEditor('')
