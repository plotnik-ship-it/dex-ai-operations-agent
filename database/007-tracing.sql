BEGIN;
CREATE TABLE trace_events (
 sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id uuid NOT NULL UNIQUE, run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
 event_type text NOT NULL, occurred_at timestamptz NOT NULL,
 span_id text NOT NULL, parent_span_id text, duration_ms integer CHECK(duration_ms>=0),
 data jsonb NOT NULL CHECK(octet_length(data::text)<=131072)
);
CREATE INDEX trace_events_run_order ON trace_events(run_id,sequence);
ALTER TABLE trace_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE trace_events FORCE ROW LEVEL SECURITY;
CREATE POLICY own_trace ON trace_events USING (EXISTS(SELECT 1 FROM agent_runs r WHERE r.id=trace_events.run_id))
 WITH CHECK(EXISTS(SELECT 1 FROM agent_runs r WHERE r.id=trace_events.run_id));
GRANT SELECT,INSERT ON trace_events TO dex_runtime;
GRANT USAGE ON SEQUENCE trace_events_sequence_seq TO dex_runtime;
COMMIT;
