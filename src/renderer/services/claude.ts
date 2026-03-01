// Claude AI와의 통신을 담당하는 핵심 서비스
// 사용자 메시지를 Claude에게 보내고, AI의 응답(텍스트 + 도구 호출)을 처리함

// 타입 정의 가져오기 — AI 도구 호출, API 메시지 형식, 카드 데이터
import type { ToolCall, ApiMessage, ApiContentBlock, CardData } from '../types'
// 캔버스 저장소 — AI가 카드를 생성/삭제/수정할 때 사용
import { useCanvasStore } from '../stores/useCanvasStore'
// Investigation 저장소 — AI가 Investigation 모드를 열 때 사용
import { useInvestigationStore } from '../stores/useInvestigationStore'
// 채팅 저장소 — AI 응답 메시지를 저장하고 스트리밍 상태를 관리
import { useChatStore } from '../stores/useChatStore'
import { soundService } from './soundService'
import { webviewRefs } from '../components/WebviewCard'

// 멀티턴 도구 호출 루프의 최대 라운드 수 (무한 루프 방지)
const MAX_TOOL_TURNS = 25
const SSE_TIMEOUT_MS = 60000   // SSE 스트리밍 이벤트 대기 최대 시간 (60초)
const TOOL_TIMEOUT_MS = 30000  // 개별 도구 실행 최대 시간 (30초)

// --- 시스템 프롬프트 (AI에게 "너는 누구이고 뭘 해야 하는지" 알려주는 지시문) ---
const BASE_SYSTEM_PROMPT = `You are TRAVIS, an AI assistant that helps users analyze cryptocurrency markets.
When the user asks anything, you should:
1. Understand their intent
2. Use your tools to spawn relevant information cards and websites on the canvas
3. Provide a brief text summary in chat

You can spawn multiple cards at once. Be generous with visual information.
Always think about what data would help the user understand the topic better.
Include relevant images, charts, and visual data in cards when helpful.
When spawning coin-related cards, always include the symbol parameter so they receive real-time price updates.

IMPORTANT — Symbol Field Rules:
When using spawn_card tool, the 'symbol' field must be the BASE symbol only, without any quote currency suffix. Examples:
- User says 'BTCUSDT 분석' → symbol: 'BTC' (not 'BTCUSDT')
- User says 'TRIAUSDT' → symbol: 'TRIA'
- User says '이더리움' → symbol: 'ETH'
- User says 'ETHBTC' → symbol: 'ETH'
- User says '비트코인' → symbol: 'BTC'
Never include USDT, BTC, BUSD, USD, KRW or any quote currency in the symbol field.

IMPORTANT — Card Connections:
When you spawn multiple related cards, use the relatedTo field to link them together.
The first card you spawn has no relatedTo. After it is spawned, you receive its cardId in the tool result.
Subsequent related cards should include relatedTo: [previousCardId] using that ID.
This creates visual connection lines between cards on the canvas, helping users see relationships.
Always link related cards — for example, if you spawn a BTC analysis card and then a BTC news card, the news card should reference the analysis card's ID.

CRITICAL — Web Search:
You MUST use the search_web tool when the user asks about recent news, current events, latest updates, or any time-sensitive information. Do NOT answer from memory for these topics — always search first, then answer based on results. You have the search_web tool available. Never say "I cannot search the web" or "I don't have access to current information" — you DO have search access. Use it proactively.

[CANVAS VISUALIZATION RULES]
You have data tools (fetch_coin_data, search_web, etc.) AND display tools (spawn_card, spawn_webview).
After retrieving data with a data tool, you MUST use display tools to show it on the canvas.

CRITICAL RULES:
1. NEVER just say "I'll show you" or "띄워드리겠습니다" — actually call spawn_card or spawn_webview.
2. When user asks for analysis, ALWAYS spawn at least one card with the analysis content.
3. When you have real-time data from fetch_coin_data, include the key metrics (price, change%, market cap) in the card content.
4. When relevant, also spawn a TradingView webview: spawn_webview with url "https://www.tradingview.com/chart/?symbol=BINANCE:{SYMBOL}USDT"
5. For comprehensive analysis, spawn multiple cards: one for analysis, one for news summary, one for chart webview.
6. NEVER respond with only text when the user asks you to show, display, analyze, or 분석 something — always create visual cards.
7. When spawning 3 or more related cards at once, prefer spawn_multiple_cards over calling spawn_card multiple times. It automatically handles grid layout and card connections. Use it for comprehensive analysis, comparisons, and multi-source information displays.

[TOOL EFFICIENCY RULES]
Do NOT call remove_cards("all") unless the user explicitly asks to clear the canvas. New cards should be ADDED alongside existing ones.
When using fetch_market_overview, it already includes top gainers/losers data. Do NOT separately call fetch_coin_data for BTC/ETH just to get prices — the overview already has that.
Minimize redundant tool calls. Plan your tool usage: gather data in 2-3 calls maximum, then use spawn_multiple_cards to display everything at once.
search_web should be called at most once per user request unless the user specifically asks for more research.
ALWAYS reserve enough turns for spawn_multiple_cards. Data without visualization is useless.
Priority order: 1) Fetch essential data (1-2 calls) → 2) spawn_multiple_cards with all results → 3) Optional: additional search if user wants more

Remember: The canvas IS the main interface. Text chat is secondary. Users expect to SEE information on the canvas, not just read it in chat.

Respond in the same language the user uses.`

// --- AI 도구 정의 (Claude가 호출할 수 있는 7가지 도구) ---
// AI가 사용자 질문에 답할 때 이 도구들을 사용하여 캔버스에 카드 생성, 웹사이트 임베드 등을 수행
const TOOLS = [
  {
    // 도구 1: 정보 카드 생성 — AI가 분석 결과를 카드로 만들어 캔버스에 표시
    name: 'spawn_card',
    description:
      'Create an information card on the canvas. Use this to display analysis, data, summaries, comparisons, news, or price information. When spawning multiple related cards, link them using the relatedTo field with IDs from previously spawned cards.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Card header text' },
        content: {
          type: 'string',
          description: 'Card body content in Markdown format',
        },
        cardType: {
          type: 'string',
          enum: ['analysis', 'data', 'summary', 'comparison', 'news', 'price'],
          description: 'Type of card for styling',
        },
        symbol: {
          type: 'string',
          description:
            'Base trading symbol only (no quote currency). e.g. BTC, ETH, SOL, TRIA',
        },
        width: {
          type: 'number',
          description: 'Card width in pixels (default: 380)',
        },
        height: {
          type: 'number',
          description: 'Card height in pixels (default: auto)',
        },
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'Image URL' },
              caption: { type: 'string', description: 'Image caption' },
            },
            required: ['url'],
          },
          description: 'Optional images to display in the card',
        },
        relatedTo: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of card IDs that this card is related to. When spawning multiple cards about the same topic, link them together using this field. Use the cardId returned from previous spawn_card tool results.',
        },
      },
      required: ['title', 'content'],
    },
  },
  {
    // 도구 2: 웹사이트 임베드 — 차트, 거래소, 분석 플랫폼 등을 캔버스에 직접 표시
    name: 'spawn_webview',
    description:
      'Embed a website on the canvas. Use for charts, exchanges, analytics platforms, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'Full URL to embed' },
        title: { type: 'string', description: 'Display title for the webview' },
        width: {
          type: 'number',
          description: 'Width in pixels (default: 900)',
        },
        height: {
          type: 'number',
          description: 'Height in pixels (default: 700)',
        },
      },
      required: ['url', 'title'],
    },
  },
  {
    // 도구 3: 카드 삭제 — 특정 카드 또는 전체 카드를 캔버스에서 제거
    name: 'remove_cards',
    description: 'Remove cards from the canvas.',
    input_schema: {
      type: 'object' as const,
      properties: {
        target: {
          type: 'string',
          description: '"all" to remove all cards, or a specific card ID',
        },
      },
      required: ['target'],
    },
  },
  {
    // 도구 4: 카드 재배치 — 격자형(grid) 또는 세로형(stack)으로 정렬
    name: 'rearrange',
    description: 'Rearrange all cards on the canvas in a layout.',
    input_schema: {
      type: 'object' as const,
      properties: {
        layout: {
          type: 'string',
          enum: ['grid', 'stack'],
          description: 'Layout style',
        },
      },
      required: ['layout'],
    },
  },
  {
    // 도구 5: 카드 내용 수정 — 기존 카드의 텍스트를 새 내용으로 교체
    name: 'update_card',
    description: 'Update the content of an existing card on the canvas.',
    input_schema: {
      type: 'object' as const,
      properties: {
        cardId: {
          type: 'string',
          description: 'ID of the card to update',
        },
        content: {
          type: 'string',
          description: 'New content in Markdown format',
        },
      },
      required: ['cardId', 'content'],
    },
  },
  {
    // 도구 6: Investigation 모드 열기 — 특정 카드를 전체화면 6패널로 심층 분석
    name: 'open_investigation',
    description:
      'Open Investigation Mode for a specific card — a full-screen 6-panel analysis dashboard.',
    input_schema: {
      type: 'object' as const,
      properties: {
        cardId: {
          type: 'string',
          description: 'ID of the card to investigate',
        },
      },
      required: ['cardId'],
    },
  },
  {
    // 도구 7: 웹 검색 — Tavily API를 통해 실시간 뉴스/정보를 인터넷에서 검색
    name: 'search_web',
    description:
      'Search the web for current information, news, events, or data. Use this when you need up-to-date information that you may not have in your training data.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
      },
      required: ['query'],
    },
  },
  {
    // 도구 8: 코인 데이터 조회 — 실시간 시세 + 시총 + ATH + 공급량 + 선물 데이터
    name: 'fetch_coin_data',
    description:
      '특정 코인의 실시간 시세, 시가총액, 거래량, ATH, 공급량, 카테고리 등 종합 데이터를 조회합니다. 코인 분석, 가격 확인, 시장 데이터가 필요할 때 반드시 이 도구를 먼저 사용하세요. 심볼(BTC, ETH), 이름(bitcoin, vana), 한국어(비트코인)로 검색 가능합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: '코인 심볼, 이름, 또는 한국어명 (예: BTC, bitcoin, 비트코인, vana)',
        },
        include_futures: {
          type: 'boolean',
          description: '선물 데이터(펀딩비, OI) 포함 여부. 선물 관련 질문일 때 true로 설정.',
        },
      },
      required: ['query'],
    },
  },
  {
    // 도구 10: 여러 카드/웹뷰 동시 생성 — 종합 분석, 비교, 멀티 소스 정보 표시
    name: 'spawn_multiple_cards',
    description:
      '여러 카드와 웹뷰를 한 번에 동시 생성합니다. 종합 분석, 비교, 멀티 소스 정보를 보여줄 때 사용하세요. 개별 spawn_card를 여러 번 호출하는 대신 이 도구 하나로 한번에 생성합니다. 카드들은 자동으로 그리드 배치되고 연결선이 생깁니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        cards: {
          type: 'array',
          description: '생성할 카드 목록',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: '카드 제목' },
              content: { type: 'string', description: '카드 내용 (마크다운 지원)' },
              cardType: {
                type: 'string',
                description: '카드 타입: analysis, data, summary, comparison, news, price',
                enum: ['analysis', 'data', 'summary', 'comparison', 'news', 'price'],
              },
              symbol: { type: 'string', description: '코인 심볼 (실시간 데이터 구독용, 선택)' },
            },
            required: ['title', 'content'],
          },
        },
        webviews: {
          type: 'array',
          description: '생성할 웹뷰 목록 (선택)',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string', description: '웹페이지 URL' },
              title: { type: 'string', description: '웹뷰 제목' },
            },
            required: ['url', 'title'],
          },
        },
      },
      required: ['cards'],
    },
  },
  {
    // 도구 11: 선물/파생상품 종합 데이터 — 펀딩비, OI, 롱숏, 청산
    name: 'fetch_derivatives_data',
    description:
      '선물/파생상품 시장의 종합 데이터를 조회합니다: 펀딩비, 미결제약정(OI), 글로벌 롱숏 비율, 탑트레이더 롱숏, 테이커 매수/매도 비율, OI 추이, 최근 청산 내역. 선물, 파생상품, 펀딩비, OI, 롱숏, 청산 관련 질문에 이 도구를 사용하세요.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: '코인 심볼 (예: BTC, ETH, SOL)' },
      },
      required: ['symbol'],
    },
  },
  {
    // 도구 12: 트렌딩 — 검색량 급증 코인, NFT, 카테고리
    name: 'fetch_trending',
    description:
      '현재 트렌딩 코인, NFT, 카테고리를 조회합니다. 검색량이 급증하고 있는 코인 목록을 반환합니다. "요즘 뭐가 핫해?", "트렌딩", "핫한 코인" 등의 질문에 사용하세요.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    // 도구 13: 대형 거래(고래 활동) 탐지 — 대형 체결, 매수/매도벽
    name: 'fetch_whale_activity',
    description:
      '대형 거래(고래 활동)를 탐지합니다. 최근 대형 체결 내역, 매수/매도 비율, 호가벽(orderbook walls) 정보를 제공합니다. "고래가 뭐 하고 있어?", "대형 거래", "매수벽/매도벽", "큰손 동향" 등의 질문에 사용하세요.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: '코인 심볼 (예: BTC, ETH, SOL). 미지정 시 BTC 기본값.',
        },
      },
      required: [],
    },
  },
  {
    // 도구 14: 특정 거래소 가격 조회 — CCXT 기반 6개 거래소 지원
    name: 'fetch_exchange_price',
    description:
      '특정 거래소의 실시간 가격을 조회합니다. 거래소별 가격 비교, 특정 거래소 기준 시세 확인에 사용하세요. 지원 거래소: binance, upbit, bybit, bithumb, okx, coinbase',
    input_schema: {
      type: 'object' as const,
      properties: {
        exchange: {
          type: 'string',
          description: '거래소 ID (binance, upbit, bybit, bithumb, okx, coinbase)',
          enum: ['binance', 'upbit', 'bybit', 'bithumb', 'okx', 'coinbase'],
        },
        symbol: {
          type: 'string',
          description: '거래 페어 (예: BTC/USDT, ETH/KRW, SOL/USDT). 업비트/빗썸은 /KRW, 나머지는 /USDT 기본',
        },
      },
      required: ['exchange', 'symbol'],
    },
  },
  {
    // 도구 15: 거래소 간 가격 비교 — 멀티 거래소 동시 조회 + 김치 프리미엄
    name: 'compare_exchange_prices',
    description:
      '여러 거래소의 가격을 동시에 비교합니다. 김치 프리미엄, 거래소 간 가격 차이, 차익거래 기회 탐색에 사용하세요. mode="kimchi"로 한국 프리미엄을 자동 계산합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: '코인 심볼 (예: BTC, ETH, SOL)',
        },
        mode: {
          type: 'string',
          description: '"compare" = 여러 거래소 가격 비교, "kimchi" = 김치 프리미엄 계산',
          enum: ['compare', 'kimchi'],
        },
        exchanges: {
          type: 'array',
          items: { type: 'string' },
          description: '비교할 거래소 목록 (mode=compare일 때). 미지정 시 전체 6개 거래소',
        },
      },
      required: ['symbol'],
    },
  },
  {
    // 도구 9: Investigation Mode 동적 패널 관리 — 패널 추가/제거/수정/순서변경
    name: 'update_investigation',
    description:
      'Investigation Mode의 패널을 동적으로 수정합니다. 패널 추가, 제거, 크기 변경, 내용 업데이트가 가능합니다. Investigation Mode가 열려있을 때만 사용하세요.',
    input_schema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          description: '수행할 작업',
          enum: ['add_panel', 'remove_panel', 'update_panel', 'reorder_panels', 'reset_panels'],
        },
        panelId: {
          type: 'string',
          description: '대상 패널 ID (add_panel, remove_panel, update_panel에서 사용)',
        },
        panel: {
          type: 'object',
          description: '패널 데이터 (add_panel, update_panel에서 사용)',
          properties: {
            type: { type: 'string', enum: ['price', 'chart', 'news', 'onchain', 'futures', 'sector', 'custom'] },
            title: { type: 'string' },
            content: { type: 'string', description: '커스텀 패널의 마크다운 내용' },
            size: { type: 'string', enum: ['normal', 'large', 'small'] },
          },
        },
        panelIds: {
          type: 'array',
          items: { type: 'string' },
          description: '패널 순서 (reorder_panels에서 사용)',
        },
      },
      required: ['action'],
    },
  },
  {
    // 도구 17: 웹뷰 조작 — URL 변경, 크기 조절, TradingView 차트 제어
    name: 'control_webview',
    description:
      '캔버스의 웹뷰 카드를 조작합니다. URL 변경(네비게이션), 크기 조절, TradingView 차트 심볼/인터벌 변경이 가능합니다. [OPEN WEBVIEWS]에 표시된 웹뷰 ID를 사용하세요.',
    input_schema: {
      type: 'object' as const,
      properties: {
        webviewId: {
          type: 'string',
          description: '조작할 웹뷰 카드의 ID ([OPEN WEBVIEWS] 참조)',
        },
        action: {
          type: 'string',
          description: '수행할 작업',
          enum: ['navigate', 'resize', 'tv_change_symbol', 'tv_change_interval'],
        },
        url: {
          type: 'string',
          description: 'navigate 액션에서 이동할 URL',
        },
        width: {
          type: 'number',
          description: 'resize 액션에서 새 너비 (px)',
        },
        height: {
          type: 'number',
          description: 'resize 액션에서 새 높이 (px)',
        },
        symbol: {
          type: 'string',
          description: 'tv_change_symbol 액션에서 새 심볼 (예: BINANCE:BTCUSDT)',
        },
        interval: {
          type: 'string',
          description: 'tv_change_interval 액션에서 새 인터벌 (1, 5, 15, 60, 240, D, W, M)',
        },
      },
      required: ['webviewId', 'action'],
    },
  },
  {
    // 도구 10: 시장 전체 상황 조회 — 글로벌 시총, BTC 도미넌스, 공포탐욕, Top 상승/하락
    name: 'fetch_market_overview',
    description:
      '전체 크립토 시장 상황을 종합 조회합니다. 총 시가총액, BTC/ETH 도미넌스, 24h 거래량, 공포탐욕 지수, Top 5 상승/하락 코인을 한 번에 가져옵니다. 시장 전체 분석, 시장 심리, 시장 현황, "시장 어때?", "지금 분위기" 같은 질문에 반드시 이 도구를 먼저 사용하세요.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
]

// --- 대화 기록 (Claude API 전송용, 화면 표시용 메시지와 별도로 관리) ---
// AI가 이전 대화 맥락을 기억하기 위해 전체 대화를 보관
let conversationHistory: ApiMessage[] = []

// 시스템 프롬프트를 구성하는 함수 — AI에게 현재 상황 정보를 함께 전달
// 사용자 컨텍스트, 실시간 시세, 캔버스 상태, 참조 카드 등을 포함
function buildSystemPrompt(
  contextPrompt: string,
  canvasCards: Array<{ id: string; title: string; type: string; liveTitle?: string; liveUrl?: string }>,
  marketData?: string,
  focusedCard?: { title: string; content: string }
): string {
  let prompt = BASE_SYSTEM_PROMPT

  // 사용자가 설정한 맞춤 컨텍스트 추가 (예: "나는 BTC 롱 포지션 중")
  if (contextPrompt) {
    prompt += `\n\n[USER CONTEXT]\n${contextPrompt}`
  }

  // 사용자가 언급한 코인의 실시간 시세 데이터 추가
  if (marketData) {
    prompt += `\n\n[REAL-TIME MARKET DATA]\n${marketData}`
  }

  // 현재 캔버스에 있는 카드 목록을 AI에게 알려줌 (AI가 기존 카드를 참조/수정 가능)
  if (canvasCards.length > 0) {
    const list = canvasCards
      .map((c) => `- ${c.title} (${c.type}, id: ${c.id})`)
      .join('\n')
    prompt += `\n\n[CURRENT CANVAS STATE]\n${list}`
  } else {
    prompt += '\n\n[CURRENT CANVAS STATE]\nCanvas is empty.'
  }

  // 열린 웹뷰의 현재 페이지 정보를 AI에게 전달 (AI가 웹뷰 내용을 인식)
  const webviews = canvasCards.filter(
    (c) => c.type === 'webview' && (c.liveTitle || c.liveUrl)
  )
  if (webviews.length > 0) {
    prompt += `\n\n[OPEN WEBVIEWS]\n` + webviews.map((wv) =>
      `- "${wv.liveTitle || wv.title}" — ${wv.liveUrl || ''} (id: ${wv.id})`
    ).join('\n')
    prompt += `\nYou can use control_webview to manipulate these webviews:
- navigate: Change URL to load a different page (action: navigate, url: "https://...")
- resize: Change webview size (action: resize, width/height in px)
- tv_change_symbol: Change TradingView chart symbol (action: tv_change_symbol, symbol: "BINANCE:ETHUSDT")
- tv_change_interval: Change TradingView chart timeframe (action: tv_change_interval, interval: "D")
Use the webview id from [OPEN WEBVIEWS] list above.`
  }

  // Investigation Mode가 열려있으면 AI에게 현재 패널 상태를 알려줌
  const investigationState = useInvestigationStore.getState()
  if (investigationState.isOpen && investigationState.targetCard) {
    const panelList = investigationState.panels
      .filter((p) => p.visible !== false)
      .map((p) => `- ${p.id}: "${p.title}" (${p.panelType}${p.size === 'large' ? ', large' : ''})`)
      .join('\n')
    prompt += `\n\n[INVESTIGATION MODE — ACTIVE]
Target: ${investigationState.targetCard.symbol || investigationState.targetCard.title}
Panels:\n${panelList}
You can use update_investigation to customize the panel layout:
- Add custom analysis panels with your insights (action: add_panel)
- Remove panels that don't apply, e.g. futures panel for coins without futures (action: remove_panel)
- Update panel content or resize important panels to 'large' for emphasis (action: update_panel)
- Only use this tool when Investigation Mode is active.`
  }

  // 사용자가 특정 카드를 클릭(포커스)한 경우 해당 카드의 내용을 AI에게 전달
  // → AI가 그 카드에 대한 질문에 맥락 있게 답변할 수 있음
  if (focusedCard) {
    // 내용이 너무 길면 2000자까지만 전달 (API 비용 절약)
    const truncated = focusedCard.content.length > 2000
      ? focusedCard.content.slice(0, 2000) + '...'
      : focusedCard.content
    prompt += `\n\n[FOCUSED CARD CONTEXT]\nThe user is currently referencing a card titled "${focusedCard.title}". Answer their question in relation to this card's content:\n${truncated}`
  }

  return prompt
}

// --- 도구 실행 ---
// AI가 도구를 호출하면 이 함수가 실제로 해당 동작을 수행함
let spawnIndex = 0              // 카드 생성 순서 (연속 생성 시 애니메이션 딜레이 계산용)
let currentTavilyApiKey = ''    // 현재 세션의 Tavily 웹 검색 API 키
let currentCmcApiKey = ''       // 현재 세션의 CoinMarketCap API 키

// AI가 호출한 도구를 실제로 실행하는 함수
// 도구 이름과 입력값을 받아서 해당 동작을 수행하고 결과를 반환
async function executeTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<string> {
  const store = useCanvasStore.getState()

  switch (toolName) {
    // 카드 생성 도구 실행
    case 'spawn_card': {
      // Phase 1: 스켈레톤 카드 즉시 생성 (빈 프레임이 캔버스에 나타남)
      const id = store.addCard({
        title: (input.title as string) || 'Card',
        content: '',
        isLoading: true,
        cardType: input.cardType as string | undefined,
        symbol: input.symbol as string | undefined,
        width: (input.width as number) || 380,
        height: (input.height as number) || 280,
        images: input.images as Array<{ url: string; caption?: string }> | undefined,
        spawnDelay: spawnIndex * 0.15,
        type: 'card',
      })
      spawnIndex++

      // Phase 2: 짧은 딜레이 후 실제 콘텐츠로 채움 (스켈레톤 → 콘텐츠 전환)
      await new Promise(r => setTimeout(r, 100))
      useCanvasStore.getState().updateCard(id, {
        content: (input.content as string) || '',
        isLoading: false,
      })
      soundService.playCardSpawn()

      // 관련 카드가 지정된 경우 연결선(엣지) 자동 생성 — 모자이크 이론 시각화
      const relatedTo = input.relatedTo as string[] | undefined
      if (relatedTo && relatedTo.length > 0) {
        const latestStore = useCanvasStore.getState()
        for (const targetId of relatedTo) {
          const targetExists = latestStore.cards.some((c) => c.id === targetId)
          if (targetExists) {
            latestStore.addEdge(id, targetId, 'weak')
          }
        }
      }

      return JSON.stringify({ status: 'spawned', cardId: id })
    }

    // 웹사이트 임베드 도구 실행
    case 'spawn_webview': {
      const id = store.addWebview({
        url: (input.url as string) || '',
        title: (input.title as string) || 'Webview',
        width: (input.width as number) || 600,
        height: (input.height as number) || 450,
        type: 'webview',
      })
      return JSON.stringify({ status: 'spawned', cardId: id })
    }

    // 카드 삭제 도구 실행
    case 'remove_cards': {
      const target = input.target as string
      console.log('[TRAVIS] remove_cards called — target:', target)
      if (target === 'all') {  // 'all'이면 전체 삭제
        store.removeAllCards()
      } else {
        store.removeCard(target)
      }
      return JSON.stringify({ status: 'removed' })
    }

    // 카드 재배치 도구 실행
    case 'rearrange': {
      const layout = input.layout as 'grid' | 'stack'
      store.rearrangeCards(layout)
      return JSON.stringify({ status: 'rearranged' })
    }

    // 카드 내용 수정 도구 실행
    case 'update_card': {
      const cardId = input.cardId as string
      const content = input.content as string
      store.updateCardContent(cardId, content)
      return JSON.stringify({ status: 'updated', cardId })
    }

    // Investigation 모드 열기 도구 실행
    case 'open_investigation': {
      const cardId = input.cardId as string
      const card = store.cards.find((c) => c.id === cardId && c.type === 'card') as CardData | undefined
      if (card) {
        useInvestigationStore.getState().open(card)
        return JSON.stringify({ status: 'opened', cardId })
      }
      return JSON.stringify({ status: 'error', message: 'Card not found' })
    }

    // Investigation 패널 동적 관리 도구 실행
    case 'update_investigation': {
      const action = input.action as string
      const panelId = input.panelId as string | undefined
      const panel = input.panel as Record<string, unknown> | undefined
      const panelIds = input.panelIds as string[] | undefined
      const investigationStore = useInvestigationStore.getState()

      if (!investigationStore.isOpen) {
        return JSON.stringify({ error: 'Investigation Mode is not open. Use open_investigation first.' })
      }

      try {
        switch (action) {
          case 'add_panel': {
            const newPanel: Partial<import('../stores/useInvestigationStore').PanelState> = {
              id: panelId || `custom-${Date.now()}`,
              title: (panel?.title as string) || 'Custom Panel',
              content: (panel?.content as string) || '',
              panelType: ((panel?.type as string) || 'markdown') as import('../stores/useInvestigationStore').PanelType,
              size: (panel?.size as 'normal' | 'large' | 'small') || 'normal',
              tag: 'CLAUDE',
            }
            investigationStore.addPanel(newPanel)
            return JSON.stringify({ success: true, action: 'panel_added', panelId: newPanel.id })
          }
          case 'remove_panel': {
            if (!panelId) return JSON.stringify({ error: 'panelId is required for remove_panel' })
            investigationStore.removePanel(panelId)
            return JSON.stringify({ success: true, action: 'panel_removed', panelId })
          }
          case 'update_panel': {
            if (!panelId) return JSON.stringify({ error: 'panelId is required for update_panel' })
            const updates: Partial<import('../stores/useInvestigationStore').PanelState> = {}
            if (panel?.title) updates.title = panel.title as string
            if (panel?.content) updates.content = panel.content as string
            if (panel?.size) updates.size = panel.size as 'normal' | 'large' | 'small'
            if (panel?.type) updates.panelType = panel.type as import('../stores/useInvestigationStore').PanelType
            investigationStore.updatePanel(panelId, updates)
            return JSON.stringify({ success: true, action: 'panel_updated', panelId })
          }
          case 'reorder_panels': {
            if (!panelIds) return JSON.stringify({ error: 'panelIds is required for reorder_panels' })
            investigationStore.reorderPanels(panelIds)
            return JSON.stringify({ success: true, action: 'panels_reordered' })
          }
          case 'reset_panels': {
            investigationStore.resetPanels()
            return JSON.stringify({ success: true, action: 'panels_reset' })
          }
          default:
            return JSON.stringify({ error: `Unknown action: ${action}` })
        }
      } catch (error) {
        return JSON.stringify({ error: `Investigation update failed: ${error}` })
      }
    }

    // 웹 검색 도구 실행 — Tavily API를 통해 실시간 인터넷 검색
    case 'search_web': {
      const query = input.query as string
      console.log('[TRAVIS] search_web called — query:', query, '| apiKey set:', !!currentTavilyApiKey)
      const api = (window as any).api
      if (!api?.searchWeb) {
        return JSON.stringify({ status: 'error', message: 'Search bridge not available' })
      }
      const result = await api.searchWeb(query, currentTavilyApiKey)
      console.log('[TRAVIS] search_web result length:', typeof result === 'string' ? result.length : 0)
      return JSON.stringify({ status: 'success', results: result })
    }

    // 여러 카드/웹뷰 동시 생성 도구 실행 — 그리드 배치 + 자동 엣지
    case 'spawn_multiple_cards': {
      const cardsInput = input.cards as Array<{ title: string; content: string; cardType?: string; symbol?: string }> | undefined
      const webviewsInput = input.webviews as Array<{ url: string; title: string }> | undefined
      const createdIds: string[] = []

      // 그리드 배치 계산: 2-3개 → 1줄, 4-6개 → 2줄, 7+ → 3줄
      const totalItems = (cardsInput?.length || 0) + (webviewsInput?.length || 0)
      const cols = Math.min(totalItems, 3)
      const cardW = 400
      const cardH = 350
      const webviewW = 700
      const webviewH = 500
      const gap = 30

      // 시작 위치: 기존 아이템들의 가장 오른쪽 + 여백, 또는 기본 위치
      const existingItems = store.cards
      const maxRight = existingItems.length > 0
        ? Math.max(...existingItems.map(c => c.x + c.width))
        : 0
      const startX = maxRight > 0 ? maxRight + 80 : 80
      const startY = 80
      let itemIdx = 0

      // Phase 1: 모든 카드를 스켈레톤 상태로 즉시 생성 (빈 프레임)
      if (cardsInput && Array.isArray(cardsInput)) {
        for (const card of cardsInput) {
          const col = itemIdx % cols
          const row = Math.floor(itemIdx / cols)
          const x = startX + col * (cardW + gap)
          const y = startY + row * (cardH + gap)

          const id = store.addCard({
            title: card.title || 'Card',
            content: '',
            isLoading: true,
            cardType: card.cardType,
            symbol: card.symbol,
            x,
            y,
            width: cardW,
            height: cardH,
            spawnDelay: itemIdx * 0.12,
            type: 'card',
          })
          createdIds.push(id)
          itemIdx++
        }
      }

      // 웹뷰 생성 (스켈레톤 불필요 — 자체 로딩 UI가 있음)
      if (webviewsInput && Array.isArray(webviewsInput)) {
        for (const wv of webviewsInput) {
          const col = itemIdx % cols
          const row = Math.floor(itemIdx / cols)
          const x = startX + col * (webviewW + gap)
          const y = startY + row * (webviewH + gap)

          const id = store.addWebview({
            url: wv.url,
            title: wv.title || 'Webview',
            x,
            y,
            width: webviewW,
            height: webviewH,
            type: 'webview',
          })
          createdIds.push(id)
          itemIdx++
        }
      }

      // Phase 2: 카드 콘텐츠를 순차적으로 채움 (스켈레톤 → 실제 콘텐츠 + 사운드)
      if (cardsInput && Array.isArray(cardsInput)) {
        for (let i = 0; i < cardsInput.length; i++) {
          await new Promise(r => setTimeout(r, 100))
          useCanvasStore.getState().updateCard(createdIds[i], {
            content: cardsInput[i].content || '',
            isLoading: false,
          })
          soundService.playCardSpawn()
        }
      }

      // 카드 간 자동 엣지 생성 (순차적 weak 연결)
      if (createdIds.length > 1) {
        const latestStore = useCanvasStore.getState()
        for (let i = 0; i < createdIds.length - 1; i++) {
          latestStore.addEdge(createdIds[i], createdIds[i + 1], 'weak')
        }
      }

      return JSON.stringify({
        status: 'spawned',
        created: createdIds.length,
        cardIds: createdIds,
      })
    }

    // 선물/파생상품 종합 데이터 도구 실행 — 펀딩비, OI, 롱숏, 청산
    case 'fetch_derivatives_data': {
      const symbol = input.symbol as string
      console.log('[TRAVIS] fetch_derivatives_data called — symbol:', symbol)
      const api = (window as any).api
      if (!api?.fetchDerivativesData) {
        return JSON.stringify({ status: 'error', message: 'Derivatives data bridge not available' })
      }
      const data = await api.fetchDerivativesData(symbol)
      if (data) {
        console.log('[TRAVIS] fetch_derivatives_data result:', data.symbol, '| funding:', data.lastFundingRate, '| OI:', data.openInterest)
        return JSON.stringify(data)
      }
      return JSON.stringify({ error: `${symbol} 선물 데이터를 가져올 수 없습니다. 해당 심볼의 선물 거래가 지원되지 않을 수 있습니다.` })
    }

    // 트렌딩 도구 실행 — CoinGecko 검색량 급증 코인/NFT/카테고리
    case 'fetch_trending': {
      console.log('[TRAVIS] fetch_trending called')
      const api = (window as any).api
      if (!api?.fetchTrending) {
        return JSON.stringify({ status: 'error', message: 'Trending bridge not available' })
      }
      const data = await api.fetchTrending()
      if (data) {
        console.log('[TRAVIS] fetch_trending result: coins=', data.trendingCoins?.length)
        return JSON.stringify(data)
      }
      return JSON.stringify({ error: '트렌딩 데이터를 가져올 수 없습니다.' })
    }

    // 대형 거래(고래 활동) 도구 실행 — 대형 체결 + 호가벽
    case 'fetch_whale_activity': {
      const symbol = (input.symbol as string) || undefined
      console.log('[TRAVIS] fetch_whale_activity called — symbol:', symbol || 'BTC (default)')
      const api = (window as any).api
      if (!api?.fetchWhaleActivity) {
        return JSON.stringify({ status: 'error', message: 'Whale activity bridge not available' })
      }
      const data = await api.fetchWhaleActivity(symbol)
      if (data) {
        console.log('[TRAVIS] fetch_whale_activity result:', data.symbol, '| large trades:', data.largeTrades?.length, '| net flow:', data.stats?.netFlow)
        return JSON.stringify(data)
      }
      return JSON.stringify({ error: `${symbol || 'BTC'} 고래 활동 데이터를 가져올 수 없습니다.` })
    }

    // 시장 전체 상황 조회 도구 실행 — 글로벌 메트릭 + 공포탐욕 + Top 상승/하락 + CMC
    case 'fetch_market_overview': {
      console.log('[TRAVIS] fetch_market_overview called')
      const api = (window as any).api
      if (!api?.fetchMarketOverview) {
        return JSON.stringify({ status: 'error', message: 'Market overview bridge not available' })
      }
      const overview = await api.fetchMarketOverview()
      if (overview) {
        // CMC 글로벌 메트릭 보조 데이터 (API 키가 있을 때만)
        let cmcGlobal = null
        if (currentCmcApiKey) {
          try {
            cmcGlobal = await api.cmcGlobalMetrics(currentCmcApiKey)
          } catch {
            // CMC 실패해도 무시 — 보조 소스
          }
        }

        const result = {
          ...overview,
          cmc: cmcGlobal ? {
            defiVolume24h: cmcGlobal.defiVolume24h,
            defiMarketCap: cmcGlobal.defiMarketCap,
            stablecoinVolume24h: cmcGlobal.stablecoinVolume24h,
            stablecoinMarketCap: cmcGlobal.stablecoinMarketCap,
            totalExchanges: cmcGlobal.totalExchanges,
          } : null,
          dataSources: 'coingecko+alternative.me' + (cmcGlobal ? '+cmc' : ''),
        }

        console.log('[TRAVIS] fetch_market_overview result: mcap=', overview.totalMarketCap, '| fng=', overview.fearGreedIndex?.value, '| cmc:', !!cmcGlobal)
        return JSON.stringify(result)
      }
      return JSON.stringify({ error: '시장 전체 데이터를 가져올 수 없습니다.' })
    }

    // 코인 데이터 조회 도구 실행 — CoinGecko + Binance + CMC 종합 데이터
    case 'fetch_coin_data': {
      const query = input.query as string
      const includeFutures = (input.include_futures as boolean) || false
      console.log('[TRAVIS] fetch_coin_data called — query:', query, '| futures:', includeFutures)
      const api = (window as any).api
      if (!api?.queryCoinData) {
        return JSON.stringify({ status: 'error', message: 'Coin data bridge not available' })
      }
      const coinData = await api.queryCoinData(query, includeFutures)
      if (coinData) {
        // CMC 보조 데이터 (API 키가 있을 때만)
        let cmcData = null
        if (currentCmcApiKey && coinData.symbol) {
          try {
            cmcData = await api.cmcCoinData(currentCmcApiKey, coinData.symbol)
          } catch {
            // CMC 실패해도 무시 — 보조 소스
          }
        }

        const result = {
          ...coinData,
          cmc: cmcData ? {
            rank: cmcData.rank,
            tags: cmcData.tags,
            percentChange1h: cmcData.percentChange1h,
            percentChange30d: cmcData.percentChange30d,
            dateAdded: cmcData.dateAdded,
            platform: cmcData.platform,
          } : null,
          dataSource: coinData.dataSource + (cmcData ? '+cmc' : ''),
        }

        console.log('[TRAVIS] fetch_coin_data result:', result.symbol, result.name, '| source:', result.dataSource)
        return JSON.stringify(result)
      }
      return JSON.stringify({ error: `"${query}" 코인을 찾을 수 없거나 데이터를 가져올 수 없습니다.` })
    }

    // 특정 거래소 가격 조회 도구 실행 — CCXT 기반 6개 거래소
    case 'fetch_exchange_price': {
      const exchange = input.exchange as string
      const symbol = input.symbol as string
      console.log('[TRAVIS] fetch_exchange_price called —', exchange, symbol)
      const api = (window as any).api
      if (!api?.exchangeFetchTicker) {
        return JSON.stringify({ status: 'error', message: 'Exchange bridge not available' })
      }
      const data = await api.exchangeFetchTicker(exchange, symbol)
      if (data) {
        console.log('[TRAVIS] fetch_exchange_price result:', data.exchange, data.symbol, '| last:', data.last)
        return JSON.stringify(data)
      }
      return JSON.stringify({ error: `${exchange}에서 ${symbol} 데이터를 가져올 수 없습니다.` })
    }

    // 거래소 간 가격 비교 도구 실행 — 멀티 거래소 + 김치 프리미엄
    case 'compare_exchange_prices': {
      const symbol = input.symbol as string
      const mode = (input.mode as string) || 'compare'
      const exchanges = input.exchanges as string[] | undefined
      console.log('[TRAVIS] compare_exchange_prices called — symbol:', symbol, '| mode:', mode)
      const api = (window as any).api

      if (mode === 'kimchi') {
        if (!api?.exchangeKimchiPremium) {
          return JSON.stringify({ status: 'error', message: 'Kimchi premium bridge not available' })
        }
        const data = await api.exchangeKimchiPremium(symbol)
        if (data) {
          console.log('[TRAVIS] kimchi premium result:', data.premium, '% | USD/KRW:', data.usdKrw)
          return JSON.stringify(data)
        }
        return JSON.stringify({ error: `${symbol} 김치 프리미엄을 계산할 수 없습니다.` })
      }

      // compare 모드 — 여러 거래소 동시 조회
      if (!api?.exchangeFetchTicker) {
        return JSON.stringify({ status: 'error', message: 'Exchange bridge not available' })
      }
      const targetExchanges = exchanges || ['binance', 'upbit', 'bybit', 'bithumb', 'okx', 'coinbase']

      const results = await Promise.allSettled(
        targetExchanges.map((ex: string) => {
          const pair = ['upbit', 'bithumb'].includes(ex) ? `${symbol}/KRW` : `${symbol}/USDT`
          return api.exchangeFetchTicker(ex, pair)
        })
      )

      const data = results
        .map((r, i) => r.status === 'fulfilled' && r.value ? r.value : { exchange: targetExchanges[i], error: 'failed' })
        .filter(Boolean)

      console.log('[TRAVIS] compare result:', data.length, 'exchanges responded')
      return JSON.stringify(data)
    }

    // 웹뷰 조작 도구 실행 — URL 변경, 크기 조절, TradingView 차트 제어
    case 'control_webview': {
      const webviewId = input.webviewId as string
      const action = input.action as string
      console.log('[TRAVIS] control_webview called — id:', webviewId, '| action:', action)

      // 대상 웹뷰 카드 존재 확인
      const targetCard = store.cards.find((c) => c.id === webviewId && c.type === 'webview')
      if (!targetCard) {
        return JSON.stringify({ error: `Webview "${webviewId}" not found on canvas` })
      }

      // webviewRefs에서 DOM 요소 참조
      const wvElement = webviewRefs.get(webviewId) as HTMLElement & {
        loadURL?: (url: string) => void
        getURL?: () => string
      } | undefined

      switch (action) {
        case 'navigate': {
          const url = input.url as string
          if (!url) return JSON.stringify({ error: 'url is required for navigate action' })
          // Store URL 업데이트
          store.updateWebviewUrl(webviewId, url)
          // DOM에서 직접 로드 (즉시 반영)
          if (wvElement?.loadURL) {
            wvElement.loadURL(url)
          }
          console.log('[TRAVIS] control_webview navigate:', url)
          return JSON.stringify({ success: true, action: 'navigated', webviewId, url })
        }

        case 'resize': {
          const width = input.width as number
          const height = input.height as number
          if (!width && !height) return JSON.stringify({ error: 'width or height required for resize' })
          store.updateCardSize(
            webviewId,
            width || targetCard.width,
            height || targetCard.height
          )
          console.log('[TRAVIS] control_webview resize:', width, 'x', height)
          return JSON.stringify({ success: true, action: 'resized', webviewId, width: width || targetCard.width, height: height || targetCard.height })
        }

        case 'tv_change_symbol': {
          const symbol = input.symbol as string
          if (!symbol) return JSON.stringify({ error: 'symbol is required for tv_change_symbol (e.g. BINANCE:BTCUSDT)' })
          // TradingView URL 구성: 심볼 변경
          const currentUrl = (targetCard as any).liveUrl || (targetCard as any).url || ''
          let newUrl: string
          try {
            const parsed = new URL(currentUrl)
            parsed.searchParams.set('symbol', symbol)
            newUrl = parsed.toString()
          } catch {
            // URL 파싱 실패 시 새로 구성
            newUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`
          }
          store.updateWebviewUrl(webviewId, newUrl)
          if (wvElement?.loadURL) {
            wvElement.loadURL(newUrl)
          }
          console.log('[TRAVIS] control_webview tv_change_symbol:', symbol, '→', newUrl)
          return JSON.stringify({ success: true, action: 'tv_symbol_changed', webviewId, symbol, url: newUrl })
        }

        case 'tv_change_interval': {
          const interval = input.interval as string
          if (!interval) return JSON.stringify({ error: 'interval is required for tv_change_interval (e.g. 1, 5, 15, 60, 240, D, W, M)' })
          const currentUrl2 = (targetCard as any).liveUrl || (targetCard as any).url || ''
          let newUrl2: string
          try {
            const parsed = new URL(currentUrl2)
            parsed.searchParams.set('interval', interval)
            newUrl2 = parsed.toString()
          } catch {
            newUrl2 = `https://www.tradingview.com/chart/?interval=${encodeURIComponent(interval)}`
          }
          store.updateWebviewUrl(webviewId, newUrl2)
          if (wvElement?.loadURL) {
            wvElement.loadURL(newUrl2)
          }
          console.log('[TRAVIS] control_webview tv_change_interval:', interval, '→', newUrl2)
          return JSON.stringify({ success: true, action: 'tv_interval_changed', webviewId, interval, url: newUrl2 })
        }

        default:
          return JSON.stringify({ error: `Unknown control_webview action: ${action}` })
      }
    }

    default:
      return JSON.stringify({ status: 'unknown_tool' })
  }
}

// --- 스트리밍 (AI 응답을 실시간으로 글자 단위로 받는 기능) ---

// 스트리밍 1라운드의 결과 구조
interface StreamRoundResult {
  text: string                   // AI가 보낸 텍스트 응답
  toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }>  // AI가 호출한 도구 목록
  stopReason: string             // 응답 종료 이유 (end_turn = 완료, tool_use = 도구 호출 필요)
  fullContent: ApiContentBlock[] // 텍스트 + 도구 호출을 포함한 전체 응답
}

// Claude API에 1번 요청을 보내고 스트리밍으로 응답을 받는 함수
// AI가 도구를 호출하면 여러 라운드로 반복될 수 있음
function streamOneRound(
  payload: { apiKey: string; model: string; system: string; messages: ApiMessage[]; tools: unknown[] },
  messageId: string,
  existingText: string,
  onFirstTextDelta?: () => void,
): Promise<StreamRoundResult> {
  return new Promise((resolve, reject) => {
    const api = (window as any).api
    let accumulatedText = ''      // 이번 라운드에서 받은 텍스트 누적
    let stopReason = ''            // AI 응답 종료 이유

    // AI가 호출한 도구 블록들을 인덱스별로 추적
    const toolBlocks: Map<number, { id: string; name: string; jsonStr: string }> = new Map()

    // 이벤트 리스너 정리용 함수 배열
    const cleanups: Array<() => void> = []
    let sseTimeoutTimer: ReturnType<typeof setTimeout> | null = null

    function cleanup() {
      if (sseTimeoutTimer) { clearTimeout(sseTimeoutTimer); sseTimeoutTimer = null }
      for (const fn of cleanups) fn()
      cleanups.length = 0
    }

    let resolved = false  // Promise가 이미 resolve/reject 되었는지 추적

    // SSE 타임아웃 — 이벤트가 없으면 연결 끊김으로 판단
    function resetSseTimeout() {
      if (sseTimeoutTimer) clearTimeout(sseTimeoutTimer)
      sseTimeoutTimer = setTimeout(() => {
        if (resolved) return
        resolved = true
        cleanup()
        reject(new Error('SSE_TIMEOUT'))
      }, SSE_TIMEOUT_MS)
    }
    resetSseTimeout()

    // 텍스트 조각이 올 때마다 — AI 응답이 글자 단위로 실시간 전달됨
    cleanups.push(api.onStreamEvent('stream:text-delta', (data: { text: string }) => {
      resetSseTimeout()
      if (!accumulatedText && onFirstTextDelta) onFirstTextDelta()
      accumulatedText += data.text
      useChatStore.getState().updateMessage(messageId, existingText + accumulatedText)
    }))

    // 도구 호출 시작 — AI가 도구를 호출하기 시작할 때
    cleanups.push(api.onStreamEvent('stream:tool-start', (data: { index: number; id: string; name: string }) => {
      resetSseTimeout()
      toolBlocks.set(data.index, { id: data.id, name: data.name, jsonStr: '' })
    }))

    // 도구 입력 데이터 조각 — 도구에 전달할 JSON 데이터가 조각 단위로 도착
    cleanups.push(api.onStreamEvent('stream:tool-delta', (data: { index: number; json: string }) => {
      resetSseTimeout()
      const block = toolBlocks.get(data.index)
      if (block) {
        block.jsonStr += data.json
      }
    }))

    // 도구 호출 완료 — JSON 데이터 전송이 끝남 (실제 처리는 stream:end에서)
    cleanups.push(api.onStreamEvent('stream:tool-end', (_data: { index: number }) => {
      resetSseTimeout()
      // 도구 블록 완료됨
    }))

    // AI 응답 종료 이유 수신 — end_turn(완료) 또는 tool_use(도구 실행 필요)
    cleanups.push(api.onStreamEvent('stream:message-delta', (data: { stopReason: string }) => {
      resetSseTimeout()
      stopReason = data.stopReason || ''
    }))

    // 스트리밍 완료 — 이번 라운드의 모든 데이터 수신 완료
    cleanups.push(api.onStreamEvent('stream:end', () => {
      if (resolved) return
      resolved = true
      cleanup()

      // 이번 라운드의 전체 응답 내용 구성 (텍스트 + 도구 호출)
      const fullContent: ApiContentBlock[] = []
      if (accumulatedText) {
        fullContent.push({ type: 'text', text: accumulatedText })
      }

      // 도구 호출 블록들의 JSON 데이터를 파싱하여 실행 가능한 형태로 변환
      const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = []
      for (const [, block] of toolBlocks) {
        let parsedInput: Record<string, unknown> = {}
        try {
          parsedInput = JSON.parse(block.jsonStr || '{}')
        } catch {
          // JSON 파싱 실패 시 빈 입력으로 처리
        }
        toolUseBlocks.push({ id: block.id, name: block.name, input: parsedInput })
        fullContent.push({ type: 'tool_use', id: block.id, name: block.name, input: parsedInput })
      }

      resolve({ text: accumulatedText, toolUseBlocks, stopReason, fullContent })
    }))

    // 스트리밍 에러 — 네트워크 오류 등으로 실패한 경우
    cleanups.push(api.onStreamEvent('stream:error', (data: { error: string }) => {
      if (resolved) return
      resolved = true
      cleanup()
      reject(new Error(data.error))
    }))

    // 스트리밍 시작 요청 — Electron 메인 프로세스에 API 호출을 위임
    api.startChatStream(payload)
  })
}

// --- 메인 API (외부에서 호출하는 함수) ---

// 메시지 전송 시 필요한 옵션 정의
export interface SendMessageOptions {
  apiKey: string
  model: string
  contextPrompt: string
  tavilyApiKey: string
  cmcApiKey: string
  canvasCards: Array<{ id: string; title: string; type: string; liveTitle?: string; liveUrl?: string }>
  focusedCard?: { id: string; title: string; content: string }
}

// 메시지 전송 결과 구조
export interface SendMessageResult {
  text: string              // AI의 텍스트 응답
  toolCalls: ToolCall[]     // AI가 호출한 도구 목록
}

// Phase 2 legacy — 하드코딩된 심볼 목록 (Phase 3에서 동적 resolve로 교체)
// const KNOWN_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'DOT', 'AVAX', 'MATIC']
// const SYMBOL_REGEX = new RegExp(`\\b(${KNOWN_SYMBOLS.join('|')})\\b`, 'gi')

// 한국어 코인명 → 심볼 매핑 (동적 resolve 전에 빠르게 변환)
const KOREAN_COIN_NAMES: Record<string, string> = {
  '비트코인': 'BTC', '이더리움': 'ETH', '이더': 'ETH', '솔라나': 'SOL',
  '리플': 'XRP', '도지코인': 'DOGE', '도지': 'DOGE', '에이다': 'ADA',
  '폴카닷': 'DOT', '아발란체': 'AVAX', '바이낸스코인': 'BNB',
  '폴리곤': 'MATIC', '체인링크': 'LINK', '라이트코인': 'LTC',
  '시바이누': 'SHIB', '유니스왑': 'UNI', '아비트럼': 'ARB',
  '옵티미즘': 'OP', '페페': 'PEPE',
}

// 코인 심볼이 아닌 일반 영단어 제외 목록
const EXCLUDED_WORDS = new Set([
  'THE', 'AND', 'FOR', 'NOT', 'YOU', 'ALL', 'CAN', 'WAS', 'ONE', 'OUR',
  'OUT', 'HAS', 'HIS', 'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE',
  'WAY', 'WHO', 'DID', 'GET', 'LET', 'SAY', 'SHE', 'TOO', 'USE', 'HER',
  'THAN', 'BEEN', 'HAVE', 'MUCH', 'SOME', 'THEM', 'THEN', 'VERY', 'WHEN',
  'WHAT', 'WITH', 'THIS', 'THAT', 'FROM', 'WILL', 'YOUR', 'JUST', 'INTO',
  'OVER', 'ALSO', 'BACK', 'MOST', 'MORE', 'MADE', 'KNOW', 'LIKE', 'EACH',
  'ONLY', 'MANY', 'WELL', 'SUCH', 'TAKE', 'COME', 'EVEN', 'GIVE', 'WANT',
  // 자주 나오는 비-코인 약어
  'AI', 'API', 'ETF', 'USD', 'KRW', 'USDT', 'BUSD', 'USDC', 'SSE', 'IPC',
  'URL', 'CSS', 'HTML', 'JSON', 'HTTP', 'HTTPS', 'ATH', 'ATL',
])

// 세션 캐시: resolve된 심볼의 바이낸스 페어를 저장 (반복 호출 방지)
const sessionResolvedPairs = new Map<string, string | null>()

// 메시지에서 코인 심볼 후보를 추출하는 함수
function extractCoinCandidates(message: string): string[] {
  const candidates = new Set<string>()

  // 1. "XXXUSDT", "XXX/USDT" 패턴에서 베이스 심볼 추출 (가장 높은 우선순위)
  const pairMatches = message.match(/\b([A-Za-z]{2,10})(USDT|\/USDT|BUSD|\/BUSD|USD|\/USD|BTC|\/BTC|KRW|\/KRW)\b/gi)
  if (pairMatches) {
    for (const m of pairMatches) {
      const base = m.replace(/(\/?(USDT|BUSD|USD|BTC|KRW))$/i, '').toUpperCase()
      if (base.length >= 2 && !EXCLUDED_WORDS.has(base)) candidates.add(base)
    }
  }

  // 2. 대문자 2-10글자 영단어 추출 (코인 티커 후보)
  const upperMatches = message.match(/\b[A-Z]{2,10}\b/g)
  if (upperMatches) {
    for (const m of upperMatches) {
      if (!EXCLUDED_WORDS.has(m)) candidates.add(m)
    }
  }

  // 3. 한국어 코인명 매칭
  for (const [krName, sym] of Object.entries(KOREAN_COIN_NAMES)) {
    if (message.includes(krName)) candidates.add(sym)
  }

  return [...candidates]
}

// 바이낸스 24hr 시세를 가져와서 포맷하는 헬퍼 함수
function formatBinanceLine(d: Record<string, string>, displaySym: string): string {
  const price = parseFloat(d.lastPrice)
  const change = parseFloat(d.priceChangePercent)
  const vol = parseFloat(d.volume)
  return `${displaySym}/USDT: $${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: price < 10 ? 4 : 2 })} | 24h: ${change >= 0 ? '+' : ''}${change.toFixed(2)}% | Vol: ${vol.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${displaySym}`
}

// 사용자 메시지에서 코인 심볼을 동적으로 찾아 바이낸스 API로 실시간 시세를 가져오는 함수
// Phase 3: KNOWN_SYMBOLS 하드코딩 대신 CoinGecko /search로 아무 코인이든 자동 resolve
async function fetchMarketData(message: string): Promise<string | undefined> {
  const candidates = extractCoinCandidates(message)
  if (candidates.length === 0) return undefined

  const lines: string[] = []
  const api = (window as any).api

  await Promise.allSettled(
    candidates.map(async (sym) => {
      try {
        // 1. 세션 캐시 확인 — 이전에 이미 resolve한 심볼
        if (sessionResolvedPairs.has(sym)) {
          const cachedPair = sessionResolvedPairs.get(sym)
          if (!cachedPair) return // 이전에 resolve 실패한 심볼은 스킵
          const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${cachedPair}`)
          if (!res.ok) return
          lines.push(formatBinanceLine(await res.json(), sym))
          return
        }

        // 2. 바이낸스 직접 시도 (빠름, rate limit 걱정 없음)
        const directRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}USDT`)
        if (directRes.ok) {
          sessionResolvedPairs.set(sym, `${sym}USDT`)
          lines.push(formatBinanceLine(await directRes.json(), sym))
          return
        }

        // 3. CoinGecko 동적 resolve → 바이낸스 재시도
        if (api?.resolveSymbol) {
          const resolved = await api.resolveSymbol(sym)
          if (resolved) {
            console.log(`[fetchMarketData] Resolved ${sym} → ${resolved.symbol} (${resolved.name})`)
            const binancePair = `${resolved.symbol.toUpperCase()}USDT`
            const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binancePair}`)
            if (res.ok) {
              sessionResolvedPairs.set(sym, binancePair)
              lines.push(formatBinanceLine(await res.json(), resolved.symbol.toUpperCase()))
              return
            }
          }
        }

        // 4. 모두 실패 — null 캐시 (다음에 같은 심볼 재시도 방지)
        sessionResolvedPairs.set(sym, null)
      } catch (err) {
        console.warn('[fetchMarketData] Failed to resolve', sym, ':', err)
        sessionResolvedPairs.set(sym, null)
      }
    })
  )

  return lines.length > 0 ? lines.join('\n') : undefined
}

// ====================================================================
// 사용자 메시지를 Claude AI에게 전송하고 응답을 처리하는 핵심 함수
// 1) 사용자 메시지 + 시세 데이터 + 캔버스 상태를 Claude에게 전달
// 2) AI 응답을 스트리밍으로 받아 채팅에 표시
// 3) AI가 도구를 호출하면 실행하고 결과를 다시 AI에게 전달 (반복)
// ====================================================================
export async function sendMessage(
  userMessage: string,
  options: SendMessageOptions
): Promise<SendMessageResult> {
  const { apiKey, model, contextPrompt, tavilyApiKey, cmcApiKey, canvasCards, focusedCard } = options

  // API 키들을 도구 실행 함수에서 사용할 수 있도록 저장
  currentTavilyApiKey = tavilyApiKey
  currentCmcApiKey = cmcApiKey
  console.log('[TRAVIS] sendMessage — tavilyApiKey set:', tavilyApiKey ? 'YES' : 'NO', '| cmcApiKey set:', cmcApiKey ? 'YES' : 'NO', '| tools count:', TOOLS.length)

  // 사용자 메시지를 대화 기록에 추가
  conversationHistory.push({ role: 'user', content: userMessage })

  // 메시지에 언급된 코인의 실시간 시세를 바이낸스에서 가져와 AI에게 함께 전달
  const marketData = await fetchMarketData(userMessage)
  // 시스템 프롬프트 구성 (AI 역할 + 사용자 컨텍스트 + 시세 + 캔버스 상태)
  const systemPrompt = buildSystemPrompt(contextPrompt, canvasCards, marketData, focusedCard)
  const allToolCalls: ToolCall[] = []

  // 카드 생성 순서 초기화 — 새 메시지마다 애니메이션 딜레이를 처음부터
  spawnIndex = 0

  // 빈 AI 응답 메시지를 채팅에 먼저 생성 → 스트리밍으로 내용이 채워짐
  const chatStore = useChatStore.getState()
  const messageId = chatStore.addMessage('assistant', '')
  chatStore.setStreamingMessageId(messageId)

  let accumulatedText = ''  // 전체 라운드에서 누적된 AI 텍스트
  let aiSoundPlayed = false // AI 응답 사운드 1회만 재생

  // 멀티턴 루프: AI가 도구를 호출하면 실행 → 결과를 AI에게 전달 → AI가 또 응답 (반복)
  // 예: 사용자 "BTC 분석해줘" → AI가 카드 생성 → 결과 전달 → AI가 추가 설명
  let turns = 0

  try {
    while (turns++ < MAX_TOOL_TURNS) {
      const result = await streamOneRound(
        { apiKey, model, system: systemPrompt, messages: conversationHistory, tools: TOOLS },
        messageId,
        accumulatedText,
        !aiSoundPlayed ? () => { soundService.playAIResponse(); aiSoundPlayed = true } : undefined,
      )

      accumulatedText = accumulatedText + result.text

      // AI 응답을 대화 기록에 추가 (다음 대화에서 AI가 이전 맥락을 기억할 수 있도록)
      conversationHistory.push({
        role: 'assistant',
        content: result.fullContent,
      })

      // 이번 라운드에서 호출된 도구들을 전체 목록에 기록
      for (const block of result.toolUseBlocks) {
        allToolCalls.push({ id: block.id, name: block.name, input: block.input })
      }

      // AI가 더 이상 도구를 호출하지 않으면 (응답 완료) 루프 종료
      if (result.stopReason !== 'tool_use' || result.toolUseBlocks.length === 0) {
        break
      }

      // AI가 호출한 도구들을 하나씩 실행하고, 결과를 모아서 AI에게 다시 전달 (15초 타임아웃)
      const toolResults: ApiContentBlock[] = []
      for (const block of result.toolUseBlocks) {
        let toolResult: string
        try {
          toolResult = await Promise.race([
            executeTool(block.name, block.input),
            new Promise<string>((_, rej) =>
              setTimeout(() => rej(new Error('TOOL_TIMEOUT')), TOOL_TIMEOUT_MS)
            ),
          ])
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error'
          console.error(`[TRAVIS] Tool ${block.name} failed:`, errMsg)
          toolResult = JSON.stringify({ error: `도구 실행 시간이 초과되었습니다 (30초): ${block.name}` })
        }
        toolResults.push({
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: toolResult,
        })
      }
      // 도구 실행 결과를 대화 기록에 추가 → AI가 결과를 보고 다음 응답을 생성
      conversationHistory.push({ role: 'user', content: toolResults })

      // 다음 라운드의 텍스트가 이어서 붙을 수 있도록 줄바꿈 추가
      if (accumulatedText) accumulatedText += '\n\n'
    }
  } catch (err) {
    // SSE 타임아웃 또는 기타 에러 처리
    const errMessage = err instanceof Error ? err.message : 'Unknown error'
    if (errMessage === 'SSE_TIMEOUT') {
      console.error('[TRAVIS] SSE timeout — no response in 60 seconds')
      chatStore.updateMessage(messageId, accumulatedText + (accumulatedText ? '\n\n' : '') + '⚠️ 응답이 지연되고 있습니다. 네트워크 상태를 확인하거나 다시 시도해주세요.')
    } else {
      console.error('[TRAVIS] sendMessage error:', errMessage)
      chatStore.updateMessage(messageId, accumulatedText + (accumulatedText ? '\n\n' : '') + `⚠️ 오류 발생: ${errMessage}`)
    }
  } finally {
    // 스트리밍 완료 — 스트리밍 상태 해제
    useChatStore.getState().setStreamingMessageId(null)
  }

  // AI가 텍스트 없이 도구만 실행한 경우 "(도구를 실행했습니다)" 표시
  if (!accumulatedText.trim()) {
    useChatStore.getState().updateMessage(messageId, '(도구를 실행했습니다)')
  }

  return { text: accumulatedText, toolCalls: allToolCalls }
}

// 대화 기록 초기화 — 새로운 대화를 시작할 때 이전 맥락을 모두 지움
export function clearConversation() {
  conversationHistory = []
}
