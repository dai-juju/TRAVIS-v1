// ============================================================
// Tavily 웹 검색 API 모듈
// 역할: AI가 "최신 비트코인 뉴스 검색해줘" 같은 요청을 받았을 때,
//       실시간으로 인터넷을 검색해서 결과를 가져오는 기능
// Tavily = AI 특화 웹 검색 서비스 (구글 검색의 API 버전이라고 생각하면 됨)
// ============================================================

// Tavily API로 웹 검색을 수행하고 결과를 텍스트로 반환하는 함수
// query: 검색어 (예: "BTC ETF approval news")
// apiKey: Tavily 서비스 인증 키 (Settings에서 설정)
export async function searchTavily(
  query: string,
  apiKey: string
): Promise<string> {
  // API 키가 없으면 에러 메시지 반환 (검색 불가)
  if (!apiKey) {
    return '[Error] Tavily API key not configured. Please add it in Settings.'
  }

  try {
    // Tavily API에 검색 요청 전송
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,                  // 검색어
        api_key: apiKey,        // 인증 키
        search_depth: 'basic',  // 검색 깊이: basic(빠름) / advanced(정밀)
        max_results: 5,         // 최대 검색 결과 수
      }),
    })

    // API 호출 실패 시 에러 메시지 반환
    if (!res.ok) {
      const text = await res.text()
      return `[Error] Tavily API ${res.status}: ${text}`
    }

    // 검색 결과 파싱 (제목, URL, 내용 추출)
    const data = await res.json()
    const results = data.results as Array<{
      title: string
      url: string
      content: string
    }>

    // 결과가 없으면 안내 메시지 반환
    if (!results || results.length === 0) {
      return 'No search results found.'
    }

    // 검색 결과를 보기 좋은 텍스트 형식으로 변환
    // 예: [1] 비트코인 ETF 승인 소식\nhttps://...\n내용 요약...
    return results
      .map(
        (r, i) =>
          `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`
      )
      .join('\n\n')
  } catch (err) {
    // 네트워크 오류 등 예상치 못한 에러 처리
    return `[Error] Tavily search failed: ${err instanceof Error ? err.message : String(err)}`
  }
}
