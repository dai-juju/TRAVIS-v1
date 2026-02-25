import { useEffect, useRef } from 'react'
import { createChart, CandlestickSeries, type IChartApi, type CandlestickData, type Time } from 'lightweight-charts'

interface KlineData {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface Props {
  data: { klines: KlineData[] }
  symbol: string
}

export default function InvestigationChart({ data, symbol }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!containerRef.current || !data?.klines?.length) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#0a0a18' },
        textColor: 'rgba(255,255,255,0.5)',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(168,85,247,0.4)', labelBackgroundColor: '#7c3aed' },
        horzLine: { color: 'rgba(168,85,247,0.4)', labelBackgroundColor: '#7c3aed' },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.05)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.05)',
      },
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    const candleData: CandlestickData<Time>[] = data.klines.map((k) => ({
      time: k.time as Time,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
    }))

    candleSeries.setData(candleData)
    chart.timeScale().fitContent()

    chartRef.current = chart

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        chart.applyOptions({ width, height })
      }
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [data])

  return (
    <div className="relative w-full h-full">
      {/* Label */}
      <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
        <span className="text-[10px] font-mono font-bold text-t2 bg-black/50 px-1.5 py-0.5 rounded">
          {symbol}/USDT — 1H
        </span>
      </div>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
