# TRAVIS Context Handoff

> 이 문서를 새 Claude AI 채팅창에 붙여넣으면, TRAVIS 프로젝트의 모든 맥락을 즉시 파악하고 바로 개발 작업을 이어갈 수 있습니다.
> 마지막 업데이트: 2026-03-02 | Phase 3A 완료 시점

---

## 프로젝트 개요

- **TRAVIS** = AI 암호화폐 트레이딩 인텔리전스 데스크톱 앱
- Electron 33 + React 18 + TypeScript + Zustand + TailwindCSS + Vite
- **핵심 가치**: 사용자가 자연어로 말하면 AI가 정보 카드/차트/웹사이트를 무한 캔버스에 자동 배치
- 아이언맨의 JARVIS를 트레이더 버전으로 만든 것
- **내부 프레임워크 — Killchain**: DETECT → COLLECT → JUDGE → EXECUTE
- **핵심 철학 — Mosaic Theory**: AI는 데이터를 필터링하지 않음. 중요도만 매김. Raw Feed가 기본. "AI가 건너뛴 타일이 당신을 부자로 만들 수도 있다."
- CEO/솔로 파운더: 김준수 (한양대 경영학, 휴학 중, 풀스택을 AI로 독학)
- 총 코드 ~10,300줄 (50+ 파일)

---

## 현재 상태

- **Phase 1** (기본 구조) ✅ — 캔버스, 채팅, 카드, WebSocket, Investigation Mode
- **Phase 2** (모자이크 인텔리전스) ✅ — 탭, 뉴스, FEED탭, 세계지도, 캘린더, SSE, 선물, 김프
- **Phase 3A** (AI 도구 무장 + 체감 속도) ✅ — 17개 도구, 6거래소, CMC, 스켈레톤, 사운드, 에러 처리
- **Phase 3B** (개인화 + 기억 시스템) — **미시작** (온보딩, 프로필, SQLite, 캔버스 저장, i18n)

---

## 핵심 아키텍처

### Electron 2-프로세스 구조
```
Main Process (뒷방)          ←— IPC (30채널) —→     Renderer Process (무대)
  API 호출, WebSocket,                              React UI, AI 서비스,
  보안 처리                                          Zustand 7개 스토어
```

### 5-Step 도구 추가 패턴 (모든 AI 도구는 이 5단계를 따름)
1. `src/main/api/[name]Api.ts` — 실제 API 호출 로직
2. `src/main/ipc.ts` — IPC handler 등록
3. `src/main/preload.ts` — contextBridge에 메서드 노출
4. `src/renderer/services/claude.ts` — TOOLS 배열에 도구 정의
5. `src/renderer/services/claude.ts` — executeTool()에 case 추가

### 설계 원칙
- **하드코딩 금지** — AI 행동을 코드에서 분기하지 않음. AI에게 도구 주고 프롬프트에 원칙만 적음
- **독립적 실패** — 모든 fetch는 Promise.allSettled. 하나 실패해도 나머지 정상
- **Fire Hose** — 도구는 모든 데이터를 반환, AI가 필터링/요약
- **비용 의식** — 메인 대화=Sonnet, 뉴스 스코어링=Haiku, 무료 API 우선
- **Lazy Connection** — 안 쓰면 안 연결 (CCXT Pro WS는 5분 idle 시 자동 해제)
- **동적 심볼 해석** — CoinGecko /search로 아무 코인이든 자동 resolve (한국어 포함)

---

## AI 도구 17개 (claude.ts, 1500줄)

### Display (7)
| 도구 | 파라미터 | 하는 일 |
|------|---------|---------|
| `spawn_card` | title, content, cardType?, symbol?, images?, relatedTo? | 정보 카드 생성 (스켈레톤→콘텐츠 2단계) |
| `spawn_webview` | url, title, width?, height? | 웹사이트 캔버스 임베드 |
| `spawn_multiple_cards` | cards[], webviews?[] | 복수 카드+웹뷰 동시 (그리드 배치 + 자동 연결선) |
| `remove_cards` | target | 카드 삭제 ("all" 또는 ID) |
| `rearrange` | layout | 카드 재배치 ("grid"/"stack") |
| `update_card` | cardId, content | 기존 카드 내용 수정 |
| `control_webview` | webviewId, action, url?, symbol?, interval?, width?, height? | 웹뷰 조작 (navigate/resize/tv_change_symbol/tv_change_interval) |

### Data (8)
| 도구 | 하는 일 | 데이터 출처 |
|------|---------|-------------|
| `fetch_coin_data` | 코인 종합 (가격, 시총, 공급량, 차트) | CoinGecko + Binance + CMC |
| `fetch_market_overview` | 시장 전체 (BTC 도미넌스, 총 시총, F&G, Top 상승/하락) | CoinGecko + Alternative.me |
| `fetch_derivatives_data` | 선물 8개 API (펀딩비, OI, 롱숏비, 청산) | Binance Futures |
| `fetch_whale_activity` | 고래 대형 거래 + 호가벽 | Binance |
| `fetch_trending` | 트렌딩 코인/NFT/카테고리 | CoinGecko |
| `fetch_exchange_price` | 특정 거래소 가격 | CCXT (6거래소) |
| `compare_exchange_prices` | 멀티 거래소 비교 + 김치 프리미엄 | CCXT + Upbit |
| `search_web` | 최신 뉴스/이벤트 웹 검색 | Tavily |

### Analysis (2)
| 도구 | 하는 일 |
|------|---------|
| `open_investigation` | Investigation Mode 전체화면 분석 열기 |
| `update_investigation` | 패널 동적 추가/제거/수정/순서변경 |

---

## 주요 파일 맵

### Main Process (src/main/)
```
index.ts                    ⭐ 앱 시작점, BrowserWindow 생성, IPC 등록 호출
ipc.ts                      ⭐ IPC 핸들러 30개 등록 (모든 API 라우팅)
preload.ts                  ⭐ contextBridge 보안 브릿지 (35개 메서드)
tavily.ts                      Tavily 웹 검색 API
binanceApi.ts                  Binance REST (체결, 시세, 캔들)
binanceFuturesApi.ts           Binance 선물 (펀딩비, OI)
coingeckoApi.ts                CoinGecko (코인 데이터, 검색)
upbitApi.ts                    Upbit 김치 프리미엄
yahooFinance.ts                전통자산 시세 (S&P500, 금, DXY)
feedApi.ts                     CryptoCompare 뉴스 + Fear&Greed
api/coinDataApi.ts             코인 종합 (CoinGecko+Binance+CMC 합침)
api/marketOverviewApi.ts       시장 전체 현황
api/derivativesApi.ts          선물 8개 엔드포인트
api/whaleApi.ts                고래 거래 탐지
api/trendingApi.ts             트렌딩 코인
api/symbolResolverApi.ts       동적 심볼 해석 (CoinGecko /search)
api/exchangeService.ts         CCXT 6거래소 통합
api/cmcApi.ts                  CoinMarketCap 보조 데이터
api/utils/fetchWithRetry.ts    자동 재시도 (exponential backoff, 3회)
services/exchangeWsService.ts  CCXT Pro WebSocket (멀티거래소 실시간)
```

### Renderer Process (src/renderer/)
```
App.tsx                     ⭐ 루트: Boot → TabBar + (COMMAND|FEED) + StatusBar + Ticker
services/claude.ts          ⭐⭐ AI 두뇌 (1500줄): 17도구, SSE 스트리밍, 멀티턴 루프, 시스템 프롬프트
services/dataSource.ts         DataSource 인터페이스 + Manager (참조 카운팅)
services/binanceWs.ts          Binance WebSocket (지수 백오프 재연결)
services/feedService.ts        뉴스 수집 (CryptoCompare 60s + F&G 300s 폴링)
services/scoringService.ts     AI 뉴스 스코어링 (Haiku 배치, 5개씩/10초)
services/soundService.ts       Web Audio API 사운드 합성 (부팅/스폰/응답/알림)
stores/useCanvasStore.ts    ⭐ cards[], edges[], viewport, 카드 CRUD, 엣지, 자동 배치
stores/useChatStore.ts         messages[], isLoading, streamingMessageId, focusedCard
stores/useSettingsStore.ts     API 키 3개, 모델, 컨텍스트 (유일하게 localStorage 영구 저장)
stores/useRealtimeStore.ts     tickers{}, connectionStatus, subscribe/unsubscribe
stores/useInvestigationStore.ts  panels[], 6패널 기본, loadPanelData (4-phase async)
stores/useTabStore.ts          activeTab: 'command' | 'feed'
stores/useFeedStore.ts         items[] (max 200), filters, AI 스코어링 결과
components/Canvas.tsx       ⭐ 무한 캔버스 (패닝, 줌 0.1x~3x, 그리드 배경)
components/ChatPanel.tsx    ⭐ AI 채팅 (스트리밍, focusedCard 컨텍스트 바)
components/Card.tsx         ⭐ 정보 카드 (마크다운, 실시간 가격, 드래그/리사이즈, 더블클릭→Investigation)
components/WebviewCard.tsx     웹뷰 카드 (메타데이터 캡처, webviewRefs Map, 자동 엣지)
components/InvestigationMode.tsx  전체화면 분석 (동적 그리드, ESC 닫기)
components/InvestigationPanel.tsx 패널 라우터 (chart/news/whale/onchain/sector/markdown)
components/Investigation[Chart|News|Whale|Onchain|Sector].tsx  각 패널 구현체
components/BootSequence.tsx    시네마틱 부팅 (3.5초, 궤도 링 + 상태 메시지)
components/TabBar.tsx          COMMAND/FEED 탭 전환
components/NewsFeed.tsx        좌측 실시간 뉴스 패널
components/FeedItem.tsx        개별 뉴스 (드래그→캔버스 카드 생성, 중요도 뱃지)
components/MosaicFeed.tsx      FEED 탭 레이아웃 (지도/캘린더 + 7열 피드)
components/WorldMap.tsx        세계지도 + 뉴스 핀 (중요도 색상, 5분 내 펄스)
components/EventCalendar.tsx   FOMC/CPI/NFP 캘린더 (2025-2026)
components/EdgeLayer.tsx       연결선 SVG 레이어 + ON/OFF 토글
components/NodeEdge.tsx        개별 연결선 (strong/weak/speculative)
components/PriceTicker.tsx     하단 무한 스크롤 시세 (크립토+전통+김프)
components/StatusBar.tsx       WebSocket 연결 상태
components/LatencyIndicator.tsx  데이터 지연 표시
components/SettingsModal.tsx   설정 (API 키 3개, 모델, 컨텍스트, AI스코어링, 사운드)
types/index.ts                 TypeScript 타입 전체 (CardData, WebviewData, EdgeData, TickerData, FeedItem 등)
utils/geoKeywords.ts           키워드→좌표 매핑 (15개 도시), extractLocation()
```

---

## 데이터 소스

| API | 무료/유료 | 용도 | 호출 방식 |
|-----|-----------|------|-----------|
| **CoinGecko** | 무료 | 코인 메타, 가격, 트렌딩, 심볼 검색 | 사용자 요청 시 |
| **Binance REST** | 무료 | 실시간 가격, 체결, 캔들 | 사용자 요청 시 |
| **Binance Futures** | 무료 | 펀딩비, OI, 롱숏비, 청산 (8개 API) | 사용자 요청 시 |
| **Binance WebSocket** | 무료 | 실시간 가격 스트리밍 | 항상 연결 |
| **CCXT 6거래소** | 무료 | Binance/Upbit/Bybit/Bithumb/OKX/Coinbase | 사용자 요청 시 |
| **CCXT Pro WS** | 무료 | 멀티거래소 실시간 (lazy, 5min idle 해제) | 필요 시 |
| **CoinMarketCap** | 유료(선택) | 순위, 카테고리, 출시일 | 사용자 요청 시 |
| **Tavily** | 유료(필수) | AI 웹 검색 | 사용자 요청 시 |
| **CryptoCompare** | 무료 | 크립토 뉴스 | 60초 폴링 |
| **Alternative.me** | 무료 | Fear & Greed 지수 | 5분 폴링 |
| **Upbit** | 무료 | 김치 프리미엄 | 60초 폴링 |
| **Yahoo Finance** | 무료 | S&P500, NASDAQ, DXY, 금, 유가 | 60초 폴링 |
| **Claude API** | 유료(필수) | AI 대화 + 17개 도구 (Sonnet) | 사용자 요청 시 |
| **Claude Haiku** | 유료(저렴) | 뉴스 AI 스코어링 (배치) | 뉴스 수신 시 |

---

## 시스템 프롬프트 구조 (buildSystemPrompt)

claude.ts의 `buildSystemPrompt()`가 매 요청마다 동적으로 생성:

```
[BASE_SYSTEM_PROMPT]
  - TRAVIS 역할/성격 정의
  - Symbol Field Rules: symbol은 반드시 base만 (BTC, 절대 BTCUSDT 아님)
  - Card Connections: relatedTo로 연결선 생성
  - Web Search: 시사/뉴스는 반드시 search_web 먼저
  - Canvas Visualization Rules: 데이터 조회 후 반드시 spawn으로 시각화
  - Tool Efficiency Rules: 불필요한 도구 호출 최소화

[USER CONTEXT]  (설정한 경우)
  사용자 프로필 (예: "나는 BTC 롱 포지션, 단타 위주")

[REAL-TIME MARKET DATA]  (코인 감지 시)
  사용자가 언급한 코인의 Binance 실시간 시세 자동 첨부

[CURRENT CANVAS STATE]
  캔버스 위 모든 카드 목록 (ID, 제목, 타입)

[OPEN WEBVIEWS]  (웹뷰 있을 때)
  열린 웹페이지 제목/URL + control_webview 사용 가이드

[INVESTIGATION MODE — ACTIVE]  (분석 모드 열려있을 때)
  분석 대상 심볼 + 현재 패널 목록 + update_investigation 가이드

[FOCUSED CARD CONTEXT]  (카드 클릭 시)
  선택된 카드의 전체 내용 (2000자 제한)
```

---

## Phase 3 전체 로드맵

### Phase 3A (완료 ✅) — 17개 태스크
동적 심볼 해석, fetch_coin_data, fetch_market_overview, fetch_derivatives_data, fetch_whale_activity, fetch_trending, spawn_multiple_cards, 스켈레톤 카드, SSE/Tool 타임아웃 (60s/30s), 사운드 피드백, fetchWithRetry, CCXT 6거래소, CCXT Pro WebSocket, CoinMarketCap, Investigation 동적 패널, control_webview

### Phase 3B (미시작) — 개인화 + 기억 시스템
1. **온보딩 플로우** — 첫 실행 시 5단계 위저드 (거래소, 스타일, 관심 종목, 언어)
2. **유저 프로필** — electron-store 영구 저장, 설정에서 수정
3. **시스템 프롬프트 주입** — [USER PROFILE] + [PREVIOUS SESSION SUMMARY] + [CUSTOM DEFINITIONS]
4. **관심 종목 프리로드** — 앱 시작 시 watchlist 코인 미리 fetch
5. **SQLite 에피소딕 메모리** — better-sqlite3, sessions/mentions/insights 테이블
6. **커스텀 정의 학습** — 사용자 주관적 표현 저장 + AI 주입
7. **캔버스 저장/복원** — 앱 종료 시 auto-save, 다음 실행 시 복원
8. **세션 요약** — Haiku로 대화 압축, 다음 세션에 주입
9. **i18n** — ko.json/en.json, 프로필 언어 따름
10. **뉴스 번역** — Haiku로 영→한 번역 (배치, 캐싱)

### Phase 3C (미정) — 고급 기능
포트폴리오 트래커, 알림 시스템, 온체인 데이터 강화, 멀티 모니터 등

---

## 핵심 아키텍처 패턴

### AI 멀티턴 루프
```
사용자 질문 → buildSystemPrompt() → Claude API (SSE 스트리밍)
  └→ stopReason="tool_use" → executeTool() → 결과를 대화에 추가 → 다시 API 호출
  └→ stopReason="end_turn" → 최종 답변 (루프 종료)
  └→ 최대 25턴
```

### 스켈레톤 카드 (2단계 스폰)
```
Phase 1: isLoading=true 빈 카드 즉시 생성 (shimmer 애니메이션)
  ↓ 100ms
Phase 2: 실제 콘텐츠 채움 + isLoading=false + 사운드 ♪
```

### SSE 스트리밍 이벤트
```
ipc.ts → Claude API SSE → stream:text-delta (텍스트 조각)
                         → stream:tool-start (도구 호출 시작)
                         → stream:tool-delta (도구 입력 JSON 조각)
                         → stream:end (완료)
```

### IPC 패턴
```
Renderer: window.api.someMethod(params)  →→→  Main: ipcMain.handle('channel', handler)
                                          ←←←  return result

SSE만: on/send 패턴 (1:N 스트리밍)
```

### Investigation Mode 데이터 로드 (4-phase)
```
1. 심볼 해석: SYMBOL_TO_COINGECKO 맵 → 없으면 CoinGecko /search
2. 병렬 fetch: Promise.allSettled (Binance 체결 + CoinGecko + 섹터 시세)
3. 패널별 독립 업데이트: Whale, On-chain, Sector 각각
4. 선물 보충: 펀딩비, OI (실패해도 OK)
```

---

## 기술 부채 / 알려진 이슈

- `(window as any).api` 타입 캐스팅 4곳 → WindowApi 인터페이스 정의로 교체
- 카테고리 색상 정의 중복 4곳 (FeedItem, FeedSidebar, MultiColumnFeed, EventCalendar) → constants.ts 통합
- Card/WebviewCard 드래그 로직 중복 → useDraggable 커스텀 훅 추출
- console.log 디버그문 잔류 → 조건부 로거 도입
- `anthropic-version` 하드코딩 2곳 (ipc.ts) → 상수로 통합

---

## 디자인 시스템

```
배경:  --void #01010a → --deep #030310 → --panel #06060f → --card #0a0a18
강조:  보라 #a855f7 | 시안 #22d3ee | 초록 #22c55e | 빨강 #ef4444 | 앰버 #f59e0b
카테고리: MACRO=앰버 | CRYPTO=보라 | ON-CHAIN=시안 | EXCHANGE=빨강 | SOCIAL=초록 | STOCKS=파랑 | WORLD=핑크
폰트:  JetBrains Mono (데이터) | Rajdhani (제목, 밀리터리 느낌)
```

---

## 명령어

```bash
npm run dev      # 개발 서버 (Electron + Vite HMR)
npm run build    # 프로덕션 빌드
```

## 핵심 문서

- `CLAUDE.md` — 프로젝트 규칙, 디자인 시스템, 아키텍처 규칙, 17개 도구 정의
- `docs/plan.md` — Phase 1~3B 개발 체크리스트
- `docs/current-task.md` — 현재 진행 상태 (Phase 3A 완료)
- `docs/architecture.md` — 전체 아키텍처 가이드 (14개 섹션, 비기술자용)

## 대화 스타일

- 준수님은 한국어로 소통, 코드/변수명은 영어
- 비전공자이므로 기술 설명 시 비유와 예시 활용
- 실행력이 높으므로 Claude Code에 바로 복붙할 수 있는 형태로 제공
- 모든 AI 도구 추가는 반드시 5-step 패턴을 따름
- Phase 단위로 작업, 한 번에 하나씩
