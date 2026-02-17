<script setup lang="ts">
// import RobotIcon from './icons/RobotIcon.vue'
</script>

<template>
  <div class="univent-assistance-body">
    <div class="text">
      <!-- <RobotIcon /> -->
      🤖
    </div>
    <div class="chat-box">
      <div class="input">
        <input type="text" placeholder="What is happening tonight in university?" />
      </div>
    </div>
  </div>
</template>
<style scoped>
.univent-assistance-body {
  position: relative;
}
.text {
  /* background-color: darkcyan; */
  background-color: #1969fe;
  padding: 10px;
  border-radius: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  width: fit-content;
  font-size: 30px;
}
.chat-box {
  position: absolute;
  top: -50px;
  right: 50px;
  /* background-color: #2563eb; */
  background-color: #fff;
  box-shadow: 0px 10px 15px 0px #0000000d;
  padding: 15px;
  width: 350px;
  border-radius: 10px;
}
.chat-box .input {
  width: 100%;
  border: 1px solid #1969fe;
  border-radius: 40px;
}
.chat-box input {
  border-radius: 40px;
  width: 100%;
  box-sizing: border-box;

  /* font-size: 16px; */
  border: none;
  outline: none;
  height: 32px;
  padding: 5px 10px;
}
</style>
