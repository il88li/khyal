"use client";
// components/ui/vapor-type.tsx — تأثير vapor-type (مكافئ reactbits-starter/vapor-type-tw):
// كل كلمة تتكثّف من ضباب (تمويه + شفافية + إزاحة) إلى حروف صافية بالتدريج،
// ثم تتبخّر العبارة للأعلى لتفسح للعبارة التالية.
// الحركة على مستوى الكلمة لا الحرف، حتى لا ينقطع اتصال الحروف العربية.
// تتوقف الحركة بعد دورات محدودة، وعند أول تمرير، وعند تفعيل «تقليل الحركة».
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const LINE = { hidden: {}, show: { transition: { staggerChildren: 0.055 } } };
const WORD = {
  hidden: { opacity: 0, y: 14, filter: "blur(14px)", scale: 0.96 },
  show: {
    opacity: 1, y: 0, filter: "blur(0px)", scale: 1,
    transition: { duration: 0.62, ease: [0.2, 0, 0, 1] as const },
  },
};

/** أقصى عدد دورات قبل التوقف التام على العبارة الأولى — يمنع التشتيت اللانهائي */
const MAX_CYCLES = 3;

export function VaporType({
  words,
  hold = 2600,
  className = "",
}: {
  words: string[];
  hold?: number;
  className?: string;
}) {
  const [i, setI] = useState(0);
  const [stopped, setStopped] = useState(false);
  const cycles = useRef(0);
  const reduce = useReducedMotion();

  // التوقف عند أول تمرير: المستخدم بدأ يتفاعل مع المحتوى فلا نشتّته
  useEffect(() => {
    if (reduce) return;
    const onScroll = () => { if (window.scrollY > 8) setStopped(true); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduce]);

  useEffect(() => {
    if (reduce || stopped || words.length < 2) return;
    const t = setInterval(() => {
      cycles.current += 1;
      if (cycles.current >= MAX_CYCLES) { setStopped(true); return; }
      setI((n) => (n + 1) % words.length);
    }, hold + 1600);
    return () => clearInterval(t);
  }, [words.length, hold, reduce, stopped]);

  const phrase = words[i] ?? "";

  if (reduce || stopped)
    return (
      <span className={`vapor-type ${className}`} aria-label={phrase}>
        <span className="vapor-type-line">{phrase}</span>
      </span>
    );

  return (
    <span className={`vapor-type ${className}`} aria-label={phrase} aria-live="off">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={i}
          className="vapor-type-line"
          variants={LINE}
          initial="hidden"
          animate="show"
          exit={{ opacity: 0, y: -16, filter: "blur(16px)", transition: { duration: 0.5, ease: [0.2, 0, 0, 1] } }}
        >
          {phrase.split(" ").map((w, k) => (
            <motion.span key={`${k}-${w}`} variants={WORD} className="vapor-type-word">
              {w}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export default VaporType;
