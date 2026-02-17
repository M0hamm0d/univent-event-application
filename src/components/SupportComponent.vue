<script setup>
import { ref } from 'vue'
import { useToast } from 'vue-toastification'
import { handleFileChange, submitIssue } from '@/composables/useFeedback'
import ClearIcon from './icons/ClearIcon.vue'
import IssueTag from './icons/IssueTag.vue'
import DropdownIcon from './icons/DropdownIcon.vue'

const toast = useToast()
const selected = ref('Select your Type of issue')
const currentFileName = ref('')
const loading = ref(false)
const emailError = ref('')
const fullnameError = ref('')
const issueDescriptionError = ref('')
const accordionContent = ref(false)

const formData = ref({
  fullname: '',
  email: '',
  subject: '',
  issueDescription: '',
  issueFileName: '',
  issueFileUrl: '',
  issueType: '',
})

const interestList = [
  { name: 'Account/Login' },
  { name: 'Event Submission' },
  { name: 'Bug Report' },
  { name: 'Feature Request' },
  { name: 'Other' },
]

async function onSubmit() {
  await submitIssue(formData.value, selected, toast)
}

function onClick(id) {
  selected.value = id
}

function clearForm() {
  Object.keys(formData.value).forEach((key) => (formData.value[key] = ''))
}
</script>
<template>
  <div class="account-wrapper">
    <div class="account-settings-header">
      <h3>Get Support</h3>
      <p>
        Need help? Submit a ticket, and our team will get back to you ASAP—typically within 24
        hours.
      </p>
    </div>
    <div class="account-settings-body">
      <div class="account-info-section">
        <form>
          <div class="">
            <label for="name">Full Name</label>
            <input
              type="text"
              id="name"
              v-model="formData.fullname"
              placeholder="Enter your full name here"
            />
            <p class="name-error" v-if="fullnameError != ''">{{ fullnameError }}</p>
          </div>
          <div class="">
            <label for="email">Email</label>
            <input
              type="email"
              id="email"
              v-model="formData.email"
              placeholder="Enter your email here"
            />
            <p class="email-error" v-if="emailError != ''">{{ emailError }}</p>
          </div>
          <div class="">
            <label for="subject">Subject</label>
            <input
              type="text"
              id="subject"
              v-model="formData.subject"
              placeholder="e.g., Issue with event submission"
            />
          </div>
          <div class="describe-issue">
            <label for="issue-textarea">Describe Your Issue</label>
            <textarea
              type="text"
              id="issue-textarea"
              v-model="formData.issueDescription"
              rows="10"
              placeholder="Tell us what's going on... Include details like screenshots if possible."
            ></textarea>
            <p class="email-error" v-if="issueDescriptionError != ''">
              {{ issueDescriptionError }}
            </p>
            <div class="absolute">
              <input
                type="file"
                name="issue file 0r screenshot"
                id="issue"
                @change="(e) => handleFileChange(e, formData, currentFileName, loading)"
              />
              <label for="issue"><IssueTag /> </label>
              <p class="" v-if="loading">Loading</p>
              <p class="" v-if="formData.issueFileName">{{ formData.issueFileName }}</p>
            </div>
          </div>
        </form>
        <div class="interested-section">
          <h4>Issue Type</h4>
          <div class="">
            <div class="accordion" @click="accordionContent = !accordionContent">
              <p>{{ selected }}</p>
              <DropdownIcon />
            </div>
            <div class="accordion-content" v-if="accordionContent">
              <label
                class="interest-list"
                v-for="(interest, i) in interestList"
                :key="i"
                @click="onClick(interest.name)"
              >
                <div class="">
                  <span>{{ interest.name }}</span>
                </div>
                <div class="" v-if="interest.name == `${selected}`">✓</div>
              </label>
            </div>
          </div>
        </div>
      </div>
      <div class="submit-clear">
        <button class="save-changes" @click="onSubmit">Save Changes</button>
        <button class="clear-form" @click="clearForm">
          <span><ClearIcon /> </span>
          <span>Clear Form</span>
        </button>
      </div>
    </div>
  </div>
</template>
<style scoped>
.email-error,
.name-error {
  color: red;
  font-size: 13px;
}
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
.account-info-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
form div input,
form div textarea {
  padding: 12px;
  /* background: #f4f4f4; */
  border: 1px solid #eaeaea;
  border-radius: 10px;
  outline: none;
}
textarea {
  resize: none;
}
.describe-issue {
  position: relative;
}
.describe-issue .absolute {
  position: absolute;
  bottom: 17px;
  right: 17px;
}
.absolute input {
  display: none;
}
.absolute label {
  padding: 8px;
  border-radius: 100%;
  border: 1px solid #eaeaea;
  width: fit-content;
  margin-left: auto;
  background: #f4f4f4;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
form div input:focus {
  border: 1px solid #1969fe;
}
.interested-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.interested-section > div {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.interested-section h4 {
  font-weight: 500;
  font-size: 15px;
  color: #2d2d2d;
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
.interest-list span {
  font-weight: 600;
  font-size: 15px;
  line-height: 22.5px;
  color: #5a5a5a;
}
.submit-clear {
  display: flex;
  gap: 10px;
}
.save-changes,
.clear-form {
  width: fit-content;
  background: #1969fe;
  border: 1px solid #bad2ff;
  padding: 16px 20px;
  color: #fff;
  font-weight: 600;
  border-radius: 64px;
  font-size: 19px;
  line-height: 120%;
  width: 174px;
  cursor: pointer;
}
.clear-form {
  background-color: transparent;
  border: 1px solid #ffbebd;
  color: #000;
  display: flex;
  align-items: center;
  gap: 5px;
}
@media screen and (max-width: 500px) {
  .save-changes,
  .clear-form {
    padding: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
