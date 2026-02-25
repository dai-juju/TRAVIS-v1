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

interface TickerItemProps {
  symbol: string
  label: string
  price: number | null
  change: number | null
  isCrypto: boolean
}

function TickerItem({ symbol, label, price, change, isCrypto }: TickerItemProps) {
  const addCard = useCanvasStore((s) => s.addCard)

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
    } catch {
      // 실패 시 기존 데이터 유지
    }
  }, [])

  // 크립토 심볼 구독 (BTCUSDT 형식)
  useEffect(() => {
    CRYPTO_TICKERS.forEach(({ symbol }) => subscribe(symbol))
    return () => CRYPTO_TICKERS.forEach(({ symbol }) => unsubscribe(symbol))
  }, [subscribe, unsubscribe])

  // 전통자산 60초 폴링
  useEffect(() => {
    fetchTradFi()
    const interval = setInterval(fetchTradFi, 60_000)
    return () => clearInterval(interval)
  }, [fetchTradFi])

  // 김프 60초 폴링
  const fetchKimchi = useCallback(async () => {
    try {
      const api = (window as any).api
      if (!api?.fetchKimchiPremium) return
      const result = await api.fetchKimchiPremium(['BTC', 'ETH', 'XRP', 'SOL', 'DOGE', 'ADA'])
      if (result) {
        const entries = Object.values(result) as KimchiData[]
        setKimchiData(entries)
      }
    } catch {
      // 실패 시 기존 데이터 유지
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
