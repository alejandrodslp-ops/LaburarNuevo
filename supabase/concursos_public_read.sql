-- Permite que la web pública lea la tabla concursos sin autenticación.
-- El sitio Next.js usa la service_role key (server-side, nunca llega al cliente),
-- pero por si acaso también se abre para lectura anon.
DROP POLICY IF EXISTS concursos_select_public ON concursos;
CREATE POLICY concursos_select_public ON concursos
  FOR SELECT USING (true);

GRANT SELECT ON concursos TO anon;
