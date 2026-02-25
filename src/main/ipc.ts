import { ipcMain } from 'electron'
import { fetchTraditionalAssets } from './yahooFinance'
import { searchTavily } from './tavily'
import { fetchCryptoNews, fetchFearGreed } from './feedApi'
import { fetchRecentTrades, fetchMultipleTickers } from './binanceApi'
import { fetchCoinData, searchCoinId } from './coingeckoApi'
import { fetchFundingRate, fetchOpenInterest } from './binanceFuturesApi'
import { fetchKimchiPremium } from './upbitApi'

export function registerIpcHandlers() {
  // 기존 non-streaming 핸들러 (fallback)
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

  // SSE 스트리밍 핸들러
  ipcMain.on('claude:chat-stream', async (event, payload) => {
    const { apiKey, model, messages, system, tools } = payload

    try {
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
          stream: true,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        event.sender.send('stream:error', { error: `API ${response.status}: ${errorText}` })
        return
      }

      const reader = (response.body as ReadableStream<Uint8Array>).getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        while (buffer.includes('\n')) {
          const lineEnd = buffer.indexOf('\n')
          const line = buffer.slice(0, lineEnd).trim()
          buffer = buffer.slice(lineEnd + 1)

          if (!line.startsWith('data: ')) continue
          const dataStr = line.slice(6)
          if (dataStr === '[DONE]') continue

          try {
            const json = JSON.parse(dataStr)
            const type = json.type as string

            if (type === 'content_block_start') {
              const block = json.content_block
              if (block?.type === 'tool_use') {
                event.sender.send('stream:tool-start', {
                  index: json.index,
                  id: block.id,
                  name: block.name,
                })
              }
              // text block start — 무시 (delta에서 처리)
            } else if (type === 'content_block_delta') {
              const delta = json.delta
              if (delta?.type === 'text_delta') {
                event.sender.send('stream:text-delta', { text: delta.text })
              } else if (delta?.type === 'input_json_delta') {
                event.sender.send('stream:tool-delta', {
                  index: json.index,
                  json: delta.partial_json,
                })
              }
            } else if (type === 'content_block_stop') {
              event.sender.send('stream:tool-end', { index: json.index })
            } else if (type === 'message_delta') {
              event.sender.send('stream:message-delta', {
                stopReason: json.delta?.stop_reason,
              })
            } else if (type === 'message_stop') {
              event.sender.send('stream:end', {})
            }
          } catch {
            // JSON 파싱 실패 — 무시
          }
        }
      }

      // reader 완료 후 end 이벤트가 아직 안 갔으면 보냄
      event.sender.send('stream:end', {})
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown streaming error'
      event.sender.send('stream:error', { error: message })
    }
  })

  ipcMain.handle('tradfi:quotes', async () => {
    return fetchTraditionalAssets()
  })

  ipcMain.handle('tavily:search', async (_event, { query, apiKey }) => {
    return searchTavily(query, apiKey)
  })

  ipcMain.handle('feed:cryptonews', async () => fetchCryptoNews())
  ipcMain.handle('feed:feargreed', async () => fetchFearGreed())

  // Investigation Mode APIs
  ipcMain.handle('binance:trades', async (_event, { symbol, limit }) =>
    fetchRecentTrades(symbol, limit)
  )
  ipcMain.handle('binance:multi-ticker', async (_event, { symbols }) =>
    fetchMultipleTickers(symbols)
  )
  ipcMain.handle('coingecko:coin-data', async (_event, { coinId }) =>
    fetchCoinData(coinId)
  )
  ipcMain.handle('coingecko:search', async (_event, { symbol }) =>
    searchCoinId(symbol)
  )

  // Binance Futures
  ipcMain.handle('binance-futures:funding', async (_event, { symbol }) =>
    fetchFundingRate(symbol)
  )
  ipcMain.handle('binance-futures:open-interest', async (_event, { symbol }) =>
    fetchOpenInterest(symbol)
  )

  // Upbit Kimchi Premium
  ipcMain.handle('upbit:kimchi-premium', async (_event, { symbols }) =>
    fetchKimchiPremium(symbols)
  )
}
