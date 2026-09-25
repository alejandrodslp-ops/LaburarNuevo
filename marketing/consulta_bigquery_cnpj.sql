-- ============================================================================
-- TODAS las empresas de Brasil ACTIVAS con EMAIL — base oficial CNPJ (Receita)
-- Fuente pública: Base dos Dados (basedosdados.br_me_cnpj) en Google BigQuery.
-- Gratis: BigQuery da 1 TB/mes de consultas sin costo (esto usa mucho menos).
-- ============================================================================

SELECT
  emp.razao_social,
  est.nome_fantasia,
  est.email,
  CONCAT(COALESCE(est.ddd_1, ''), COALESCE(est.telefone_1, '')) AS telefone,
  est.sigla_uf,
  est.id_municipio,
  est.cnae_fiscal_principal
FROM `basedosdados.br_me_cnpj.estabelecimentos` AS est
JOIN `basedosdados.br_me_cnpj.empresas` AS emp
  ON est.cnpj_basico = emp.cnpj_basico
WHERE est.situacao_cadastral = '2'            -- 2 = ATIVA
  AND est.email IS NOT NULL AND est.email <> ''
  AND est.identificador_matriz_filial = '1'   -- solo matriz (no duplicar filiales)
  -- --- FILTROS OPCIONALES (descomentá para acotar) ---
  -- AND est.sigla_uf = 'SP'                                   -- por estado
  -- AND est.cnae_fiscal_principal BETWEEN '4711302' AND '4789099'  -- por rubro (comercio, ej.)
LIMIT 1000;   -- <-- QUITÁ este LIMIT para exportar TODO (son millones)

-- Notas:
--  * Si un nombre de columna difiere, mirá la pestaña "Esquema" de la tabla
--    en BigQuery y me lo decís; te ajusto la consulta.
--  * Para exportar: botón "GUARDAR RESULTADOS" -> CSV / Google Sheets / Drive.
--  * Filtrá SIEMPRE (estado + rubro) — no mandes a millones de golpe (ver abajo).
