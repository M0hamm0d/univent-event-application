import { ref } from 'vue'
import { supabase } from '@/supabase'
import { useToast } from 'vue-toastification'

/**
 * useFormUploads
 * Student-side composable for secure file/image uploads to the private
 * `registration-form-uploads` bucket created in Stage 6A migration 007.
 *
 * Path layout (enforced by storage.objects RLS — owner = first path segment):
 *   {user_id}/{event_id}/{timestamp}_{filename}
 *
 * The student uploads DIRECTLY to Supabase Storage (no serverless proxy needed
 * for the upload itself) — storage RLS allows INSERT only when the path's
 * first segment equals auth.uid(). Reads (SELECT) are equally owner-scoped, so
 * the anon key + another student can never read these files.
 *
 * Organizer download goes through the /api/form-file.js serverless endpoint
 * (Stage 6G) which verifies event ownership before issuing a short-lived
 * signed URL using the service-role key. Students download their own files the
 * same way (owner branch in the endpoint) so all access is auditable.
 *
 * Orphan cleanup: when update_form_response (Stage 6A) returns
 * `removed_file_paths`, the client calls removeFiles() to delete the
 * previously-referenced files from storage. RLS allows owner DELETE.
 */

const BUCKET = 'registration-form-uploads'
// Max upload size — generous enough for ID cards / proof docs, small enough
// to keep storage costs sane. Matches the existing event-flier 3MB cap loosely;
// bumped to 10MB since ID scans are typically larger than a flyer.
const MAX_BYTES = 10 * 1024 * 1024

export function useFormUploads() {
  const toast = useToast()
  const uploading = ref(false)
  const progress = ref(0)

  /**
   * buildPath(eventId, fileName)
   *   Constructs the storage path: {uid}/{eventId}/{timestamp}_{fileName}.
   *   The first segment MUST be the caller's auth uid (storage RLS enforces
   *   this on INSERT). We don't sanitize the filename beyond basic trimming —
   *   the timestamp prefix makes collisions effectively impossible.
   */
  async function buildPath(eventId, fileName) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Authentication required to upload')
    const safeName = String(fileName || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_')
    return `${user.id}/${eventId}/${Date.now()}_${safeName}`
  }

  /**
   * uploadFile(file, eventId, acceptedTypes?)
   *   Validates size + MIME, builds the owner-scoped path, uploads to the
   *   private bucket. Returns the storage `name` (path) the RPC stores in
   *   `registration_form_responses.answers[fieldKey]`. The path is what the
   *   validator in _validate_form_answers checks against (prefix
   *   {uid}/{eventId}/) and what the signed-URL endpoint uses to fetch.
   *   Returns { success, path } or { success: false, error }.
   */
  async function uploadFile(file, eventId, acceptedTypes = []) {
    if (!file) return { success: false, error: 'No file provided.' }
    if (file.size > MAX_BYTES) {
      return { success: false, error: `File is too large (max ${MAX_BYTES / 1024 / 1024}MB).` }
    }
    if (Array.isArray(acceptedTypes) && acceptedTypes.length > 0) {
      const ok = acceptedTypes.some((t) => matchesMime(t, file.type, file.name))
      if (!ok) {
        return { success: false, error: `File type not allowed. Accepted: ${acceptedTypes.join(', ')}` }
      }
    }

    uploading.value = true
    progress.value = 0
    try {
      const path = await buildPath(eventId, file.name)
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        })
      if (error) {
        return { success: false, error: error.message }
      }
      progress.value = 100
      return { success: true, path }
    } catch (err) {
      return { success: false, error: err?.message || 'Upload failed' }
    } finally {
      uploading.value = false
    }
  }

  /**
   * removeFiles(paths)
   *   Deletes the given storage paths. Used for orphan cleanup after an edit
   *   (update_form_response returns the unreferenced old paths). Also used when
   *   a student removes a file in the editor without submitting. Storage RLS
   *   allows DELETE only by the path owner (first segment = auth.uid()).
   *   Returns { success, count }.
   */
  async function removeFiles(paths) {
    if (!Array.isArray(paths) || paths.length === 0) return { success: true, count: 0 }
    try {
      const { error } = await supabase.storage.from(BUCKET).remove(paths)
      if (error) {
        console.warn('removeFiles error:', error.message)
        return { success: false, error: error.message, count: 0 }
      }
      return { success: true, count: paths.length }
    } catch (err) {
      console.warn('removeFiles exception:', err)
      return { success: false, error: err?.message || 'Remove failed', count: 0 }
    }
  }

  /**
   * fetchSignedUrl(path)
   *   Calls the /api/form-file.js serverless endpoint to obtain a short-lived
   *   signed download URL. The endpoint verifies the requester is either the
   *   file owner (student) or the event organizer (Stage 6G ownership check)
   *   before issuing the URL. Returns { success, url } or { success: false, error }.
   *   The URL is short-lived (60s) so even if leaked it expires fast.
   */
  async function fetchSignedUrl(path, eventId) {
    if (!path) return { success: false, error: 'No file path provided.' }
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return { success: false, error: 'Authentication required' }

      const res = await fetch('/api/form-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ path, eventId }),
      })
      // Guard the JSON parse: an empty/non-JSON response (e.g. the endpoint is
      // not deployed, or a gateway returned an empty body) would otherwise
      // throw "Unexpected end of JSON input" and bubble up as a cryptic toast.
      const text = await res.text()
      let data = null
      if (text) {
        try {
          data = JSON.parse(text)
        } catch {
          return {
            success: false,
            error: 'Download endpoint unavailable. Is the /api/form-file function deployed?',
          }
        }
      }
      if (!res.ok || !data?.url) {
        return {
          success: false,
          error: data?.message || 'Could not get download link',
        }
      }
      return { success: true, url: data.url }
    } catch (err) {
      return { success: false, error: err?.message || 'Network error' }
    }
  }

  /**
   * downloadFile(path, eventId)
   *   Convenience: fetches the signed URL and opens it in a new tab / triggers
   *   a download. Returns { success } so the caller can show a toast on failure.
   */
  async function downloadFile(path, eventId) {
    const r = await fetchSignedUrl(path, eventId)
    if (!r.success) {
      toast.error(r.error || 'Could not download file')
      return { success: false }
    }
    window.open(r.url, '_blank', 'noopener,noreferrer')
    return { success: true }
  }

  return {
    uploading,
    progress,
    uploadFile,
    removeFiles,
    fetchSignedUrl,
    downloadFile,
  }
}

/**
 * matchesMime(accepted, fileType, fileName)
 *   Wildcard-aware MIME matching for the upload guard. `accepted` is a single
 *   pattern like 'image/*' or 'application/pdf'. Falls back to extension
 *   matching when the browser doesn't provide a MIME type (rare but possible).
 */
function matchesMime(accepted, fileType, fileName) {
  if (!accepted) return true
  const acc = accepted.toLowerCase().trim()
  if (acc === '*/*' || acc === '*') return true
  if (acc.endsWith('/*')) {
    const prefix = acc.slice(0, -1) // 'image/'
    return (fileType || '').toLowerCase().startsWith(prefix)
  }
  if (fileType && fileType.toLowerCase() === acc) return true
  // Extension fallback.
  if (acc.includes('/') && acc.split('/')[1]) {
    const ext = '.' + acc.split('/')[1]
    return (fileName || '').toLowerCase().endsWith(ext)
  }
  return false
}