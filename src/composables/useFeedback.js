// composables/useFeedback.js
import { supabase } from '@/supabase'
import { toRaw, unref } from 'vue'

export async function handleFileChange(event, formData, currentFileName, loading) {
  const file = event.target.files[0]
  formData.issueFileName = file.name
  loading = true

  try {
    if (currentFileName) {
      const { error: deleteError } = await supabase.storage
        .from('issue-url')
        .remove([currentFileName])

      if (deleteError) {
        console.warn('Failed to delete old file:', deleteError.message)
      }
    }

    const fileName = `${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('issue-url').upload(fileName, file)
    const { data: publicData } = supabase.storage.from('issue-url').getPublicUrl(fileName)

    formData.issueFileUrl = publicData.publicUrl
    currentFileName = fileName

    if (error) throw error
  } catch (err) {
    console.error('Error uploading file:', err.message)
  } finally {
    loading = false
  }
}

export async function submitIssue(formData, selected, toast) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (formData.email === '' || !emailPattern.test(formData.email)) {
    toast.error('Kindly enter a valid email address')
    return
  }

  if (formData.fullname === '') {
    toast.error('Name input cannot be empty')
    return
  }

  if (formData.issueDescription === '' && formData.issueFileName === '') {
    toast.error('Issue Description cannot be empty')
    return
  }
  const rawForm = toRaw(formData)
  const rawSelected = unref(selected)
  console.log(rawForm)
  const payload = {
    fullname: rawForm.fullname,
    email: rawForm.email,
    subject: rawForm.subject,
    issue_description: rawForm.issueDescription,
    issue_filename: rawForm.issueFileName,
    issue_file_url: rawForm.issueFileUrl,
    issue_type: rawSelected,
  }

  const { data, error } = await supabase.from('user-feedback').insert([payload]).select()

  if (data) {
    toast.success('Issue successfully submitted')
    Object.keys(formData).forEach((key) => (formData[key] = ''))
  } else {
    toast.error(error.message)
  }
}
