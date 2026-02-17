<template>
  <div class="scroll-hint-icon">↓</div>
</template>
<style>
.scroll-hint-icon {
  position: absolute;
  left: 50%;
  bottom: 50px;
  background-color: #fff;
  padding: 10px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  animation: scrollHint 1.5s infinite;
}
@keyframes scrollHint {
  0%,
  100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-5px);
  }
}
</style>
