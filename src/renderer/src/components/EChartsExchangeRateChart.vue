<script setup lang="ts">
import { nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { init, use } from 'echarts/core'
import type { EChartsType, ComposeOption } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import type { LineSeriesOption } from 'echarts/charts'
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  TooltipComponent
} from 'echarts/components'
import type {
  DataZoomComponentOption,
  GridComponentOption,
  TooltipComponentOption
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { ExchangeRatePoint } from '../../../shared/api'

use([LineChart, GridComponent, TooltipComponent, DataZoomComponent, AriaComponent, CanvasRenderer])

type ChartOption = ComposeOption<
  LineSeriesOption | DataZoomComponentOption | GridComponentOption | TooltipComponentOption
>
const props = defineProps<{ points: ExchangeRatePoint[] }>()
const container = ref<HTMLDivElement>()
let chart: EChartsType | undefined
let observer: ResizeObserver | undefined
let active = true
const number = new Intl.NumberFormat('ko-KR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

function update(): void {
  if (!chart || !active) return
  const option: ChartOption = {
    animation: false,
    useUTC: true,
    color: ['#3866df'],
    textStyle: { fontFamily: "'Segoe UI', 'Malgun Gothic', sans-serif" },
    aria: { enabled: true },
    grid: { left: 20, right: 24, top: 40, bottom: 80, containLabel: true },
    tooltip: {
      trigger: 'axis',
      renderMode: 'richText',
      confine: true,
      axisPointer: { type: 'cross' },
      valueFormatter: (value) =>
        typeof value === 'number' ? `${number.format(value)}원` : String(value)
    },
    xAxis: {
      type: 'time',
      boundaryGap: [0, 0],
      axisLabel: {
        formatter: (value: number) => new Date(value).toISOString().slice(5, 10).replace('-', '/')
      },
      axisPointer: {
        label: { formatter: (params) => new Date(Number(params.value)).toISOString().slice(0, 10) }
      },
      axisLine: { lineStyle: { color: '#d7dfe9' } }
    },
    yAxis: {
      type: 'value',
      scale: true,
      name: 'KRW / USD',
      axisLabel: { formatter: (value: number) => number.format(value), color: '#66758a' },
      splitLine: { lineStyle: { color: '#e5eaf2', type: 'dashed' } }
    },
    dataZoom: [
      { type: 'inside', zoomOnMouseWheel: 'ctrl' },
      { type: 'slider', height: 22, bottom: 12, borderColor: '#e1e7ef', showDetail: false }
    ],
    series: [
      {
        name: 'USD/KRW',
        type: 'line',
        data: props.points.map((point) => [Date.parse(`${point.date}T00:00:00Z`), point.rate]),
        showSymbol: props.points.length === 1,
        symbolSize: 7,
        lineStyle: { width: 2.5 },
        areaStyle: { opacity: 0.07 },
        emphasis: { focus: 'series' }
      }
    ]
  }
  chart.setOption(option, { notMerge: true })
}

onMounted(() => {
  if (!container.value) return
  chart = init(container.value, undefined, { renderer: 'canvas' })
  update()
  observer = new ResizeObserver(() => {
    if (active && container.value?.clientWidth) chart?.resize()
  })
  observer.observe(container.value)
})

watch(() => props.points, update)
onActivated(async () => {
  active = true
  await nextTick()
  chart?.resize()
  update()
})
onDeactivated(() => {
  active = false
  chart?.dispatchAction({ type: 'hideTip' })
})
onBeforeUnmount(() => {
  observer?.disconnect()
  chart?.dispose()
  chart = undefined
})
</script>

<template>
  <div class="echarts-rate-chart">
    <div
      ref="container"
      class="echarts-container"
      role="img"
      aria-label="ECharts 달러당 원화 환율 차트"
    />
    <p class="chart-help">
      마우스를 올려 날짜별 환율을 확인하세요. 하단 슬라이더로 구간을 확대할 수 있습니다. 단위: 원 /
      1달러
    </p>
  </div>
</template>

<style scoped>
.echarts-container {
  width: 100%;
  height: 360px;
}
.chart-help {
  color: #66758a;
  font-size: 12px;
  line-height: 1.7;
  margin-bottom: 0;
}
</style>
