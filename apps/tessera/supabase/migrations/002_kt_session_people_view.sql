CREATE VIEW tessera_kt_session_people AS
SELECT
  r.session_id,
  bool_or(sup.supplier_name = 'Capgemini') AS has_cg,
  bool_or(sup.supplier_name = 'Tata Consultancy Services') AS has_tcs
FROM tessera_kt_session_resources r
JOIN resources res ON res.resource_id = r.resource_id
JOIN suppliers sup ON sup.supplier_id = res.supplier_id
GROUP BY r.session_id;
