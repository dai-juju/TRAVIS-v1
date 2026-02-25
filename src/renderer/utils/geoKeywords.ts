export interface GeoLocation {
  name: string
  coordinates: [number, number] // [lng, lat]
}

const KEYWORD_MAP: Array<{ keywords: string[]; location: GeoLocation }> = [
  {
    keywords: ['US', 'SEC', 'Fed', 'Federal Reserve', 'Senate', 'Congress', 'CFTC', 'Treasury'],
    location: { name: 'Washington DC', coordinates: [-77.0, 38.9] },
  },
  {
    keywords: ['China', 'Hong Kong', 'HKMA'],
    location: { name: 'Hong Kong', coordinates: [114.2, 22.3] },
  },
  {
    keywords: ['EU', 'ECB', 'MiCA', 'European'],
    location: { name: 'Frankfurt', coordinates: [8.7, 50.1] },
  },
  {
    keywords: ['Japan', 'BOJ'],
    location: { name: 'Tokyo', coordinates: [139.7, 35.7] },
  },
  {
    keywords: ['Korea', 'Upbit'],
    location: { name: 'Seoul', coordinates: [127.0, 37.6] },
  },
  {
    keywords: ['Binance'],
    location: { name: 'Dubai', coordinates: [55.3, 25.2] },
  },
  {
    keywords: ['UK', 'BOE', 'FCA', 'London'],
    location: { name: 'London', coordinates: [-0.1, 51.5] },
  },
  {
    keywords: ['Singapore', 'MAS'],
    location: { name: 'Singapore', coordinates: [103.8, 1.35] },
  },
  {
    keywords: ['Australia', 'RBA'],
    location: { name: 'Sydney', coordinates: [151.2, -33.9] },
  },
  {
    keywords: ['Brazil'],
    location: { name: 'Brasilia', coordinates: [-47.9, -15.8] },
  },
  {
    keywords: ['India', 'RBI'],
    location: { name: 'Mumbai', coordinates: [72.9, 19.1] },
  },
  {
    keywords: ['Russia'],
    location: { name: 'Moscow', coordinates: [37.6, 55.8] },
  },
  {
    keywords: ['Switzerland', 'SNB'],
    location: { name: 'Zurich', coordinates: [8.5, 47.4] },
  },
  {
    keywords: ['Coinbase'],
    location: { name: 'San Francisco', coordinates: [-122.4, 37.8] },
  },
  {
    keywords: ['OKX'],
    location: { name: 'Seychelles', coordinates: [55.5, -4.7] },
  },
]

/**
 * Extract a geo location from a news title + source by keyword matching.
 * Uses word boundary regex to avoid false positives (e.g. "SEC" in "insecure").
 * Short uppercase keywords like "US" require exact case + word boundary.
 */
export function extractLocation(title: string, source: string): GeoLocation | null {
  const text = `${title} ${source}`

  for (const entry of KEYWORD_MAP) {
    for (const keyword of entry.keywords) {
      // Short all-uppercase keywords: case-sensitive word boundary match
      const isShortUpper = keyword.length <= 3 && keyword === keyword.toUpperCase()
      const flags = isShortUpper ? '' : 'i'
      const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, flags)
      if (regex.test(text)) {
        return entry.location
      }
    }
  }

  return null
}

/**
 * Get coordinates for a location name.
 */
export function getCoordinates(locationName: string): [number, number] | null {
  for (const entry of KEYWORD_MAP) {
    if (entry.location.name === locationName) {
      return entry.location.coordinates
    }
  }
  return null
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
