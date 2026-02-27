<script setup>
import { ref } from 'vue'
import { supabase } from '@/supabase'
import { useToast } from 'vue-toastification'

const password = ref('')
const toast = useToast()
const loading = ref(false)
async function updatePassword() {
  try {
    loading.value = true
    const { data, error } = await supabase.auth.updateUser({
      password: password.value,
    })
    if (error) {
      console.error('Error updating password:', error.message)
    } else {
      toast.success('Password updated successfully')
      password.value = ''
      console.log('Password updated successfully:', data)
    }
  } catch (err) {
    console.error('Unexpected error:', err)
  } finally {
    loading.value = false
  }
}
</script>
<template>
  <div class="">
    <h1>Update Password</h1>
    <input v-model="password" type="text" />
    <button @click="updatePassword">
      {{ loading ? 'Updating password...' : 'Update Password' }}
    </button>
  </div>
</template>
