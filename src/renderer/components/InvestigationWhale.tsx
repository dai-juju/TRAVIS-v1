// 개별 대량 거래 데이터 구조
interface TradeData {
  id: number           // 거래 ID
  price: string        // 체결 가격
  qty: string          // 체결 수량
  quoteQty: string     // 거래 금액 (USD 기준)
  time: number         // 거래 시간 (타임스탬프)
  isBuyerMaker: boolean // true면 매도, false면 매수
}

// data: 고래 거래 데이터 (대량 거래 목록과 거래 페어), symbol: 코인 심볼
interface Props {
  data: { trades: TradeData[]; pair?: string }
  symbol: string
}

// 큰 숫자를 간략하게 표시 (예: 1,500,000 → 1.50M)
function formatCompact(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(2)
}

// 타임스탬프를 시:분:초 형식으로 변환
function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

// 고래 거래 패널 — 심층 분석 모드에서 $100K 이상의 대량 거래(고래 거래)를 테이블로 표시
// 시간, 가격, 수량, 금액, 매수/매도 방향을 색상으로 구분하여 보여줌
export default function InvestigationWhale({ data, symbol }: Props) {
  const trades = data?.trades ?? []
  const pair = data?.pair
  const isNonUsdt = pair && !pair.endsWith('USDT')

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-t4 text-xs font-mono">
        No whale trades detected (threshold: $100K)
      </div>
    )
  }

  return (
    <div className="overflow-y-auto h-full px-2 py-1">
      {isNonUsdt && (
        <div className="text-[10px] font-mono text-amber-400/80 bg-amber-400/10 px-2 py-1 rounded mb-1">
          Data from {pair} pair
        </div>
      )}
      <table className="w-full text-[10px] font-mono">
        <thead>
          <tr className="text-t4 border-b border-white/5">
            <th className="text-left py-1 font-normal">Time</th>
            <th className="text-right py-1 font-normal">Price</th>
            <th className="text-right py-1 font-normal">Qty</th>
            <th className="text-right py-1 font-normal">Value</th>
            <th className="text-right py-1 font-normal">Side</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const value = parseFloat(t.quoteQty)
            const isBuy = !t.isBuyerMaker
            return (
              <tr key={t.id} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                <td className="py-1 text-t3">{formatTime(t.time)}</td>
                <td className="py-1 text-right text-t2">${parseFloat(t.price).toLocaleString()}</td>
                <td className="py-1 text-right text-t3">{parseFloat(t.qty).toFixed(4)}</td>
                <td className="py-1 text-right text-t2">${formatCompact(value)}</td>
                <td className="py-1 text-right font-bold" style={{ color: isBuy ? '#22c55e' : '#ef4444' }}>
                  {isBuy ? 'BUY' : 'SELL'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
