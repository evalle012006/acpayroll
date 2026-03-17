-- Seed an admin user (change the password hash!)
INSERT INTO public.users (username, password_hash, role)
VALUES ('admin2', '$2b$10$9cmEkIhkZ/WlGWZnQtXIbuNSfZrJqDimlFAtEsGq3z/nPuy0F7Tmu', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Seed a sample branch
INSERT INTO public.branches (code, name)
VALUES ('B000', 'Main Office')
ON CONFLICT (code) DO NOTHING;