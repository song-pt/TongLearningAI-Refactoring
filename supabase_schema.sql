-- TongAI RefactoringBetaVersion1. Back up the project before running.
create extension if not exists pgcrypto;
create extension if not exists vector;
create extension if not exists pg_trgm;

create table if not exists schema_migrations(version text primary key,applied_at timestamptz not null default now());
create table if not exists access_keys(id uuid primary key default gen_random_uuid(),code text unique,note text,is_active boolean not null default true,created_at timestamptz not null default now(),total_tokens bigint not null default 0,token_limit bigint,code_hash text,code_hint text,total_images bigint not null default 0,image_limit bigint);
alter table access_keys add column if not exists code_hash text;
alter table access_keys add column if not exists code_hint text;
alter table access_keys add column if not exists total_images bigint not null default 0;
alter table access_keys add column if not exists image_limit bigint;
alter table access_keys alter column code drop not null;
update access_keys set code_hash=encode(extensions.digest(code,'sha256'),'hex'),code_hint=case when length(code)<=8 then left(code,2)||'••••' else left(code,4)||'••••'||right(code,2) end where code_hash is null and code is not null;
create unique index if not exists idx_access_keys_code_hash on access_keys(code_hash) where code_hash is not null;
alter table access_keys drop constraint if exists access_keys_token_nonnegative;
alter table access_keys add constraint access_keys_token_nonnegative check(total_tokens>=0 and (token_limit is null or token_limit>=0));
alter table access_keys drop constraint if exists access_keys_image_nonnegative;
alter table access_keys add constraint access_keys_image_nonnegative check(total_images>=0 and (image_limit is null or image_limit>=0));

create table if not exists subjects(code text primary key,label text not null,color text not null default 'slate',icon text not null default 'book',prompt_prefix text not null default '',background_chars text not null default '',char_opacity real not null default .08,char_size_scale real not null default 1,sort_order integer not null default 0,is_active boolean not null default true,created_at timestamptz not null default now());
alter table subjects add column if not exists char_opacity real not null default .08;
alter table subjects add column if not exists char_size_scale real not null default 1;
create table if not exists levels(id uuid default gen_random_uuid(),code text primary key,label text not null,sort_order integer not null default 0,is_active boolean not null default true,created_at timestamptz not null default now());
create table if not exists public_config(key text primary key,value text not null,updated_at timestamptz not null default now());
create table if not exists private_config(key text primary key,value text not null,updated_at timestamptz not null default now());

insert into public_config(key,value) values('app_title','TongAI'),('app_logo',''),('ai_mode','solver'),('show_usage','true'),('enable_web_search','false'),('history_per_subject','50'),('history_per_user','200'),('images_per_user','20') on conflict(key) do nothing;
insert into private_config(key,value) values('text_model','deepseek-ai/DeepSeek-V3'),('vision_model','Qwen/Qwen3-VL-30B-A3B-Instruct'),('embedding_model','') on conflict(key) do nothing;
do $$ begin
 if to_regclass('public.app_config') is not null then
  insert into public_config(key,value) select key,value from app_config where key in('app_title','app_logo','ai_mode','show_usage_to_user','enable_web_search') on conflict(key) do update set value=excluded.value,updated_at=now();
  insert into private_config(key,value) select case key when 'ai_text_model' then 'text_model' when 'ai_vision_model' then 'vision_model' end,value from app_config where key in('ai_text_model','ai_vision_model') and value<>'' on conflict(key) do update set value=excluded.value,updated_at=now();
  if exists(select 1 from app_config where key='admin_password' and length(value)>=10) and not exists(select 1 from private_config where key='admin_password_hash') then insert into private_config(key,value) select 'admin_password_hash',extensions.crypt(value,extensions.gen_salt('bf',12)) from app_config where key='admin_password' and length(value)>=10; end if;
 end if;
end $$;

insert into subjects(code,label,color,icon,prompt_prefix,background_chars,sort_order) values
('math','数学','blue','calculator','请逐步解释题意、方法、过程、验证和结论。数学表达式使用LaTeX。','＋−×÷＝√π∑',1),
('chinese','语文','emerald','pen','请从文本、结构、语言、背景和考点角度给出清晰的语文学习指导。','文诗词句',2),
('english','英语','violet','languages','请从语义、语法、词汇、结构和实际运用角度给出英语学习指导。','AaBbCc',3) on conflict(code) do nothing;
insert into levels(code,label,sort_order) values('1','一年级',1),('2','二年级',2),('3','三年级',3),('4','四年级',4),('5','五年级',5),('6','六年级',6),('7','七年级',7),('8','八年级',8),('9','九年级',9) on conflict(code) do nothing;

create table if not exists device_sessions(id uuid primary key default gen_random_uuid(),key_code text,owner_id uuid references access_keys(id) on delete cascade,device_id text not null,last_seen timestamptz not null default now(),device_info text default 'Unknown',total_tokens bigint not null default 0,is_banned boolean not null default false,image_key_code text,location text);
alter table device_sessions add column if not exists owner_id uuid references access_keys(id) on delete cascade;
update device_sessions d set owner_id=k.id from access_keys k where d.owner_id is null and d.key_code=k.code;
create unique index if not exists idx_device_owner_device on device_sessions(owner_id,device_id);
create index if not exists idx_device_last_seen on device_sessions(last_seen desc);

create table if not exists conversations(id uuid primary key default gen_random_uuid(),owner_id uuid not null references access_keys(id) on delete cascade,subject_code text not null references subjects(code),level_code text references levels(code),title text not null,summary text not null default '',search_document text not null default '',embedding vector(1536),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists messages(id uuid primary key default gen_random_uuid(),conversation_id uuid not null references conversations(id) on delete cascade,role text not null check(role in('user','assistant','tool','system')),content text not null,token_count integer check(token_count is null or token_count>=0),created_at timestamptz not null default now());
create table if not exists attachments(id uuid primary key default gen_random_uuid(),owner_id uuid not null references access_keys(id) on delete cascade,conversation_id uuid not null references conversations(id) on delete cascade,storage_path text not null unique,mime_type text not null,size_bytes integer not null check(size_bytes between 1 and 512000),created_at timestamptz not null default now());
create table if not exists usage_ledger(id uuid primary key default gen_random_uuid(),owner_id uuid not null references access_keys(id) on delete cascade,request_id uuid not null unique,reserved_tokens integer not null check(reserved_tokens>=0),actual_tokens integer,reserved_image boolean not null default false,status text not null default 'reserved' check(status in('reserved','settled','released')),created_at timestamptz not null default now(),settled_at timestamptz);
create index if not exists idx_conversations_owner_subject_updated on conversations(owner_id,subject_code,updated_at desc);
create index if not exists idx_messages_conversation_created on messages(conversation_id,created_at);
create index if not exists idx_attachments_owner_created on attachments(owner_id,created_at desc);
create index if not exists idx_conversations_search_trgm on conversations using gin(search_document gin_trgm_ops);

-- Migrate legacy rows once. Search indexing reads the question only, not every answer line.
do $$ begin
 if to_regclass('public.chat_history') is not null then
  insert into conversations(id,owner_id,subject_code,level_code,title,summary,search_document,created_at,updated_at)
  select h.id,k.id,coalesce(nullif(h.subject,''),'math'),l.code,left(regexp_replace(h.question,'\s+',' ','g'),64),left(regexp_replace(h.question,'\s+',' ','g'),240),regexp_replace(h.question,'\s+',' ','g')||' '||coalesce(h.grade_label,''),h.created_at,h.created_at
  from chat_history h join access_keys k on k.code=h.key_code left join levels l on l.label=h.grade_label where exists(select 1 from subjects s where s.code=coalesce(nullif(h.subject,''),'math')) on conflict(id) do nothing;
  insert into messages(conversation_id,role,content,created_at) select h.id,'user',h.question,h.created_at from chat_history h where exists(select 1 from conversations c where c.id=h.id) and not exists(select 1 from messages m where m.conversation_id=h.id and m.role='user');
  insert into messages(conversation_id,role,content,created_at) select h.id,'assistant',h.answer,h.created_at+interval '1 millisecond' from chat_history h where exists(select 1 from conversations c where c.id=h.id) and not exists(select 1 from messages m where m.conversation_id=h.id and m.role='assistant');
 end if;
end $$;

create or replace function verify_admin_password(input_password text) returns boolean language sql security definer set search_path=public,extensions as $$ select coalesce((select value=extensions.crypt(input_password,value) from private_config where key='admin_password_hash'),false) $$;
create or replace function set_admin_password(new_password text) returns void language plpgsql security definer set search_path=public,extensions as $$ begin if length(new_password)<10 then raise exception 'password_too_short'; end if; insert into private_config(key,value) values('admin_password_hash',extensions.crypt(new_password,extensions.gen_salt('bf',12))) on conflict(key) do update set value=excluded.value,updated_at=now(); end $$;
create or replace function attachments_over_limit(p_max_count integer,p_max_bytes bigint) returns table(id uuid,storage_path text) language sql security definer set search_path=public as $$
  select ranked.id,ranked.storage_path from (
    select a.id,a.storage_path,row_number() over(order by a.created_at desc,a.id desc) as row_no,
      sum(a.size_bytes) over(order by a.created_at desc,a.id desc rows between unbounded preceding and current row) as running_bytes
    from attachments a
  ) ranked where ranked.row_no>p_max_count or ranked.running_bytes>p_max_bytes;
$$;

create or replace function reserve_usage(p_owner_id uuid,p_request_id uuid,p_reserved_tokens integer,p_image boolean) returns uuid language plpgsql security definer set search_path=public as $$
declare k access_keys%rowtype; ledger_id uuid;
begin
 if p_reserved_tokens<0 then raise exception 'invalid_reservation'; end if;
 select * into k from access_keys where id=p_owner_id for update;
 if k.id is null or not k.is_active then raise exception 'key_inactive'; end if;
 if k.token_limit is not null and k.total_tokens+p_reserved_tokens>k.token_limit then raise exception 'token_quota_exceeded'; end if;
 if p_image and k.image_limit is not null and k.total_images+1>k.image_limit then raise exception 'image_quota_exceeded'; end if;
 update access_keys set total_tokens=total_tokens+p_reserved_tokens,total_images=total_images+case when p_image then 1 else 0 end where id=p_owner_id;
 insert into usage_ledger(owner_id,request_id,reserved_tokens,reserved_image) values(p_owner_id,p_request_id,p_reserved_tokens,p_image) returning id into ledger_id;
 return ledger_id;
end $$;

create or replace function finalize_usage(p_reservation_id uuid,p_actual_tokens integer,p_success boolean) returns void language plpgsql security definer set search_path=public as $$
declare entry usage_ledger%rowtype;
begin
 select * into entry from usage_ledger where id=p_reservation_id and status='reserved' for update; if entry.id is null then return; end if;
 if p_success then if p_actual_tokens<0 then raise exception 'invalid_actual_tokens'; end if; update access_keys set total_tokens=greatest(0,total_tokens-entry.reserved_tokens+p_actual_tokens) where id=entry.owner_id; update usage_ledger set actual_tokens=p_actual_tokens,status='settled',settled_at=now() where id=entry.id;
 else update access_keys set total_tokens=greatest(0,total_tokens-entry.reserved_tokens),total_images=greatest(0,total_images-case when entry.reserved_image then 1 else 0 end) where id=entry.owner_id; update usage_ledger set actual_tokens=0,status='released',settled_at=now() where id=entry.id; end if;
 update access_keys set is_active=false where id=entry.owner_id and token_limit is not null and total_tokens>=token_limit;
end $$;

create or replace function search_history(p_owner_id uuid,p_subject_code text,p_query text,p_embedding vector(1536),p_limit integer default 10)
returns table(id uuid,subject_code text,level_code text,title text,summary text,updated_at timestamptz,score real) language sql stable security definer set search_path=public as $$
 select c.id,c.subject_code,c.level_code,c.title,c.summary,c.updated_at,
 (case when p_embedding is null or c.embedding is null then 0 else (1-(c.embedding<=>p_embedding))*.65 end+similarity(c.search_document,p_query)*.25+case when c.updated_at>now()-interval '30 days' then .10 else 0 end)::real score
 from conversations c where c.owner_id=p_owner_id and (p_subject_code is null or c.subject_code=p_subject_code) and (p_embedding is not null or c.search_document%p_query or c.search_document ilike '%'||p_query||'%') order by score desc,c.updated_at desc limit least(greatest(p_limit,1),20)
$$;

revoke all on function verify_admin_password(text),set_admin_password(text),attachments_over_limit(integer,bigint),reserve_usage(uuid,uuid,integer,boolean),finalize_usage(uuid,integer,boolean),search_history(uuid,text,text,vector,integer) from public,anon,authenticated;
grant execute on function verify_admin_password(text),set_admin_password(text),attachments_over_limit(integer,bigint),reserve_usage(uuid,uuid,integer,boolean),finalize_usage(uuid,integer,boolean),search_history(uuid,text,text,vector,integer) to service_role;

do $$ declare r record; begin for r in select schemaname,tablename,policyname from pg_policies where schemaname='public' and tablename in('access_keys','device_sessions','chat_history','app_config','subjects','levels','conversations','messages','attachments','usage_ledger','public_config','private_config') loop execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename); end loop; end $$;
alter table access_keys enable row level security; alter table device_sessions enable row level security; alter table subjects enable row level security; alter table levels enable row level security; alter table public_config enable row level security; alter table private_config enable row level security; alter table conversations enable row level security; alter table messages enable row level security; alter table attachments enable row level security; alter table usage_ledger enable row level security;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('chat-images','chat-images',false,512000,array['image/png','image/jpeg','image/webp']) on conflict(id) do update set public=false,file_size_limit=512000,allowed_mime_types=excluded.allowed_mime_types;
insert into schema_migrations(version) values('refactoring_beta_v1') on conflict(version) do nothing;
