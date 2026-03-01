# TRAVIS Architecture Guide

> 이 문서는 TRAVIS의 전체 코드 아키텍처를 설명합니다.
> 기술적 배경이 없는 대표님도 "이 앱이 내부적으로 어떻게 돌아가는지" 완전히 이해할 수 있도록 작성했습니다.

---

## 목차

1. [Big Picture — 앱의 전체 구조](#1-big-picture)
2. [데이터 흐름 — "BTC 분석해줘" 한 마디의 여정](#2-데이터-흐름)
3. [파일 맵 — 모든 파일의 역할](#3-파일-맵)
4. [상태 관리 — 7개의 Zustand 스토어](#4-상태-관리)
5. [AI 시스템 — Claude API + 17개 도구](#5-ai-시스템)
6. [데이터 소스 — 외부 API 연동](#6-데이터-소스)
7. [실시간 시스템 — WebSocket + 폴링](#7-실시간-시스템)
8. [UI 컴포넌트 — 화면을 구성하는 부품들](#8-ui-컴포넌트)
9. [사운드 시스템](#9-사운드-시스템)
10. [Investigation Mode — 딥 분석](#10-investigation-mode)
11. [설정 시스템](#11-설정-시스템)
12. [에러 처리 + 복원력](#12-에러-처리)
13. [설계 원칙](#13-설계-원칙)
14. [기술 스택 해설 + 용어집](#14-기술-스택-해설)

---

## 1. Big Picture

### TRAVIS가 뭔가요?

TRAVIS는 트레이더를 위한 **AI 비서 데스크톱 앱**입니다.
사용자가 채팅창에 자연어로 질문하면("BTC 분석해줘"), AI가 판단해서
실시간 시세 카드, 차트, 뉴스, 웹사이트를 **무한 캔버스** 위에 자동으로 펼쳐놓습니다.

영화 아이언맨의 자비스(JARVIS)가 토니 스타크에게 정보를 띄워주듯,
TRAVIS는 트레이더에게 필요한 모든 정보를 한 화면에 띄워줍니다.

### Electron이란?

TRAVIS는 **Electron**이라는 기술로 만든 데스크톱 앱입니다.
Electron은 쉽게 말해 **"웹 브라우저를 앱처럼 포장한 것"**입니다.

```
┌─────────────────────────────────────────────────┐
│              TRAVIS 데스크톱 앱                    │
│                                                   │
│  ┌──────────────────────────────────────────┐    │
│  │         Main Process (뒷방)               │    │
│  │  API 호출, 파일 접근, 보안 처리             │    │
│  │  → 사용자 눈에 보이지 않음                  │    │
│  └──────────────┬───────────────────────────┘    │
│                 │ IPC (내부 전화선)                │
│  ┌──────────────┴───────────────────────────┐    │
│  │       Renderer Process (무대)             │    │
│  │  React로 만든 화면 (캔버스, 채팅, 카드)     │    │
│  │  → 사용자가 직접 보고 만지는 부분            │    │
│  └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

**비유하면:**
- **Main Process** = 식당 주방. 손님(사용자)은 못 들어가지만, 요리(API 호출, 데이터 가공)가 여기서 이루어짐
- **Renderer Process** = 식당 홀. 손님이 앉아서 메뉴(채팅)를 주문하고 음식(카드, 차트)을 받는 곳
- **IPC** = 주방↔홀 사이의 호출벨. 홀에서 "BTC 데이터 주세요" 주문하면, 주방에서 만들어서 보내줌

### 왜 이렇게 나눠놨나요?

**보안** 때문입니다. API 키(비밀번호 같은 것)는 주방(Main)에서만 다루고,
홀(Renderer)은 "이거 가져다주세요"만 요청합니다. 해커가 화면(홀)을 뚫어도
API 키에 직접 접근할 수 없습니다.

---

## 2. 데이터 흐름

### "BTC 분석해줘" 한 마디의 여정

사용자가 채팅창에 "BTC 분석해줘"를 입력하면, 내부적으로 이런 일이 벌어집니다:

```
사용자 입력: "BTC 분석해줘"
         │
         ▼
[1단계] ChatPanel 컴포넌트
         │  사용자 메시지를 useChatStore에 저장
         │  "Analyzing..." 로딩 표시
         ▼
[2단계] claude.ts — sendMessage()
         │  시스템 프롬프트 생성:
         │  ├─ 기본 AI 성격/규칙
         │  ├─ [USER CONTEXT] 사용자 프로필
         │  ├─ [REAL-TIME MARKET DATA] 실시간 시세 자동 첨부
         │  ├─ [CURRENT CANVAS STATE] 현재 캔버스 카드 목록
         │  └─ [OPEN WEBVIEWS] 열린 웹페이지 목록
         ▼
[3단계] IPC 전송 → Main Process
         │  API 키와 메시지를 주방(Main)으로 전달
         │  Main이 Claude API 서버에 SSE 스트리밍 요청
         ▼
[4단계] Claude API 응답 (SSE 스트리밍)
         │  AI가 실시간으로 글자 하나씩 보내옴
         │  동시에 "도구 호출" 결정:
         │  ├─ fetch_coin_data("BTC") → BTC 시세 조회
         │  ├─ spawn_card(분석 결과) → 카드 생성
         │  └─ spawn_webview(TradingView) → 차트 임베드
         ▼
[5단계] 도구 실행 (executeTool)
         │
         │  fetch_coin_data 실행:
         │  ├─ IPC → Main Process
         │  ├─ CoinGecko API에서 BTC 메타데이터
         │  ├─ Binance API에서 실시간 가격
         │  ├─ (옵션) CoinMarketCap에서 보조 데이터
         │  └─ 결과를 JSON으로 AI에게 반환
         │
         │  spawn_card 실행:
         │  ├─ Phase 1: 스켈레톤 카드 생성 (빈 카드 + 로딩 애니메이션)
         │  ├─ useCanvasStore.addCard() 호출
         │  ├─ 사운드 효과 재생 ♪
         │  ├─ Phase 2: 100ms 후 실제 내용 채워넣기
         │  └─ 카드가 캔버스에 등장! ✦
         │
         │  spawn_webview 실행:
         │  ├─ TradingView URL 생성
         │  ├─ useCanvasStore.addWebview() 호출
         │  └─ 차트가 캔버스에 등장! ✦
         ▼
[6단계] 도구 결과 → AI에게 다시 전달
         │  AI가 도구 결과를 보고 최종 답변 생성
         │  "BTC는 현재 $XX,XXX이며..."
         ▼
[7단계] 최종 답변 표시
         │  채팅창에 AI 답변 스트리밍
         │  캔버스에 카드 + 차트가 배치됨
         │  관련 카드 사이에 연결선(Edge) 자동 생성
         ▼
[8단계] 실시간 업데이트 시작
         카드에 symbol(BTC) 지정되어 있으므로
         Binance WebSocket 구독 → 가격 실시간 갱신
         가격 변동 시 초록/빨강 플래시 효과
```

### AI 멀티턴 루프

AI는 한 번에 끝나지 않을 수 있습니다. 위 과정이 **최대 25번 반복**됩니다:

```
사용자 질문 → AI 응답 + 도구 호출 → 도구 실행 → 결과를 AI에게 전달
                                                    → AI가 또 도구 호출
                                                    → 또 실행
                                                    → ...
                                                    → AI가 최종 텍스트 답변
```

예를 들어 "BTC와 ETH 비교해줘"라고 하면:
1. AI가 `fetch_coin_data("BTC")` 호출
2. AI가 `fetch_coin_data("ETH")` 호출
3. AI가 `spawn_multiple_cards`로 비교 카드 + 차트 여러 개 동시 생성
4. 최종 텍스트로 비교 분석 설명

---

## 3. 파일 맵

### 전체 파일 구조

```
src/
├── main/                           ← 🔒 뒷방 (Main Process)
│   ├── index.ts                    ⭐ 앱 시작점, 창 생성
│   ├── ipc.ts                      ⭐ IPC 전화선 등록 (30개 채널)
│   ├── preload.ts                  ⭐ 보안 다리 (35개 메서드)
│   ├── tavily.ts                      웹 검색 API
│   ├── binanceApi.ts                  바이낸스 REST API
│   ├── binanceFuturesApi.ts           바이낸스 선물 API
│   ├── coingeckoApi.ts                코인게코 API
│   ├── upbitApi.ts                    업비트 (김치 프리미엄)
│   ├── yahooFinance.ts                전통자산 시세 (S&P500 등)
│   ├── feedApi.ts                     뉴스 + Fear&Greed
│   ├── api/                        ← Phase 3A에서 추가된 API 모듈
│   │   ├── coinDataApi.ts             코인 종합 데이터
│   │   ├── marketOverviewApi.ts       시장 전체 현황
│   │   ├── derivativesApi.ts          선물 8개 API
│   │   ├── whaleApi.ts                고래 거래 탐지
│   │   ├── trendingApi.ts             트렌딩 코인
│   │   ├── symbolResolverApi.ts       동적 심볼 해석
│   │   ├── exchangeService.ts         CCXT 6거래소
│   │   ├── cmcApi.ts                  코인마켓캡
│   │   └── utils/
│   │       └── fetchWithRetry.ts      자동 재시도
│   └── services/
│       └── exchangeWsService.ts       CCXT Pro WebSocket
│
├── renderer/                       ← 🎨 무대 (Renderer Process)
│   ├── App.tsx                     ⭐ 루트 컴포넌트 (부팅→탭→컨텐츠)
│   ├── main.tsx                       React 진입점
│   ├── components/                 ← UI 부품 30개
│   │   ├── BootSequence.tsx           시네마틱 부팅 애니메이션
│   │   ├── Canvas.tsx              ⭐ 무한 캔버스 (드래그/줌)
│   │   ├── ChatPanel.tsx           ⭐ AI 채팅 패널
│   │   ├── Card.tsx                ⭐ 정보 카드 (마크다운, 실시간 가격)
│   │   ├── WebviewCard.tsx            웹사이트 임베드 카드
│   │   ├── InvestigationMode.tsx      전체화면 분석 모드
│   │   ├── InvestigationPanel.tsx     분석 패널 (6종)
│   │   ├── InvestigationChart.tsx     TradingView 차트
│   │   ├── InvestigationWhale.tsx     고래 거래 테이블
│   │   ├── InvestigationOnchain.tsx   온체인 데이터
│   │   ├── InvestigationSector.tsx    섹터 비교
│   │   ├── InvestigationNews.tsx      관련 뉴스
│   │   ├── SpawnAnimation.tsx         카드 등장 효과
│   │   ├── TabBar.tsx                 COMMAND/FEED 탭
│   │   ├── NewsFeed.tsx               좌측 뉴스 피드
│   │   ├── FeedItem.tsx               개별 뉴스 아이템
│   │   ├── MosaicFeed.tsx             FEED 탭 레이아웃
│   │   ├── MultiColumnFeed.tsx        7열 카테고리 피드
│   │   ├── FeedSidebar.tsx            피드 사이드바
│   │   ├── FeedColumn.tsx             단일 카테고리 열
│   │   ├── WorldMap.tsx               세계지도 + 뉴스 핀
│   │   ├── EventCalendar.tsx          경제/크립토 캘린더
│   │   ├── EdgeLayer.tsx              연결선 레이어
│   │   ├── NodeEdge.tsx               개별 연결선
│   │   ├── PriceTicker.tsx            하단 시세 스크롤
│   │   ├── StatusBar.tsx              연결 상태 표시
│   │   ├── LatencyIndicator.tsx       데이터 지연 표시
│   │   └── SettingsModal.tsx          설정 팝업
│   ├── services/                   ← 비즈니스 로직
│   │   ├── claude.ts               ⭐⭐ AI 두뇌 (17도구, SSE, 멀티턴)
│   │   ├── dataSource.ts              데이터소스 인터페이스
│   │   ├── binanceWs.ts               바이낸스 WebSocket
│   │   ├── feedService.ts             뉴스 수집 서비스
│   │   ├── scoringService.ts          AI 뉴스 스코어링
│   │   └── soundService.ts            사운드 효과
│   ├── stores/                     ← 상태 저장소 7개
│   │   ├── useCanvasStore.ts       ⭐ 카드, 엣지, 뷰포트
│   │   ├── useChatStore.ts            채팅 메시지
│   │   ├── useSettingsStore.ts        설정 (API 키 등)
│   │   ├── useRealtimeStore.ts        실시간 시세
│   │   ├── useInvestigationStore.ts   분석 모드 상태
│   │   ├── useTabStore.ts             현재 탭
│   │   └── useFeedStore.ts            뉴스 피드
│   ├── types/
│   │   └── index.ts                   TypeScript 타입 정의
│   └── utils/
│       └── geoKeywords.ts             지역 키워드→좌표 매핑
```

> ⭐ = 핵심 파일 (이 파일들을 이해하면 전체 구조의 80%를 이해한 것)

### 파일별 중요도

| 중요도 | 파일 | 왜 중요한가 |
|--------|------|-------------|
| **최상** | `claude.ts` | AI 두뇌. 17개 도구 정의, SSE 스트리밍, 멀티턴 루프 모두 여기 |
| **최상** | `ipc.ts` | Main↔Renderer 모든 통신 채널 (30개) 등록 |
| **최상** | `useCanvasStore.ts` | 캔버스 위 모든 카드/웹뷰/연결선 상태 관리 |
| **상** | `Canvas.tsx` | 무한 캔버스 (드래그, 줌, 그리드 배경) |
| **상** | `ChatPanel.tsx` | AI와 대화하는 인터페이스 |
| **상** | `Card.tsx` | 정보 카드 렌더링 (실시간 가격, 마크다운) |
| **상** | `preload.ts` | 보안 브릿지 (35개 메서드 노출) |
| **상** | `App.tsx` | 앱 전체 레이아웃 + 서비스 초기화 |
| **중** | 나머지 stores | 각 도메인별 상태 관리 |
| **중** | Investigation*.tsx | 딥 분석 모드 6개 패널 |
| **중** | api/*.ts | 개별 외부 API 호출 로직 |
| **하** | utils, types | 보조 유틸리티 |

### 파일 간 의존성

```
claude.ts (AI 두뇌)
  ├── 읽기: useCanvasStore (현재 카드 목록)
  ├── 읽기: useChatStore (대화 기록)
  ├── 읽기: useSettingsStore (API 키, 모델)
  ├── 읽기: useInvestigationStore (분석 모드 상태)
  ├── 쓰기: useCanvasStore (카드 생성/삭제/수정)
  ├── 쓰기: useChatStore (메시지 추가/스트리밍)
  ├── 쓰기: useInvestigationStore (패널 추가/삭제)
  ├── 호출: IPC (Main Process의 모든 API)
  └── 참조: WebviewCard.webviewRefs (웹뷰 DOM 제어)

Canvas.tsx (무한 캔버스)
  ├── 읽기: useCanvasStore (카드 목록, 뷰포트)
  ├── 렌더링: Card.tsx, WebviewCard.tsx, SpawnAnimation.tsx
  └── 렌더링: EdgeLayer.tsx (연결선)

App.tsx (루트)
  ├── 초기화: binanceWs (WebSocket 연결)
  ├── 초기화: feedService (뉴스 수집 시작)
  ├── 초기화: scoringService (AI 스코어링 시작)
  └── 분기: activeTab → COMMAND탭 or FEED탭
```

---

## 4. 상태 관리

### Zustand이란?

**Zustand**은 React 앱의 "공유 메모장" 같은 것입니다.
여러 컴포넌트가 같은 데이터를 읽고 쓸 수 있게 해줍니다.

TRAVIS에는 7개의 메모장(스토어)이 있고, 각각 다른 분야를 담당합니다.

### 7개 스토어 요약

```
┌─────────────────────────────────────────────────────┐
│                   TRAVIS 스토어 맵                     │
│                                                       │
│  useCanvasStore ────── 카드, 연결선, 캔버스 위치         │
│  useChatStore ──────── 채팅 메시지, AI 스트리밍 상태      │
│  useSettingsStore ──── API 키, 모델, 사용자 설정  💾    │
│  useRealtimeStore ──── 실시간 시세 (Binance WebSocket)  │
│  useInvestigationStore ── 분석 모드 패널 상태            │
│  useTabStore ────────── 현재 탭 (COMMAND / FEED)       │
│  useFeedStore ────────── 뉴스 피드 아이템, 필터          │
│                                                       │
│  💾 = localStorage에 저장됨 (앱 꺼도 유지)              │
│  나머지 = 앱 끄면 초기화                                │
└─────────────────────────────────────────────────────┘
```

### 스토어 상세

#### 1) useCanvasStore — 캔버스의 모든 것

캔버스 위의 카드, 웹뷰, 연결선, 화면 위치를 관리합니다.

| 데이터 | 설명 |
|--------|------|
| `cards` | 캔버스 위 모든 카드/웹뷰 배열 |
| `edges` | 카드 간 연결선 배열 (strong/weak/speculative) |
| `hoveredNodeId` | 마우스 올린 카드 ID |
| `pinnedNodeIds` | 고정된 카드 ID 목록 (연결선 항상 표시) |
| `viewport` | 캔버스 x, y 위치 + 줌 레벨 |

주요 기능:
- **카드 추가/삭제/수정** — AI가 도구로 호출
- **자동 배치** — 새 카드는 마지막 카드 오른쪽에 배치, 너비 초과 시 다음 줄
- **레이아웃 정리** — grid(3열) 또는 stack(1열) 재배치
- **연결선 관리** — 관련 카드 사이 선 추가, 중복 방지

#### 2) useChatStore — 대화 기록

| 데이터 | 설명 |
|--------|------|
| `messages` | 모든 채팅 메시지 (user/assistant) |
| `isLoading` | AI 응답 대기 중 여부 |
| `streamingMessageId` | 현재 스트리밍 중인 메시지 ID |
| `focusedCard` | 채팅 컨텍스트로 선택된 카드 |

focusedCard가 설정되면, AI에게 "이 카드에 대해 질문하고 있어"라는 맥락을 전달합니다.
사용자가 카드 본문을 클릭하면 해당 카드가 focusedCard로 설정됩니다.

#### 3) useSettingsStore — 설정 (유일하게 영구 저장)

| 데이터 | 기본값 | 설명 |
|--------|--------|------|
| `apiKey` | '' | Claude API 키 |
| `tavilyApiKey` | '' | Tavily 웹 검색 키 |
| `cmcApiKey` | '' | CoinMarketCap 키 |
| `contextPrompt` | '' | 사용자 프로필 (예: "나는 BTC 롱 포지션") |
| `model` | 'claude-sonnet-4-20250514' | AI 모델 |
| `enableAiScoring` | true | 뉴스 AI 스코어링 ON/OFF |
| `enableSound` | true | 사운드 ON/OFF |

이 스토어만 **localStorage**에 저장되어 앱을 껐다 켜도 유지됩니다.

#### 4) useRealtimeStore — 실시간 시세

| 데이터 | 설명 |
|--------|------|
| `tickers` | 심볼별 시세 Map (가격, 변동률, 거래량 등) |
| `connectionStatus` | WebSocket 연결 상태 |

카드에 symbol이 지정되면 자동으로 Binance WebSocket에 구독하여
가격이 실시간으로 업데이트됩니다.

#### 5) useInvestigationStore — 딥 분석 모드

| 데이터 | 설명 |
|--------|------|
| `isOpen` | 분석 모드 활성화 여부 |
| `targetCard` | 분석 대상 카드 |
| `panels` | 6개+ 분석 패널 배열 |

패널 종류: Overview, Chart, News, Whale, On-chain, Sector
각 패널은 독립적으로 데이터를 로드하고, 하나가 실패해도 나머지는 정상 동작합니다.

#### 6) useTabStore — 탭 상태

```
activeTab: 'command' | 'feed'
```

COMMAND 탭 = 캔버스 + 채팅 (AI 분석)
FEED 탭 = 세계지도 + 캘린더 + 7열 뉴스

#### 7) useFeedStore — 뉴스 피드

| 데이터 | 설명 |
|--------|------|
| `items` | 뉴스 아이템 배열 (최대 200개, 오래된 것 자동 삭제) |
| `filters.categories` | 활성 카테고리 필터 (7종) |
| `filters.importance` | 활성 중요도 필터 (4단계) |

뉴스는 60초마다 자동 수집되고, AI가 중요도를 매깁니다(0~100점).

---

## 5. AI 시스템

### 핵심 파일: claude.ts

이 파일 하나가 TRAVIS의 **AI 두뇌** 전체를 담당합니다. (코드 ~1500줄)

### 시스템 프롬프트

AI에게 보내는 "역할 설명서"입니다. 매 요청마다 동적으로 생성됩니다:

```
[기본 성격]
  "You are TRAVIS, an AI-powered trading intelligence assistant..."
  역할, 분석 원칙, 도구 사용 규칙

[USER CONTEXT]
  사용자가 설정한 프로필 (예: "나는 BTC 롱 포지션, 단타 위주")

[REAL-TIME MARKET DATA]
  현재 BTC/ETH 시세 자동 첨부 (사용자 메시지에서 코인 감지 시)

[CURRENT CANVAS STATE]
  캔버스 위 모든 카드 목록 (ID, 제목, 심볼)

[OPEN WEBVIEWS]
  열린 웹페이지 목록 (제목, URL)

[INVESTIGATION MODE - ACTIVE]  (분석 모드 열려있을 때만)
  현재 분석 중인 심볼, 패널 목록

[FOCUSED CARD CONTEXT]  (카드 선택 시)
  사용자가 클릭한 카드의 전체 내용
```

### 17개 AI 도구

AI가 사용할 수 있는 "능력"입니다. AI가 스스로 판단해서 어떤 도구를 쓸지 결정합니다.

#### Display 도구 (화면 조작) — 7개

| # | 도구 | 하는 일 |
|---|------|---------|
| 1 | `spawn_card` | 정보 카드 생성 (마크다운, 이미지, 실시간 가격 구독) |
| 2 | `spawn_webview` | 웹사이트를 캔버스에 임베드 (TradingView, 거래소 등) |
| 3 | `spawn_multiple_cards` | 여러 카드+웹뷰 동시 생성 (자동 그리드 배치 + 연결선) |
| 4 | `remove_cards` | 카드 삭제 (특정 ID 또는 "all") |
| 5 | `rearrange` | 카드 재배치 (grid = 3열, stack = 1열) |
| 6 | `update_card` | 기존 카드 내용 수정 |
| 7 | `control_webview` | 열린 웹뷰 조작 (URL 변경, 크기, TradingView 심볼/타임프레임) |

#### Data 도구 (데이터 조회) — 8개

| # | 도구 | 하는 일 | 데이터 출처 |
|---|------|---------|-------------|
| 8 | `fetch_coin_data` | 코인 종합 데이터 (가격, 시총, 공급량, 차트) | CoinGecko + Binance + CMC |
| 9 | `fetch_market_overview` | 시장 전체 현황 (BTC 도미넌스, 총 시총, F&G) | CoinGecko + Alternative.me |
| 10 | `fetch_derivatives_data` | 선물 데이터 (펀딩비, OI, 롱숏비, 청산) | Binance Futures |
| 11 | `fetch_whale_activity` | 고래 대형 거래 + 호가벽 | Binance |
| 12 | `fetch_trending` | 트렌딩 코인/NFT/카테고리 | CoinGecko |
| 13 | `fetch_exchange_price` | 특정 거래소 가격 | CCXT (6거래소) |
| 14 | `compare_exchange_prices` | 거래소 가격 비교 + 김치 프리미엄 | CCXT + 업비트 |
| 15 | `search_web` | 최신 뉴스/이벤트 웹 검색 | Tavily |

#### Analysis 도구 (분석) — 2개

| # | 도구 | 하는 일 |
|---|------|---------|
| 16 | `open_investigation` | Investigation Mode 전체화면 분석 열기 |
| 17 | `update_investigation` | 패널 동적 추가/제거/수정/순서변경 |

### sendMessage 루프

```
사용자 메시지
    │
    ▼
[시스템 프롬프트 생성] ← 실시간 시세 + 캔버스 상태 주입
    │
    ▼
[Claude API 호출] ← SSE 스트리밍 (글자 하나씩 도착)
    │
    ├── stopReason = "end_turn" → 최종 답변 (루프 종료)
    │
    └── stopReason = "tool_use" → 도구 실행 필요
            │
            ▼
        [executeTool()] ← 각 도구별 로직 실행
            │
            ▼
        [도구 결과를 대화에 추가]
            │
            ▼
        [다시 Claude API 호출] ← 최대 25번 반복
```

### 스켈레톤 카드 (2단계 스폰)

카드가 생성될 때 바로 내용이 나타나지 않습니다:

```
Phase 1: 빈 카드 프레임이 먼저 등장
         ├── isLoading: true
         ├── 반짝이는 로딩 애니메이션 (shimmer)
         └── 사운드 효과 ♪

  ... 100ms 후 ...

Phase 2: 실제 내용이 채워짐
         ├── 마크다운 텍스트
         ├── 이미지
         ├── 실시간 가격 구독 시작
         └── isLoading: false
```

이렇게 하면 AI 응답이 느려도 "뭔가 일어나고 있다"는 피드백을 즉시 줍니다.

### 동적 심볼 해석

사용자가 "리플 분석해줘", "XRP 어때?" 등 어떤 방식으로든 코인을 언급하면,
AI가 자동으로 심볼을 찾아냅니다:

```
사용자: "리플 분석해줘"
    │
    ▼
[메시지에서 코인 후보 추출] → "리플", "XRP"
    │
    ▼
[Binance 직접 조회] → XRPUSDT 있음? → Yes → 사용
                        │
                        No
                        ▼
              [CoinGecko /search API] → "리플" 검색 → "ripple" → XRP
    │
    ▼
[세션 캐시에 저장] → 다음에 같은 코인 물어보면 즉시 응답
```

하드코딩된 코인 목록이 아니라, **어떤 코인이든 자동으로 찾습니다.**
한국어 이름("리플", "비트코인", "이더리움")도 지원합니다.

---

## 6. 데이터 소스

### 외부 API 연동 전체 맵

```
┌─────────────────────────────────────────────────────────┐
│                     Main Process                         │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  CoinGecko   │  │   Binance    │  │  Binance     │  │
│  │  코인 데이터   │  │  스팟 API    │  │  선물 API    │  │
│  │  트렌딩       │  │  시세/체결    │  │  8개 엔드포인트│  │
│  │  심볼 검색    │  │  캔들차트    │  │  펀딩/OI/청산 │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │    Upbit     │  │  Yahoo Fin   │  │   Tavily     │  │
│  │  업비트 시세   │  │  전통자산     │  │  웹 검색     │  │
│  │  김치프리미엄  │  │  S&P, 금, 유 │  │  최신 뉴스   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │CryptoCompare │  │Alternative.me│  │CoinMarketCap │  │
│  │  뉴스 피드    │  │  공포/탐욕    │  │  시총 순위    │  │
│  │              │  │  지수         │  │  카테고리     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  CCXT + CCXT Pro — 6거래소 통합                    │   │
│  │  Binance, Upbit, Bybit, Bithumb, OKX, Coinbase   │   │
│  │  REST (가격 조회) + WebSocket (실시간 스트림)       │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### API별 상세

| API | 무료/유료 | 용도 | 호출 빈도 |
|-----|-----------|------|-----------|
| **CoinGecko** | 무료 (제한 있음) | 코인 메타데이터, 가격, 트렌딩, 심볼 검색 | 사용자 요청 시 |
| **Binance REST** | 무료 | 실시간 가격, 최근 체결, 캔들차트 | 사용자 요청 시 |
| **Binance Futures** | 무료 | 펀딩비, OI, 롱숏비, 청산내역 등 8개 | 사용자 요청 시 |
| **Binance WebSocket** | 무료 | 실시간 가격 스트리밍 | 항상 연결 |
| **Upbit** | 무료 | 한국 거래소 가격 (김치 프리미엄 계산) | 60초마다 |
| **Yahoo Finance** | 무료 | S&P500, NASDAQ, DXY, 금, 유가 | 60초마다 |
| **Tavily** | 유료 (키 필요) | AI 웹 검색 | 사용자 요청 시 |
| **CryptoCompare** | 무료 | 크립토 뉴스 피드 | 60초마다 |
| **Alternative.me** | 무료 | 공포/탐욕 지수 | 5분마다 |
| **CoinMarketCap** | 유료 (선택) | 보조 데이터 (순위, 카테고리, 출시일) | 사용자 요청 시 |
| **CCXT (6거래소)** | 무료 | 거래소별 가격 비교 | 사용자 요청 시 |
| **CCXT Pro WS** | 무료 | 거래소별 실시간 스트림 | 필요 시 연결 |
| **Claude API** | 유료 (키 필요) | AI 대화 + 17개 도구 | 사용자 요청 시 |
| **Claude Haiku** | 유료 (저렴) | 뉴스 AI 스코어링 | 뉴스 수신 시 배치 |

### Binance Futures 8개 API

AI가 `fetch_derivatives_data` 도구를 쓰면 이 8개를 한꺼번에 조회합니다:

| # | 엔드포인트 | 데이터 |
|---|-----------|--------|
| 1 | premiumIndex | 펀딩비 + 마크가격 |
| 2 | openInterest | 미결제약정 (OI) |
| 3 | topLongShortAccountRatio | 계정 롱숏비 |
| 4 | topLongShortPositionRatio | 포지션 롱숏비 |
| 5 | globalLongShortAccountRatio | 글로벌 롱숏비 |
| 6 | takerlongshortRatio | 체결 롱숏비 |
| 7 | allForceOrders | 청산 내역 |
| 8 | ticker/24hr | 선물 24h 시세 |

### 자동 재시도 (fetchWithRetry)

모든 API 호출은 실패 시 자동 재시도합니다:

```
1차 시도 → 실패 → 1초 대기
2차 시도 → 실패 → 2초 대기
3차 시도 → 실패 → 에러 반환
```

대기 시간이 1초 → 2초 → 4초로 점점 늘어납니다 (exponential backoff).

---

## 7. 실시간 시스템

### WebSocket이란?

일반 API는 "전화 걸기"입니다. 매번 "지금 BTC 얼마야?" 물어봐야 합니다.
WebSocket은 **"전화 연결 유지"**입니다. 한번 연결하면 가격이 바뀔 때마다 자동으로 알려줍니다.

### Binance WebSocket

```
[앱 시작]
    │
    ▼
[BinanceDataSource.connect()]
    │  wss://stream.binance.com:9443/ws 연결
    ▼
[카드 생성 시 symbol 있으면]
    │  subscribe("BTC") → BTCUSDT@ticker 스트림 구독
    ▼
[실시간 데이터 수신]
    │  가격, 24h 변동률, 거래량, 고가/저가
    │  → useRealtimeStore.updateTicker()
    ▼
[Card 컴포넌트가 자동 갱신]
    │  가격 변하면 초록(상승)/빨강(하락) 플래시
    │
[카드 삭제 시]
    │  unsubscribe("BTC")
    └  마지막 구독자가 없으면 스트림 해제
```

**연결 끊김 시 자동 복구:**
```
연결 끊김 → 1초 대기 → 재연결 시도
         → 실패 → 2초 대기 → 재연결
         → 실패 → 4초 대기 → 재연결
         → 실패 → 8초 대기 → 재연결
         → 실패 → 16초 대기 → 재연결
         → 5번 실패 → 포기 (disconnected 표시)
```

### CCXT Pro WebSocket

6개 거래소의 실시간 시세를 받을 수 있는 통합 WebSocket 서비스입니다.
AI가 `compare_exchange_prices` 도구를 쓸 때 활성화됩니다.

특징:
- **Lazy Connection** — 필요할 때만 연결 (불필요한 트래픽 방지)
- **5분 Idle Disconnect** — 5분간 데이터 요청 없으면 자동 해제
- **6거래소 동시** — Binance, Upbit, Bybit, Bithumb, OKX, Coinbase

### 참조 카운팅 (Reference Counting)

같은 코인(예: BTC)을 보는 카드가 3개 있을 때:

```
카드A subscribe("BTC") → refCount["BTC"] = 1 → 실제 구독
카드B subscribe("BTC") → refCount["BTC"] = 2 → 구독 안 함 (이미 됨)
카드C subscribe("BTC") → refCount["BTC"] = 3 → 구독 안 함

카드A 삭제 → refCount["BTC"] = 2 → 구독 유지
카드B 삭제 → refCount["BTC"] = 1 → 구독 유지
카드C 삭제 → refCount["BTC"] = 0 → 실제 구독 해제
```

이렇게 하면 중복 구독 없이 효율적으로 데이터를 받습니다.

### 뉴스 폴링

WebSocket이 아닌 **폴링**(주기적 조회) 방식입니다:

| 소스 | 간격 | 데이터 |
|------|------|--------|
| CryptoCompare 뉴스 | 60초 | 크립토 뉴스 기사 |
| Fear & Greed 지수 | 300초 | 시장 공포/탐욕 수치 |
| 전통자산 시세 | 60초 | S&P500, 금, DXY 등 |
| 김치 프리미엄 | 60초 | 업비트 vs 바이낸스 가격차 |

---

## 8. UI 컴포넌트

### 화면 구성

```
┌─────────────────────────────────────────────────────────┐
│  ◈ COMMAND  ◈ FEED                        [Tab Bar]     │
├────────┬──────────────────────────┬─────────────────────┤
│        │                          │                     │
│  News  │     Infinite Canvas      │    Chat Panel       │
│  Feed  │                          │                     │
│        │   ┌────┐  ┌────┐        │    [AI 대화]         │
│ [실시간 │   │Card│  │Card│        │                     │
│  뉴스]  │   └──┬─┘  └──┬─┘       │    user: BTC 분석    │
│        │      └───Edge──┘        │    AI: BTC는...      │
│        │         ┌──────┐        │                     │
│        │         │Webview│        │    [입력창]          │
│        │         │(Chart)│        │                     │
│        │         └──────┘        │    [⚙️ Settings]     │
│        │                          │                     │
├────────┴──────────────────────────┴─────────────────────┤
│  BTC $XX,XXX ▲2.1%  ETH $X,XXX ▼0.5%  [Price Ticker]  │
│  S&P 5,800  GOLD $2,650  DXY 104.2  김프 2.3%          │
├─────────────────────────────────────────────────────────┤
│  ● Connected  Binance WebSocket              [StatusBar]│
└─────────────────────────────────────────────────────────┘
```

### FEED 탭 구성

```
┌─────────────────────────────────────────────────────────┐
│  ◈ COMMAND  ◈ FEED                                      │
├──────────────────────────────┬──────────────────────────┤
│                              │                          │
│    🌍 World Map              │     Feed Sidebar         │
│    (뉴스 위치 핀 표시)         │     [검색]               │
│    또는                       │     [카테고리 필터]       │
│    📅 Event Calendar         │     [전체 뉴스 목록]      │
│    (FOMC, CPI 일정)          │                          │
│                              │                          │
├──────────────────────────────┴──────────────────────────┤
│  ═══════════════ [드래그 가능한 구분선] ═══════════════  │
├─────┬─────┬─────┬─────┬─────┬─────┬─────────────────────┤
│MACRO│CRYPT│CHAIN│EXCH │SOCIAL│STOCK│WORLD  [7열 Raw Feed]│
│     │     │     │     │     │     │                     │
│뉴스1│뉴스1│뉴스1│뉴스1│뉴스1│뉴스1│뉴스1               │
│뉴스2│뉴스2│뉴스2│뉴스2│뉴스2│뉴스2│뉴스2               │
│  :  │  :  │  :  │  :  │  :  │  :  │  :                 │
└─────┴─────┴─────┴─────┴─────┴─────┴─────────────────────┘
```

### 주요 컴포넌트 역할

#### 레이아웃

| 컴포넌트 | 역할 |
|----------|------|
| **App.tsx** | 앱 최상위. 부팅→탭→컨텐츠 분기. 서비스 초기화 |
| **BootSequence** | 시네마틱 부팅 애니메이션 (3.5초, 궤도 링 + 상태 메시지) |
| **TabBar** | COMMAND/FEED 탭 전환 |
| **Canvas** | 무한 캔버스. 좌클릭 드래그=이동, 마우스 휠=줌 (0.1x~3x) |
| **ChatPanel** | AI 채팅 인터페이스. Enter=전송, Shift+Enter=줄바꿈 |

#### 정보 카드

| 컴포넌트 | 역할 |
|----------|------|
| **Card** | 정보 카드. 마크다운 렌더링, 실시간 가격, 드래그/리사이즈 |
| **WebviewCard** | 웹사이트 임베드. 자동 제목 캡처, 관련 카드 자동 연결 |
| **SpawnAnimation** | 카드 등장 효과 (0.3배→1배 스케일 + 페이드인) |

카드 상호작용:
- **헤더 드래그** → 카드 이동
- **우하단 드래그** → 크기 조절
- **헤더 클릭** → 연결선 핀 고정
- **헤더 더블클릭** → Investigation Mode 열기
- **본문 클릭** → AI 채팅 컨텍스트로 설정
- **X 버튼** → 카드 삭제

#### 뉴스/피드

| 컴포넌트 | 역할 |
|----------|------|
| **NewsFeed** | COMMAND 탭 좌측 실시간 뉴스 패널 |
| **FeedItem** | 개별 뉴스. 드래그→캔버스에 카드 생성 가능 |
| **MosaicFeed** | FEED 탭 전체 레이아웃 |
| **MultiColumnFeed** | 7개 카테고리별 열 |
| **FeedColumn** | 단일 카테고리 열 |
| **FeedSidebar** | 검색 + 필터 + 전체 목록 |
| **WorldMap** | 세계지도에 뉴스 위치 핀 (중요도별 색상, 최근 5분 펄스) |
| **EventCalendar** | FOMC, CPI 등 경제/크립토 이벤트 캘린더 |

#### 연결 + 시세

| 컴포넌트 | 역할 |
|----------|------|
| **EdgeLayer** | 카드 간 연결선 SVG 레이어 |
| **NodeEdge** | 개별 연결선 (strong=실선 2px, weak=실선 1px, speculative=점선) |
| **PriceTicker** | 하단 무한 스크롤 시세 (크립토 + 전통자산 + 김치 프리미엄) |
| **StatusBar** | WebSocket 연결 상태 (녹색=연결, 노란=재연결 중, 회색=끊김) |
| **LatencyIndicator** | 카드별 데이터 지연 표시 (녹색<1초, 노란<5초, 빨간≥5초) |

뉴스 아이템의 **중요도 뱃지** 색상:
- `CRIT` (빨강) — 시장을 움직이는 사건 (해킹, 규제, 연준 결정)
- `ALERT` (노랑) — 중요하지만 즉각적이지 않음 (고래 이동, 대형 파트너십)
- `SIG` (보라) — 주목할 만함 (거래소 상장, 프로토콜 업데이트)
- `INFO` (없음) — 일반 정보

---

## 9. 사운드 시스템

### soundService.ts

오디오 파일 없이, 코드로 직접 소리를 합성합니다 (Web Audio API).

| 이벤트 | 소리 | 주파수 | 길이 |
|--------|------|--------|------|
| **앱 부팅** | 상승 톤 (저→고) | 200Hz → 600Hz | 0.4초 |
| **카드 생성** | 팝 사운드 | 800Hz → 1200Hz | 0.08초 |
| **AI 응답** | 부드러운 톤 | 440Hz | 0.15초 |
| **긴급 알림** | 더블 비프 | 1000Hz + 1200Hz | 0.25초 |

특징:
- 볼륨은 0.08~0.15로 아주 작게 (배경 분위기 용도)
- 설정에서 ON/OFF 가능
- 첫 재생 시 AudioContext 초기화 (브라우저 보안 정책)

---

## 10. Investigation Mode

### 카드 더블클릭 → 전체화면 딥 분석

캔버스의 카드를 **더블클릭**하면 전체화면 분석 모드가 열립니다.
6개(또는 그 이상) 패널이 동시에 데이터를 로드합니다.

```
┌──────────────────────────────────────────────────────┐
│  ◈ INVESTIGATION MODE — BTC              [X Close]   │
├──────────────────┬──────────────────┬────────────────┤
│                  │                  │                │
│  📊 Chart        │  📰 News         │  🐋 Whale      │
│  TradingView     │  관련 뉴스 필터    │  $100K+ 거래   │
│  실시간 캔들차트   │                  │  매수/매도 분류  │
│                  │                  │                │
├──────────────────┼──────────────────┼────────────────┤
│                  │                  │                │
│  🔗 On-chain     │  📊 Sector       │  📝 Overview   │
│  시총, 공급량     │  동일 섹터 코인    │  가격 + 통계    │
│  ATH/ATL, 변동률 │  비교 테이블      │  선물 데이터    │
│                  │                  │                │
└──────────────────┴──────────────────┴────────────────┘
```

### 6개 기본 패널

| 패널 | 데이터 출처 | 표시 내용 |
|------|-------------|-----------|
| **Overview** | useRealtimeStore + Binance Futures | 현재 가격, 24h 통계, 펀딩비, OI |
| **Chart** | TradingView (iframe) | 실시간 캔들스틱 차트 |
| **News** | useFeedStore (필터링) | 해당 코인 관련 뉴스만 필터 |
| **Whale** | Binance REST (최근 체결) | $100K 이상 대형 거래 테이블 |
| **On-chain** | CoinGecko | 시총, 공급량, ATH/ATL, 카테고리 |
| **Sector** | Binance + SECTOR_MAP | 같은 섹터 코인 가격 비교 |

### 데이터 로드 과정

```
카드 더블클릭 → open(card)
    │
    ▼
[심볼 해석] BTC → CoinGecko ID "bitcoin"
    │
    ▼
[병렬 데이터 로드] (Promise.allSettled)
    ├── Binance 최근 체결 → Whale 패널
    ├── CoinGecko 코인 데이터 → On-chain 패널
    ├── 섹터 코인 시세 → Sector 패널
    └── 각각 10초 타임아웃
    │
    ▼
[선물 데이터 보충] (실패해도 OK)
    ├── 펀딩비 → Overview에 추가
    └── OI → Overview에 추가
```

**핵심: 하나가 실패해도 나머지는 정상 동작합니다.**
예를 들어 Binance 체결 데이터를 못 가져와도, 차트/뉴스/온체인은 정상 표시됩니다.

### AI 동적 패널 관리

AI가 `update_investigation` 도구를 써서 패널을 실시간으로 추가/제거할 수 있습니다:

```
사용자: "BTC 조사 모드에서 소셜 분석도 추가해줘"
    │
    ▼
AI가 update_investigation 호출:
    action: "add"
    panel: { id: "social", title: "Social Analysis", panelType: "markdown", content: "..." }
    │
    ▼
7번째 패널이 그리드에 추가됨
```

---

## 11. 설정 시스템

### SettingsModal

톱니바퀴(⚙️) 아이콘을 클릭하면 열리는 설정 팝업입니다.

| 설정 | 필수 여부 | 용도 |
|------|-----------|------|
| **Claude API Key** | 필수 | AI 대화 + 도구 사용 |
| **Tavily API Key** | 필수 | 웹 검색 기능 |
| **CoinMarketCap Key** | 선택 | 보조 시장 데이터 |
| **AI Model** | 기본값 있음 | Sonnet(기본) / Haiku / Opus |
| **Context Prompt** | 선택 | 사용자 프로필 (트레이딩 스타일) |
| **AI Scoring** | ON(기본) | 뉴스 자동 중요도 평가 |
| **Sound** | ON(기본) | 사운드 효과 |

API 키는 **로컬에만 저장**됩니다 (localStorage).
서버에 전송되지 않으며, 각 API 서비스에 직접 전달됩니다.

---

## 12. 에러 처리

### 복원력 설계 원칙

TRAVIS는 **"하나가 죽어도 나머지는 산다"** 원칙으로 설계되었습니다.

### 에러 상황별 대응

| 상황 | 감지 방법 | 대응 |
|------|-----------|------|
| **Binance WS 끊김** | onclose 이벤트 | 지수 백오프 재연결 (최대 5회) |
| **API 키 없음** | 도구 실행 시 체크 | AI에게 에러 JSON 반환 |
| **SSE 타임아웃 (>60초)** | 타이머 | 채팅에 ⚠️ 경고, 축적된 텍스트 유지 |
| **도구 타임아웃 (>30초)** | Promise.race | 에러 캐치, 다음 도구로 계속 |
| **JSON 파싱 실패** | try-catch | 3가지 폴백 시도 (raw → backtick 제거 → regex) |
| **뉴스 API 실패** | catch in poll loop | 해당 소스만 건너뛰고 다른 소스 계속 |
| **CoinGecko Rate Limit** | 429 응답 | fetchWithRetry로 자동 재시도 |
| **CCXT 거래소 응답 없음** | catch | 해당 거래소만 skip, 나머지 정상 |

### fetchWithRetry 패턴

```
const result = await fetchWithRetry(url, {
  maxRetries: 3,          // 최대 3번 재시도
  initialDelay: 1000,     // 첫 대기 1초
  backoffMultiplier: 2    // 대기 시간 2배씩 증가
})
```

### Promise.allSettled 패턴

여러 API를 동시에 호출할 때, 하나가 실패해도 나머지 결과를 사용합니다:

```
[CoinGecko ✅] [Binance ✅] [CMC ❌ 타임아웃]
       │              │            │
       ▼              ▼            ▼
  코인 데이터      가격 데이터    건너뜀 (에러 로그만)
       │              │
       └──── 합쳐서 카드에 표시
```

---

## 13. 설계 원칙

### 1. 모자이크 이론 (Mosaic Theory)

> 개별적으로는 평범한 공개 정보들이, **연결**되면 남들이 모르는 인사이트를 만든다.

TRAVIS의 핵심 철학입니다:
- AI가 데이터를 **필터링하지 않습니다** — 모든 뉴스를 보여줍니다
- AI는 **중요도만 매깁니다** — "이게 중요해 보여요" 라고 알려줄 뿐
- Raw Feed가 기본입니다 — 트레이더가 직접 판단합니다
- **"AI가 건너뛴 타일이 당신을 부자로 만들 수도 있다"**

### 2. 하드코딩 금지

AI의 행동을 코드에서 분기하지 않습니다.
- ❌ `if (coin === "BTC") { showChart() }`
- ✅ AI에게 도구를 주고, 시스템 프롬프트에 원칙만 적습니다
- AI가 상황에 맞게 어떤 도구를 쓸지 스스로 판단합니다

### 3. 독립적 실패

모든 데이터 조회는 독립적입니다:
- CoinGecko가 죽어도 Binance는 동작합니다
- 뉴스가 안 와도 시세는 표시됩니다
- 선물 데이터가 실패해도 스팟 데이터는 보여줍니다

### 4. 비용 의식

- 메인 대화: Sonnet (고성능, 비쌈)
- 뉴스 스코어링: Haiku (빠르고 저렴)
- 배치 처리: 뉴스 5~10개씩 묶어서 한번에 스코어링 (API 호출 절약)

### 5. 사용자 통제권

AI가 제안하지만, 최종 결정은 사용자:
- 카드 생성/삭제/이동은 자유
- 뉴스 필터 ON/OFF는 사용자가 결정
- AI 스코어링 ON/OFF 토글
- 사운드 ON/OFF 토글

### 6. 보안 우선

- API 키는 Main Process에서만 사용
- Renderer는 IPC를 통해서만 요청
- contextBridge로 필요한 메서드만 노출 (35개)
- 나머지 Node.js API에는 접근 불가

---

## 14. 기술 스택 해설

### 왜 이 기술을 선택했나?

| 기술 | 왜 선택했나 | 대안은? |
|------|-------------|---------|
| **Electron** | 웹 기술로 데스크톱 앱을 만들 수 있음. webview(사이트 임베드) 지원 | Tauri (더 가볍지만 webview 제약) |
| **React** | 카드/패널 등 UI 컴포넌트를 효율적으로 관리 | Vue, Svelte |
| **TypeScript** | 코드 실수 방지 (타입 안전성). 대규모 프로젝트 필수 | JavaScript (타입 없음) |
| **Zustand** | 가볍고 간단한 상태 관리. Redux보다 보일러플레이트 90% 적음 | Redux (무겁고 복잡) |
| **TailwindCSS** | 빠른 스타일링. 다크 테마 일관성 유지 용이 | styled-components |
| **Vite** | 초고속 개발 서버 (코드 변경 즉시 반영) | Webpack (느림) |
| **Claude API** | 최강 도구 사용(tool use) 능력. 복잡한 분석 가능 | GPT-4, Gemini |
| **CCXT** | 100개+ 거래소를 동일 인터페이스로 접근 | 거래소별 SDK 각각 |
| **CoinGecko** | 무료 크립토 데이터 API. 심볼 검색 지원 | CoinMarketCap (유료) |
| **Web Audio API** | 오디오 파일 없이 코드로 소리 합성 | Howler.js (파일 필요) |
| **TradingView** | 업계 표준 차트. 무료 위젯 제공 | Lightweight Charts |
| **react-simple-maps** | D3 기반 세계지도. 커스터마이징 자유 | Leaflet, Mapbox |

### 용어집

| 용어 | 뜻 |
|------|-----|
| **Electron** | 웹 기술(HTML/CSS/JS)로 데스크톱 앱을 만드는 프레임워크. Chrome 브라우저가 내장됨 |
| **IPC** | Inter-Process Communication. 앱의 "뒷방"과 "무대" 사이의 통신 채널 |
| **Renderer** | 사용자가 보는 화면을 그리는 프로세스 (React가 여기서 동작) |
| **Main Process** | 사용자 눈에 보이지 않는 뒷방. API 호출, 파일 접근 등 담당 |
| **Preload** | Main과 Renderer 사이의 보안 다리. 허용된 기능만 통과시킴 |
| **React** | 화면을 "컴포넌트"(부품) 단위로 조합하는 UI 라이브러리 |
| **Component** | UI의 재사용 가능한 부품. 카드, 버튼, 패널 등 |
| **Zustand** | 여러 컴포넌트가 공유하는 데이터 저장소 (상태 관리 도구) |
| **Store** | Zustand의 데이터 저장소. 읽기/쓰기 가능한 공유 메모장 |
| **WebSocket** | 서버와 실시간 양방향 통신 채널. "전화 연결 유지" 같은 것 |
| **REST API** | 서버에 요청 보내고 응답 받는 방식. "전화 한 통" 같은 것 |
| **SSE** | Server-Sent Events. 서버가 실시간으로 데이터를 "흘려보내는" 방식 |
| **Streaming** | AI 응답을 글자 하나씩 실시간으로 받는 것 (타이핑 효과) |
| **Tool Use** | AI가 스스로 "이 도구를 써야겠다"고 판단해서 함수를 호출하는 것 |
| **TypeScript** | JavaScript에 타입(데이터 종류)을 추가한 언어. 실수 방지 |
| **TailwindCSS** | CSS를 클래스 이름으로 빠르게 적용하는 도구 |
| **Vite** | 초고속 개발 서버 + 번들러. 코드 변경 시 즉시 화면 반영 |
| **CCXT** | 100개+ 암호화폐 거래소를 동일 인터페이스로 접근하는 라이브러리 |
| **CoinGecko** | 무료 암호화폐 데이터 API (가격, 시총, 트렌딩) |
| **Binance** | 세계 최대 암호화폐 거래소 |
| **TradingView** | 실시간 차트 분석 서비스. 업계 표준 |
| **Markdown** | 간단한 텍스트 서식 문법 (굵게, 기울임, 목록 등) |
| **Canvas (UI)** | 무한히 펼쳐지는 작업 공간. 카드와 차트를 자유롭게 배치 |
| **Edge** | 카드 사이의 연결선. 관련 정보를 시각적으로 연결 |
| **Investigation Mode** | 특정 코인을 6개 패널로 깊이 분석하는 전체화면 모드 |
| **Skeleton Card** | 내용이 로딩 중일 때 보여주는 빈 카드 프레임 (반짝이는 효과) |
| **김치 프리미엄 (Kimchi Premium)** | 한국 거래소 vs 해외 거래소의 가격 차이 (%) |
| **펀딩비 (Funding Rate)** | 선물 시장에서 롱/숏 포지션 간 주기적으로 교환하는 수수료 |
| **OI (Open Interest)** | 선물 시장의 미결제 약정 총액. 시장 참여도 지표 |
| **Fear & Greed Index** | 시장의 공포/탐욕 수치 (0=극도 공포, 100=극도 탐욕) |
| **Promise.allSettled** | 여러 작업을 동시 실행, 하나가 실패해도 나머지 결과를 받는 패턴 |
| **Exponential Backoff** | 재시도 대기 시간을 1초→2초→4초로 점점 늘리는 전략 |
| **Lazy Connection** | 필요할 때만 연결하는 전략 (불필요한 리소스 사용 방지) |
| **Reference Counting** | 같은 데이터를 여러 곳에서 쓸 때 중복 구독을 방지하는 기법 |

---

## 부록: IPC 채널 전체 목록

Main Process와 Renderer Process 사이의 통신 채널 30개입니다.

### API 프록시 (7개)
| 채널 | 용도 |
|------|------|
| `send-chat-message` | Claude API 호출 |
| `send-chat-message-sse` | Claude API SSE 스트리밍 |
| `search-web` | Tavily 웹 검색 |
| `fetch-crypto-news` | CryptoCompare 뉴스 |
| `fetch-fear-greed` | Fear & Greed 지수 |
| `fetch-yahoo-quote` | 전통자산 시세 |
| `fetch-kimchi-premium` | 김치 프리미엄 |

### 거래소 데이터 (10개)
| 채널 | 용도 |
|------|------|
| `fetch-recent-trades` | Binance 최근 체결 |
| `fetch-klines` | Binance 캔들차트 |
| `fetch-ticker-24h` | Binance 24h 시세 |
| `fetch-multiple-tickers` | 복수 심볼 시세 |
| `fetch-coin-data` | 코인 종합 데이터 |
| `search-coin-id` | CoinGecko 심볼 검색 |
| `fetch-exchange-price` | CCXT 거래소 가격 |
| `compare-exchange-prices` | 거래소 비교 |
| `fetch-funding-rate` | 펀딩비 |
| `fetch-open-interest` | 미결제약정 |

### Phase 3A 데이터 도구 (8개)
| 채널 | 용도 |
|------|------|
| `api:fetchCoinData` | 코인 종합 (CoinGecko+Binance+CMC) |
| `api:fetchMarketOverview` | 시장 전체 현황 |
| `api:fetchDerivativesData` | 선물 8개 API |
| `api:fetchWhaleActivity` | 고래 거래 |
| `api:fetchTrending` | 트렌딩 코인 |
| `api:resolveSymbol` | 동적 심볼 해석 |
| `api:fetchExchangePrice` | CCXT 거래소 가격 |
| `api:compareExchangePrices` | 거래소 비교 + 김치 프리미엄 |

### WebSocket 관리 (3개)
| 채널 | 용도 |
|------|------|
| `ws:subscribe` | 실시간 시세 구독 |
| `ws:unsubscribe` | 구독 해제 |
| `ws:ticker-update` | 시세 업데이트 수신 |

### 시스템 (2개)
| 채널 | 용도 |
|------|------|
| `open-external-url` | 외부 브라우저에서 URL 열기 |
| `get-app-version` | 앱 버전 조회 |

---

*이 문서는 TRAVIS v1 (Phase 3A Complete) 기준으로 작성되었습니다.*
*마지막 업데이트: 2026-03-02*
