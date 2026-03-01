import { useEffect, useState, useCallback } from 'react'
import { useRealtimeStore } from '../stores/useRealtimeStore'
import { useCanvasStore } from '../stores/useCanvasStore'

// 크립토 — Binance WebSocket은 USDT 페어로 구독 필요
const CRYPTO_TICKERS = [
  { symbol: 'BTCUSDT', label: 'BTC' },
  { symbol: 'ETHUSDT', label: 'ETH' },
  { symbol: 'SOLUSDT', label: 'SOL' },
  { symbol: 'BNBUSDT', label: 'BNB' },
  { symbol: 'XRPUSDT', label: 'XRP' },
]

// 전통자산 — placeholder (향후 REST API 연동)
const TRADITIONAL_ASSETS = [
  { symbol: 'SPX', label: 'S&P 500' },
  { symbol: 'NASDAQ', label: 'NASDAQ' },
  { symbol: 'DXY', label: 'DXY' },
  { symbol: 'GOLD', label: 'GOLD' },
  { symbol: 'OIL', label: 'OIL' },
]

// 티커 아이템의 속성 정의
interface TickerItemProps {
  symbol: string    // 자산 심볼 (예: BTCUSDT)
  label: string     // 표시 이름 (예: BTC)
  price: number | null   // 현재 가격
  change: number | null  // 24시간 변동률 (%)
  isCrypto: boolean      // 크립토 자산인지 여부
}

// 개별 티커 아이템 컴포넌트 — 하단 가격 스크롤에서 각 자산 한 칸을 표시
// 클릭하면 해당 자산의 가격 카드를 캔버스에 생성
function TickerItem({ symbol, label, price, change, isCrypto }: TickerItemProps) {
  const addCard = useCanvasStore((s) => s.addCard)

  // 티커 클릭 시 해당 자산의 가격 추적 카드를 캔버스에 새로 생성
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()

    const priceStr = price !== null
      ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: price < 10 ? 4 : 2 })}`
      : 'Loading...'
    const changeStr = change !== null
      ? (change >= 0 ? '+' : '') + change.toFixed(2) + '%'
      : 'N/A'

    addCard({
      type: 'card',
      title: `${label} Price`,
      content: isCrypto
        ? `**${label}** real-time price tracker.\n\nCurrent: ${priceStr}\n24h Change: ${changeStr}`
        : `**${label}** market data.\n\nCurrent: ${priceStr}\nDaily Change: ${changeStr}`,
      cardType: 'price',
      ...(isCrypto ? { symbol } : {}),
      width: 380,
      height: 280,
    })
  }

  const isUp = change !== null && change >= 0
  const isDown = change !== null && change < 0

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 px-3 py-0 whitespace-nowrap cursor-pointer hover:bg-white/[0.03] transition-colors"
    >
      <span className="text-[11px] font-rajdhani font-bold text-t2 tracking-wide">
        {label}
      </span>
      {price !== null ? (
        <>
          <span className="text-[11px] font-mono text-t1">
            ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: price < 10 ? 4 : 2 })}
          </span>
          <span
            className="text-[10px] font-mono font-semibold"
            style={{ color: isUp ? '#22c55e' : isDown ? '#ef4444' : '#475569' }}
          >
            {isUp ? '▲' : isDown ? '▼' : ''}
            {change !== null ? (change >= 0 ? '+' : '') + change.toFixed(2) + '%' : ''}
          </span>
        </>
      ) : (
        <span className="text-[10px] font-mono text-t4">—</span>
      )}
      <span className="text-t4 text-[10px] ml-1">│</span>
    </button>
  )
}

interface KimchiData {
  symbol: string
  premiumPercent: number
}

// 김프(김치 프리미엄) 표시기 — 한국 거래소와 글로벌 거래소 간 가격 차이를 퍼센트로 표시
// 3% 이상이면 빨강(위험), 1% 이상이면 노랑(주의), 그 이하면 초록(정상)
function KimchiIndicator({ data }: { data: KimchiData[] }) {
  if (data.length === 0) return null
  // Show BTC premium as the representative value
  const btcData = data.find((d) => d.symbol === 'BTC') ?? data[0]
  const pct = btcData.premiumPercent
  const color = pct >= 3 ? '#ef4444' : pct >= 1 ? '#f59e0b' : '#22c55e'

  return (
    <div className="flex items-center gap-1.5 px-3 whitespace-nowrap">
      <span className="text-[10px] font-rajdhani font-bold text-t3 tracking-wide">KimPre</span>
      <span className="text-[11px] font-mono font-semibold" style={{ color }}>
        {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
      </span>
      <span className="text-t4 text-[10px] ml-1">│</span>
    </div>
  )
}

// 하단 가격 티커 컴포넌트 — BTC, ETH, SOL 등 주요 자산 가격이 좌우로 무한 스크롤
// 크립토는 바이낸스 WebSocket 실시간, 전통자산은 60초 간격으로 업데이트
export default function PriceTicker() {
  const subscribe = useRealtimeStore((s) => s.subscribe)
  const unsubscribe = useRealtimeStore((s) => s.unsubscribe)
  const tickers = useRealtimeStore((s) => s.tickers)

  // 전통자산 가격 state
  const [tradFiPrices, setTradFiPrices] = useState<
    Record<string, { price: number; change: number } | null>
  >({})

  // 김프 데이터
  const [kimchiData, setKimchiData] = useState<KimchiData[]>([])

  // 전통자산 가격 fetch
  const fetchTradFi = useCallback(async () => {
    try {
      const api = (window as any).api
      if (!api?.getTradFiQuotes) return
      const quotes = await api.getTradFiQuotes()
      if (quotes) setTradFiPrices(quotes)
    } catch (err) {
      console.warn('[PriceTicker] Failed to fetch TradFi quotes:', err)
    }
  }, [])

  // 크립토 심볼 구독 — 바이낸스 WebSocket으로 BTC, ETH 등 실시간 가격 수신 시작
  useEffect(() => {
    CRYPTO_TICKERS.forEach(({ symbol }) => subscribe(symbol))
    return () => CRYPTO_TICKERS.forEach(({ symbol }) => unsubscribe(symbol))
  }, [subscribe, unsubscribe])

  // 전통자산(S&P 500, NASDAQ 등) 60초마다 가격 갱신
  useEffect(() => {
    fetchTradFi()
    const interval = setInterval(fetchTradFi, 60_000)
    return () => clearInterval(interval)
  }, [fetchTradFi])

  // 김치 프리미엄 데이터 60초마다 갱신 — 한국 거래소 vs 글로벌 거래소 가격 차이
  const fetchKimchi = useCallback(async () => {
    try {
      const api = (window as any).api
      if (!api?.fetchKimchiPremium) return
      const result = await api.fetchKimchiPremium(['BTC', 'ETH', 'XRP', 'SOL', 'DOGE', 'ADA'])
      if (result) {
        const entries = Object.values(result) as KimchiData[]
        setKimchiData(entries)
      }
    } catch (err) {
      console.warn('[PriceTicker] Failed to fetch Kimchi premium:', err)
    }
  }, [])

  useEffect(() => {
    fetchKimchi()
    const interval = setInterval(fetchKimchi, 60_000)
    return () => clearInterval(interval)
  }, [fetchKimchi])

  // 티커 항목 생성
  const cryptoItems = CRYPTO_TICKERS.map(({ symbol, label }) => {
    const t = tickers[symbol]
    return {
      symbol,
      label,
      price: t ? t.price : null,
      change: t ? t.change24h : null,
      isCrypto: true,
    }
  })

  const tradFiItems = TRADITIONAL_ASSETS.map((asset) => {
    const q = tradFiPrices[asset.symbol]
    return {
      symbol: asset.symbol,
      label: asset.label,
      price: q ? q.price : null,
      change: q ? q.change : null,
      isCrypto: false,
    }
  })

  return (
    <div className="w-full h-7 bg-void border-t border-white/5 overflow-hidden flex-shrink-0">
      <div className="ticker-track h-full items-center">
        {/* 원본 + 복제본 = 무한 루프 */}
        {[0, 1].map((copy) => (
          <div key={copy} className="flex items-center h-full">
            {cryptoItems.map((item) => (
              <TickerItem
                key={`${copy}-${item.symbol}`}
                symbol={item.symbol}
                label={item.label}
                price={item.price}
                change={item.change}
                isCrypto={item.isCrypto}
              />
            ))}
            <KimchiIndicator key={`${copy}-kimchi`} data={kimchiData} />
            {tradFiItems.map((item) => (
              <TickerItem
                key={`${copy}-${item.symbol}`}
                symbol={item.symbol}
                label={item.label}
                price={item.price}
                change={item.change}
                isCrypto={item.isCrypto}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
