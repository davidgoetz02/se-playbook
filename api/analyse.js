insert into profiles (id, username, role)
select id, 'David', 'admin' from auth.users 
where email = 'david.goetz@intact-systems.com'
on conflict (id) do nothing;

insert into profiles (id, username, role)
select id, 'Stefan', 'member' from auth.users 
where email = 'stefan.gassmann@intact-systems.com'
on conflict (id) do nothing;

insert into profiles (id, username, role)
select id, 'Steven', 'member' from auth.users 
where email = 'steven.bennett@intact-systems.com'
on conflict (id) do nothing;

insert into profiles (id, username, role)
select id, 'Tom', 'member' from auth.users 
where email = 'thomas.oday@intact-systems.com'
on conflict (id) do nothing;
