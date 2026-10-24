<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Refresh, Search } from '@element-plus/icons-vue'
import type { DatabaseExampleData } from '../../../../../shared/api'

const data = ref<DatabaseExampleData>()
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const page = ref(1)
const pageSize = ref(10)
const filteredRows = computed(() => {
  const query = keyword.value.trim().toLocaleLowerCase()
  return (data.value?.rows ?? []).filter((row) =>
    [row.code, row.name, row.email, row.department].some((value) =>
      value.toLocaleLowerCase().includes(query)
    )
  )
})
const rows = computed(() =>
  filteredRows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
)
watch([keyword, pageSize], () => {
  page.value = 1
})

async function load(): Promise<void> {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    data.value = await window.api.getDatabaseExamples()
    page.value = 1
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
        : '데이터베이스를 조회하지 못했습니다.'
  } finally {
    loading.value = false
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}

onMounted(load)
</script>

<template>
  <section class="database-page">
    <div class="database-heading">
      <div>
        <p class="eyebrow">SQLITE DATABASE</p>
        <h1>데이터베이스 예제</h1>
        <p class="hint">로컬 SQLite에 저장된 테스트 사용자 데이터를 조회합니다.</p>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="load">조회</el-button>
    </div>
    <el-alert
      v-if="error"
      :title="error"
      :description="data ? '이전에 조회한 데이터를 표시합니다.' : undefined"
      type="error"
      show-icon
      :closable="false"
      class="database-error"
    />
    <el-card v-loading="loading" shadow="never" class="panel">
      <template #header>
        <div class="table-toolbar">
          <div>
            <strong>테스트 사용자</strong
            ><el-tag type="info" effect="plain">{{ data?.rows.length ?? 0 }}건</el-tag>
          </div>
          <el-input
            v-model="keyword"
            :prefix-icon="Search"
            clearable
            placeholder="이름, 코드, 이메일, 부서 검색"
            aria-label="테스트 사용자 검색"
            class="database-search"
          />
        </div>
      </template>
      <el-table
        :data="rows"
        stripe
        border
        row-key="id"
        empty-text="조회된 데이터가 없습니다."
        aria-label="테스트 사용자 목록"
      >
        <el-table-column prop="id" label="ID" width="70" sortable />
        <el-table-column prop="code" label="사용자 코드" width="130" />
        <el-table-column prop="name" label="이름" min-width="110" />
        <el-table-column prop="email" label="이메일" min-width="210" show-overflow-tooltip />
        <el-table-column prop="department" label="부서" min-width="110" />
        <el-table-column label="상태" width="90">
          <template #default="{ row }"
            ><el-tag :type="row.status === 'active' ? 'success' : 'info'">{{
              row.status === 'active' ? '활성' : '비활성'
            }}</el-tag></template
          >
        </el-table-column>
        <el-table-column label="생성일 (KST)" min-width="220">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
      </el-table>
      <div class="database-pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[5, 10, 20]"
          :total="filteredRows.length"
          layout="total, sizes, prev, pager, next"
          background
        />
      </div>
    </el-card>
    <el-descriptions v-if="data" :column="1" border class="database-details">
      <el-descriptions-item label="데이터베이스 파일"
        ><span class="database-path">{{ data.path }}</span></el-descriptions-item
      >
      <el-descriptions-item label="테이블">{{ data.table }}</el-descriptions-item>
    </el-descriptions>
    <p class="hint">
      더미 데이터는 최초 생성 시 12건을 저장합니다. 앱을 재실행해도 데이터가 유지되며 중복으로
      추가되지 않습니다.
    </p>
  </section>
</template>

<style scoped>
.database-page {
  max-width: 1200px;
  margin: 0 auto;
}
.database-heading,
.table-toolbar,
.table-toolbar > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.database-heading {
  margin-bottom: 24px;
}
.database-heading .hint {
  margin-top: 0;
}
.database-search {
  width: 320px;
  max-width: 100%;
}
.database-error {
  margin-bottom: 20px;
}
.database-pagination {
  margin-top: 20px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.database-path {
  overflow-wrap: anywhere;
}
.database-details {
  margin-bottom: 16px;
}
</style>
