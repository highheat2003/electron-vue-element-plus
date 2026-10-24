<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ExchangeRatePoint } from '../../../shared/api'

const props = defineProps<{ points: ExchangeRatePoint[] }>()
const activeIndex = ref(0)
const width = 900
const height = 320
const left = 78
const right = 20
const top = 24
const bottom = 42
const plotWidth = width - left - right
const plotHeight = height - top - bottom
const number = new Intl.NumberFormat('ko-KR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})
const geometry = computed(() => {
  const rates = props.points.map((point) => point.rate)
  const minimum = Math.min(...rates)
  const maximum = Math.max(...rates)
  const padding = Math.max((maximum - minimum) * 0.12, maximum * 0.001, 1)
  const low = minimum - padding
  const high = maximum + padding
  const start = Date.parse(props.points[0].date)
  const span = Math.max(Date.parse(props.points.at(-1)!.date) - start, 1)
  const points = props.points.map((point) => ({
    ...point,
    x: left + ((Date.parse(point.date) - start) / span) * plotWidth,
    y: top + ((high - point.rate) / (high - low)) * plotHeight
  }))
  const ticks = Array.from({ length: 5 }, (_, index) => ({
    y: top + (index / 4) * plotHeight,
    value: high - (index / 4) * (high - low)
  }))
  const dates = [
    ...new Set(
      Array.from({ length: Math.min(5, points.length) }, (_, index) =>
        Math.round((index / Math.max(Math.min(5, points.length) - 1, 1)) * (points.length - 1))
      )
    )
  ].map((index) => points[index])
  return { points, ticks, dates, line: points.map((point) => `${point.x},${point.y}`).join(' ') }
})
const selected = computed(
  () => geometry.value.points[activeIndex.value] ?? geometry.value.points.at(-1)!
)
const area = computed(
  () =>
    `${left},${top + plotHeight} ${geometry.value.line} ${geometry.value.points.at(-1)!.x},${top + plotHeight}`
)

watch(
  () => props.points,
  () => {
    activeIndex.value = props.points.length - 1
  },
  { immediate: true }
)

function inspect(event: PointerEvent): void {
  const svg = event.currentTarget as SVGSVGElement
  const x =
    ((event.clientX - svg.getBoundingClientRect().left) / svg.getBoundingClientRect().width) * width
  activeIndex.value = geometry.value.points.reduce(
    (nearest, point, index, points) =>
      Math.abs(point.x - x) < Math.abs(points[nearest].x - x) ? index : nearest,
    0
  )
}

function handleKey(event: KeyboardEvent): void {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  if (event.key === 'Home') activeIndex.value = 0
  else if (event.key === 'End') activeIndex.value = props.points.length - 1
  else
    activeIndex.value = Math.max(
      0,
      Math.min(props.points.length - 1, activeIndex.value + (event.key === 'ArrowRight' ? 1 : -1))
    )
}
</script>

<template>
  <div class="rate-chart">
    <div class="chart-inspection" aria-live="polite" aria-atomic="true">
      <span>{{ selected.date }}</span>
      <strong>{{ number.format(selected.rate) }} <small>KRW / USD</small></strong>
    </div>
    <div class="chart-scroll">
      <svg
        :viewBox="`0 0 ${width} ${height}`"
        role="img"
        tabindex="0"
        aria-label="USD 대비 KRW 일별 환율 차트. 마우스를 올리거나 좌우 방향키로 날짜별 환율을 확인하세요."
        @pointermove="inspect"
        @keydown="handleKey"
      >
        <title>달러당 원화 환율 추이</title>
        <g v-for="tick in geometry.ticks" :key="tick.y">
          <line
            :x1="left"
            :x2="width - right"
            :y1="tick.y"
            :y2="tick.y"
            stroke="#e5eaf2"
            stroke-dasharray="4 5"
          />
          <text :x="left - 12" :y="tick.y + 4" text-anchor="end">
            {{ number.format(tick.value) }}
          </text>
        </g>
        <polygon :points="area" fill="#3866df" fill-opacity="0.07" />
        <polyline
          :points="geometry.line"
          fill="none"
          stroke="#3866df"
          stroke-width="2.5"
          stroke-linejoin="round"
        />
        <line
          :x1="selected.x"
          :x2="selected.x"
          :y1="top"
          :y2="top + plotHeight"
          stroke="#93a5c2"
          stroke-dasharray="4 4"
        />
        <circle
          :cx="selected.x"
          :cy="selected.y"
          r="5"
          fill="#3866df"
          stroke="white"
          stroke-width="2"
        />
        <text
          v-for="point in geometry.dates"
          :key="point.date"
          :x="point.x"
          :y="height - 12"
          :text-anchor="
            point === geometry.points[0]
              ? 'start'
              : point === geometry.points.at(-1)
                ? 'end'
                : 'middle'
          "
        >
          {{ point.date.slice(5).replace('-', '/') }}
        </text>
      </svg>
    </div>
    <p class="chart-help">마우스 또는 ← → 키로 날짜별 환율을 확인하세요. 단위: 원 / 1달러</p>
  </div>
</template>

<style scoped>
.chart-inspection {
  display: flex;
  align-items: baseline;
  gap: 16px;
  padding: 8px 0 16px;
  color: #66758a;
  font-size: 13px;
  flex-wrap: wrap;
}
.chart-inspection strong {
  font-size: 21px;
  color: #243247;
  font-variant-numeric: tabular-nums;
}
.chart-inspection small {
  font-size: 12px;
  color: #66758a;
  font-weight: 400;
}
.chart-scroll {
  overflow-x: auto;
}
svg {
  display: block;
  width: 100%;
  min-width: 480px;
  cursor: crosshair;
}
svg:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
  border-radius: 4px;
}
text {
  font-family: inherit;
  font-size: 12px;
  fill: #66758a;
}
.chart-help {
  color: #66758a;
  font-size: 12px;
  margin-bottom: 0;
}
</style>
