-- Local/dev seed: the pilot gym. Rename it in the Supabase table editor.
insert into public.gyms (id, name, monthly_visit_goal)
values ('00000000-0000-0000-0000-000000000001', 'Pilot Gym', 1000)
on conflict (id) do nothing;
