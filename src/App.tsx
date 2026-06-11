import { Fragment, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Center,
  Container,
  Divider,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import BarcodeScanner from './BarcodeScanner'

type ContainerRecord = Record<string, unknown>

type StockItemRecord = {
  pk: number
  quantity: number
  serial: string | null
  batch: string | null
  part: number
  part_detail?: {
    name?: string
    full_name?: string
    IPN?: string
    description?: string
  }
}

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error' | 'not_found'

type StockLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function isUrl(value: string) {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

function extractTagId(rawValue: string) {
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

function readInitialTagId() {
  return new URLSearchParams(window.location.search).get('tag')?.trim() ?? ''
}

function getApiBaseUrl() {
  return import.meta.env.VITE_INVENTREE_API_BASE_URL?.trim().replace(/\/$/, '') ?? window.location.origin
}

function getContainerEndpointTemplate() {
  return import.meta.env.VITE_INVENTREE_CONTAINER_ENDPOINT_TEMPLATE?.trim() ?? '/api/containers/{tag}/'
}

function getAuthHeaders(): Record<string, string> {
  const token = import.meta.env.VITE_INVENTREE_API_TOKEN?.trim()
  const authScheme = import.meta.env.VITE_INVENTREE_AUTH_SCHEME?.trim() || 'Token'

  const headers: Record<string, string> = {}

  if (token) {
    headers.Authorization = `${authScheme} ${token}`
  }

  return headers
}

function buildContainerApiUrl(tagId: string) {
  const endpointTemplate = getContainerEndpointTemplate()
  const encodedTag = encodeURIComponent(tagId)
  const resolvedPath = endpointTemplate.replaceAll('{id}', encodedTag)

  if (isUrl(resolvedPath)) {
    return resolvedPath
  }

  const normalizedPath = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`
  return `${getApiBaseUrl()}${normalizedPath}`
}

function buildStockApiUrl(locationPk: number) {
  const query = new URLSearchParams({
    location: String(locationPk),
    part_detail: 'true',
    // Only items directly in this container, not in nested sublocations.
    cascade: 'false',
  })
  return `${getApiBaseUrl()}/api/stock/?${query.toString()}`
}

function buildContainerWebUrl(locationPk: number) {
  return `${getApiBaseUrl()}/web/stock/location/${locationPk}`
}

function deriveContainerPk(record: ContainerRecord | null) {
  if (!record) {
    return null
  }

  const candidate = record.pk ?? record.id
  return typeof candidate === 'number' ? candidate : null
}

function deriveStockItemName(item: StockItemRecord) {
  return (
    item.part_detail?.name?.trim() ||
    item.part_detail?.full_name?.trim() ||
    `Part #${item.part}`
  )
}

function formatQuantity(item: StockItemRecord) {
  if (item.serial) {
    return `№ ${item.serial}`
  }

  return `× ${Number(item.quantity).toLocaleString()}`
}

function deriveContainerName(record: ContainerRecord | null, fallback: string) {
  if (!record) {
    return fallback
  }

  const candidate = record.name ?? record.label ?? record.title ?? record.container_name
  return typeof candidate === 'string' && candidate.trim() ? candidate : fallback
}

function QrIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3z" />
      <path d="M21 14v.01M14 21h.01M18 18h.01M21 21h.01" />
    </svg>
  )
}

export default function App() {
  const [scannerOpened, setScannerOpened] = useState(false)
  const [tagId, setTagId] = useState(readInitialTagId)
  const [manualInput, setManualInput] = useState('')
  const [manualEntryVisible, setManualEntryVisible] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [containerRecord, setContainerRecord] = useState<ContainerRecord | null>(null)
  const [containerName, setContainerName] = useState('')
  const [status, setStatus] = useState<LoadStatus>(tagId ? 'loading' : 'idle')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [stockItems, setStockItems] = useState<StockItemRecord[]>([])
  const [stockStatus, setStockStatus] = useState<StockLoadStatus>('idle')
  const savedResetRef = useRef<number | null>(null)

  const containerPk = deriveContainerPk(containerRecord)

  useEffect(() => {
    const nextQuery = tagId ? `?tag=${encodeURIComponent(tagId)}` : ''
    const nextUrl = `${window.location.pathname}${nextQuery}${window.location.hash}`
    window.history.replaceState({}, '', nextUrl)
  }, [tagId])

  useEffect(() => {
    if (!tagId) {
      return
    }

    const abortController = new AbortController()

    const loadContainer = async () => {
      setStatus('loading')

      try {
        const response = await fetch(buildContainerApiUrl(tagId), {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...getAuthHeaders(),
          },
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(response.status === 404 ? 'not_found' : 'error')
        }

        const data = (await response.json()) as ContainerRecord
        if (abortController.signal.aborted) {
          return
        }

        setContainerRecord(data)
        setContainerName(deriveContainerName(data, tagId))
        setStatus('ready')
      } catch (error) {
        if (abortController.signal.aborted) {
          return
        }

        setContainerRecord(null)
        setContainerName('')
        setStatus(error instanceof Error && error.message === 'not_found' ? 'not_found' : 'error')
      }
    }

    void loadContainer()

    return () => {
      abortController.abort()
    }
  }, [tagId, reloadKey])

  useEffect(() => {
    if (containerPk == null) {
      return
    }

    const abortController = new AbortController()

    const loadStock = async () => {
      setStockStatus('loading')

      try {
        const response = await fetch(buildStockApiUrl(containerPk), {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...getAuthHeaders(),
          },
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error('error')
        }

        const data = (await response.json()) as StockItemRecord[] | { results: StockItemRecord[] }
        if (abortController.signal.aborted) {
          return
        }

        setStockItems(Array.isArray(data) ? data : data.results ?? [])
        setStockStatus('ready')
      } catch {
        if (abortController.signal.aborted) {
          return
        }

        setStockItems([])
        setStockStatus('error')
      }
    }

    void loadStock()

    return () => {
      abortController.abort()
    }
  }, [containerPk, reloadKey])

  useEffect(() => {
    return () => {
      if (savedResetRef.current != null) {
        window.clearTimeout(savedResetRef.current)
      }
    }
  }, [])

  const openContainerForValue = (value: string) => {
    const resolvedTagId = extractTagId(value)
    if (!resolvedTagId) {
      return
    }

    setManualInput('')
    setSaveState('idle')
    setStockItems([])
    setStockStatus('idle')
    setTagId(resolvedTagId)
    setReloadKey((key) => key + 1)
    setScannerOpened(false)
  }

  const goHome = () => {
    setTagId('')
    setManualInput('')
    setManualEntryVisible(false)
    setContainerRecord(null)
    setContainerName('')
    setStatus('idle')
    setSaveState('idle')
    setStockItems([])
    setStockStatus('idle')
  }

  const handleSave = async () => {
    if (!tagId) {
      return
    }

    if (savedResetRef.current != null) {
      window.clearTimeout(savedResetRef.current)
      savedResetRef.current = null
    }

    setSaveState('saving')

    try {
      const response = await fetch(buildContainerApiUrl(tagId), {
        method: (import.meta.env.VITE_INVENTREE_UPDATE_METHOD?.trim() || 'PATCH').toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ name: containerName.trim() }),
      })

      if (!response.ok) {
        throw new Error('error')
      }

      const data = (await response.json().catch(() => null)) as ContainerRecord | null
      if (data) {
        setContainerRecord(data)
        setContainerName(deriveContainerName(data, containerName.trim()))
      }

      setSaveState('saved')
      savedResetRef.current = window.setTimeout(() => {
        setSaveState('idle')
        savedResetRef.current = null
      }, 2500)
    } catch {
      setSaveState('error')
    }
  }

  return (
    <Container size={440} px="md" py="xl">
      {status === 'idle' ? (
        <Stack gap="xl" mt="8vh">
          <Stack gap="sm" align="center" ta="center">
            <ThemeIcon size={72} radius="50%" variant="light">
              <QrIcon />
            </ThemeIcon>
            <Title order={2}>Scan a container tag</Title>
            <Text c="dimmed" size="sm" maw={320}>
              Point your camera at the QR code on a drawer or container to see what's inside and
              rename it.
            </Text>
          </Stack>

          <Button size="lg" radius="md" fullWidth onClick={() => setScannerOpened(true)}>
            Scan QR code
          </Button>

          {manualEntryVisible ? (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                openContainerForValue(manualInput)
              }}
            >
              <Group gap="sm" wrap="nowrap">
                <TextInput
                  flex={1}
                  size="md"
                  radius="md"
                  placeholder="e.g. TAG-001"
                  value={manualInput}
                  onChange={(event) => setManualInput(event.currentTarget.value)}
                  autoFocus
                />
                <Button type="submit" size="md" radius="md" variant="light" disabled={!manualInput.trim()}>
                  Open
                </Button>
              </Group>
            </form>
          ) : (
            <Center>
              <Anchor
                component="button"
                type="button"
                size="xs"
                c="dimmed"
                underline="always"
                onClick={() => setManualEntryVisible(true)}
              >
                Enter a tag id manually
              </Anchor>
            </Center>
          )}
        </Stack>
      ) : null}

      {status === 'loading' ? (
        <Center mih="60vh">
          <Stack align="center" gap="sm">
            <Loader />
            <Text c="dimmed" size="sm">
              Looking up tag…
            </Text>
          </Stack>
        </Center>
      ) : null}

      {status === 'not_found' || status === 'error' ? (
        <Stack gap="lg" mt="8vh">
          <Alert
            color={status === 'not_found' ? 'orange' : 'red'}
            radius="md"
            title={status === 'not_found' ? 'Tag not recognised' : 'Something went wrong'}
          >
            {status === 'not_found'
              ? `No container is linked to the tag “${tagId}”.`
              : 'The container could not be loaded. Check your connection and try again.'}
          </Alert>

          <Stack gap="sm">
            {status === 'error' ? (
              <Button radius="md" onClick={() => setReloadKey((key) => key + 1)}>
                Try again
              </Button>
            ) : (
              <Button radius="md" onClick={() => setScannerOpened(true)}>
                Scan again
              </Button>
            )}
            <Button variant="subtle" radius="md" onClick={goHome}>
              Back to start
            </Button>
          </Stack>
        </Stack>
      ) : null}

      {status === 'ready' ? (
        <Stack gap="md">
          <Group>
            <Button variant="subtle" size="compact-md" px={0} onClick={goHome}>
              ← Back
            </Button>
          </Group>

          <Paper withBorder radius="lg" p="lg">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text size="xs" tt="uppercase" fw={600} c="dimmed" lts={0.6}>
                  Container
                </Text>
                {containerPk != null ? (
                  <Anchor
                    href={buildContainerWebUrl(containerPk)}
                    target="_blank"
                    rel="noreferrer"
                    size="xs"
                    fw={500}
                  >
                    Open in InvenTree ↗
                  </Anchor>
                ) : null}
              </Group>

              <TextInput
                size="md"
                radius="md"
                label="Name"
                placeholder="Container name"
                value={containerName}
                onChange={(event) => setContainerName(event.currentTarget.value)}
              />

              <Group justify="space-between" align="center">
                <Text size="sm" c={saveState === 'error' ? 'red' : 'teal'} fw={500}>
                  {saveState === 'saved' ? 'Saved ✓' : null}
                  {saveState === 'error' ? "Couldn't save. Try again." : null}
                </Text>
                <Button
                  radius="md"
                  onClick={handleSave}
                  loading={saveState === 'saving'}
                  disabled={!containerName.trim()}
                >
                  Save name
                </Button>
              </Group>
            </Stack>
          </Paper>

          <Paper withBorder radius="lg" p="lg">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text size="xs" tt="uppercase" fw={600} c="dimmed" lts={0.6}>
                  Contents
                </Text>
                {stockStatus === 'ready' && stockItems.length > 0 ? (
                  <Badge variant="light" radius="sm">
                    {stockItems.length} {stockItems.length === 1 ? 'item' : 'items'}
                  </Badge>
                ) : null}
              </Group>

              {stockStatus === 'loading' ? (
                <Group gap="sm">
                  <Loader size="xs" />
                  <Text size="sm" c="dimmed">
                    Loading items…
                  </Text>
                </Group>
              ) : null}

              {stockStatus === 'error' ? (
                <Text size="sm" c="red">
                  The items in this container could not be loaded.
                </Text>
              ) : null}

              {stockStatus === 'ready' && stockItems.length === 0 ? (
                <Text size="sm" c="dimmed">
                  This container is empty.
                </Text>
              ) : null}

              {stockStatus === 'ready' && stockItems.length > 0 ? (
                <Stack gap={0}>
                  {stockItems.map((item, index) => (
                    <Fragment key={item.pk}>
                      {index > 0 ? <Divider /> : null}
                      <Group justify="space-between" align="center" wrap="nowrap" py="sm">
                        <Box miw={0}>
                          <Text size="sm" fw={500} truncate>
                            {deriveStockItemName(item)}
                          </Text>
                          {item.part_detail?.description ? (
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              {item.part_detail.description}
                            </Text>
                          ) : null}
                        </Box>
                        <Badge size="lg" variant="light" radius="sm" style={{ flexShrink: 0 }}>
                          {formatQuantity(item)}
                        </Badge>
                      </Group>
                    </Fragment>
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </Paper>
        </Stack>
      ) : null}

      <BarcodeScanner
        opened={scannerOpened}
        onClose={() => setScannerOpened(false)}
        onDetected={openContainerForValue}
      />
    </Container>
  )
}
