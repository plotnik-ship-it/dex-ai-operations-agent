BEGIN;
CREATE TABLE agent_runs (
 id uuid PRIMARY KEY, agency_id text NOT NULL, group_id text NOT NULL, created_by text NOT NULL,
 planner_mode text NOT NULL, status text NOT NULL DEFAULT 'running'
 CHECK(status IN ('running','pending_review','needs_review','no_action','failed')),
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 duration_ms integer, events jsonb NOT NULL DEFAULT '[]', model_usage jsonb,
 draft_id uuid REFERENCES reminder_drafts(id), error_code text,
 FOREIGN KEY(agency_id,group_id) REFERENCES groups(agency_id,id)
);
CREATE INDEX agent_runs_owner_recent ON agent_runs(agency_id,created_by,group_id,started_at DESC,id DESC);
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY own_run ON agent_runs USING (
 agency_id=current_setting('dex.agency_id',true) AND created_by=current_setting('dex.user_id',true)
 AND EXISTS(SELECT 1 FROM groups g WHERE g.agency_id=agent_runs.agency_id AND g.id=agent_runs.group_id)
) WITH CHECK (
 agency_id=current_setting('dex.agency_id',true) AND created_by=current_setting('dex.user_id',true)
 AND EXISTS(SELECT 1 FROM groups g WHERE g.agency_id=agent_runs.agency_id AND g.id=agent_runs.group_id)
);
GRANT SELECT,INSERT ON agent_runs TO dex_runtime;
GRANT UPDATE(status,finished_at,duration_ms,events,model_usage,draft_id,error_code) ON agent_runs TO dex_runtime;
COMMIT;
