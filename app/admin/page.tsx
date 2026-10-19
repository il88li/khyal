// app/admin/page.tsx — بوابة الأدمن: كلمة مرور ثم اللوحة
import { adminSession } from "@/lib/server";
import { Login, Panel } from "./ui";
export const dynamic = "force-dynamic";
export default async function Page() {
  const s = await adminSession();
  return s ? <Panel csrf={s.csrf} /> : <Login />;
}
