interface TradeData {
  id: number
  price: string
  qty: string
  quoteQty: string
  time: number
  isBuyerMaker: boolean
}

interface Props {
  data: { trades: TradeData[]; pair?: string }
  symbol: string
}

function formatCompact(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(2)
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

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
