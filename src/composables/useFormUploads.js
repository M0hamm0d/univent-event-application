import { ref } from 'vue'
import { supabase } from '@/supabase'
import { useToast } from 'vue-toastification'

const BUCKET = 'registration-form-uploads'
const MAX_BYTES = 10 * 1024 * 1024

export function useFormUploads() {
  const toast = useToast()
  const uploading = ref(false)
  const progress = ref(0)

  async function buildPath(eventId, fileName) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Authentication required to upload')
    const safeName = String(fileName || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_')
    return `${user.id}/${eventId}/${Date.now()}_${safeName}`
  }

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

function matchesMime(accepted, fileType, fileName) {
  if (!accepted) return true
  const acc = accepted.toLowerCase().trim()
  if (acc === '*/*' || acc === '*') return true
  if (acc.endsWith('/*')) {
    const prefix = acc.slice(0, -1)
    return (fileType || '').toLowerCase().startsWith(prefix)
  }
  if (fileType && fileType.toLowerCase() === acc) return true
  if (acc.includes('/') && acc.split('/')[1]) {
    const ext = '.' + acc.split('/')[1]
    return (fileName || '').toLowerCase().endsWith(ext)
  }
  return false
}