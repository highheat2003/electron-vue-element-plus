<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search } from '@element-plus/icons-vue'
import StockCandlestickChart from '../../../components/StockCandlestickChart.vue'
import type { StockHistory, StockInterval, StockYears } from '../../../../../shared/api'

const symbol = ref('')
const interval = ref<StockInterval>('1d')
const years = ref<StockYears>(3)
const loading = ref(false)
const error = ref('')
const result = ref<StockHistory>()
const intervalLabels = { '1d': '일', '1wk': '주', '1mo': '월' }
const latest = computed(() => result.value?.candles.at(-1))

async function search(): Promise<void> {
  if (loading.value) return
  const ticker = symbol.value.trim().toUpperCase()
  if (!ticker) {
    error.value = '종목코드를 입력하세요.'
    return
  }
  if (!/^[A-Z][A-Z0-9-]{0,19}$/.test(ticker)) {
    error.value = '올바른 미국 주식 ticker를 입력하세요. 예: AAPL, MSFT, BRK-B'
    return
  }
  symbol.value = ticker
  loading.value = true
  error.value = ''
  result.value = undefined
  try {
    result.value = await window.api.getStockHistory(ticker, interval.value || '1d', years.value)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '주가를 조회하지 못했습니다.'
  } finally {
    loading.value = false
  }
}

function changeQuery(): void {
  if (result.value) void search()
}

async function openTradingView(): Promise<void> {
  try {
    await window.api.openExternalLink('https://www.tradingview.com/')
  } catch {
    error.value = 'TradingView 링크를 열지 못했습니다.'
  }
}
</script>

<template>
  <section class="stock-page" aria-labelledby="stock-title">
    <div class="intro">
      <span class="eyebrow">STOCK CHART</span>
      <h1 id="stock-title">주식차트</h1>
      <p>미국 주식의 최근 {{ years }}년 주가를 일·주·월 단위로 조회합니다.</p>
    </div>

    <el-card class="panel" shadow="never">
      <div class="stock-toolbar">
        <el-form class="stock-search" :inline="true" @submit.prevent="search">
          <el-form-item label="종목코드" label-for="stock-symbol">
            <el-input
              id="stock-symbol"
              v-model="symbol"
              placeholder="예: AAPL"
              :maxlength="20"
              clearable
              :disabled="loading"
              autocomplete="off"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :icon="Search" native-type="submit" :loading="loading"
              >종목검색</el-button
            >
          </el-form-item>
        </el-form>
        <div class="stock-options">
          <div class="stock-period">
            <label for="stock-years">기간</label>
            <el-select
              id="stock-years"
              v-model="years"
              aria-label="조회 기간"
              :disabled="loading"
              @change="changeQuery"
            >
              <el-option
                v-for="value in [3, 5, 10]"
                :key="value"
                :label="`${value}년`"
                :value="value"
              />
            </el-select>
          </div>
          <el-radio-group
            v-model="interval"
            aria-label="주가 조회 주기"
            :disabled="loading"
            @change="changeQuery"
          >
            <el-radio-button value="1d">일</el-radio-button>
            <el-radio-button value="1wk">주</el-radio-button>
            <el-radio-button value="1mo">월</el-radio-button>
          </el-radio-group>
        </div>
      </div>
      <el-alert
        v-if="error"
        :title="error"
        type="error"
        show-icon
        :closable="false"
        class="stock-error"
      />
      <div
        v-loading="loading"
        class="chart-area"
        :element-loading-text="`최근 ${years}년 주가를 조회하고 있습니다…`"
        :aria-busy="loading"
      >
        <template v-if="result">
          <div class="result-heading">
            <strong
              >{{ result.symbol }}
              <span v-if="latest">{{
                latest.close.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })
              }}</span></strong
            >
            <el-tag
              >{{ result.years }}년 · {{ intervalLabels[result.interval] }}봉 ·
              {{ result.candles.length }}개</el-tag
            >
          </div>
          <StockCandlestickChart :candles="result.candles" :symbol="result.symbol" />
          <p class="hint">
            조회 기간 {{ result.start }} ~ {{ result.end }} · 마지막 봉 {{ latest?.time }}
          </p>
        </template>
        <el-empty
          v-else
          :description="
            loading ? '주가를 불러오는 중입니다.' : '종목코드를 입력하고 종목검색을 눌러 주세요.'
          "
          :image-size="90"
        />
      </div>
      <div class="chart-notes">
        <span>Yahoo Finance · yfinance / 수정주가 · 최근 봉은 거래 중 변경될 수 있습니다.</span>
        <span
          >TradingView Lightweight Charts™ · Copyright (с) 2025 TradingView, Inc.
          <el-link type="primary" @click="openTradingView">TradingView</el-link>
        </span>
      </div>
    </el-card>
  </section>
</template>

<style scoped>
.stock-page {
  min-width: 0;
}
.stock-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding-bottom: 24px;
}
.stock-search {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.stock-search :deep(.el-form-item) {
  margin: 0;
}
.stock-search :deep(.el-input) {
  width: 160px;
}
.stock-options {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px 24px;
}
.stock-period {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--el-text-color-regular);
  font-size: 14px;
}
.stock-period :deep(.el-select) {
  width: 120px;
}
.chart-area {
  min-height: clamp(320px, 52vh, 680px);
}
.chart-area > .el-empty {
  min-height: inherit;
}
.stock-error {
  margin-bottom: 20px;
}
.result-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 4px 0 12px;
}
.result-heading strong {
  font-size: 22px;
}
.result-heading strong span {
  font-size: 18px;
  margin-left: 12px;
}
.chart-notes {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 16px;
  padding-top: 20px;
  margin-top: 20px;
  border-top: 1px solid #e1e7ef;
  color: #66758a;
  font-size: 11px;
  line-height: 1.7;
}
.chart-notes :deep(.el-link) {
  font-size: inherit;
}
@media (max-width: 720px) {
  .stock-toolbar {
    align-items: flex-start;
  }
  .stock-search {
    width: 100%;
  }
  .stock-search :deep(.el-form-item:first-child) {
    width: 100%;
  }
  .stock-search :deep(.el-form-item__content) {
    min-width: 0;
  }
  .stock-search :deep(.el-input) {
    width: 100%;
  }
}
</style>
