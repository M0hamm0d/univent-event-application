<script setup>
// import GoogleLogo from './icons/GoogleLogo.vue'
import UniventAuthLogo from './icons/UniventAuthLogo.vue'
import { useUniventStore } from '../stores/counter'
import { useToast } from 'vue-toastification'
// import { supabase } from '@/supabase'
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import router from '@/router'
import CancelBtn from './icons/CancelBtn.vue'
const emit = defineEmits(['closeBtn'])
let toast = useToast()
let passwordType = ref('password')
// const passwordType = 'text'
const error = ref('')
const login = useUniventStore()
const email = ref('')
const password = ref('')
function openSignupModal() {
  login.loginModal = false
  login.signupModal = true
}
function togglePassword() {
  if (passwordType.value === 'password') {
    passwordType.value = 'text'
  } else {
    passwordType.value = 'password'
  }
}
const isLoading = ref(false)
const { signIn } = useAuth(toast)
async function handleLogin() {
  isLoading.value = true
  const { success, error: signInError } = await signIn(email.value, password.value)
  router.push('/')

  if (!success) {
    error.value = signInError
    setTimeout(() => {
      error.value = ''
    }, 4000)
  }
  isLoading.value = false
}
// async function signIn() {
//   isLoading.value = true
//   try {
//     let { data, error: signInError } = await supabase.auth.signInWithPassword({
//       email: email.value,
//       password: password.value,
//     })
//     if (signInError || !data.user) {
//       error.value = signInError ? signInError.message : 'Login Failed'
//     }
//     if (data) {
//       toast.success('logged in successfully')
//       login.isAuthenticated = true
//       login.loginModal = false
//     }
//   } catch {
//     alert('Something went wrong. Please try again.')
//   } finally {
//     isLoading.value = false
//   }
// }
</script>

<template>
  <div class="closeBtn" @click="emit('closeBtn')"><CancelBtn /></div>
  <div class="view-details-wrapper scroll-hint" @click.stop>
    <div class="univentLogo">
      <UniventAuthLogo />
    </div>
    <div class="title">
      <h1>Welcome Back to UniVent</h1>
      <p>Login to see what's happening around campus today</p>
    </div>
    <div class="personal-info">
      <div class="input">
        <label for="email" placeholder="Enter your email address">Email</label>
        <input type="email" name="email" placeholder="Enter your email address" v-model="email" />
      </div>
      <div class="input password-input">
        <label for="password">Password</label>
        <input
          :type="passwordType"
          name="password"
          placeholder="Enter your password"
          v-model="password"
        />
        <div class="open-close" @click="togglePassword"></div>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </div>
    <div class="create-account-section">
      <button
        @click="handleLogin"
        :style="{
          backgroundColor: isLoading ? '#6B7280' : '#000000',
          cursor: isLoading ? 'not-allowed' : 'pointer',
        }"
      >
        {{ isLoading ? 'Signing In....' : 'Log in' }}
      </button>
      <!-- <div class="or-continue-with">
        <div class=""></div>
        <p>or Login with</p>
        <div class=""></div>
      </div>
      <button class="Oauth"><GoogleLogo /> <span>Google</span></button> -->
    </div>
    <div class="have-an-account">
      Don't have an account?
      <span @click="openSignupModal">Signup</span>
    </div>
    <p class="privacy-policy">
      By signing up, you agree to UniVent’s <span>Privacy Policy</span> and
      <span>Terms of Service</span>
    </p>
  </div>
</template>
<style scoped>
p,
h1,
h2,
h4 {
  margin: 0;
}
.error {
  color: red;
}
.view-details-wrapper {
  max-width: 90%;
  max-height: 90%;
  height: 73%;
  /* max-width: 717px; */
  width: 450px;
  background-color: #fff;
  margin: auto;
  padding: 30px;
  border-radius: 32px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  /* z-index: 100; */
}
.view-details-wrapper::-webkit-scrollbar {
  display: none;
}

.univentLogo {
  display: flex;
  justify-content: center;
}
.title {
  display: flex;
  justify-content: center;
  flex-direction: column;
}
.title h1,
.title p {
  text-align: center;
}
.title h1 {
  font-weight: 600;
  font-size: 29px;
  line-height: 120%;
}
.title p,
.personal-info .input label {
  font-weight: 500;
  font-size: 15px;
  line-height: 22.5px;
  color: #959595;
}
.personal-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.personal-info .input {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.password-input {
  position: relative;
}
.open-close {
  width: 15px;
  height: 15px;
  background-color: #000;
  position: absolute;
  bottom: 12px;
  right: 15px;
  /* z-index: 100; */
}
.personal-info .input label {
  color: #2d2d2d;
}
.personal-info .input input {
  padding: 12px;
  border: 1px solid #eaeaea;
  border-radius: 12px;
  outline: none;
}
.personal-info .input input:active,
.personal-info .input input:focus {
  border: 1px solid #1969fe;
}
.input p {
  color: #959595;
  font-size: 15px;
}
.create-account-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.create-account-section button:first-child {
  background-color: #000;
  width: 100%;
  text-align: center;
  border: none;
  border-radius: 8px;
  padding: 12px;
  font-weight: 600;
  color: #fff;
  font-family: Geist;
  cursor: pointer;
}
.create-account-section .Oauth {
  background-color: transparent;
  width: 100%;
  text-align: center;
  display: flex;
  align-items: center;
  border: none;
  border-radius: 8px;
  padding: 12px;
  font-weight: 600;
  font-size: 12px;
  justify-content: center;
  gap: 8px;
  border: 1px solid #eaeaea;
  font-family: Geist;
  cursor: pointer;
}
.or-continue-with {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.or-continue-with div {
  width: 100%;
  height: 1px;
  background-color: #eaeaea;
}
.or-continue-with p {
  width: max-content;
  font-weight: 15px;
  display: flex;
  text-wrap: nowrap;
}
.have-an-account,
.privacy-policy {
  display: flex;
  color: #959595;
  font-weight: 500;
  font-style: Medium;
  font-size: 15px;
  line-height: 22.5px;
  display: flex;
  justify-content: center;
}
.privacy-policy {
  display: inline;
}
.have-an-account span,
.privacy-policy span {
  color: #2d2d2d;
  text-decoration: underline;
  font-weight: 600;
  cursor: pointer;
  margin: 0 5px;
}
.closeBtn {
  display: none;
}
@media screen and (max-width: 500px) {
  .view-details-wrapper {
    padding-bottom: 80px;
  }
  .closeBtn {
    display: flex;
    position: fixed;
    top: 10%;
    right: 7%;
  }
}
</style>
