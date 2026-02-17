<script setup>
import { ref } from 'vue'

const model = defineModel()
defineProps({
  title: {
    type: String,
  },
})
const bindModel = ref(model)
</script>
<template>
  <div class="title">
    <input v-model="bindModel" type="text" placeholder="" />
    <p>{{ title }}</p>
  </div>
</template>
<style scoped>
.title {
  position: relative;
  display: flex;
}
.title input {
  width: 100%;
  outline: none;
  color: #8c8c8b;
  border: 1px solid #dfdfdf;
  height: 54px;
  padding: 0 17px;
  font-size: 16px;
  font-size: 16px;
}
.title p {
  margin: 0;
  position: absolute;
  top: 17px;
  left: 17px;
  font-size: 16px;
  transition: top 0.1s ease;
}
.title input:focus + p {
  top: -9px;
  background-color: #fff;
}
</style>
