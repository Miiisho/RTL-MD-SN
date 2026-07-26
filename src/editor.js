/**
 * محرر RTL بصيغة Markdown لتطبيق Standard Notes — نمط WYSIWYG
 *
 * يعرض التنسيق مباشرةً بينما يُخزَّن المحتوى بصيغة Markdown.
 * المزايا: عريض/مائل/تحته خط/شطب، النقاط والترقيم، العناوين (H1/H2/H3) القابلة
 * للطيّ، مقسّم الصفحات، الكود، الجداول (عنوان صف أو عمود)، تبديل اتجاه الفقرة،
 * تراجع/إعادة بنظام تاريخ خاص، ومصدر Markdown.
 */

import ComponentRelay from '@standardnotes/component-relay'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import TurndownService from 'turndown'

// --------------------------------------------------------------------------
// عناصر الواجهة
// --------------------------------------------------------------------------

const editor = document.getElementById('editor')
const source = document.getElementById('source')

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

turndown.addRule('underline', {
  filter: ['u'],
  replacement: (content) => `<u>${content}</u>`,
})

turndown.addRule('strikethrough', {
  filter: ['del', 's', 'strike'],
  replacement: (content) => `~~${content}~~`,
})

// الحفاظ على الجداول كـ HTML (Markdown القياسي لا يدعم عنوان العمود)
turndown.addRule('htmlTable', {
  filter: 'table',
  replacement: (content, node) => {
    const html = node.outerHTML
      .replace(/\s*data-dir-manual="[^"]*"/g, '')
      .replace(/\s*class="[^"]*"/g, '')
      .replace(/\s*contenteditable="[^"]*"/g, '')
    return `\n\n${html}\n\n`
  },
})

// قوائم المهام: مربع الاختيار ⇄ [ ] / [x] (GFM)
turndown.addRule('taskCheckbox', {
  filter: (node) =>
    node.nodeName === 'INPUT' && node.getAttribute('type') === 'checkbox',
  replacement: (content, node) =>
    (node.checked || node.getAttribute('checked') !== null ? '[x] ' : '[ ] '),
})

function markdownToHtml(md) {
  const dirty = marked.parse(md || '', { breaks: true, gfm: true })
  return DOMPurify.sanitize(dirty, {
    ADD_TAGS: ['input'],
    ADD_ATTR: ['dir', 'scope', 'colspan', 'rowspan', 'type', 'checked', 'disabled'],
  })
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

function scheduleSave(markdown) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveNote(markdown), 350)
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
// أدوات المؤشر (لحفظ/استعادة موضع الكتابة عبر التاريخ)
// --------------------------------------------------------------------------

function getCaretOffset() {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  const range = sel.getRangeAt(0)
  if (!editor.contains(range.endContainer)) return null
  const pre = range.cloneRange()
  pre.selectNodeContents(editor)
  pre.setEnd(range.endContainer, range.endOffset)
  return pre.toString().length
}

function setCaretOffset(offset) {
  if (offset == null) {
    editor.focus()
    return
  }
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  let node
  let count = 0
  while ((node = walker.nextNode())) {
    const len = node.nodeValue.length
    if (count + len >= offset) {
      const range = document.createRange()
      range.setStart(node, Math.max(0, offset - count))
      range.collapse(true)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
      editor.focus()
      return
    }
    count += len
  }
  editor.focus()
}

// --------------------------------------------------------------------------
// نظام التاريخ (تراجع/إعادة خاص بنا)
// --------------------------------------------------------------------------

const history = { stack: [], index: -1, limit: 300 }
let recordTimer = null
let isRestoring = false

function pushHistory() {
  const snap = { html: editor.innerHTML, caret: getCaretOffset() }
  if (history.index < history.stack.length - 1) {
    history.stack = history.stack.slice(0, history.index + 1)
  }
  const last = history.stack[history.index]
  if (last && last.html === snap.html) {
    last.caret = snap.caret
    return
  }
  history.stack.push(snap)
  if (history.stack.length > history.limit) history.stack.shift()
  history.index = history.stack.length - 1
}

function scheduleRecord() {
  clearTimeout(recordTimer)
  recordTimer = setTimeout(pushHistory, 300)
}

function resetHistory() {
  clearTimeout(recordTimer)
  history.stack = [{ html: editor.innerHTML, caret: null }]
  history.index = 0
}

function restore(snap) {
  isRestoring = true
  editor.innerHTML = snap.html
  applyAutoDir()
  setCaretOffset(snap.caret)
  isRestoring = false
  const md = htmlToMarkdown(editor.innerHTML)
  source.value = md
  scheduleSave(md)
  updateToolbarState()
}

function doUndo() {
  clearTimeout(recordTimer)
  if (history.index > 0) {
    history.index--
    restore(history.stack[history.index])
  }
}

function doRedo() {
  clearTimeout(recordTimer)
  if (history.index < history.stack.length - 1) {
    history.index++
    restore(history.stack[history.index])
  }
}

// --------------------------------------------------------------------------
// الاتجاه التلقائي + التحميل + المزامنة
// --------------------------------------------------------------------------

/** اتجاه كل فقرة تلقائيًا، مع احترام الاتجاه اليدوي */
function applyAutoDir() {
  editor
    .querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre, td, th')
    .forEach((el) => {
      if (el.dataset.dirManual) return
      el.setAttribute('dir', 'auto')
    })
}

/** تجهيز مربعات قوائم المهام لتكون قابلة للنقر */
function decorateTasks() {
  editor.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.removeAttribute('disabled')
    cb.setAttribute('contenteditable', 'false')
    const li = cb.closest('li')
    if (li) li.classList.add('task-item')
  })
}

function loadMarkdownIntoEditor(md) {
  editor.innerHTML = markdownToHtml(md) || '<p><br></p>'
  applyAutoDir()
  decorateTasks()
  source.value = md || ''
  lastSavedMarkdown = md || ''
  resetHistory()
}

/** بعد أي تعديل: مزامنة المصدر + حفظ + حالة الأزرار + تسجيل في التاريخ */
function afterChange(immediate) {
  applyAutoDir()
  decorateTasks()
  const md = htmlToMarkdown(editor.innerHTML)
  source.value = md
  scheduleSave(md)
  updateToolbarState()
  if (isRestoring) return
  if (immediate) pushHistory()
  else scheduleRecord()
}

let sourceMode = false

editor.addEventListener('input', () => {
  if (sourceMode || isRestoring) return
  afterChange(false)
})

source.addEventListener('input', () => {
  if (!sourceMode) return
  scheduleSave(source.value)
})

// --------------------------------------------------------------------------
// أوامر التنسيق
// --------------------------------------------------------------------------

function exec(command, value = null) {
  editor.focus()
  document.execCommand(command, false, value)
  afterChange(true)
}

/** أقرب كتلة عليا تحتوي المؤشر */
function getCurrentBlock() {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  let node = sel.anchorNode
  if (node && node.nodeType === 3) node = node.parentNode
  while (node && node !== editor) {
    if (node.parentNode === editor) return node
    node = node.parentNode
  }
  return null
}

function currentBlockTag() {
  const b = getCurrentBlock()
  return b ? b.tagName.toLowerCase() : null
}

/** عنوان: يبدّل بين المستوى المطلوب والفقرة العادية */
function setHeading(level) {
  editor.focus()
  const tag = 'h' + level
  const isSame = currentBlockTag() === tag
  document.execCommand('formatBlock', false, isSame ? '<p>' : '<' + tag + '>')
  afterChange(true)
}

/** تبديل اتجاه الفقرة الحالية يدويًا (RTL ↔ LTR) */
function toggleDir() {
  editor.focus()
  const block = getCurrentBlock()
  if (!block) return
  const resolved = getComputedStyle(block).direction
  const next = resolved === 'rtl' ? 'ltr' : 'rtl'
  block.setAttribute('dir', next)
  block.dataset.dirManual = '1'
  afterChange(true)
}

/** كود مضمّن أو كتلة حسب التحديد */
function insertCode() {
  editor.focus()
  const sel = window.getSelection()
  const text = sel && sel.toString()
  if (text && !text.includes('\n')) {
    document.execCommand('insertHTML', false, `<code>${escapeHtml(text)}</code>`)
  } else {
    const content = escapeHtml(text || 'الكود هنا')
    document.execCommand('insertHTML', false, `<pre><code>${content}</code></pre><p><br></p>`)
  }
  afterChange(true)
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// --------------------------------------------------------------------------
// الجداول
// --------------------------------------------------------------------------

function buildTable(rows, cols, header) {
  let html = '<table>'
  for (let r = 0; r < rows; r++) {
    html += '<tr>'
    for (let c = 0; c < cols; c++) {
      const isHeader =
        (header === 'row' && r === 0) || (header === 'column' && c === 0)
      const tag = isHeader ? 'th' : 'td'
      const scope =
        header === 'row' && r === 0
          ? ' scope="col"'
          : header === 'column' && c === 0
            ? ' scope="row"'
            : ''
      const txt = isHeader ? 'عنوان' : '&nbsp;'
      html += `<${tag}${scope} dir="auto">${txt}</${tag}>`
    }
    html += '</tr>'
  }
  html += '</table>'
  return html
}

function insertTable(rows, cols, header) {
  editor.focus()
  document.execCommand('insertHTML', false, buildTable(rows, cols, header) + '<p><br></p>')
  afterChange(true)
}

// --------------------------------------------------------------------------
// التحكم بالجدول بعد إنشائه
// --------------------------------------------------------------------------

const tableTools = document.getElementById('table-tools')
let activeCell = null

function getCellFromSelection() {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  let node = sel.anchorNode
  if (node && node.nodeType === 3) node = node.parentNode
  return node && node.closest ? node.closest('td, th') : null
}

/** إظهار/إخفاء شريط أدوات الجدول حسب موضع المؤشر */
function updateTableTools() {
  if (!tableTools) return
  const cell = getCellFromSelection()
  if (!cell || !editor.contains(cell)) {
    tableTools.classList.remove('open')
    activeCell = null
    return
  }
  activeCell = cell
  const table = cell.closest('table')
  const rect = table.getBoundingClientRect()
  tableTools.style.top = Math.max(4, rect.top - 44) + 'px'
  tableTools.style.left = Math.min(rect.left, window.innerWidth - tableTools.offsetWidth - 8) + 'px'
  tableTools.classList.add('open')
}

function cellIndex(cell) {
  return Array.prototype.indexOf.call(cell.parentNode.children, cell)
}

function makeCell(sample) {
  const el = document.createElement(sample && sample.tagName === 'TH' ? 'td' : 'td')
  el.setAttribute('dir', 'auto')
  el.innerHTML = '&nbsp;'
  return el
}

function tableAddRow() {
  if (!activeCell) return
  const row = activeCell.closest('tr')
  const cols = row.children.length
  const nr = document.createElement('tr')
  for (let i = 0; i < cols; i++) nr.appendChild(makeCell())
  row.after(nr)
  afterChange(true)
}

function tableAddCol() {
  if (!activeCell) return
  const table = activeCell.closest('table')
  const idx = cellIndex(activeCell)
  table.querySelectorAll('tr').forEach((tr) => {
    const ref = tr.children[idx]
    const cell = makeCell()
    if (ref) ref.after(cell)
    else tr.appendChild(cell)
  })
  afterChange(true)
}

function tableDelRow() {
  if (!activeCell) return
  const table = activeCell.closest('table')
  if (table.querySelectorAll('tr').length <= 1) return tableDelTable()
  activeCell.closest('tr').remove()
  afterChange(true)
}

function tableDelCol() {
  if (!activeCell) return
  const table = activeCell.closest('table')
  const idx = cellIndex(activeCell)
  const firstRowCells = table.querySelector('tr').children.length
  if (firstRowCells <= 1) return tableDelTable()
  table.querySelectorAll('tr').forEach((tr) => {
    if (tr.children[idx]) tr.children[idx].remove()
  })
  afterChange(true)
}

function tableDelTable() {
  if (!activeCell) return
  const table = activeCell.closest('table')
  activeCell = null
  table.remove()
  if (tableTools) tableTools.classList.remove('open')
  afterChange(true)
}

if (tableTools) {
  const map = {
    'add-row': tableAddRow,
    'add-col': tableAddCol,
    'del-row': tableDelRow,
    'del-col': tableDelCol,
    'del-table': tableDelTable,
  }
  tableTools.querySelectorAll('[data-tt]').forEach((b) => {
    b.addEventListener('pointerdown', (e) => e.preventDefault())
    b.addEventListener('mousedown', (e) => e.preventDefault())
    b.addEventListener('click', (e) => {
      e.preventDefault()
      const fn = map[b.dataset.tt]
      if (fn) fn()
    })
  })
}

// --------------------------------------------------------------------------
// قائمة المهام (To-Do)
// --------------------------------------------------------------------------

function insertTaskList() {
  editor.focus()
  document.execCommand(
    'insertHTML',
    false,
    '<ul class="task-list"><li class="task-item" dir="auto"><input type="checkbox" contenteditable="false"> مهمة</li></ul><p><br></p>'
  )
  afterChange(true)
}

// النقر على المربع يبدّل حالته
editor.addEventListener('click', (e) => {
  const cb = e.target
  if (cb && cb.nodeName === 'INPUT' && cb.getAttribute('type') === 'checkbox') {
    const checked = cb.getAttribute('checked') === null
    if (checked) cb.setAttribute('checked', '')
    else cb.removeAttribute('checked')
    cb.checked = checked
    afterChange(true)
  }
})

// Enter داخل عنصر مهمة يُنشئ مهمة جديدة بمربع
editor.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return
  let node = sel.anchorNode
  if (node && node.nodeType === 3) node = node.parentNode
  const li = node && node.closest ? node.closest('li.task-item') : null
  if (!li) return
  e.preventDefault()
  const empty = li.textContent.trim() === ''
  if (empty) {
    // عنصر فارغ: أنهِ القائمة بفقرة عادية
    const p = document.createElement('p')
    p.setAttribute('dir', 'auto')
    p.innerHTML = '<br>'
    li.closest('ul').after(p)
    li.remove()
    placeCaretAtStart(p)
  } else {
    const nli = document.createElement('li')
    nli.className = 'task-item'
    nli.setAttribute('dir', 'auto')
    nli.innerHTML = '<input type="checkbox" contenteditable="false">&nbsp;'
    li.after(nli)
    placeCaretAtEnd(nli)
  }
  afterChange(true)
})

function placeCaretAtStart(el) {
  const r = document.createRange()
  r.selectNodeContents(el)
  r.collapse(true)
  const s = window.getSelection()
  s.removeAllRanges()
  s.addRange(r)
}
function placeCaretAtEnd(el) {
  const r = document.createRange()
  r.selectNodeContents(el)
  r.collapse(false)
  const s = window.getSelection()
  s.removeAllRanges()
  s.addRange(r)
}

// --------------------------------------------------------------------------
// العناوين القابلة للطيّ (Toggle)
// --------------------------------------------------------------------------

function toggleFold(h) {
  const collapsed = h.classList.toggle('collapsed')
  const level = +h.tagName[1]
  let el = h.nextElementSibling
  while (el) {
    if (/^H[1-6]$/.test(el.tagName) && +el.tagName[1] <= level) break
    el.classList.toggle('folded-hidden', collapsed)
    el = el.nextElementSibling
  }
}

// النقر على منطقة السهم في أول العنوان يطوي/يفتح ما تحته
editor.addEventListener('click', (e) => {
  const h = e.target.closest && e.target.closest('h1, h2, h3')
  if (!h || !editor.contains(h)) return
  const isRTL = getComputedStyle(h).direction === 'rtl'
  const rect = h.getBoundingClientRect()
  const zone = 26
  const inZone = isRTL ? e.clientX > rect.right - zone : e.clientX < rect.left + zone
  if (!inZone) return
  e.preventDefault()
  toggleFold(h)
})

// --------------------------------------------------------------------------
// ربط أزرار شريط الأدوات
// --------------------------------------------------------------------------

const actions = {
  bold: () => exec('bold'),
  italic: () => exec('italic'),
  underline: () => exec('underline'),
  strike: () => exec('strikeThrough'),
  h1: () => setHeading(1),
  h2: () => setHeading(2),
  h3: () => setHeading(3),
  bullet: () => exec('insertUnorderedList'),
  ordered: () => exec('insertOrderedList'),
  task: insertTaskList,
  divider: () => exec('insertHorizontalRule'),
  code: insertCode,
  dir: toggleDir,
  table: () => openTablePopover(),
  undo: doUndo,
  redo: doRedo,
}

document.querySelectorAll('[data-action]').forEach((btn) => {
  btn.addEventListener('pointerdown', (e) => e.preventDefault())
  btn.addEventListener('mousedown', (e) => e.preventDefault())
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    const fn = actions[btn.dataset.action]
    if (fn) fn()
  })
})

// --------------------------------------------------------------------------
// إبراز الأزرار النشطة
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
  const tag = currentBlockTag()
  document.querySelectorAll('[data-action]').forEach((btn) => {
    const action = btn.dataset.action
    const cmd = stateMap[action]
    if (cmd) {
      let active = false
      try {
        active = document.queryCommandState(cmd)
      } catch (_) {}
      btn.classList.toggle('is-active', active)
    } else if (action === 'h1' || action === 'h2' || action === 'h3') {
      btn.classList.toggle('is-active', tag === action)
    }
  })
}

document.addEventListener('selectionchange', () => {
  if (sourceMode) return
  updateToolbarState()
  updateTableTools()
})

// --------------------------------------------------------------------------
// اختصارات لوحة المفاتيح
// --------------------------------------------------------------------------

editor.addEventListener('keydown', (e) => {
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
  } else if (key === 'z' && !e.shiftKey) {
    e.preventDefault()
    doUndo()
  } else if ((key === 'z' && e.shiftKey) || key === 'y') {
    e.preventDefault()
    doRedo()
  }
})

// --------------------------------------------------------------------------
// نافذة إدراج الجدول
// --------------------------------------------------------------------------

const popover = document.getElementById('table-popover')
let popoverHeader = 'row'

function openTablePopover() {
  if (!popover) return
  popover.classList.toggle('open')
}

if (popover) {
  popover.querySelectorAll('[data-header]').forEach((b) => {
    b.addEventListener('click', () => {
      popoverHeader = b.dataset.header
      popover.querySelectorAll('[data-header]').forEach((x) => x.classList.remove('sel'))
      b.classList.add('sel')
    })
  })
  const insertBtn = popover.querySelector('#table-insert')
  if (insertBtn) {
    insertBtn.addEventListener('click', () => {
      const rows = Math.min(20, Math.max(1, +popover.querySelector('#table-rows').value || 2))
      const cols = Math.min(10, Math.max(1, +popover.querySelector('#table-cols').value || 2))
      insertTable(rows, cols, popoverHeader)
      popover.classList.remove('open')
    })
  }
  const closeBtn = popover.querySelector('#table-close')
  if (closeBtn) closeBtn.addEventListener('click', () => popover.classList.remove('open'))
}

// --------------------------------------------------------------------------
// زر مصدر Markdown
// --------------------------------------------------------------------------

const toggleBtn = document.getElementById('toggle-source')
if (toggleBtn) {
  toggleBtn.addEventListener('pointerdown', (e) => e.preventDefault())
  toggleBtn.addEventListener('click', () => {
    sourceMode = !sourceMode
    document.body.classList.toggle('source-mode', sourceMode)
    toggleBtn.classList.toggle('is-active', sourceMode)
    if (sourceMode) {
      source.value = htmlToMarkdown(editor.innerHTML)
    } else {
      loadMarkdownIntoEditor(source.value)
      lastSavedMarkdown = source.value
    }
  })
}

// تحميل مبدئي
loadMarkdownIntoEditor('')
