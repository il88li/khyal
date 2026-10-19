// lib/nav.ts — المصدر الوحيد لبنية المعلومات والتنقل في خيال.
// كل أسطح التنقل (الشريط الجانبي، الهيدر، الشريط السفلي، قائمة «المزيد») تقرأ من هنا،
// فلا تتباعد التسميات ولا تتكرّر الوجهة تحت أسماء مختلفة.
import {
  BarChart3, BadgeCheck, Bell, BookMarked, Compass, FileText, Home, Lock,
  Megaphone, Plus, Rocket, Settings, ShieldCheck, Sparkles, UserRound, Users,
} from "@/components/icons";
import type { LucideIcon } from "@/components/icons";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** وصف قصير يظهر في قوائم الإفصاح التدريجي */
  hint?: string;
};

/** إجراء الإنشاء — يظهر في المركز في الشريط السفلي، وفي أعلى الشريط الجانبي. */
export const CREATE: NavItem = { href: "/new", label: "أنشئ", icon: Plus };

/** الوجهات الأساسية — نفسها في الشريط السفلي والشريط الجانبي. */
export const PRIMARY: NavItem[] = [
  { href: "/", label: "الرئيسية", icon: Home },
  { href: "/search", label: "استكشف", icon: Compass },
  { href: "/library", label: "مكتبتي", icon: BookMarked },
  { href: "/profile/me", label: "حسابي", icon: UserRound },
];

/** أدوات خيال — تُكشف تدريجياً (لا تزحم التنقل الأساسي). */
export const TOOLS: NavItem[] = [
  { href: "/enhance", label: "تحسين البرومبت", icon: Sparkles, hint: "ابدأ بفكرة أولية واضبط النتيجة" },
  { href: "/community", label: "المجتمع", icon: Users, hint: "الأكثر إعجاباً وتأثيراً هذا الأسبوع" },
];

/** حسابك — كل ما يخص الحساب والإحصاءات. */
export const ACCOUNT: NavItem[] = [
  { href: "/notifications", label: "الإشعارات", icon: Bell },
  { href: "/stats", label: "إحصاءاتي", icon: BarChart3 },
  { href: "/verification", label: "توثيق الحساب", icon: BadgeCheck },
  { href: "/requests", label: "طلبات المتابعة", icon: Users },
  { href: "/settings", label: "الإعدادات", icon: Settings },
];

/** مساعدة وخطط — إفصاح تدريجي عند الحاجة. */
export const HELP: NavItem[] = [
  { href: "/pricing", label: "خطط خيال", icon: Rocket, hint: "قارن المجاني والمدفوع" },
  { href: "/safety", label: "الأمان والثقة", icon: ShieldCheck, hint: "أدوات الحماية وإرشادات المجتمع" },
];

/** صفحات ثانوية اختفت من التنقل فصارت يتيمة — تُعاد هنا لتبقى قابلة للوصول. */
export const LEGAL: NavItem[] = [
  { href: "/privacy", label: "الخصوصية", icon: Lock },
  { href: "/terms", label: "الشروط", icon: FileText },
  { href: "/advertise", label: "أعلن معنا", icon: Megaphone },
];

/** عناوين الصفحات: العنوان + سطر توضيحي واحد. */
export const PAGE_HEADINGS: [string, string, string][] = [
  ["/", "الرئيسية", "أفكار جديدة تستحق أن تتحول إلى برومبتات أوضح."],
  ["/search", "استكشف", "ابحث عن فكرة أو برومبت أو مبدع."],
  ["/community", "المجتمع", "مساحة عربية لتبادل ما تتعلمه وتكتبه."],
  ["/enhance", "تحسين البرومبت", "ابدأ بفكرة أولية، واضبط النتيجة على طريقتك."],
  ["/library", "مكتبتي", "مكان واحد للبرومبتات التي تريد الرجوع إليها."],
  ["/new", "برومبت جديد", "رتّب فكرتك، ثم انشرها ليستفيد منها الآخرون."],
  ["/notifications", "الإشعارات", "آخر ما حدث على حسابك ومنشوراتك."],
  ["/requests", "طلبات المتابعة", "أدر طلبات الانضمام إلى دائرتك."],
  ["/settings", "الإعدادات", "اجعل خيال أقرب إلى طريقتك في العمل."],
  ["/stats", "إحصاءاتي", "تابع ما تنشره وما يلقى صدى."],
  ["/verification", "توثيق الحساب", "احصل على شارة التوثيق لتزيد ثقة جمهورك."],
  ["/profile/", "حسابي", "منشوراتك ونشاطك في خيال."],
  ["/p/", "البرومبت", "اقرأه، جرّبه، أو احفظه للعودة إليه."],
  ["/safety", "الأمان والثقة", "أدوات الحماية وإرشادات المجتمع."],
  ["/pricing", "خطط خيال", "قارن المجاني والمدفوع واختر ما يناسبك."],
];

/** هل الوجهة نشطة؟ `/` تطابق الجذر فقط، `/profile/me` تطابق كل مسارات الملف. */
export const isActive = (path: string, href: string): boolean => {
  if (href === "/") return path === "/";
  if (href === "/profile/me") return path.startsWith("/profile/");
  return path === href || path.startsWith(href + "/");
};
