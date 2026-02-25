// Tavily Web Search API 호출

export async function searchTavily(
  query: string,
  apiKey: string
): Promise<string> {
  if (!apiKey) {
    return '[Error] Tavily API key not configured. Please add it in Settings.'
  }

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        api_key: apiKey,
        search_depth: 'basic',
        max_results: 5,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return `[Error] Tavily API ${res.status}: ${text}`
    }

    const data = await res.json()
    const results = data.results as Array<{
      title: string
      url: string
      content: string
    }>

    if (!results || results.length === 0) {
      return 'No search results found.'
    }

    return results
      .map(
        (r, i) =>
          `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`
      )
      .join('\n\n')
  } catch (err) {
    return `[Error] Tavily search failed: ${err instanceof Error ? err.message : String(err)}`
  }
}
