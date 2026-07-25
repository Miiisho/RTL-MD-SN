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

### الطريقة الأساسية: عبر githack (لا تحتاج أي إعدادات)

ملفات `dist/` مضمّنة في المستودع وتُخدَّم عبر **raw.githack.com** التي تُقدّم
صفحات HTML بنوع المحتوى الصحيح `text/html`، فلا حاجة لتفعيل GitHub Pages ولا
لأي استضافة. رابط التثبيت:

```
https://rawcdn.githack.com/Miiisho/RTL-MD-SN/6e1d01c6ffa72908e74c32099b4f9900cb1e95e7/dist/ext.json
```

> لماذا لا jsDelivr؟ لأن jsDelivr تُقدّم ملفات `.html` بنوع `text/plain`،
> فيظهر كود الصفحة كنص بدل تشغيلها. githack تحلّ هذه المشكلة.

الخطوات في Standard Notes:

1. افتح **Preferences → General → Advanced Settings** فعّل الخيارات المتقدمة،
   ثم **Install Custom Extension**.
2. الصق الرابط أعلاه واضغط **Install**.
3. افتح أي ملاحظة، ومن أيقونة تغيير المحرر (قائمة Editor) اختر
   **محرر RTL Markdown**.

> عند دفع نسخة جديدة يتغيّر معرّف الـ commit في الرابط؛ استخدم دائمًا الرابط
> المذكور هنا (المرتبط بأحدث إصدار).

### طريقة بديلة: GitHub Pages

يوجد GitHub Action في `.github/workflows/deploy.yml` ينشر مجلد `dist/` إلى
GitHub Pages. شغّله يدويًا من تبويب **Actions** بعد تفعيل Pages من
(**Settings → Pages → Source: GitHub Actions**)، ثم ثبّت عبر:

```
https://miiisho.github.io/rtl-md-sn/ext.json
```

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
