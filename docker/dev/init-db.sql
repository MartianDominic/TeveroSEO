-- Dev database initialization (simplified - single user, no password complexity)
-- This runs ONCE on fresh postgres volume via /docker-entrypoint-initdb.d/

-- Create databases
CREATE DATABASE open_seo;
CREATE DATABASE alwrity;

-- Enable extensions
\c open_seo
CREATE EXTENSION IF NOT EXISTS pgcrypto;

\c alwrity
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Grant privileges (using default postgres user for simplicity in dev)
GRANT ALL PRIVILEGES ON DATABASE open_seo TO postgres;
GRANT ALL PRIVILEGES ON DATABASE alwrity TO postgres;
