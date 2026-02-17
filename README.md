# UniVent – University Event Discovery Platform

![UniVent](https://img.shields.io/badge/UniVent-v1.0-blue) ![Vue.js](https://img.shields.io/badge/Frontend-Vue3-brightgreen) ![Supabase](https://img.shields.io/badge/Backend-Supabase-blueviolet)

**Tagline:** Discover, Share, and Experience University Events Effortlessly

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [Usage](#usage)
- [User Stories](#user-stories)
- [Problems Solved](#problems-solved)
- [Future Enhancements](#future-enhancements)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

UniVent is a modern web and mobile-friendly platform designed for **university students to discover, explore, and participate in campus events**. It connects students, organizers, and university communities in one interactive space, ensuring no one misses important seminars, workshops, sports events, or entertainment activities.

---

## Features

- **Event Discovery:** Browse events by date, category, or location with a powerful search.
- **Event Categories:** Academic, Cultural, Social, Sports, Workshops, Entertainment.
- **Personalized Dashboard:** Save favorite events, set reminders, track participation, see trending events.
- **Event Creation & Management:** Organizers can create, edit, and manage events with detailed info.
- **Notifications & Alerts:** Receive push notifications or emails for upcoming events or updates.
- **Interactive Engagement:** RSVP, comment, and share events.
- **Secure Authentication:** University email verification; optional OAuth login (Google/Facebook).
- **Admin & Analytics:** Monitor events, approve submissions, and track attendance.
- **Mobile-Friendly Design:** Responsive UI with Vue 3 and Tailwind CSS.
- **Environment Security:** API keys and sensitive info stored in `.env` files, not in GitHub.

---

## Technology Stack

| Layer                   | Technology / Tool                                  |
|-------------------------|---------------------------------------------------|
| Frontend                | Vue 3 (Composition API), Tailwind CSS, Pinia      |
| Backend / Database      | Supabase (PostgreSQL), REST APIs                  |
| Authentication          | Supabase Auth / OAuth                             |
| Hosting / Deployment    | Vercel / Netlify / GitHub Pages                   |
| Version Control         | Git & GitHub                                     |
| Notifications           | Supabase Functions / Node.js / Web Push           |
| Security                | Environment variables, GitHub push protection    |

---

## Installation

1. **Clone the repository**

```bash
git clone https://github.com/M0hamm0d/UniVent-Event-App.git
cd UniVent-Event-App
