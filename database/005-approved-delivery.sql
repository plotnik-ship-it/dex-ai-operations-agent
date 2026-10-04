BEGIN;
CREATE ROLE dex_worker LOGIN PASSWORD 'local_worker_password' NOSUPERUSER NOBYPASSRLS;
CREATE TABLE reminder_approvals (
 draft_id uuid PRIMARY KEY REFERENCES reminder_drafts(id), agency_id text NOT NULL, actor_id text NOT NULL,
 payload_hash text NOT NULL, approved_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(actor_id,agency_id) REFERENCES memberships(user_id,agency_id)
);
CREATE TABLE delivery_jobs (
 id uuid PRIMARY KEY, draft_id uuid NOT NULL UNIQUE REFERENCES reminder_approvals(draft_id),
 agency_id text NOT NULL, actor_id text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','blocked','uncertain')),
 created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, finished_at timestamptz,
 outcomes jsonb NOT NULL DEFAULT '[]', reason text
);
ALTER TABLE reminder_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_approvals FORCE ROW LEVEL SECURITY;
CREATE POLICY own_approval ON reminder_approvals TO dex_runtime USING(
 agency_id=current_setting('dex.agency_id',true) AND actor_id=current_setting('dex.user_id',true)
 AND EXISTS(SELECT 1 FROM reminder_drafts d WHERE d.id=draft_id)
) WITH CHECK(agency_id=current_setting('dex.agency_id',true) AND actor_id=current_setting('dex.user_id',true)
 AND EXISTS(SELECT 1 FROM reminder_drafts d WHERE d.id=draft_id));
ALTER TABLE delivery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY own_job ON delivery_jobs TO dex_runtime USING(
 agency_id=current_setting('dex.agency_id',true) AND actor_id=current_setting('dex.user_id',true)
 AND EXISTS(SELECT 1 FROM reminder_approvals a WHERE a.draft_id=delivery_jobs.draft_id)
) WITH CHECK(agency_id=current_setting('dex.agency_id',true) AND actor_id=current_setting('dex.user_id',true)
 AND EXISTS(SELECT 1 FROM reminder_approvals a WHERE a.draft_id=delivery_jobs.draft_id));
CREATE POLICY worker_queue ON delivery_jobs TO dex_worker USING(true) WITH CHECK(true);
GRANT USAGE ON SCHEMA public TO dex_worker;
GRANT SELECT,UPDATE ON delivery_jobs TO dex_worker;
GRANT SELECT,INSERT ON reminder_approvals,delivery_jobs TO dex_runtime;
COMMIT;
