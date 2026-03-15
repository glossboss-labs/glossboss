-- Allow authenticated users to read all profiles.
-- Required for org member lists, project collaborator displays, etc.
-- Profile data (name, email, avatar) is non-sensitive within the app.

create policy "Authenticated users can read profiles"
  on public.profiles for select
  to authenticated
  using (true);
