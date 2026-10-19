"use client";
// app/error.tsx — حدّ أخطاء عام مع إعادة المحاولة
import { ErrorState } from "@/components/states";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState onRetry={reset} />;
}
