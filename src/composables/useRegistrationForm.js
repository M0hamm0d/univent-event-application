import { supabase } from '@/supabase'

/**
 * useRegistrationForm
 * Composable that wraps the Stage 6A custom-registration-form RPCs and the
 * registration_forms / registration_form_versions tables.
 *
 * Convention here matches the existing composables (useEvent.js, useRegistrable.js,
 * useRegisteredEvents.js):
 *   - export const useRegistrationForm = () => { ... return { ... } }
 *   - supabase imported from '@/supabase'
 *   - functions return { success, ...} or throw on unexpected errors
 *
 * Field-definition shape (stored as-is in registration_forms.fields_draft and
 * snapshotted into registration_form_versions.fields on publish):
 *   {
 *     id:           string  // client-side stable id used by the builder (uuid-ish)
 *     key:          string  // unique answer key the validator checks against
 *     type:         'text' | 'textarea' | 'email' | 'phone' | 'number'
 *                  | 'radio' | 'checkbox' | 'select' | 'date'
 *                  | 'file' | 'image'
 *     label:        string
 *     description:  string  (help/description shown under the field)
 *     placeholder:  string
 *     required:     boolean
 *     options:      string[]   // radio / select / checkbox
 *     validation:   { min?: number, max?: number }  // number + date bounds
 *     fileTypes:    string[]  // ['image/*'] etc, for file + image
 *     position:     number
 *   }
 *
 * The DB RPC (_validate_form_answers) is the authoritative validator; this
 * composable performs only lightweight normalization before sending.
 */

export const FIELD_TYPES = [
  { type: 'text', label: 'Short Text', icon: 'TextAa' },
  { type: 'textarea', label: 'Long Text', icon: 'Textalignleft' },
  { type: 'email', label: 'Email', icon: 'Envelope' },
  { type: 'phone', label: 'Phone Number', icon: 'Phone' },
  { type: 'number', label: 'Number', icon: 'NumberSquareZero' },
  { type: 'radio', label: 'Single Choice (Radio)', icon: 'RadiobuttonActive' },
  { type: 'checkbox', label: 'Multiple Choice (Checkbox)', icon: 'Checksquares' },
  { type: 'select', label: 'Dropdown (Select)', icon: 'CaretDown' },
  { type: 'date', label: 'Date', icon: 'Calendar' },
  { type: 'file', label: 'File Upload', icon: 'UploadSimple' },
  { type: 'image', label: 'Image Upload', icon: 'Image' },
]

const CHOICE_TYPES = new Set(['radio', 'checkbox', 'select'])
const FILE_TYPES = new Set(['file', 'image'])
const NUMERIC_TYPES = new Set(['number'])

export const isChoiceField = (t) => CHOICE_TYPES.has(t)
export const isFileField = (t) => FILE_TYPES.has(t)
export const isNumericField = (t) => NUMERIC_TYPES.has(t)

let keySeq = 0
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
}

/**
 * Create a fresh field def with sensible defaults for the given type.
 */
export function makeField(type = 'text', partial = {}) {
  const id =
    partial.id ||
    `f_${Date.now().toString(36)}_${(keySeq++).toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 7)}`
  const fallback = `field_${id.replace(/[^a-z0-9]/gi, '').slice(-6)}`
  const label = partial.label || 'New Field'
  const base = {
    id,
    key: partial.key || slugify(label) || fallback,
    type,
    label,
    description: partial.description || '',
    placeholder: partial.placeholder || '',
    required: !!partial.required,
    options: isChoiceField(type)
      ? Array.isArray(partial.options) && partial.options.length
        ? [...partial.options]
        : ['Option 1', 'Option 2']
      : undefined,
    validation: type === 'number' || type === 'date' ? partial.validation || {} : undefined,
    fileTypes: isFileField(type) ? partial.fileTypes || [] : undefined,
    position: typeof partial.position === 'number' ? partial.position : 0,
  }
  // Strip undefined values so the stored JSON stays compact.
  Object.keys(base).forEach((k) => base[k] === undefined && delete base[k])
  return base
}

/**
 * Ensure all fields have valid, unique keys before sending to the DB.
 * Mutates nothing; returns a normalized copy.
 */
export function normalizeFields(fields) {
  if (!Array.isArray(fields)) return []
  const seen = new Set()
  return fields
    .slice()
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map((f, i) => {
      let key = slugify(f.key) || slugify(f.label) || `field_${i + 1}`
      let n = 1
      while (seen.has(key)) {
        key = `${slugify(f.key) || slugify(f.label) || 'field'}_${++n}`
      }
      seen.add(key)
      return {
        ...f,
        key,
        position: i + 1,
        options:
          isChoiceField(f.type) && Array.isArray(f.options)
            ? f.options.map((o) => String(o)).filter((o) => o !== '')
            : undefined,
        fileTypes:
          isFileField(f.type) && Array.isArray(f.fileTypes)
            ? f.fileTypes.map((t) => String(t))
            : undefined,
        validation:
          f.type === 'number' || f.type === 'date'
            ? {
                min:
                  f.validation?.min !== '' && f.validation?.min != null
                    ? Number(f.validation.min)
                    : undefined,
                max:
                  f.validation?.max !== '' && f.validation?.max != null
                    ? Number(f.validation.max)
                    : undefined,
              }
            : undefined,
      }
    })
}

/**
 * Lightweight organizer-side sanity check before publish. The DB RPC is the
 * real validator; this just gives the builder immediate UX feedback.
 */
export function validateFields(fields) {
  const errors = []
  if (!Array.isArray(fields) || fields.length === 0) {
    errors.push('Add at least one field to the form.')
    return errors
  }
  const keySeen = new Set()
  fields.forEach((f, i) => {
    const ctx = `Field #${i + 1}${f.label ? ` ("${f.label}")` : ''}`
    if (!f.label || !f.label.trim()) errors.push(`${ctx}: label is required.`)
    if (!f.key || !f.key.trim()) errors.push(`${ctx}: key is required.`)
    else if (keySeen.has(f.key)) errors.push(`${ctx}: duplicate key "${f.key}".`)
    else keySeen.add(f.key)
    if (!FIELD_TYPES.some((t) => t.type === f.type)) {
      errors.push(`${ctx}: unknown field type "${f.type}".`)
    }
    if (isChoiceField(f.type)) {
      const opts = Array.isArray(f.options) ? f.options.filter((o) => String(o).trim() !== '') : []
      if (opts.length < 1) errors.push(`${ctx}: add at least one option.`)
    }
    if (f.type === 'number' && f.validation) {
      if (
        f.validation.min !== '' &&
        f.validation.min != null &&
        f.validation.max !== '' &&
        f.validation.max != null &&
        Number(f.validation.min) > Number(f.validation.max)
      ) {
        errors.push(`${ctx}: min cannot be greater than max.`)
      }
    }
  })
  return errors
}

export const useRegistrationForm = () => {
  /**
   * loadForm(eventId)
   *   Organzier path. Returns the form row (incl. fields_draft) for an event
   *   the caller owns, plus the current published version (if any). Returns
   *   null when the event has no custom form yet.
   *   Relies on registration_forms RLS (organizer-of-event SELECT) so the DB
   *   enforces ownership; we don't trust a client-side check.
   */
  const loadForm = async (eventId) => {
    if (!eventId) return null
    const { data, error } = await supabase
      .from('registration_forms')
      .select(
        `
  *,
  current_version:registration_form_versions!registration_forms_current_version_id_fkey(*)
`,
      )
      .eq('event_id', eventId)
      .maybeSingle()
    if (error) throw error
    return data || null
  }

  /**
   * createFormDraft(eventId, organizerId, title?, description?)
   *   Inserts a draft row for an event. Only allowed by the event organizer
   *   (registration_forms_organizer_insert RLS checks organizer_id = auth.uid()
   *   AND events.user_id = auth.uid()).
   */
  const createFormDraft = async ({
    eventId,
    organizerId,
    title = 'Registration Form',
    description = '',
  }) => {
    if (!eventId || !organizerId) {
      return { success: false, error: 'Event and organizer IDs are required.' }
    }
    const { data, error } = await supabase
      .from('registration_forms')
      .insert([
        {
          event_id: eventId,
          organizer_id: organizerId,
          title,
          description,
          status: 'draft',
          fields_draft: [],
        },
      ])
      .select('*')
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, form: data }
  }

  /**
   * saveDraft(formId, { title?, description?, fields_draft? })
   *   Persists the organizer's in-progress work without publishing. Hits the
   *   registration_forms_organizer_update RLS policy (event owner only).
   */
  const saveDraft = async (formId, patch) => {
    if (!formId) return { success: false, error: 'Form ID is required.' }
    const clean = {}
    if (patch.title !== undefined) clean.title = patch.title
    if (patch.description !== undefined) clean.description = patch.description
    if (patch.fields_draft !== undefined) {
      clean.fields_draft = normalizeFields(patch.fields_draft)
    }
    const { data, error } = await supabase
      .from('registration_forms')
      .update(clean)
      .eq('id', formId)
      .select('*')
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, form: data }
  }

  /**
   * publish(formId, fields)
   *   Calls the publish_registration_form RPC. The RPC verifies ownership,
   *   writes an immutable registration_form_versions row, and bumps
   *   registration_forms.current_version_id + status='published'.
   */
  const publish = async (formId, fields) => {
    if (!formId) return { success: false, error: 'Form ID is required.' }
    const normalized = normalizeFields(fields)
    const localErrors = validateFields(normalized)
    if (localErrors.length) {
      return { success: false, error: localErrors.join(' ') }
    }
    const { data, error } = await supabase.rpc('publish_registration_form', {
      p_form_id: formId,
      p_fields: normalized,
    })
    if (error) return { success: false, error: error.message }
    return {
      success: true,
      versionId: data?.version_id,
      version: data?.version,
    }
  }

  /**
   * setStatus(formId, status)
   *   Lets the organizer close / re-open / archive a form by flipping
   *   registration_forms.status. Closing a form stops students from submitting
   *   (register_with_form and update_form_response both enforce status =
   *   'published'). Owned-by-organizer via UPDATE RLS.
   */
  const setStatus = async (formId, status) => {
    if (!['draft', 'published', 'closed', 'archived'].includes(status)) {
      return { success: false, error: 'Invalid status.' }
    }
    const { data, error } = await supabase
      .from('registration_forms')
      .update({ status })
      .eq('id', formId)
      .select('*')
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, form: data }
  }

  /**
   * deleteForm(formId)
   *   Hard-deletes a draft form. Blocked by DB RLS to the event organizer.
   *   Use only on drafts — deleting a published form with responses will
   *   CASCADE-delete the responses too (per FK ON DELETE CASCADE on
   *   registration_form_responses.form_id). For closed events, prefer
   *   setStatus('archived') instead.
   */
  const deleteForm = async (formId) => {
    const { error } = await supabase.from('registration_forms').delete().eq('id', formId)
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  /**
   * getActiveForm(eventId)
   *   Calls the get_active_registration_form RPC (the same rpc Stage 6D's
   *   student form UI will use). Returns the currently published form's
   *   title/description/fields/form_version_id, or null when the event has no
   *   published form (draft / closed / never created). The RPC is SECURITY
   *   DEFINER and returns only the active published version — organizers can
   *   use it to preview exactly what students will see. No drafts or other
   *   versions are exposed. Returns { success, form|null }.
   */
  const getActiveForm = async (eventId) => {
    if (!eventId) return { success: false, error: 'Event ID is required.' }
    const { data, error } = await supabase.rpc('get_active_registration_form', {
      p_event_id: eventId,
    })
    if (error) return { success: false, error: error.message }
    return { success: true, form: data || null }
  }

  /**
   * listVersions(formId)
   *   Returns every published version snapshot for a form (newest first),
   *   including the immutable fields, version number, and published_at. Used
   *   by the builder's version-history panel so the organizer can see what
   *   each cohort of students submitted against. RLS (organizer SELECT on
   *   registration_form_versions) enforces ownership.
   */
  const listVersions = async (formId) => {
    if (!formId) return { success: false, error: 'Form ID is required.' }
    const { data, error } = await supabase
      .from('registration_form_versions')
      .select('id, version, fields, published_at')
      .eq('form_id', formId)
      .order('version', { ascending: false })
    if (error) return { success: false, error: error.message }
    return { success: true, versions: data || [] }
  }

  /**
   * getEventFormResponses(eventId)
   *   Organizer-only. Wraps the get_event_form_responses RPC (Stage 6A).
   *   Returns EVERY submitted response for the event — registered, waitlisted,
   *   and cancelled students alike — joined with profile (name/email/pic) AND
   *   the registration/waitlist state, PLUS the version field-maps the
   *   response was submitted against so each attendee's answers render with
   *   the labels/options that were active at submission time.
   *
   *   Shape:
   *     { form_id, current_version_id, responses: [{
   *         user_id, user_name, user_email, profile_pics,
   *         registration_status, registered_at, waitlisted_at, waitlist_position,
   *         form_version_id, form_version_fields, answers,
   *         submitted_at, updated_at } ... ] }
   *
   *   Returns { success, data } or { success: false, error }.
   */
  const getEventFormResponses = async (eventId) => {
    if (!eventId) return { success: false, error: 'Event ID is required.' }
    const { data, error } = await supabase.rpc('get_event_form_responses', {
      p_event_id: eventId,
    })
    if (error) return { success: false, error: error.message }
    const result = typeof data === 'string' ? JSON.parse(data) : data
    return { success: true, data: result || { responses: [] } }
  }

  return {
    loadForm,
    createFormDraft,
    saveDraft,
    publish,
    setStatus,
    deleteForm,
    getActiveForm,
    listVersions,
    getEventFormResponses,
  }
}
