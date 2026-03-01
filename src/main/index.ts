// ============================================================
// TRAVIS 앱의 시작점 (Entry Point)
// Electron 앱이 처음 실행될 때 이 파일이 가장 먼저 동작합니다.
// 역할: 앱 창(윈도우)을 만들고, 화면에 보여주는 일을 합니다.
// ============================================================

// Electron 프레임워크에서 앱 관리(app)와 창 관리(BrowserWindow) 기능을 가져옴
import { app, BrowserWindow } from 'electron'
// 파일 경로를 안전하게 조합하기 위한 Node.js 기본 도구
import path from 'path'
// 프론트엔드(화면)와 백엔드(엔진) 사이의 통신 핸들러를 등록하는 함수
import { registerIpcHandlers } from './ipc'
// CCXT Pro WebSocket 서비스 (6거래소 실시간 시세/체결)
import { exchangeWsService } from './services/exchangeWsService'

// 앱 창(윈도우)을 생성하는 함수
function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,           // 기본 창 너비 (픽셀)
    height: 800,           // 기본 창 높이 (픽셀)
    backgroundColor: '#0a0a0f',  // 창 배경색 (TRAVIS 테마의 어두운 색상)
    webPreferences: {
      // preload 스크립트: 화면(렌더러)이 로드되기 전에 실행되는 보안 브릿지
      preload: path.join(__dirname, 'preload.js'),
      // 보안 설정: 렌더러에서 Node.js 직접 접근 차단
      nodeIntegration: false,
      // 보안 설정: 메인 프로세스와 렌더러 프로세스를 격리
      contextIsolation: true,
      // 웹뷰 태그 허용 (외부 웹사이트를 캔버스에 임베드하기 위해 필요)
      webviewTag: true,
    },
  })

  // 창을 전체 화면(최대화)으로 시작
  win.maximize()

  // 개발 모드 vs 배포 모드에 따라 다른 화면을 로드
  if (!app.isPackaged) {
    // 개발 모드: Vite 개발 서버에서 화면을 불러옴 (핫 리로드 지원)
    win.loadURL('http://localhost:5173')
  } else {
    // 배포(프로덕션) 모드: 빌드된 파일에서 화면을 불러옴
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  return win
}

// 앱이 준비되면 실행: IPC 핸들러 등록 → 창 생성
app.whenReady().then(() => {
  registerIpcHandlers()  // 화면↔엔진 통신 채널 등록
  const win = createWindow()         // 메인 창 생성
  exchangeWsService.setMainWindow(win) // WS 서비스에 메인 윈도우 참조 전달
})

// 앱 종료 전 정리: WebSocket 연결 해제
app.on('before-quit', () => {
  exchangeWsService.unwatchAll()
})

// 모든 창이 닫히면 앱 종료 (macOS 제외 — macOS는 창을 닫아도 앱이 살아있는 게 관례)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// macOS에서 독(Dock) 아이콘 클릭 시 창이 없으면 새로 생성
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
