<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import type { AppInfo } from '../../../shared/api'

const appInfo = ref<AppInfo>()
const loading = ref(false)

async function loadAppInfo(): Promise<void> {
  loading.value = true
  try {
    appInfo.value = await window.api.getAppInfo()
  } catch {
    ElMessage.error('앱 정보를 가져오지 못했습니다. Electron에서 실행해 주세요.')
  } finally {
    loading.value = false
  }
}

onMounted(loadAppInfo)
</script>

<template>
  <el-card v-loading="loading" shadow="never" class="panel">
    <template #header>
      <div class="card-header">
        <strong>Electron 연결 정보</strong>
        <el-button :icon="Refresh" text circle aria-label="앱 정보 새로고침" @click="loadAppInfo" />
      </div>
    </template>
    <el-descriptions :column="1" border>
      <el-descriptions-item label="앱 버전">{{ appInfo?.version ?? '—' }}</el-descriptions-item>
      <el-descriptions-item label="운영체제">{{ appInfo?.platform ?? '—' }}</el-descriptions-item>
      <el-descriptions-item label="Electron">{{ appInfo?.electron ?? '—' }}</el-descriptions-item>
      <el-descriptions-item label="Chromium">{{ appInfo?.chrome ?? '—' }}</el-descriptions-item>
      <el-descriptions-item label="Node.js">{{ appInfo?.node ?? '—' }}</el-descriptions-item>
    </el-descriptions>
    <p class="hint">타입이 지정된 preload API로 메인 프로세스의 정보를 가져옵니다.</p>
  </el-card>
</template>
