BEGIN;
CREATE TABLE memberships (
 user_id text NOT NULL, agency_id text NOT NULL REFERENCES agencies(id),
 role text NOT NULL CHECK(role IN ('owner','admin','agent')), active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(user_id,agency_id)
);
CREATE TABLE group_assignments (
 user_id text NOT NULL, agency_id text NOT NULL, group_id text NOT NULL,
 PRIMARY KEY(user_id,agency_id,group_id),
 FOREIGN KEY(user_id,agency_id) REFERENCES memberships(user_id,agency_id),
 FOREIGN KEY(agency_id,group_id) REFERENCES groups(agency_id,id)
);
INSERT INTO memberships VALUES ('owner-a','agency-a','owner',true),('agent-a','agency-a','agent',true),('owner-b','agency-b','owner',true),('revoked-a','agency-a','agent',false);
INSERT INTO groups VALUES ('group-a-private','agency-a','Private Discovery');
INSERT INTO bookings VALUES ('booking-a-private','agency-a','group-a-private',300000,0,'USD',ARRAY['passport_copy'],'active');
INSERT INTO group_assignments VALUES ('agent-a','agency-a','group-a');
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY self_membership ON memberships USING(user_id=current_setting('dex.user_id',true));
ALTER TABLE group_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY self_assignment ON group_assignments USING(user_id=current_setting('dex.user_id',true));
DROP POLICY tenant_scope ON agencies;
DROP POLICY tenant_scope ON groups;
DROP POLICY tenant_scope ON bookings;
CREATE POLICY authorized_agency ON agencies USING (
 id=current_setting('dex.agency_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.agency_id=agencies.id AND m.active)
);
CREATE POLICY authorized_group ON groups USING (
 agency_id=current_setting('dex.agency_id',true) AND EXISTS(
 SELECT 1 FROM memberships m WHERE m.agency_id=groups.agency_id AND m.active AND (
 m.role IN ('owner','admin') OR EXISTS(SELECT 1 FROM group_assignments a WHERE a.agency_id=groups.agency_id AND a.group_id=groups.id AND a.user_id=m.user_id)))
);
CREATE POLICY authorized_booking ON bookings USING (
 agency_id=current_setting('dex.agency_id',true) AND EXISTS(SELECT 1 FROM groups g WHERE g.agency_id=bookings.agency_id AND g.id=bookings.group_id)
);
GRANT SELECT ON memberships, group_assignments TO dex_runtime;
COMMIT;
