BEGIN;
CREATE TABLE contracts (
 agency_id text NOT NULL, id text NOT NULL, group_id text NOT NULL,
 title text NOT NULL, version text NOT NULL, active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(agency_id,id), FOREIGN KEY(agency_id,group_id) REFERENCES groups(agency_id,id)
);
CREATE TABLE contract_chunks (
 agency_id text NOT NULL, id text NOT NULL, contract_id text NOT NULL,
 page integer NOT NULL CHECK(page>0), section text NOT NULL, excerpt text NOT NULL,
 embedding vector, embedding_model text,
 PRIMARY KEY(agency_id,id), FOREIGN KEY(agency_id,contract_id) REFERENCES contracts(agency_id,id),
 CHECK((embedding IS NULL)=(embedding_model IS NULL))
);
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts FORCE ROW LEVEL SECURITY;
CREATE POLICY contract_scope ON contracts USING(agency_id=current_setting('dex.agency_id',true) AND EXISTS(SELECT 1 FROM groups g WHERE g.agency_id=contracts.agency_id AND g.id=contracts.group_id));
ALTER TABLE contract_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_chunks FORCE ROW LEVEL SECURITY;
CREATE POLICY chunk_scope ON contract_chunks USING(agency_id=current_setting('dex.agency_id',true) AND EXISTS(SELECT 1 FROM contracts c WHERE c.agency_id=contract_chunks.agency_id AND c.id=contract_chunks.contract_id));
GRANT SELECT ON contracts,contract_chunks TO dex_runtime;
INSERT INTO contracts VALUES ('agency-a','contract-a','group-a','Caribbean Discovery — Synthetic Contract','1.0',true),('agency-b','contract-b','group-b','Caribbean Discovery — Synthetic Contract','1.0',true);
INSERT INTO contract_chunks(agency_id,id,contract_id,page,section,excerpt) VALUES
 ('agency-a','payment-a','contract-a',1,'Section 4 — Final payment','The remaining booking balance must be paid by November 15, 2026.'),
 ('agency-a','documents-a','contract-a',1,'Section 5 — Required documents','Passport copies must be submitted by November 10, 2026.'),
 ('agency-b','payment-b','contract-b',1,'Section 4 — Final payment','The remaining booking balance must be paid by December 20, 2026.');
COMMIT;
