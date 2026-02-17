<script setup>
// import GoogleLogo from './icons/GoogleLogo.vue'
import UniventAuthLogo from './icons/UniventAuthLogo.vue'
import { useUniventStore } from '../stores/counter'
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import CancelBtn from './icons/CancelBtn.vue'
const login = useUniventStore()
const emit = defineEmits(['closeBtn'])
function openLoginModal() {
  login.loginModal = true
  login.signupModal = false
  console.log('login is' + login.loginModal)
}
// const error = ref('')
const signupName = ref('')
const signupEmail = ref('')
const signupPassword = ref('')
const signupConfirmPassword = ref('')
const { signupBtn, errorMessage } = useAuth()
const loading = ref(false)

async function handleSignUp() {
  loading.value = true
  try {
    const { success } = await signupBtn(
      signupName.value,
      signupEmail.value,
      signupPassword.value,
      signupConfirmPassword.value,
    )
    if (!success) {
      alert('signUp failed')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="view-details-wrapper" @click.stop>
    <div class="close-btn" @click="emit('closeBtn')"><CancelBtn /></div>
    <div class="univentLogo">
      <UniventAuthLogo />
    </div>
    <div class="title">
      <h1>Welcome to UniVent</h1>
      <p>Login or Signup to see what's happening around campus today</p>
    </div>
    <div class="personal-info">
      <div class="input">
        <label for="firstName">Full Name</label>
        <input type="text" name="firstName" placeholder="Enter your name" v-model="signupName" />
      </div>
      <div class="input">
        <label for="email" placeholder="Enter your email address">Email</label>
        <input
          type="email"
          name="email"
          placeholder="Enter your email address"
          v-model="signupEmail"
        />
      </div>
      <div class="input">
        <label for="firstName">Password</label>
        <input
          type="password"
          name="password"
          placeholder="Create a strong password"
          v-model="signupPassword"
        />
        <p>
          Password should be at least 6 characters including one uppercase letter, one lowercase
          letter, one character, and one number.
        </p>
      </div>
      <div class="input">
        <label for="confirmPassword">Confirm Password</label>
        <input
          type="password"
          name="confirmPassword"
          placeholder="Re-enter password"
          v-model="signupConfirmPassword"
        />
      </div>
      <p class="error">{{ errorMessage }}</p>
    </div>
    <div class="create-account-section">
      <button @click="handleSignUp">
        {{ loading ? 'Creating account...' : 'Create Account' }}
      </button>
      <!-- <div class="or-continue-with">
        <div class=""></div>
        <p>or continue with</p>
        <div class=""></div>
      </div>
      <button class="Oauth"><GoogleLogo /> <span>Google</span></button> -->
    </div>
    <div class="have-an-account">
      Already have an account? <span @click="openLoginModal">Login</span>
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
.close-btn {
  display: none;
}
.view-details-wrapper {
  max-width: 90%;
  max-height: 80%;
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
  z-index: 100;
  scrollbar-width: none;
  -ms-overflow-style: none;
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
  margin: 0 4px;
}
@media screen and (max-width: 500px) {
  .view-details-wrapper {
    padding: 30px 30px 70px;
    height: 75%;
  }
  .close-btn {
    display: flex;
    position: fixed;
    top: 10%;
    right: 7%;
  }
}
</style>
