<script setup lang="ts">
import { computed, defineAsyncComponent, onActivated, ref } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import ExchangeRateChart from './ExchangeRateChart.vue'
import type { ExchangeRates } from '../../../shared/api'

defineProps<{ title: string; chartType: 'svg' | 'echarts' }>()
const EChartsExchangeRateChart = defineAsyncComponent(
  () => import('./EChartsExchangeRateChart.vue')
)

const data = ref<ExchangeRates>()
const loading = ref(false)
const error = ref('')
const period = ref(30)
const periods = [
  { label: '1개월', value: 30 },
  { label: '3개월', value: 90 },
  { label: '6개월', value: 180 },
  { label: '1년', value: 365 }
]
const number = new Intl.NumberFormat('ko-KR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})
const latest = computed(() => data.value?.points.at(-1))
const previous = computed(() => data.value?.points.at(-2))
const change = computed(() =>
  latest.value && previous.value ? latest.value.rate - previous.value.rate : 0
)
const percent = computed(() => (previous.value ? (change.value / previous.value.rate) * 100 : 0))
const points = computed(() => {
  if (!data.value || !latest.value) return []
  const cutoff = Date.parse(latest.value.date) - period.value * 86_400_000
  return data.value.points.filter((point) => Date.parse(point.date) >= cutoff)
})
const statistics = computed(() => {
  const rates = points.value.map((point) => point.rate)
  return {
    low: Math.min(...rates),
    high: Math.max(...rates),
    average: rates.reduce((sum, value) => sum + value, 0) / rates.length
  }
})

async function load(): Promise<void> {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    data.value = await window.api.getExchangeRates()
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
        : '환율을 가져오지 못했습니다.'
  } finally {
    loading.value = false
  }
}

async function openSource(): Promise<void> {
  try {
    await window.api.openExternalLink('https://frankfurter.dev/')
  } catch {
    error.value = '데이터 출처 페이지를 열지 못했습니다.'
  }
}

onActivated(load)
</script>

<template>
  <section class="exchange-page">
    <div class="exchange-heading">
      <div>
        <p class="eyebrow">EXCHANGE RATE</p>
        <h1>{{ title }}</h1>
        <p class="hint">미국 달러 대비 원화 · 1 USD 기준</p>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="load">새로고침</el-button>
    </div>
    <el-alert
      v-if="error"
      :title="error"
      :description="data ? '아래에는 이전에 조회한 데이터가 표시됩니다.' : undefined"
      type="error"
      show-icon
      :closable="false"
      class="rate-error"
    />
    <div v-loading="loading" class="exchange-content" :aria-busy="loading">
      <template v-if="data && latest">
        <el-card shadow="never" class="panel latest-card">
          <div class="latest-heading">
            <span>최신 공시 환율</span><el-tag effect="plain">USD → KRW</el-tag>
          </div>
          <div class="latest-rate">
            <span class="base-unit">1 USD = </span>{{ number.format(latest.rate) }}<small>원</small>
          </div>
          <p class="rate-change" :class="{ up: change > 0, down: change < 0 }">
            {{ change > 0 ? '▲' : change < 0 ? '▼' : '—' }} {{ number.format(Math.abs(change)) }}원
            ({{ percent > 0 ? '+' : '' }}{{ percent.toFixed(2) }}%)
            <span>직전 공시일 대비 · {{ previous?.date }}</span>
          </p>
          <p class="hint">
            기준일 {{ latest.date }} · 1 KRW = {{ (1 / latest.rate).toFixed(6) }} USD
          </p>
        </el-card>
        <el-card shadow="never" class="panel">
          <template #header>
            <div class="chart-heading">
              <strong>환율 추이</strong>
              <el-radio-group v-model="period" size="small" aria-label="조회 기간">
                <el-radio-button
                  v-for="option in periods"
                  :key="option.value"
                  :value="option.value"
                  >{{ option.label }}</el-radio-button
                >
              </el-radio-group>
            </div>
          </template>
          <div class="range-summary">
            <span>{{ points[0]?.date }} ~ {{ points.at(-1)?.date }}</span>
            <span>{{ points.length }}개 공시 데이터</span>
          </div>
          <template v-if="points.length">
            <EChartsExchangeRateChart v-if="chartType === 'echarts'" :points="points" />
            <ExchangeRateChart v-else :points="points" />
          </template>
          <el-empty v-else description="선택한 기간의 환율 데이터가 없습니다." />
          <div v-if="points.length" class="rate-statistics">
            <div>
              <span>기간 최저</span><strong>{{ number.format(statistics.low) }}원</strong>
            </div>
            <div>
              <span>기간 최고</span><strong>{{ number.format(statistics.high) }}원</strong>
            </div>
            <div>
              <span>기간 평균</span><strong>{{ number.format(statistics.average) }}원</strong>
            </div>
          </div>
        </el-card>
        <div class="source-note">
          <p>
            출처: <el-link type="primary" @click="openSource">Frankfurter · ECB</el-link> · 일별
            기준환율
          </p>
          <p>
            실시간 매매 시세가 아닙니다. 주말·휴일에는 최근 공시일의 환율을 표시하며, 차트 기간은
            최신 공시일을 기준으로 합니다.
          </p>
          <p>
            조회 시각:
            {{ new Date(data.fetchedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) }} (KST)
          </p>
        </div>
      </template>
      <el-empty v-else-if="!loading" description="환율 데이터를 불러오지 못했습니다.">
        <el-button type="primary" @click="load">다시 시도</el-button>
      </el-empty>
    </div>
  </section>
</template>

<style scoped>
.exchange-page {
  max-width: 1100px;
  margin: 0 auto;
}
.exchange-heading,
.chart-heading,
.latest-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.exchange-heading {
  margin-bottom: 24px;
}
.exchange-heading .hint {
  margin-top: 0;
}
.exchange-content {
  min-height: 300px;
}
.rate-error {
  margin-bottom: 20px;
}
.latest-card {
  border-top: 3px solid var(--el-color-primary);
}
.latest-heading {
  color: #66758a;
  font-size: 14px;
}
.latest-rate {
  margin: 20px 0 12px;
  font-size: clamp(30px, 4vw, 44px);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.latest-rate small {
  margin-left: 8px;
  font-size: 20px;
  font-weight: 400;
}
.base-unit {
  font-size: 16px;
  font-weight: 400;
  color: #66758a;
}
.rate-change {
  font-size: 14px;
  font-weight: 600;
}
.rate-change span {
  color: #66758a;
  font-size: 12px;
  font-weight: 400;
  margin-left: 8px;
}
.up {
  color: #d9363e;
}
.down {
  color: #3866df;
}
.range-summary {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  color: #66758a;
  font-size: 12px;
  margin-bottom: 16px;
}
.rate-statistics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e1e7ef;
}
.rate-statistics div {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rate-statistics span {
  font-size: 12px;
  color: #66758a;
}
.rate-statistics strong {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}
.source-note {
  color: #66758a;
  font-size: 12px;
  line-height: 1.7;
}
.source-note p {
  margin: 4px 0;
}
.source-note .el-link {
  font-size: 12px;
  vertical-align: baseline;
}
@media (max-width: 640px) {
  .rate-statistics {
    grid-template-columns: 1fr;
  }
  .rate-change span {
    display: block;
    margin: 8px 0 0;
  }
}
</style>
