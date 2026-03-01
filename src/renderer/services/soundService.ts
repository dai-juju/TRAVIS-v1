// 사운드 피드백 서비스 — Web Audio API로 코드 기반 효과음 생성
// 외부 음원 파일 없이 오실레이터(Oscillator)로 직접 사운드를 합성
// 볼륨은 0.08~0.15 — 은은하게 들리는 수준

import { useSettingsStore } from '../stores/useSettingsStore'

class SoundService {
  private audioContext: AudioContext | null = null

  // 지연 초기화 — AudioContext는 유저 인터랙션 후 생성해야 브라우저 정책을 충족
  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }
    return this.audioContext
  }

  // 설정에서 사운드 활성화 여부 확인
  private isEnabled(): boolean {
    return useSettingsStore.getState().enableSound
  }

  // 부팅 사운드 — 앱 시작 시 (JARVIS 느낌의 상승 톤)
  playBoot() {
    if (!this.isEnabled()) return
    const ctx = this.getContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    // 상승 톤: 200Hz → 600Hz, 0.4초
    osc.type = 'sine'
    osc.frequency.setValueAtTime(200, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.4)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  }

  // 카드 스폰 사운드 — 카드 생성 시 (짧은 팝)
  playCardSpawn() {
    if (!this.isEnabled()) return
    const ctx = this.getContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    // 짧은 팝: 800Hz → 1200Hz, 0.08초
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.1)
  }

  // AI 응답 시작 사운드 — AI가 답변 시작할 때 (부드러운 톤)
  playAIResponse() {
    if (!this.isEnabled()) return
    const ctx = this.getContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    // 부드러운 톤: 440Hz, 0.15초
    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, ctx.currentTime)
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
  }

  // 알림 사운드 — 중요 뉴스, 급변 알림 (높은 톤 2회)
  playAlert() {
    if (!this.isEnabled()) return
    const ctx = this.getContext()

    // 첫 번째 톤
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(1000, ctx.currentTime)
    gain1.gain.setValueAtTime(0.12, ctx.currentTime)
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
    osc1.start(ctx.currentTime)
    osc1.stop(ctx.currentTime + 0.1)

    // 두 번째 톤 (0.15초 후)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1200, ctx.currentTime + 0.15)
    gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25)
    osc2.start(ctx.currentTime + 0.15)
    osc2.stop(ctx.currentTime + 0.25)
  }
}

export const soundService = new SoundService()
