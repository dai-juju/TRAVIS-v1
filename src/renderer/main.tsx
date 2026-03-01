import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// 앱의 진입점 — HTML의 #root 요소에 React 앱을 렌더링
// StrictMode는 개발 중 잠재적 문제를 감지해주는 React 안전 모드
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
