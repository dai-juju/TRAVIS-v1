// symbol: 코인 심볼 (예: "BTC", "ETH")
interface Props {
  symbol: string
}

// 트레이딩뷰 차트 패널 — 심층 분석 모드에서 해당 코인의 실시간 차트를 트레이딩뷰 위젯으로 표시
// 1시간 봉 차트가 기본, 사용자가 심볼 변경 및 시간 간격 조절 가능
export default function InvestigationChart({ symbol }: Props) {
  // 바이낸스 USDT 페어로 트레이딩뷰 심볼 생성 (예: BINANCE:BTCUSDT)
  const tvSymbol = `BINANCE:${symbol}USDT`
  const src = `https://www.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tvSymbol)}&interval=60&theme=dark&style=1&hide_top_toolbar=0&hide_side_toolbar=0&allow_symbol_change=1&save_image=0&withdateranges=1&hide_volume=0&locale=en`

  return (
    <div className="relative w-full h-full">
      {/* 트레이딩뷰 차트를 iframe으로 임베드 */}
      <iframe
        src={src}
        title={`${symbol} Chart`}
        style={{ width: '100%', height: '100%', border: 'none' }}
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  )
}
