<script setup lang="ts">
import { computed, onActivated, ref, watch } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import type { ExchangeRateHistoryRow } from '../../../../../shared/api'

const history = ref<ExchangeRateHistoryRow[]>([])
const loading = ref(false)
const error = ref('')
const page = ref(1)
const pageSize = ref(20)
const number = new Intl.NumberFormat('ko-KR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6
})
const rows = computed(() =>
  history.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
)
watch(pageSize, () => {
  page.value = 1
})

async function load(): Promise<void> {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    history.value = await window.api.getExchangeRateHistory()
    page.value = 1
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
        : '환율이력을 조회하지 못했습니다.'
  } finally {
    loading.value = false
  }
}

function rowKey(row: ExchangeRateHistoryRow): string {
  return `${row.exchangeType}:${row.rateDate}`
}

onActivated(load)
</script>

<template>
  <section class="history-page">
    <el-space direction="vertical" alignment="stretch" fill :size="24" class="history-layout">
      <el-space wrap class="history-heading" :size="16">
        <div>
          <p class="eyebrow">EXCHANGE RATE HISTORY</p>
          <h1>환율이력</h1>
          <el-text type="info">저장된 환율을 최근 날짜순으로 조회합니다.</el-text>
        </div>
        <el-button :icon="Refresh" :loading="loading" @click="load">조회</el-button>
      </el-space>
      <el-alert
        v-if="error"
        :title="error"
        :description="history.length ? '이전에 조회한 데이터를 표시합니다.' : undefined"
        type="error"
        show-icon
        :closable="false"
      />
      <el-card v-loading="loading" shadow="never" class="history-card" :aria-busy="loading">
        <template #header>
          <el-space wrap :size="12">
            <strong>환율 저장 이력</strong>
            <el-tag type="info" effect="plain">총 {{ history.length }}건</el-tag>
            <el-text type="info" size="small">날짜 내림차순</el-text>
          </el-space>
        </template>
        <el-table
          :data="rows"
          :row-key="rowKey"
          stripe
          border
          aria-label="환율이력 목록"
          empty-text="저장된 환율이 없습니다. 환율1 또는 환율2에서 환율을 먼저 조회하세요."
        >
          <el-table-column prop="exchangeType" label="환율구분" min-width="140" />
          <el-table-column prop="rateDate" label="날짜 (공시일)" min-width="150" />
          <el-table-column label="환율" min-width="160" align="right">
            <template #default="{ row }">{{ number.format(row.exchangeRate) }}</template>
          </el-table-column>
        </el-table>
        <div class="history-pagination">
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50]"
            :total="history.length"
            layout="total, sizes, prev, pager, next"
            background
          />
        </div>
      </el-card>
      <el-text type="info" size="small"
        >환율1·환율2에서 조회한 최신 공시 환율이 저장됩니다. USD/KRW는 1 USD당 KRW를
        의미합니다.</el-text
      >
    </el-space>
  </section>
</template>

<style scoped>
.history-page {
  max-width: 1100px;
  margin: 0 auto;
}
.history-layout {
  width: 100%;
}
.history-heading {
  justify-content: space-between;
}
.history-card {
  border-radius: 12px;
}
.history-pagination {
  margin-top: 20px;
  overflow-x: auto;
  padding-bottom: 4px;
}
</style>
