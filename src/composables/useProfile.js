import { ref } from 'vue'
import { supabase } from '@/supabase'
import { useUniventStore } from '@/stores/counter'
const univentStore = useUniventStore()

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
    if (!session) return toast?.error('You must be logged in to edit profile')

    if (!formData.value.email || formData.value.email.trim() === '') {
      toast?.error('Email cannot be empty')
      return
    }

    const updates = {}
    if (formData.value.fullname) updates.user_name = formData.value.fullname
    // if (formData.value.email) updates.user_email = formData.value.email
    if (formData.value.image_url) updates.profile_pics = formData.value.image_url
    if (formData.value.interest?.length) updates.interested_events = formData.value.interest

    const previousEmail = univentStore.userProfile?.user_email
    const newEmail = formData.value.email.trim()
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (previousEmail !== newEmail && regex.test(newEmail)) {
      updates.user_email = newEmail
    } else if (newEmail && !regex.test(newEmail)) {
      toast?.error('Please enter a valid email address')
      return
    }

    console.log(univentStore.userProfile?.user_email, 'store email')

    const { data, error } = await supabase
      .from('profile')
      .update(updates)
      .eq('id', session.user.id)
      .select()

    if (error) {
      toast?.error(error.message)
      return
    }
    if (newEmail !== previousEmail) {
      const { error: authError } = await supabase.auth.updateUser({
        email: newEmail,
      })
      console.log('updated email in auth')

      if (authError) {
        toast?.error(`Profile updated but failed to update auth email: ${authError.message}`)
        return
      }
    }

    toast?.success('Profile updated successfully')
    univentStore.userProfile = { ...univentStore.userProfile, ...updates }
  }

  return {
    formData,
    currentFileName,
    loading,
    handleFileChange,
    submitEditProfile,
  }
}
