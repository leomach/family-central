-- ============================================================================
-- Categorias editáveis por família
-- ============================================================================
-- Antes: 13 categorias de sistema fixas (family_id = NULL), não editáveis.
-- Agora: cada família recebe uma cópia própria dessas categorias, totalmente
-- editável/removível. As linhas de sistema (NULL) são MANTIDAS apenas para que
-- transações antigas que as referenciam continuem exibindo nome/ícone via join.
-- Os seletores da aplicação passam a listar somente categorias da família.
-- ============================================================================

-- Backfill: copia as categorias de sistema (NULL) para cada família existente.
-- ON CONFLICT evita duplicar caso a família já tenha alguma dessas categorias.
INSERT INTO categories (family_id, name, type, icon)
SELECT f.id, c.name, c.type, c.icon
FROM families f
CROSS JOIN categories c
WHERE c.family_id IS NULL
ON CONFLICT (family_id, name, type) DO NOTHING;
