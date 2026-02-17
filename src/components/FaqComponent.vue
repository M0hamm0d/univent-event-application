<script setup>
import { ref } from 'vue'

const FAQ = [
  {
    id: '1',
    question: 'How do I submit an event for posting?',
    answer:
      'Log in, go to "Submit: Event", fill out the form with details like date, venue, and description. Our admins will review and post if approved—usually within 48 hours!',
    isOpen: false,
  },
  {
    id: '2',
    question: 'What if I forget my password?',
    answer:
      'Click "Forgot Password" on the login page. We will send a reset link to your registered email.',
    isOpen: false,
  },
  {
    id: '3',
    question: 'How are events categorized?',
    answer:
      'Events are tagged as Academic, Social, Sports, Cultural, etc. Use filters on the Discover page to find what suits you.',
    isOpen: false,
  },
  {
    id: '4',
    question: 'Is UniVent free',
    answer: "Yes! It's a university-supported platform for all students—no fees required.",
    isOpen: false,
  },
  {
    id: '5',
    question: 'How do I report an issue with an event?',
    answer: 'From the event details, click "Report" or contact support via the form below.',
    isOpen: false,
  },
]
const data = ref(FAQ)
function toggleData(id) {
  data.value = data.value.map((faq) => ({
    ...faq,
    isOpen: faq.id == id ? !faq.isOpen : false,
  }))
}
</script>
<template>
  <div class="faq-wrapper">
    <div class="faq-header">
      <h3>Frequently Asked Questions</h3>
      <p>Update your profile to get better event recommendations tailored to your interests.</p>
    </div>
    <div class="faq-body">
      <div class="faq" v-for="faq in data" :key="faq.id">
        <div class="question" @click="toggleData(faq.id)">{{ faq.question }}</div>
        <div :class="['answer', { isOpen: faq.isOpen }]">{{ faq.answer }}</div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.faq-wrapper {
  display: flex;
  flex-direction: column;
  gap: 48px;
  padding: 12px;
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
.faq-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.faq-header p {
  color: #959595;
}
.faq-body {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.faq {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid #2d2d2d;
  border-radius: 10px;
  max-width: 600px;
  width: 100%;
}
.faq .question {
  color: #2d2d2d;
  font-weight: 600;
  font-size: 15px;
  line-height: 22.5px;
  cursor: pointer;
}
.answer {
  display: none;
  color: #959595;
  line-height: 22.5px;
}
.isOpen {
  display: flex;
}
@media screen and (max-width: 500px) {
  .faq {
    width: auto;
  }
}
</style>
