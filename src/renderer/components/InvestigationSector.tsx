interface TickerSummary {
  price: string
  change: string
  volume: string
}

interface Props {
  data: {
    tickers: Record<string, TickerSummary>
    sectorName: string
    symbols: string[]
  }
  symbol: string
}

function formatVolume(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(0)
}

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
