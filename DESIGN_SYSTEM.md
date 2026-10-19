---
version: 1.0
platform: web / android (pwa)
design_system: custom
project: khyal_web
source: استخلاص بصري من صور واجهات المستخدم
---

> **مهجور (Deprecated).** هذا المستند لقطة تاريخية من نظام «Luminous Minimalism» البنفسجي السابق.
> المرجع الحالي لنظام التصميم هو [`design.md`](design.md)، ورموز [`app/tokens.css`](app/tokens.css)، ومكتبة [`components/ui`](components/ui/README.md).
> كل ما يخالفها هنا (خصوصاً `primary: #6750A4`، والثانوي الوردي `#7D5260`، وسماكة الأيقونة `1.8`، والزوايا `28/24`) **ملغى**.

# نظام تصميم منصة خيال (Khyal)

## نظرة عامة

منصة خيال هي منصة عربية لتحسين البرومبتات ومشاركتها، موجهة لصناع المحتوى العرب، المسوّقين، المستقلين، والمبتدئين في الذكاء الاصطناعي. يعتمد التصميم على أسلوب **Luminous Minimalism** مع لمسات من **Glassmorphism**، حيث تطفو البطاقات فوق خلفيات فاتحة مع تمويه خفيف وحدود ناعمة.

---

## الألوان

### الوضع الفاتح (Light Mode)

```yaml
colors:
  # الألوان الأساسية
  primary: "#6750A4"          # بنفسجي أساسي
  primaryContainer: "#EADDFF" # حاوية بنفسجية فاتحة
  onPrimary: "#FFFFFF"
  
  # الألوان الثانوية
  secondary: "#7D5260"        # وردي داكن
  secondaryContainer: "#FFD8E4"
  
  # الخلفيات
  background: "#FBFDFF"       # أبيض مائل للأزرق
  surface: "#FFFFFF"
  surfaceVariant: "#F5F5F5"   # رمادي فاتح جداً للبطاقات
  
  # النصوص
  onSurface: "#1C1B1F"        # أسود ناعم
  onSurfaceVariant: "#49454F" # رمادي داكن للنصوص الثانوية
  
  # ألوان الحالة
  success: "#4CAF50"          # أخضر لعلامة التوثيق
  error: "#B3261E"
  warning: "#F59E0B"
  info: "#2196F3"
  
  # حدود وفواصل
  outline: "#E0E0E0"
  outlineVariant: "#EEEEEE"
  
  # ظلال
  shadow: "rgba(0, 0, 0, 0.06)"
```

### الوضع الداكن (Dark Mode)

```yaml
colorsDark:
  primary: "#D0BCFF"
  primaryContainer: "#4F378B"
  onPrimary: "#381E72"
  
  background: "#141218"
  surface: "#1C1B1F"
  surfaceVariant: "#2B2930"
  
  onSurface: "#E6E1E5"
  onSurfaceVariant: "#CAC4D0"
  
  outline: "#49454F"
  outlineVariant: "#3A383D"
  
  success: "#81C784"
  error: "#F2B8B5"
```

---

## الطباعة

### عائلة الخطوط

```yaml
typography:
  fontFamily:
    primary: "Gilroy"           # من لوحة Ui Kit
    fallback: "Inter, system-ui, sans-serif"
    arabic: "IBM Plex Sans Arabic, Noto Sans Arabic, sans-serif"
```

### التدرج الطباعي

| النمط | الحجم | الوزن | الارتفاع | الاستخدام |
|---|---|---|---|---|
| Display Large | 32px | Bold (700) | 1.2 | العناوين الرئيسية للشاشات |
| Display Medium | 28px | Bold (700) | 1.2 | عناوين الأقسام الكبرى |
| Headline Large | 24px | Semibold (600) | 1.3 | عناوين البطاقات الرئيسية |
| Headline Medium | 20px | Semibold (600) | 1.3 | عناوين فرعية |
| Title Large | 18px | Semibold (600) | 1.4 | عناوين المكونات |
| Title Medium | 16px | Medium (500) | 1.4 | عناوين فرعية للمكونات |
| Body Large | 16px | Regular (400) | 1.5 | النصوص الأساسية |
| Body Medium | 14px | Regular (400) | 1.5 | النصوص الثانوية |
| Body Small | 12px | Regular (400) | 1.4 | التسميات التوضيحية |
| Label Large | 14px | Medium (500) | 1.4 | الأزرار والتسميات |
| Label Small | 11px | Medium (500) | 1.3 | الشارات والعدادات |

---

## المسافات

```yaml
spacing:
  base: 4
  xs: 4
  sm: 8
  md: 12
  lg: 16
  xl: 24
  xxl: 32
  
  # حواشي الشاشة
  screenPadding: 16
  
  # المسافات بين البطاقات
  cardGap: 12
  
  # الحواشي الداخلية
  cardPadding: 16
  buttonPaddingH: 20
  buttonPaddingV: 12
```

---

## أنصاف الأقطار

```yaml
radius:
  xs: 6
  sm: 8
  md: 12
  lg: 16
  xl: 20
  xxl: 28
  full: 9999
  
  # قيم محددة
  button: 24
  card: 20
  bottomSheet: 28
  input: 16
  chip: 9999
  avatar: 9999
```

---

## الظلال

```yaml
shadows:
  sm:
    shadowColor: "#000000"
    shadowOffset: { width: 0, height: 1 }
    shadowOpacity: 0.04
    shadowRadius: 2
    elevation: 1
  md:
    shadowColor: "#000000"
    shadowOffset: { width: 0, height: 4 }
    shadowOpacity: 0.06
    shadowRadius: 12
    elevation: 3
  lg:
    shadowColor: "#000000"
    shadowOffset: { width: 0, height: 8 }
    shadowOpacity: 0.08
    shadowRadius: 24
    elevation: 6
```

---

## المكونات

### 1. بطاقة البرومبت (PromptCard)

البطاقة هي العنصر الأساسي في المنصة، وتظهر بتصميم ناعم مع صورة أو محتوى في الأعلى ونص في الأسفل.

```yaml
promptCard:
  background: "#FFFFFF"
  borderRadius: 20
  shadow: "md"
  overflow: hidden
  padding: 16
  gap: 12
  
  # الصورة/المحتوى العلوي
  mediaHeight: 200
  mediaBorderRadius: 16
  
  # العنوان
  title:
    fontSize: 18
    fontWeight: 600
    color: "#1C1B1F"
    maxLines: 1
  
  # الوصف
  description:
    fontSize: 14
    color: "#49454F"
    maxLines: 2
  
  # الإحصاءات (إعجاب، تعليق، نسخ)
  stats:
    iconSize: 16
    fontSize: 12
    color: "#49454F"
    gap: 12
```

### 2. الزر الأساسي (Primary Button)

```yaml
button:
  primary:
    background: "#6750A4"
    color: "#FFFFFF"
    borderRadius: 24
    paddingHorizontal: 24
    paddingVertical: 12
    fontSize: 14
    fontWeight: 500
    
  secondary:
    background: "#F5F5F5"
    color: "#1C1B1F"
    borderRadius: 24
    paddingHorizontal: 24
    paddingVertical: 12
    
  ghost:
    background: transparent
    color: "#6750A4"
    borderRadius: 24
    
  icon:
    size: 40
    borderRadius: 9999
    background: "#F5F5F5"
```

### 3. شريط التنقل السفلي (Bottom Navigation)

من الصور، يظهر شريط تنقل سفلي بسيط مع أيقونات وتسميات.

```yaml
bottomNav:
  height: 64
  background: "#FFFFFF"
  borderTop: "1px solid #EEEEEE"
  paddingBottom: 8
  
  item:
    activeColor: "#6750A4"
    inactiveColor: "#49454F"
    iconSize: 24
    labelSize: 11
    labelWeight: 500
```

### 4. حقل الإدخال / البحث

```yaml
input:
  background: "#F5F5F5"
  borderRadius: 16
  paddingHorizontal: 16
  paddingVertical: 12
  fontSize: 14
  color: "#1C1B1F"
  placeholderColor: "#9E9E9E"
  
  focus:
    borderColor: "#6750A4"
    borderWidth: 1.5
```

### 5. الشريحة (Chip / Tag)

```yaml
chip:
  background: "#F5F5F5"
  borderRadius: 9999
  paddingHorizontal: 16
  paddingVertical: 8
  fontSize: 13
  color: "#1C1B1F"
  
  selected:
    background: "#EADDFF"
    color: "#6750A4"
```

### 6. الورقة السفلية (Bottom Sheet)

```yaml
bottomSheet:
  background: "#FFFFFF"
  borderRadiusTop: 28
  padding: 24
  shadow: "lg"
  backdrop: "rgba(0, 0, 0, 0.3)"
  
  handle:
    width: 32
    height: 4
    borderRadius: 9999
    background: "#E0E0E0"
    marginBottom: 16
```

### 7. الصورة الرمزية (Avatar)

```yaml
avatar:
  sm: 32
  md: 40
  lg: 56
  xl: 80
  borderRadius: 9999
  borderWidth: 2
  borderColor: "#FFFFFF"
```

### 8. الشعار / التسمية التوثيقية

```yaml
verifiedBadge:
  size: 16
  color: "#4CAF50"
  icon: "check-circle"
```

---

## الأيقونات

```yaml
icons:
  set: "Lucide Icons"
  size:
    sm: 16
    md: 20
    lg: 24
    xl: 32
  color: "#49454F"
  activeColor: "#6750A4"
  strokeWidth: 1.8
```

---

## الحركات والانتقالات

```yaml
motion:
  duration:
    fast: 150ms
    normal: 250ms
    slow: 400ms
  
  easing:
    standard: "cubic-bezier(0.2, 0, 0, 1)"
    decelerate: "cubic-bezier(0, 0, 0, 1)"
    accelerate: "cubic-bezier(0.3, 0, 1, 1)"
  
  transitions:
    cardPress: "scale(0.98)"
    buttonPress: "scale(0.96)"
    pageTransition: "fade + slide"
```

---

## قواعد التخطيط

```yaml
layout:
  # ويب (ويب أولاً)
  maxWidth: 1200
  sidebarWidth: 240
  contentMaxWidth: 720
  
  # جوال
  breakpoints:
    sm: 640
    md: 768
    lg: 1024
    xl: 1280
  
  # شبكة الجوال
  mobileGrid:
    columns: 1
    gap: 12
    padding: 16
  
  # شبكة الويب (ثلاثي الأعمدة)
  webGrid:
    columns: "sidebar + content + daily-challenge"
    sidebarWidth: 240
    contentFlex: 1
    rightPanelWidth: 320
```

---

## إمكانية الوصول

```yaml
accessibility:
  minTouchTarget: 44
  contrastRatio:
    normalText: 4.5
    largeText: 3.0
  focusRing:
    color: "#6750A4"
    width: 2
    offset: 2
  reduceMotion: true
  screenReaderLabels: true
```

---

## دعم RTL

```yaml
rtl:
  enabled: true
  direction: "rtl"
  textAlign: "right"
  flexDirection: "row-reverse"
  iconFlip: true
  marginStart: "marginRight"
  marginEnd: "marginLeft"
  paddingStart: "paddingRight"
  paddingEnd: "paddingLeft"
  borderRadiusStart: "borderTopRightRadius"
  borderRadiusEnd: "borderTopLeftRadius"
```

---

## ملاحظات التصميم

1. **الأسلوب العام:** Luminous Minimalism - خلفيات فاتحة، بطاقات عائمة، تمويه خفيف (Glassmorphism).
2. **الألوان:** تدرج بنفسجي/وردي أساسي مع أخضر للنجاح، مستخلص من واجهة الملف الشخصي وبطاقات البرومبت.
3. **البطاقات:** العنصر المهيمن - حواف دائرية كبيرة (20px)، ظلال ناعمة، محتوى في الأعلى ونص في الأسفل.
4. **الوضع الداكن:** مدعوم بالكامل مع الحفاظ على نسب التباين.
5. **التخطيط:** جوال أولاً، مع تخطيط ثلاثي الأعمدة على الويب (قائمة جانبية + محتوى + تحدي اليوم).
6. **الخط:** Gilroy للاتينية، مع خط عربي بديل مناسب للنصوص العربية (IBM Plex Sans Arabic).
7. **RTL:** المنصة عربية بالكامل، لذا يجب عكس اتجاه التخطيط والأيقونات والهوامش تلقائياً.

---

## ملفات ذات صلة

- `agents.md` - دليل الهندسة والبنية المعمارية
- `PROGRESS.md` - تفاصيل ونسب التقدم في المشروع