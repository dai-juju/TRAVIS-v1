# TRAVIS — Context Handoff Document

> 새 AI 세션에서 이 문서 하나만 읽으면 프로젝트 전체 맥락을 즉시 파악할 수 있습니다.
> 마지막 업데이트: 2026-02-27 | Phase 2 완료 시점

---

## 1. 프로젝트 한 줄 요약

**TRAVIS는 트레이더를 위한 AI 데스크톱 앱으로, 사용자가 자연어로 대화하면 Claude AI가 정보 카드와 웹사이트를 무한 캔버스 위에 배치하고, 실시간 뉴스/시세/온체인 데이터를 모자이크 이론(Mosaic Theory) 기반으로 통합 분석합니다.**

- 킬체인: DETECT → COLLECT → JUDGE → EXECUTE
- 슬로건: "Shape Your Market"
- 핵심 철학: AI는 데이터를 필터링하지 않고 관련성 점수만 매김. Raw Feed가 기본.

---

## 2. 기술 스택 요약

| 기술 | 버전/상세 | 역할 |
|------|----------|------|
| Electron | - | 데스크톱 앱 프레임워크 (Main + Renderer 구조) |
| React | + TypeScript | 프론트엔드 UI |
| Zustand | 7개 스토어 | 상태 관리 |
| TailwindCSS | 커스텀 디자인 시스템 | 스타일링 |
| Vite | dev server + bundler | 빌드 도구 |
| Claude API | Tool Use + SSE Streaming | AI 두뇌 (7개 도구) |
| Binance WebSocket | `wss://stream.binance.com` | 실시간 시세 |
| Framer Motion | AnimatePresence | 카드 등장/퇴장 애니메이션 |
| react-simple-maps | ComposableMap | FEED 탭 세계 지도 |
| react-markdown + remark-gfm | - | 카드 내 마크다운 렌더링 |

**외부 API**:
- Claude API (Anthropic) — AI 대화 + 도구 사용
- Tavily — 웹 검색
- Binance REST — 거래 내역, 24h 시세, 선물 (펀딩비/OI)
- CoinGecko — 코인 상세 데이터 (시총, 카테고리, ATH)
- Upbit — 김치 프리미엄 계산
- CryptoCompare — 암호화폐 뉴스
- Alternative.me — Fear & Greed Index
- Yahoo Finance (v8 Chart API) — 전통 자산 (S&P500, NASDAQ, DXY, 금, 유가)

---

## 3. 파일 구조 전체 트리

**55개 파일, 약 7,000 줄** (주석 포함)

```
src/
├── main/                              # Electron Main Process (백엔드)
│   ├── index.ts                       # 앱 시작점: BrowserWindow 생성, IPC 등록
│   ├── ipc.ts                         # IPC 핸들러 13개 등록 (Claude, Binance, CoinGecko, etc.)
│   ├── preload.ts                     # contextBridge — Renderer가 Main을 호출하는 보안 통로
│   ├── tavily.ts                      # Tavily 웹 검색 API 호출
│   ├── binanceApi.ts                  # Binance REST: fetchRecentTrades, fetchMultipleTickers
│   ├── binanceFuturesApi.ts           # Binance Futures: fetchFundingRate, fetchOpenInterest
│   ├── coingeckoApi.ts                # CoinGecko: fetchCoinData, searchCoinId (동적 검색)
│   ├── upbitApi.ts                    # Upbit 김치 프리미엄: getExchangeRate + 병렬 fetch
│   ├── feedApi.ts                     # CryptoCompare 뉴스 + Fear&Greed Index
│   └── yahooFinance.ts                # Yahoo Finance: S&P500, NASDAQ, DXY, GOLD, OIL
│
└── renderer/                          # React 프론트엔드
    ├── App.tsx                        # 루트: Boot → TabBar + (COMMAND | FEED) + StatusBar + Ticker
    ├── main.tsx                       # ReactDOM.createRoot 진입점
    ├── index.css                      # CSS 변수, 애니메이션 (boot-ring, scan-sweep, spawn-glow 등)
    ├── vite-env.d.ts                  # Vite 타입 선언
    │
    ├── components/
    │   ├── BootSequence.tsx           # 시네마틱 부팅 애니메이션 (4단계: 다크→로고→상태→페이드)
    │   ├── TabBar.tsx                 # COMMAND / FEED 탭 전환
    │   ├── Canvas.tsx                 # 무한 캔버스: 패닝(드래그), 줌(휠), 그리드 배경
    │   ├── Card.tsx                   # 정보 카드: 드래그/리사이즈, 실시간 시세, 플래시, focusedCard
    │   ├── WebviewCard.tsx            # 웹뷰 카드: webview 태그, 메타데이터 캡처, 자동 엣지
    │   ├── ChatPanel.tsx              # AI 채팅 패널: 메시지 목록, 스트리밍 커서, focusedCard 바
    │   ├── NewsFeed.tsx               # 좌측 뉴스 피드 패널 (220px, 자동 스크롤)
    │   ├── EdgeLayer.tsx              # 엣지 SVG 레이어 + ON/OFF 토글 버튼
    │   ├── NodeEdge.tsx               # 개별 연결선: strong/weak/speculative 스타일
    │   ├── SpawnAnimation.tsx         # Framer Motion 카드 등장 애니메이션
    │   ├── PriceTicker.tsx            # 하단 무한스크롤 시세 바 (crypto + tradFi + 김치)
    │   ├── StatusBar.tsx              # WebSocket 연결 상태 표시
    │   ├── LatencyIndicator.tsx       # 지연시간 표시 (초록/노랑/빨강 점)
    │   ├── SettingsModal.tsx          # 설정 모달 (API키, 모델, 컨텍스트, AI스코어링)
    │   ├── MosaicFeed.tsx             # FEED 탭 레이아웃: 상단(지도+사이드바) + 하단(7컬럼)
    │   ├── WorldMap.tsx               # react-simple-maps 세계 지도 + 뉴스 핀
    │   ├── EventCalendar.tsx          # 경제 이벤트 캘린더 (FOMC, CPI, NFP, 암호화폐)
    │   ├── FeedSidebar.tsx            # FEED 탭 우측 사이드바 (검색 + 카테고리 필터)
    │   ├── MultiColumnFeed.tsx        # 7개 FeedColumn 배치
    │   ├── FeedColumn.tsx             # 단일 카테고리 컬럼 (독립 스크롤)
    │   ├── FeedItem.tsx               # 뉴스 아이템: 카테고리 스트립, 중요도 뱃지, 드래그, AI 점수
    │   ├── InvestigationMode.tsx      # 전체 화면 오버레이: 3×2 그리드, ESC 닫기, 스캔 라인
    │   ├── InvestigationPanel.tsx     # 개별 패널 프레임: panelType 라우팅, 폴드/최대화
    │   ├── InvestigationChart.tsx     # TradingView iframe 차트
    │   ├── InvestigationNews.tsx      # 심볼 키워드 매칭 뉴스 필터
    │   ├── InvestigationWhale.tsx     # 고래 거래 테이블 ($100K+ 필터)
    │   ├── InvestigationOnchain.tsx   # CoinGecko 온체인 데이터 (시총, ATH, 공급량)
    │   └── InvestigationSector.tsx    # 섹터 비교 테이블 (같은 카테고리 코인들)
    │
    ├── stores/
    │   ├── useCanvasStore.ts          # cards[], edges[], viewport, 카드 CRUD, 엣지 CRUD, 호버/핀
    │   ├── useChatStore.ts            # messages[], isLoading, streamingMessageId, focusedCard
    │   ├── useFeedStore.ts            # items[] (max 200), filters, addItems(Map 중복제거), updateScoring
    │   ├── useSettingsStore.ts        # persist middleware, apiKey, tavilyApiKey, model, contextPrompt
    │   ├── useRealtimeStore.ts        # tickers{}, connectionStatus, subscribe/unsubscribe (→ dataSourceManager)
    │   ├── useTabStore.ts             # activeTab: 'command' | 'feed'
    │   └── useInvestigationStore.ts   # panels[], SECTOR_MAP, loadPanelData (4-phase async), open/close
    │
    ├── services/
    │   ├── claude.ts                  # AI 두뇌: 시스템 프롬프트, 7개 도구, executeTool, SSE streaming, 멀티턴 루프
    │   ├── binanceWs.ts               # BinanceDataSource: WebSocket 연결, 구독, 재접속 (지수적 백오프)
    │   ├── dataSource.ts              # DataSource 인터페이스 + DataSourceManager (참조 카운팅)
    │   ├── feedService.ts             # FeedServiceManager: CryptoCompare(60s) + FearGreed(300s) 폴링
    │   └── scoringService.ts          # ScoringService: Haiku 모델 배치 스코어링 (5개씩, 10초 타이머)
    │
    ├── types/
    │   └── index.ts                   # CardData, WebviewData, EdgeData, TickerData, FeedItem, ApiMessage 등
    │
    └── utils/
        └── geoKeywords.ts             # 키워드→좌표 매핑 (15개 도시), extractLocation(), getCoordinates()
```

---

## 4. 완료된 기능 (Phase 1 + Phase 2)

### Phase 1 (기본 구조)

| 단계 | 기능 | 핵심 파일 |
|------|------|----------|
| 1-1 | 프로젝트 셋업 | Electron + React + TS + Tailwind + Vite |
| 1-2 | 부팅 시퀀스 | `BootSequence.tsx` — 4단계 시네마틱 애니메이션 |
| 1-3 | 레이아웃 | `Canvas.tsx` (무한 캔버스) + `ChatPanel.tsx` |
| 1-4 | Claude API | `claude.ts`, `ipc.ts` — 멀티턴 도구 사용 |
| 1-5 | 카드 렌더링 | `Card.tsx`, `SpawnAnimation.tsx` — 마크다운, 드래그, 리사이즈 |
| 1-6 | 웹뷰 | `WebviewCard.tsx` — 웹사이트 삽입, 에러 폴백 |
| 1-7 | 실시간 데이터 | `binanceWs.ts`, `dataSource.ts` — WebSocket, 참조 카운팅 |
| 1-8 | Investigation Mode | `InvestigationMode.tsx` — 6패널 분석 그리드 |

### Phase 2A (기반 강화)

| 기능 | 핵심 파일 |
|------|----------|
| 디자인 시스템 | `index.css` (CSS 변수), `tailwind.config.js` (커스텀 색상/폰트) |
| 탭 시스템 | `TabBar.tsx`, `useTabStore.ts` — COMMAND / FEED |
| 노드 엣지 | `NodeEdge.tsx`, `EdgeLayer.tsx`, `useCanvasStore.ts` (edges[]) — 호버 리빌 |
| 시세 바 | `PriceTicker.tsx` — 크립토(WebSocket) + 전통자산(REST 60s) + 김치 |
| 3패널 레이아웃 | `App.tsx` — NewsFeed \| Canvas \| ChatPanel |
| AI 웹 검색 | `tavily.ts`, `claude.ts` (search_web 도구) |

### Phase 2B (뉴스 피드)

| 기능 | 핵심 파일 |
|------|----------|
| 피드 데이터 서비스 | `feedService.ts`, `feedApi.ts` — CryptoCompare + Fear&Greed |
| 피드 스토어 | `useFeedStore.ts` — Map 중복제거, 200개 제한, 필터 |
| 뉴스 피드 UI | `NewsFeed.tsx`, `FeedItem.tsx` — 좌측 패널, 드래그-투-캔버스 |
| AI 스코어링 | `scoringService.ts` — Haiku 배치 평가, JSON 파싱 + regex 폴백 |

### Phase 2C (FEED 탭)

| 기능 | 핵심 파일 |
|------|----------|
| FEED 레이아웃 | `MosaicFeed.tsx` — 상단(지도+사이드바) + 하단(7컬럼), 드래그 핸들 |
| 세계 지도 | `WorldMap.tsx`, `geoKeywords.ts` — 뉴스 핀, 펄스 애니메이션 |
| 피드 사이드바 | `FeedSidebar.tsx` — 검색 + 7카테고리 필터 |
| 7컬럼 피드 | `MultiColumnFeed.tsx`, `FeedColumn.tsx` — MACRO~WORLD |
| 이벤트 캘린더 | `EventCalendar.tsx` — FOMC/CPI/NFP 하드코딩 2025-2026 |

### Phase 2D (고급 기능)

| 기능 | 핵심 파일 |
|------|----------|
| SSE 스트리밍 | `ipc.ts` (claude:chat-stream), `claude.ts` (streamOneRound) |
| focusedCard 컨텍스트 | `Card.tsx` (onClick), `useChatStore.ts`, `claude.ts` ([FOCUSED CARD CONTEXT]) |
| Investigation 업그레이드 | `useInvestigationStore.ts` (loadPanelData 4단계), 5개 Investigation*.tsx |
| 선물 데이터 | `binanceFuturesApi.ts` — 펀딩비, OI → Overview 패널에 추가 |
| 김치 프리미엄 | `upbitApi.ts`, `PriceTicker.tsx` (KimchiIndicator) |
| 웹뷰 인식 | `WebviewCard.tsx` (captureMetadata, checkWebviewEdges), [OPEN WEBVIEWS] 프롬프트 |

---

## 5. 핵심 아키텍처 결정 사항

### 5.1 Main↔Renderer IPC 패턴

```
[Renderer]                              [Main]
window.api.someMethod(params)  →→→  ipcMain.handle('channel', handler)
                               ←←←  return result

window.api.startChatStream()   →→→  ipcMain.on('claude:chat-stream', handler)
                               ←←←  event.sender.send('stream:text-delta', data)
                               ←←←  event.sender.send('stream:tool-start', data)
                               ←←←  event.sender.send('stream:end', {})
```

- `handle/invoke`: 1:1 요청-응답 (대부분의 REST API 호출)
- `on/send`: 1:N 스트리밍 (Claude SSE만 사용)
- 새 API 추가 패턴: `main/xxxApi.ts` → `ipc.ts에 handle 등록` → `preload.ts에 메서드 추가` → `renderer에서 window.api.xxx() 호출`

### 5.2 AI 스트리밍 방식 (SSE)

```
claude.ts sendMessage()
  └→ streamOneRound() [Promise]
       ├→ api.startChatStream(payload)     // fire-and-forget
       ├→ onStreamEvent('stream:text-delta')  // 텍스트 조각 → 메시지 실시간 업데이트
       ├→ onStreamEvent('stream:tool-start')  // 도구 호출 시작
       ├→ onStreamEvent('stream:tool-delta')  // 도구 입력 JSON 조각 누적
       └→ onStreamEvent('stream:end')         // resolve() → 다음 턴 또는 완료
```

- 도구 입력 JSON은 조각으로 도착 → `jsonStr`에 누적 후 `stream:end` 시점에 `JSON.parse`
- 멀티턴 루프: `tool_use` stop_reason이면 도구 실행 → `tool_result`를 user 메시지로 추가 → 다음 라운드
- 최대 10턴 제한

### 5.3 focusedCard 컨텍스트 방식

```
Card.tsx content 클릭 → useChatStore.setFocusedCard({id, title, content})
  → ChatPanel.tsx에 "xxx 참조 중" 바 표시
  → 다음 sendMessage() 시 buildSystemPrompt()에서 [FOCUSED CARD CONTEXT] 섹션 추가
  → AI가 해당 카드 내용을 참조하여 응답
  → 빈 캔버스 클릭 → clearFocusedCard()
```

### 5.4 동적 코인 검색 (하드코딩 → CoinGecko search fallback)

```
useInvestigationStore.ts loadPanelData():
  1. SYMBOL_TO_COINGECKO[symbol] 하드코딩 맵 확인 (22개 코인)
  2. 없으면 → api.searchCoinId(symbol) → CoinGecko /search API 호출
  3. 결과를 resolvedCache에 캐싱 (재요청 방지)
```

`coingeckoApi.ts`의 `searchCoinId()`:
- 하드코딩 맵 → 캐시 → API 검색의 3단계 우선순위
- 검색 결과에서 symbol이 정확히 일치하는 것 선택

### 5.5 TradingView iframe 차트

`InvestigationChart.tsx`:
- `https://www.tradingview.com/widgetembed/` URL에 `BINANCE:${symbol}USDT` 파라미터
- iframe sandbox: `allow-scripts allow-same-origin allow-popups`
- lightweight-charts가 아닌 TradingView 위젯 사용 (풍부한 기능)

### 5.6 AI 뉴스 스코어링 배치 처리

`scoringService.ts`:
- Haiku 모델(`claude-haiku-4-5-20251001`) 사용 — 비용 효율
- 5개 모이면 즉시 처리 OR 10초 타이머 만료 시 처리
- 한 번에 최대 10개
- JSON 파싱 2단계: `JSON.parse` → 실패 시 `text.match(/\[[\s\S]*\]/)` regex 추출
- 결과를 `useFeedStore.updateScoring()`으로 반영

### 5.7 심볼 파싱은 AI 프롬프트로 처리

`claude.ts` 시스템 프롬프트에 명시:
```
IMPORTANT — Symbol Field Rules:
- 'BTCUSDT 분석' → symbol: 'BTC' (not 'BTCUSDT')
- 'TRIAUSDT' → symbol: 'TRIA'
```
- 코드에서 별도 파싱 로직 없이 AI가 올바른 base symbol을 추출하도록 유도
- `useInvestigationStore.ts`의 `loadPanelData()`에서도 안전장치로 suffix strip: `symbol.replace(/(USDT|BUSD|FDUSD|USD|KRW|BTC)$/i, '')`

---

## 6. 스킵된 기능과 이유

### 2D-1: Insight Pulse (Cross-Analysis Alerts) — 스킵

**원래 계획**: AI가 캔버스 노드 간 관계를 자동 분석하여 💡 칩을 표시, 클릭 시 패턴/신뢰도 팝업

**스킵 이유**:
1. focusedCard + 카드 간 엣지로 이미 관계 시각화 가능
2. 자동 분석은 매 카드 추가/가격 변동 시 Claude API를 호출해야 해서 **API 비용이 과도**
3. 스코어링 서비스(Haiku)도 이미 뉴스 중요도를 평가 중 — 추가 API 호출 부담
4. 사용자가 직접 카드를 참조하여 AI에게 물어보는 방식이 더 자연스러움

**향후 구현 시 참고**: InsightPulse 서비스는 scoringService와 유사한 패턴으로, 캔버스 변경 시 debounce → 배치 분석 → 칩 표시 방식이 적절

### Investigation Mode 미구현 부분

- **Panel drag-to-reposition**: 그리드 내 패널 순서 변경 — 미구현 (고정 3×2)
- **Pop-out button**: 패널을 플로팅 오버레이로 분리 — 미구현

---

## 7. 알려진 이슈 / 기술 부채

### 7.1 카테고리 색상 매핑 중복 (4곳)

동일한 7색 매핑이 4개 파일에 독립적으로 정의됨:
- `FeedItem.tsx` — `CATEGORY_COLORS` 객체
- `FeedSidebar.tsx` — `ALL_CATEGORIES` 배열 내 `color` 필드
- `MultiColumnFeed.tsx` — `COLUMNS` 배열 내 `color` 필드
- `EventCalendar.tsx` — `CATEGORY_COLOR` 객체

**추가로**: `Card.tsx`와 `NodeEdge.tsx`에 동일한 `getAccentColor()` 함수가 중복 정의됨

**해결 방안**: `src/renderer/constants/colors.ts`에 `CATEGORY_COLORS`, `IMPORTANCE_COLORS`, `getAccentColor`를 통합 정의

### 7.2 타입 안전성 문제

- `claude.ts`에서 `(window as any).api` 사용 (2곳) — 타입 정의 필요
- `feedService.ts`에서 `(window as unknown as { api: Record<string, Function> })` 사용 (2곳)
- `WebviewCard.tsx`에서 `(c as any).content` 사용 — 타입 가드로 대체 가능
- `useInvestigationStore.ts`에서 `api`를 `(window as unknown as ...)` 캐스팅

**해결 방안**: `src/renderer/types/index.ts`에 `WindowApi` 인터페이스를 정의하고, `window.api`의 타입을 선언

### 7.3 console.log 디버그 문

- `claude.ts` — `[TRAVIS] search_web called`, `[TRAVIS] sendMessage` (3곳)
- `scoringService.ts` — `[ScoringService] batch scoring failed`
- `feedService.ts` — `[feedService] ... failed`

**해결 방안**: 디버그 플래그 또는 로거 유틸리티 도입

### 7.4 빈 catch 블록 (Silent Error)

- `binanceWs.ts` — JSON 파싱 실패 무시, WebSocket onerror 빈 처리
- `claude.ts` — 도구 JSON 파싱 실패 무시, 개별 심볼 시세 fetch 실패 무시
- `WebviewCard.tsx` — URL 파싱, webview 메타데이터 캡처 실패 무시
- `ipc.ts` — SSE 스트림 파싱 실패 무시

### 7.5 하드코딩 매직넘버

- 캔버스: `CARD_GAP=24`, `ROW_WRAP_WIDTH=1400`, 시작점 `(80, 80)`
- 스트리밍: `max_tokens=4096`, `maxTurns=10`
- 폴링: CryptoCompare `60_000ms`, FearGreed `300_000ms`
- WebSocket: `reconnectDelay=1000`, `MAX_RECONNECT_DELAY=30000`
- 시세 바: tradFi 폴링 `60_000ms`, 김치 폴링 `60_000ms`
- 가격 플래시: `500ms` 타임아웃
- AI 스코어링: `BATCH_SIZE=5`, `MAX_BATCH=10`, `TIMER_MS=10_000`

### 7.6 드래그 핸들러 중복

`Card.tsx`와 `WebviewCard.tsx`에 거의 동일한 드래그/리사이즈 로직이 각각 구현됨. 커스텀 훅(`useDraggable`, `useResizable`)으로 추출 가능.

### 7.7 Anthropic API 버전 중복

`ipc.ts`에서 `'anthropic-version': '2023-06-01'`이 2곳에 하드코딩. 상수로 추출 필요.

### 7.8 타임아웃 누락

- `ipc.ts` SSE 스트리밍에 타임아웃 없음 — 서버 행 시 무한 대기 가능
- `binanceWs.ts` WebSocket 연결에 타임아웃 없음

---

## 8. 다음 개발 단계 후보

### Phase 3 후보 기능

| 우선순위 | 기능 | 설명 |
|---------|------|------|
| **높음** | Insight Pulse | 캔버스 노드 간 자동 크로스 분석 (2D-1 스킵분) |
| **높음** | 포트폴리오 트래커 | 보유 자산 관리, 손익 계산, 리스크 분석 |
| **높음** | 알림 시스템 | 가격 알림, 뉴스 알림, 김치 프리미엄 알림 |
| **중간** | 히스토리/세이브 | 캔버스 상태 저장/불러오기, 세션 복구 |
| **중간** | 사용자 인증 | 로그인, 프로필, 설정 클라우드 동기화 |
| **중간** | 온체인 데이터 강화 | Etherscan/Solscan API, 지갑 추적, 트랜잭션 분석 |
| **중간** | 멀티 모니터 | 팝아웃 패널, Investigation Mode 별도 창 |
| **낮음** | 소셜 피드 | Twitter/X API, Telegram 채널 모니터링 |
| **낮음** | 백테스팅 | 과거 데이터 기반 전략 검증 |

### 기술 부채 해결 우선순위

1. 카테고리 색상 통합 (`constants/colors.ts`)
2. `WindowApi` 타입 정의 (`as any` 제거)
3. 드래그 로직 커스텀 훅 추출
4. 디버그 로거 도입

---

## 9. 주요 설계 패턴 요약

### 9.1 Zustand Store 패턴

```typescript
// 새 스토어 추가 시:
// 1. src/renderer/stores/useXxxStore.ts 생성
import { create } from 'zustand'

interface XxxState {
  data: SomeType[]
  isLoading: boolean
  fetchData: () => Promise<void>
}

export const useXxxStore = create<XxxState>((set, get) => ({
  data: [],
  isLoading: false,
  fetchData: async () => {
    set({ isLoading: true })
    const result = await someApi()
    set({ data: result, isLoading: false })
  },
}))

// 2. 컴포넌트에서 사용:
const data = useXxxStore((s) => s.data)
const fetchData = useXxxStore((s) => s.fetchData)

// 3. 외부(서비스)에서 사용:
useXxxStore.getState().fetchData()
```

영구 저장이 필요하면 `persist` 미들웨어 추가:
```typescript
create<XxxState>()(persist((set) => ({...}), { name: 'xxx-storage' }))
```

### 9.2 IPC 핸들러 추가 패턴 (새 외부 API 연동 시)

```
Step 1: src/main/xxxApi.ts 생성
  → export async function fetchXxx(params): Promise<Result> { ... }

Step 2: src/main/ipc.ts에 핸들러 등록
  → import { fetchXxx } from './xxxApi'
  → ipcMain.handle('xxx:data', async (_e, { params }) => fetchXxx(params))

Step 3: src/main/preload.ts에 메서드 노출
  → fetchXxxData: (params) => ipcRenderer.invoke('xxx:data', { params }),

Step 4: Renderer에서 호출
  → const result = await (window as any).api.fetchXxxData(params)
```

### 9.3 새 데이터 소스 추가 패턴 (WebSocket)

```typescript
// 1. DataSource 인터페이스 구현
class NewExchangeDataSource implements DataSource {
  readonly name = 'newexchange'
  // connect(), disconnect(), subscribe(), unsubscribe() 구현
  // onTicker 콜백으로 데이터 전달
}

// 2. App.tsx에서 등록
const source = new NewExchangeDataSource()
source.onTicker = (data) => useRealtimeStore.getState().updateTicker(data)
dataSourceManager.registerSource(source)
```

### 9.4 새 UI 컴포넌트 추가 패턴

```
1. src/renderer/components/XxxComponent.tsx 생성
2. 디자인 시스템 색상 사용: bg-void, bg-deep, bg-card, text-t1~t4
3. 폰트: font-mono (데이터), font-rajdhani (제목)
4. 스토어 연결: const data = useXxxStore((s) => s.data)
5. App.tsx 또는 부모 컴포넌트에서 import + 배치
```

### 9.5 새 Investigation 패널 추가 패턴

```
1. PanelType에 새 타입 추가: 'newpanel'
2. InvestigationNewPanel.tsx 컴포넌트 생성
3. InvestigationPanel.tsx의 PanelContent에 case 추가
4. useInvestigationStore.ts의 buildCoinPanels()에 패널 추가
5. loadPanelData()에 데이터 fetch 로직 추가
```

### 9.6 AI 도구 추가 패턴

```
1. claude.ts TOOLS 배열에 새 도구 정의 추가
2. executeTool() switch문에 case 추가
3. 필요 시 새 IPC 핸들러 연결 (패턴 9.2 참조)
```

---

## 핵심 명령어

```bash
npm run dev      # 개발 서버 시작 (Electron + Vite)
npm run build    # 프로덕션 빌드
npx tsc --noEmit # TypeScript 타입 체크 (빌드 없이)
```

## 핵심 문서

- `CLAUDE.md` — 프로젝트 규칙, 디자인 시스템, 아키텍처 개요
- `docs/plan.md` — Phase 1-2 개발 계획 체크리스트
- `docs/current-task.md` — 현재 진행 상태
- `docs/DEVELOPER_GUIDE.md` — 10챕터 개발자 가이드북 (코드 포함, 한국어)
