<script setup>
import { ref } from 'vue'

import { PhEnvelope } from '@phosphor-icons/vue'

const FAQ = [
  {
    id: '1',
    question: 'Why should I use UniVent instead of WhatsApp or flyers?',
    answer:
      'UniVent centralizes all university events in one place, making it easier to discover, manage, and track engagement without missing important updates.',
  },
  {
    id: '2',
    question: 'Can I edit or delete an event after publishing it?',
    answer:
      'Yes. You can manage your events from your dashboard. You’ll be able to edit event details or delete the event at any time.',
    isOpen: false,
  },
  {
    id: '3',
    question: 'How do I find events that match my interests?',
    answer:
      'Use the Discover page to browse events and apply filters based on categories like Tech, Social, Academic, and more.',
    isOpen: false,
  },
  {
    id: '4',
    question: 'How can I create and publish an event on UniVent?',
    answer:
      'Simply log in to your account, navigate to the "Create Event" page, and fill in the required details. Once submitted, your event will be reviewed and published shortly.',
    isOpen: false,
  },
  {
    id: '5',
    question: 'Will I receive updates about events I’m interested in?',
    answer:
      'Yes. UniVent keeps track of your interactions and can notify you about relevant or upcoming events so you never miss out.',
    isOpen: false,
  },
  {
    id: '6',
    question: 'Is UniVent free to use?',
    answer:
      'Absolutely. UniVent is completely free for students to discover, create, and manage events within their university.',
    isOpen: false,
  },
]

const data = ref(FAQ.map((item) => ({ ...item, isOpen: false })))

function toggleData(id) {
  data.value.forEach((faq) => {
    if (faq.id === id) {
      faq.isOpen = !faq.isOpen
    } else {
      faq.isOpen = false
    }
  })
}
</script>

<template>
  <section class="faq-section">
    <header class="faq-header">
      <span class="badge">FAQ</span>
      <h1>Frequently Asked <span>Questions</span></h1>
    </header>

    <div class="faq-container">
      <div class="faq-content">
        <div class="contact-card">
          <div class="contact-info">
            <label>Email</label>
            <p>support@univent.edu</p>
          </div>
          <button class="cta-button">
            <span class="icon"><PhEnvelope :size="22" color="#ffffff" /></span> Get in touch
          </button>
        </div>

        <div class="accordion-list">
          <div v-for="faq in data" :key="faq.id" class="faq-item" :class="{ active: faq.isOpen }">
            <div class="question-row" @click="toggleData(faq.id)">
              <span class="question-text">{{ faq.question }}</span>
              <span class="toggle-icon">{{ faq.isOpen ? '−' : '+' }}</span>
            </div>

            <div v-show="faq.isOpen" class="answer-text">
              {{ faq.answer }}
            </div>
          </div>
        </div>
      </div>

      <div class="faq-image-wrapper">
        <img
          src="https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&q=80&w=800"
          alt="University Event"
        />
        <div class="image-tag">@univent.campus</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Layout */
.faq-section {
  max-width: 90%;
  margin: 0 auto 100px;
  padding: 60px 0px;
  font-family: 'Satoshi', sans-serif;
}

.faq-header {
  text-align: center;
  margin-bottom: 60px;
}

.badge {
  background: #f1f1f1;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.faq-header h1 {
  font-size: 3rem;
  margin-top: 10px;
  color: #1a1a1a;
}

.faq-header h1 span {
  font-family: serif;
  font-style: italic;
  font-weight: 400;
}

.faq-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  align-items: start;
}

/* Contact Card */
.contact-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  padding: 20px;
  border-radius: 16px;
  margin-bottom: 24px;
}

.contact-info label {
  font-size: 12px;
  color: #888;
  display: block;
}

.contact-info p {
  font-weight: 600;
  margin: 0;
}

.cta-button {
  background: #1a1a1a;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
}

/* Accordion */
.accordion-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.faq-item {
  background: #f9f9f9;
  border-radius: 12px;
  padding: 18px 24px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.faq-item.active {
  background: #fff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

.question-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.question-text {
  font-weight: 500;
  color: #333;
}

.toggle-icon {
  width: 24px;
  height: 24px;
  background: #eee;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.answer-text {
  margin-top: 12px;
  color: #666;
  line-height: 1.6;
}

/* Image styling */
.faq-image-wrapper {
  position: relative;
  height: 100%;
}

.faq-image-wrapper img {
  width: 100%;
  height: auto;
  object-fit: cover;
  border-radius: 24px;
}

.image-tag {
  position: absolute;
  bottom: 20px;
  left: 20px;
  color: white;
  font-size: 14px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* Responsiveness */
@media (max-width: 900px) {
  .faq-container {
    grid-template-columns: 1fr;
  }
  .faq-section {
    margin: 0 auto 50px;
  }
  .faq-image-wrapper {
    order: -1; /* Image on top for mobile */
  }
}
</style>
