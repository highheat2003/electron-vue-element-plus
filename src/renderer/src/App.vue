<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'
import {
  ChatDotRound,
  Expand,
  Fold,
  House,
  InfoFilled,
  Menu,
  Monitor,
  Money,
  Coin,
  Document,
  TrendCharts,
  DataLine,
  Clock,
  Connection,
  Service
} from '@element-plus/icons-vue'
import HomePage from './pages/home/index.vue'
import ComponentsPage from './pages/components/index.vue'
import InfoPage from './pages/info/index.vue'
import ChatPage from './pages/chat/index.vue'
import CodexSdkChatPage from './pages/chat-sdk/index.vue'
import ExchangeRate1Page from './pages/exchange/rate1/index.vue'
import ExchangeRate2Page from './pages/exchange/rate2/index.vue'
import ExchangeHistoryPage from './pages/exchange/history/index.vue'
import DatabaseExamplePage from './pages/database/example/index.vue'
import BackendHelloPage from './pages/backend/hello/index.vue'
const StockChartPage = defineAsyncComponent(() => import('./pages/stocks/chart/index.vue'))

const pages = {
  home: HomePage,
  components: ComponentsPage,
  info: InfoPage,
  chat: ChatPage,
  'chat-sdk': CodexSdkChatPage,
  'exchange-rate1': ExchangeRate1Page,
  'exchange-rate2': ExchangeRate2Page,
  'exchange-history': ExchangeHistoryPage,
  'database-example': DatabaseExamplePage,
  'backend-hello': BackendHelloPage,
  'stock-chart': StockChartPage
}
const activeMenu = ref<keyof typeof pages>('home')
const isCollapsed = ref(false)

function selectMenu(index: string): void {
  if (
    index === 'home' ||
    index === 'components' ||
    index === 'info' ||
    index === 'chat' ||
    index === 'chat-sdk' ||
    index === 'exchange-rate1' ||
    index === 'exchange-rate2' ||
    index === 'exchange-history' ||
    index === 'database-example' ||
    index === 'backend-hello' ||
    index === 'stock-chart'
  ) {
    activeMenu.value = index
  }
}
</script>

<template>
  <el-container class="app-shell">
    <el-header class="app-header">
      <div class="brand">
        <el-icon :size="26"><Monitor /></el-icon> Desktop Starter
      </div>
      <el-tag type="success">Vue + Electron</el-tag>
    </el-header>
    <el-container class="app-body">
      <el-aside class="app-sidebar" :class="{ 'is-collapsed': isCollapsed }">
        <div class="sidebar-toolbar">
          <el-button
            :icon="isCollapsed ? Expand : Fold"
            text
            :aria-label="isCollapsed ? '메뉴 펼치기' : '메뉴 접기'"
            :title="isCollapsed ? '메뉴 펼치기' : '메뉴 접기'"
            :aria-expanded="!isCollapsed"
            aria-controls="main-menu"
            @click="isCollapsed = !isCollapsed"
          />
        </div>
        <nav aria-label="주 메뉴">
          <el-menu
            id="main-menu"
            :default-active="activeMenu"
            :collapse="isCollapsed"
            :collapse-transition="false"
            class="app-menu"
            @select="selectMenu"
          >
            <el-menu-item index="home" aria-label="홈">
              <el-icon><House /></el-icon>
              <template #title>홈</template>
            </el-menu-item>
            <el-menu-item index="components" aria-label="컴포넌트 예제">
              <el-icon><Menu /></el-icon>
              <template #title>컴포넌트 예제</template>
            </el-menu-item>
            <el-menu-item index="info" aria-label="앱 정보">
              <el-icon><InfoFilled /></el-icon>
              <template #title>앱 정보</template>
            </el-menu-item>
            <el-sub-menu index="chatting">
              <template #title>
                <el-icon><ChatDotRound /></el-icon>
                <span>채팅</span>
              </template>
              <el-menu-item index="chat" aria-label="Chat">
                <el-icon><ChatDotRound /></el-icon>
                <template #title>Chat</template>
              </el-menu-item>
              <el-menu-item index="chat-sdk" aria-label="chat(codex sdk)">
                <el-icon><ChatDotRound /></el-icon>
                <template #title>chat(codex sdk)</template>
              </el-menu-item>
            </el-sub-menu>
            <el-sub-menu index="stocks">
              <template #title>
                <el-icon><TrendCharts /></el-icon>
                <span>주식</span>
              </template>
              <el-menu-item index="stock-chart" aria-label="주식차트">
                <el-icon><DataLine /></el-icon>
                <template #title>주식차트</template>
              </el-menu-item>
            </el-sub-menu>
            <el-sub-menu index="exchange">
              <template #title>
                <el-icon><Money /></el-icon>
                <span>환율(KRW)</span>
              </template>
              <el-menu-item index="exchange-rate1" aria-label="환율1">
                <el-icon><DataLine /></el-icon>
                <template #title>환율1</template>
              </el-menu-item>
              <el-menu-item index="exchange-rate2" aria-label="환율2">
                <el-icon><TrendCharts /></el-icon>
                <template #title>환율2</template>
              </el-menu-item>
              <el-menu-item index="exchange-history" aria-label="환율이력">
                <el-icon><Clock /></el-icon>
                <template #title>환율이력</template>
              </el-menu-item>
            </el-sub-menu>
            <el-sub-menu index="backend">
              <template #title>
                <el-icon><Connection /></el-icon>
                <span>Backend</span>
              </template>
              <el-menu-item index="backend-hello" aria-label="Backend hello">
                <el-icon><Service /></el-icon>
                <template #title>hello</template>
              </el-menu-item>
            </el-sub-menu>
            <el-sub-menu index="database">
              <template #title>
                <el-icon><Coin /></el-icon>
                <span>데이터베이스</span>
              </template>
              <el-menu-item index="database-example" aria-label="데이터베이스 예제">
                <el-icon><Document /></el-icon>
                <template #title>예제</template>
              </el-menu-item>
            </el-sub-menu>
          </el-menu>
        </nav>
      </el-aside>
      <el-container class="app-content">
        <el-main>
          <keep-alive>
            <component :is="pages[activeMenu]" />
          </keep-alive>
        </el-main>
        <el-footer>src/renderer/src/pages/ 폴더의 페이지를 수정하여 개발을 시작하세요.</el-footer>
      </el-container>
    </el-container>
  </el-container>
</template>
