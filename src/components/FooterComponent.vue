<script setup>
// import { ref } from 'vue'
import {
  PhClipboard,
  PhFacebookLogo,
  PhInstagramLogo,
  PhLinkedinLogo,
  PhXLogo,
} from '@phosphor-icons/vue'

import { ref } from 'vue'

const email = 'hello@univent.com'

const copied = ref(false)

async function copyEmail() {
  try {
    await navigator.clipboard.writeText(email)
    copied.value = true

    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error(err)
  }
}
</script>

<template>
  <footer class="univent-footer">
    <div class="footer-container">
      <div class="footer-main">
        <div class="footer-cta">
          <img loading="lazy" src="/whiteLogo.png" alt="" width="" height="32" />
          <h2 class="cta-heading">
            Let’s Make Your <br />
            <span>Event Happen.</span>
          </h2>

          <RouterLink to="/add-event" class="primary-footer-btn">
            Post an event now <span class="arrow">→</span>
          </RouterLink>

          <div class="email-copy-wrapper">
            <span class="label">OR EMAIL US AT</span>
            <div class="email-badge">
              <span>{{ copied ? 'Copied!' : 'team.univent@gmail.com' }}</span>
              <button class="copy-icon" @click="copyEmail" aria-label="Copy email to clipboard">
                <PhClipboard :size="20" color="#ffffff" />
              </button>
            </div>
          </div>
        </div>

        <div class="footer-links-grid">
          <div class="link-group">
            <span class="label">QUICK LINKS</span>
            <ul>
              <li><RouterLink to="/">Home</RouterLink></li>
              <li><RouterLink to="/discover">Discover</RouterLink></li>
              <li><RouterLink to="/interested">My Saved Events</RouterLink></li>
              <li><RouterLink to="/event-request">Event Request</RouterLink></li>
            </ul>
          </div>

          <div class="link-group">
            <span class="label">INFORMATION</span>
            <ul>
              <li><a href="#">Terms of Service</a></li>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Guidelines</a></li>
            </ul>
          </div>
        </div>
      </div>

      <hr class="footer-divider" />

      <div class="footer-bottom">
        <p class="copyright">© 2026 UNIVENT. ALL RIGHTS RESERVED.</p>

        <div class="social-links">
          <a href="#" aria-label="Facebook"><PhFacebookLogo size="32" /></a>
          <a href="#" aria-label="Twitter"><PhXLogo size="32" /></a>
          <a href="#" aria-label="Instagram"><PhInstagramLogo size="32" /></a>
          <a href="#" aria-label="LinkedIn"><PhLinkedinLogo size="32" /></a>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.univent-footer {
  background-color: #05070a; /* Deep black/navy */
  background-color: #0a1226;
  color: #ffffff;
  padding: 80px 0 50px 0;
  font-family: Satoshi;
}

.footer-container {
  max-width: 90%;
  margin: 0 auto;
}

.footer-main {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 60px;
  margin-bottom: 60px;
}

.label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  color: #1969fe;
  margin-bottom: 20px;
}

.cta-heading {
  font-size: 48px;
  line-height: 1.1;
  font-weight: 700;
  margin-bottom: 30px;
}

.cta-heading span {
  font-family: serif;
  font-style: italic;
  font-weight: 400;
}

.primary-footer-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background-color: #eef2ff;
  color: #05070a;
  padding: 16px 28px;
  border-radius: 50px;
  text-decoration: none;
  font-weight: 600;
  transition: transform 0.2s ease;
  margin-bottom: 40px;
}

.primary-footer-btn:hover {
  transform: translateY(-3px);
}

.email-copy-wrapper .label {
  margin-bottom: 12px;
}

.email-badge {
  display: inline-flex;
  align-items: center;
  gap: 15px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px dashed rgba(255, 255, 255, 0.2);
  padding: 12px 20px;
  border-radius: 50px;
  color: #d5d5d5;
}

.copy-icon {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  opacity: 0.7;
}

/* Links Styling */
.footer-links-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
}

.link-group ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.link-group li {
  margin-bottom: 12px;
}

.link-group a {
  color: #aaaaaa;
  text-decoration: none;
  transition: color 0.2s;
  font-size: 15px;
}

.link-group a:hover {
  color: #ffffff;
}

.footer-divider {
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 30px;
}

.footer-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.copyright {
  font-size: 12px;
  color: #5a5a5a;
}

.social-links {
  display: flex;
  gap: 20px;
}

.social-links a {
  color: #fff;
  text-decoration: none;
  opacity: 0.8;
  font-size: 18px;
}

/* Responsive Design */
@media screen and (max-width: 900px) {
  .footer-main {
    grid-template-columns: 1fr;
    gap: 40px;
  }

  .cta-heading {
    font-size: 32px;
  }
}

@media screen and (max-width: 500px) {
  .footer-links-grid {
    grid-template-columns: 1fr;
    gap: 40px;
  }

  .footer-bottom {
    flex-direction: column-reverse;
    gap: 20px;
    align-items: flex-start;
  }
}
</style>
