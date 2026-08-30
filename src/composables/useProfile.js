import { ref } from 'vue'
import { supabase } from '@/supabase'
import { useUniventStore } from '@/stores/counter'

export function useProfile(toast) {
  const univentStore = useUniventStore()
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
    // Validate file type (UI claims JPEG/PNG, max 2MB).
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast?.error('Only JPEG, PNG, or WebP images are allowed')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast?.error('Image must be 2MB or less')
      return
    }
    loading.value = true

    try {
      // Remove the previous profile picture from the SAME bucket it was
      // uploaded to (profile_pictures), not the event-fliers bucket.
      if (currentFileName.value) {
        await supabase.storage.from('profile_pictures').remove([currentFileName.value])
      }

      const fileName = `${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('profile_pictures').upload(fileName, file)
      if (error) throw error

      const { data: publicData } = supabase.storage
        .from('profile_pictures')
        .getPublicUrl(fileName)
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

    const { error } = await supabase
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
        options: {
          emailRedirectTo: 'https://univent.website/email-verified',
        },
      })

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
