import { ref } from 'vue'
import { supabase } from '@/supabase'

export function useProfile(toast) {
  const formData = ref({
    fullname: '',
    email: '',
    image_url: '',
    interest: [],
  })
  const currentFileName = ref('')
  const loading = ref(false)

  async function handleFileChange(event) {
    const file = event.target.files[0]
    if (!file) return
    loading.value = true

    try {
      if (currentFileName.value) {
        await supabase.storage.from('profile_pictures').remove([currentFileName.value])
      }

      const fileName = `${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('event-fliers').upload(fileName, file)
      if (error) throw error

      const { data: publicData } = supabase.storage.from('event-fliers').getPublicUrl(fileName)
      formData.value.image_url = publicData.publicUrl
      currentFileName.value = fileName
    } catch (err) {
      console.error('File upload error:', err.message)
      toast?.error('Image upload failed')
    } finally {
      loading.value = false
    }
  }

  async function submitEditProfile() {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) return

    const updates = {}
    if (formData.value.fullname) updates.user_name = formData.value.fullname
    if (formData.value.email) updates.user_email = formData.value.email
    if (formData.value.image_url) updates.profile_pics = formData.value.image_url
    if (formData.value.interest?.length) updates.interested_events = formData.value.interest

    const { data, error } = await supabase
      .from('profile')
      .update(updates)
      .eq('id', session.user.id)
      .select()

    if (error) {
      toast?.error(error.message)
      return
    }

    if (data) {
      toast?.success('Edit successful')
    }
  }

  return {
    formData,
    currentFileName,
    loading,
    handleFileChange,
    submitEditProfile,
  }
}
