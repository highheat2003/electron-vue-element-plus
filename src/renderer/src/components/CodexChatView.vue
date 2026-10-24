<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ChatDotRound, Plus, Refresh, Promotion } from '@element-plus/icons-vue'
import type { ChatStatus, ChatEvent, ChatRequest } from '../../../shared/api'
import MarkdownMessage from './MarkdownMessage.vue'

const props = defineProps<{ mode: 'cli' | 'sdk'; title: string }>()
const label = computed(() => (props.mode === 'sdk' ? 'CODEX SDK' : 'CODEX CLI'))
const transport = {
  status: () => (props.mode === 'sdk' ? window.api.getSdkChatStatus() : window.api.getChatStatus()),
  send: (request: ChatRequest) =>
    props.mode === 'sdk' ? window.api.sendSdkChat(request) : window.api.sendChat(request),
  cancel: () => (props.mode === 'sdk' ? window.api.cancelSdkChat() : window.api.cancelChat()),
  reset: () => (props.mode === 'sdk' ? window.api.resetSdkChat() : window.api.resetChat()),
  subscribe: (listener: (event: ChatEvent) => void) =>
    props.mode === 'sdk' ? window.api.onSdkChatEvent(listener) : window.api.onChatEvent(listener)
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
}

const status = ref<ChatStatus>()
const checking = ref(false)
const sending = ref(false)
const stopping = ref(false)
const draft = ref('')
const error = ref('')
const progress = ref('')
const messages = ref<Message[]>([])
const transcript = ref<HTMLElement>()
const requestId = ref('')
const ready = computed(() => status.value?.available && status.value.authenticated)
let unsubscribe: (() => void) | undefined

async function scrollToEnd(): Promise<void> {
  await nextTick()
  if (transcript.value) transcript.value.scrollTop = transcript.value.scrollHeight
}

async function checkConnection(): Promise<void> {
  checking.value = true
  try {
    status.value = await transport.status()
  } catch {
    status.value = {
      available: false,
      authenticated: false,
      message: 'Electron 앱에서 실행한 후 다시 확인하세요.'
    }
  } finally {
    checking.value = false
  }
}

async function send(): Promise<void> {
  if (!draft.value.trim() || sending.value || !ready.value) return
  const prompt = draft.value.trim()
  requestId.value = crypto.randomUUID()
  messages.value.push({ id: requestId.value, role: 'user', text: prompt })
  draft.value = ''
  error.value = ''
  sending.value = true
  progress.value = 'Codex에 연결하고 있습니다…'
  void scrollToEnd()
  try {
    const result = await transport.send({ requestId: requestId.value, prompt })
    if (result.status === 'error') {
      error.value = result.error ?? '응답을 받지 못했습니다.'
      if (!draft.value) draft.value = prompt
    }
    if (result.status === 'cancelled') progress.value = '응답을 중지했습니다.'
    else progress.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '메시지를 전송하지 못했습니다.'
    if (!draft.value) draft.value = prompt
    progress.value = ''
  } finally {
    sending.value = false
    stopping.value = false
    void scrollToEnd()
  }
}

async function stop(): Promise<void> {
  stopping.value = true
  try {
    await transport.cancel()
  } catch {
    error.value = '응답 중지 요청에 실패했습니다.'
    stopping.value = false
  }
}

async function newChat(): Promise<void> {
  try {
    await transport.reset()
    messages.value = []
    draft.value = ''
    error.value = ''
    progress.value = ''
    requestId.value = ''
  } catch {
    error.value = '새 대화를 시작하지 못했습니다. 응답이 끝난 후 다시 시도하세요.'
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    void send()
  }
}

onMounted(() => {
  if (window.api) {
    unsubscribe = transport.subscribe((event) => {
      if (event.requestId !== requestId.value) return
      if (event.type === 'status') progress.value = event.text
      else {
        const id = `${event.requestId}:${event.id}`
        const existing = messages.value.find((message) => message.id === id)
        if (existing) existing.text = event.text
        else messages.value.push({ id, role: 'assistant', text: event.text })
        void scrollToEnd()
      }
    })
  }
  void checkConnection()
})

onBeforeUnmount(() => {
  unsubscribe?.()
})
</script>

<template>
  <section class="chat-page">
    <div class="chat-heading">
      <div>
        <p class="eyebrow">{{ label }}</p>
        <h1>{{ title }}</h1>
        <p class="hint">Codex와 대화하세요. 메뉴를 이동해도 현재 대화가 유지됩니다.</p>
      </div>
      <el-button :icon="Plus" :disabled="sending" @click="newChat">새 대화</el-button>
    </div>

    <el-card shadow="never" class="chat-card">
      <template #header>
        <div class="chat-connection">
          <el-tag :type="ready ? 'success' : 'info'">
            {{ checking ? '연결 확인 중' : ready ? '연결됨' : '연결 필요' }}
          </el-tag>
          <span class="hint">{{ status?.version ?? label }}</span>
          <el-button
            :icon="Refresh"
            :loading="checking"
            :disabled="sending"
            text
            @click="checkConnection"
          >
            연결 확인
          </el-button>
        </div>
        <p v-if="status && !ready" class="hint">{{ status.message }}</p>
      </template>

      <div
        ref="transcript"
        class="chat-transcript"
        role="log"
        aria-label="채팅 대화"
        aria-live="polite"
        :aria-busy="sending"
      >
        <div v-if="messages.length === 0" class="chat-empty">
          <el-icon :size="40"><ChatDotRound /></el-icon>
          <h2>무엇을 도와드릴까요?</h2>
          <p>궁금한 점이나 코드에 대해 질문해 보세요.</p>
        </div>
        <article
          v-for="message in messages"
          :key="message.id"
          class="chat-message"
          :class="message.role"
        >
          <strong class="chat-message-author">{{
            message.role === 'user' ? '나' : 'Codex'
          }}</strong>
          <MarkdownMessage
            v-if="message.role === 'assistant'"
            class="chat-message-markdown"
            :text="message.text"
          />
          <div v-else class="chat-message-text">{{ message.text }}</div>
        </article>
        <p v-if="progress" class="chat-progress" role="status">{{ progress }}</p>
      </div>

      <el-alert
        v-if="error"
        :title="error"
        type="error"
        show-icon
        :closable="false"
        class="chat-error"
      />

      <el-form class="chat-composer" @submit.prevent="send">
        <el-input
          v-model="draft"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 8 }"
          :maxlength="32000"
          show-word-limit
          :disabled="!ready"
          aria-label="메시지"
          placeholder="메시지를 입력하세요 (Enter로 전송, Shift+Enter로 줄바꿈)"
          @keydown="handleKeydown"
        />
        <div class="chat-actions">
          <span class="hint">{{
            sending ? 'Codex가 답변하고 있습니다.' : 'Enter로 전송 · Shift+Enter로 줄바꿈'
          }}</span>
          <el-button v-if="sending" :loading="stopping" @click="stop">응답 중지</el-button>
          <el-button
            v-else
            type="primary"
            :icon="Promotion"
            native-type="submit"
            :disabled="!ready || !draft.trim()"
          >
            전송
          </el-button>
        </div>
      </el-form>
    </el-card>
  </section>
</template>

<style scoped>
.chat-page {
  max-width: 1000px;
  margin: 0 auto;
}
.chat-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
.chat-heading .hint {
  margin-top: 0;
}
.chat-card {
  border-radius: 12px;
}
.chat-connection {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.chat-connection .el-button {
  margin-left: auto;
}
.chat-transcript {
  height: clamp(220px, 42vh, 560px);
  overflow-y: auto;
  padding: 4px;
}
.chat-empty {
  display: grid;
  justify-items: center;
  align-content: center;
  min-height: 100%;
  color: #66758a;
  text-align: center;
}
.chat-empty h2 {
  font-size: 20px;
  color: #243247;
  margin-bottom: 0;
}
.chat-empty p {
  line-height: 1.7;
}
.chat-message {
  min-width: 0;
  width: fit-content;
  max-width: 90%;
  padding: 14px 18px;
  margin-bottom: 16px;
  border-radius: 12px;
  background: #f4f7fb;
}
.chat-message.user {
  margin-left: auto;
  background: var(--el-color-primary-light-9);
}
.chat-message-author {
  font-size: 12px;
  color: #66758a;
}
.chat-message-markdown {
  margin-top: 8px;
}
.chat-message-text {
  margin-top: 8px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.7;
}
.chat-progress {
  color: #66758a;
  font-size: 13px;
}
.chat-error {
  margin: 16px 0;
  overflow-wrap: anywhere;
}
.chat-composer {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e1e7ef;
}
.chat-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
}
.chat-actions .hint {
  font-size: 12px;
}
@media (max-width: 640px) {
  .chat-heading,
  .chat-actions {
    align-items: flex-start;
    flex-direction: column;
  }
  .chat-message {
    max-width: 100%;
  }
}
</style>
