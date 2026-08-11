-- UniVent Registration System — Stage 6A: private file bucket for form uploads
-- Run after 20260809000006_custom_form_rls.sql.
-- Idempotent (uses INSERT ... ON CONFLICT and DROP POLICY IF EXISTS).
--
-- Why a private bucket:
--   Custom form file/image answers (ID cards, proof docs, etc.) are private.
--   They must NOT be readable via public URLs. Organizers are never granted
--   SELECT on storage.objects for this bucket via RLS — they access files only
--   through the serverless signed-URL endpoint (api/form-file.js, Stage 6G),
--   which verifies event ownership first. The anonymous key cannot read these.
--
-- Path layout (enforced by storage RLS below):
--   {user_id}/{event_id}/{timestamp}_{filename}
-- The first path segment is the student's auth uid; storage RLS uses it to
-- scope who may INSERT / SELECT / DELETE. The serverless endpoint additionally
-- checks the path belongs to a registration_form_responses row for the
-- requester's event before issuing a signed URL to an organizer.

-- ============================================================================
-- Create the bucket (private). Buckets are not currently version-controlled in
-- this repo (the existing event-fliers / profile_pictures / issue-url buckets
-- were created out of band); defining this one in SQL keeps Stage 6 reproducible.
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('registration-form-uploads', 'registration-form-uploads', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ============================================================================
-- storage.objects RLS for the registration-form-uploads bucket.
--============================================================================
-- Tables in the storage schema already have RLS enabled by the storage system.
-- We only add policies scoped to our bucket.
--
-- Conventions used:
--   (storage.foldername(name))[1] -> the first path segment = uploader's user_id
--   bucket_id = 'registration-form-uploads'
--
-- INSERT: a student may only upload into <their_uid>/...
-- SELECT: a student may read only their own uploads. Organizers do NOT receive
--         a SELECT policy here — they go through the signed-URL endpoint.
-- DELETE: a student may remove only their own uploads (used by the edit flow to
--         clean up orphaned files when an upload is replaced).
-- UPDATE: none (files are immutable once uploaded).
-- ============================================================================

DROP POLICY IF EXISTS "form_uploads_owner_insert" ON storage.objects;
CREATE POLICY "form_uploads_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'registration-form-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "form_uploads_owner_select" ON storage.objects;
CREATE POLICY "form_uploads_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'registration-form-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "form_uploads_owner_delete" ON storage.objects;
CREATE POLICY "form_uploads_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'registration-form-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );