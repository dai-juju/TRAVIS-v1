// Zustand — 상태 관리 라이브러리
import { create } from 'zustand'
// 카드 데이터 타입 가져오기
import type { CardData } from '../types'
// 캔버스 저장소 — 현재 캔버스에 있는 카드들을 참조하기 위해
import { useCanvasStore } from './useCanvasStore'
// 실시간 시세 저장소 — 현재 코인 가격을 가져오기 위해
import { useRealtimeStore } from './useRealtimeStore'

// Electron의 IPC 브릿지 — 메인 프로세스의 API 함수들을 호출하기 위한 통로
const api = (window as unknown as { api: Record<string, (...args: unknown[]) => Promise<unknown>> }).api

// 패널 종류 정의 — Investigation 모드에서 사용되는 6가지 패널 유형
// markdown: 텍스트 정보, chart: 차트, news: 뉴스, whale: 고래 거래, onchain: 온체인 데이터, sector: 섹터 비교
export type PanelType = 'markdown' | 'chart' | 'news' | 'whale' | 'onchain' | 'sector'

// Investigation 모드의 개별 패널 상태 정의
export interface PanelState {
  id: string                              // 패널 고유 ID
  title: string                           // 패널 제목 (예: "Overview", "Whale Activity")
  content: string                         // 패널 내용 (마크다운 텍스트)
  tag: 'STREAM' | 'CLAUDE' | 'LOCAL'     // 데이터 출처 표시 (실시간/AI/로컬)
  panelType: PanelType                    // 패널 유형
  isMaximized: boolean                    // 패널이 전체화면인지
  isFolded: boolean                       // 패널이 접혀있는지
  isLoading?: boolean                     // 데이터 로딩 중인지
  error?: string | null                   // 에러 메시지
  data?: unknown                          // 패널에 표시할 원본 데이터
  size?: 'small' | 'normal' | 'large'    // 패널 크기 (large=2col span)
  visible?: boolean                       // 숨김 여부 (false=숨김)
  order?: number                          // 표시 순서
}

// Investigation 모드 저장소의 전체 상태와 기능 정의
interface InvestigationState {
  isOpen: boolean                       // Investigation 모드가 열려있는지
  targetCard: CardData | null           // 조사 대상 카드
  panels: PanelState[]                  // 패널 목록 (기본 6개 + 동적 추가 가능)
  open: (card: CardData) => void        // Investigation 모드 열기
  close: () => void                     // Investigation 모드 닫기
  toggleMaximize: (panelId: string) => void    // 패널 전체화면 토글
  toggleFold: (panelId: string) => void        // 패널 접기/펼치기 토글
  updatePanel: (panelId: string, partial: Partial<PanelState>) => void  // 패널 내용 업데이트
  // 동적 패널 관리 (AI update_investigation 도구용)
  addPanel: (panel: Partial<PanelState>) => void           // 패널 추가
  removePanel: (panelId: string) => void                    // 패널 제거
  reorderPanels: (panelIds: string[]) => void               // 패널 순서 변경
  resetPanels: () => void                                    // 기본 6패널로 리셋
}

// 섹터(분야) 매핑 — 각 코인이 어떤 분야에 속하는지, 같은 분야의 코인이 무엇인지 정의
// 예: BTC → "Store of Value" 분야, ETH → "Smart Contract" 분야
const SECTOR_MAP: Record<string, { name: string; symbols: string[] }> = {
  BTC: { name: 'Store of Value', symbols: ['BTC', 'LTC', 'BCH'] },
  LTC: { name: 'Store of Value', symbols: ['BTC', 'LTC', 'BCH'] },
  BCH: { name: 'Store of Value', symbols: ['BTC', 'LTC', 'BCH'] },
  ETH: { name: 'Smart Contract', symbols: ['ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC'] },
  SOL: { name: 'Smart Contract', symbols: ['ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC'] },
  ADA: { name: 'Smart Contract', symbols: ['ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC'] },
  DOT: { name: 'Smart Contract', symbols: ['ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC'] },
  AVAX: { name: 'Smart Contract', symbols: ['ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC'] },
  MATIC: { name: 'Smart Contract', symbols: ['ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC'] },
  UNI: { name: 'DeFi', symbols: ['UNI', 'AAVE', 'LINK', 'MKR'] },
  AAVE: { name: 'DeFi', symbols: ['UNI', 'AAVE', 'LINK', 'MKR'] },
  LINK: { name: 'DeFi', symbols: ['UNI', 'AAVE', 'LINK', 'MKR'] },
  MKR: { name: 'DeFi', symbols: ['UNI', 'AAVE', 'LINK', 'MKR'] },
  BNB: { name: 'Exchange', symbols: ['BNB', 'CRO', 'OKB'] },
  CRO: { name: 'Exchange', symbols: ['BNB', 'CRO', 'OKB'] },
  OKB: { name: 'Exchange', symbols: ['BNB', 'CRO', 'OKB'] },
  DOGE: { name: 'Meme', symbols: ['DOGE', 'SHIB', 'PEPE'] },
  SHIB: { name: 'Meme', symbols: ['DOGE', 'SHIB', 'PEPE'] },
  PEPE: { name: 'Meme', symbols: ['DOGE', 'SHIB', 'PEPE'] },
  ARB: { name: 'L2', symbols: ['ARB', 'OP'] },
  OP: { name: 'L2', symbols: ['ARB', 'OP'] },
}

// CoinGecko API에서 사용하는 코인 ID 매핑
// 우리 시스템의 심볼(BTC, ETH)과 CoinGecko의 코인 ID(bitcoin, ethereum)를 연결
const SYMBOL_TO_COINGECKO: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  AVAX: 'avalanche-2',
  MATIC: 'matic-network',
  LINK: 'chainlink',
  UNI: 'uniswap',
  LTC: 'litecoin',
  BCH: 'bitcoin-cash',
  SHIB: 'shiba-inu',
  PEPE: 'pepe',
  ARB: 'arbitrum',
  OP: 'optimism',
  AAVE: 'aave',
  MKR: 'maker',
  CRO: 'crypto-com-chain',
  OKB: 'okb',
}

// 코인 카드용 6개 패널 구성 함수
// 코인 심볼이 있는 카드를 Investigation 모드로 열면 이 함수가 패널들을 생성함
// Overview(개요), Chart(차트), News(뉴스), Whale(고래), On-chain(온체인), Sector(섹터) 6개 패널
function buildCoinPanels(card: CardData): PanelState[] {
  const symbol = card.symbol?.toUpperCase() || ''
  // 현재 실시간 시세 데이터를 가져와서 Overview에 가격 정보 표시
  const ticker = useRealtimeStore.getState().tickers[symbol]

  let overviewContent = `## ${card.title}\n\n`
  // 실시간 시세가 있으면 가격, 24시간 변동률, 거래량 등을 표시
  if (ticker) {
    const direction = ticker.change24h >= 0 ? '📈' : '📉'
    overviewContent += `**Price**: $${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}\n\n`
    overviewContent += `**24h Change**: ${direction} ${ticker.change24h >= 0 ? '+' : ''}${ticker.change24h.toFixed(2)}%\n\n`
    overviewContent += `**24h Volume**: ${formatVolume(ticker.volume24h)}\n\n`
    overviewContent += `**24h High**: $${ticker.high24h.toLocaleString()}\n\n`
    overviewContent += `**24h Low**: $${ticker.low24h.toLocaleString()}\n\n`
    overviewContent += `---\n\n`
  }
  overviewContent += card.content

  // 해당 코인의 섹터(분야) 정보 조회
  const sectorInfo = SECTOR_MAP[symbol]
  const sectorTitle = sectorInfo ? `Sector: ${sectorInfo.name}` : 'Sector Compare'

  // 6개 패널을 배열로 반환 — Investigation 모드의 2x3 격자에 표시됨
  return [
    { id: 'overview', title: 'Overview', content: overviewContent, tag: 'STREAM', panelType: 'markdown', isMaximized: false, isFolded: false },        // 코인 개요 + 가격 정보
    { id: 'chart', title: 'Chart', content: '', tag: 'LOCAL', panelType: 'chart', isMaximized: false, isFolded: false, isLoading: false },               // TradingView 차트
    { id: 'news', title: 'News', content: '', tag: 'CLAUDE', panelType: 'news', isMaximized: false, isFolded: false },                                    // 관련 뉴스
    { id: 'whale', title: 'Whale Activity', content: '', tag: 'STREAM', panelType: 'whale', isMaximized: false, isFolded: false, isLoading: true },       // 고래(대규모) 거래 내역
    { id: 'onchain', title: 'On-chain Data', content: '', tag: 'LOCAL', panelType: 'onchain', isMaximized: false, isFolded: false, isLoading: true },      // 온체인(블록체인) 데이터
    { id: 'sector', title: sectorTitle, content: '', tag: 'LOCAL', panelType: 'sector', isMaximized: false, isFolded: false, isLoading: true },            // 같은 분야 코인들과 비교
  ]
}

// 일반 카드용 6개 패널 구성 함수 (코인 심볼이 없는 카드)
// 대상 카드 + 캔버스에 있는 다른 카드들을 교차 참조용으로 패널에 배치
function buildGenericPanels(card: CardData): PanelState[] {
  // 첫 번째 패널은 대상 카드의 내용
  const panels: PanelState[] = [
    { id: 'main', title: card.title, content: card.content, tag: 'LOCAL', panelType: 'markdown', isMaximized: false, isFolded: false },
  ]

  // 캔버스에 있는 다른 카드들을 가져와서 교차 참조 패널로 사용
  const allCards = useCanvasStore.getState().cards.filter(
    (c) => c.id !== card.id && c.type === 'card'
  ) as CardData[]

  // 최대 5개까지 다른 카드를 참조 패널로 추가 (모자이크 이론: 여러 정보를 함께 보기)
  const crossRefCards = allCards.slice(0, 5)
  for (const refCard of crossRefCards) {
    panels.push({
      id: refCard.id,
      title: refCard.title,
      content: refCard.content,
      tag: 'LOCAL',
      panelType: 'markdown',
      isMaximized: false,
      isFolded: false,
    })
  }

  // 패널이 6개 미만이면 빈 패널로 채움
  while (panels.length < 6) {
    panels.push({
      id: `empty-${panels.length}`,
      title: `Panel ${panels.length + 1}`,
      content: '*No additional data available.*',
      tag: 'LOCAL',
      panelType: 'markdown',
      isMaximized: false,
      isFolded: false,
    })
  }

  return panels.slice(0, 6)  // 최대 6개 패널만 반환
}

// 거래량 숫자를 읽기 쉬운 형식으로 변환 (예: 1,500,000,000 → $1.50B)
function formatVolume(vol: number): string {
  if (vol >= 1e9) return '$' + (vol / 1e9).toFixed(2) + 'B'   // 10억 이상 → B(Billion)
  if (vol >= 1e6) return '$' + (vol / 1e6).toFixed(2) + 'M'   // 100만 이상 → M(Million)
  if (vol >= 1e3) return '$' + (vol / 1e3).toFixed(1) + 'K'   // 1천 이상 → K(Thousand)
  return '$' + vol.toFixed(0)
}

// 타임아웃 유틸리티 — API 호출이 지정된 시간(ms) 내에 응답하지 않으면 에러 발생
// 네트워크가 느릴 때 앱이 멈추지 않도록 보호하는 안전장치
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ])
}

// Investigation 모드의 패널 데이터를 외부 API에서 불러오는 비동기 함수
// 고래 거래, 온체인 데이터, 섹터 비교, 선물 데이터를 병렬로 가져옴
async function loadPanelData(symbol: string) {
  // 심볼에서 거래쌍 접미사 제거 (예: BTCUSDT → BTC)
  const clean = symbol.replace(/(USDT|BUSD|FDUSD|USD|KRW|BTC)$/i, '') || symbol
  symbol = clean.toUpperCase()
  const store = useInvestigationStore.getState()
  const sectorInfo = SECTOR_MAP[symbol]
  const TIMEOUT = 10000  // API 응답 타임아웃: 10초

  // === A단계 — CoinGecko 코인 ID 확인 ===
  // 매핑 테이블에 있으면 바로 사용, 없으면 CoinGecko API로 검색
  let coinId: string | null = SYMBOL_TO_COINGECKO[symbol] ?? null
  if (!coinId) {
    try {
      coinId = (await withTimeout(api.searchCoinId(symbol) as Promise<string | null>, 5000)) ?? null
    } catch (err) {
      console.warn('[Investigation] CoinGecko search failed for', symbol, ':', err)
      coinId = null  // 검색 실패 시 null로 설정 → 온체인 데이터 패널 비활성화
    }
  }

  // === B단계 — 3가지 데이터를 동시에(병렬) 가져오기 ===
  // 차트는 TradingView가 별도로 처리하므로 여기서 제외
  try {
    const [tradesResult, coinResult, sectorResult] = await Promise.allSettled([
      withTimeout(
        api.fetchRecentTrades(symbol, 500) as Promise<{ trades: Array<{ quoteQty: string; [key: string]: unknown }>; pair: string }>,
        TIMEOUT
      ),
      coinId
        ? withTimeout(api.fetchCoinData(coinId) as Promise<{ categories?: string[]; [key: string]: unknown }>, TIMEOUT)
        : Promise.reject(new Error('Unknown coin')),
      sectorInfo
        ? withTimeout(api.fetchMultipleTickers(sectorInfo.symbols) as Promise<unknown>, TIMEOUT)
        : Promise.reject(new Error('No sector data')),
    ])

    // 고래(Whale) 패널 — $100,000 이상의 대규모 거래만 필터링하여 표시
    if (tradesResult.status === 'fulfilled') {
      const { trades: allTrades, pair } = tradesResult.value
      const whaleTrades = allTrades.filter((t) => parseFloat(t.quoteQty) >= 100000)
      store.updatePanel('whale', { data: { trades: whaleTrades, pair }, isLoading: false, error: null })
    } else {
      store.updatePanel('whale', { isLoading: false, error: `No trade data for ${symbol}` })
    }

    // 온체인 패널 — CoinGecko에서 가져온 코인의 블록체인 데이터 표시
    if (coinResult.status === 'fulfilled') {
      store.updatePanel('onchain', { data: coinResult.value, isLoading: false, error: null })
    } else {
      store.updatePanel('onchain', { isLoading: false, error: coinId ? `Failed to load on-chain data` : `No CoinGecko data for ${symbol}` })
    }

    // === C단계 — 섹터 패널: 같은 분야 코인들과 비교 ===
    // 섹터 데이터가 없으면 CoinGecko의 카테고리 정보로 대체(fallback)
    if (sectorResult.status === 'fulfilled') {
      store.updatePanel('sector', {
        data: { tickers: sectorResult.value, sectorName: sectorInfo?.name, symbols: sectorInfo?.symbols },
        isLoading: false,
        error: null,
      })
    } else if (!sectorInfo && coinResult.status === 'fulfilled') {
      // 대체 방안(Fallback): 섹터 매핑에 없는 코인은 CoinGecko 카테고리를 사용
      const coinData = coinResult.value as { categories?: string[] }
      const categories = coinData.categories ?? []
      // "ecosystem"이나 "cryptocurrency" 같은 일반적인 카테고리는 건너뛰고 의미 있는 카테고리 선택
      const meaningfulCategory = categories.find(
        (c) => c && !c.toLowerCase().includes('ecosystem') && c.toLowerCase() !== 'cryptocurrency'
      ) || categories[0]

      if (meaningfulCategory) {
        store.updatePanel('sector', {
          title: `Sector: ${meaningfulCategory}`,
          data: { tickers: {}, sectorName: meaningfulCategory, symbols: [], categoryFallback: true },
          isLoading: false,
          error: null,
        })
      } else {
        store.updatePanel('sector', { isLoading: false, error: `No sector mapping for ${symbol}` })
      }
    } else {
      store.updatePanel('sector', { isLoading: false, error: sectorInfo ? 'Failed to load sector data' : `No sector mapping for ${symbol}` })
    }
  } catch (err) {
    console.error('[Investigation] Data fetch failed:', err)
    // 예상치 못한 에러 발생 시 — 모든 로딩 상태를 해제하여 UI가 멈추지 않도록 함
    for (const id of ['whale', 'onchain', 'sector']) {
      const panel = useInvestigationStore.getState().panels.find((p) => p.id === id)
      if (panel?.isLoading) {
        store.updatePanel(id, { isLoading: false, error: `Data unavailable for ${symbol}` })
      }
    }
  }

  // === D단계 — 선물(Futures) 데이터 가져오기 ===
  // 펀딩비, 미결제약정(OI) 등을 Overview 패널 하단에 추가
  // 실패해도 조용히 건너뜀 (선물 데이터는 보조 정보이므로)
  try {
    const [fundingResult, oiResult] = await Promise.allSettled([
      withTimeout(api.fetchFundingRate(symbol) as Promise<{ symbol: string; markPrice: number; lastFundingRate: number; nextFundingTime: number }>, TIMEOUT),
      withTimeout(api.fetchOpenInterest(symbol) as Promise<{ symbol: string; openInterest: number }>, TIMEOUT),
    ])

    // 선물 데이터 섹션 구성 — 펀딩비, 마크 가격, 미결제약정 정보
    let derivSection = ''
    if (fundingResult.status === 'fulfilled' || oiResult.status === 'fulfilled') {
      derivSection = '\n\n---\n\n### Derivatives\n\n'
      if (fundingResult.status === 'fulfilled') {
        const f = fundingResult.value
        const ratePercent = (f.lastFundingRate * 100).toFixed(4)
        const nextTime = new Date(f.nextFundingTime).toLocaleTimeString()
        derivSection += `**Funding Rate**: ${ratePercent}%\n\n`
        derivSection += `**Mark Price**: $${f.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}\n\n`
        derivSection += `**Next Funding**: ${nextTime}\n\n`
      }
      if (oiResult.status === 'fulfilled') {
        const oi = oiResult.value
        derivSection += `**Open Interest**: ${oi.openInterest.toLocaleString()} ${symbol}\n\n`
      }
    }

    // 선물 데이터가 있으면 Overview 패널 내용 끝에 추가
    if (derivSection) {
      const currentStore = useInvestigationStore.getState()
      const overviewPanel = currentStore.panels.find((p) => p.id === 'overview')
      if (overviewPanel) {
        currentStore.updatePanel('overview', { content: overviewPanel.content + derivSection })
      }
    }
  } catch (err) {
    console.warn('[Investigation] Futures data fetch failed:', err)
  }
}

// ====================================================================
// Investigation 저장소 — 카드 심층 분석 모드를 관리하는 금고
// 특정 카드를 클릭해서 "조사(Investigation)"하면 전체 화면 6패널 대시보드가 열림
// 코인 카드: 가격/차트/뉴스/고래/온체인/섹터 패널
// 일반 카드: 해당 카드 + 캔버스의 다른 카드들을 교차 참조
// ====================================================================
export const useInvestigationStore = create<InvestigationState>((set) => ({
  isOpen: false,       // 처음엔 Investigation 모드가 닫혀있음
  targetCard: null,    // 조사 대상 카드 없음
  panels: [],          // 패널 목록 비어있음

  // Investigation 모드 열기 — 카드를 분석 대상으로 설정하고 패널들을 생성
  open: (card) => {
    // 코인 심볼이 있으면 코인 전용 패널, 없으면 일반 패널 생성
    const panels = card.symbol ? buildCoinPanels(card) : buildGenericPanels(card)
    set({ isOpen: true, targetCard: card, panels })
    // 코인 카드인 경우 외부 API에서 상세 데이터를 비동기로 불러옴
    if (card.symbol) {
      loadPanelData(card.symbol.toUpperCase())
    }
  },

  // Investigation 모드 닫기
  close: () => set({ isOpen: false }),

  // 패널 전체화면 토글 — 한 패널을 크게 보면 나머지는 축소됨
  toggleMaximize: (panelId) =>
    set((state) => ({
      panels: state.panels.map((p) =>
        p.id === panelId
          ? { ...p, isMaximized: !p.isMaximized, isFolded: false }
          : { ...p, isMaximized: false }  // 다른 패널들은 전체화면 해제
      ),
    })),

  // 패널 접기/펼치기 토글
  toggleFold: (panelId) =>
    set((state) => ({
      panels: state.panels.map((p) =>
        p.id === panelId
          ? { ...p, isFolded: !p.isFolded, isMaximized: false }
          : p
      ),
    })),

  // 패널 내용 부분 업데이트 — 비동기 데이터 로딩 완료 시 해당 패널의 데이터를 갱신
  updatePanel: (panelId, partial) =>
    set((state) => ({
      panels: state.panels.map((p) =>
        p.id === panelId ? { ...p, ...partial } : p
      ),
    })),

  // === 동적 패널 관리 (AI update_investigation 도구용) ===

  // 패널 추가 — 기존 패널 뒤에 새 패널을 추가
  addPanel: (panel) =>
    set((state) => {
      const newPanel: PanelState = {
        id: panel.id || `custom-${Date.now()}`,
        title: panel.title || 'Custom Panel',
        content: panel.content || '',
        tag: panel.tag || 'CLAUDE',
        panelType: panel.panelType || 'markdown',
        isMaximized: false,
        isFolded: false,
        isLoading: false,
        size: panel.size || 'normal',
        visible: panel.visible !== false,
        order: panel.order ?? state.panels.length,
      }
      return { panels: [...state.panels, newPanel] }
    }),

  // 패널 제거
  removePanel: (panelId) =>
    set((state) => ({
      panels: state.panels.filter((p) => p.id !== panelId),
    })),

  // 패널 순서 변경 — panelIds 배열 순서대로 재배치, 나머지는 뒤에
  reorderPanels: (panelIds) =>
    set((state) => {
      const ordered: PanelState[] = []
      for (const id of panelIds) {
        const panel = state.panels.find((p) => p.id === id)
        if (panel) ordered.push(panel)
      }
      // panelIds에 없는 패널은 뒤에 추가
      for (const panel of state.panels) {
        if (!panelIds.includes(panel.id)) ordered.push(panel)
      }
      return { panels: ordered }
    }),

  // 기본 6패널로 리셋 — targetCard 기반으로 재생성
  resetPanels: () =>
    set((state) => {
      if (!state.targetCard) return state
      const panels = state.targetCard.symbol
        ? buildCoinPanels(state.targetCard)
        : buildGenericPanels(state.targetCard)
      return { panels }
    }),
}))
