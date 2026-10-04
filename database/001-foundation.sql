-- Local demo only. Never reuse these credentials outside Docker.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE ROLE dex_runtime LOGIN PASSWORD 'local_demo_password' NOSUPERUSER NOBYPASSRLS;
CREATE TABLE agencies (id text PRIMARY KEY, name text NOT NULL);
CREATE TABLE groups (id text NOT NULL, agency_id text NOT NULL REFERENCES agencies(id), name text NOT NULL, PRIMARY KEY (agency_id,id));
CREATE TABLE bookings (
 id text NOT NULL, agency_id text NOT NULL, group_id text NOT NULL,
 total_minor bigint NOT NULL CHECK(total_minor >= 0), paid_minor bigint NOT NULL CHECK(paid_minor >= 0),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), missing_documents text[] NOT NULL DEFAULT '{}',
 status text NOT NULL CHECK(status IN ('active','cancelled')),
 PRIMARY KEY(agency_id,id), FOREIGN KEY(agency_id,group_id) REFERENCES groups(agency_id,id)
);
-- Foundation policy: tenant boundary only. Group assignment policies precede operational API exposure.
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON agencies USING(id = current_setting('dex.agency_id',true));
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON groups USING(agency_id = current_setting('dex.agency_id',true));
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON bookings USING(agency_id = current_setting('dex.agency_id',true));
GRANT USAGE ON SCHEMA public TO dex_runtime;
GRANT SELECT ON agencies, groups, bookings TO dex_runtime;
INSERT INTO agencies VALUES ('agency-a','Northstar Demo Travel'),('agency-b','Sunrise Demo Travel');
INSERT INTO groups VALUES ('group-a','agency-a','Caribbean Discovery'),('group-b','agency-b','Caribbean Discovery');
INSERT INTO bookings VALUES
 ('booking-a1','agency-a','group-a',200000,50000,'USD',ARRAY['passport_copy'],'active'),
 ('booking-a2','agency-a','group-a',200000,200000,'USD',ARRAY['passport_copy'],'active'),
 ('booking-a3','agency-a','group-a',200000,50000,'USD','{}','active'),
 ('booking-a4','agency-a','group-a',200000,50000,'USD',ARRAY['passport_copy'],'cancelled'),
 ('booking-b1','agency-b','group-b',900000,0,'USD',ARRAY['passport_copy'],'active');
