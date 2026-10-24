<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const name = ref('')

function greet(): void {
  ElMessage.success(`${name.value.trim() || '개발자'}님, 환영합니다!`)
}
</script>

<template>
  <el-card shadow="never" class="panel">
    <template #header><strong>Element Plus 컴포넌트 예제</strong></template>
    <el-form label-position="top" @submit.prevent="greet">
      <el-form-item label="이름">
        <el-input v-model="name" placeholder="이름을 입력하세요" clearable maxlength="50" />
      </el-form-item>
      <el-button type="primary" native-type="submit">환영 메시지 보기</el-button>
    </el-form>
    <el-divider />
    <el-space wrap>
      <el-tag>Vue 3</el-tag><el-tag type="success">Element Plus</el-tag>
      <el-tag type="warning">TypeScript</el-tag><el-tag type="info">electron-vite</el-tag>
    </el-space>
  </el-card>
</template>
