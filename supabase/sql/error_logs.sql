-- Tabla de registro de errores de la app (punto 2 de la revisión).
-- Aditiva: no toca ninguna tabla existente. La app inserta vía src/services/logError.js.
-- Mientras esta tabla NO exista, logError falla en silencio y la app funciona igual.

create table if not exists public.error_logs (
  id          bigint generated always as identity primary key,
  contexto    text,
  mensaje     text,
  user_id     uuid,
  plataforma  text default 'app',
  created_at  timestamptz default now()
);

-- RLS: la app puede INSERTAR errores, pero NADIE puede leerlos con anon/authenticated.
-- Solo el admin (service_role, vía edge function admin-data) los lee — bypassa RLS.
alter table public.error_logs enable row level security;

drop policy if exists "error_logs_insert" on public.error_logs;
create policy "error_logs_insert" on public.error_logs
  for insert to anon, authenticated
  with check (true);

create index if not exists idx_error_logs_created on public.error_logs(created_at desc);

-- IMPORTANTE — evitar que la tabla crezca sin control (riesgo de disco lleno):
-- correr esto periódicamente, o crear un cron job que borre lo viejo:
--   delete from public.error_logs where created_at < now() - interval '30 days';
