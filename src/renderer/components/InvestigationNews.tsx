import { useMemo } from 'react'
import { useFeedStore } from '../stores/useFeedStore'
import FeedItem from './FeedItem'

const COIN_KEYWORDS: Record<string, string[]> = {
  BTC: ['bitcoin', 'btc'],
  ETH: ['ethereum', 'eth', 'ether'],
  SOL: ['solana', 'sol'],
  BNB: ['binance coin', 'bnb'],
  XRP: ['ripple', 'xrp'],
  ADA: ['cardano', 'ada'],
  DOGE: ['dogecoin', 'doge'],
  DOT: ['polkadot', 'dot'],
  AVAX: ['avalanche', 'avax'],
  MATIC: ['polygon', 'matic'],
  LINK: ['chainlink', 'link'],
  UNI: ['uniswap', 'uni'],
  LTC: ['litecoin', 'ltc'],
  BCH: ['bitcoin cash', 'bch'],
  SHIB: ['shiba', 'shib'],
  PEPE: ['pepe'],
  ARB: ['arbitrum', 'arb'],
  OP: ['optimism'],
  AAVE: ['aave'],
  MKR: ['maker', 'mkr'],
  CRO: ['cronos', 'cro'],
  OKB: ['okx', 'okb'],
}

interface Props {
  symbol: string
}

export default function InvestigationNews({ symbol }: Props) {
  const items = useFeedStore((s) => s.items)

  const filteredItems = useMemo(() => {
    const keywords = COIN_KEYWORDS[symbol.toUpperCase()] ?? [symbol.toLowerCase()]
    return items
      .filter((item) => {
        const text = `${item.title} ${item.summary ?? ''}`.toLowerCase()
        return keywords.some((kw) => text.includes(kw))
      })
      .slice(0, 20)
  }, [items, symbol])

  if (filteredItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-t4 text-xs font-mono">
        No related news for {symbol}
      </div>
    )
  }

  return (
    <div className="overflow-y-auto h-full">
      {filteredItems.map((item) => (
        <FeedItem key={item.id} item={item} />
      ))}
    </div>
  )
}
