export type ContainerRecord = Record<string, unknown>

export type StockItemRecord = {
  pk: number
  quantity: number
  serial: string | null
  batch: string | null
  part: number
  location?: number | null
  status_text?: string | null
  packaging?: string | null
  notes?: string | null
  link?: string | null
  updated?: string | null
  part_detail?: {
    name?: string
    full_name?: string
    IPN?: string
    revision?: string
    description?: string
    units?: string
    thumbnail?: string
  }
  location_detail?: {
    pk: number
    name: string
    pathstring?: string
  }
}

export type PartRecord = {
  pk: number
  name: string
  description?: string | null
  IPN?: string | null
  units?: string | null
  thumbnail?: string | null
}

export type LocationRecord = {
  pk: number
  name: string
  pathstring?: string
  structural?: boolean
}

export function isUrl(value: string) {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

export function extractTagId(rawValue: string) {
  const value = rawValue.trim()
  if (!value) {
    return ''
  }

  if (!isUrl(value)) {
    return value
  }

  const url = new URL(value)
  return (
    url.searchParams.get('tag') ??
    url.searchParams.get('code') ??
    url.searchParams.get('id') ??
    url.pathname.split('/').filter(Boolean).at(-1) ??
    value
  )
}

const API_BASE_OVERRIDE_KEY = 'inkstock.apiBaseUrl'

// The address baked into the build at compile time (from .env). Empty in dev so
// requests go same-origin through the Vite proxy.
export function getDefaultApiBaseUrl() {
  return import.meta.env.VITE_INVENTREE_API_BASE_URL?.trim().replace(/\/$/, '') ?? window.location.origin
}

// A server address the user saved on the device, overriding the baked-in
// default. Lets the app switch between e.g. home Wi-Fi and a phone-hotspot
// address without rebuilding the APK.
export function getApiBaseOverride() {
  try {
    return localStorage.getItem(API_BASE_OVERRIDE_KEY)?.trim().replace(/\/$/, '') ?? ''
  } catch {
    return ''
  }
}

export function setApiBaseOverride(value: string) {
  const cleaned = value.trim().replace(/\/$/, '')
  try {
    if (cleaned) {
      localStorage.setItem(API_BASE_OVERRIDE_KEY, cleaned)
    } else {
      localStorage.removeItem(API_BASE_OVERRIDE_KEY)
    }
  } catch {
    // Storage unavailable (e.g. private mode) — silently fall back to the default.
  }
}

export function getApiBaseUrl() {
  return getApiBaseOverride() || getDefaultApiBaseUrl()
}

// Quick reachability check for the settings screen: does the given address
// answer the InvenTree API root with our token accepted?
export async function testApiBaseUrl(baseUrl: string, signal?: AbortSignal): Promise<boolean> {
  const trimmed = baseUrl.trim().replace(/\/$/, '')
  const target = `${trimmed}/api/`
  const response = await fetch(target, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    signal,
  })
  return response.ok
}

export function getContainerEndpointTemplate() {
  return import.meta.env.VITE_INVENTREE_CONTAINER_ENDPOINT_TEMPLATE?.trim() ?? '/api/containers/{tag}/'
}

export function getAuthHeaders(): Record<string, string> {
  const token = import.meta.env.VITE_INVENTREE_API_TOKEN?.trim()
  const authScheme = import.meta.env.VITE_INVENTREE_AUTH_SCHEME?.trim() || 'Token'

  const headers: Record<string, string> = {}

  if (token) {
    headers.Authorization = `${authScheme} ${token}`
  }

  return headers
}

export function buildContainerApiUrl(tagId: string) {
  const endpointTemplate = getContainerEndpointTemplate()
  const encodedTag = encodeURIComponent(tagId)
  const resolvedPath = endpointTemplate.replaceAll('{id}', encodedTag)

  if (isUrl(resolvedPath)) {
    return resolvedPath
  }

  const normalizedPath = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`
  return `${getApiBaseUrl()}${normalizedPath}`
}

export function buildStockApiUrl(locationPk: number) {
  const query = new URLSearchParams({
    location: String(locationPk),
    part_detail: 'true',
    // Only items directly in this container, not in nested sublocations.
    cascade: 'false',
  })
  return `${getApiBaseUrl()}/api/stock/?${query.toString()}`
}

export function buildStockSearchUrl(searchTerm: string) {
  const query = new URLSearchParams({
    search: searchTerm,
    part_detail: 'true',
    location_detail: 'true',
    in_stock: 'true',
    limit: '25',
  })
  return `${getApiBaseUrl()}/api/stock/?${query.toString()}`
}

export function buildStockListUrl() {
  const query = new URLSearchParams({
    part_detail: 'true',
    location_detail: 'true',
    in_stock: 'true',
    // Most recently changed stock first.
    ordering: '-updated',
    limit: '25',
  })
  return `${getApiBaseUrl()}/api/stock/?${query.toString()}`
}

export function buildPartSearchUrl(searchTerm: string) {
  const query = new URLSearchParams({
    search: searchTerm,
    active: 'true',
    limit: '25',
  })
  return `${getApiBaseUrl()}/api/part/?${query.toString()}`
}

export function buildPartListUrl() {
  const query = new URLSearchParams({
    active: 'true',
    // Newest parts first, so the list shows recently added items before searching.
    ordering: '-pk',
    limit: '25',
  })
  return `${getApiBaseUrl()}/api/part/?${query.toString()}`
}

export function buildLocationSearchUrl(searchTerm: string) {
  const query = new URLSearchParams({
    search: searchTerm,
    limit: '25',
  })
  return `${getApiBaseUrl()}/api/stock/location/?${query.toString()}`
}

export function buildLocationListUrl() {
  const query = new URLSearchParams({
    ordering: 'name',
    limit: '25',
  })
  return `${getApiBaseUrl()}/api/stock/location/?${query.toString()}`
}

export function buildContainerWebUrl(locationPk: number) {
  return `${getApiBaseUrl()}/web/stock/location/${locationPk}`
}

export function buildPartWebUrl(partPk: number) {
  return `${getApiBaseUrl()}/web/part/${partPk}`
}

export function normalizeList<T>(data: T[] | { results?: T[] } | null | undefined): T[] {
  if (Array.isArray(data)) {
    return data
  }
  if (data && Array.isArray(data.results)) {
    return data.results
  }
  return []
}

export async function apiGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(String(response.status))
  }

  return (await response.json()) as T
}

export async function apiSend<T>(url: string, method: string, body: unknown): Promise<T | null> {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(String(response.status))
  }

  return (await response.json().catch(() => null)) as T | null
}

export function deriveContainerPk(record: ContainerRecord | null) {
  if (!record) {
    return null
  }

  const candidate = record.pk ?? record.id
  return typeof candidate === 'number' ? candidate : null
}

export function deriveContainerName(record: ContainerRecord | null, fallback: string) {
  if (!record) {
    return fallback
  }

  const candidate = record.name ?? record.label ?? record.title ?? record.container_name
  return typeof candidate === 'string' && candidate.trim() ? candidate : fallback
}

export function deriveContainerPath(record: ContainerRecord | null) {
  if (!record) {
    return null
  }

  const candidate = record.pathstring
  return typeof candidate === 'string' && candidate.trim() ? candidate : null
}

export function deriveStockItemName(item: StockItemRecord) {
  return (
    item.part_detail?.name?.trim() ||
    item.part_detail?.full_name?.trim() ||
    `Part #${item.part}`
  )
}
