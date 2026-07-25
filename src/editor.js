/**
 * محرر RTL بصيغة Markdown لتطبيق Standard Notes
 * RTL Markdown editor plugin for Standard Notes
 *
 * يوفّر:
 *  - كتابة من اليمين إلى اليسار (RTL)
 *  - شريط أدوات: عريض (B) / مائل (I) / تحته خط (U)
 *  - النقاط (قائمة نقطية) والترقيم (قائمة مرقمة)
 *  - مقسّم الصفحات (خط أفقي)
 *  - زر العودة للوراء (تراجع)
 *  - زر الكود (كود مضمّن / كتلة كود)
 *  - معاينة حيّة للـ Markdown
 */

import ComponentRelay from '@standardnotes/component-relay'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

// --------------------------------------------------------------------------
// إعداد جسر التواصل مع تطبيق Standard Notes
// --------------------------------------------------------------------------

let workingNote = null
let componentRelay = null
let lastValue = null
let ignoreNextChange = false

const textarea = document.getElementById('editor')
const preview = document.getElementById('preview')
const status = document.getElementById('status')

/** حفظ نص الملاحظة في Standard Notes */
function saveNote(text) {
  if (!componentRelay || !workingNote) return
  componentRelay.saveItemWithPresave(workingNote, () => {
    workingNote.content.text = text
  })
}

/** إعادة رسم المعاينة الحيّة من الـ Markdown */
function renderPreview(text) {
  const dirty = marked.parse(text || '', { breaks: true, gfm: true })
  preview.innerHTML = DOMPurify.sanitize(dirty, { ADD_ATTR: ['dir'] })
}

/** ضبط قيمة المحرر (من التطبيق) دون إطلاق حفظ عكسي */
function setEditorValue(text) {
  ignoreNextChange = true
  textarea.value = text || ''
  lastValue = textarea.value
  renderPreview(textarea.value)
}

/** يُستدعى عند تغيير المستخدم للنص */
function onInput() {
  if (ignoreNextChange) {
    ignoreNextChange = false
    return
  }
  const text = textarea.value
  if (text === lastValue) return
  lastValue = text
  renderPreview(text)
  saveNote(text)
}

textarea.addEventListener('input', onInput)

function initComponentRelay() {
  componentRelay = new ComponentRelay({
    initialPermissions: [
      { name: 'stream-context-item' },
    ],
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

    // منع تكرار الحفظ إذا كان التحديث قادمًا من نفس المحرر
    if (note.isMetadataUpdate) return

    const incoming = note.content.text || ''
    if (incoming !== textarea.value) {
      setEditorValue(incoming)
    }
    setStatus('')
  })
}

function setStatus(msg) {
  if (status) status.textContent = msg
}

// إن لم نكن داخل Standard Notes (تشغيل مستقل للتجربة) نعمل بوضع محلي
try {
  initComponentRelay()
} catch (e) {
  console.warn('Component relay unavailable, running standalone:', e)
}

// --------------------------------------------------------------------------
// أدوات تحرير الـ Markdown (شريط الأدوات)
// --------------------------------------------------------------------------

/** إدراج/تغليف النص المحدد بعلامات markdown */
function wrapSelection(before, after = before, placeholder = '') {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value
  const selected = value.slice(start, end) || placeholder

  const newText = value.slice(0, start) + before + selected + after + value.slice(end)
  textarea.value = newText

  // إعادة ضبط التحديد داخل الغلاف
  const selStart = start + before.length
  textarea.selectionStart = selStart
  textarea.selectionEnd = selStart + selected.length
  textarea.focus()
  fireInput()
}

/** إضافة بادئة لكل سطر محدد (للقوائم والاقتباس) */
function prefixLines(makePrefix) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value

  // توسيع التحديد ليشمل الأسطر كاملة
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  let lineEnd = value.indexOf('\n', end)
  if (lineEnd === -1) lineEnd = value.length

  const block = value.slice(lineStart, lineEnd)
  const lines = block.split('\n')
  const transformed = lines.map((line, i) => makePrefix(line, i)).join('\n')

  textarea.value = value.slice(0, lineStart) + transformed + value.slice(lineEnd)
  textarea.selectionStart = lineStart
  textarea.selectionEnd = lineStart + transformed.length
  textarea.focus()
  fireInput()
}

/** إدراج نص في موضع المؤشر */
function insertAtCursor(text) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value
  textarea.value = value.slice(0, start) + text + value.slice(end)
  const pos = start + text.length
  textarea.selectionStart = textarea.selectionEnd = pos
  textarea.focus()
  fireInput()
}

/** إطلاق حدث input يدويًا بعد تعديل برمجي */
function fireInput() {
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

const actions = {
  bold: () => wrapSelection('**', '**', 'نص عريض'),
  italic: () => wrapSelection('*', '*', 'نص مائل'),
  // Markdown لا يدعم underline أصلاً، نستخدم HTML المضمّن
  underline: () => wrapSelection('<u>', '</u>', 'نص تحته خط'),
  bullet: () => prefixLines((line) => (line.trim() ? `- ${line.replace(/^[-*]\s+/, '')}` : line)),
  ordered: () =>
    prefixLines((line, i) => (line.trim() ? `${i + 1}. ${line.replace(/^\d+\.\s+/, '')}` : line)),
  divider: () => insertAtCursor('\n\n---\n\n'),
  code: () => {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = textarea.value.slice(start, end)
    if (selected.includes('\n') || selected === '') {
      // كتلة كود متعددة الأسطر
      wrapSelection('\n```\n', '\n```\n', 'الكود هنا')
    } else {
      // كود مضمّن
      wrapSelection('`', '`', 'كود')
    }
  },
  undo: () => {
    textarea.focus()
    document.execCommand('undo')
    fireInput()
  },
}

document.querySelectorAll('[data-action]').forEach((btn) => {
  btn.addEventListener('mousedown', (e) => e.preventDefault()) // إبقاء التركيز على المحرر
  btn.addEventListener('click', () => {
    const action = actions[btn.dataset.action]
    if (action) action()
  })
})

// اختصارات لوحة المفاتيح المألوفة
textarea.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey
  if (!mod) return
  const key = e.key.toLowerCase()
  if (key === 'b') {
    e.preventDefault()
    actions.bold()
  } else if (key === 'i') {
    e.preventDefault()
    actions.italic()
  } else if (key === 'u') {
    e.preventDefault()
    actions.underline()
  }
})

// زر إظهار/إخفاء المعاينة
const toggleBtn = document.getElementById('toggle-preview')
if (toggleBtn) {
  toggleBtn.addEventListener('mousedown', (e) => e.preventDefault())
  toggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('preview-hidden')
  })
}

// معاينة أولية فارغة
renderPreview('')
