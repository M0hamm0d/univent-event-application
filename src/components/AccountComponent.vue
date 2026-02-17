<script setup>
import AcademicIcon from './icons/AcademicIcon.vue'
import SocialIcon from './icons/SocialIcon.vue'
import SportIcon from './icons/SportIcon.vue'
import CulturalIcon from './icons/CulturalIcon.vue'
import ClubIcon from './icons/ClubIcon.vue'
import CareerIcon from './icons/CareerIcon.vue'
import TechIcon from './icons/TechIcon.vue'
import { useToast } from 'vue-toastification'
import { supabase } from '@/supabase'
import { onMounted, ref } from 'vue'
import { useProfile } from '@/composables/useProfile'
import { useUniventStore } from '@/stores/counter'
import CautionIcon from './icons/CautionIcon.vue'
import ProfileIcon from './icons/ProfileIcon.vue'

const toast = useToast()
const univentStore = useUniventStore()
const accordionContent = ref(false)

// use composable
const { formData, loading, handleFileChange, submitEditProfile } = useProfile(toast)

const interestList = [
  { icon: AcademicIcon, name: 'Academic Workshops', value: 'Academic Workshops', id: 'academic' },
  { icon: SocialIcon, name: 'Social Gatherings', value: 'Social Gatherings', id: 'social' },
  { icon: SportIcon, name: 'Sports Events', value: 'Sports Events', id: 'sport' },
  { icon: CulturalIcon, name: 'Cultural Activities', value: 'Cultural Activities', id: 'culture' },
  { icon: ClubIcon, name: 'Clubs & Organizations', value: 'Clubs & Organizations', id: 'club' },
  { icon: CareerIcon, name: 'Career Fairs', value: 'Career Fairs', id: 'career' },
  { icon: TechIcon, name: 'Tech & innovations', value: 'Tech & innovations', id: 'tech' },
]

function unCheckList(index) {
  formData.value.interest.splice(index, 1)
  accordionContent.value = true
}

function interestIcon(interest) {
  const map = {
    'Academic Workshops': AcademicIcon,
    'Social Gatherings': SocialIcon,
    'Sports Events': SportIcon,
    'Cultural Activities': CulturalIcon,
    'Clubs & Organizations': ClubIcon,
    'Career Fairs': CareerIcon,
    'Tech & innovations': TechIcon,
  }
  return map[interest] || null
}

const fetchProfile = async (userId) => {
  const { data, error } = await supabase.from('profile').select('*').eq('id', userId).single()

  if (error) {
    console.error('Error fetching profile:', error.message)
    return null
  }
  return data
}
const fetchSession = async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    console.error('Error fetching session:', error.message)
    return null
  }
  console.log(data.session)
  return data.session
}

onMounted(async () => {
  const session = await fetchSession()
  univentStore.userProfile = await fetchProfile(session?.user.id)
  console.log('univentStore.userprofile', univentStore.userProfile)

  formData.value = {
    fullname: univentStore.userProfile.user_name,
    email: univentStore.userProfile.user_email,
    image_url: univentStore.userProfile.profile_pics,
    interest: univentStore.userProfile.interested_events || [],
  }
})
</script>
<template>
  <div class="account-wrapper">
    <div class="account-settings-header">
      <h3>Account Settings</h3>
      <p>Update your profile to get better event recommendations tailored to your interests.</p>
    </div>
    <div class="account-settings-body">
      <div class="account-info-section">
        <div class="upload-profile">
          <p>Upload profile Picture</p>
          <div class="">
            <div class="profile-pics" v-if="!formData.image_url">
              <ProfileIcon />
            </div>
            <div class="profile-picture" v-if="formData.image_url && !loading">
              <img loading="lazy" :src="formData.image_url" alt="" />
            </div>
            <div class="" v-if="loading">Loading...</div>
            <div class="choose-file">
              <label for="choose-file" class="label-choose-file">Choose File</label>
              <input type="file" name="choose file" id="choose-file" @change="handleFileChange" />
              <p>JPEG/PNG, max 2MB</p>
            </div>
          </div>
        </div>
        <form>
          <div class="">
            <label for="name">Full Name</label>
            <input
              type="text"
              id="name"
              placeholder="Enter your full name here"
              v-model="formData.fullname"
            />
          </div>
          <div class="">
            <label for="email">Email</label>
            <input
              type="email"
              id="email"
              placeholder="Enter your email here"
              v-model="formData.email"
            />
          </div>
        </form>
        <div class="interested-section">
          <h4>Interested</h4>
          <div class="">
            <div class="accordion" @click="accordionContent = !accordionContent">
              <p v-if="formData.interest.length === 0">Select your interest(s)</p>
              <div class="interested" v-if="formData.interest.length > 0">
                <div class="interest-checked" v-for="(interest, i) in formData.interest" :key="i">
                  <div class="">
                    <component :is="interestIcon(interest)" />
                    <p>{{ interest }}</p>
                  </div>
                  <button type="button" @click="unCheckList(i)">X</button>
                </div>
              </div>
              <DropdownIcon />
            </div>
            <div class="accordion-content" v-if="accordionContent">
              <label
                :for="interest.id"
                class="interest-list"
                v-for="(interest, i) in interestList"
                :key="i"
                :class="{
                  disabled:
                    formData.interest.length >= 3 && !formData.interest.includes(interest.value),
                }"
              >
                <div class="">
                  <span><component :is="interest.icon" /></span>
                  <span>{{ interest.name }}</span>
                </div>
                <input
                  :id="interest.id"
                  type="checkbox"
                  :name="interest.name"
                  :value="interest.value"
                  v-model="formData.interest"
                  :disabled="
                    formData.interest.length >= 3 && !formData.interest.includes(interest.value)
                  "
                />
              </label>
            </div>
          </div>
          <p><CautionIcon /> Select up to 3 to personalize your feed.</p>
        </div>
      </div>
      <button class="save-changes" @click="submitEditProfile">Save Changes</button>
    </div>
  </div>
</template>
<style scoped>
.account-wrapper {
  display: flex;
  flex-direction: column;
  gap: 48px;
}
h1,
h2,
h3,
h4,
h5,
h6,
p {
  padding: 0;
  margin: 0;
}
.account-settings-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.account-settings-header p {
  color: #959595;
}
.account-settings-body {
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.account-info-section,
.upload-profile,
.choose-file {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.upload-profile {
  gap: 4px;
}
.upload-profile > div {
  display: flex;
  gap: 16px;
  align-items: center;
}
.upload-profile > p {
  font-size: 15px;
  font-weight: 500;
}
.profile-pics {
  width: 104px;
  height: 104px;
  background-color: #f4f4f4;
  border-radius: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.profile-picture {
  width: 104px;
  height: 104px;
  border-radius: 100%;
}
.profile-picture img {
  width: 100%;
  height: 100%;
  border-radius: 100%;
  box-sizing: border-box;
  object-fit: cover;
}
.choose-file {
  gap: 3px;
}
.choose-file input[type='file'] {
  display: none;
}
.label-choose-file {
  color: #1969fe;
  font-weight: 600;
  cursor: pointer;
}
.choose-file p {
  color: #959595;
}
form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
form div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
form div label {
  font-weight: 500;
  font-size: 15px;
  line-height: 22.5px;
  color: #2d2d2d;
}
form div input {
  padding: 12px;
  background: #f4f4f4;
  border-radius: 10px;
  border: none;
  outline: none;
  border: 1px solid #f4f4f4;
}
form div input:focus {
  border: 1px solid #1969fe;
}
.interested-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.interested-section p {
  display: flex;
  gap: 4px;
  font-size: 15px;
  color: #959595;
}
.interested-section > div {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.interested {
  display: flex;
  gap: 4px;
}
.interest-checked,
.interest-checked div {
  display: flex;
  align-items: center;
  gap: 8px;
}
.interest-checked button {
  padding: 0;
  padding-left: 4px;
  border: none;
  margin: 0;
  background-color: transparent;
}
.interest-checked {
  background-color: #f4f4f4;
  padding: 2px 8px;
  border-radius: 8px;
}
.accordion .interest-checked p,
.accordion .interest-checked button {
  font-size: 12px;
}
.interest-checked svg {
  width: 16px;
}
.accordion {
  display: flex;
  justify-content: space-between;
  border: 1px solid #eaeaea;
  padding: 12px;
  border-radius: 4px;
}
.accordion p {
  color: #959595;
  font-size: 15px;
}
.accordion-content {
  display: inline-block;
  flex-direction: column;
  padding: 4px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid #eaeaea;
  box-shadow: 0px 10px 15px 0px #0000000d;
}
.interest-list {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 12px;
  cursor: pointer;
}
.interest-list div {
  display: flex;
  gap: 8px;
}
.interest-list:hover {
  background-color: #f4f4f4;
}
.interest-list.disabled {
  background-color: #f5f5f5;
  color: #e0e0e0;
  cursor: not-allowed;
}
.interest-list span {
  font-weight: 600;
  font-size: 15px;
  line-height: 22.5px;
  color: #5a5a5a;
}
.save-changes {
  width: fit-content;
  background: #1969fe;
  border: 1px solid #bad2ff;
  padding: 16px 20px;
  color: #fff;
  font-weight: 600;
  border-radius: 64px;
  font-size: 19px;
  line-height: 120%;
}
</style>
