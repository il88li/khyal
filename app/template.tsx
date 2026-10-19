"use client";
// app/template.tsx — انتقال ناعم بين الصفحات (fade + slide 6px، 140ms)
import { motion } from "framer-motion";
export default function Template({ children }: { children: React.ReactNode }) {
  return <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.14, ease: [0.2, 0.8, 0.3, 1] }}>{children}</motion.div>;
}
