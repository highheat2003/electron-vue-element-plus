<script setup lang="ts">
import ComponentExampleCard from '../../components/ComponentExampleCard.vue'
import AppInfoCard from '../../components/AppInfoCard.vue'
</script>

<template>
  <section class="intro">
    <p class="eyebrow">YOUR NEXT DESKTOP APP</p>
    <h1>데스크톱 앱 개발을 시작하세요.</h1>
    <p>Vue 3, Element Plus, TypeScript와 함께하는 Electron 프로젝트입니다.</p>
  </section>
  <el-row :gutter="24">
    <el-col :xs="24" :md="14"><ComponentExampleCard /></el-col>
    <el-col :xs="24" :md="10"><AppInfoCard /></el-col>
  </el-row>
</template>
