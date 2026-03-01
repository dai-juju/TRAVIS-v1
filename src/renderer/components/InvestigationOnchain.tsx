// 코인 온체인 데이터 구조 — 시가총액, 거래량, 공급량, 사상 최고/최저가, 가격 변동률 등
interface CoinData {
  name: string                  // 코인 이름 (예: Bitcoin)
  symbol: string                // 코인 심볼 (예: BTC)
  marketCap: number             // 시가총액
  volume24h: number             // 24시간 거래량
  circulatingSupply: number     // 유통 공급량
  totalSupply: number | null    // 총 공급량
  maxSupply: number | null      // 최대 공급량
  ath: number                   // 사상 최고가 (All-Time High)
  athDate: string               // 사상 최고가 달성 날짜
  atl: number                   // 사상 최저가 (All-Time Low)
  atlDate: string               // 사상 최저가 달성 날짜
  priceChange24h: number        // 24시간 가격 변동률 (%)
  priceChange7d: number         // 7일 가격 변동률 (%)
  priceChange30d: number        // 30일 가격 변동률 (%)
}

// data: 온체인 데이터
interface Props {
  data: CoinData
}

// 큰 금액을 읽기 쉬운 형태로 변환 (예: 1조 → $1.00T, 10억 → $1.00B)
function formatLarge(n: number | null | undefined): string {
  if (n == null) return 'N/A'
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K'
  return '$' + n.toFixed(2)
}

// 공급량 숫자를 읽기 쉬운 형태로 변환 (예: 21000000 → 21.00M)
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

// 가격 변동률 표시 — 상승은 초록, 하락은 빨강으로 표시
function ChangeValue({ value }: { value: number }) {
  const color = value >= 0 ? '#22c55e' : '#ef4444'
  const prefix = value >= 0 ? '+' : ''
  return <span style={{ color }}>{prefix}{value.toFixed(2)}%</span>
}

// 데이터 행 — 왼쪽에 항목명, 오른쪽에 값을 표시하는 단일 행
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-white/[0.03]">
      <span className="text-t4">{label}</span>
      <span className="text-t2">{value}</span>
    </div>
  )
}

// 온체인 데이터 패널 — 심층 분석 모드에서 시가총액, 거래량, 공급량, 최고/최저가, 변동률을 섹션별로 표시
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
