#!/usr/bin/env python3
"""يولّد supabase/setup.sql من setup.src.sql: كل أمر داخل كتلة DO مستقلة، فيُسجَّل أي خطأ في setup_log ولا يوقف بقية السكربت.
الاستخدام: python3 scripts/build-setup.py   (ثم يُحدَّث lib/setup-sql.ts تلقائياً)"""
import re, json

def split_statements(sql):
    out, buf, i, n, mode, tag = [], [], 0, len(sql), None, None
    while i < n:
        ch = sql[i]
        if mode is None:
            if sql.startswith("--", i):
                j = sql.find("\n", i); i = n if j == -1 else j; continue      # تجاهل التعليقات
            if ch == "'": mode = "s"; buf.append(ch); i += 1; continue
            if ch == '"': mode = "d"; buf.append(ch); i += 1; continue
            if ch == "$":
                m = re.match(r"\$([A-Za-z_]*)\$", sql[i:])
                if m: tag = m.group(0); mode = "$"; buf.append(tag); i += len(tag); continue
            if ch == ";":
                st = "".join(buf).strip()
                if st: out.append(st)
                buf = []; i += 1; continue
            buf.append(ch); i += 1
        elif mode == "s":
            buf.append(ch)
            if ch == "'":
                if sql[i + 1:i + 2] == "'": buf.append("'"); i += 2; continue
                mode = None
            i += 1
        elif mode == "d":
            buf.append(ch)
            if ch == '"': mode = None
            i += 1
        else:  # داخل $...$
            if sql.startswith(tag, i): buf.append(tag); i += len(tag); mode = None; continue
            buf.append(ch); i += 1
    st = "".join(buf).strip()
    if st: out.append(st)
    return out

def wrap(st):
    label = re.sub(r"\s+", " ", st)[:50].replace("'", "''")
    return f"do $s$ begin {st}; exception when others then perform setup_fail('{label}', sqlerrm); end $s$;"

CAP = 11000   # أقصى حجم للجزء الواحد (أقل بكثير من حد اللصق ~19,800 حرف على الهاتف)
src = open("supabase/setup.src.sql", encoding="utf-8").read()
blocks = [wrap(x) for x in split_statements(src)]

PRE = """create table if not exists setup_log (id serial primary key, step text, error text, at timestamptz default now());
alter table setup_log enable row level security;
create or replace function setup_fail(s text, e text) returns void language sql as $$ insert into setup_log (step, error) values (s, e) $$;
"""
def footer(label):
    return ("select " + label + " || coalesce((select string_agg(step || ' → ' || error, E'\\n') from setup_log), 'بلا أخطاء') as result;\n")

# ---- تقسيم إلى أجزاء بحجم محدود (لا يُقطع أي أمر) ----
parts, cur, size = [], [], 0
for b in blocks:
    if cur and size + len(b) > CAP: parts.append(cur); cur, size = [], 0
    cur.append(b); size += len(b) + 1
if cur: parts.append(cur)
N = len(parts)
files = []
for k, blk in enumerate(parts, 1):
    h = f"-- خيال — setup الجزء {k} من {N}: الصقه كاملاً في SQL Editor ثم Run، ثم انتقل للجزء التالي بالترتيب. آمن لإعادة التنفيذ.\n" + PRE
    if k == 1: h += "truncate setup_log;\n"
    txt = h + "\n".join(blk) + "\n" + footer(f"'الجزء {k} من {N} — '")
    files.append(txt)

full = ("-- خيال — setup.sql (كامل، مُولَّد من setup.src.sql). على الهاتف استخدم الأجزاء setup-1..N.sql لأن اللصق يُقصّ عند ~20 ألف حرف.\n"
        + PRE + "truncate setup_log;\n" + "\n".join(blocks) + "\n" + footer("'تمت التهيئة — '"))
open("supabase/setup.sql", "w", encoding="utf-8").write(full)
for t in files + [full]: assert "`" not in t and "${" not in t
ts = "// مُولَّد من supabase/setup.src.sql عبر scripts/build-setup.py\nexport const SETUP_PARTS: string[] = " + json.dumps(files, ensure_ascii=False) + ";\nexport const SETUP_SQL = " + json.dumps(full, ensure_ascii=False) + ";\n"
open("lib/setup-sql.ts", "w", encoding="utf-8").write(ts)
print(f"blocks: {len(blocks)} | parts: {N} | part sizes (chars): {[len(t) for t in files]} | full: {len(full)}")
