-- Current beta database adapter tables.
-- These mirror the existing listing JSON shape so the app can move from local seed
-- files to Postgres without rewriting every frontend field at once. The normalized
-- schema below remains the long-term production model.
CREATE TABLE IF NOT EXISTS listing_records (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_records_deal_score_idx
  ON listing_records (COALESCE((payload->>'dealScore')::int, 0));

CREATE TABLE IF NOT EXISTS seller_records (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_records (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'buyer',
  verification_level TEXT NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE seller_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  display_name TEXT NOT NULL,
  bio TEXT,
  rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  completed_sales INTEGER NOT NULL DEFAULT 0,
  response_time_seconds INTEGER,
  identity_verified_at TIMESTAMPTZ
);

CREATE TABLE vehicles (
  id UUID PRIMARY KEY,
  vin TEXT UNIQUE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  trim TEXT,
  body_type TEXT,
  fuel_type TEXT,
  transmission TEXT,
  drivetrain TEXT,
  exterior_color TEXT,
  interior_color TEXT,
  specs_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE listings (
  id UUID PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES users(id),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  price INTEGER NOT NULL,
  mileage INTEGER NOT NULL,
  condition TEXT NOT NULL,
  title_status TEXT,
  seller_notes TEXT,
  location_zip TEXT NOT NULL,
  location_lat NUMERIC(9,6) NOT NULL,
  location_lng NUMERIC(9,6) NOT NULL,
  location_public_radius_miles INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'draft',
  ai_deal_score INTEGER,
  fraud_score INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX listings_geo_idx ON listings (location_lat, location_lng);
CREATE INDEX listings_status_price_idx ON listings (status, price);

CREATE TABLE listing_images (
  id UUID PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listings(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE offers (
  id UUID PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listings(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE saved_searches (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  filters_json JSONB NOT NULL,
  alert_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE favorites (
  user_id UUID NOT NULL REFERENCES users(id),
  listing_id UUID NOT NULL REFERENCES listings(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE fraud_reports (
  id UUID PRIMARY KEY,
  listing_id UUID REFERENCES listings(id),
  reporter_id UUID REFERENCES users(id),
  reason TEXT NOT NULL,
  risk_score INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_accounts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  mfa_required BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY,
  admin_account_id UUID REFERENCES admin_accounts(id),
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  previous_value JSONB,
  new_value JSONB,
  notes TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX admin_audit_logs_target_idx ON admin_audit_logs (target_type, target_id);
CREATE INDEX admin_audit_logs_created_idx ON admin_audit_logs (created_at DESC);

CREATE TABLE verification_submissions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  secure_document_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  rejection_reason TEXT,
  internal_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES admin_accounts(id)
);

CREATE TABLE fraud_flags (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  listing_id UUID REFERENCES listings(id),
  reason TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  confidence_score INTEGER NOT NULL,
  related_entities JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE support_tickets (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_admin_id UUID REFERENCES admin_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE analytics_events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  session_id TEXT,
  event_name TEXT NOT NULL,
  page_path TEXT,
  listing_id UUID REFERENCES listings(id),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX analytics_events_name_created_idx ON analytics_events (event_name, created_at DESC);
