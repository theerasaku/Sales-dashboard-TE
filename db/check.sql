-- TE Sales Dashboard - health check
--
-- Read-only. Safe to run anytime. Changes nothing.
-- Labels are ASCII on purpose: the Supabase SQL Editor font cannot render Thai.
-- (Thai data in the tables is stored fine - it is only a display issue in that editor.)
--
-- Expected result after schema.sql + policies.sql + seed.sql:
--   teams                     5   GOV.1, GOV.3, GOV.4, TE-IMP, SYSTEM
--   tables with RLS on        5
--   policies                 15
--   tables authenticated can touch  5
--   tables anon can touch     0   <- must be 0
--   users                     depends (need at least 1 admin)

select 'teams' as item,
       count(*)::text as num,
       coalesce(string_agg(code, ', ' order by sort_order), '(none)') as detail
  from teams

union all
select 'tables with RLS on',
       count(*)::text,
       coalesce(string_agg(tablename, ', ' order by tablename), '(none - run policies.sql)')
  from pg_tables
 where schemaname = 'public'
   and rowsecurity
   and tablename in ('teams','profiles','pending_projects','follow_logs','project_contacts')

union all
select 'policies',
       count(*)::text,
       '(should be 15)'
  from pg_policies
 where schemaname = 'public'

union all
select 'tables authenticated can touch',
       count(distinct table_name)::text,
       coalesce(string_agg(distinct table_name, ', '), '(NONE - GRANT missing, re-run policies.sql)')
  from information_schema.role_table_grants
 where grantee = 'authenticated'
   and table_schema = 'public'
   and table_name in ('teams','profiles','pending_projects','follow_logs','project_contacts')

union all
select 'tables anon can touch (must be 0)',
       count(distinct table_name)::text,
       coalesce(string_agg(distinct table_name, ', '), '(none - correct)')
  from information_schema.role_table_grants
 where grantee = 'anon'
   and table_schema = 'public'
   and table_name in ('teams','profiles','pending_projects','follow_logs','project_contacts')

union all
select 'users',
       count(*)::text,
       coalesce(string_agg(email || ' -> ' || role, ', ' order by email),
                '(none yet - use Authentication > Users > Invite user)')
  from profiles

union all
-- Thai text stored correctly? compares byte length vs character length.
-- Thai chars are 3 bytes in UTF-8, so bytes > chars means Thai survived intact.
select 'thai text stored ok',
       case when max(octet_length(description)) > max(char_length(description))
            then 'YES' else 'CHECK' end,
       'GOV.4 desc: ' || max(char_length(description))::text || ' chars / '
                       || max(octet_length(description))::text || ' bytes'
  from teams
 where code = 'GOV.4';
