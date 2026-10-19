"use client";
// components/ui/elastic-reel.tsx — تأثير elastic-reel (مكافئ reactbits-starter/elastic-reel-tw):
// رفّ من شرائح الصور؛ الشريحة النشطة تتضخّم بمرونة زنبركية لتُظهر صورتها كاملة،
// وتنكمش البقية في الرفّ. تتبدّل تلقائياً وتستجيب للنقر والمرور.
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "@/components/icons";

export type ReelItem = {
  /** رابط الصورة؛ إن غاب تُرسم شريحة ضوئية بديلة بألوان الهوية */
  src?: string;
  alt?: string;
  title?: string;
  subtitle?: string;
  /** رقم نغمة الشريحة البديلة لتلوين الخلفية */
  tone?: number;
};

export function ElasticReel({
  items,
  hold = 3800,
  className = "",
}: {
  items: ReelItem[];
  hold?: number;
  className?: string;
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (reduce || items.length < 2 || paused) return;
    timer.current = setInterval(() => setActive((n) => (n + 1) % items.length), hold);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [items.length, hold, paused, reduce]);

  return (
    <div
      className={`elastic-reel ${className}`}
      role="group"
      aria-label="شرائح الأفكار"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {items.map((it, i) => {
        const on = i === active;
        return (
          <motion.button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            aria-label={it.title ?? it.alt ?? `شريحة ${i + 1}`}
            aria-current={on}
            className={`elastic-reel-slice${on ? " is-open" : ""}`}
            data-tone={it.tone ?? i}
            animate={
              reduce
                ? {}
                : {
                    flexGrow: on ? 4.2 : 1,
                    rotate: on ? -1.1 : i % 2 ? 1.3 : -1.3,
                    y: on ? -6 : 0,
                  }
            }
            transition={{ type: "spring", stiffness: 210, damping: 26, mass: 0.9 }}
          >
            {it.src ? (
              <img src={it.src} alt={it.alt ?? ""} loading="lazy" decoding="async" draggable={false} />
            ) : (
              <span className="elastic-reel-art" aria-hidden="true">
                <Sparkles size={22} />
              </span>
            )}
            <span className="elastic-reel-caption">
              {it.title && <strong>{it.title}</strong>}
              {it.subtitle && <small>{it.subtitle}</small>}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

export default ElasticReel;
