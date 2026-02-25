export interface CoinData {
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

export function symbolToCoinId(symbol: string): string | null {
  return SYMBOL_TO_COINGECKO[symbol.toUpperCase()] ?? null
}

export async function fetchCoinData(coinId: string): Promise<CoinData> {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`
    const res = await fetch(url, { headers: { 'User-Agent': 'TRAVIS/1.0' } })
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`)

    const data = (await res.json()) as Record<string, unknown>
    const md = data.market_data as Record<string, unknown> | undefined

    if (!md) throw new Error('No market_data in response')

    const usd = (obj: unknown): number => {
      if (obj && typeof obj === 'object' && 'usd' in obj) return Number((obj as Record<string, unknown>).usd) || 0
      return 0
    }

    return {
      name: String(data.name ?? ''),
      symbol: String(data.symbol ?? ''),
      marketCap: usd(md.market_cap),
      volume24h: usd(md.total_volume),
      circulatingSupply: Number(md.circulating_supply) || 0,
      totalSupply: md.total_supply != null ? Number(md.total_supply) : null,
      maxSupply: md.max_supply != null ? Number(md.max_supply) : null,
      ath: usd(md.ath),
      athDate: String((md.ath_date as Record<string, unknown>)?.usd ?? ''),
      atl: usd(md.atl),
      atlDate: String((md.atl_date as Record<string, unknown>)?.usd ?? ''),
      priceChange24h: Number(md.price_change_percentage_24h) || 0,
      priceChange7d: Number(md.price_change_percentage_7d) || 0,
      priceChange30d: Number(md.price_change_percentage_30d) || 0,
    }
  } catch (err) {
    console.error('[coingeckoApi] coin data fetch failed:', err)
    throw err
  }
}
