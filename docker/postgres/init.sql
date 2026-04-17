-- DOCKER-03: create both databases and dedicated roles on fresh volume.
-- This file runs ONCE by the postgres:16-alpine image via /docker-entrypoint-initdb.d/.
-- Passwords are set by the companion init.sh using env vars (keeps secrets out of VCS).

-- open-seo-main database
CREATE ROLE open_seo_user WITH LOGIN;
CREATE DATABASE open_seo OWNER open_seo_user;
GRANT ALL PRIVILEGES ON DATABASE open_seo TO open_seo_user;

-- AI-Writer database
CREATE ROLE alwrity_user WITH LOGIN;
CREATE DATABASE alwrity OWNER alwrity_user;
GRANT ALL PRIVILEGES ON DATABASE alwrity TO alwrity_user;

-- Enable pgcrypto for UUIDs in both databases (drizzle schema uses uuid_generate_v4 / gen_random_uuid)
\c open_seo
CREATE EXTENSION IF NOT EXISTS pgcrypto;

\c alwrity
CREATE EXTENSION IF NOT EXISTS pgcrypto;
