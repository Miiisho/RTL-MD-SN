# محرر RTL Markdown لتطبيق Standard Notes

محرر **WYSIWYG** لتطبيق **Standard Notes**: ترى التنسيق مباشرةً أثناء الكتابة
(نقاط فعلية، عريض، كود منسّق…) بينما يُخزَّن المحتوى بصيغة **Markdown**. يدعم
الكتابة من اليمين إلى اليسار مع تحويل تلقائي لاتجاه الأسطر الإنجليزية إلى LTR.

## المزايا

| الزر | الوظيفة | ناتج الـ Markdown |
| --- | --- | --- |
| **B** | نص عريض | `**نص**` |
| *I* | نص مائل | `*نص*` |
| <u>U</u> | تحته خط | `<u>نص</u>` |
| ~~S~~ | شطب النص | `~~نص~~` |
| النقاط | قائمة نقطية | `- عنصر` |
| الترقيم | قائمة مرقّمة | `1. عنصر` |
| — | مقسّم الصفحات | `---` |
| `</>` | كود (مضمّن أو كتلة) | `` `كود` `` أو ```` ``` ```` |
| ↩ | تراجع (العودة للوراء) | — |
| ↷ | إعادة (Redo) | — |
| `>_` | إظهار مصدر Markdown | — |

- **WYSIWYG**: التنسيق يظهر مباشرةً بلا رموز خام.
- **اتجاه تلقائي**: كل فقرة تأخذ اتجاهها حسب لغتها (`dir="auto"`) — RTL للعربية وLTR للإنجليزية.
- **يتبع ثيم Standard Notes**: الألوان مربوطة بمتغيّرات StyleKit (فاتح/داكن/مخصّص)، لا بوضع نظام الهاتف.
- **اختصارات لوحة المفاتيح**: `Ctrl/⌘ + B` عريض، `+ I` مائل، `+ U` تحته خط.
- **حفظ تلقائي** داخل Standard Notes عبر واجهة المكوّنات الرسمية.
- **تنقية HTML** بواسطة DOMPurify. التخزين Markdown عبر `marked` (MD→HTML) و`turndown` (HTML→MD).

## البناء محليًا

```bash
npm install
npm run build      # يُنتج مجلد dist/ قائم بذاته (index.html + editor.js + editor.css + ext.json)
npm run serve      # بناء + خادم محلي على http://localhost:8080 للتجربة
```

مجلد `dist/` يحوي كل ما يلزم لاستضافة الإضافة (لا اعتماديات خارجية وقت التشغيل).

## التثبيت في Standard Notes

### الطريقة الأساسية: GitHub Pages (رابط ثابت)

يوجد GitHub Action في `.github/workflows/deploy.yml` ينشر مجلد `dist/` تلقائيًا
إلى GitHub Pages عند كل دفع (بعد تفعيل Pages من
**Settings → Pages → Source: GitHub Actions**). رابط التثبيت الثابت:

```
https://miiisho.github.io/RTL-MD-SN/ext.json
```

الخطوات في Standard Notes:

1. افتح **Preferences → General → Advanced Settings** فعّل الخيارات المتقدمة،
   ثم **Install Custom Extension**.
2. الصق الرابط أعلاه واضغط **Install**.
3. افتح أي ملاحظة، ومن أيقونة تغيير المحرر (قائمة Editor) اختر
   **محرر RTL Markdown**.

> هذا الرابط **ثابت** ولا يتغيّر مع التحديثات؛ كل دفع جديد يُحدّث المحتوى في
> نفس الرابط تلقائيًا.

### طريقة بديلة: أي استضافة ثابتة أخرى

ارفع محتوى مجلد `dist/` إلى Netlify أو Vercel أو خادمك، وعدّل `url` و`latest_url`
في `ext.json` لتشير إلى موقعك، ثم ثبّت عبر رابط `ext.json`.

> يفضّل Standard Notes استضافة الإضافات عبر HTTPS.

## البنية

```
├── public/
│   ├── index.html      # واجهة المحرر وشريط الأدوات (dir="rtl")
│   └── editor.css      # التنسيق (مع دعم الوضع الداكن)
├── src/
│   └── editor.js       # منطق المحرر + جسر التواصل مع Standard Notes
├── build.mjs           # سكربت الحزم (esbuild) → dist/
├── ext.json            # واصف الإضافة لتثبيتها في Standard Notes
└── .github/workflows/deploy.yml   # نشر تلقائي إلى GitHub Pages
```

## كيف يعمل

- يستخدم `@standardnotes/component-relay` للتخاطب مع تطبيق Standard Notes:
  يستقبل نص الملاحظة عبر `streamContextItem` ويحفظ التعديلات عبر
  `saveItemWithPresave`.
- يُحوَّل نص Markdown إلى HTML للمعاينة بواسطة `marked` ثم يُنقّى بـ `DOMPurify`.
- عند تشغيله خارج Standard Notes (فتح `index.html` مباشرة) يعمل في وضع محلي
  للتجربة دون حفظ.
