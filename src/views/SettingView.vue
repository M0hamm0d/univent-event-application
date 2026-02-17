<script setup>
import AccountComponent from '@/components/AccountComponent.vue'
// import EventSearchHeader from '@/components/EventSearchHeader.vue'
import ProfileIcon from '@/components/icons/ProfileIcon.vue'
import FaqIcon from '@/components/icons/FaqIcon.vue'
import FaqComponent from '@/components/FaqComponent.vue'
import SupportComponent from '@/components/SupportComponent.vue'
// const tabs = { account: AccountComponent, faq: FaqComponent }
const tabs = { account: AccountComponent, faq: FaqComponent, support: SupportComponent }
import { ref } from 'vue'
import SupportSetting from '@/components/icons/SupportSetting.vue'
// import PasswordIcon from '@/components/icons/PasswordIcon.vue'
// import LogoutIcon from '@/components/icons/LogoutIcon.vue'
const active = ref('account')
</script>
<template>
  <div>
    <!-- <EventSearchHeader
      header="Settings & Support"
      title="Customize your UniVent experience, manage your preferences, or get help when you need it. We're here to make campus life easier!"
    /> -->
    <div class="content">
      <div class="side-nav">
        <div class="nav-container" @click="active = 'account'">
          <div :class="['nav', { activeNav: active == 'account' }]">
            <span><ProfileIcon :fill="active === 'account' ? '#000' : '#aaa'" /> </span>
            <span>Account</span>
          </div>
          <div :class="['side-border', { active: active == 'account' }]"></div>
        </div>
        <div class="nav-container" @click="active = 'faq'">
          <div :class="['nav', { activeNav: active == 'faq' }]">
            <span><FaqIcon :fill="active === 'faq' ? '#000' : '#aaa'" /> </span>
            <span>FAQ</span>
          </div>
          <div :class="['side-border', { active: active == 'faq' }]"></div>
        </div>
        <div class="nav-container" @click="active = 'support'">
          <div :class="['nav', { activeNav: active == 'support' }]">
            <span><SupportSetting :fill="active === 'support' ? '#000' : '#aaa'" /> </span>
            <span>Support</span>
          </div>
          <div :class="['side-border', { active: active == 'support' }]"></div>
        </div>
        <!-- <div class="nav-container" @click="active = 'password'">
          <div class="nav" :class="['nav', { activeNav: active == 'password' }]">
            <span><PasswordIcon :fill="active === 'password' ? '#000' : '#aaa'" /> </span>
            <span>Password</span>
          </div>
          <div :class="['side-border', { active: active == 'password' }]"></div>
        </div> -->
        <!-- <div class="nav-container" @click="active = 'logout'">
          <div class="nav" :class="['nav', { activeNav: active == 'logout' }]">
            <span><LogoutIcon :fill="active === 'logout' ? '#000' : '#aaa'" /> </span>
            <span>Logout</span>
          </div>
          <div :class="['side-border', { active: active == 'logout' }]"></div>
        </div> -->
      </div>
      <div class="tab-contents">
        <component :is="tabs[active]" />
      </div>
    </div>
  </div>
</template>
<style>
.content {
  width: 90%;
  margin: 50px auto;
  display: flex;
  gap: 60px;
}
.side-nav {
  border-left: 3px solid #aaa;
  display: flex;
  flex-direction: column;
  gap: 32px;
  height: 100%;
}
.nav-container {
  position: relative;
}
.nav {
  padding: 4px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  cursor: pointer;
  color: #aaa;
}
.nav span {
  font-size: 15px;
}
.active {
  position: absolute;
  height: 36px;
  width: 3px;
  top: 0px;
  left: -3px;
  background-color: black;
}
.activeNav {
  color: #000;
}
@media screen and (max-width: 500px) {
  .content {
    flex-direction: column;
    margin-bottom: 110px;
  }
  .side-nav {
    flex-direction: row;
    gap: 15px;
    overflow: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    border-left: 0px;
  }
  .side-nav::-webkit-scrollbar {
    display: none;
  }
  .active {
    left: 0;
  }
}
</style>
