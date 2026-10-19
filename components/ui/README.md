# مكتبة خيال الموحّدة · `components/ui`

المرجع التنفيذي للغة البصرية المعتمدة في `docs/redesign/vision.md` (اتجاه «الاستوديو الهادئ»).
كل ما هنا مبنيّ على الرموز في `app/tokens.css` — لا قيم لونية أو مدد مكتوبة يدوياً داخل المكوّنات.

## الاستيراد

```ts
import { Button, Card } from "@/components/kit";                 // مكوّنات قابلة للتركيب
import { LogoMark, haptic, useReducedMotion, BRAND } from "@/components/ui";
import { BottomSheet, EmptyState, Skeleton } from "@/components/ui";
```

استورد من `@/components/ui` (نقطة واحدة) أو من وحدات فرعية عند الحاجة:
`@/components/ui/tokens` · `@/components/ui/motion` · `@/components/ui/LogoMark` ·
`@/components/ui/overlays` · `@/components/ui/elastic-reel` … إلخ.

## البنية

| الوحدة | الدور |
| --- | --- |
| `tokens.ts` | مرآة TypeScript لرموز `app/tokens.css` (ألوان، طباعة، مسافات، أشكال، ارتفاع، أيقونات). |
| `motion.ts` | فلسفة الحركة: مدد، تباطؤ، زنبرك، نماذج، تقليل الحركة، اهتزاز وأصوات اختيارية. |
| `LogoMark.tsx` | فرشاة الشعار المصغّرة بحالاتها: `welcome · loading · empty · success · error`. |
| `overlays.tsx` | الطبقات: `BottomSheet · Modal · Toaster · Lightbox · Gallery · Comments · Splash · VarsSheet`. |
| `states.tsx` → `../states` | `Skeleton · EmptyState · ErrorState · SafeImg`. |
| `../kit` | الأزرار والبطاقات والحقول والتبويبات والتنبيهات. |
| `elastic-reel · fuzzy-text · vapor-type` | مؤثرات قديمة — **مهجورة**: لا تُستخدم في الشاشات الجديدة (زخرفة بلا وظيفة). |

## الرموز

المصدر `app/tokens.css`. النسخة الرقمية في `tokens.ts` للاستخدام داخل JavaScript.

- **الهوية**: الأحمر `#CC1728` ثابت في الوضعين، والأساس الداكن `#121212`. لا بنفسجي ولا وردي.
- **الألوان**: عبر صفوف Tailwind (`text-charcoal`، `bg-snow`، `text-brand`…) أو `rgb(var(--c-*))` في CSS.
- **الطباعة**: `micro 11 · caption 12 · sm 13 · base 15 · lg 17 · xl 20 · 2xl 24 · 3xl 32`، وارتفاعات أسطر أطول من اللاتينية لاستيعاب التشكيل.
- **المسافات**: مضاعفات 4، مع أسماء دلالية (`card`، `section`).
- **الأشكال**: زر حبّة · حقل `14` · بطاقة `20` · ورقة `24`.
- **الظلال**: للارتفاع فقط ومحايدة بلا ألوان — `elev-1` مرتفع قليلاً، `elev-2` عائم، `elev-3` نافذة/قائمة. لا توهّج.

## الأيقونات

شبكة `24px` وسماكة خطية `1.5px` (عبر `components/icons.tsx` المبني على lucide).
الأحجام: `16 · 20 · 24 · 32`. لا أيقونات مصمتة إلا للأشرطة الدلالية.

## فرشاة الشعار

```tsx
<LogoMark state="loading" size={48} />
```

| الحالة | الدلالة | الحركة (تُلغى عند تقليل الحركة) |
| --- | --- | --- |
| `welcome` | ترحيب | دخول زنبركي ناعم |
| `loading` | تحميل | تنفّس شفافية/حجم هادئ |
| `empty` | فراغ | ثابتة، رمادية مطفأة |
| `success` | نجاح | نبضة قصيرة + شارة صحّ خضراء |
| `error` | خطأ | رجّة قصيرة + شارة تنبيه حمراء |

## فلسفة الحركة

- **الظهور**: تباطؤ `standard` بمدد `150–320ms`. لا ظهور خطّي.
- **اللمس**: زنبرك (`SPRING.gentle` / `snappy`) يستقر سريعاً.
- **بين الشاشات**: `screen` — تلاشٍ + إزاحة رأسية `6px` فقط، ذهاباً `220ms` وإياباً `150ms`.
- **تقليل الحركة**: يحترم `prefers-reduced-motion` وإعداد «تخفيف الحركة» (المفتاح `khiyal:reduce`)، وتُصفَّر المدد تلقائياً في CSS.

```tsx
import { useReducedMotion, screen, SPRING } from "@/components/ui";
const reduced = useReducedMotion();
<motion.div variants={screen} initial="initial" animate="animate" />
```

## الاهتزاز والأصوات (اختيارية)

- **الاهتزاز**: مفتوح افتراضياً — المفتاح `khiyal:haptics`، ويعمل عبر `haptic("light" | "medium" | "heavy")`.
- **الأصوات**: مطفأة افتراضياً — المفتاح `khiyal:sound`، ونغمات قصيرة مُولَّدة (بلا ملفات) عبر `playSound("tap" | "toggle" | "success" | "error")`.
- يجمعها `useFeedback()` في تأكيد تفاعل واحد. كلاهما يحترم إعداد المستخدم.

## قواعد ثابتة

1. لا نيون ولا توهّج ولا تدرّجات إشعاعية — الظل للارتفاع فقط.
2. لا زخرفة بلا وظيفة؛ كل حركة تحمل معنى.
3. لا قيم بصرية مكتوبة يدوياً — استخدم الرموز.
4. احترم `useReducedMotion()` في كل حركة جديدة.
