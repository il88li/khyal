"use client";
// components/OwnerPromptCard.tsx — بطاقة المالك في ملفه الشخصي:
// تتوسّع بالسحب للأعلى داخل المكان (بلا نافذة منبثقة) ويُحرَّر البرومبت ويُحذف داخل البطاقة نفسها.
// القيد: التعديل والحذف من الملف الشخصي فقط — ولا وجود لأي فعل مالك في بطاقة الرئيسية.
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import Link from "next/link";
import { useRef, useState } from "react";
import { Check, ChevronDown, Heart, Pencil, Trash2, X } from "./icons";
import { ago, purgeImageFolder, sb, thumb, toast, uid } from "@/lib/supabase";
import { PromptCover } from "./PromptCover";

export type OwnerCell = {
  id: string;
  body: string;
  enhanced: string | null;
  images: { url: string }[];
  like_count?: number;
  comment_count?: number;
  created_at?: string;
};

type Vers = { id: string; body: string; enhanced: string | null; created_at: string };

export default function OwnerPromptCard({
  c,
  onSaved,
  onRemoved,
}: {
  c: OwnerCell;
  onSaved: (id: string, patch: Partial<OwnerCell>) => void;
  onRemoved: (id: string, images: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.enhanced ?? c.body);
  const [vers, setVers] = useState<Vers[]>([]);
  const [busy, setBusy] = useState("");
  const controls = useDragControls();
  const dragged = useRef(false);

  const text = c.enhanced ?? c.body;
  const img = c.images?.[0]?.url;

  /** التوسيع: يجلب الإصدارات السابقة مرة واحدة لتعريف الاسترجاع داخل البطاقة */
  async function expand() {
    setOpen(true);
    if (vers.length) return;
    const { data } = await sb
      .from("prompt_versions")
      .select("id,body,enhanced,created_at")
      .eq("prompt_id", c.id)
      .order("created_at", { ascending: false })
      .limit(8);
    setVers((data as Vers[]) ?? []);
  }

  function collapse() {
    setOpen(false);
    setEditing(false);
  }

  function onDragEnd(_e: unknown, info: { offset: { y: number } }) {
    if (info.offset.y < -48) void expand();
    else if (info.offset.y > 48) collapse();
  }

  async function save() {
    const v = draft.trim();
    if (!v) return;
    setBusy("edit");
    const who = await uid();
    if (who)
      await sb
        .from("prompt_versions")
        .insert({ prompt_id: c.id, author_id: who, body: c.body, enhanced: c.enhanced })
        .then(() => {}, () => {});
    const field = c.enhanced ? "enhanced" : "body";
    const { error } = await sb.from("prompts").update({ [field]: v }).eq("id", c.id);
    setBusy("");
    if (error) return toast("تعذّر حفظ التعديل");
    onSaved(c.id, { [field]: v } as Partial<OwnerCell>);
    setEditing(false);
    toast("تم التعديل");
  }

  async function del() {
    if (!confirm("حذف هذا البرومبت نهائياً؟")) return;
    setBusy("del");
    const { error } = await sb.from("prompts").delete().eq("id", c.id);
    setBusy("");
    if (error) return toast("تعذّر الحذف");
    const urls = c.images?.map((i) => i.url) ?? [];
    purgeImageFolder(urls); // صور المنشور تُحذف معه
    onRemoved(c.id, urls);
    toast("تم الحذف");
  }

  return (
    <motion.article
      drag="y"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.22}
      onDragStart={() => { dragged.current = true; }}
      onDragEnd={(e, i) => { onDragEnd(e, i as { offset: { y: number } }); window.setTimeout(() => { dragged.current = false; }, 0); }}
      className="card owner-card"
    >
      <div className="owner-card-media aspect-[4/5]">
        {img ? (
          <>
            <img src={thumb(img, 600)} alt="" loading="lazy" />
            {!!c.like_count && (
              <span className="on-media absolute bottom-2 end-2 flex items-center gap-1 text-micro font-semibold text-white">
                <Heart size={16} fill="currentColor" />
                {c.like_count}
              </span>
            )}
          </>
        ) : (
          <div className="flex min-h-[190px] items-center p-4">
            <PromptCover variant="tile" text={text} />
          </div>
        )}
      </div>

      <div className="owner-card-body pt-3">
        <p className={open ? "text-sm leading-relaxed text-charcoal" : "owner-card-text"}>{text}</p>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="more"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="owner-card-body pb-2">
              {editing ? (
                <>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={6}
                    className="field min-h-[120px] w-full resize-none py-2"
                  />
                  {vers.length > 0 && (
                    <div className="owner-versions">
                      <p className="text-caption text-smoke">الإصدارات السابقة — اضغط للاسترجاع</p>
                      {vers.map((x) => (
                        <button
                          key={x.id}
                          onClick={() => setDraft(x.enhanced ?? x.body)}
                          className="card-flat flex flex-col gap-0.5 p-2 text-start"
                        >
                          <span className="text-caption text-smoke">{ago(x.created_at)}</span>
                          <span className="line-clamp-2 text-caption">{x.enhanced ?? x.body}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link href={`/p/${c.id}`} className="btn self-start !min-h-9">فتح صفحة البرومبت</Link>
              )}
            </div>

            <div className="owner-card-actions">
              {editing ? (
                <>
                  <button onClick={save} disabled={!draft.trim() || busy === "edit"} className="btn btn-primary !min-h-9">
                    {busy === "edit" ? "جارٍ الحفظ…" : (<><Check size={16} />حفظ</>)}
                  </button>
                  <button onClick={() => { setDraft(c.enhanced ?? c.body); setEditing(false); }} className="btn btn-ghost !min-h-9">
                    <X size={16} />إلغاء
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditing(true)} className="btn !min-h-9"><Pencil size={16} />تعديل</button>
                  <button onClick={del} disabled={busy === "del"} className="btn btn-ghost !min-h-9 text-danger disabled:opacity-60">
                    <Trash2 size={16} />حذف
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* مقبض السحب: من هنا فقط يبدأ السحب، فيبقى تمرير الصفحة سليماً */}
      <button
        type="button"
        className="owner-grip"
        onPointerDown={(e) => controls.start(e)}
        onClick={() => { if (dragged.current) return; open ? collapse() : void expand(); }}
        aria-expanded={open}
        aria-label={open ? "اطوِ البطاقة" : "اسحب للأعلى للتوسيع"}
      >
        <ChevronDown size={15} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
        <span>{open ? "اطوِ" : "اسحب للأعلى للتوسيع"}</span>
      </button>
    </motion.article>
  );
}
