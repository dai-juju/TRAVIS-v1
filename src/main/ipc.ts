import { ipcMain } from 'electron'
import { fetchTraditionalAssets } from './yahooFinance'
import { searchTavily } from './tavily'

export function registerIpcHandlers() {
  ipcMain.handle('claude:chat', async (_event, payload) => {
    const { apiKey, model, messages, system, tools } = payload

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system,
        messages,
        tools,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API ${response.status}: ${errorText}`)
    }

    return response.json()
  })

  ipcMain.handle('tradfi:quotes', async () => {
    return fetchTraditionalAssets()
  })

  ipcMain.handle('tavily:search', async (_event, { query, apiKey }) => {
    return searchTavily(query, apiKey)
  })
}
