// الاستخدام: node scripts/hash-admin.mjs "كلمة-المرور"  → ضع الناتج في ADMIN_PASSWORD_HASH
import { randomBytes, scryptSync } from "crypto";
const salt = randomBytes(16).toString("hex");
console.log(`${salt}:${scryptSync(process.argv[2] ?? "", salt, 64).toString("hex")}`);
