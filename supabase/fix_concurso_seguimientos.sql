-- 2026-09-25: tabla para "Postularme" en concursos — avisa al worker si el
-- llamado al que se postuló se cierra/vence. Match contra concursos por
-- (fuente, fuente_id), nunca por id (el scraper reinserta con id nuevo).
CREATE TABLE public.concurso_seguimientos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id uuid NOT NULL REFERENCES public.profiles(id),
  fuente text NOT NULL,
  fuente_id text NOT NULL,
  titulo_snapshot text,
  pais text,
  notificado boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(worker_id, fuente, fuente_id)
);
ALTER TABLE public.concurso_seguimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seguimientos_insert" ON public.concurso_seguimientos FOR INSERT TO authenticated WITH CHECK (auth.uid() = worker_id);
CREATE POLICY "seguimientos_select" ON public.concurso_seguimientos FOR SELECT TO authenticated USING (auth.uid() = worker_id);
CREATE INDEX idx_seguimientos_pendientes ON public.concurso_seguimientos (fuente, fuente_id) WHERE notificado = false;
