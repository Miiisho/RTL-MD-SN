# محرر RTL Markdown لتطبيق Standard Notes

إضافة (Editor) لتطبيق **Standard Notes** تجعل الملاحظة تُكتب من اليمين إلى اليسار
(RTL) بصيغة **Markdown**، مع شريط أدوات كامل ومعاينة حيّة.

## المزايا

| الزر | الوظيفة | ناتج الـ Markdown |
| --- | --- | --- |
| **B** | نص عريض | `**نص**` |
| *I* | نص مائل | `*نص*` |
| <u>U</u> | تحته خط | `<u>نص</u>` |
| • ≡ | قائمة نقطية (النقاط) | `- عنصر` |
| 1. ≡ | قائمة مرقّمة (الترقيم) | `1. عنصر` |
| — | مقسّم الصفحات | `---` |
| `</>` | كود (مضمّن أو كتلة) | `` `كود` `` أو ```` ``` ```` |
| ↩ | العودة للوراء (تراجع) | — |
| 👁 | إظهار/إخفاء المعاينة | — |

- **كتابة RTL** كاملة في المحرر والمعاينة.
- **اختصارات لوحة المفاتيح**: `Ctrl/⌘ + B` عريض، `+ I` مائل، `+ U` تحته خط.
- **معاينة حيّة** للـ Markdown بجانب النص (تُخفى تلقائيًا على الشاشات الضيّقة).
- **حفظ تلقائي** داخل Standard Notes عبر واجهة المكوّنات الرسمية.
- **تنقية HTML** بواسطة DOMPurify لمنع أي محتوى ضار في المعاينة.

## البناء محليًا

```bash
npm install
npm run build      # يُنتج مجلد dist/ قائم بذاته (index.html + editor.js + editor.css + ext.json)
npm run serve      # بناء + خادم محلي على http://localhost:8080 للتجربة
```

مجلد `dist/` يحوي كل ما يلزم لاستضافة الإضافة (لا اعتماديات خارجية وقت التشغيل).

## التثبيت في Standard Notes

الإضافة تُثبَّت عبر رابط `ext.json`. لديك طريقتان:

### 1) استضافة عبر GitHub Pages (مؤتمت)

يوجد GitHub Action في `.github/workflows/deploy.yml` ينشر مجلد `dist/` تلقائيًا
إلى GitHub Pages عند كل دفع. بعد تفعيل Pages من إعدادات المستودع
(**Settings → Pages → Source: GitHub Actions**)، سيصبح الرابط:

```
https://miiisho.github.io/rtl-md-sn/ext.json
```

ثم في Standard Notes:

1. افتح **Preferences → Advanced Settings → Install Custom Extension**
   (يلزم تفعيل الوضع المتقدّم بالنقر على «Advanced» في أسفل الإعدادات).
2. الصق رابط `ext.json` أعلاه واضغط **Install**.
3. افتح أي ملاحظة، ومن قائمة تغيير المحرر (أيقونة القلم) اختر **محرر RTL Markdown**.

### 2) استضافة على أي خادم آخر

ارفع محتوى مجلد `dist/` إلى أي استضافة ثابتة (Netlify، Vercel، خادمك الخاص…)،
ثم عدّل الحقول `url` و`latest_url` في `ext.json` لتشير إلى موقعك، وثبّت عبر رابط
`ext.json` كما في الطريقة الأولى.

> ملاحظة: يفضّل Standard Notes استضافة الإضافات عبر HTTPS.

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
