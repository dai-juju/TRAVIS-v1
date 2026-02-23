import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  sendChatMessage: (payload: unknown) =>
    ipcRenderer.invoke('claude:chat', payload),
})
