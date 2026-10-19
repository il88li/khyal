# مراجع تصميم CleanShot X — ملاحظات استخلاص (بدون أصول)

> **مسار:** `docs/redesign/refs/cleanshot-x/`
> **النوع:** ملاحظات نصية من **توثيق عام** (موقعي CleanShot الرسمي)، لا لقطات ولا ملفات أصول.

## ⚠️ سبب التعذّر في التنزيل عبر المهارة

تم تثبيت مهارة `refero-design` بنجاح عبر:

```bash
npx skills add https://github.com/referodesign/refero_skill
# → ./.agents/skills/refero-design   (مهارة واحدة: refero-design)
```

وقُرِأ توثيقها (`SKILL.md` + `references/mcp-tools.md`) قبل الاستعمال. المهارة تُجرِّ البحث
في المراجع عبر **Refero MCP** (`refero_search_styles` / `refero_search_screens` /
`refero_search_flows`)، وهي **غير متاحة** في هذه البيئة، والسبب مُوثَّق لا مُقدَّر:

| الفحص | النتيجة |
|---|---|
| موارد MCP في الجلسة | `[]` — لا خادم MCP مُهيَّأ أصلاً |
| استعلام مباشر لـ `https://api.refero.design/mcp` | **`401 Unauthorized`** |
| `WWW-Authenticate` المرتجع | `Bearer resource_metadata="…/.well-known/oauth-protected-resource/mcp", scope="files:read"` |
| بيانات OAuth المرتجعة | `grant_types: [authorization_code, client_credentials]` · `authorization_endpoint: /oauth/mcp_authorize` |

**الخلاصة:** نقطة MCP تتطلب توثيق OAuth بحساب Refero (دخول مستخدم عبر المتصفح)، وهو غير
ممكن من هنا دون بيانات دخول المستخدم. لذلك **لم يُنزَّل أي أصول**، وطُبِّق بديل «التوثيق
 العام» كما أُمِر، أي ملاحظات منشورة علناً عن شاشات وتدفقات وأنماط ومكوّنات CleanShot X.

> **ملاحظة تجنب:** صفحات CleanShot تحمل هويتها البصرية (أزرق `#0d44e8`، شعار، نجوم برتقالية).
> **لم يُنسخ منها أي أصل أو شعار أو لون.** المستخلص هنا **مبادئ تصميم** فقط، ولون خيال
> **يبقى `#CC1728`** وشعاره كما هو.

## الملفات

| الملف | المحتوى |
|---|---|
| `styles.md` | النمط البصري: الأسطح، العمق، الكثافة، الحركة |
| `screens.md` | الشاشات وأنماط الواجهة |
| `flows.md` | التدفقات ورحلة الإتمام |
| `components.md` | المكوّنات وأدواتها المدمجة |

## المصادر (توثيق عام)

- `https://cleanshot.com/` — الرئيسية، القيمة، الميزات المميّزة
- `https://cleanshot.com/features` — أجردة 50+ ميزة كاملة
- `https://cleanshot.com/screenshots` — تدفق اللقطات
- `https://cleanshot.com/screen-recording` — تدفق التسجيل والمحرّر

تاريخ الاطلاع: 2026-10-18.
