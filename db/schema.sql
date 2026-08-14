CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE provenance_status AS ENUM ('official', 'verified_crowdsourced', 'unverified');
CREATE TYPE admin_level AS ENUM ('country', 'county', 'constituency', 'ward');

CREATE TABLE admin_units (
  id text PRIMARY KEY,
  name text NOT NULL,
  level admin_level NOT NULL,
  county_id text REFERENCES admin_units(id),
  constituency_id text REFERENCES admin_units(id),
  boundary geometry(Geometry, 4326) NOT NULL,
  source_properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_units_boundary_gix ON admin_units USING gist (boundary);
CREATE INDEX admin_units_parent_idx ON admin_units (county_id, constituency_id);

CREATE TABLE result_snapshots (
  id bigserial PRIMARY KEY,
  admin_unit_id text NOT NULL REFERENCES admin_units(id),
  race text NOT NULL,
  candidate_name text NOT NULL,
  party text,
  votes integer NOT NULL CHECK (votes >= 0),
  expected_polling_stations integer,
  reported_polling_stations integer,
  provenance provenance_status NOT NULL DEFAULT 'unverified',
  source_url text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX result_snapshots_unit_race_idx ON result_snapshots (admin_unit_id, race, recorded_at DESC);
