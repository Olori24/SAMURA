# SAMURA RLS rollout runbook

## Scope

The RLS migration protects `public.conversation`, `public.message`, and `public.usage_record`. It is not a replacement for Better Auth checks or explicit owner predicates. The application must use a verified session user ID and execute every query against these tables inside `withUserTransaction()`.

## Required deployment order

1. Provision a dedicated PostgreSQL login role named `samura_runtime` with `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`. Never use `neondb_owner` as the application role after RLS enforcement is enabled.
2. Apply `drizzle/0004_user_data_rls.sql` using the privileged migration connection.
3. Set a strong, unique password for `samura_runtime` through a secure database operation. Do not commit it or print it in logs.
4. Store the role-specific connection string in Vercel as sensitive `SAMURA_DATABASE_URL`. The code uses it ahead of `DATABASE_URL`.
5. Verify the deployed environment has the correct role and migration before setting `SAMURA_RLS_ENABLED=true`. This flag makes each user-data transaction issue `SET LOCAL ROLE samura_runtime` and set `app.user_id` from the verified Better Auth session.
6. Verify anonymous requests, authenticated reads/writes, two-user isolation, chat persistence, and password recovery. Roll back the environment flag and connection string if checks fail.

## Preview verification record

On the disposable Neon branch `preview/security/rls-tenant-isolation`, the RLS policies were enabled and forced. The `samura_runtime` role was verified with `rolsuper=false` and `rolbypassrls=false`. With a transaction-local identity for user A, it saw only A's conversation, message, and usage rows; it saw no rows for user B; a cross-user update changed zero rows; a cross-user insert was rejected by PostgreSQL; and without an identity it saw zero rows.

The temporary test data uses `example.invalid` email addresses and must not be copied to production. The production migration and production database URL have not been changed by this work.
