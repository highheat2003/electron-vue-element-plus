<script setup lang="ts">
import { nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  createChart,
  isBusinessDay
} from 'lightweight-charts'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'
import type { StockCandle } from '../../../shared/api'

const props = defineProps<{ candles: StockCandle[]; symbol: string }>()
const container = ref<HTMLDivElement>()
const selected = ref<StockCandle>()
let chart: IChartApi | undefined
let series: ISeriesApi<'Candlestick'> | undefined
let volumeSeries: ISeriesApi<'Histogram'> | undefined
let candlesByDate = new Map<string, StockCandle>()

function update(): void {
  selected.value = props.candles.at(-1)
  candlesByDate = new Map(props.candles.map((candle) => [candle.time, candle]))
  series?.setData(props.candles)
  volumeSeries?.setData(
    props.candles.map((candle) => ({
      time: candle.time,
      value: candle.volume,
      color: candle.close >= candle.open ? '#e4545480' : '#3866df80'
    }))
  )
  chart?.timeScale().fitContent()
}

onMounted(() => {
  if (!container.value) return
  chart = createChart(container.value, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: '#ffffff' },
      textColor: '#66758a',
      panes: { separatorColor: '#e1e7ef', separatorHoverColor: '#cdd9ee' }
    },
    grid: { vertLines: { color: '#f0f3f8' }, horzLines: { color: '#f0f3f8' } },
    localization: { locale: 'ko-KR', dateFormat: 'yyyy-MM-dd' },
    rightPriceScale: { borderColor: '#e1e7ef' },
    timeScale: { borderColor: '#e1e7ef', timeVisible: false }
  })
  series = chart.addSeries(CandlestickSeries, {
    upColor: '#e45454',
    downColor: '#3866df',
    borderVisible: false,
    wickUpColor: '#e45454',
    wickDownColor: '#3866df',
    priceFormat: { type: 'price', precision: 2, minMove: 0.01 }
  })
  volumeSeries = chart.addSeries(
    HistogramSeries,
    {
      title: '거래량',
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
      base: 0
    },
    1
  )
  volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.15, bottom: 0 } })
  chart.panes()[0].setStretchFactor(3)
  chart.panes()[1].setStretchFactor(1)
  chart.subscribeCrosshairMove((event) => {
    const time = event.time
    const date =
      time === undefined
        ? ''
        : isBusinessDay(time)
          ? `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`
          : String(time)
    selected.value = candlesByDate.get(date) ?? props.candles.at(-1)
  })
  update()
})
watch(() => props.candles, update)
onActivated(async () => {
  await nextTick()
  if (container.value && container.value.clientWidth > 0)
    chart?.applyOptions({ width: container.value.clientWidth })
})
onBeforeUnmount(() => {
  chart?.remove()
  chart = undefined
  series = undefined
  volumeSeries = undefined
  candlesByDate.clear()
})

function price(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
</script>

<template>
  <div>
    <div v-if="selected" class="chart-legend" aria-live="off">
      <strong>{{ symbol }}</strong>
      <span>{{ selected.time }}</span>
      <span>시가 {{ price(selected.open) }}</span>
      <span>고가 {{ price(selected.high) }}</span>
      <span>저가 {{ price(selected.low) }}</span>
      <span>종가 {{ price(selected.close) }}</span>
      <span>거래량 {{ selected.volume.toLocaleString('ko-KR') }}주</span>
    </div>
    <div
      ref="container"
      class="stock-canvas"
      role="img"
      :aria-label="`${symbol} 주가 캔들 및 거래량 차트. 상단은 주가, 하단은 거래량이며 날짜축을 공유합니다. 위에 선택한 봉의 시가, 고가, 저가, 종가, 거래량이 표시됩니다.`"
    />
  </div>
</template>

<style scoped>
.stock-canvas {
  width: 100%;
  height: clamp(320px, 52vh, 680px);
}
.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  min-height: 44px;
  padding: 8px 0 14px;
  color: #66758a;
  font-size: 12px;
}
.chart-legend strong {
  color: #243247;
}
</style>
