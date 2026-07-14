-- Standardize DOCUMENTATION/SIGN_OFF rag_scores onto the NOT_STARTED/IN_PROGRESS/DONE
-- vocabulary used by the new manual toggle (RED/AMBER/GREEN was a holdover from the
-- read-only RAG scheme; these two dimensions are now manually set, not RAG-derived).
--
-- Note: this project's tessera_rag_scores already has an open read/write RLS policy
-- set (open_select/open_insert/open_update/open_delete, matching the pattern on
-- tessera_kt_session_resources) and a unique constraint on (domain_id, dimension)
-- (kt_rag_scores_domain_id_dimension_key) — both confirmed present, so neither is
-- added here.

UPDATE tessera_rag_scores
SET score = CASE score
  WHEN 'RED' THEN 'NOT_STARTED'
  WHEN 'AMBER' THEN 'IN_PROGRESS'
  WHEN 'GREEN' THEN 'DONE'
  WHEN 'NOT_STARTED' THEN 'NOT_STARTED'
  WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'
  WHEN 'DONE' THEN 'DONE'
  ELSE 'NOT_STARTED'
END
WHERE dimension IN ('DOCUMENTATION', 'SIGN_OFF');
