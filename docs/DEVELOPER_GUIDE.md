# TRAVIS Developer Guidebook

> **"Shape Your Market"** — AI가 트레이더의 킬체인(DETECT → COLLECT → JUDGE → EXECUTE)을 최적화하는 지능형 트레이딩 환경

이 가이드북은 TRAVIS 프로젝트의 모든 기술적 구조를 비개발자도 이해할 수 있도록 설명합니다.
각 챕터는 실제 코드를 포함하며, 모든 코드에는 한 줄씩 한국어 주석이 달려 있습니다.

---

# Chapter 1: 프로젝트 개요와 아키텍처

> **이 챕터를 한 문장으로 요약하면**: TRAVIS는 Electron이라는 데스크톱 앱 프레임워크 위에 React 프론트엔드를 올린 구조로, "Main Process(백엔드)"와 "Renderer Process(프론트엔드)"가 IPC라는 통신 다리를 통해 대화합니다.

## 1.1 TRAVIS가 뭔가요?

TRAVIS는 트레이더를 위한 AI 비서입니다. 마블의 자비스(JARVIS)처럼 사용자가 자연어로 말하면, AI가 판단해서 정보 카드와 웹사이트를 무한 캔버스 위에 배치합니다.

핵심 철학은 **모자이크 이론(Mosaic Theory)**입니다:
- 개별적으로는 평범한 공개 정보들이, 연결되면 비공개 인사이트를 드러낸다
- AI는 데이터를 필터링하지 않고, 관련성 점수만 매긴다
- "AI가 건너뛴 그 한 조각이 당신을 부자로 만들 수 있다"

## 1.2 기술 스택 한눈에 보기

```
┌─────────────────────────────────────────────┐
│              Electron (앱 껍데기)              │
│  ┌───────────────┐  ┌────────────────────┐  │
│  │ Main Process  │  │ Renderer Process   │  │
│  │ (백엔드 역할)  │←→│ (프론트엔드 역할)    │  │
│  │               │IPC│                    │  │
│  │ - API 호출     │  │ - React UI         │  │
│  │ - 파일 시스템   │  │ - Zustand 상태관리   │  │
│  │ - 네트워크 요청 │  │ - TailwindCSS 스타일│  │
│  └───────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────┘
```

| 기술 | 역할 | 비유 |
|------|------|------|
| **Electron** | 데스크톱 앱 프레임워크 | 웹사이트를 독립 앱으로 포장하는 상자 |
| **React** | UI 라이브러리 | 레고 블록처럼 화면을 조립 |
| **TypeScript** | 타입이 있는 JavaScript | 맞춤법 검사기가 달린 프로그래밍 언어 |
| **Zustand** | 상태 관리 | 앱의 모든 데이터를 담는 중앙 금고 |
| **TailwindCSS** | 스타일링 | CSS를 클래스 이름으로 직접 쓰는 방식 |
| **Vite** | 빌드 도구 | 코드를 브라우저가 이해하는 형태로 변환 |
| **WebSocket** | 실시간 통신 | 서버와 항상 열려있는 전화선 |

## 1.3 폴더 구조

```
src/
  main/                  → 백엔드 (Electron Main Process)
    index.ts             → 앱 시작점 — 창을 만들고 IPC를 등록
    ipc.ts               → IPC 핸들러 — 프론트엔드의 요청을 받아 처리
    preload.ts           → IPC 다리 — 프론트엔드가 백엔드를 호출할 수 있게 연결
    tavily.ts            → Tavily 웹 검색 API 호출
    binanceApi.ts        → 바이낸스 REST API (거래 내역, 시세)
    binanceFuturesApi.ts → 바이낸스 선물 API (펀딩비, 미결제약정)
    coingeckoApi.ts      → CoinGecko API (코인 상세 데이터)
    upbitApi.ts          → 업비트 API (김치 프리미엄 계산)
    feedApi.ts           → 뉴스 피드 API (CryptoCompare, Fear&Greed)
    yahooFinance.ts      → Yahoo Finance API (전통 자산 시세)

  renderer/              → 프론트엔드 (React 앱)
    App.tsx              → 루트 컴포넌트 — 부팅 → 탭 → 콘텐츠
    components/          → UI 컴포넌트들 (화면에 보이는 모든 조각)
    stores/              → Zustand 스토어들 (앱의 데이터 저장소)
    services/            → 서비스 로직 (AI, WebSocket, 뉴스 등)
    types/               → TypeScript 타입 정의
    utils/               → 유틸리티 함수
```

## 1.4 두 세계의 통신: IPC

Electron 앱은 두 개의 분리된 세계로 나뉩니다:
- **Main Process** (Node.js 환경): 파일 접근, 네트워크 요청, 시스템 리소스 사용 가능
- **Renderer Process** (브라우저 환경): 화면 렌더링, 사용자 상호작용 처리

이 둘은 **IPC (Inter-Process Communication, 프로세스 간 통신)**로 대화합니다.

```
[프론트엔드]                    [백엔드]
ChatPanel.tsx                  ipc.ts
    │                              │
    │ window.api.startChatStream() │
    ├─────────────────────────────→│ Claude API 호출
    │                              │
    │   stream:text-delta 이벤트    │
    │←─────────────────────────────┤ 응답 스트리밍
    │                              │
```

실제 코드로 보면:

```typescript
// src/main/preload.ts — IPC 다리 (보안 통로)
// contextBridge는 프론트엔드가 백엔드를 안전하게 호출하는 창구
contextBridge.exposeInMainWorld('api', {
  // 스트리밍 시작 — 프론트엔드에서 이 함수를 호출하면 백엔드로 메시지가 전달됨
  startChatStream: (payload: unknown) =>
    ipcRenderer.send('claude:chat-stream', payload),

  // 스트리밍 이벤트 수신 — 백엔드가 보내는 실시간 데이터를 받는 리스너(listener, 감시자)
  onStreamEvent: (channel: string, callback: (data: unknown) => void) => {
    // _event는 Electron 내부 이벤트 객체 (사용하지 않으므로 _로 시작)
    const listener = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    // ipcRenderer.on으로 해당 채널의 메시지를 구독
    ipcRenderer.on(channel, listener)
    // 정리 함수 반환 — 더 이상 듣지 않을 때 호출
    return () => { ipcRenderer.removeListener(channel, listener) }
  },

  // 바이낸스 최근 거래 내역 조회
  fetchRecentTrades: (symbol: string, limit: number) =>
    ipcRenderer.invoke('binance:trades', { symbol, limit }),
})
```

**설계 결정**: `contextIsolation: true`로 설정하여 프론트엔드가 Node.js API에 직접 접근할 수 없게 합니다. 이는 보안을 위한 것으로, 모든 백엔드 호출은 반드시 preload.ts의 `api` 객체를 통해야 합니다.

---

# Chapter 2: Main Process — 앱의 백엔드

> **이 챕터를 한 문장으로 요약하면**: Main Process는 앱의 보이지 않는 엔진으로, 창을 만들고, 외부 API(Claude, Binance, CoinGecko 등)를 호출하고, 그 결과를 프론트엔드에 전달합니다.

## 2.1 앱 시작점: index.ts

앱이 실행되면 가장 먼저 이 파일이 동작합니다.

```typescript
// src/main/index.ts — Electron 앱의 시작점 (main entry point)
import { app, BrowserWindow } from 'electron'  // Electron의 핵심 모듈 가져오기
import path from 'path'                         // 파일 경로를 다루는 Node.js 내장 모듈
import { registerIpcHandlers } from './ipc'     // IPC 핸들러 등록 함수

// createWindow — 실제 앱 창을 만드는 함수
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,                    // 기본 창 너비 (픽셀)
    height: 800,                    // 기본 창 높이 (픽셀)
    backgroundColor: '#0a0a0f',     // 창 배경색 (로딩 중 보이는 색)
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),  // IPC 다리 파일 경로
      nodeIntegration: false,       // 보안: 프론트엔드에서 Node.js 직접 사용 금지
      contextIsolation: true,       // 보안: 프론트엔드와 백엔드 환경 분리
      webviewTag: true,             // <webview> 태그 사용 허용 (캔버스에 웹사이트 삽입용)
    },
  })

  win.maximize()  // 창을 최대화 상태로 시작

  // 개발 모드 vs 프로덕션 모드에 따라 다른 페이지 로드
  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173')  // 개발: Vite 개발 서버
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))  // 프로덕션: 빌드된 파일
  }
}

// 앱이 준비되면 IPC 핸들러 등록 후 창 생성
app.whenReady().then(() => {
  registerIpcHandlers()  // 모든 IPC 통신 경로를 등록
  createWindow()         // 앱 창 생성
})

// 모든 창이 닫히면 앱 종료 (macOS 제외 — macOS는 독에 남아있는 것이 관례)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
```

## 2.2 IPC 핸들러: ipc.ts

프론트엔드의 모든 요청이 도착하는 "교환대"입니다. 총 13개의 핸들러가 등록됩니다.

```typescript
// src/main/ipc.ts — 프론트엔드 요청을 받아 처리하는 중앙 교환대
import { ipcMain } from 'electron'                     // Electron의 IPC 수신 모듈
import { fetchTraditionalAssets } from './yahooFinance' // Yahoo Finance에서 전통자산 시세 조회
import { searchTavily } from './tavily'                 // Tavily로 웹 검색
import { fetchCryptoNews, fetchFearGreed } from './feedApi'       // 뉴스 + 공포탐욕지수
import { fetchRecentTrades, fetchMultipleTickers } from './binanceApi' // 바이낸스 거래/시세
import { fetchCoinData, searchCoinId } from './coingeckoApi'      // CoinGecko 코인 데이터
import { fetchFundingRate, fetchOpenInterest } from './binanceFuturesApi' // 선물 데이터
import { fetchKimchiPremium } from './upbitApi'         // 업비트 김치 프리미엄

export function registerIpcHandlers() {
  // ── Claude AI 채팅 (Non-streaming 방식, 폴백용) ──
  // ipcMain.handle = 프론트엔드의 invoke() 호출을 받아 처리
  ipcMain.handle('claude:chat', async (_event, payload) => {
    const { apiKey, model, messages, system, tools } = payload
    // Anthropic API에 HTTP POST 요청
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,              // 사용자의 Claude API 키
        'anthropic-version': '2023-06-01', // API 버전
      },
      body: JSON.stringify({ model, max_tokens: 4096, system, messages, tools }),
    })
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API ${response.status}: ${errorText}`)
    }
    return response.json()  // JSON 응답을 프론트엔드에 반환
  })

  // ── Claude AI 채팅 (SSE 스트리밍 방식 — 실시간 타이핑 효과) ──
  // ipcMain.on = 프론트엔드의 send() 호출을 받음 (단방향 → 이벤트로 응답)
  ipcMain.on('claude:chat-stream', async (event, payload) => {
    const { apiKey, model, messages, system, tools } = payload
    try {
      // stream: true 옵션으로 스트리밍 요청
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model, max_tokens: 4096, system, messages, tools, stream: true }),
      })

      // 스트리밍 응답을 한 줄씩 읽어서 프론트엔드에 전달
      const reader = (response.body as ReadableStream<Uint8Array>).getReader()
      const decoder = new TextDecoder()  // 바이트 → 문자열 변환기
      let buffer = ''                     // 아직 처리되지 않은 불완전한 데이터 임시 저장

      while (true) {
        const { done, value } = await reader.read()  // 다음 데이터 청크(조각) 읽기
        if (done) break                               // 스트림 종료
        buffer += decoder.decode(value, { stream: true })

        // 줄바꿈(\n)을 기준으로 완성된 라인을 하나씩 처리
        while (buffer.includes('\n')) {
          const lineEnd = buffer.indexOf('\n')
          const line = buffer.slice(0, lineEnd).trim()
          buffer = buffer.slice(lineEnd + 1)

          if (!line.startsWith('data: ')) continue  // SSE 형식: "data: {...}" 만 처리
          const dataStr = line.slice(6)              // "data: " 접두사 제거
          if (dataStr === '[DONE]') continue          // 스트림 완료 시그널

          try {
            const json = JSON.parse(dataStr)
            const type = json.type as string

            // content_block_start — 새 블록(텍스트 또는 도구) 시작
            if (type === 'content_block_start') {
              const block = json.content_block
              if (block?.type === 'tool_use') {
                // 도구 사용 시작 → 프론트엔드에 알림
                event.sender.send('stream:tool-start', {
                  index: json.index, id: block.id, name: block.name,
                })
              }
            }
            // content_block_delta — 텍스트/도구 입력이 조금씩 들어옴
            else if (type === 'content_block_delta') {
              const delta = json.delta
              if (delta?.type === 'text_delta') {
                // 텍스트 조각 → 프론트엔드에 전달 (타이핑 애니메이션용)
                event.sender.send('stream:text-delta', { text: delta.text })
              } else if (delta?.type === 'input_json_delta') {
                // 도구 입력 JSON 조각 → 프론트엔드에 전달
                event.sender.send('stream:tool-delta', { index: json.index, json: delta.partial_json })
              }
            }
            // message_delta — 메시지 종료 이유 (stop_reason)
            else if (type === 'message_delta') {
              event.sender.send('stream:message-delta', { stopReason: json.delta?.stop_reason })
            }
            // message_stop — 전체 메시지 완료
            else if (type === 'message_stop') {
              event.sender.send('stream:end', {})
            }
          } catch { /* JSON 파싱 실패 — 무시 */ }
        }
      }
      event.sender.send('stream:end', {})  // 안전장치: reader 완료 후 end 이벤트 전송
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown streaming error'
      event.sender.send('stream:error', { error: message })
    }
  })

  // ── 전통 자산 시세 (S&P500, NASDAQ, 금, 유가 등) ──
  ipcMain.handle('tradfi:quotes', async () => fetchTraditionalAssets())

  // ── Tavily 웹 검색 ──
  ipcMain.handle('tavily:search', async (_event, { query, apiKey }) => searchTavily(query, apiKey))

  // ── 뉴스 피드 ──
  ipcMain.handle('feed:cryptonews', async () => fetchCryptoNews())
  ipcMain.handle('feed:feargreed', async () => fetchFearGreed())

  // ── Investigation Mode API들 ──
  ipcMain.handle('binance:trades', async (_e, { symbol, limit }) => fetchRecentTrades(symbol, limit))
  ipcMain.handle('binance:multi-ticker', async (_e, { symbols }) => fetchMultipleTickers(symbols))
  ipcMain.handle('coingecko:coin-data', async (_e, { coinId }) => fetchCoinData(coinId))
  ipcMain.handle('coingecko:search', async (_e, { symbol }) => searchCoinId(symbol))

  // ── 선물 데이터 ──
  ipcMain.handle('binance-futures:funding', async (_e, { symbol }) => fetchFundingRate(symbol))
  ipcMain.handle('binance-futures:open-interest', async (_e, { symbol }) => fetchOpenInterest(symbol))

  // ── 김치 프리미엄 ──
  ipcMain.handle('upbit:kimchi-premium', async (_e, { symbols }) => fetchKimchiPremium(symbols))
}
```

**설계 결정**: Non-streaming(`handle`)과 Streaming(`on`) 두 가지 방식을 구현한 이유:
- `handle/invoke`: 요청 → 응답의 단순한 1:1 통신. 작은 데이터에 적합.
- `on/send`: 한 번의 요청에 여러 번 응답 가능. AI의 실시간 타이핑 효과에 필수.

## 2.3 외부 API 연동 파일들

각 API 파일은 하나의 외부 서비스와 통신하는 역할을 합니다:

| 파일 | 외부 서비스 | 제공 데이터 |
|------|------------|------------|
| `tavily.ts` | Tavily | 웹 검색 결과 |
| `binanceApi.ts` | Binance REST | 최근 거래, 24h 시세 |
| `binanceFuturesApi.ts` | Binance Futures | 펀딩비, 미결제약정(OI) |
| `coingeckoApi.ts` | CoinGecko | 코인 상세 정보, 시총, 카테고리 |
| `upbitApi.ts` | Upbit + 환율 API | 김치 프리미엄 (한국 거래소 가격 vs 해외) |
| `feedApi.ts` | CryptoCompare, Alternative.me | 암호화폐 뉴스, 공포탐욕지수 |
| `yahooFinance.ts` | Yahoo Finance | S&P500, NASDAQ, DXY, 금, 유가 |

---

# Chapter 3: 상태 관리 — Zustand 스토어

> **이 챕터를 한 문장으로 요약하면**: Zustand(주스탄드)는 앱의 모든 데이터를 7개의 "금고(Store)"에 나눠 보관하는 상태 관리 라이브러리로, 어떤 컴포넌트에서든 금고를 열어 데이터를 읽거나 수정할 수 있습니다.

## 3.1 Zustand이란?

React에서 여러 컴포넌트가 같은 데이터를 공유해야 할 때, 그 데이터를 한 곳에 모아두는 것이 "상태 관리"입니다. Zustand은 이를 매우 간결하게 해결합니다.

```
비유:
Redux (경쟁 라이브러리) = 대형 은행 금고 (절차가 복잡)
Zustand              = 스마트 금고 (열쇠만 있으면 바로 접근)
```

## 3.2 7개의 스토어 개요

```
┌─────────────────────────────────────────────────────┐
│                    TRAVIS Stores                     │
├─────────────────┬───────────────────────────────────┤
│ useCanvasStore  │ 캔버스의 카드/엣지/뷰포트 관리        │
│ useChatStore    │ 채팅 메시지, 스트리밍 상태, 포커스 카드  │
│ useFeedStore    │ 뉴스 피드 아이템, 필터, AI 스코어링     │
│ useSettingsStore│ API 키, 모델 선택, 사용자 설정 (영구 저장)│
│ useRealtimeStore│ WebSocket 실시간 시세 데이터           │
│ useTabStore     │ 현재 활성 탭 (COMMAND / FEED)        │
│ useInvestigation│ Investigation Mode 상태 + 6개 패널    │
│   Store         │                                     │
└─────────────────┴───────────────────────────────────┘
```

## 3.3 useCanvasStore — 캔버스의 뇌

캔버스 위의 모든 카드, 연결선(엣지), 화면 이동/확대 상태를 관리합니다. 가장 크고 핵심적인 스토어입니다.

```typescript
// src/renderer/stores/useCanvasStore.ts (핵심 부분)
import { create } from 'zustand'  // Zustand의 스토어 생성 함수
import type { CanvasItem, CardData, WebviewData, EdgeData, EdgeStrength } from '../types'

// Viewport — 캔버스의 "카메라" 위치와 줌 레벨
interface Viewport {
  x: number    // 카메라의 가로 위치 (패닝)
  y: number    // 카메라의 세로 위치 (패닝)
  zoom: number // 확대/축소 배율 (1 = 기본, 0.1~3 범위)
}

const CARD_GAP = 24          // 카드 사이 간격 (픽셀)
const ROW_WRAP_WIDTH = 1400  // 이 너비를 넘으면 다음 줄로 카드 배치

// calculateNextPosition — 새 카드가 놓일 최적의 위치를 자동 계산
function calculateNextPosition(
  cards: CanvasItem[],  // 현재 캔버스의 모든 카드
  width: number,        // 새 카드의 너비
  height: number        // 새 카드의 높이
): { x: number; y: number } {
  if (cards.length === 0) {
    return { x: 80, y: 80 }  // 첫 카드는 좌상단에 배치
  }
  const lastCard = cards[cards.length - 1]           // 마지막으로 추가된 카드
  const nextX = lastCard.x + lastCard.width + CARD_GAP // 마지막 카드 오른쪽에 배치
  if (nextX + width > ROW_WRAP_WIDTH) {
    // 화면을 넘으면 다음 줄로 이동
    const maxBottom = Math.max(...cards.map((c) => c.y + c.height))
    return { x: 80, y: maxBottom + CARD_GAP }
  }
  return { x: nextX, y: lastCard.y }  // 같은 줄, 오른쪽에 배치
}

// create() — Zustand 스토어 생성
// set: 상태를 변경하는 함수, get: 현재 상태를 읽는 함수
export const useCanvasStore = create<CanvasState>((set, get) => ({
  cards: [],           // 캔버스 위의 모든 카드 (CardData 또는 WebviewData)
  edges: [],           // 카드 간 연결선들
  hoveredNodeId: null, // 마우스가 올라간 카드 ID (엣지 표시용)
  pinnedNodeIds: [],   // 클릭으로 고정된 카드들 (엣지 항상 표시)
  showAllEdges: false, // 모든 엣지 표시 토글
  viewport: { x: 0, y: 0, zoom: 1 }, // 캔버스 카메라 상태

  // addCard — 새 정보 카드를 캔버스에 추가
  addCard: (cardInput) => {
    const id = cardInput.id || crypto.randomUUID()  // 고유 ID 자동 생성
    const width = cardInput.width || 380             // 기본 너비
    const height = cardInput.height || 280           // 기본 높이
    const { cards } = get()                          // 현재 카드 목록 가져오기
    // 위치가 지정되지 않았으면 자동 계산
    const pos = cardInput.x !== undefined && cardInput.y !== undefined
      ? { x: cardInput.x, y: cardInput.y }
      : calculateNextPosition(cards, width, height)

    const card: CardData = {
      id, type: 'card',
      title: cardInput.title, content: cardInput.content,
      cardType: cardInput.cardType, symbol: cardInput.symbol,
      images: cardInput.images, width, height,
      spawnDelay: cardInput.spawnDelay,  // 등장 애니메이션 딜레이
      ...pos,
    }
    // set()으로 상태 업데이트 → React가 자동으로 화면을 다시 그림
    set((state) => ({ cards: [...state.cards, card] }))
    return id  // 생성된 카드 ID 반환 (AI가 relatedTo에 사용)
  },

  // removeCard — 카드 삭제 시 관련 엣지와 핀도 함께 삭제
  removeCard: (id) =>
    set((state) => ({
      cards: state.cards.filter((c) => c.id !== id),
      edges: state.edges.filter((e) => e.fromNodeId !== id && e.toNodeId !== id),
      pinnedNodeIds: state.pinnedNodeIds.filter((nid) => nid !== id),
    })),

  // addEdge — 두 카드 사이에 연결선 추가 (중복 방지 로직 포함)
  addEdge: (from, to, strength, label) => {
    const { edges } = get()
    // 이미 같은 연결이 있는지 확인 (양방향 모두 체크)
    const exists = edges.some(
      (e) => (e.fromNodeId === from && e.toNodeId === to) ||
             (e.fromNodeId === to && e.toNodeId === from)
    )
    if (exists) return  // 중복이면 추가하지 않음
    const edge: EdgeData = {
      id: crypto.randomUUID(),
      fromNodeId: from, toNodeId: to,
      strength,  // 'strong' | 'weak' | 'speculative'
      label,     // 연결 이유 설명 (예: 'webview-auto')
    }
    set((state) => ({ edges: [...state.edges, edge] }))
  },

  // rearrangeCards — 카드 재배치 (grid: 격자형, stack: 세로 정렬)
  rearrangeCards: (layout) =>
    set((state) => {
      if (state.cards.length === 0) return state
      if (layout === 'grid') {
        const cols = 3  // 3열 격자
        return {
          cards: state.cards.map((card, i) => ({
            ...card,
            x: 80 + (i % cols) * (card.width + CARD_GAP),       // 열 위치
            y: 80 + Math.floor(i / cols) * (card.height + CARD_GAP), // 행 위치
          })),
        }
      }
      // stack: 세로로 쌓기
      let currentY = 80
      return {
        cards: state.cards.map((card) => {
          const y = currentY
          currentY += card.height + CARD_GAP
          return { ...card, x: 80, y }
        }),
      }
    }),
}))
```

**파일 간 관계**: `useCanvasStore`는 다음 파일들과 밀접하게 연결됩니다:
- `claude.ts` → `addCard()`, `addEdge()` 호출 (AI가 카드를 생성)
- `Canvas.tsx` → `viewport` 읽기, `setViewport()` 호출 (패닝/줌)
- `Card.tsx` → `updateCardPosition()`, `removeCard()` 호출 (드래그/삭제)
- `NodeEdge.tsx` → `edges`, `hoveredNodeId` 읽기 (연결선 표시)

## 3.4 useChatStore — 채팅의 기억

```typescript
// src/renderer/stores/useChatStore.ts — 채팅 메시지와 스트리밍 상태 관리
import { create } from 'zustand'

// Message — 채팅창에 표시되는 하나의 메시지
export interface Message {
  id: string                    // 고유 ID
  role: 'user' | 'assistant'   // 누가 보낸 메시지인지 (사용자 or AI)
  content: string               // 메시지 내용
  timestamp: number             // 보낸 시각 (밀리초 타임스탬프)
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],              // 모든 채팅 메시지 배열
  isLoading: false,          // AI가 응답 중인지 여부
  streamingMessageId: null,  // 현재 스트리밍 중인 메시지 ID (커서 표시용)
  focusedCard: null,         // 현재 참조 중인 카드 (클릭으로 활성화)

  // addMessage — 새 메시지 추가, 고유 ID 반환
  addMessage: (role, content) => {
    const id = crypto.randomUUID()
    set((state) => ({
      messages: [...state.messages, { id, role, content, timestamp: Date.now() }],
    }))
    return id  // 스트리밍 시 이 ID로 메시지를 업데이트
  },

  // appendToMessage — 스트리밍 중 텍스트를 기존 메시지에 이어붙이기
  appendToMessage: (id, text) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + text } : m
      ),
    })),

  // setFocusedCard — 카드 클릭 시 채팅 컨텍스트로 연결
  setFocusedCard: (card) => set({ focusedCard: card }),
  clearFocusedCard: () => set({ focusedCard: null }),
}))
```

**설계 결정**: `focusedCard`는 카드와 채팅을 연결하는 핵심 메커니즘입니다. 사용자가 카드를 클릭하면 해당 카드의 내용이 AI의 시스템 프롬프트에 `[FOCUSED CARD CONTEXT]`로 주입되어, "이 카드에 대해 더 설명해줘"같은 맥락적 대화가 가능합니다.

## 3.5 useSettingsStore — 영구 설정 보관

```typescript
// src/renderer/stores/useSettingsStore.ts — 사용자 설정 (브라우저 종료 후에도 유지)
import { create } from 'zustand'
import { persist } from 'zustand/middleware'  // 상태를 localStorage에 자동 저장하는 미들웨어

export const useSettingsStore = create<SettingsState>()(
  persist(  // persist 미들웨어: 상태가 변경될 때마다 localStorage에 자동 저장
    (set) => ({
      apiKey: '',            // Claude API 키
      tavilyApiKey: '',      // Tavily 웹 검색 API 키
      contextPrompt: '',     // 사용자 맞춤 컨텍스트 프롬프트
      model: 'claude-sonnet-4-20250514',  // 기본 AI 모델
      enableAiScoring: true, // AI 뉴스 스코어링 활성화 여부

      setApiKey: (apiKey) => set({ apiKey }),
      setModel: (model) => set({ model }),
      setEnableAiScoring: (enableAiScoring) => set({ enableAiScoring }),
    }),
    { name: 'travis-settings' }  // localStorage 키 이름
  )
)
```

**설계 결정**: `persist` 미들웨어를 사용하면 앱을 껐다 켜도 설정이 유지됩니다. `localStorage`에 `travis-settings`라는 키로 JSON이 저장됩니다. API 키는 사용자의 로컬 머신에만 저장되며 서버로 전송되지 않습니다.

## 3.6 useRealtimeStore — 실시간 시세

```typescript
// src/renderer/stores/useRealtimeStore.ts — WebSocket 실시간 가격 데이터
import { create } from 'zustand'
import { dataSourceManager } from '../services/dataSource'

export const useRealtimeStore = create<RealtimeState>((set) => ({
  tickers: {},                    // 심볼별 시세 데이터 (예: { 'BTC': {...}, 'ETH': {...} })
  connectionStatus: 'disconnected', // WebSocket 연결 상태

  // updateTicker — 새 시세 도착 시 호출, 이전 가격을 prevPrice에 보존
  updateTicker: (data) =>
    set((state) => {
      const existing = state.tickers[data.symbol]  // 기존 데이터 조회
      return {
        tickers: {
          ...state.tickers,
          [data.symbol]: {
            ...data,
            prevPrice: existing ? existing.price : data.price,
            // prevPrice — 가격 변동 방향(상승/하락) 플래시 애니메이션에 사용
          },
        },
      }
    }),

  // subscribe/unsubscribe — DataSourceManager에 위임 (참조 카운팅)
  subscribe: (symbol) => dataSourceManager.subscribe(symbol),
  unsubscribe: (symbol) => dataSourceManager.unsubscribe(symbol),
}))
```

## 3.7 useFeedStore — 뉴스 피드

```typescript
// src/renderer/stores/useFeedStore.ts — 뉴스 아이템 관리 + 필터링
export const useFeedStore = create<FeedState>((set, get) => ({
  items: [],      // 모든 뉴스 아이템 (최대 200개, 최신순)
  filters: {
    categories: new Set(),   // 활성화된 카테고리 필터
    importance: new Set(),   // 활성화된 중요도 필터
  },

  // addItems — 새 뉴스 추가 (Map으로 중복 제거, 200개 제한)
  addItems: (newItems) => {
    const { items } = get()
    const map = new Map<string, FeedItem>()       // Map으로 중복 제거
    for (const item of items) map.set(item.id, item)     // 기존 아이템 등록
    for (const item of newItems) map.set(item.id, item)  // 새 아이템 덮어쓰기
    const merged = Array.from(map.values())
      .sort((a, b) => b.timestamp - a.timestamp)  // 최신순 정렬
      .slice(0, 200)                                // 최대 200개 유지
    set({ items: merged })
  },

  // updateScoring — AI가 평가한 중요도와 관련성 점수를 기존 아이템에 반영
  updateScoring: (scores) => {
    const scoreMap = new Map(scores.map((s) => [s.id, s]))
    set((state) => ({
      items: state.items.map((item) => {
        const s = scoreMap.get(item.id)
        if (!s) return item  // 점수가 없으면 그대로
        return { ...item, aiImportance: s.importance, relevanceScore: s.score, scored: true }
      }),
    }))
  },

  // getFilteredItems — 현재 필터 조건에 맞는 아이템만 반환
  getFilteredItems: () => {
    const { items, filters } = get()
    return items.filter((item) => {
      if (filters.categories.size > 0 && !filters.categories.has(item.category)) return false
      if (filters.importance.size > 0 && !filters.importance.has(item.importance)) return false
      return true
    })
  },
}))
```

## 3.8 스토어 간 데이터 흐름 요약

```
사용자 메시지 입력
    │
    ▼
useChatStore.addMessage('user', msg)  ─── 채팅에 표시
    │
    ▼
claude.ts → sendMessage()
    │
    ├→ useCanvasStore.addCard()       ─── 카드 생성
    ├→ useCanvasStore.addEdge()       ─── 연결선 생성
    └→ useChatStore.updateMessage()   ─── AI 응답 스트리밍

바이낸스 WebSocket 데이터 도착
    │
    ▼
useRealtimeStore.updateTicker()       ─── 실시간 시세 업데이트
    │
    ▼
Card.tsx에서 ticker 구독 → 가격 표시 + 플래시 애니메이션

뉴스 피드 폴링
    │
    ▼
useFeedStore.addItems()               ─── 뉴스 목록 업데이트
    │
    ▼
scoringService.enqueue()              ─── AI 중요도 평가 요청
    │
    ▼
useFeedStore.updateScoring()          ─── 점수 반영
```

---

# Chapter 4: AI 시스템 — Claude와의 대화

> **이 챕터를 한 문장으로 요약하면**: claude.ts는 TRAVIS의 두뇌로, 사용자의 메시지를 받아 Claude AI에게 전송하고, AI가 "도구(Tool)"를 통해 카드를 생성하거나 웹 검색을 수행하는 전체 과정을 오케스트레이션(조율)합니다.

## 4.1 시스템 프롬프트 — AI의 성격과 규칙

AI가 어떻게 행동할지는 시스템 프롬프트에서 결정됩니다. TRAVIS의 시스템 프롬프트는 동적으로 구성됩니다.

```typescript
// src/renderer/services/claude.ts — 시스템 프롬프트 구성

// BASE_SYSTEM_PROMPT — AI의 기본 성격과 행동 규칙
const BASE_SYSTEM_PROMPT = `You are TRAVIS, an AI assistant that helps users analyze cryptocurrency markets.
When the user asks anything, you should:
1. Understand their intent
2. Use your tools to spawn relevant information cards and websites on the canvas
3. Provide a brief text summary in chat

IMPORTANT — Symbol Field Rules:
When using spawn_card tool, the 'symbol' field must be the BASE symbol only...
- User says 'BTCUSDT 분석' → symbol: 'BTC' (not 'BTCUSDT')

IMPORTANT — Card Connections:
When you spawn multiple related cards, use the relatedTo field to link them together...

CRITICAL — Web Search:
You MUST use the search_web tool when the user asks about recent news...`

// buildSystemPrompt — 기본 프롬프트에 실시간 컨텍스트를 추가하여 최종 프롬프트 생성
function buildSystemPrompt(
  contextPrompt: string,  // 사용자가 설정한 커스텀 프롬프트
  canvasCards: Array<{...}>,  // 현재 캔버스 위의 카드들
  marketData?: string,    // 실시간 시세 데이터
  focusedCard?: { title: string; content: string }  // 참조 중인 카드
): string {
  let prompt = BASE_SYSTEM_PROMPT

  // [USER CONTEXT] — 사용자의 커스텀 프롬프트 주입
  if (contextPrompt) {
    prompt += `\n\n[USER CONTEXT]\n${contextPrompt}`
  }

  // [REAL-TIME MARKET DATA] — 실시간 시세 주입
  // "BTC 분석해줘" 입력 시 BTC의 현재 가격/변동률이 여기에 들어감
  if (marketData) {
    prompt += `\n\n[REAL-TIME MARKET DATA]\n${marketData}`
  }

  // [CURRENT CANVAS STATE] — 캔버스에 어떤 카드가 있는지 AI에게 알려줌
  if (canvasCards.length > 0) {
    const list = canvasCards.map((c) => `- ${c.title} (${c.type}, id: ${c.id})`).join('\n')
    prompt += `\n\n[CURRENT CANVAS STATE]\n${list}`
  }

  // [OPEN WEBVIEWS] — 열려있는 웹뷰의 제목/URL을 AI에게 알려줌
  const webviews = canvasCards.filter(
    (c) => c.type === 'webview' && (c.liveTitle || c.liveUrl)
  )
  if (webviews.length > 0) {
    prompt += `\n\n[OPEN WEBVIEWS]\n` + webviews.map((wv) =>
      `- "${wv.liveTitle || wv.title}" — ${wv.liveUrl || ''} (id: ${wv.id})`
    ).join('\n')
  }

  // [FOCUSED CARD CONTEXT] — 사용자가 클릭한 카드의 내용을 AI에게 전달
  if (focusedCard) {
    const truncated = focusedCard.content.length > 2000
      ? focusedCard.content.slice(0, 2000) + '...'  // 2000자 초과 시 잘라내기
      : focusedCard.content
    prompt += `\n\n[FOCUSED CARD CONTEXT]\n...${truncated}`
  }

  return prompt
}
```

**설계 결정**: 시스템 프롬프트가 동적인 이유는, AI가 "현재 상황"을 알아야 적절한 판단을 할 수 있기 때문입니다. 캔버스가 비어있으면 카드를 새로 만들고, 이미 BTC 카드가 있으면 ETH와 비교하는 식입니다.

## 4.2 7가지 도구 — AI가 할 수 있는 행동

Claude AI는 텍스트만 생성하는 것이 아니라, **도구(Tool)**를 호출하여 실제 행동을 수행합니다.

```typescript
// src/renderer/services/claude.ts — 7가지 도구 정의
const TOOLS = [
  // 1. spawn_card — 캔버스에 정보 카드 생성
  {
    name: 'spawn_card',
    description: 'Create an information card on the canvas...',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },      // 카드 제목
        content: { type: 'string' },     // 카드 내용 (마크다운)
        cardType: { type: 'string', enum: ['analysis', 'data', 'summary', 'comparison', 'news', 'price'] },
        symbol: { type: 'string' },      // 코인 심볼 (실시간 가격 연동용)
        relatedTo: { type: 'array', items: { type: 'string' } },  // 연관 카드 ID (엣지 자동 생성)
      },
      required: ['title', 'content'],
    },
  },
  // 2. spawn_webview — 캔버스에 웹사이트 삽입
  { name: 'spawn_webview', /* url, title 필수 */ },
  // 3. remove_cards — 카드 삭제 ("all" 또는 특정 ID)
  { name: 'remove_cards', /* target 필수 */ },
  // 4. rearrange — 카드 재배치 ("grid" 또는 "stack")
  { name: 'rearrange', /* layout 필수 */ },
  // 5. update_card — 기존 카드 내용 업데이트
  { name: 'update_card', /* cardId, content 필수 */ },
  // 6. open_investigation — Investigation Mode 열기
  { name: 'open_investigation', /* cardId 필수 */ },
  // 7. search_web — Tavily로 웹 검색
  { name: 'search_web', /* query 필수 */ },
]
```

## 4.3 도구 실행 — executeTool

AI가 도구를 호출하면, 실제 행동은 `executeTool` 함수에서 수행됩니다.

```typescript
// src/renderer/services/claude.ts — 도구 실행 함수
let spawnIndex = 0  // 카드 등장 순서 (cascade 애니메이션 딜레이 계산용)

async function executeTool(
  toolName: string,                     // 도구 이름
  input: Record<string, unknown>        // AI가 전달한 입력값
): Promise<string> {                    // 도구 실행 결과 (JSON 문자열로 AI에게 반환)
  const store = useCanvasStore.getState()

  switch (toolName) {
    case 'spawn_card': {
      const id = store.addCard({
        title: input.title as string,
        content: input.content as string,
        cardType: input.cardType as string,
        symbol: input.symbol as string,
        spawnDelay: spawnIndex * 0.15,  // 0.15초 간격으로 연달아 등장
      })
      spawnIndex++

      // relatedTo가 있으면 엣지(연결선) 자동 생성
      const relatedTo = input.relatedTo as string[] | undefined
      if (relatedTo && relatedTo.length > 0) {
        for (const targetId of relatedTo) {
          const targetExists = useCanvasStore.getState().cards.some((c) => c.id === targetId)
          if (targetExists) {
            useCanvasStore.getState().addEdge(id, targetId, 'weak')
          }
        }
      }
      // AI에게 생성된 카드 ID를 반환 → 다음 카드에서 relatedTo로 사용
      return JSON.stringify({ status: 'spawned', cardId: id })
    }

    case 'search_web': {
      const query = input.query as string
      const result = await api.searchWeb(query, currentTavilyApiKey)
      // 검색 결과를 AI에게 반환 → AI가 결과를 바탕으로 카드 생성
      return JSON.stringify({ status: 'success', results: result })
    }

    // ... 다른 도구들도 유사한 패턴
  }
}
```

## 4.4 멀티턴 루프 — AI와의 여러 차례 대화

한 번의 사용자 메시지에 AI는 여러 차례 도구를 사용할 수 있습니다. 이를 **멀티턴(Multi-turn) 루프**라고 합니다.

```
사용자: "BTC 최근 뉴스 알려줘"
    │
    ▼ Turn 1
AI: search_web("BTC latest news 2026")  ← AI가 먼저 검색
    │
    ▼ Turn 2 (검색 결과를 받은 후)
AI: spawn_card("BTC 최근 뉴스", "...")   ← 결과로 카드 생성
    spawn_card("BTC 가격 분석", "...")    ← 관련 카드도 생성
    │
    ▼ Turn 3 (카드 ID를 받은 후)
AI: "BTC에 대한 최근 뉴스를 정리했습니다..."  ← 최종 텍스트 응답
```

```typescript
// src/renderer/services/claude.ts — 멀티턴 루프 핵심 코드
export async function sendMessage(userMessage: string, options: SendMessageOptions) {
  // Tavily API 키 저장 (도구 실행 시 사용)
  currentTavilyApiKey = options.tavilyApiKey

  // 대화 히스토리에 사용자 메시지 추가
  conversationHistory.push({ role: 'user', content: userMessage })

  // 실시간 시세 데이터 가져오기 (메시지에 코인 심볼이 포함된 경우)
  const marketData = await fetchMarketData(userMessage)
  const systemPrompt = buildSystemPrompt(/* ... */)

  spawnIndex = 0  // 새 메시지마다 애니메이션 딜레이 초기화

  // 빈 assistant 메시지 생성 (스트리밍으로 채워짐)
  const messageId = chatStore.addMessage('assistant', '')
  chatStore.setStreamingMessageId(messageId)

  let turns = 0
  const maxTurns = 10  // 무한 루프 방지: 최대 10턴

  while (turns++ < maxTurns) {
    // SSE 스트리밍으로 한 라운드 실행
    const result = await streamOneRound(/* ... */)

    // assistant 응답을 대화 히스토리에 추가
    conversationHistory.push({ role: 'assistant', content: result.fullContent })

    // 도구 사용이 아니면 루프 종료 (최종 텍스트 응답)
    if (result.stopReason !== 'tool_use') break

    // 도구 실행 → 결과를 대화 히스토리에 user 역할로 추가
    const toolResults = []
    for (const block of result.toolUseBlocks) {
      const toolResult = await executeTool(block.name, block.input)
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: toolResult,
      })
    }
    // tool_result를 user 역할로 추가 (Claude API 규격)
    conversationHistory.push({ role: 'user', content: toolResults })
  }
}
```

**설계 결정**: `tool_result`가 `user` 역할인 이유는 Claude API의 규격 때문입니다. AI가 도구를 호출하면(assistant), 도구 실행 결과는 user 메시지로 전달해야 합니다. 이렇게 assistant → user → assistant → ... 의 교대 구조가 유지됩니다.

## 4.5 SSE 스트리밍 — 실시간 타이핑

```typescript
// src/renderer/services/claude.ts — SSE 스트리밍 처리
function streamOneRound(payload, messageId, existingText): Promise<StreamRoundResult> {
  return new Promise((resolve, reject) => {
    let accumulatedText = ''
    // tool_use 블록을 인덱스별로 추적 (JSON이 조각나서 도착하므로)
    const toolBlocks: Map<number, { id: string; name: string; jsonStr: string }> = new Map()
    const cleanups: Array<() => void> = []

    // 텍스트 조각이 도착할 때마다 메시지에 추가 (타이핑 효과)
    cleanups.push(api.onStreamEvent('stream:text-delta', (data) => {
      accumulatedText += data.text
      // 기존 텍스트 + 새 텍스트로 메시지를 실시간 업데이트
      useChatStore.getState().updateMessage(messageId, existingText + accumulatedText)
    }))

    // 도구 사용 시작 — 도구 이름과 ID를 기록
    cleanups.push(api.onStreamEvent('stream:tool-start', (data) => {
      toolBlocks.set(data.index, { id: data.id, name: data.name, jsonStr: '' })
    }))

    // 도구 입력 JSON 조각 — 조각들을 이어붙임
    cleanups.push(api.onStreamEvent('stream:tool-delta', (data) => {
      const block = toolBlocks.get(data.index)
      if (block) block.jsonStr += data.json  // JSON 조각 누적
    }))

    // 스트림 완료 — 누적된 결과를 Promise로 반환
    cleanups.push(api.onStreamEvent('stream:end', () => {
      cleanup()
      // 누적된 tool 블록의 JSON을 파싱
      const toolUseBlocks = []
      for (const [, block] of toolBlocks) {
        let parsedInput = {}
        try { parsedInput = JSON.parse(block.jsonStr || '{}') } catch {}
        toolUseBlocks.push({ id: block.id, name: block.name, input: parsedInput })
      }
      resolve({ text: accumulatedText, toolUseBlocks, stopReason, fullContent })
    }))

    // 스트리밍 시작 (fire-and-forget 방식)
    api.startChatStream(payload)
  })
}
```

**설계 결정**: 도구 입력 JSON이 조각(`partial_json`)으로 도착하는 이유는 SSE 스트리밍의 특성입니다. 예를 들어 `{"title": "BTC 분석"}`이 `{"tit` → `le": "BT` → `C 분석"}` 처럼 쪼개져서 옵니다. 그래서 `jsonStr`에 계속 이어붙인 후 스트림 종료 시점에 한 번에 `JSON.parse`합니다.

---

# Chapter 5: COMMAND 탭 UI

> **이 챕터를 한 문장으로 요약하면**: COMMAND 탭은 TRAVIS의 주 작업 공간으로, 왼쪽 뉴스 피드, 중앙 무한 캔버스, 오른쪽 AI 채팅의 3패널 구조이며, 각 패널은 독립적으로 작동하면서 스토어를 통해 데이터를 공유합니다.

## 5.1 앱의 루트: App.tsx

```typescript
// src/renderer/App.tsx — 앱의 최상위 컴포넌트
function App() {
  const [booting, setBooting] = useState(true)  // 부팅 시퀀스 진행 중?
  const investigationOpen = useInvestigationStore((s) => s.isOpen)  // Investigation Mode 열림?
  const activeTab = useTabStore((s) => s.activeTab)  // 현재 활성 탭

  // ── DataSource 초기화 (앱 시작 시 1회) ──
  useEffect(() => {
    const binance = new BinanceDataSource()  // 바이낸스 WebSocket 데이터소스 생성
    binance.onTicker = (data) => {
      useRealtimeStore.getState().updateTicker(data)  // 시세 도착 → 스토어 업데이트
    }
    binance.onStatusChange = (status) => {
      useRealtimeStore.getState().setConnectionStatus(status)  // 연결 상태 변경
    }
    dataSourceManager.registerSource(binance)  // 매니저에 등록
    dataSourceManager.connectAll()              // WebSocket 연결 시작
    return () => dataSourceManager.disconnectAll()  // 앱 종료 시 정리
  }, [])

  // ── 뉴스 피드 서비스 초기화 (부팅 완료 후) ──
  useEffect(() => {
    if (booting) return  // 부팅 중에는 시작하지 않음
    const unsub = feedService.onUpdate((items) => {
      useFeedStore.getState().addItems(items)    // 새 뉴스 → 스토어 저장
      scoringService.enqueue(items)               // AI 스코어링 큐에 추가
    })
    feedService.startAll()  // 뉴스 폴링 시작
    return () => { unsub(); feedService.stopAll(); scoringService.stop() }
  }, [booting])

  return (
    <div className="h-screen w-screen bg-void overflow-hidden flex flex-col">
      {booting ? (
        <BootSequence onComplete={() => setBooting(false)} />  // 부팅 → 시네마틱 시퀀스
      ) : (
        <>
          <TabBar />  {/* 상단 탭 바 (COMMAND / FEED) */}

          {/* COMMAND 탭 — display:none으로 숨김 (state 보존) */}
          <div style={{ display: activeTab === 'command' ? 'flex' : 'none' }}>
            <NewsFeed />    {/* 왼쪽: 실시간 뉴스 피드 */}
            <Canvas />      {/* 중앙: 무한 캔버스 */}
            <ChatPanel />   {/* 오른쪽: AI 채팅 */}
          </div>

          {/* FEED 탭 */}
          <div style={{ display: activeTab === 'feed' ? 'block' : 'none' }}>
            <MosaicFeed />  {/* 세계 지도 + 7컬럼 피드 + 캘린더 */}
          </div>

          <StatusBar />      {/* 연결 상태 표시 */}
          <PriceTicker />    {/* 하단 스크롤 시세 바 */}

          <AnimatePresence>
            {investigationOpen && <InvestigationMode />}  {/* Investigation Mode 오버레이 */}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}
```

**설계 결정**: 탭 전환 시 `display: none`을 사용하는 이유는 **상태 보존** 때문입니다. React에서 컴포넌트를 제거(`unmount`)하면 내부 상태가 사라집니다. `display: none`으로 숨기면 DOM에 남아있어 상태가 유지됩니다.

## 5.2 Canvas — 무한 캔버스

캔버스는 드래그로 이동(패닝)하고 마우스 휠로 확대/축소(줌)할 수 있는 무한 작업 공간입니다.

```typescript
// src/renderer/components/Canvas.tsx — 무한 캔버스
export default function Canvas() {
  const viewport = useCanvasStore((s) => s.viewport)  // 카메라 위치/줌
  const cards = useCanvasStore((s) => s.cards)          // 캔버스 위 카드들

  // ── 패닝 (마우스 드래그로 캔버스 이동) ──
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return          // 왼쪽 클릭만 처리
    isPanning.current = true
    const { x, y } = useCanvasStore.getState().viewport
    panStart.current = { x: e.clientX - x, y: e.clientY - y }
  }, [])

  // ── 줌 (마우스 휠로 확대/축소) ──
  // passive: false로 등록해야 e.preventDefault() 가능
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { zoom, x, y } = useCanvasStore.getState().viewport
      const factor = e.deltaY > 0 ? 0.9 : 1.1  // 스크롤 방향에 따라 축소/확대
      const newZoom = Math.min(Math.max(zoom * factor, 0.1), 3)  // 0.1~3 범위

      // 마우스 포인터 기준 줌 — 포인터 위치가 고정되도록 좌표 보정
      const rect = el.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const newX = mouseX - (mouseX - x) * (newZoom / zoom)
      const newY = mouseY - (mouseY - y) * (newZoom / zoom)

      useCanvasStore.getState().setViewport({ x: newX, y: newY, zoom: newZoom })
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    // ...
  }, [])

  return (
    <div ref={containerRef} className="flex-1 h-full relative overflow-hidden">
      {/* 카드 컨테이너 — CSS transform으로 패닝/줌 적용 */}
      <div style={{
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        transformOrigin: '0 0',  // 좌상단 기준으로 변환
      }}>
        <EdgeLayer />  {/* 연결선 — 카드 아래에 렌더링 */}
        <AnimatePresence mode="popLayout">
          {cards.map((item) => (
            <SpawnAnimation key={item.id} x={item.x} y={item.y} /* ... */>
              {item.type === 'card'
                ? <Card card={item} />
                : <WebviewCard card={item} />}
            </SpawnAnimation>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
```

## 5.3 Card — 정보 카드

```typescript
// src/renderer/components/Card.tsx — 핵심 기능들
export default function Card({ card }: CardProps) {
  // ── 실시간 가격 구독 ──
  // card에 symbol이 있으면 WebSocket 구독 시작
  useEffect(() => {
    if (!card.symbol) return
    subscribe(card.symbol.toUpperCase())        // 구독 시작
    return () => unsubscribe(card.symbol.toUpperCase())  // 언마운트 시 구독 해제
  }, [card.symbol])

  // ── 가격 변동 플래시 애니메이션 ──
  useEffect(() => {
    if (!ticker || ticker.prevPrice === ticker.price) return
    setFlash(ticker.price > ticker.prevPrice ? 'up' : 'down')  // 초록/빨강 플래시
    const timer = setTimeout(() => setFlash(null), 500)          // 0.5초 후 해제
    return () => clearTimeout(timer)
  }, [ticker?.price])

  // ── 카드 클릭 → 채팅 컨텍스트 연결 ──
  // 카드 내용 영역을 클릭하면 focusedCard로 설정
  <div onClick={() => useChatStore.getState().setFocusedCard({
    id: card.id, title: card.title, content: card.content
  })}>
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.content}</ReactMarkdown>
  </div>

  // ── 헤더 더블클릭 → Investigation Mode ──
  <div onDoubleClick={() => openInvestigation(card)}>
    {card.title}
  </div>
}
```

## 5.4 ChatPanel — AI 대화

```typescript
// src/renderer/components/ChatPanel.tsx — AI 채팅 패널
export default function ChatPanel() {
  const messages = useChatStore((s) => s.messages)    // 모든 메시지
  const isLoading = useChatStore((s) => s.isLoading)  // AI 응답 대기 중?
  const streamingMessageId = useChatStore((s) => s.streamingMessageId)  // 스트리밍 중인 메시지
  const focusedCard = useChatStore((s) => s.focusedCard)  // 참조 중인 카드

  const handleSendWithMessage = useCallback(async (msg: string) => {
    const { apiKey, model, contextPrompt, tavilyApiKey } = useSettingsStore.getState()
    if (!apiKey) { setSettingsOpen(true); return }  // API 키 없으면 설정 모달 열기

    useChatStore.getState().addMessage('user', msg)  // 사용자 메시지 추가
    setLoading(true)

    // 현재 캔버스 카드 정보 수집 (시스템 프롬프트용)
    const cards = useCanvasStore.getState().cards
    const canvasCards = cards.map((c) => ({
      id: c.id, title: c.title, type: c.type,
      // 웹뷰는 실시간 제목/URL도 포함
      ...(c.type === 'webview' ? { liveTitle: c.liveTitle, liveUrl: c.liveUrl } : {}),
    }))

    // claude.ts의 sendMessage 호출 (멀티턴 루프 + 스트리밍)
    await sendMessage(msg, {
      apiKey, model, contextPrompt, tavilyApiKey, canvasCards,
      focusedCard: useChatStore.getState().focusedCard ?? undefined,
    })
  }, [])

  return (
    <div className="w-80 h-full flex flex-col bg-deep border-l border-white/5">
      {/* 메시지 목록 */}
      {messages.map((msg) => (
        <div key={msg.id} className={msg.role === 'user' ? 'justify-end' : 'justify-start'}>
          {msg.content}
          {msg.id === streamingMessageId && <span className="streaming-cursor">▌</span>}
        </div>
      ))}

      {/* 로딩 인디케이터 (스트리밍 시작 전) */}
      {isLoading && !streamingMessageId && (
        <span className="analyzing-pulse">Analyzing...</span>
      )}

      {/* 포커스 카드 컨텍스트 바 */}
      {focusedCard && (
        <div className="bg-purple-500/10 border border-purple-500/30">
          {focusedCard.title} 참조 중
          <button onClick={clearFocusedCard}>✕</button>
        </div>
      )}
    </div>
  )
}
```

**설계 결정**: 채팅의 핵심 흐름은 다음과 같습니다:
1. 사용자 입력 → `useChatStore.addMessage('user', msg)`
2. `claude.ts.sendMessage()` 호출 (비동기)
3. 빈 assistant 메시지 생성 → 스트리밍으로 한 글자씩 채워짐
4. 도구 실행 시 카드가 캔버스에 나타남
5. 최종 텍스트 응답이 완성되면 `streamingMessageId = null`

---

# Chapter 6: FEED 탭 UI

> **이 챕터를 한 문장으로 요약하면**: FEED 탭은 세계 지도 위에 뉴스 이벤트를 표시하고, 7개 카테고리 컬럼으로 원시 피드를 보여주며, 경제 이벤트 캘린더까지 제공하는 정보 모니터링 대시보드입니다.

## 6.1 MosaicFeed — FEED 탭의 레이아웃

```typescript
// src/renderer/components/MosaicFeed.tsx — FEED 탭 전체 레이아웃
// 상단: WorldMap(또는 Calendar) + FeedSidebar
// 하단: 7컬럼 MultiColumnFeed (드래그로 높이 조절 가능)

export default function MosaicFeed() {
  const [topView, setTopView] = useState<'map' | 'calendar'>('map')  // 상단 뷰 전환
  const [bottomHeight, setBottomHeight] = useState(300)               // 하단 패널 높이
  const isDragging = useRef(false)                                     // 드래그 핸들 상태

  // ── 드래그 핸들 — 상단/하단 비율 조절 ──
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    const startY = e.clientY       // 드래그 시작 위치
    const startH = bottomHeight    // 시작 시점의 하단 높이

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const delta = startY - ev.clientY  // 위로 끌면 양수 (높이 증가)
      setBottomHeight(Math.max(100, Math.min(600, startH + delta)))
    }
    const onUp = () => { isDragging.current = false; /* cleanup */ }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [bottomHeight])

  return (
    <div className="h-full flex flex-col bg-void">
      {/* 상단 영역: 지도/캘린더 + 피드 사이드바 */}
      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 relative">
          {/* 미니 탭: MAP / CALENDAR 전환 */}
          <div className="absolute top-2 left-2 z-10 flex gap-1">
            <button onClick={() => setTopView('map')}>MAP</button>
            <button onClick={() => setTopView('calendar')}>CALENDAR</button>
          </div>
          {topView === 'map' ? <WorldMap /> : <EventCalendar />}
        </div>
        <FeedSidebar />  {/* 오른쪽 300px 사이드바 */}
      </div>

      {/* 드래그 핸들 — 상하 패널 사이 */}
      <div className="h-1.5 cursor-ns-resize bg-white/5" onMouseDown={handleDragStart} />

      {/* 하단 영역: 7컬럼 피드 */}
      <div style={{ height: bottomHeight }}>
        <MultiColumnFeed />
      </div>
    </div>
  )
}
```

## 6.2 WorldMap — 세계 지도

react-simple-maps 라이브러리를 사용해 뉴스 이벤트의 지리적 위치를 지도 위에 표시합니다.

```typescript
// src/renderer/components/WorldMap.tsx — 세계 지도 + 뉴스 핀
// geoKeywords.ts에서 뉴스 제목/소스에서 위치를 추출하고,
// 해당 위치의 좌표에 핀을 표시합니다.

// pinGroups — 같은 위치의 뉴스를 그룹화 (핀 겹침 방지)
const pinGroups = useMemo(() => {
  const groups = new Map<string, { items: FeedItem[]; coords: [number, number] }>()
  for (const item of geoItems) {
    const key = item.location!                // 위치 이름 (예: "Washington DC")
    const coords = getCoordinates(key)        // 위치 → 좌표 변환
    if (!coords) continue
    if (!groups.has(key)) groups.set(key, { items: [], coords })
    groups.get(key)!.items.push(item)
  }
  return Array.from(groups.values())
}, [geoItems])

// 핀 렌더링 — 중요도에 따른 색상, 최근 뉴스에 펄스 애니메이션
{pinGroups.map((group) => (
  <Marker coordinates={group.coords}>
    <circle
      r={4 + group.items.length}  // 뉴스 많을수록 큰 핀
      fill={getImportanceColor(group.items[0].importance)}  // 중요도별 색상
      className={isRecent ? 'map-pin-pulse' : ''}  // 최근이면 펄스 애니메이션
    />
  </Marker>
))}
```

## 6.3 MultiColumnFeed — 7컬럼 피드

```typescript
// src/renderer/components/MultiColumnFeed.tsx — 7개 카테고리 컬럼
// 각 컬럼은 독립적으로 스크롤되며, 해당 카테고리의 뉴스만 표시

const CATEGORIES: FeedCategory[] = ['macro', 'crypto', 'onchain', 'exchange', 'social', 'stocks', 'world']

export default function MultiColumnFeed() {
  return (
    <div className="h-full flex gap-px bg-white/5">
      {CATEGORIES.map((cat) => (
        <FeedColumn key={cat} category={cat} />  // 카테고리별 독립 컬럼
      ))}
    </div>
  )
}

// src/renderer/components/FeedColumn.tsx — 단일 컬럼
// useFeedStore에서 해당 카테고리의 아이템만 필터링
export default function FeedColumn({ category }: { category: FeedCategory }) {
  const items = useFeedStore((s) => s.items)
  const filtered = items.filter((item) => item.category === category)  // 카테고리 필터

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      {/* 컬럼 헤더 — 카테고리 이름 + 색상 인디케이터 */}
      <div className="px-2 py-1.5 border-b border-white/5">
        <span style={{ color: getCategoryColor(category) }}>
          {category.toUpperCase()}
        </span>
      </div>
      {/* 스크롤 가능한 아이템 목록 */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((item) => (
          <FeedItem key={item.id} item={item} compact />
        ))}
      </div>
    </div>
  )
}
```

## 6.4 EventCalendar — 경제 이벤트 캘린더

```typescript
// src/renderer/components/EventCalendar.tsx — 월별 캘린더
// FOMC, CPI, NFP 등 주요 경제 이벤트와 암호화폐 이벤트를 표시

// 하드코딩된 이벤트 데이터 (2025-2026)
const HARDCODED_EVENTS = [
  { date: '2025-01-29', title: 'FOMC Meeting', category: 'macro' },
  { date: '2025-02-12', title: 'CPI Report', category: 'macro' },
  { date: '2025-03-07', title: 'NFP (Non-Farm Payrolls)', category: 'macro' },
  // ... 2026년까지의 일정
  { date: '2025-04-17', title: 'Bitcoin Halving Anniversary', category: 'crypto' },
]

// 월별 그리드 렌더링 (7열 × 5~6행)
// 각 날짜 셀에 이벤트가 있으면 카테고리 색상 점으로 표시
{eventsForDay.length > 0 && (
  <div className="flex gap-0.5 mt-0.5">
    {eventsForDay.map((ev, i) => (
      <div
        key={i}
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: getCategoryColor(ev.category) }}
      />
    ))}
  </div>
)}
```

---

# Chapter 7: Investigation Mode

> **이 챕터를 한 문장으로 요약하면**: Investigation Mode는 특정 코인 카드를 더블클릭하면 열리는 전체 화면 6패널 분석 대시보드로, 개요/차트/뉴스/고래활동/온체인/섹터 데이터를 동시에 보여줍니다.

## 7.1 아키텍처

```
┌─────────────────────────────────────────────────────┐
│              Investigation Mode (전체 화면)            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Overview  │  │  Chart   │  │   News   │          │
│  │ (개요+    │  │ (Trading │  │ (관련    │           │
│  │  파생상품) │  │  View)   │  │  뉴스)   │          │
│  ├──────────┤  ├──────────┤  ├──────────┤          │
│  │  Whale   │  │ On-chain │  │  Sector  │          │
│  │ (고래     │  │ (온체인   │  │ (섹터    │           │
│  │  거래)    │  │  데이터)  │  │  비교)   │          │
│  └──────────┘  └──────────┘  └──────────┘          │
└─────────────────────────────────────────────────────┘
```

## 7.2 useInvestigationStore — 6패널 데이터 로딩

```typescript
// src/renderer/stores/useInvestigationStore.ts — 핵심 로직

// PanelType — 6가지 패널 유형
export type PanelType = 'markdown' | 'chart' | 'news' | 'whale' | 'onchain' | 'sector'

// SECTOR_MAP — 코인별 섹터 분류
const SECTOR_MAP = {
  BTC: { name: 'Store of Value', symbols: ['BTC', 'LTC', 'BCH'] },
  ETH: { name: 'Smart Contract', symbols: ['ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC'] },
  UNI: { name: 'DeFi', symbols: ['UNI', 'AAVE', 'LINK', 'MKR'] },
  DOGE: { name: 'Meme', symbols: ['DOGE', 'SHIB', 'PEPE'] },
  // ...
}

// loadPanelData — 4단계(Phase A→D)로 데이터를 병렬 로딩
async function loadPanelData(symbol: string) {
  // Phase A — CoinGecko ID 확인 (순차)
  let coinId = SYMBOL_TO_COINGECKO[symbol] ?? null
  if (!coinId) {
    coinId = await api.searchCoinId(symbol)  // 하드코딩에 없으면 API 검색
  }

  // Phase B — 3개 API 병렬 호출
  const [tradesResult, coinResult, sectorResult] = await Promise.allSettled([
    api.fetchRecentTrades(symbol, 500),   // 바이낸스: 최근 거래 500건
    api.fetchCoinData(coinId),             // CoinGecko: 코인 상세 데이터
    api.fetchMultipleTickers(sectorInfo.symbols),  // 바이낸스: 섹터 내 코인들 시세
  ])

  // Whale 패널 — $100K 이상 거래만 필터링
  if (tradesResult.status === 'fulfilled') {
    const whaleTrades = allTrades.filter((t) => parseFloat(t.quoteQty) >= 100000)
    store.updatePanel('whale', { data: { trades: whaleTrades }, isLoading: false })
  }

  // Phase C — 섹터 데이터 폴백
  // SECTOR_MAP에 없는 코인은 CoinGecko categories에서 섹터 이름을 가져옴

  // Phase D — 선물 데이터 (Funding Rate, Open Interest)
  // Overview 패널에 파생상품 섹션을 추가
  const [fundingResult, oiResult] = await Promise.allSettled([
    api.fetchFundingRate(symbol),     // 펀딩비 (롱/숏 균형 지표)
    api.fetchOpenInterest(symbol),    // 미결제약정 (시장 관심도 지표)
  ])
}

// 스토어 생성
export const useInvestigationStore = create<InvestigationState>((set) => ({
  isOpen: false,
  targetCard: null,
  panels: [],

  // open — Investigation Mode 열기
  open: (card) => {
    // 코인 카드면 6개 전문 패널, 아니면 일반 패널
    const panels = card.symbol ? buildCoinPanels(card) : buildGenericPanels(card)
    set({ isOpen: true, targetCard: card, panels })
    if (card.symbol) {
      loadPanelData(card.symbol)  // 비동기 데이터 로딩 시작
    }
  },
}))
```

**설계 결정**: `Promise.allSettled`를 사용하는 이유는 **독립적 실패 허용** 때문입니다. 하나의 API가 실패해도 다른 패널은 정상 표시됩니다. `Promise.all`을 사용하면 하나만 실패해도 전체가 실패합니다.

## 7.3 InvestigationMode — 전체 화면 오버레이

```typescript
// src/renderer/components/InvestigationMode.tsx
export default function InvestigationMode() {
  const panels = useInvestigationStore((s) => s.panels)
  const close = useInvestigationStore((s) => s.close)
  const targetCard = useInvestigationStore((s) => s.targetCard)

  // ESC 키로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [close])

  const maximizedPanel = panels.find((p) => p.isMaximized)

  return (
    <motion.div className="fixed inset-0 z-50 bg-void/95 backdrop-blur-sm">
      {/* 스캔 라인 효과 — 영화적 분위기 연출 */}
      <div className="scan-line" />

      {/* 헤더 — 분석 대상 카드 제목 + 닫기 버튼 */}
      <div className="flex items-center justify-between px-6 py-3">
        <span className="font-rajdhani text-lg text-purple-400">
          INVESTIGATION: {targetCard?.title}
        </span>
      </div>

      {/* 패널 그리드 — 3열 × 2행, 또는 최대화 시 1개만 표시 */}
      <div className={maximizedPanel ? '' : 'grid grid-cols-3 grid-rows-2 gap-2'}>
        {(maximizedPanel ? [maximizedPanel] : panels.filter((p) => !p.isFolded)).map((panel) => (
          <InvestigationPanel key={panel.id} panel={panel} />
        ))}
      </div>
    </motion.div>
  )
}
```

## 7.4 패널별 컴포넌트

| 패널 | 컴포넌트 | 데이터 소스 |
|------|---------|------------|
| Overview | 마크다운 + 파생상품 섹션 | useRealtimeStore + Binance Futures |
| Chart | `InvestigationChart.tsx` | TradingView 위젯 (iframe) |
| News | `InvestigationNews.tsx` | useFeedStore (심볼 키워드 필터) |
| Whale | `InvestigationWhale.tsx` | Binance REST (최근 거래 $100K+) |
| On-chain | `InvestigationOnchain.tsx` | CoinGecko (시총, 가격 이력) |
| Sector | `InvestigationSector.tsx` | Binance Multi-ticker (섹터 비교)

---

# Chapter 8: 서비스 레이어

> **이 챕터를 한 문장으로 요약하면**: 서비스 레이어는 UI와 분리된 비즈니스 로직 계층으로, WebSocket 실시간 연결, 뉴스 피드 폴링, AI 뉴스 스코어링의 세 가지 핵심 서비스를 독립적으로 운영합니다.

## 8.1 DataSource — 실시간 데이터 추상화

DataSource는 "실시간 데이터를 제공하는 소스"의 인터페이스(interface, 규격)입니다. 현재는 Binance만 구현되어 있지만, 향후 다른 거래소도 같은 규격으로 추가할 수 있습니다.

```typescript
// src/renderer/services/dataSource.ts — DataSource 인터페이스 + 매니저

// DataSource — 모든 실시간 데이터 소스가 따라야 할 규격
export interface DataSource {
  readonly name: string                // 소스 이름 (예: 'binance')
  status: ConnectionStatus             // 현재 연결 상태
  connect(): void                      // 연결 시작
  disconnect(): void                   // 연결 종료
  subscribe(symbol: string): void      // 특정 심볼 구독
  unsubscribe(symbol: string): void    // 구독 해제
  onTicker: ((data: TickerData) => void) | null  // 시세 도착 시 콜백
  onStatusChange: ((status: ConnectionStatus) => void) | null  // 상태 변경 콜백
}

// DataSourceManager — 여러 DataSource를 관리하는 중앙 매니저
class DataSourceManager {
  private sources: DataSource[] = []
  private refCounts: Map<string, number> = new Map()  // 참조 카운팅 (Reference Counting)

  // subscribe — 심볼 구독 (참조 카운팅 적용)
  subscribe(symbol: string) {
    const count = this.refCounts.get(symbol) || 0
    this.refCounts.set(symbol, count + 1)

    // 첫 번째 구독자일 때만 실제 WebSocket 구독 시작
    if (count === 0) {
      const source = this.getSourceForSymbol(symbol)
      source?.subscribe(symbol)
    }
  }

  // unsubscribe — 구독 해제 (마지막 구독자가 해제할 때만 실제 해제)
  unsubscribe(symbol: string) {
    const count = this.refCounts.get(symbol) || 0
    if (count <= 1) {
      this.refCounts.delete(symbol)         // 참조 카운트 0 → 삭제
      const source = this.getSourceForSymbol(symbol)
      source?.unsubscribe(symbol)           // 실제 WebSocket 구독 해제
    } else {
      this.refCounts.set(symbol, count - 1) // 아직 다른 구독자가 있음
    }
  }
}

export const dataSourceManager = new DataSourceManager()  // 싱글턴 인스턴스
```

**설계 결정: 참조 카운팅(Reference Counting)**

BTC 카드가 3개 있으면, 모두 BTC 시세를 구독합니다. 하지만 WebSocket에 3번 구독할 필요는 없습니다. 참조 카운팅으로 실제 구독은 1번만 하고, 마지막 카드가 삭제될 때만 구독을 해제합니다.

```
카드1 subscribe("BTC") → refCount: 1 → 실제 WebSocket 구독
카드2 subscribe("BTC") → refCount: 2 → 무시 (이미 구독 중)
카드1 unsubscribe("BTC") → refCount: 1 → 무시 (아직 구독자 있음)
카드2 unsubscribe("BTC") → refCount: 0 → 실제 WebSocket 구독 해제
```

## 8.2 BinanceDataSource — WebSocket 실시간 연결

```typescript
// src/renderer/services/binanceWs.ts — 바이낸스 WebSocket 클라이언트
const WS_URL = 'wss://stream.binance.com:9443/ws'  // 바이낸스 WebSocket 서버 주소
const MAX_RECONNECT_DELAY = 30000  // 최대 재접속 대기 시간 (30초)

export class BinanceDataSource implements DataSource {
  readonly name = 'binance'
  private ws: WebSocket | null = null           // WebSocket 연결 객체
  private subscribedSymbols: Set<string> = new Set()  // 현재 구독 중인 심볼들
  private reconnectDelay = 1000                 // 재접속 대기 시간 (지수적 증가)

  connect() {
    this.ws = new WebSocket(WS_URL)

    this.ws.onopen = () => {
      this.setStatus('connected')
      this.reconnectDelay = 1000  // 연결 성공 → 대기 시간 초기화

      // 재접속 시 기존 구독 목록을 자동 복원
      if (this.subscribedSymbols.size > 0) {
        this.sendSubscribe([...this.subscribedSymbols])
      }
    }

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.e === '24hrTicker') {
        this.handleTicker(data)  // 24시간 시세 데이터 파싱
      }
    }

    this.ws.onclose = () => {
      this.setStatus('reconnecting')
      this.scheduleReconnect()  // 자동 재접속
    }
  }

  // handleTicker — 바이낸스 시세 데이터를 TickerData 형태로 변환
  private handleTicker(data: Record<string, unknown>) {
    const ticker: TickerData = {
      symbol: (data.s as string).toUpperCase(),  // 심볼명
      price: parseFloat(data.c as string),        // 현재가
      change24h: parseFloat(data.P as string),    // 24시간 변동률
      volume24h: parseFloat(data.v as string),    // 24시간 거래량
      high24h: parseFloat(data.h as string),      // 24시간 최고가
      low24h: parseFloat(data.l as string),       // 24시간 최저가
      latency: Date.now() - (data.E as number),   // 지연 시간 (밀리초)
      source: this.name,
    }
    this.onTicker?.(ticker)  // 콜백으로 데이터 전달
  }

  // scheduleReconnect — 지수적 백오프(Exponential Backoff)로 재접속
  private scheduleReconnect() {
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY)
      // 1초 → 2초 → 4초 → 8초 → ... → 최대 30초 간격으로 재접속 시도
      this.connect()
    }, this.reconnectDelay)
  }
}
```

**설계 결정: 지수적 백오프(Exponential Backoff)**: 네트워크 장애 시 재접속 간격을 점점 늘립니다. 서버가 과부하인 경우 모든 클라이언트가 동시에 재접속을 시도하면 상황이 악화되기 때문입니다.

## 8.3 FeedService — 뉴스 피드 폴링

```typescript
// src/renderer/services/feedService.ts — 뉴스 피드 매니저

// FeedSource — 뉴스 소스 인터페이스
interface FeedSource {
  name: string       // 소스 이름
  interval: number   // 폴링 간격 (밀리초)
  fetch(): Promise<FeedItem[]>  // 뉴스 가져오기
}

// CryptoCompare 뉴스 소스 — 60초마다 폴링
const cryptoNewsSource: FeedSource = {
  name: 'CryptoCompare',
  interval: 60_000,  // 1분마다 새 뉴스 확인
  async fetch(): Promise<FeedItem[]> {
    const raw = await api.fetchCryptoNews()  // IPC를 통해 Main Process에서 가져옴
    return raw.map((item) => {
      // 카테고리 분류 — categories 문자열에서 추론
      let category: FeedCategory = 'crypto'         // 기본값
      if (cats.includes('exchange')) category = 'exchange'
      else if (cats.includes('regulation')) category = 'macro'
      else if (cats.includes('mining')) category = 'onchain'

      return {
        id: `cn-${item.timestamp}-${i}`,
        title: item.title,
        category,
        importance: 'signal',  // 기본 중요도 (AI가 나중에 재평가)
        location: extractLocation(item.title, item.source)?.name,  // 지리 위치 추출
      }
    })
  },
}

// Fear & Greed Index — 5분마다 폴링
const fearGreedSource: FeedSource = {
  name: 'FearGreed',
  interval: 300_000,  // 5분마다 업데이트
  async fetch(): Promise<FeedItem[]> {
    const data = await api.fetchFearGreed()
    // 극단적 수치(25 이하 또는 75 이상)는 'alert' 등급으로 승격
    const importance = data.value <= 25 || data.value >= 75 ? 'alert' : 'signal'
    return [{ title: `Fear & Greed Index: ${data.value} (${data.classification})`, importance }]
  },
}

// FeedServiceManager — 모든 소스를 통합 관리
class FeedServiceManager {
  private sources: FeedSource[] = [cryptoNewsSource, fearGreedSource]
  private listeners = new Set<(items: FeedItem[]) => void>()  // 이벤트 리스너들

  startAll() {
    for (const source of this.sources) {
      const run = async () => {
        const items = await source.fetch()  // 뉴스 가져오기
        for (const item of items) this.allItems.set(item.id, item)  // 중복 방지
        this.notify()  // 모든 리스너에게 알림
      }
      run()  // 즉시 1회 실행
      this.timers.push(setInterval(run, source.interval))  // 이후 주기적 실행
    }
  }

  // onUpdate — 콜백 등록 (App.tsx에서 사용)
  onUpdate(callback: (items: FeedItem[]) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)  // 해제 함수 반환
  }
}
```

## 8.4 ScoringService — AI 뉴스 중요도 평가

```typescript
// src/renderer/services/scoringService.ts — AI 배치 스코어링
const SCORING_MODEL = 'claude-haiku-4-5-20251001'  // 빠르고 저렴한 Haiku 모델 사용
const BATCH_SIZE = 5    // 5개씩 모이면 즉시 처리
const MAX_BATCH = 10    // 한 번에 최대 10개 처리
const TIMER_MS = 10_000 // 10초 후에도 처리 (5개 미만이어도)

// AI 시스템 프롬프트 — 뉴스 분류 기준 명시
const SYSTEM_PROMPT = `You are a trading news importance classifier.
Rate each news headline. Respond ONLY with a JSON array.
Criteria:
  critical = market-moving event (hack, crash, major regulation)
  alert = significant (whale move, major partnership)
  signal = notable (exchange listing, protocol update)
  info = routine/low-impact`

class ScoringService {
  private queue: FeedItem[] = []     // 평가 대기 큐
  private processing = false          // 현재 처리 중인지

  // enqueue — 새 뉴스가 도착하면 큐에 추가
  enqueue(items: FeedItem[]) {
    const unscored = items.filter((i) => i.scored !== true)  // 이미 평가된 건 제외
    this.queue.push(...unscored)

    if (this.queue.length >= BATCH_SIZE) {
      this.processBatch()  // 5개 이상이면 즉시 처리
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.processBatch(), TIMER_MS)  // 아니면 10초 대기
    }
  }

  // processBatch — Claude Haiku로 배치 평가
  private async processBatch() {
    const batch = this.queue.splice(0, MAX_BATCH)  // 큐에서 최대 10개 꺼내기
    // Claude Haiku에게 헤드라인 목록을 보내고 JSON 배열로 평가받기
    const response = await api.sendChatMessage({ model: SCORING_MODEL, /* ... */ })
    const results = this.parseResults(textBlock.text)  // JSON 파싱
    useFeedStore.getState().updateScoring(results)     // 스토어에 점수 반영
  }

  // parseResults — AI 응답 파싱 (JSON + regex 폴백)
  private parseResults(text: string): ScoringResult[] {
    try {
      return JSON.parse(text)  // 정상적인 JSON
    } catch {
      // AI가 JSON 앞뒤에 설명을 붙이는 경우 → 정규식으로 JSON 배열 추출
      const match = text.match(/\[[\s\S]*\]/)
      if (match) return JSON.parse(match[0])
    }
    return []  // 모두 실패 시 빈 배열
  }
}
```

**설계 결정**: Haiku 모델을 사용하는 이유는 스코어링은 간단한 분류 작업이므로, 비용이 저렴하고 빠른 Haiku가 적합합니다. Sonnet이나 Opus를 사용하면 비용이 수십 배 올라갑니다.

---

# Chapter 9: 디자인 시스템

> **이 챕터를 한 문장으로 요약하면**: TRAVIS의 디자인 시스템은 군사 지휘소 느낌의 다크 테마를 기반으로, CSS 변수와 TailwindCSS 커스텀 설정으로 일관된 시각적 언어를 유지합니다.

## 9.1 색상 체계

```css
/* src/renderer/index.css — CSS 변수 정의 */
:root {
  --void:   #01010a;   /* 가장 깊은 배경색 — 우주의 진공 */
  --deep:   #030310;   /* 패널 배경 — void보다 살짝 밝은 */
  --panel:  #06060f;   /* 일반 패널 배경 */
  --card:   #0a0a18;   /* 카드 배경 */
  --border: rgba(255,255,255,0.05);  /* 테두리 — 거의 안 보이는 수준 */

  /* 텍스트 계층 — 밝기 4단계 */
  --t1: #f1f5f9;  /* 가장 밝은 텍스트 — 제목, 중요 정보 */
  --t2: #94a3b8;  /* 일반 텍스트 — 본문 */
  --t3: #475569;  /* 보조 텍스트 — 소스, 타임스탬프 */
  --t4: #1e293b;  /* 가장 어두운 텍스트 — 비활성, 플레이스홀더 */

  /* 액센트 색상 — 카테고리별 */
  --pb:     #a855f7;   /* 메인 퍼플 — TRAVIS 브랜드 색 */
  --purple: #7c3aed;   /* 보조 퍼플 */
  --cyan:   #22d3ee;   /* 시안 — 온체인 데이터, 웹뷰 */
  --green:  #22c55e;   /* 초록 — 가격 상승, 소셜 */
  --red:    #ef4444;   /* 빨강 — 가격 하락, 거래소 */
  --amber:  #f59e0b;   /* 앰버 — 매크로, 경고 */
  --blue:   #3b82f6;   /* 블루 — 주식 */
  --pink:   #ec4899;   /* 핑크 — 월드 */
}
```

## 9.2 카테고리 색상 매핑

```
카테고리        색상      용도
─────────────────────────────────
MACRO          앰버      경제 지표 (FOMC, CPI, NFP)
CRYPTO         퍼플      암호화폐 일반 뉴스
ON-CHAIN       시안      온체인 데이터, 트랜잭션
EXCHANGE       빨강      거래소 공지, 상폐
SOCIAL         초록      소셜 미디어, 커뮤니티
STOCKS         블루      전통 주식 시장
WORLD          핑크      국제 뉴스, 지정학
```

## 9.3 TailwindCSS 커스텀 설정

```javascript
// tailwind.config.js — 디자인 시스템을 Tailwind에 등록
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],  // 데이터/숫자용 글꼴
        rajdhani: ['Rajdhani', 'sans-serif'],    // 제목용 글꼴 (군사적 느낌)
      },
      colors: {
        void: '#01010a',    // bg-void로 사용
        deep: '#030310',    // bg-deep으로 사용
        card: '#0a0a18',    // bg-card로 사용
        t1: '#f1f5f9',      // text-t1으로 사용
        t2: '#94a3b8',
        t3: '#475569',
        t4: '#1e293b',
        pb: '#a855f7',
        accent: {
          cyan: '#22d3ee',   // text-accent-cyan으로 사용
          green: '#22c55e',
          red: '#ef4444',
          amber: '#f59e0b',
        },
      },
    },
  },
}
```

## 9.4 핵심 애니메이션

```css
/* src/renderer/index.css — 주요 CSS 애니메이션 */

/* 부팅 시퀀스 — 궤도 고리 회전 */
@keyframes boot-ring {
  0% { transform: rotateX(70deg) rotateZ(0deg); }
  100% { transform: rotateX(70deg) rotateZ(360deg); }
}

/* Investigation Mode — 스캔 라인 (위에서 아래로 반복) */
@keyframes scan-sweep {
  0% { top: -2px; }
  100% { top: 100%; }
}

/* 카드 등장 — 빛나는 글로우 효과 */
@keyframes spawn-glow {
  0% { box-shadow: 0 0 20px rgba(168,85,247,0.4); }
  100% { box-shadow: 0 0 0 rgba(168,85,247,0); }
}

/* 시세 바 — 무한 스크롤 */
@keyframes ticker-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }  /* 50%만 이동하면 이어지는 효과 */
}

/* 지도 핀 — 펄스 (최근 뉴스 표시) */
@keyframes map-pin-pulse {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(2.5); opacity: 0; }
}

/* AI 타이핑 커서 — 깜빡임 */
.streaming-cursor {
  animation: blink 0.8s infinite;
}

/* AI 분석 중 표시 — 맥동 */
.analyzing-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}
```

## 9.5 중요도 레벨 스타일링

```
레벨       텍스트 밝기    배경         테두리
──────────────────────────────────────────────
HIGH      밝음 (t1)     미묘한 bg    있음
MED       중간 (t2)     희미한 bg    없음
LOW       어두움 (0.5)  없음         없음
```

이 패턴은 FeedItem, InvestigationPanel 등 여러 컴포넌트에서 일관되게 적용됩니다.

---

# Chapter 10: 개발 로드맵과 아키텍처 결정

> **이 챕터를 한 문장으로 요약하면**: TRAVIS는 Phase 1(기본 구조)과 Phase 2(모자이크 플랫폼)를 완료했으며, 각 단계마다 점진적으로 기능을 쌓아올리는 레이어드 아키텍처를 채택했습니다.

## 10.1 Phase 1 → Phase 2 진화

```
Phase 1: "Chat → Cards"
┌──────────┐  ┌──────────┐
│ Chat     │→ │ Canvas   │  사용자가 말하면 AI가 카드를 만듦
│ Panel    │  │ Cards    │
└──────────┘  └──────────┘

Phase 2: "Mosaic Intelligence Platform"
┌──────┬──────┬──────┐
│ News │Canvas│ Chat │  COMMAND 탭: 뉴스 + 캔버스 + 채팅
│ Feed │+Edge │Panel │
├──────┴──────┴──────┤
│   Price Ticker Bar  │
└─────────────────────┘
┌──────────────────────┐
│   World Map / Calendar│  FEED 탭: 글로벌 모니터링
│   7-Column Raw Feed  │
└──────────────────────┘
```

## 10.2 주요 아키텍처 결정 요약

| 결정 | 선택 | 이유 |
|------|------|------|
| 상태 관리 | Zustand (7 스토어) | Redux보다 간결, 보일러플레이트 최소화 |
| AI 통신 | SSE 스트리밍 | 실시간 타이핑 효과, 대기 시간 체감 감소 |
| 실시간 데이터 | WebSocket + 참조 카운팅 | 중복 구독 방지, 리소스 효율화 |
| 탭 전환 | display:none | 컴포넌트 상태 보존 (unmount 방지) |
| 뉴스 스코어링 | Haiku 모델 배치 | 비용 효율 (Sonnet 대비 1/10 비용) |
| API 에러 처리 | Promise.allSettled | 독립적 실패 허용 (하나 실패해도 나머지 정상) |
| IPC 보안 | contextIsolation | 프론트엔드에서 Node.js 직접 접근 차단 |
| 재접속 전략 | 지수적 백오프 | 서버 과부하 방지, 안정적 복구 |

## 10.3 파일 간 의존성 맵

```
App.tsx ─────────────→ 모든 컴포넌트의 루트
  ├── BootSequence    (독립)
  ├── TabBar          → useTabStore
  ├── Canvas          → useCanvasStore, Card, WebviewCard, EdgeLayer
  │    ├── Card       → useCanvasStore, useRealtimeStore, useChatStore, useInvestigationStore
  │    ├── WebviewCard→ useCanvasStore (webview 메타데이터, 자동 엣지)
  │    └── EdgeLayer  → useCanvasStore (edges, hoveredNodeId)
  ├── ChatPanel       → useChatStore, useSettingsStore, useCanvasStore, claude.ts
  ├── NewsFeed        → useFeedStore
  ├── MosaicFeed      → WorldMap, EventCalendar, FeedSidebar, MultiColumnFeed
  ├── StatusBar       → useRealtimeStore
  ├── PriceTicker     → useRealtimeStore (crypto) + REST polling (tradFi, kimchi)
  └── InvestigationMode → useInvestigationStore (6 패널)

claude.ts ───────────→ AI 두뇌
  ├── useCanvasStore  (카드/엣지 생성)
  ├── useChatStore    (메시지 스트리밍)
  ├── useInvestigationStore (Investigation 열기)
  └── preload.ts → ipc.ts (Claude API, Tavily API)

서비스 레이어
  ├── dataSource.ts   → binanceWs.ts (WebSocket 매니저)
  ├── feedService.ts  → preload.ts → feedApi.ts (뉴스 폴링)
  └── scoringService.ts → preload.ts → ipc.ts → Claude Haiku (AI 스코어링)
```

## 10.4 Phase 2 완료 체크리스트

- [x] **2A**: 디자인 시스템, 탭, 엣지, 시세 바, 3패널 레이아웃, AI 웹 검색
- [x] **2B**: 실시간 뉴스 피드, 드래그-투-캔버스, AI 관련성 스코어링
- [x] **2C**: 세계 지도, 7컬럼 피드, 경제 캘린더
- [x] **2D**: SSE 스트리밍, Investigation Mode 업그레이드, 선물 데이터, 김치 프리미엄, 웹뷰 인식
- [~] **2D-1**: Insight Pulse (보류 — 향후 Phase 3 후보)

## 10.5 공유 타입 시스템

모든 컴포넌트와 서비스가 공유하는 타입 정의입니다.

```typescript
// src/renderer/types/index.ts — 주요 타입들

// CanvasItem — 캔버스 위의 모든 항목 (카드 또는 웹뷰)
export type CanvasItem = CardData | WebviewData

// CardData — 정보 카드
export interface CardData {
  id: string           // 고유 ID
  type: 'card'         // 타입 구분자
  title: string        // 제목
  content: string      // 마크다운 내용
  cardType?: string    // 카드 종류 (analysis, data, summary, comparison, news, price)
  symbol?: string      // 코인 심볼 (실시간 가격 연동, 예: 'BTC')
  x: number; y: number // 캔버스 위 좌표
  width: number; height: number  // 크기
  spawnDelay?: number  // 등장 애니메이션 딜레이
}

// EdgeStrength — 연결선 강도 (시각적 스타일 결정)
export type EdgeStrength = 'strong' | 'weak' | 'speculative'
// strong: 실선 2px (확실한 관계)
// weak: 실선 1px (약한 관계)
// speculative: 점선 1px (추정 관계, 웹뷰 자동 연결)

// FeedCategory — 뉴스 카테고리 (7종)
export type FeedCategory = 'macro' | 'crypto' | 'onchain' | 'exchange' | 'social' | 'stocks' | 'world'

// FeedImportance — 뉴스 중요도 (4단계)
export type FeedImportance = 'critical' | 'alert' | 'signal' | 'info'
// critical: 시장을 움직이는 이벤트 (해킹, 규제, Fed 결정)
// alert: 중요하지만 즉각적이지 않은 (고래 이동, 대형 파트너십)
// signal: 주목할 만한 정보 (거래소 상장, 프로토콜 업데이트)
// info: 일상적/저영향 (소규모 업데이트, 의견 기사)
```

---

# 부록: 자주 쓰이는 기술 용어 해설

| 용어 | 설명 |
|------|------|
| **IPC** | Inter-Process Communication — 프로세스 간 통신. Main과 Renderer가 대화하는 방법 |
| **SSE** | Server-Sent Events — 서버가 클라이언트에게 일방적으로 데이터를 보내는 기술 |
| **WebSocket** | 클라이언트-서버 간 양방향 실시간 통신 프로토콜 |
| **Zustand** | React 상태 관리 라이브러리. 독일어로 "상태(State)"라는 뜻 |
| **Tool Use** | AI가 텍스트 응답 대신 함수를 호출하는 기능 |
| **멀티턴** | 한 번의 요청에 AI가 여러 차례 도구를 사용하고 응답하는 것 |
| **참조 카운팅** | 같은 리소스를 여러 곳에서 사용할 때 실제 사용 횟수를 추적하는 기법 |
| **지수적 백오프** | 재시도 간격을 매번 2배씩 늘리는 전략 (서버 과부하 방지) |
| **Promise.allSettled** | 여러 비동기 작업을 동시 실행하되, 개별 성공/실패를 독립 처리 |
| **폴링** | 일정 간격으로 서버에 데이터를 요청하는 방식 (vs WebSocket의 실시간 푸시) |
| **싱글턴** | 앱 전체에서 하나의 인스턴스만 존재하는 객체 패턴 |
| **마크다운** | 간단한 문법으로 서식이 있는 문서를 작성하는 경량 마크업 언어 |
| **컴포넌트** | UI의 독립적인 재사용 가능 조각 (React의 핵심 개념) |
| **props** | 부모 컴포넌트가 자식에게 전달하는 데이터 |
| **useEffect** | React Hook — 컴포넌트가 화면에 나타나거나 데이터가 변경될 때 실행되는 부수 효과 |
| **useCallback** | React Hook — 함수를 메모이제이션(캐싱)하여 불필요한 재생성 방지 |
