// ============================================================
// IPC 핸들러 등록 파일
// IPC = Inter-Process Communication (프로세스 간 통신)
// 역할: 화면(렌더러)에서 "데이터 줘!" 하고 요청하면, 이 파일이 받아서
//       각종 외부 API(Claude AI, 바이낸스, 야후 등)를 호출하고 결과를 돌려줌
// 비유: 레스토랑의 주방 — 홀(화면)에서 주문이 들어오면 여기서 요리(API 호출)해서 내보냄
// ============================================================

// Electron의 메인 프로세스 통신 모듈 (화면의 요청을 수신)
import { ipcMain } from 'electron'
// Phase 3A-6: CCXT Pro 기반 통합 WebSocket 서비스
import { exchangeWsService } from './services/exchangeWsService'
// Yahoo Finance에서 전통자산(주식, 금, 원유 등) 시세를 가져오는 모듈
import { fetchTraditionalAssets } from './yahooFinance'
// Tavily 웹 검색 API 모듈 (AI가 최신 정보를 검색할 때 사용)
import { searchTavily } from './tavily'
// 암호화폐 뉴스와 공포&탐욕 지수를 가져오는 모듈
import { fetchCryptoNews, fetchFearGreed } from './feedApi'
// 바이낸스 현물 거래 데이터를 가져오는 모듈 (최근 거래, 시세 등)
import { fetchRecentTrades, fetchMultipleTickers } from './binanceApi'
// CoinGecko에서 코인 상세 정보를 가져오는 모듈 (시총, 공급량 등)
import { fetchCoinData, searchCoinId } from './coingeckoApi'
// 바이낸스 선물 데이터를 가져오는 모듈 (펀딩비, 미결제약정)
import { fetchFundingRate, fetchOpenInterest } from './binanceFuturesApi'
// 업비트 김치 프리미엄(한국 거래소와 해외 거래소 가격 차이)을 가져오는 모듈
import { fetchKimchiPremium } from './upbitApi'
// Phase 3: 동적 심볼 해석 — 아무 코인이든 CoinGecko /search로 자동 resolve
import { resolveSymbol, resolveMultipleSymbols } from './api/symbolResolverApi'
// Phase 3: AI fetch_coin_data 도구 — 종합 코인 데이터 조회
import { fetchCoinData as fetchCoinDataForTool } from './api/coinDataApi'
// Phase 3: AI fetch_market_overview 도구 — 전체 크립토 시장 상황 종합
import { fetchMarketOverview } from './api/marketOverviewApi'
// Phase 3: AI fetch_derivatives_data 도구 — 선물/파생상품 종합 데이터
import { fetchDerivativesData } from './api/derivativesApi'
// Phase 3: AI fetch_trending 도구 — 트렌딩 코인/NFT/카테고리
import { fetchTrending } from './api/trendingApi'
// Phase 3: AI fetch_whale_activity 도구 — 대형 거래(고래 활동) 탐지
import { fetchWhaleActivity } from './api/whaleApi'

// 모든 IPC 통신 채널을 등록하는 메인 함수
// 앱 시작 시 index.ts에서 한 번 호출됨
export function registerIpcHandlers() {
  // ── Claude AI 채팅 (일반 방식: 한 번에 전체 응답을 받음) ──
  // 스트리밍이 실패했을 때 대비용(fallback)
  ipcMain.handle('claude:chat', async (_event, payload) => {
    // 화면에서 보낸 데이터를 분해: API 키, 모델명, 대화 내역, 시스템 프롬프트, AI 도구 목록
    const { apiKey, model, messages, system, tools } = payload

    // Claude API에 HTTP POST 요청을 보냄
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,              // Anthropic API 인증 키
        'anthropic-version': '2023-06-01', // API 버전
      },
      body: JSON.stringify({
        model,            // 사용할 AI 모델 (예: claude-sonnet)
        max_tokens: 4096, // AI 응답 최대 길이 (토큰 수)
        system,           // 시스템 프롬프트 (AI의 역할/성격 설정)
        messages,         // 대화 히스토리 (유저 질문 + AI 응답 기록)
        tools,            // AI가 사용할 수 있는 도구 목록 (카드 생성, 웹 검색 등)
      }),
    })

    // API 호출 실패 시 에러 메시지 전달
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API ${response.status}: ${errorText}`)
    }

    // 성공 시 AI 응답(JSON)을 화면에 전달
    return response.json()
  })

  // ── Claude AI 채팅 (스트리밍 방식: 글자가 실시간으로 하나씩 나옴) ──
  // SSE(Server-Sent Events) = 서버가 데이터를 조금씩 계속 보내주는 방식
  // 사용자가 채팅하면 AI 응답이 타이핑하듯 실시간으로 표시됨
  ipcMain.on('claude:chat-stream', async (event, payload) => {
    const { apiKey, model, messages, system, tools } = payload

    try {
      // Claude API에 스트리밍 모드로 요청 (stream: true가 핵심 차이)
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
          stream: true,  // 스트리밍 활성화 — 응답이 조각조각 들어옴
        }),
      })

      // API 호출 실패 시 화면에 에러 전달
      if (!response.ok) {
        const errorText = await response.text()
        event.sender.send('stream:error', { error: `API ${response.status}: ${errorText}` })
        return
      }

      // 스트리밍 데이터를 읽기 위한 준비
      const reader = (response.body as ReadableStream<Uint8Array>).getReader()
      const decoder = new TextDecoder()  // 바이너리 데이터를 텍스트로 변환
      let buffer = ''  // 아직 처리되지 않은 데이터를 임시 보관

      // 데이터가 끝날 때까지 계속 읽음 (무한 루프)
      while (true) {
        const { done, value } = await reader.read()
        if (done) break  // 서버가 데이터 전송 완료
        buffer += decoder.decode(value, { stream: true })

        // 버퍼에서 줄바꿈(\n) 단위로 데이터를 하나씩 꺼내서 처리
        while (buffer.includes('\n')) {
          const lineEnd = buffer.indexOf('\n')
          const line = buffer.slice(0, lineEnd).trim()
          buffer = buffer.slice(lineEnd + 1)

          // SSE 형식: "data: {...}" 줄만 처리
          if (!line.startsWith('data: ')) continue
          const dataStr = line.slice(6)
          if (dataStr === '[DONE]') continue  // 스트림 종료 신호

          try {
            const json = JSON.parse(dataStr)
            const type = json.type as string

            // ── 스트리밍 이벤트 종류별 처리 ──

            // 1) 새로운 콘텐츠 블록 시작 (텍스트 또는 도구 호출)
            if (type === 'content_block_start') {
              const block = json.content_block
              // AI가 도구(카드 생성, 웹 검색 등)를 사용하기 시작
              if (block?.type === 'tool_use') {
                event.sender.send('stream:tool-start', {
                  index: json.index,
                  id: block.id,
                  name: block.name,
                })
              }
              // text block start — 무시 (delta에서 처리)

            // 2) 콘텐츠 조각(delta)이 들어옴 — 텍스트 한 글자씩 또는 도구 입력값 조각
            } else if (type === 'content_block_delta') {
              const delta = json.delta
              // AI가 타이핑 중인 텍스트 조각 → 화면에 실시간 표시
              if (delta?.type === 'text_delta') {
                event.sender.send('stream:text-delta', { text: delta.text })
              // AI 도구의 입력 파라미터가 JSON 조각으로 들어옴
              } else if (delta?.type === 'input_json_delta') {
                event.sender.send('stream:tool-delta', {
                  index: json.index,
                  json: delta.partial_json,
                })
              }

            // 3) 하나의 콘텐츠 블록 완료
            } else if (type === 'content_block_stop') {
              event.sender.send('stream:tool-end', { index: json.index })

            // 4) 메시지 전체의 상태 변화 (예: 종료 이유 — end_turn, tool_use 등)
            } else if (type === 'message_delta') {
              event.sender.send('stream:message-delta', {
                stopReason: json.delta?.stop_reason,
              })

            // 5) 메시지 완전 종료
            } else if (type === 'message_stop') {
              event.sender.send('stream:end', {})
            }
          } catch {
            // JSON 파싱 실패 — 무시 (간혹 불완전한 데이터가 올 수 있음)
          }
        }
      }

      // 스트림 읽기가 끝났는데 종료 이벤트가 아직 안 갔으면 보냄 (안전장치)
      event.sender.send('stream:end', {})
    } catch (err: unknown) {
      // 네트워크 오류 등 예상치 못한 에러 발생 시 화면에 알림
      const message = err instanceof Error ? err.message : 'Unknown streaming error'
      event.sender.send('stream:error', { error: message })
    }
  })

  // ── 전통자산 시세 (S&P 500, 나스닥, 금, 원유, 달러인덱스) ──
  // Yahoo Finance API를 통해 가져옴
  ipcMain.handle('tradfi:quotes', async () => {
    return fetchTraditionalAssets()
  })

  // ── 웹 검색 (AI가 최신 정보를 찾을 때 사용) ──
  // Tavily API를 통해 실시간 웹 검색 수행
  ipcMain.handle('tavily:search', async (_event, { query, apiKey }) => {
    return searchTavily(query, apiKey)
  })

  // ── 뉴스 피드 관련 ──
  // 암호화폐 뉴스 목록 (CryptoCompare에서 최신 30건)
  ipcMain.handle('feed:cryptonews', async () => fetchCryptoNews())
  // 공포&탐욕 지수 (시장 심리 지표: 0=극도의 공포, 100=극도의 탐욕)
  ipcMain.handle('feed:feargreed', async () => fetchFearGreed())

  // ── 조사 모드(Investigation Mode) API들 ──
  // 코인 클릭 시 상세 분석 화면에서 사용하는 데이터

  // 바이낸스 최근 거래 내역 (체결 데이터)
  ipcMain.handle('binance:trades', async (_event, { symbol, limit }) =>
    fetchRecentTrades(symbol, limit)
  )
  // 여러 코인의 24시간 시세 요약 (가격, 변동률, 거래량)
  ipcMain.handle('binance:multi-ticker', async (_event, { symbols }) =>
    fetchMultipleTickers(symbols)
  )
  // CoinGecko에서 코인 상세 데이터 (시총, 공급량, ATH 등)
  ipcMain.handle('coingecko:coin-data', async (_event, { coinId }) =>
    fetchCoinData(coinId)
  )
  // 코인 심볼(예: BTC)로 CoinGecko ID(예: bitcoin)를 검색
  ipcMain.handle('coingecko:search', async (_event, { symbol }) =>
    searchCoinId(symbol)
  )

  // ── 바이낸스 선물(Futures) 데이터 ──
  // 펀딩비: 롱/숏 비율 지표 (양수=롱 우세, 음수=숏 우세)
  ipcMain.handle('binance-futures:funding', async (_event, { symbol }) =>
    fetchFundingRate(symbol)
  )
  // 미결제약정(Open Interest): 아직 청산되지 않은 선물 계약의 총 규모
  ipcMain.handle('binance-futures:open-interest', async (_event, { symbol }) =>
    fetchOpenInterest(symbol)
  )

  // ── 업비트 김치 프리미엄 ──
  // 한국 거래소(업비트)와 해외 거래소(바이낸스)의 가격 차이(%)를 계산
  ipcMain.handle('upbit:kimchi-premium', async (_event, { symbols }) =>
    fetchKimchiPremium(symbols)
  )

  // ── AI fetch_coin_data 도구 (Phase 3) ──
  // 특정 코인의 종합 데이터 조회 (CoinGecko + Binance + 선물)
  ipcMain.handle('fetch-coin-data', async (_event, query: string, includeFutures: boolean) => {
    return fetchCoinDataForTool(query, includeFutures)
  })

  // ── 심볼 동적 해석 (Phase 3) ──
  // CoinGecko /search API로 아무 코인이든 심볼/이름으로 자동 resolve
  ipcMain.handle('resolve-symbol', async (_event, query: string) => {
    return resolveSymbol(query)
  })
  ipcMain.handle('resolve-multiple-symbols', async (_event, queries: string[]) => {
    const result = await resolveMultipleSymbols(queries)
    return Object.fromEntries(result)
  })

  // ── AI fetch_market_overview 도구 (Phase 3) ──
  // 전체 크립토 시장 상황 종합 (글로벌 메트릭 + 공포탐욕 + Top 상승/하락)
  ipcMain.handle('fetch-market-overview', async () => {
    return fetchMarketOverview()
  })

  // ── AI fetch_derivatives_data 도구 (Phase 3) ──
  // 선물/파생상품 종합 데이터 (펀딩비, OI, 롱숏, 청산 등)
  ipcMain.handle('fetch-derivatives-data', async (_event, symbol: string) => {
    return fetchDerivativesData(symbol)
  })

  // ── AI fetch_trending 도구 (Phase 3) ──
  // 트렌딩 코인, NFT, 카테고리 (CoinGecko /search/trending)
  ipcMain.handle('fetch-trending', async () => {
    return fetchTrending()
  })

  // ── AI fetch_whale_activity 도구 (Phase 3) ──
  // 대형 거래(고래 활동) 탐지 (최근 거래 + 호가벽)
  ipcMain.handle('fetch-whale-activity', async (_event, symbol?: string) => {
    return fetchWhaleActivity(symbol)
  })

  // ── CCXT 멀티 거래소 통합 (Phase 3A-4) ──
  // 6개 거래소(Binance, Upbit, Bybit, Bithumb, OKX, Coinbase) CCXT 기반 통합

  // 특정 거래소의 현재가 조회
  ipcMain.handle('exchange-fetch-ticker', async (_event, exchangeId: string, symbol: string) => {
    const { fetchTickerFromExchange } = await import('./api/exchangeService')
    return fetchTickerFromExchange(exchangeId as Parameters<typeof fetchTickerFromExchange>[0], symbol)
  })

  // 여러 거래소에서 동시 가격 비교
  ipcMain.handle('exchange-compare-prices', async (_event, exchangeIds: string[], symbol: string) => {
    const { fetchTickerFromMultipleExchanges } = await import('./api/exchangeService')
    return fetchTickerFromMultipleExchanges(exchangeIds as Parameters<typeof fetchTickerFromMultipleExchanges>[0], symbol)
  })

  // 김치 프리미엄 계산 (USDT/KRW 환율 기반 정확한 계산)
  ipcMain.handle('exchange-kimchi-premium', async (_event, symbol?: string) => {
    const { fetchKimchiPremiumAccurate } = await import('./api/exchangeService')
    return fetchKimchiPremiumAccurate(symbol)
  })

  // 특정 거래소의 오더북 조회
  ipcMain.handle('exchange-orderbook', async (_event, exchangeId: string, symbol: string, limit?: number) => {
    const { fetchOrderBookFromExchange } = await import('./api/exchangeService')
    return fetchOrderBookFromExchange(exchangeId as Parameters<typeof fetchOrderBookFromExchange>[0], symbol, limit)
  })

  // 지원 거래소 목록 반환
  ipcMain.handle('exchange-list', async () => {
    const { getSupportedExchanges } = await import('./api/exchangeService')
    return getSupportedExchanges()
  })

  // ── CoinMarketCap API (Phase 3A-5) ──
  // CMC 보조 데이터 소스 — API 키가 있을 때만 동작

  // 코인 상세 데이터 (심볼 기반)
  ipcMain.handle('cmc-coin-data', async (_event, apiKey: string, symbol: string) => {
    const { cmcGetCoinData } = await import('./api/cmcApi')
    return cmcGetCoinData(apiKey, symbol)
  })

  // 글로벌 메트릭 (총 시총, BTC/ETH 도미넌스, DeFi, 스테이블코인 등)
  ipcMain.handle('cmc-global-metrics', async (_event, apiKey: string) => {
    const { cmcGetGlobalMetrics } = await import('./api/cmcApi')
    return cmcGetGlobalMetrics(apiKey)
  })

  // 카테고리별 코인 (Top 20 카테고리)
  ipcMain.handle('cmc-categories', async (_event, apiKey: string) => {
    const { cmcGetCategories } = await import('./api/cmcApi')
    return cmcGetCategories(apiKey)
  })

  // 최근 신규 상장 코인 (최신 20개)
  ipcMain.handle('cmc-latest-listings', async (_event, apiKey: string) => {
    const { cmcGetLatestListings } = await import('./api/cmcApi')
    return cmcGetLatestListings(apiKey)
  })

  // ── CCXT Pro 통합 WebSocket (Phase 3A-6) ──
  // 실시간 시세/체결 데이터를 메인 프로세스에서 수신하고 IPC로 렌더러에 전달

  // 실시간 시세 구독 시작 (백그라운드 실행, 즉시 반환)
  ipcMain.handle('exchange-ws-watch-ticker', async (_event, exchangeId: string, symbol: string) => {
    exchangeWsService.watchTicker(exchangeId as Parameters<typeof exchangeWsService.watchTicker>[0], symbol).catch(err => {
      console.error('[IPC] exchange-ws-watch-ticker error:', err)
    })
    return { success: true, watching: `${exchangeId}:${symbol}` }
  })

  // 실시간 대형 체결 구독 시작
  ipcMain.handle('exchange-ws-watch-trades', async (_event, exchangeId: string, symbol: string, minAmount?: number) => {
    exchangeWsService.watchTrades(exchangeId as Parameters<typeof exchangeWsService.watchTrades>[0], symbol, minAmount).catch(err => {
      console.error('[IPC] exchange-ws-watch-trades error:', err)
    })
    return { success: true, watching: `${exchangeId}:${symbol}` }
  })

  // 특정 구독 해제
  ipcMain.handle('exchange-ws-unwatch', async (_event, exchangeId: string, symbol: string, type: string) => {
    exchangeWsService.unwatch(exchangeId, symbol, type as 'ticker' | 'trades')
    return { success: true }
  })

  // 전체 구독 해제
  ipcMain.handle('exchange-ws-unwatch-all', async () => {
    exchangeWsService.unwatchAll()
    return { success: true }
  })

  // 현재 활성 와처 목록 조회
  ipcMain.handle('exchange-ws-active', async () => {
    return exchangeWsService.getActiveWatchers()
  })
}
