import { useMemo } from 'react'
import { useFeedStore } from '../stores/useFeedStore'
import FeedItem from './FeedItem'

// 코인별 키워드 매핑 — 뉴스 제목에서 관련 코인을 찾기 위한 키워드 목록
// 예: "BTC" → "bitcoin", "btc"로 검색
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

// symbol: 분석 대상 코인 심볼
interface Props {
  symbol: string
}

// 관련 뉴스 패널 — 심층 분석 모드에서 분석 대상 코인과 관련된 뉴스만 필터링하여 표시 (최대 20건)
export default function InvestigationNews({ symbol }: Props) {
  const items = useFeedStore((s) => s.items)

  // 키워드 매칭으로 해당 코인 관련 뉴스를 필터링 (제목 + 요약에서 검색)
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
