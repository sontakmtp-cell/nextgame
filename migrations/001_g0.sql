-- Toolchain-only baseline; application tables arrive in T09.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  source_digest text NOT NULL CHECK (length(source_digest) = 64)
);
