BEGIN;
CREATE TABLE reminder_drafts (
 id uuid PRIMARY KEY, agency_id text NOT NULL, group_id text NOT NULL, created_by text NOT NULL,
 payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '30 minutes',
 status text NOT NULL DEFAULT 'pending_review' CHECK(status='pending_review'),
 FOREIGN KEY(agency_id,group_id) REFERENCES groups(agency_id,id)
);
ALTER TABLE reminder_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_drafts FORCE ROW LEVEL SECURITY;
CREATE POLICY own_draft ON reminder_drafts USING(
 agency_id=current_setting('dex.agency_id',true) AND created_by=current_setting('dex.user_id',true)
 AND EXISTS(SELECT 1 FROM groups g WHERE g.agency_id=reminder_drafts.agency_id AND g.id=reminder_drafts.group_id)
) WITH CHECK(
 agency_id=current_setting('dex.agency_id',true) AND created_by=current_setting('dex.user_id',true)
 AND EXISTS(SELECT 1 FROM groups g WHERE g.agency_id=reminder_drafts.agency_id AND g.id=reminder_drafts.group_id)
);
GRANT SELECT,INSERT ON reminder_drafts TO dex_runtime;
COMMIT;
