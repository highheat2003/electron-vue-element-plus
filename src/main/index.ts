import { app, BrowserWindow, ipcMain, shell } from 'electron'
import type { AppInfo } from '../shared/api'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { CodexChat, getCodexStatus, resolveCodexLaunch } from './codex-chat'
import { CodexSdkChat } from './codex-sdk-chat'
import type { ChatRequest } from '../shared/api'
import { getAndStoreExchangeRates } from './exchange-rates'
import { createStore } from './database/store'
import type { Store } from './database/store'
import { PythonBackendProcess } from './python/process'
import { PythonBackendClient } from './python/client'

let store: Store | undefined
let storeError = ''
let backendProcess: PythonBackendProcess | undefined
let backendClient: PythonBackendClient | undefined
let backendStopping = false
let backendStopped = false

const chats = new Map<number, CodexChat>()
const sdkChats = new Map<number, CodexSdkChat>()

function getSdkLaunch(): ReturnType<typeof resolveCodexLaunch> {
  const launch = resolveCodexLaunch([app.getAppPath()])
  if (app.isPackaged)
    launch.command = launch.command.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')
  return launch
}

function getSdkChat(event: Electron.IpcMainInvokeEvent): CodexSdkChat {
  if (event.senderFrame !== event.sender.mainFrame || !BrowserWindow.fromWebContents(event.sender))
    throw new Error('허용되지 않은 요청입니다.')
  let session = sdkChats.get(event.sender.id)
  if (!session) {
    const launch = getSdkLaunch()
    const chat = new CodexSdkChat({
      binaryPath: launch.command,
      binaryArgs: launch.args,
      env: launch.env,
      cwd: app.isPackaged ? app.getPath('userData') : app.getAppPath()
    })
    const id = event.sender.id
    sdkChats.set(id, chat)
    session = chat
    event.sender.once('destroyed', () => {
      chat.dispose()
      sdkChats.delete(id)
    })
    event.sender.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
      if (isMainFrame && !isInPlace) {
        chat.dispose()
        sdkChats.delete(id)
      }
    })
  }
  return session
}

function getChat(event: Electron.IpcMainInvokeEvent): CodexChat {
  if (
    event.senderFrame !== event.sender.mainFrame ||
    !BrowserWindow.fromWebContents(event.sender)
  ) {
    throw new Error('허용되지 않은 요청입니다.')
  }
  let chat = chats.get(event.sender.id)
  if (!chat) {
    chat = new CodexChat()
    chats.set(event.sender.id, chat)
    const session = chat
    const id = event.sender.id
    event.sender.once('destroyed', () => {
      session.cancel()
      chats.delete(id)
    })
    event.sender.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
      if (isMainFrame && !isInPlace) session.cancel()
    })
  }
  return chat
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 600,
    minHeight: 500,
    title: 'Desktop Starter',
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  const backendDirectory = app.isPackaged
    ? join(process.resourcesPath, 'backend')
    : join(app.getAppPath(), 'backend')
  backendProcess = new PythonBackendProcess({
    command: app.isPackaged
      ? join(
          backendDirectory,
          process.platform === 'win32' ? 'desktop-backend.exe' : 'desktop-backend'
        )
      : join(
          backendDirectory,
          '.venv',
          process.platform === 'win32' ? 'Scripts' : 'bin',
          process.platform === 'win32' ? 'python.exe' : 'python'
        ),
    args: app.isPackaged ? [] : ['-m', 'app'],
    cwd: backendDirectory
  })
  backendClient = new PythonBackendClient(backendProcess)
  void backendProcess.start().catch((error: Error) => console.warn(error.message))
  try {
    if (app.isPackaged) {
      store = createStore(
        join(app.getPath('userData'), 'database', 'store.sqlite'),
        join(process.resourcesPath, 'database', 'store.sqlite')
      )
    } else {
      store = createStore(join(app.getAppPath(), 'resources', 'database', 'store.sqlite'))
    }
  } catch (error) {
    console.error('SQLite initialization failed:', error)
    storeError = '데이터베이스를 열지 못했습니다. 저장 경로의 쓰기 권한과 파일 상태를 확인하세요.'
  }
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.example.desktopstarter')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('app:get-info', (): AppInfo => ({
    version: app.getVersion(),
    platform: process.platform,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }))

  ipcMain.handle('backend:status', (event) => {
    if (
      event.senderFrame !== event.sender.mainFrame ||
      !BrowserWindow.fromWebContents(event.sender)
    )
      throw new Error('허용되지 않은 요청입니다.')
    if (!backendClient) throw new Error('Python 백엔드가 준비되지 않았습니다.')
    return backendClient.status()
  })
  ipcMain.handle('stocks:history', (event, symbol: string, interval: string, years: number = 3) => {
    if (
      event.senderFrame !== event.sender.mainFrame ||
      !BrowserWindow.fromWebContents(event.sender)
    )
      throw new Error('허용되지 않은 요청입니다.')
    if (!backendClient) throw new Error('Python 백엔드가 준비되지 않았습니다.')
    return backendClient.stockHistory(symbol, interval, years)
  })
  ipcMain.handle('backend:hello', (event, name: string) => {
    if (
      event.senderFrame !== event.sender.mainFrame ||
      !BrowserWindow.fromWebContents(event.sender)
    )
      throw new Error('허용되지 않은 요청입니다.')
    if (!backendClient) throw new Error('Python 백엔드가 준비되지 않았습니다.')
    return backendClient.hello(name)
  })

  ipcMain.handle('chat:status', (event) => {
    getChat(event)
    return getCodexStatus()
  })
  ipcMain.handle('database:get-examples', (event) => {
    if (
      event.senderFrame !== event.sender.mainFrame ||
      !BrowserWindow.fromWebContents(event.sender)
    ) {
      throw new Error('허용되지 않은 요청입니다.')
    }
    if (!store) throw new Error(storeError || '데이터베이스가 준비되지 않았습니다.')
    return store.getExamples()
  })
  ipcMain.handle('exchange:get-rates', (event) => {
    if (
      event.senderFrame !== event.sender.mainFrame ||
      !BrowserWindow.fromWebContents(event.sender)
    ) {
      throw new Error('허용되지 않은 요청입니다.')
    }
    if (!store) throw new Error(storeError || '데이터베이스가 준비되지 않았습니다.')
    return getAndStoreExchangeRates(store)
  })
  ipcMain.handle('exchange:get-history', (event) => {
    if (
      event.senderFrame !== event.sender.mainFrame ||
      !BrowserWindow.fromWebContents(event.sender)
    ) {
      throw new Error('허용되지 않은 요청입니다.')
    }
    if (!store) throw new Error(storeError || '데이터베이스가 준비되지 않았습니다.')
    return store.getExchangeRateHistory()
  })
  ipcMain.handle('app:open-external-link', async (event, url: unknown) => {
    getChat(event)
    if (typeof url !== 'string' || url.length > 8192) throw new Error('잘못된 링크입니다.')
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('HTTP 또는 HTTPS 링크만 열 수 있습니다.')
    }
    await shell.openExternal(parsed.href)
  })
  ipcMain.handle('chat:send', async (event, request: ChatRequest) => {
    const chat = getChat(event)
    if (!request || typeof request.requestId !== 'string' || request.requestId.length > 80) {
      throw new Error('잘못된 채팅 요청입니다.')
    }
    return chat.send(request.prompt, (payload) => {
      if (!event.sender.isDestroyed())
        event.sender.send('chat:event', { ...payload, requestId: request.requestId })
    })
  })
  ipcMain.handle('chat:cancel', (event) => getChat(event).cancel())
  ipcMain.handle('chat:reset', (event) => getChat(event).reset())
  ipcMain.handle('sdk-chat:status', async (event) => {
    try {
      getSdkChat(event)
      const status = await getCodexStatus(getSdkLaunch())
      return {
        ...status,
        version: `Codex SDK · ${status.version ?? ''}`,
        message: status.authenticated ? 'Codex SDK에 연결되었습니다.' : status.message
      }
    } catch (error) {
      return {
        available: false,
        authenticated: false,
        message: error instanceof Error ? error.message : 'SDK 연결 확인에 실패했습니다.'
      }
    }
  })
  ipcMain.handle('sdk-chat:send', (event, request: ChatRequest) => {
    const chat = getSdkChat(event)
    if (
      !request ||
      typeof request.requestId !== 'string' ||
      !request.requestId ||
      request.requestId.length > 80
    )
      throw new Error('잘못된 채팅 요청입니다.')
    return chat.send(request.prompt, (payload) => {
      if (!event.sender.isDestroyed())
        event.sender.send('sdk-chat:event', { ...payload, requestId: request.requestId })
    })
  })
  ipcMain.handle('sdk-chat:cancel', (event) => getSdkChat(event).cancel())
  ipcMain.handle('sdk-chat:reset', (event) => getSdkChat(event).reset())

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', (event) => {
  if (backendProcess && !backendStopped) {
    event.preventDefault()
    if (!backendStopping) {
      backendStopping = true
      void backendProcess.stop().finally(() => {
        backendStopped = true
        app.quit()
      })
    }
    return
  }
  store?.close()
  for (const chat of chats.values()) chat.cancel()
  for (const chat of sdkChats.values()) chat.dispose()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
