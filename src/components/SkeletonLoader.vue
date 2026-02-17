<template>
  <div class="skeleton-events-card">
    <div class="skeleton-event-flier">
      <img loading="lazy" />
    </div>
    <div class="skeleton-event-content">
      <div class="skeleton-categories">
        <div class="skeleton-category">
          <div class="skeleton-category-0"></div>
        </div>
        <div class="skeleton-price"></div>
      </div>
      <div class="skeleton-event-block">
        <h3></h3>
        <div class="skeleton-event-meta">
          <span></span>
          <span></span>
        </div>
      </div>
      <div class="interest-details-btn">
        <div class="share-and-delete">
          <button class="skeleton-btn"></button>
          <button class="skeleton-btn"></button>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.skeleton-events-card {
  width: 100%;
  height: 100%;
  border-radius: 24px;
  animation: pulse 1.5s ease-in-out infinite;
  background-color: #e5e7eb;
  display: flex;
  flex-direction: column;
  max-width: 422px;
}
.skeleton-event-flier {
  /* width: 100%; */
  margin: 16px;
  height: 250px;
  animation: textContent 1.5s ease-in-out infinite;
  background-color: #d1d5db;
}
.skeleton-event-flier img {
  width: 100%;
}
.skeleton-event-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.skeleton-categories {
  height: 25px;
  display: flex;
  justify-content: space-between;
  padding: 0 16px;
}
.skeleton-category-0 {
  max-width: 90px;
  width: 100%;
  height: 25px;
  border-radius: 20px;
  animation: textContent 1.5s ease-in-out infinite;
  background-color: #d1d5db;
}
.skeleton-price {
  max-width: 60px;
  width: 100%;
  height: 25px;
  animation: textContent 1.5s ease-in-out infinite;
  background-color: #d1d5db;
  border-radius: 5px;
}
.skeleton-event-block h3 {
  height: 28px;
  max-width: 200px;
  width: 100%;
  animation: textContent 1.5s ease-in-out infinite;
  background-color: #d1d5db;
  margin: 0 16px;
  border-radius: 16px;
}
.skeleton-event-meta {
  height: 28px;
  max-width: 250px;
  width: 100%;
  animation: textContent 1.5s ease-in-out infinite;
  background-color: #d1d5db;
  margin: 12px 16px;
  border-radius: 16px;
}
.share-and-delete {
  display: flex;
  margin: 0 16px 16px;
  gap: 10px;
}
.skeleton-btn {
  max-width: 190px;
  width: 100%;
  height: 46px;
  border: none;
  animation: textContent 1.5s ease-in-out infinite;
  background-color: #d1d5db;
  border-radius: 64px;
}
@keyframes pulse {
  0% {
    background-color: #e5e7eb;
  }
  50% {
    background-color: #f3f4f6; /* lighter gray */
  }
  100% {
    background-color: #e5e7eb;
  }
}
@keyframes textContent {
  0% {
    background-color: #d1d5db;
  }
  50% {
    background-color: #9ca3af; /* lighter gray */
  }
  100% {
    background-color: #d1d5db;
  }
}
</style>
