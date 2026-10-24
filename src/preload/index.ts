import { contextBridge, ipcRenderer } from 'electron'
import type { ChatEvent, DesktopApi } from '../shared/api'

const api: DesktopApi = {
  getStockHistory: (symbol, interval, years) =>
    ipcRenderer.invoke('stocks:history', symbol, interval, years),
  getBackendStatus: () => ipcRenderer.invoke('backend:status'),
  getBackendHello: (name) => ipcRenderer.invoke('backend:hello', name),
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  getDatabaseExamples: () => ipcRenderer.invoke('database:get-examples'),
  getExchangeRates: () => ipcRenderer.invoke('exchange:get-rates'),
  getExchangeRateHistory: () => ipcRenderer.invoke('exchange:get-history'),
  openExternalLink: (url) => ipcRenderer.invoke('app:open-external-link', url),
  getChatStatus: () => ipcRenderer.invoke('chat:status'),
  sendChat: (request) => ipcRenderer.invoke('chat:send', request),
  cancelChat: () => ipcRenderer.invoke('chat:cancel'),
  resetChat: () => ipcRenderer.invoke('chat:reset'),
  getSdkChatStatus: () => ipcRenderer.invoke('sdk-chat:status'),
  sendSdkChat: (request) => ipcRenderer.invoke('sdk-chat:send', request),
  cancelSdkChat: () => ipcRenderer.invoke('sdk-chat:cancel'),
  resetSdkChat: () => ipcRenderer.invoke('sdk-chat:reset'),
  onSdkChatEvent: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: ChatEvent): void =>
      listener(payload)
    ipcRenderer.on('sdk-chat:event', handler)
    return () => ipcRenderer.removeListener('sdk-chat:event', handler)
  },
  onChatEvent: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: ChatEvent): void =>
      listener(payload)
    ipcRenderer.on('chat:event', handler)
    return () => ipcRenderer.removeListener('chat:event', handler)
  }
}
contextBridge.exposeInMainWorld('api', api)
