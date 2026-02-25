interface CoinData {
  name: string
  symbol: string
  marketCap: number
  volume24h: number
  circulatingSupply: number
  totalSupply: number | null
  maxSupply: number | null
  ath: number
  athDate: string
  atl: number
  atlDate: string
  priceChange24h: number
  priceChange7d: number
  priceChange30d: number
}

interface Props {
  data: CoinData
}

function formatLarge(n: number | null | undefined): string {
  if (n == null) return 'N/A'
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K'
  return '$' + n.toFixed(2)
}

function formatSupply(n: number | null | undefined): string {
  if (n == null) return 'N/A'
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(0)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

function ChangeValue({ value }: { value: number }) {
  const color = value >= 0 ? '#22c55e' : '#ef4444'
  const prefix = value >= 0 ? '+' : ''
  return <span style={{ color }}>{prefix}{value.toFixed(2)}%</span>
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-white/[0.03]">
      <span className="text-t4">{label}</span>
      <span className="text-t2">{value}</span>
    </div>
  )
}

export default function InvestigationOnchain({ data }: Props) {
  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-t4 text-xs font-mono">
        No on-chain data available
      </div>
    )
  }

  return (
    <div className="overflow-y-auto h-full px-3 py-2 text-[11px] font-mono space-y-3">
      {/* Market */}
      <div>
        <div className="text-[10px] font-bold text-purple-400 mb-1 font-rajdhani tracking-wider">MARKET</div>
        <Row label="Market Cap" value={formatLarge(data.marketCap)} />
        <Row label="24h Volume" value={formatLarge(data.volume24h)} />
        <Row label="Circulating Supply" value={formatSupply(data.circulatingSupply)} />
        <Row label="Total Supply" value={formatSupply(data.totalSupply)} />
        <Row label="Max Supply" value={formatSupply(data.maxSupply)} />
      </div>

      {/* Price History */}
      <div>
        <div className="text-[10px] font-bold text-cyan-400 mb-1 font-rajdhani tracking-wider">PRICE HISTORY</div>
        <Row label="All-Time High" value={`$${data.ath.toLocaleString()}`} />
        <Row label="ATH Date" value={formatDate(data.athDate)} />
        <Row label="All-Time Low" value={`$${data.atl.toLocaleString()}`} />
        <Row label="ATL Date" value={formatDate(data.atlDate)} />
      </div>

      {/* Performance */}
      <div>
        <div className="text-[10px] font-bold text-amber-400 mb-1 font-rajdhani tracking-wider">PERFORMANCE</div>
        <Row label="24h Change" value={<ChangeValue value={data.priceChange24h} />} />
        <Row label="7d Change" value={<ChangeValue value={data.priceChange7d} />} />
        <Row label="30d Change" value={<ChangeValue value={data.priceChange30d} />} />
      </div>
    </div>
  )
}
