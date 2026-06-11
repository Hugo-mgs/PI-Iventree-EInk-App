import { useEffect, useState } from 'react'
import { apiGet, normalizeList } from './api'

type LiveSearchResult<T> = {
  results: T[] | null
  loading: boolean
  failed: boolean
  /** True when the list shown is the default suggestions (empty query). */
  isDefault: boolean
}

/**
 * Debounced, live search against the InvenTree API.
 *
 * - With an empty query it loads a default suggestion list (`buildDefaultUrl`).
 * - As the query changes it re-fetches `buildSearchUrl(term)` after a short debounce.
 * - In-flight requests are aborted when the query changes or the component unmounts.
 *
 * `buildDefaultUrl` and `buildSearchUrl` are expected to be stable references
 * (e.g. the module-level builders in `api.ts`), so they can live in the effect deps.
 */
export function useLiveSearch<T>(
  query: string,
  buildDefaultUrl: () => string,
  buildSearchUrl: (term: string) => string,
  debounceMs = 250
): LiveSearchResult<T> {
  const [results, setResults] = useState<T[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [isDefault, setIsDefault] = useState(true)

  useEffect(() => {
    const term = query.trim()
    const abortController = new AbortController()
    let active = true

    const run = async () => {
      setLoading(true)
      setFailed(false)

      try {
        const url = term ? buildSearchUrl(term) : buildDefaultUrl()
        const data = await apiGet<T[] | { results: T[] }>(url, abortController.signal)
        if (!active) {
          return
        }
        setResults(normalizeList<T>(data))
        setIsDefault(term === '')
      } catch {
        if (!active || abortController.signal.aborted) {
          return
        }
        setResults(null)
        setFailed(true)
      } finally {
        if (active && !abortController.signal.aborted) {
          setLoading(false)
        }
      }
    }

    // No debounce for the initial default load; debounce while typing.
    const timer = window.setTimeout(() => void run(), term ? debounceMs : 0)

    return () => {
      active = false
      abortController.abort()
      window.clearTimeout(timer)
    }
  }, [query, buildDefaultUrl, buildSearchUrl, debounceMs])

  return { results, loading, failed, isDefault }
}
