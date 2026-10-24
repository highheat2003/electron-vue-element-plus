<script setup lang="ts">
import { onActivated, ref } from 'vue'
import { Refresh, Promotion } from '@element-plus/icons-vue'
import type { BackendHelloResponse, BackendStatus } from '../../../../../shared/api'

const name = ref('개발자')
const status = ref<BackendStatus>()
const response = ref<BackendHelloResponse>()
const checking = ref(false)
const loading = ref(false)
const error = ref('')

async function checkConnection(): Promise<void> {
  if (checking.value) return
  checking.value = true
  try {
    status.value = await window.api.getBackendStatus()
  } catch {
    status.value = { connected: false, message: 'Electron 앱에서 백엔드 연결을 확인해 주세요.' }
  } finally {
    checking.value = false
  }
}

async function hello(): Promise<void> {
  if (loading.value || !name.value.trim()) return
  loading.value = true
  error.value = ''
  response.value = undefined
  try {
    response.value = await window.api.getBackendHello(name.value)
    status.value = {
      connected: true,
      message: 'Python 백엔드에 연결되었습니다.',
      pythonVersion: response.value.pythonVersion
    }
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
        : 'Python API 호출에 실패했습니다.'
    await checkConnection()
  } finally {
    loading.value = false
  }
}

onActivated(checkConnection)
</script>

<template>
  <section class="backend-page">
    <el-space direction="vertical" alignment="stretch" fill :size="24" class="backend-layout">
      <div>
        <p class="eyebrow">PYTHON BACKEND</p>
        <h1>hello</h1>
        <el-text type="info">이름을 전달하면 Python 백엔드가 인사 메시지를 반환합니다.</el-text>
      </div>
      <el-card shadow="never" class="backend-card">
        <template #header>
          <el-space wrap :size="16">
            <strong>백엔드 연결</strong>
            <el-tag :type="status?.connected ? 'success' : 'info'">{{
              checking ? '확인 중' : status?.connected ? '연결됨' : '연결 필요'
            }}</el-tag>
            <el-button
              :icon="Refresh"
              :loading="checking"
              :disabled="loading"
              text
              @click="checkConnection"
              >연결 확인</el-button
            >
          </el-space>
        </template>
        <el-alert
          v-if="status && !status.connected"
          :title="status.message"
          type="warning"
          show-icon
          :closable="false"
        />
        <el-text v-else type="info">{{
          status?.connected
            ? `Python ${status.pythonVersion} · FastAPI`
            : '백엔드 시작 상태를 확인하고 있습니다.'
        }}</el-text>
      </el-card>
      <el-card shadow="never" class="backend-card">
        <template #header><strong>인사 메시지 요청</strong></template>
        <el-form label-position="top" @submit.prevent="hello">
          <el-form-item label="이름">
            <el-input
              v-model="name"
              placeholder="이름을 입력하세요"
              maxlength="50"
              show-word-limit
              clearable
              aria-label="인사할 이름"
            />
          </el-form-item>
          <el-button
            type="primary"
            :icon="Promotion"
            :loading="loading"
            :disabled="!name.trim()"
            native-type="submit"
            >API 호출</el-button
          >
        </el-form>
      </el-card>
      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
      <el-card v-if="response" shadow="never" class="backend-card">
        <template #header><strong>Python 응답</strong></template>
        <el-space direction="vertical" alignment="stretch" fill :size="20" class="backend-layout">
          <el-alert :title="response.message" type="success" show-icon :closable="false" />
          <el-descriptions :column="1" border>
            <el-descriptions-item label="이름">{{ response.name }}</el-descriptions-item>
            <el-descriptions-item label="Python 버전">{{
              response.pythonVersion
            }}</el-descriptions-item>
            <el-descriptions-item label="응답 시각 (KST)">{{
              new Date(response.timestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
            }}</el-descriptions-item>
          </el-descriptions>
        </el-space>
      </el-card>
    </el-space>
  </section>
</template>

<style scoped>
.backend-page {
  max-width: 1000px;
  margin: 0 auto;
}
.backend-layout {
  width: 100%;
}
.backend-card {
  border-radius: 12px;
}
</style>
