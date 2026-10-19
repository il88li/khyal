// app/loading.tsx — هيكل تحميل عام للمسارات
import { Skeleton } from "@/components/states";

export default function Loading() {
  return <Skeleton variant="card" count={2} />;
}
