-- Create the four users in Supabase Auth
-- You'll need to invite them or use the dashboard
-- Go to Supabase → Authentication → Users → "Invite user" for each:
-- david.goetz@intact-systems.com  (or whatever their emails are)
-- Then run this after each user accepts their invite to set their profile:

insert into profiles (id, username, role)
select id, 'David', 'admin' from auth.users where email = 'david.goetz@intact-systems.com'
on conflict (id) do nothing;

insert into profiles (id, username, role)
select id, 'Steven', 'member' from auth.users where email = 'steven@intact-systems.com'
on conflict (id) do nothing;

insert into profiles (id, username, role)
select id, 'Stefan', 'member' from auth.users where email = 'stefan@intact-systems.com'
on conflict (id) do nothing;

insert into profiles (id, username, role)
select id, 'Tom', 'member' from auth.users where email = 'tom@intact-systems.com'
on conflict (id) do nothing;
