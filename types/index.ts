// types/index.ts — أنواع مشتركة
export type Img = { url: string; w: number; h: number };
export type Author = { id: string; username: string | null; display_name: string | null; avatar_url: string | null; verified?: boolean; card_fx?: unknown };
export type VerificationStats = {
  ok: boolean; reason?: string; verified: boolean; status: string | null;
  prompts: number; min_prompts: number; likes: number; min_likes: number;
  followers: number; min_followers: number; days: number; min_days: number; eligible: boolean;
};
export type PromptRow = {
  id: string; body: string; enhanced: string | null; model: string | null; images: Img[];
  like_count: number; comment_count: number; created_at: string; category_id: number | null;
  title?: string | null; tags?: string[] | null; author: Author; liked?: boolean; saved?: boolean; forked_from?: string | null; copy_count?: number; fork_count?: number;
  /** مقصوص من جهة الخادم (RPC prompt_gated): true إن كان باقي النص مخفياً بحسب المستوى */
  locked?: boolean; hidden?: number;
};

/** تحديات اليوم: تدور حسب رقم اليوم (بطاقة التحدي + الإشعار اليومي) */
export const CHALLENGES = [
  "لخّص مقالاً علمياً في ثلاث نقاط بسيطة", "ابتكر شخصية لقصة خيال علمي", "اطلب خطة تمرين منزلي لمدة أسبوع",
  "ولّد خمسة أسماء لمشروع ناشئ في مجال التعليم", "اكتب رسالة اعتذار مهذبة لعميل تأخر طلبه", "اشرح مفهوم الاستثمار لمراهق في دقيقة",
  "صمّم وصفة عشاء سريعة من مكونات متوفرة في أي بيت", "حوّل فكرة تطبيق إلى قائمة ميزات مرتبة بالأولوية", "اكتب وصف منتج جذاباً لقهوة مختصة",
  "ابنِ جدول مذاكرة لامتحان بعد أسبوعين", "اطلب نصائح لتحسين السيرة الذاتية لمطوّر مبتدئ", "اكتب مقدمة بودكاست عن التقنية",
  "ولّد أفكار محتوى لحساب تسويقي لمدة شهر", "ترجم فقرة تقنية إلى عربية سهلة"] as const;
export const challengeOf = (d: Date): string => CHALLENGES[Math.floor(d.getTime() / 86400000) % CHALLENGES.length];
