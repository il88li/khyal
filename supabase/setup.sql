-- خيال — setup.sql (كامل، مُولَّد من setup.src.sql). على الهاتف استخدم الأجزاء setup-1..N.sql لأن اللصق يُقصّ عند ~20 ألف حرف.
create table if not exists setup_log (id serial primary key, step text, error text, at timestamptz default now());
alter table setup_log enable row level security;
create or replace function setup_fail(s text, e text) returns void language sql as $$ insert into setup_log (step, error) values (s, e) $$;
truncate setup_log;
do $s$ begin create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique, display_name text, avatar_url text, cover_url text, bio text,
  role text not null default 'user' check (role in ('user','moderator','admin')),
  is_private boolean not null default false, banned boolean not null default false,
  preferred_models jsonb not null default '{}', links jsonb not null default '[]',
  interests text[] not null default '{}',
  onboarded boolean not null default false, streak int not null default 0, best_streak int not null default 0, last_active date, created_at timestamptz default now()); exception when others then perform setup_fail('create table if not exists profiles ( id uuid prim', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists cover_url text; exception when others then perform setup_fail('alter table profiles add column if not exists cove', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists links jsonb not null default '[]'; exception when others then perform setup_fail('alter table profiles add column if not exists link', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists interests text[] not null default '{}'; exception when others then perform setup_fail('alter table profiles add column if not exists inte', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists onboarded boolean not null default false; exception when others then perform setup_fail('alter table profiles add column if not exists onbo', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists streak int not null default 0; exception when others then perform setup_fail('alter table profiles add column if not exists stre', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists best_streak int not null default 0; exception when others then perform setup_fail('alter table profiles add column if not exists best', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists last_active date; exception when others then perform setup_fail('alter table profiles add column if not exists last', sqlerrm); end $s$;
do $s$ begin create table if not exists categories (id serial primary key, slug text unique, name_ar text, sort int default 0, active boolean default true); exception when others then perform setup_fail('create table if not exists categories (id serial p', sqlerrm); end $s$;
do $s$ begin create table if not exists prompts (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references profiles on delete cascade,
  body text not null, enhanced text, category_id int references categories, model text,
  images jsonb not null default '[]', like_count int not null default 0, comment_count int not null default 0,
  pinned boolean default false, created_at timestamptz default now()); exception when others then perform setup_fail('create table if not exists prompts ( id uuid prima', sqlerrm); end $s$;
do $s$ begin create table if not exists likes (user_id uuid references profiles on delete cascade, prompt_id uuid references prompts on delete cascade, primary key (user_id, prompt_id)); exception when others then perform setup_fail('create table if not exists likes (user_id uuid ref', sqlerrm); end $s$;
do $s$ begin create table if not exists saves (user_id uuid references profiles on delete cascade, prompt_id uuid references prompts on delete cascade, primary key (user_id, prompt_id)); exception when others then perform setup_fail('create table if not exists saves (user_id uuid ref', sqlerrm); end $s$;
do $s$ begin create table if not exists follows (follower_id uuid references profiles on delete cascade, following_id uuid references profiles on delete cascade, status text not null default 'accepted', primary key (follower_id, following_id)); exception when others then perform setup_fail('create table if not exists follows (follower_id uu', sqlerrm); end $s$;
do $s$ begin alter table follows add column if not exists status text not null default 'accepted'; exception when others then perform setup_fail('alter table follows add column if not exists statu', sqlerrm); end $s$;
do $s$ begin do $$ begin alter table follows add constraint follows_status_chk check (status in ('pending','accepted')); exception when duplicate_object then null; end $$; exception when others then perform setup_fail('do $$ begin alter table follows add constraint fol', sqlerrm); end $s$;
do $s$ begin create table if not exists comments (id uuid primary key default gen_random_uuid(), prompt_id uuid references prompts on delete cascade, author_id uuid references profiles on delete cascade, body text not null, created_at timestamptz default now()); exception when others then perform setup_fail('create table if not exists comments (id uuid prima', sqlerrm); end $s$;
do $s$ begin create table if not exists library (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles on delete cascade,
  body text not null, enhanced text not null, category_id int references categories, model text, created_at timestamptz default now()); exception when others then perform setup_fail('create table if not exists library ( id uuid prima', sqlerrm); end $s$;
do $s$ begin create table if not exists notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles on delete cascade,
  title text, body text, link text, read boolean default false, kind text default 'event', created_at timestamptz default now()); exception when others then perform setup_fail('create table if not exists notifications ( id uuid', sqlerrm); end $s$;
do $s$ begin alter table notifications add column if not exists kind text default 'event'; exception when others then perform setup_fail('alter table notifications add column if not exists', sqlerrm); end $s$;
do $s$ begin create table if not exists push_tokens (token text primary key, user_id uuid not null references profiles on delete cascade, platform text, updated_at timestamptz default now()); exception when others then perform setup_fail('create table if not exists push_tokens (token text', sqlerrm); end $s$;
do $s$ begin create table if not exists reports (
  id uuid primary key default gen_random_uuid(), prompt_id uuid not null references prompts on delete cascade,
  reporter_id uuid not null references profiles on delete cascade, reason text, resolved boolean not null default false,
  created_at timestamptz default now(), unique (prompt_id, reporter_id)); exception when others then perform setup_fail('create table if not exists reports ( id uuid prima', sqlerrm); end $s$;
do $s$ begin create table if not exists blocks (
  blocker_id uuid not null references profiles on delete cascade, blocked_id uuid not null references profiles on delete cascade,
  created_at timestamptz default now(), primary key (blocker_id, blocked_id)); exception when others then perform setup_fail('create table if not exists blocks ( blocker_id uui', sqlerrm); end $s$;
do $s$ begin create table if not exists audit_log (id bigserial primary key, actor uuid, action text, target text, meta jsonb, created_at timestamptz default now()); exception when others then perform setup_fail('create table if not exists audit_log (id bigserial', sqlerrm); end $s$;
do $s$ begin create table if not exists error_log (id bigserial primary key, source text, message text, created_at timestamptz default now()); exception when others then perform setup_fail('create table if not exists error_log (id bigserial', sqlerrm); end $s$;
do $s$ begin create table if not exists usage (id bigserial primary key, user_id uuid, model text, created_at timestamptz default now()); exception when others then perform setup_fail('create table if not exists usage (id bigserial pri', sqlerrm); end $s$;
do $s$ begin create table if not exists settings (key text primary key, value jsonb not null); exception when others then perform setup_fail('create table if not exists settings (key text prim', sqlerrm); end $s$;
do $s$ begin create table if not exists rate_hits (user_id uuid not null, ts timestamptz not null default now()); exception when others then perform setup_fail('create table if not exists rate_hits (user_id uuid', sqlerrm); end $s$;
do $s$ begin create index if not exists prompts_created_idx on prompts (created_at desc); exception when others then perform setup_fail('create index if not exists prompts_created_idx on ', sqlerrm); end $s$;
do $s$ begin create index if not exists prompts_author_idx on prompts (author_id); exception when others then perform setup_fail('create index if not exists prompts_author_idx on p', sqlerrm); end $s$;
do $s$ begin create index if not exists rate_hits_idx on rate_hits (user_id, ts); exception when others then perform setup_fail('create index if not exists rate_hits_idx on rate_h', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists username text; exception when others then perform setup_fail('alter table profiles add column if not exists user', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists display_name text; exception when others then perform setup_fail('alter table profiles add column if not exists disp', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists avatar_url text; exception when others then perform setup_fail('alter table profiles add column if not exists avat', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists cover_url text; exception when others then perform setup_fail('alter table profiles add column if not exists cove', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists bio text; exception when others then perform setup_fail('alter table profiles add column if not exists bio ', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists role text not null default 'user'; exception when others then perform setup_fail('alter table profiles add column if not exists role', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists is_private boolean not null default false; exception when others then perform setup_fail('alter table profiles add column if not exists is_p', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists banned boolean not null default false; exception when others then perform setup_fail('alter table profiles add column if not exists bann', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists preferred_models jsonb not null default '{}'; exception when others then perform setup_fail('alter table profiles add column if not exists pref', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists links jsonb not null default '[]'; exception when others then perform setup_fail('alter table profiles add column if not exists link', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists onboarded boolean not null default false; exception when others then perform setup_fail('alter table profiles add column if not exists onbo', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists created_at timestamptz default now(); exception when others then perform setup_fail('alter table profiles add column if not exists crea', sqlerrm); end $s$;
do $s$ begin alter table categories add column if not exists slug text; exception when others then perform setup_fail('alter table categories add column if not exists sl', sqlerrm); end $s$;
do $s$ begin alter table categories add column if not exists name_ar text; exception when others then perform setup_fail('alter table categories add column if not exists na', sqlerrm); end $s$;
do $s$ begin alter table categories add column if not exists sort int default 0; exception when others then perform setup_fail('alter table categories add column if not exists so', sqlerrm); end $s$;
do $s$ begin alter table categories add column if not exists active boolean default true; exception when others then perform setup_fail('alter table categories add column if not exists ac', sqlerrm); end $s$;
do $s$ begin alter table prompts add column if not exists author_id uuid; exception when others then perform setup_fail('alter table prompts add column if not exists autho', sqlerrm); end $s$;
do $s$ begin alter table prompts add column if not exists body text; exception when others then perform setup_fail('alter table prompts add column if not exists body ', sqlerrm); end $s$;
do $s$ begin alter table prompts add column if not exists enhanced text; exception when others then perform setup_fail('alter table prompts add column if not exists enhan', sqlerrm); end $s$;
do $s$ begin alter table prompts add column if not exists category_id int; exception when others then perform setup_fail('alter table prompts add column if not exists categ', sqlerrm); end $s$;
do $s$ begin alter table prompts add column if not exists model text; exception when others then perform setup_fail('alter table prompts add column if not exists model', sqlerrm); end $s$;
do $s$ begin alter table prompts add column if not exists images jsonb not null default '[]'; exception when others then perform setup_fail('alter table prompts add column if not exists image', sqlerrm); end $s$;
do $s$ begin alter table prompts add column if not exists like_count int not null default 0; exception when others then perform setup_fail('alter table prompts add column if not exists like_', sqlerrm); end $s$;
do $s$ begin alter table prompts add column if not exists comment_count int not null default 0; exception when others then perform setup_fail('alter table prompts add column if not exists comme', sqlerrm); end $s$;
do $s$ begin alter table prompts add column if not exists pinned boolean default false; exception when others then perform setup_fail('alter table prompts add column if not exists pinne', sqlerrm); end $s$;
do $s$ begin alter table prompts add column if not exists created_at timestamptz default now(); exception when others then perform setup_fail('alter table prompts add column if not exists creat', sqlerrm); end $s$;
do $s$ begin alter table likes add column if not exists user_id uuid; exception when others then perform setup_fail('alter table likes add column if not exists user_id', sqlerrm); end $s$;
do $s$ begin alter table likes add column if not exists prompt_id uuid; exception when others then perform setup_fail('alter table likes add column if not exists prompt_', sqlerrm); end $s$;
do $s$ begin alter table saves add column if not exists user_id uuid; exception when others then perform setup_fail('alter table saves add column if not exists user_id', sqlerrm); end $s$;
do $s$ begin alter table saves add column if not exists prompt_id uuid; exception when others then perform setup_fail('alter table saves add column if not exists prompt_', sqlerrm); end $s$;
do $s$ begin alter table follows add column if not exists follower_id uuid; exception when others then perform setup_fail('alter table follows add column if not exists follo', sqlerrm); end $s$;
do $s$ begin alter table follows add column if not exists following_id uuid; exception when others then perform setup_fail('alter table follows add column if not exists follo', sqlerrm); end $s$;
do $s$ begin alter table follows add column if not exists status text not null default 'accepted'; exception when others then perform setup_fail('alter table follows add column if not exists statu', sqlerrm); end $s$;
do $s$ begin alter table comments add column if not exists prompt_id uuid; exception when others then perform setup_fail('alter table comments add column if not exists prom', sqlerrm); end $s$;
do $s$ begin alter table comments add column if not exists author_id uuid; exception when others then perform setup_fail('alter table comments add column if not exists auth', sqlerrm); end $s$;
do $s$ begin alter table comments add column if not exists body text; exception when others then perform setup_fail('alter table comments add column if not exists body', sqlerrm); end $s$;
do $s$ begin alter table comments add column if not exists created_at timestamptz default now(); exception when others then perform setup_fail('alter table comments add column if not exists crea', sqlerrm); end $s$;
do $s$ begin alter table library add column if not exists user_id uuid; exception when others then perform setup_fail('alter table library add column if not exists user_', sqlerrm); end $s$;
do $s$ begin alter table library add column if not exists body text; exception when others then perform setup_fail('alter table library add column if not exists body ', sqlerrm); end $s$;
do $s$ begin alter table library add column if not exists enhanced text; exception when others then perform setup_fail('alter table library add column if not exists enhan', sqlerrm); end $s$;
do $s$ begin alter table library add column if not exists category_id int; exception when others then perform setup_fail('alter table library add column if not exists categ', sqlerrm); end $s$;
do $s$ begin alter table library add column if not exists model text; exception when others then perform setup_fail('alter table library add column if not exists model', sqlerrm); end $s$;
do $s$ begin alter table library add column if not exists created_at timestamptz default now(); exception when others then perform setup_fail('alter table library add column if not exists creat', sqlerrm); end $s$;
do $s$ begin alter table notifications add column if not exists user_id uuid; exception when others then perform setup_fail('alter table notifications add column if not exists', sqlerrm); end $s$;
do $s$ begin alter table notifications add column if not exists title text; exception when others then perform setup_fail('alter table notifications add column if not exists', sqlerrm); end $s$;
do $s$ begin alter table notifications add column if not exists body text; exception when others then perform setup_fail('alter table notifications add column if not exists', sqlerrm); end $s$;
do $s$ begin alter table notifications add column if not exists link text; exception when others then perform setup_fail('alter table notifications add column if not exists', sqlerrm); end $s$;
do $s$ begin alter table notifications add column if not exists read boolean default false; exception when others then perform setup_fail('alter table notifications add column if not exists', sqlerrm); end $s$;
do $s$ begin alter table notifications add column if not exists kind text default 'event'; exception when others then perform setup_fail('alter table notifications add column if not exists', sqlerrm); end $s$;
do $s$ begin alter table notifications add column if not exists created_at timestamptz default now(); exception when others then perform setup_fail('alter table notifications add column if not exists', sqlerrm); end $s$;
do $s$ begin alter table push_tokens add column if not exists user_id uuid; exception when others then perform setup_fail('alter table push_tokens add column if not exists u', sqlerrm); end $s$;
do $s$ begin alter table push_tokens add column if not exists platform text; exception when others then perform setup_fail('alter table push_tokens add column if not exists p', sqlerrm); end $s$;
do $s$ begin alter table push_tokens add column if not exists updated_at timestamptz default now(); exception when others then perform setup_fail('alter table push_tokens add column if not exists u', sqlerrm); end $s$;
do $s$ begin alter table reports add column if not exists prompt_id uuid; exception when others then perform setup_fail('alter table reports add column if not exists promp', sqlerrm); end $s$;
do $s$ begin alter table reports add column if not exists reporter_id uuid; exception when others then perform setup_fail('alter table reports add column if not exists repor', sqlerrm); end $s$;
do $s$ begin alter table reports add column if not exists reason text; exception when others then perform setup_fail('alter table reports add column if not exists reaso', sqlerrm); end $s$;
do $s$ begin alter table reports add column if not exists resolved boolean not null default false; exception when others then perform setup_fail('alter table reports add column if not exists resol', sqlerrm); end $s$;
do $s$ begin alter table reports add column if not exists created_at timestamptz default now(); exception when others then perform setup_fail('alter table reports add column if not exists creat', sqlerrm); end $s$;
do $s$ begin alter table blocks add column if not exists blocker_id uuid; exception when others then perform setup_fail('alter table blocks add column if not exists blocke', sqlerrm); end $s$;
do $s$ begin alter table blocks add column if not exists blocked_id uuid; exception when others then perform setup_fail('alter table blocks add column if not exists blocke', sqlerrm); end $s$;
do $s$ begin alter table blocks add column if not exists created_at timestamptz default now(); exception when others then perform setup_fail('alter table blocks add column if not exists create', sqlerrm); end $s$;
do $s$ begin alter table audit_log add column if not exists actor uuid; exception when others then perform setup_fail('alter table audit_log add column if not exists act', sqlerrm); end $s$;
do $s$ begin alter table audit_log add column if not exists action text; exception when others then perform setup_fail('alter table audit_log add column if not exists act', sqlerrm); end $s$;
do $s$ begin alter table audit_log add column if not exists target text; exception when others then perform setup_fail('alter table audit_log add column if not exists tar', sqlerrm); end $s$;
do $s$ begin alter table audit_log add column if not exists meta jsonb; exception when others then perform setup_fail('alter table audit_log add column if not exists met', sqlerrm); end $s$;
do $s$ begin alter table audit_log add column if not exists created_at timestamptz default now(); exception when others then perform setup_fail('alter table audit_log add column if not exists cre', sqlerrm); end $s$;
do $s$ begin alter table error_log add column if not exists source text; exception when others then perform setup_fail('alter table error_log add column if not exists sou', sqlerrm); end $s$;
do $s$ begin alter table error_log add column if not exists message text; exception when others then perform setup_fail('alter table error_log add column if not exists mes', sqlerrm); end $s$;
do $s$ begin alter table error_log add column if not exists created_at timestamptz default now(); exception when others then perform setup_fail('alter table error_log add column if not exists cre', sqlerrm); end $s$;
do $s$ begin alter table usage add column if not exists user_id uuid; exception when others then perform setup_fail('alter table usage add column if not exists user_id', sqlerrm); end $s$;
do $s$ begin alter table usage add column if not exists model text; exception when others then perform setup_fail('alter table usage add column if not exists model t', sqlerrm); end $s$;
do $s$ begin alter table usage add column if not exists created_at timestamptz default now(); exception when others then perform setup_fail('alter table usage add column if not exists created', sqlerrm); end $s$;
do $s$ begin alter table settings add column if not exists value jsonb; exception when others then perform setup_fail('alter table settings add column if not exists valu', sqlerrm); end $s$;
do $s$ begin alter table rate_hits add column if not exists user_id uuid; exception when others then perform setup_fail('alter table rate_hits add column if not exists use', sqlerrm); end $s$;
do $s$ begin alter table rate_hits add column if not exists ts timestamptz not null default now(); exception when others then perform setup_fail('alter table rate_hits add column if not exists ts ', sqlerrm); end $s$;
do $s$ begin create unique index if not exists profiles_username_uq on profiles (username); exception when others then perform setup_fail('create unique index if not exists profiles_usernam', sqlerrm); end $s$;
do $s$ begin create unique index if not exists categories_slug_uq on categories (slug); exception when others then perform setup_fail('create unique index if not exists categories_slug_', sqlerrm); end $s$;
do $s$ begin create or replace function setup_fk(t text, c text, rt text, rc text, ondel text) returns void language plpgsql as $$
begin
  if not exists (select 1 from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any(k.conkey)
                 where k.contype = 'f' and k.conrelid = ('public.' || t)::regclass and a.attname = c) then
    execute format('alter table public.%I add constraint %I foreign key (%I) references public.%I (%I) on delete %s', t, t || '_' || c || '_fkey', c, rt, rc, ondel);
  end if;
end $$; exception when others then perform setup_fail('create or replace function setup_fk(t text, c text', sqlerrm); end $s$;
do $s$ begin perform setup_fk('prompts', 'author_id', 'profiles', 'id', 'cascade'); exception when others then perform setup_fail('perform setup_fk(''prompts'', ''author_id'', ''profiles', sqlerrm); end $s$;
do $s$ begin perform setup_fk('prompts', 'category_id', 'categories', 'id', 'set null'); exception when others then perform setup_fail('perform setup_fk(''prompts'', ''category_id'', ''catego', sqlerrm); end $s$;
do $s$ begin perform setup_fk('likes', 'user_id', 'profiles', 'id', 'cascade'); exception when others then perform setup_fail('perform setup_fk(''likes'', ''user_id'', ''profiles'', ''', sqlerrm); end $s$;
do $s$ begin perform setup_fk('likes', 'prompt_id', 'prompts', 'id', 'cascade'); exception when others then perform setup_fail('perform setup_fk(''likes'', ''prompt_id'', ''prompts'', ', sqlerrm); end $s$;
do $s$ begin perform setup_fk('saves', 'user_id', 'profiles', 'id', 'cascade'); exception when others then perform setup_fail('perform setup_fk(''saves'', ''user_id'', ''profiles'', ''', sqlerrm); end $s$;
do $s$ begin perform setup_fk('saves', 'prompt_id', 'prompts', 'id', 'cascade'); exception when others then perform setup_fail('perform setup_fk(''saves'', ''prompt_id'', ''prompts'', ', sqlerrm); end $s$;
do $s$ begin perform setup_fk('follows', 'follower_id', 'profiles', 'id', 'cascade'); exception when others then perform setup_fail('perform setup_fk(''follows'', ''follower_id'', ''profil', sqlerrm); end $s$;
do $s$ begin perform setup_fk('follows', 'following_id', 'profiles', 'id', 'cascade'); exception when others then perform setup_fail('perform setup_fk(''follows'', ''following_id'', ''profi', sqlerrm); end $s$;
do $s$ begin perform setup_fk('comments', 'prompt_id', 'prompts', 'id', 'cascade'); exception when others then perform setup_fail('perform setup_fk(''comments'', ''prompt_id'', ''prompts', sqlerrm); end $s$;
do $s$ begin perform setup_fk('comments', 'author_id', 'profiles', 'id', 'cascade'); exception when others then perform setup_fail('perform setup_fk(''comments'', ''author_id'', ''profile', sqlerrm); end $s$;
do $s$ begin perform setup_fk('library', 'user_id', 'profiles', 'id', 'cascade'); exception when others then perform setup_fail('perform setup_fk(''library'', ''user_id'', ''profiles'',', sqlerrm); end $s$;
do $s$ begin perform setup_fk('library', 'category_id', 'categories', 'id', 'set null'); exception when others then perform setup_fail('perform setup_fk(''library'', ''category_id'', ''catego', sqlerrm); end $s$;
do $s$ begin perform setup_fk('notifications', 'user_id', 'profiles', 'id', 'cascade'); exception when others then perform setup_fail('perform setup_fk(''notifications'', ''user_id'', ''prof', sqlerrm); end $s$;
do $s$ begin perform setup_fk('push_tokens', 'user_id', 'profiles', 'id', 'cascade'); exception when others then perform setup_fail('perform setup_fk(''push_tokens'', ''user_id'', ''profil', sqlerrm); end $s$;
do $s$ begin perform setup_fk('reports', 'prompt_id', 'prompts', 'id', 'cascade'); exception when others then perform setup_fail('perform setup_fk(''reports'', ''prompt_id'', ''prompts''', sqlerrm); end $s$;
do $s$ begin perform setup_fk('reports', 'reporter_id', 'profiles', 'id', 'cascade'); exception when others then perform setup_fail('perform setup_fk(''reports'', ''reporter_id'', ''profil', sqlerrm); end $s$;
do $s$ begin perform setup_fk('blocks', 'blocker_id', 'profiles', 'id', 'cascade'); exception when others then perform setup_fail('perform setup_fk(''blocks'', ''blocker_id'', ''profiles', sqlerrm); end $s$;
do $s$ begin perform setup_fk('blocks', 'blocked_id', 'profiles', 'id', 'cascade'); exception when others then perform setup_fail('perform setup_fk(''blocks'', ''blocked_id'', ''profiles', sqlerrm); end $s$;
do $s$ begin create or replace function not_banned() returns boolean language sql stable security definer set search_path = public as
$$ select not coalesce((select banned from profiles where id = auth.uid()), false) $$; exception when others then perform setup_fail('create or replace function not_banned() returns bo', sqlerrm); end $s$;
do $s$ begin create or replace function flag_on(k text) returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select (value ->> k)::boolean from settings where key = 'flags'), true) $$; exception when others then perform setup_fail('create or replace function flag_on(k text) returns', sqlerrm); end $s$;
do $s$ begin create or replace function can_view(a uuid) returns boolean language sql stable security definer set search_path = public as
$$ select a = auth.uid() or (
     (not coalesce((select is_private from profiles where id = a), false)
      or exists (select 1 from follows where follower_id = auth.uid() and following_id = a and status = 'accepted'))
     and not exists (select 1 from blocks where (blocker_id = auth.uid() and blocked_id = a) or (blocker_id = a and blocked_id = auth.uid()))) $$; exception when others then perform setup_fail('create or replace function can_view(a uuid) return', sqlerrm); end $s$;
do $s$ begin create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not flag_on('signups') then raise exception 'signups_disabled'; end if;
  insert into profiles (id, username, display_name, avatar_url)
  values (new.id, lower(regexp_replace(split_part(new.email,'@',1), '[^a-zA-Z0-9_]', '', 'g')) || substr(new.id::text,1,4),
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$; exception when others then perform setup_fail('create or replace function handle_new_user() retur', sqlerrm); end $s$;
do $s$ begin create or replace function bump_likes() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update prompts set like_count = like_count + 1 where id = new.prompt_id;
  else update prompts set like_count = greatest(like_count - 1, 0) where id = old.prompt_id; end if;
  return null;
end $$; exception when others then perform setup_fail('create or replace function bump_likes() returns tr', sqlerrm); end $s$;
do $s$ begin create or replace function bump_comments() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update prompts set comment_count = comment_count + 1 where id = new.prompt_id;
  else update prompts set comment_count = greatest(comment_count - 1, 0) where id = old.prompt_id; end if;
  return null;
end $$; exception when others then perform setup_fail('create or replace function bump_comments() returns', sqlerrm); end $s$;
do $s$ begin create or replace function notify_like() returns trigger language plpgsql security definer set search_path = public as $$
declare a uuid; n text;
begin
  select author_id into a from prompts where id = new.prompt_id;
  if a is not null and a <> new.user_id then
    select coalesce(display_name, username) into n from profiles where id = new.user_id;
    insert into notifications (user_id, title, body, link) values (a, 'إعجاب جديد', coalesce(n, 'مستخدم') || ' أعجبه برومبتك', '/p/' || new.prompt_id);
  end if; return null;
end $$; exception when others then perform setup_fail('create or replace function notify_like() returns t', sqlerrm); end $s$;
do $s$ begin create or replace function notify_comment() returns trigger language plpgsql security definer set search_path = public as $$
declare a uuid; n text;
begin
  select author_id into a from prompts where id = new.prompt_id;
  if a is not null and a <> new.author_id then
    select coalesce(display_name, username) into n from profiles where id = new.author_id;
    insert into notifications (user_id, title, body, link) values (a, 'تعليق جديد', coalesce(n, 'مستخدم') || ': ' || left(new.body, 80), '/p/' || new.prompt_id);
  end if; return null;
end $$; exception when others then perform setup_fail('create or replace function notify_comment() return', sqlerrm); end $s$;
do $s$ begin create or replace function follow_status() returns trigger language plpgsql security definer set search_path = public as $$
begin  -- الخادم يحدد الحالة (pending للحساب الخاص)؛ يعمل قبل فحص سياسات RLS
  new.status := case when coalesce((select is_private from profiles where id = new.following_id), false) then 'pending' else 'accepted' end;
  return new;
end $$; exception when others then perform setup_fail('create or replace function follow_status() returns', sqlerrm); end $s$;
do $s$ begin create or replace function notify_follow() returns trigger language plpgsql security definer set search_path = public as $$
declare n text;
begin
  select coalesce(display_name, username) into n from profiles where id = new.follower_id;
  if new.status = 'pending' then
    insert into notifications (user_id, title, body, link) values (new.following_id, 'طلب متابعة', coalesce(n, 'مستخدم') || ' يطلب متابعتك', '/requests');
  else
    insert into notifications (user_id, title, body, link) values (new.following_id, 'متابع جديد', coalesce(n, 'مستخدم') || ' بدأ بمتابعتك', '/profile/' || new.follower_id);
  end if; return null;
end $$; exception when others then perform setup_fail('create or replace function notify_follow() returns', sqlerrm); end $s$;
do $s$ begin create or replace function notify_follow_accept() returns trigger language plpgsql security definer set search_path = public as $$
declare n text;
begin
  if old.status = 'pending' and new.status = 'accepted' then
    select coalesce(display_name, username) into n from profiles where id = new.following_id;
    insert into notifications (user_id, title, body, link) values (new.follower_id, 'تم قبول طلبك', coalesce(n, 'مستخدم') || ' قبل طلب متابعتك', '/profile/' || new.following_id);
  end if; return null;
end $$; exception when others then perform setup_fail('create or replace function notify_follow_accept() ', sqlerrm); end $s$;
do $s$ begin create or replace function rate_hit(p_user uuid, p_limit int) returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from rate_hits where ts < now() - interval '2 minutes';
  select count(*) into n from rate_hits where user_id = p_user and ts > now() - interval '1 minute';
  if n >= p_limit then return false; end if;
  insert into rate_hits (user_id) values (p_user); return true;
end $$; exception when others then perform setup_fail('create or replace function rate_hit(p_user uuid, p', sqlerrm); end $s$;
do $s$ begin revoke execute on function rate_hit(uuid, int) from public, anon, authenticated; exception when others then perform setup_fail('revoke execute on function rate_hit(uuid, int) fro', sqlerrm); end $s$;
do $s$ begin drop trigger if exists on_auth_user_created on auth.users; exception when others then perform setup_fail('drop trigger if exists on_auth_user_created on aut', sqlerrm); end $s$;
do $s$ begin create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user(); exception when others then perform setup_fail('create trigger on_auth_user_created after insert o', sqlerrm); end $s$;
do $s$ begin drop trigger if exists likes_count on likes; exception when others then perform setup_fail('drop trigger if exists likes_count on likes', sqlerrm); end $s$;
do $s$ begin create trigger likes_count after insert or delete on likes for each row execute function bump_likes(); exception when others then perform setup_fail('create trigger likes_count after insert or delete ', sqlerrm); end $s$;
do $s$ begin drop trigger if exists comments_count on comments; exception when others then perform setup_fail('drop trigger if exists comments_count on comments', sqlerrm); end $s$;
do $s$ begin create trigger comments_count after insert or delete on comments for each row execute function bump_comments(); exception when others then perform setup_fail('create trigger comments_count after insert or dele', sqlerrm); end $s$;
do $s$ begin drop trigger if exists likes_notify on likes; exception when others then perform setup_fail('drop trigger if exists likes_notify on likes', sqlerrm); end $s$;
do $s$ begin create trigger likes_notify after insert on likes for each row execute function notify_like(); exception when others then perform setup_fail('create trigger likes_notify after insert on likes ', sqlerrm); end $s$;
do $s$ begin drop trigger if exists comments_notify on comments; exception when others then perform setup_fail('drop trigger if exists comments_notify on comments', sqlerrm); end $s$;
do $s$ begin create trigger comments_notify after insert on comments for each row execute function notify_comment(); exception when others then perform setup_fail('create trigger comments_notify after insert on com', sqlerrm); end $s$;
do $s$ begin drop trigger if exists follows_status on follows; exception when others then perform setup_fail('drop trigger if exists follows_status on follows', sqlerrm); end $s$;
do $s$ begin create trigger follows_status before insert on follows for each row execute function follow_status(); exception when others then perform setup_fail('create trigger follows_status before insert on fol', sqlerrm); end $s$;
do $s$ begin drop trigger if exists follows_notify on follows; exception when others then perform setup_fail('drop trigger if exists follows_notify on follows', sqlerrm); end $s$;
do $s$ begin create trigger follows_notify after insert on follows for each row execute function notify_follow(); exception when others then perform setup_fail('create trigger follows_notify after insert on foll', sqlerrm); end $s$;
do $s$ begin drop trigger if exists follows_accept on follows; exception when others then perform setup_fail('drop trigger if exists follows_accept on follows', sqlerrm); end $s$;
do $s$ begin create trigger follows_accept after update on follows for each row execute function notify_follow_accept(); exception when others then perform setup_fail('create trigger follows_accept after update on foll', sqlerrm); end $s$;
do $s$ begin alter table profiles enable row level security; exception when others then perform setup_fail('alter table profiles enable row level security', sqlerrm); end $s$;
do $s$ begin alter table categories enable row level security; exception when others then perform setup_fail('alter table categories enable row level security', sqlerrm); end $s$;
do $s$ begin alter table prompts enable row level security; exception when others then perform setup_fail('alter table prompts enable row level security', sqlerrm); end $s$;
do $s$ begin alter table likes enable row level security; exception when others then perform setup_fail('alter table likes enable row level security', sqlerrm); end $s$;
do $s$ begin alter table saves enable row level security; exception when others then perform setup_fail('alter table saves enable row level security', sqlerrm); end $s$;
do $s$ begin alter table follows enable row level security; exception when others then perform setup_fail('alter table follows enable row level security', sqlerrm); end $s$;
do $s$ begin alter table comments enable row level security; exception when others then perform setup_fail('alter table comments enable row level security', sqlerrm); end $s$;
do $s$ begin alter table library enable row level security; exception when others then perform setup_fail('alter table library enable row level security', sqlerrm); end $s$;
do $s$ begin alter table notifications enable row level security; exception when others then perform setup_fail('alter table notifications enable row level securit', sqlerrm); end $s$;
do $s$ begin alter table push_tokens enable row level security; exception when others then perform setup_fail('alter table push_tokens enable row level security', sqlerrm); end $s$;
do $s$ begin alter table reports enable row level security; exception when others then perform setup_fail('alter table reports enable row level security', sqlerrm); end $s$;
do $s$ begin alter table blocks enable row level security; exception when others then perform setup_fail('alter table blocks enable row level security', sqlerrm); end $s$;
do $s$ begin alter table audit_log enable row level security; exception when others then perform setup_fail('alter table audit_log enable row level security', sqlerrm); end $s$;
do $s$ begin alter table error_log enable row level security; exception when others then perform setup_fail('alter table error_log enable row level security', sqlerrm); end $s$;
do $s$ begin alter table usage enable row level security; exception when others then perform setup_fail('alter table usage enable row level security', sqlerrm); end $s$;
do $s$ begin alter table settings enable row level security; exception when others then perform setup_fail('alter table settings enable row level security', sqlerrm); end $s$;
do $s$ begin alter table rate_hits enable row level security; exception when others then perform setup_fail('alter table rate_hits enable row level security', sqlerrm); end $s$;
do $s$ begin do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' and tablename in ('profiles','categories','prompts','likes','saves','follows','comments','library','notifications','push_tokens','reports','blocks','audit_log','error_log','usage','settings','rate_hits') loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$; exception when others then perform setup_fail('do $$ declare r record; begin for r in select poli', sqlerrm); end $s$;
do $s$ begin drop policy if exists "read profiles" on profiles; exception when others then perform setup_fail('drop policy if exists "read profiles" on profiles', sqlerrm); end $s$;
do $s$ begin create policy "read profiles" on profiles for select using (true); exception when others then perform setup_fail('create policy "read profiles" on profiles for sele', sqlerrm); end $s$;
do $s$ begin drop policy if exists "insert own profile" on profiles; exception when others then perform setup_fail('drop policy if exists "insert own profile" on prof', sqlerrm); end $s$;
do $s$ begin create policy "insert own profile" on profiles for insert with check (auth.uid() = id and role = 'user' and banned = false); exception when others then perform setup_fail('create policy "insert own profile" on profiles for', sqlerrm); end $s$;
do $s$ begin drop policy if exists "edit own profile" on profiles; exception when others then perform setup_fail('drop policy if exists "edit own profile" on profil', sqlerrm); end $s$;
do $s$ begin create policy "edit own profile" on profiles for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from profiles where id = auth.uid()) and banned = (select banned from profiles where id = auth.uid())); exception when others then perform setup_fail('create policy "edit own profile" on profiles for u', sqlerrm); end $s$;
do $s$ begin drop policy if exists "read categories" on categories; exception when others then perform setup_fail('drop policy if exists "read categories" on categor', sqlerrm); end $s$;
do $s$ begin create policy "read categories" on categories for select using (true); exception when others then perform setup_fail('create policy "read categories" on categories for ', sqlerrm); end $s$;
do $s$ begin drop policy if exists "read prompts" on prompts; exception when others then perform setup_fail('drop policy if exists "read prompts" on prompts', sqlerrm); end $s$;
do $s$ begin create policy "read prompts" on prompts for select using (can_view(author_id)); exception when others then perform setup_fail('create policy "read prompts" on prompts for select', sqlerrm); end $s$;
do $s$ begin drop policy if exists "insert own prompts" on prompts; exception when others then perform setup_fail('drop policy if exists "insert own prompts" on prom', sqlerrm); end $s$;
do $s$ begin create policy "insert own prompts" on prompts for insert with check (auth.uid() = author_id and not_banned() and flag_on('publishing')); exception when others then perform setup_fail('create policy "insert own prompts" on prompts for ', sqlerrm); end $s$;
do $s$ begin drop policy if exists "edit own prompts" on prompts; exception when others then perform setup_fail('drop policy if exists "edit own prompts" on prompt', sqlerrm); end $s$;
do $s$ begin create policy "edit own prompts" on prompts for update using (auth.uid() = author_id); exception when others then perform setup_fail('create policy "edit own prompts" on prompts for up', sqlerrm); end $s$;
do $s$ begin drop policy if exists "delete own prompts" on prompts; exception when others then perform setup_fail('drop policy if exists "delete own prompts" on prom', sqlerrm); end $s$;
do $s$ begin create policy "delete own prompts" on prompts for delete using (auth.uid() = author_id); exception when others then perform setup_fail('create policy "delete own prompts" on prompts for ', sqlerrm); end $s$;
do $s$ begin drop policy if exists "own likes" on likes; exception when others then perform setup_fail('drop policy if exists "own likes" on likes', sqlerrm); end $s$;
do $s$ begin create policy "own likes" on likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id and not_banned()); exception when others then perform setup_fail('create policy "own likes" on likes for all using (', sqlerrm); end $s$;
do $s$ begin drop policy if exists "own saves" on saves; exception when others then perform setup_fail('drop policy if exists "own saves" on saves', sqlerrm); end $s$;
do $s$ begin create policy "own saves" on saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id and not_banned()); exception when others then perform setup_fail('create policy "own saves" on saves for all using (', sqlerrm); end $s$;
do $s$ begin drop policy if exists "read follows" on follows; exception when others then perform setup_fail('drop policy if exists "read follows" on follows', sqlerrm); end $s$;
do $s$ begin create policy "read follows" on follows for select using (true); exception when others then perform setup_fail('create policy "read follows" on follows for select', sqlerrm); end $s$;
do $s$ begin drop policy if exists "own follows" on follows; exception when others then perform setup_fail('drop policy if exists "own follows" on follows', sqlerrm); end $s$;
do $s$ begin drop policy if exists "follow insert" on follows; exception when others then perform setup_fail('drop policy if exists "follow insert" on follows', sqlerrm); end $s$;
do $s$ begin create policy "follow insert" on follows for insert with check (auth.uid() = follower_id and not_banned()); exception when others then perform setup_fail('create policy "follow insert" on follows for inser', sqlerrm); end $s$;
do $s$ begin drop policy if exists "follow delete" on follows; exception when others then perform setup_fail('drop policy if exists "follow delete" on follows', sqlerrm); end $s$;
do $s$ begin create policy "follow delete" on follows for delete using (auth.uid() = follower_id or auth.uid() = following_id); exception when others then perform setup_fail('create policy "follow delete" on follows for delet', sqlerrm); end $s$;
do $s$ begin drop policy if exists "follow accept" on follows; exception when others then perform setup_fail('drop policy if exists "follow accept" on follows', sqlerrm); end $s$;
do $s$ begin create policy "follow accept" on follows for update using (auth.uid() = following_id) with check (auth.uid() = following_id and status = 'accepted'); exception when others then perform setup_fail('create policy "follow accept" on follows for updat', sqlerrm); end $s$;
do $s$ begin drop policy if exists "read comments" on comments; exception when others then perform setup_fail('drop policy if exists "read comments" on comments', sqlerrm); end $s$;
do $s$ begin create policy "read comments" on comments for select using (true); exception when others then perform setup_fail('create policy "read comments" on comments for sele', sqlerrm); end $s$;
do $s$ begin drop policy if exists "own comments" on comments; exception when others then perform setup_fail('drop policy if exists "own comments" on comments', sqlerrm); end $s$;
do $s$ begin create policy "own comments" on comments for insert with check (auth.uid() = author_id and not_banned()); exception when others then perform setup_fail('create policy "own comments" on comments for inser', sqlerrm); end $s$;
do $s$ begin drop policy if exists "delete own comments" on comments; exception when others then perform setup_fail('drop policy if exists "delete own comments" on com', sqlerrm); end $s$;
do $s$ begin create policy "delete own comments" on comments for delete using (auth.uid() = author_id); exception when others then perform setup_fail('create policy "delete own comments" on comments fo', sqlerrm); end $s$;
do $s$ begin drop policy if exists "own library" on library; exception when others then perform setup_fail('drop policy if exists "own library" on library', sqlerrm); end $s$;
do $s$ begin create policy "own library" on library for all using (auth.uid() = user_id) with check (auth.uid() = user_id and not_banned()); exception when others then perform setup_fail('create policy "own library" on library for all usi', sqlerrm); end $s$;
do $s$ begin drop policy if exists "read own notifications" on notifications; exception when others then perform setup_fail('drop policy if exists "read own notifications" on ', sqlerrm); end $s$;
do $s$ begin create policy "read own notifications" on notifications for select using (auth.uid() = user_id); exception when others then perform setup_fail('create policy "read own notifications" on notifica', sqlerrm); end $s$;
do $s$ begin drop policy if exists "update own notifications" on notifications; exception when others then perform setup_fail('drop policy if exists "update own notifications" o', sqlerrm); end $s$;
do $s$ begin create policy "update own notifications" on notifications for update using (auth.uid() = user_id); exception when others then perform setup_fail('create policy "update own notifications" on notifi', sqlerrm); end $s$;
do $s$ begin drop policy if exists "own tokens" on push_tokens; exception when others then perform setup_fail('drop policy if exists "own tokens" on push_tokens', sqlerrm); end $s$;
do $s$ begin create policy "own tokens" on push_tokens for all using (auth.uid() = user_id) with check (auth.uid() = user_id); exception when others then perform setup_fail('create policy "own tokens" on push_tokens for all ', sqlerrm); end $s$;
do $s$ begin drop policy if exists "insert own report" on reports; exception when others then perform setup_fail('drop policy if exists "insert own report" on repor', sqlerrm); end $s$;
do $s$ begin create policy "insert own report" on reports for insert with check (auth.uid() = reporter_id and not_banned()); exception when others then perform setup_fail('create policy "insert own report" on reports for i', sqlerrm); end $s$;
do $s$ begin drop policy if exists "own blocks" on blocks; exception when others then perform setup_fail('drop policy if exists "own blocks" on blocks', sqlerrm); end $s$;
do $s$ begin create policy "own blocks" on blocks for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id); exception when others then perform setup_fail('create policy "own blocks" on blocks for all using', sqlerrm); end $s$;
do $s$ begin insert into storage.buckets (id, name, public) values ('prompts', 'prompts', true) on conflict (id) do nothing; exception when others then perform setup_fail('insert into storage.buckets (id, name, public) val', sqlerrm); end $s$;
do $s$ begin do $$ begin
  drop policy if exists "public read prompts" on storage.objects;
  create policy "public read prompts" on storage.objects for select using (bucket_id = 'prompts');
  drop policy if exists "upload own folder" on storage.objects;
  create policy "upload own folder" on storage.objects for insert with check (bucket_id = 'prompts' and (storage.foldername(name))[1] = auth.uid()::text);
  drop policy if exists "delete own folder" on storage.objects;
  create policy "delete own folder" on storage.objects for delete using (bucket_id = 'prompts' and (storage.foldername(name))[1] = auth.uid()::text);
exception when insufficient_privilege then
  raise notice 'تعذّر إنشاء سياسات التخزين من هنا: أنشئها من Dashboard → Storage → Policies';
end $$; exception when others then perform setup_fail('do $$ begin drop policy if exists "public read pro', sqlerrm); end $s$;
do $s$ begin do $$ begin alter publication supabase_realtime add table prompts;       exception when duplicate_object then null; end $$; exception when others then perform setup_fail('do $$ begin alter publication supabase_realtime ad', sqlerrm); end $s$;
do $s$ begin do $$ begin alter publication supabase_realtime add table notifications; exception when duplicate_object then null; end $$; exception when others then perform setup_fail('do $$ begin alter publication supabase_realtime ad', sqlerrm); end $s$;
do $s$ begin do $$ begin alter publication supabase_realtime add table comments;      exception when duplicate_object then null; end $$; exception when others then perform setup_fail('do $$ begin alter publication supabase_realtime ad', sqlerrm); end $s$;
do $s$ begin insert into categories (slug, name_ar, sort) values
('writing','كتابة',1),('coding','برمجة',2),('design','تصميم',3),('marketing','تسويق',4),('education','تعليم',5),
('translation','ترجمة',6),('images','صور',7),('video','فيديو',8),('audio','صوت',9),('business','أعمال',10),('creative','إبداع',11),('social','محتوى سوشيال',12),('shops','متاجر ومبيعات',13),('beginners','للمبتدئين',14)
on conflict (slug) do nothing; exception when others then perform setup_fail('insert into categories (slug, name_ar, sort) value', sqlerrm); end $s$;
do $s$ begin insert into profiles (id, username, display_name)
select id, lower(regexp_replace(split_part(email,'@',1), '[^a-zA-Z0-9_]', '', 'g')) || substr(id::text,1,4), split_part(email,'@',1)
from auth.users on conflict (id) do nothing; exception when others then perform setup_fail('insert into profiles (id, username, display_name) ', sqlerrm); end $s$;
do $s$ begin alter table prompts add column if not exists forked_from uuid; exception when others then perform setup_fail('alter table prompts add column if not exists forke', sqlerrm); end $s$;
do $s$ begin alter table prompts add column if not exists fork_count int not null default 0; exception when others then perform setup_fail('alter table prompts add column if not exists fork_', sqlerrm); end $s$;
do $s$ begin alter table prompts add column if not exists copy_count int not null default 0; exception when others then perform setup_fail('alter table prompts add column if not exists copy_', sqlerrm); end $s$;
do $s$ begin perform setup_fk('prompts', 'forked_from', 'prompts', 'id', 'set null'); exception when others then perform setup_fail('perform setup_fk(''prompts'', ''forked_from'', ''prompt', sqlerrm); end $s$;
do $s$ begin create table if not exists prompt_versions (id uuid primary key default gen_random_uuid(), prompt_id uuid not null references prompts on delete cascade, author_id uuid not null references profiles on delete cascade, body text, enhanced text, created_at timestamptz default now()); exception when others then perform setup_fail('create table if not exists prompt_versions (id uui', sqlerrm); end $s$;
do $s$ begin create index if not exists prompt_versions_idx on prompt_versions (prompt_id, created_at desc); exception when others then perform setup_fail('create index if not exists prompt_versions_idx on ', sqlerrm); end $s$;
do $s$ begin alter table prompt_versions enable row level security; exception when others then perform setup_fail('alter table prompt_versions enable row level secur', sqlerrm); end $s$;
do $s$ begin drop policy if exists "own versions" on prompt_versions; exception when others then perform setup_fail('drop policy if exists "own versions" on prompt_ver', sqlerrm); end $s$;
do $s$ begin create policy "own versions" on prompt_versions for all using (auth.uid() = author_id) with check (auth.uid() = author_id); exception when others then perform setup_fail('create policy "own versions" on prompt_versions fo', sqlerrm); end $s$;
do $s$ begin create or replace function bump_copy(p_id uuid) returns void language sql security definer set search_path = public as $$
  update prompts set copy_count = copy_count + 1 where id = p_id and author_id is distinct from auth.uid() $$; exception when others then perform setup_fail('create or replace function bump_copy(p_id uuid) re', sqlerrm); end $s$;
do $s$ begin create or replace function bump_fork() returns trigger language plpgsql security definer set search_path = public as $$
declare a uuid; n text;
begin
  if new.forked_from is null then return null; end if;
  update prompts set fork_count = fork_count + 1 where id = new.forked_from;
  select author_id into a from prompts where id = new.forked_from;
  if a is not null and a <> new.author_id then
    select coalesce(display_name, username) into n from profiles where id = new.author_id;
    insert into notifications (user_id, title, body, link) values (a, 'تفريع جديد', coalesce(n, 'مستخدم') || ' فرّع برومبتك', '/p/' || new.id);
  end if;
  return null;
end $$; exception when others then perform setup_fail('create or replace function bump_fork() returns tri', sqlerrm); end $s$;
do $s$ begin drop trigger if exists prompts_fork on prompts; exception when others then perform setup_fail('drop trigger if exists prompts_fork on prompts', sqlerrm); end $s$;
do $s$ begin create trigger prompts_fork after insert on prompts for each row execute function bump_fork(); exception when others then perform setup_fail('create trigger prompts_fork after insert on prompt', sqlerrm); end $s$;
do $s$ begin create or replace function touch_streak(p_offset int default 0) returns json language plpgsql security definer set search_path = public as $$
declare s int; b int; l date; t date := ((now() at time zone 'utc') + make_interval(mins => p_offset))::date;
begin
  if auth.uid() is null then return json_build_object('streak', 0, 'best', 0, 'changed', false); end if;
  select streak, best_streak, last_active into s, b, l from profiles where id = auth.uid();
  if l = t then return json_build_object('streak', coalesce(s, 0), 'best', coalesce(b, 0), 'changed', false); end if;
  s := case when l = t - 1 then coalesce(s, 0) + 1 else 1 end;
  b := greatest(coalesce(b, 0), s);
  update profiles set streak = s, best_streak = b, last_active = t where id = auth.uid();
  return json_build_object('streak', s, 'best', b, 'changed', true);
end $$; exception when others then perform setup_fail('create or replace function touch_streak(p_offset i', sqlerrm); end $s$;
do $s$ begin notify pgrst, 'reload schema'; exception when others then perform setup_fail('notify pgrst, ''reload schema''', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists plan text not null default 'free'; exception when others then perform setup_fail('alter table profiles add column if not exists plan', sqlerrm); end $s$;
do $s$ begin alter table prompts add column if not exists title text; exception when others then perform setup_fail('alter table prompts add column if not exists title', sqlerrm); end $s$;
do $s$ begin alter table prompts add column if not exists tags text[] default '{}'; exception when others then perform setup_fail('alter table prompts add column if not exists tags ', sqlerrm); end $s$;
do $s$ begin create table if not exists ad_events (id bigserial primary key, slot text not null, kind text not null, created_at timestamptz not null default now()); exception when others then perform setup_fail('create table if not exists ad_events (id bigserial', sqlerrm); end $s$;
do $s$ begin create index if not exists ad_events_idx on ad_events (slot, kind, created_at desc); exception when others then perform setup_fail('create index if not exists ad_events_idx on ad_eve', sqlerrm); end $s$;
do $s$ begin alter table ad_events enable row level security; exception when others then perform setup_fail('alter table ad_events enable row level security', sqlerrm); end $s$;
do $s$ begin create or replace function rate_hit_window(p_user uuid, p_limit int, p_window int) returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from rate_hits where ts < now() - interval '2 days';
  select count(*) into n from rate_hits where user_id = p_user and ts > now() - make_interval(secs => p_window);
  if n >= p_limit then return false; end if;
  insert into rate_hits (user_id) values (p_user);
  return true;
end $$; exception when others then perform setup_fail('create or replace function rate_hit_window(p_user ', sqlerrm); end $s$;
do $s$ begin create or replace function rate_hit(p_user uuid, p_limit int) returns boolean language sql security definer set search_path = public as
$$ select rate_hit_window(p_user, p_limit, 60) $$; exception when others then perform setup_fail('create or replace function rate_hit(p_user uuid, p', sqlerrm); end $s$;
do $s$ begin revoke execute on function rate_hit_window(uuid, int, int) from public, anon, authenticated; exception when others then perform setup_fail('revoke execute on function rate_hit_window(uuid, i', sqlerrm); end $s$;
do $s$ begin revoke execute on function rate_hit(uuid, int) from public, anon, authenticated; exception when others then perform setup_fail('revoke execute on function rate_hit(uuid, int) fro', sqlerrm); end $s$;
do $s$ begin create or replace function caller_tier() returns text language sql stable security definer set search_path = public as
$$ select case when auth.uid() is null then 'guest'
     when coalesce((select plan from profiles where id = auth.uid()), 'free') = 'pro' then 'pro'
     else 'free' end $$; exception when others then perform setup_fail('create or replace function caller_tier() returns t', sqlerrm); end $s$;
do $s$ begin create or replace function prompt_gated(p_id uuid) returns json language plpgsql stable security definer set search_path = public as $$
declare r prompts; t text; ratio numeric; body_g text; enh_g text; base text; locked boolean; hid int;
begin
  select * into r from prompts where id = p_id;
  if r.id is null then return null; end if;
  if not can_view(r.author_id) then return null; end if;   -- يحترم الخصوصية والحظر
  t := caller_tier();
  if auth.uid() = r.author_id or t = 'pro' then
    return json_build_object('id', r.id, 'body', r.body, 'enhanced', r.enhanced, 'locked', false, 'hidden', 0,
      'title', r.title, 'tags', r.tags, 'images', r.images, 'category_id', r.category_id,
      'like_count', r.like_count, 'comment_count', r.comment_count, 'created_at', r.created_at,
      'author', (select json_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url, 'verified', p.verified, 'card_fx', p.card_fx) from profiles p where p.id = r.author_id));
  end if;
  ratio := case t when 'free' then coalesce((select (value->>'free')::numeric from settings where key = 'visibility'), 0.8)
                  else coalesce((select (value->>'guest')::numeric from settings where key = 'visibility'), 0.5) end;
  body_g := left(r.body, greatest(60, floor(coalesce(char_length(r.body), 0) * ratio)::int));
  enh_g := case when r.enhanced is null then null
                else left(r.enhanced, greatest(60, floor(char_length(r.enhanced) * ratio)::int)) end;
  base := coalesce(r.enhanced, r.body);
  locked := char_length(base) > coalesce(char_length(enh_g), char_length(body_g));
  hid := char_length(base) - coalesce(char_length(enh_g), char_length(body_g));
  return json_build_object('id', r.id, 'body', body_g, 'enhanced', enh_g, 'locked', locked, 'hidden', hid,
    'title', r.title, 'tags', r.tags, 'images', r.images, 'category_id', r.category_id,
    'like_count', r.like_count, 'comment_count', r.comment_count, 'created_at', r.created_at,
    'author', (select json_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url, 'verified', p.verified, 'card_fx', p.card_fx) from profiles p where p.id = r.author_id));
end $$; exception when others then perform setup_fail('create or replace function prompt_gated(p_id uuid)', sqlerrm); end $s$;
do $s$ begin grant execute on function prompt_gated(uuid) to anon, authenticated; exception when others then perform setup_fail('grant execute on function prompt_gated(uuid) to an', sqlerrm); end $s$;
do $s$ begin create or replace function prompts_gated(p_ids uuid[]) returns setof json language sql stable security definer set search_path = public as
$$ select prompt_gated(x) from unnest(p_ids) as x $$; exception when others then perform setup_fail('create or replace function prompts_gated(p_ids uui', sqlerrm); end $s$;
do $s$ begin grant execute on function prompts_gated(uuid[]) to anon, authenticated; exception when others then perform setup_fail('grant execute on function prompts_gated(uuid[]) to', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists verified boolean not null default false; exception when others then perform setup_fail('alter table profiles add column if not exists veri', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists verified_at timestamptz; exception when others then perform setup_fail('alter table profiles add column if not exists veri', sqlerrm); end $s$;
do $s$ begin create table if not exists verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  kind text not null default 'creator',
  note text,
  status text not null default 'pending',
  reviewed_by uuid references profiles on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
); exception when others then perform setup_fail('create table if not exists verification_requests (', sqlerrm); end $s$;
do $s$ begin create unique index if not exists verification_requests_pending_uq on verification_requests (user_id) where status = 'pending'; exception when others then perform setup_fail('create unique index if not exists verification_req', sqlerrm); end $s$;
do $s$ begin create index if not exists verification_requests_status_idx on verification_requests (status, created_at desc); exception when others then perform setup_fail('create index if not exists verification_requests_s', sqlerrm); end $s$;
do $s$ begin alter table verification_requests enable row level security; exception when others then perform setup_fail('alter table verification_requests enable row level', sqlerrm); end $s$;
do $s$ begin drop policy if exists "read own verification" on verification_requests; exception when others then perform setup_fail('drop policy if exists "read own verification" on v', sqlerrm); end $s$;
do $s$ begin create policy "read own verification" on verification_requests for select using (auth.uid() = user_id); exception when others then perform setup_fail('create policy "read own verification" on verificat', sqlerrm); end $s$;
do $s$ begin drop policy if exists "insert own verification" on verification_requests; exception when others then perform setup_fail('drop policy if exists "insert own verification" on', sqlerrm); end $s$;
do $s$ begin create policy "insert own verification" on verification_requests for insert with check (auth.uid() = user_id and not_banned()); exception when others then perform setup_fail('create policy "insert own verification" on verific', sqlerrm); end $s$;
do $s$ begin create or replace function verification_stats(p_user uuid default null) returns json language plpgsql stable security definer set search_path = public as $$
declare u uuid := coalesce(p_user, auth.uid()); v boolean; pn int; ln int; fn int; d int; req text;
begin
  if u is null then return json_build_object('ok', false, 'reason', 'auth'); end if;
  select coalesce(verified, false) into v from profiles where id = u;
  select count(*) into pn from prompts where author_id = u;
  select coalesce(sum(like_count), 0) into ln from prompts where author_id = u;
  select count(*) into fn from follows where following_id = u and status = 'accepted';
  select floor(extract(epoch from (now() - created_at)) / 86400)::int into d from profiles where id = u;
  select status into req from verification_requests where user_id = u order by created_at desc limit 1;
  return json_build_object('ok', true, 'verified', coalesce(v, false), 'status', req,
    'prompts', pn, 'min_prompts', 10,
    'likes', ln, 'min_likes', 100,
    'followers', fn, 'min_followers', 50,
    'days', coalesce(d, 0), 'min_days', 30,
    'eligible', (not coalesce(v, false)) and pn >= 10 and ln >= 100 and fn >= 50 and coalesce(d, 0) >= 30);
end $$; exception when others then perform setup_fail('create or replace function verification_stats(p_us', sqlerrm); end $s$;
do $s$ begin grant execute on function verification_stats(uuid) to authenticated; exception when others then perform setup_fail('grant execute on function verification_stats(uuid)', sqlerrm); end $s$;
do $s$ begin create or replace function request_verification(p_note text default null) returns json language plpgsql security definer set search_path = public as $$
declare s json;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'reason', 'auth'); end if;
  s := verification_stats(auth.uid());
  if (s ->> 'verified')::boolean then return json_build_object('ok', false, 'reason', 'already'); end if;
  if not (s ->> 'eligible')::boolean then return json_build_object('ok', false, 'reason', 'not_eligible'); end if;
  if exists (select 1 from verification_requests where user_id = auth.uid() and status = 'pending') then
    return json_build_object('ok', false, 'reason', 'pending'); end if;
  insert into verification_requests (user_id, note) values (auth.uid(), left(coalesce(p_note, ''), 500));
  return json_build_object('ok', true);
end $$; exception when others then perform setup_fail('create or replace function request_verification(p_', sqlerrm); end $s$;
do $s$ begin grant execute on function request_verification(text) to authenticated; exception when others then perform setup_fail('grant execute on function request_verification(tex', sqlerrm); end $s$;
do $s$ begin alter table profiles add column if not exists card_fx jsonb; exception when others then perform setup_fail('alter table profiles add column if not exists card', sqlerrm); end $s$;
do $s$ begin create or replace function card_fx_valid(j jsonb) returns boolean language sql immutable as $$
select j is null or (
  jsonb_typeof(j) = 'object'
  and coalesce(j->>'v', '1') = '1'
  and coalesce(j->>'name', 'none')   in ('none', 'blur', 'decrypt', 'gradient')
  and coalesce(j->>'stats', 'none')  in ('none', 'count')
  and coalesce(j->>'bg', 'none')     in ('none', 'noise', 'dots')
  and coalesce(j->>'cards', 'none')  in ('none', 'tilt', 'pixel')
  and jsonb_typeof(coalesce(j->'prompts', '[]'::jsonb)) = 'array'
  and jsonb_array_length(coalesce(j->'prompts', '[]'::jsonb)) <= 3
  and not exists (
    select 1 from jsonb_array_elements(coalesce(j->'prompts', '[]'::jsonb)) e
    where jsonb_typeof(e.value) <> 'string'
       or e.value::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
) $$; exception when others then perform setup_fail('create or replace function card_fx_valid(j jsonb) ', sqlerrm); end $s$;
do $s$ begin alter table profiles drop constraint if exists profiles_card_fx_check; exception when others then perform setup_fail('alter table profiles drop constraint if exists pro', sqlerrm); end $s$;
do $s$ begin alter table profiles add constraint profiles_card_fx_check check (card_fx_valid(card_fx)); exception when others then perform setup_fail('alter table profiles add constraint profiles_card_', sqlerrm); end $s$;
do $s$ begin notify pgrst, 'reload schema'; exception when others then perform setup_fail('notify pgrst, ''reload schema''', sqlerrm); end $s$;
select 'تمت التهيئة — ' || coalesce((select string_agg(step || ' → ' || error, E'\n') from setup_log), 'بلا أخطاء') as result;
