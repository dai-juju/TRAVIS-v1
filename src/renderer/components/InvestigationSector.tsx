// 섹터 내 개별 코인의 시세 요약 데이터
interface TickerSummary {
  price: string     // 현재 가격
  change: string    // 24시간 변동률 (%)
  volume: string    // 24시간 거래량
}

// data: 섹터 데이터 (섹터명, 소속 코인 목록, 각 코인 시세), symbol: 현재 분석 중인 코인
interface Props {
  data: {
    tickers: Record<string, TickerSummary>  // 코인별 시세 데이터
    sectorName: string                       // 섹터 이름 (예: "Layer 1", "DeFi")
    symbols: string[]                        // 섹터에 포함된 코인 심볼 목록
  }
  symbol: string
}

// 거래량 숫자를 읽기 쉬운 형태로 변환 (예: 1,500,000,000 → 1.50B)
function formatVolume(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(0)
}

// 섹터 비교 패널 — 심층 분석 모드에서 같은 섹터 내 다른 코인들과 가격/변동률/거래량을 비교 표시
// 현재 분석 중인 코인은 보라색으로 강조 표시
export default function InvestigationSector({ data, symbol }: Props) {
  if (!data?.tickers || !data?.symbols) {
    return (
      <div className="flex items-center justify-center h-full text-t4 text-xs font-mono">
        No sector data available
      </div>
    )
  }

  const currentSymbol = symbol.toUpperCase()

  return (
    <div className="overflow-y-auto h-full px-2 py-1">
      <div className="text-[10px] font-bold text-pink-400 mb-2 font-rajdhani tracking-wider px-1">
        {data.sectorName?.toUpperCase() ?? 'SECTOR'}
      </div>
      <table className="w-full text-[10px] font-mono">
        <thead>
          <tr className="text-t4 border-b border-white/5">
            <th className="text-left py-1 font-normal">Symbol</th>
            <th className="text-right py-1 font-normal">Price</th>
            <th className="text-right py-1 font-normal">24h Change</th>
            <th className="text-right py-1 font-normal">Volume</th>
          </tr>
        </thead>
        <tbody>
          {data.symbols.map((sym) => {
            const ticker = data.tickers[sym]
            if (!ticker) return null

            const isCurrent = sym === currentSymbol
            const change = parseFloat(ticker.change)
            const changeColor = change >= 0 ? '#22c55e' : '#ef4444'
            const vol = parseFloat(ticker.volume)

            return (
              <tr
                key={sym}
                className="border-b border-white/[0.02]"
                style={{
                  backgroundColor: isCurrent ? 'rgba(168,85,247,0.1)' : undefined,
                }}
              >
                <td className={`py-1.5 ${isCurrent ? 'text-purple-400 font-bold' : 'text-t2'}`}>
                  {sym}
                </td>
                <td className={`py-1.5 text-right ${isCurrent ? 'text-t1 font-bold' : 'text-t2'}`}>
                  ${parseFloat(ticker.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                </td>
                <td className="py-1.5 text-right font-bold" style={{ color: changeColor }}>
                  {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                </td>
                <td className="py-1.5 text-right text-t3">
                  ${formatVolume(vol)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
