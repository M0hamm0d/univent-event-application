<script setup>
import { ref } from 'vue'
import { supabase } from '@/supabase'

const password = ref('')
async function updatePassword() {
  try {
    const { data, error } = await supabase.auth.updateUser({
      password: password.value,
    })
    if (error) {
      console.error('Error updating password:', error.message)
    } else {
      console.log('Password updated successfully:', data)
    }
  } catch (err) {
    console.error('Unexpected error:', err)
  }
}
</script>
<template>
  <div class="">
    <h1>Update Password</h1>
    <input v-model="password" type="text" />
    <button @click="updatePassword">Update Password</button>
  </div>
</template>
