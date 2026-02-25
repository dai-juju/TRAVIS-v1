interface Props {
  symbol: string
}

export default function InvestigationChart({ symbol }: Props) {
  const tvSymbol = `BINANCE:${symbol}USDT`
  const src = `https://www.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tvSymbol)}&interval=60&theme=dark&style=1&hide_top_toolbar=0&hide_side_toolbar=0&allow_symbol_change=1&save_image=0&withdateranges=1&hide_volume=0&locale=en`

  return (
    <div className="relative w-full h-full">
      <iframe
        src={src}
        title={`${symbol} Chart`}
        style={{ width: '100%', height: '100%', border: 'none' }}
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  )
}
