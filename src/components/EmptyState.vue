<template>
  <div class="empty-state-wrapper">
    <div class="empty-state-card">
      <div class="empty-state-content">
        <svg
          class="empty-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#666"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
        </svg>

        <h2 class="empty-heading">No saved events, yet.</h2>

        <p class="empty-text">
          Click the I am interested button on any event card to save it to your interested list for
          quick access.
        </p>
        <RouterLink to="/discover">Discover Events Now →</RouterLink>
      </div>
    </div>
  </div>
</template>
<style scoped>
.empty-state-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  font-family: Satoshi;
  /* padding: 40px; */
}

.empty-state-card {
  background-color: #f9f9f9;
  border-radius: 24px;
  width: 100%;
  max-width: 600px;
  padding: 60px;
  text-align: center;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
}

.empty-state-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 20px;
}

.empty-heading {
  color: #333;
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.empty-text {
  color: #666;
  font-size: 16px;
  line-height: 1.6;
  max-width: 400px;
  margin: 0;
}

a {
  margin-top: 30px;
  display: inline-block;
  background-color: #007bff;
  color: white;
  text-decoration: none;
  font-weight: 600;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 14px;
  transition: background 0.2s ease;
}

.cta-button:hover {
  background-color: #0056b3;
}
</style>
