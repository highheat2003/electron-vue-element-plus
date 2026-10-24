<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { renderMarkdown } from '../utils/markdown'

const props = defineProps<{ text: string }>()
const html = computed(() => renderMarkdown(props.text))

async function handleLink(event: MouseEvent): Promise<void> {
  const target = event.target
  if (!(target instanceof Element)) return
  const anchor = target.closest('a')
  if (!anchor) return
  event.preventDefault()
  const href = anchor.getAttribute('href')
  if (!href || !/^https?:\/\//i.test(href)) return
  try {
    await window.api.openExternalLink(href)
  } catch {
    ElMessage.error('링크를 열지 못했습니다.')
  }
}
</script>

<template>
  <!-- HTML input is disabled in the shared Markdown renderer. -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="markdown-message" @click="handleLink" v-html="html" />
</template>

<style scoped>
.markdown-message {
  min-width: 0;
  overflow-wrap: anywhere;
  line-height: 1.7;
}
.markdown-message :deep(> :first-child) {
  margin-top: 0;
}
.markdown-message :deep(> :last-child) {
  margin-bottom: 0;
}
.markdown-message :deep(h1),
.markdown-message :deep(h2),
.markdown-message :deep(h3),
.markdown-message :deep(h4),
.markdown-message :deep(h5),
.markdown-message :deep(h6) {
  margin: 1.2em 0 0.5em;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: normal;
}
.markdown-message :deep(h1) {
  font-size: 1.6em;
}
.markdown-message :deep(h2) {
  font-size: 1.35em;
}
.markdown-message :deep(h3) {
  font-size: 1.15em;
}
.markdown-message :deep(p),
.markdown-message :deep(ul),
.markdown-message :deep(ol) {
  margin: 0.75em 0;
}
.markdown-message :deep(ul),
.markdown-message :deep(ol) {
  padding-left: 1.6em;
}
.markdown-message :deep(li + li) {
  margin-top: 0.3em;
}
.markdown-message :deep(strong) {
  color: inherit;
  font-size: inherit;
}
.markdown-message :deep(a) {
  color: var(--el-color-primary);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.markdown-message :deep(code) {
  padding: 0.15em 0.4em;
  background: #e8edf4;
  border-radius: 4px;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 0.9em;
}
.markdown-message :deep(pre) {
  max-width: 100%;
  overflow-x: auto;
  padding: 16px;
  border-radius: 8px;
  background: #1e293b;
  color: #e2e8f0;
  white-space: pre;
  line-height: 1.6;
}
.markdown-message :deep(pre code) {
  padding: 0;
  background: transparent;
  color: inherit;
  border-radius: 0;
  overflow-wrap: normal;
}
.markdown-message :deep(blockquote) {
  margin: 1em 0;
  padding: 0.1em 1em;
  border-left: 3px solid var(--el-color-primary-light-5);
  color: #66758a;
}
.markdown-message :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  margin: 1em 0;
  border-collapse: collapse;
}
.markdown-message :deep(th),
.markdown-message :deep(td) {
  padding: 8px 12px;
  border: 1px solid #d7dfe9;
}
.markdown-message :deep(th) {
  background: #e8edf4;
  font-weight: 700;
}
.markdown-message :deep(hr) {
  margin: 1.2em 0;
  border: 0;
  border-top: 1px solid #d7dfe9;
}
.markdown-message :deep(img) {
  max-width: 100%;
  height: auto;
}
</style>
