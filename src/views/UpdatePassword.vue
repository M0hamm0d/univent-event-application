<script setup>
import { ref } from 'vue'
import { supabase } from '@/supabase'
import { useToast } from 'vue-toastification'
import BaseButton from '@/components/BaseButton.vue'

const password = ref('')
const confirmPassword = ref('')
const toast = useToast()
const loading = ref(false)
async function updatePassword() {
  if (!password.value || password.value.length < 6) {
    toast.error('Password must be at least 6 characters')
    return
  }
  if (password.value !== confirmPassword.value) {
    toast.error('Passwords do not match')
    return
  }
  try {
    loading.value = true
    const { error } = await supabase.auth.updateUser({
      password: password.value,
    })
    if (error) {
      toast.error('Failed to update password: ' + error.message)
    } else {
      toast.success('Password updated successfully')
      password.value = ''
      confirmPassword.value = ''
    }
  } catch (err) {
    toast.error('An unexpected error occurred')
    console.error('Unexpected error:', err)
  } finally {
    loading.value = false
  }
}
</script>
<template>
  <div class="">
    <h1>Update Password</h1>
    <input v-model="password" type="password" placeholder="New password" />
    <input v-model="confirmPassword" type="password" placeholder="Confirm new password" />
    <BaseButton variant="primary" :loading="loading" @click="updatePassword">
      Update Password
    </BaseButton>
  </div>
</template>
