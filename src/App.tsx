import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import BarcodeScanner from './BarcodeScanner'

type ContainerRecord = Record<string, unknown>

type LoadStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error'

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
  const resolvedPath = endpointTemplate.replaceAll('{tag}', encodedTag)

  if (isUrl(resolvedPath)) {
    return resolvedPath
  }

  const normalizedPath = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`
  return `${getApiBaseUrl()}${normalizedPath}`
}

function deriveContainerName(record: ContainerRecord | null, fallback: string) {
  if (!record) {
    return fallback
  }

  const candidate = record.name ?? record.label ?? record.title ?? record.container_name
  return typeof candidate === 'string' && candidate.trim() ? candidate : fallback
}

export default function App() {
  const [scannerOpened, setScannerOpened] = useState(false)
  const [scannedCode, setScannedCode] = useState('')
  const [tagId, setTagId] = useState(readInitialTagId)
  const [manualInput, setManualInput] = useState(readInitialTagId)
  const [containerRecord, setContainerRecord] = useState<ContainerRecord | null>(null)
  const [containerName, setContainerName] = useState('')
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [message, setMessage] = useState('')

  const apiUrl = useMemo(() => (tagId ? buildContainerApiUrl(tagId) : ''), [tagId])

  useEffect(() => {
    const nextQuery = tagId ? `?tag=${encodeURIComponent(tagId)}` : ''
    const nextUrl = `${window.location.pathname}${nextQuery}${window.location.hash}`
    window.history.replaceState({}, '', nextUrl)
  }, [tagId])

  useEffect(() => {
    if (!tagId) {
      setContainerRecord(null)
      setContainerName('')
      setStatus('idle')
      setMessage('')
      return
    }

    const abortController = new AbortController()

    const loadContainer = async () => {
      setStatus('loading')
      setMessage('')

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
          throw new Error(`Failed to load container (${response.status} ${response.statusText})`)
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
        setContainerName(tagId)
        setStatus('error')
        setMessage(
          error instanceof Error
            ? error.message
            : 'Failed to load container data from the InvenTree API.'
        )
      }
    }

    void loadContainer()

    return () => {
      abortController.abort()
    }
  }, [tagId])

  const openContainerForValue = (value: string) => {
    const resolvedTagId = extractTagId(value)
    if (!resolvedTagId) {
      return
    }

    setScannedCode(value)
    setManualInput(value)
    setTagId(resolvedTagId)
    setScannerOpened(false)
  }

  const handleSave = async () => {
    if (!tagId || !apiUrl) {
      return
    }

    setStatus('saving')
    setMessage('')

    try {
      const response = await fetch(apiUrl, {
        method: (import.meta.env.VITE_INVENTREE_UPDATE_METHOD?.trim() || 'PATCH').toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ name: containerName.trim() }),
      })

      if (!response.ok) {
        throw new Error(`Failed to save container (${response.status} ${response.statusText})`)
      }

      const data = (await response.json().catch(() => null)) as ContainerRecord | null
      if (data) {
        setContainerRecord(data)
        setContainerName(deriveContainerName(data, containerName.trim()))
      }

      setStatus('ready')
      setMessage('Container updated successfully.')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Failed to save container changes.')
    }
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Paper p="xl" radius="lg" shadow="sm">
          <Stack gap="md">
            <div>
              <Title order={1}>InvenTree container editor</Title>
              <Text c="dimmed" mt="xs">
                Scan a tag QR code or paste a tag id to load the matching container and update it through the API.
              </Text>
            </div>

            <Alert color="blue" title="QR input">
              The QR can contain a raw tag id or a URL with <Text span fw={600}>tag</Text>, <Text span fw={600}>id</Text>,
              or <Text span fw={600}>code</Text> in the query string.
            </Alert>

            <Group align="end" grow>
              <TextInput
                label="Tag id or QR payload"
                placeholder="TAG-001 or https://..."
                value={manualInput}
                onChange={(event) => setManualInput(event.currentTarget.value)}
              />
              <Button
                onClick={() => {
                  openContainerForValue(manualInput)
                }}
              >
                Load container
              </Button>
            </Group>

            <Button variant="light" onClick={() => setScannerOpened(true)}>
              Scan QR code
            </Button>

            {scannedCode ? (
              <Alert color="green" title="Last scanned QR payload">
                <Stack gap={4}>
                  <Text size="sm">{scannedCode}</Text>
                  <Text size="sm" c="dimmed">
                    Resolved tag id: {tagId}
                  </Text>
                </Stack>
              </Alert>
            ) : (
              <Alert color="gray" title="Ready">
                Load a tag to see the current container record.
              </Alert>
            )}

            {tagId ? (
              <Alert color="teal" title="API endpoint">
                <Stack gap={6}>
                  <Text size="sm">{apiUrl}</Text>
                  <Text size="sm" c="dimmed">
                    This is the endpoint used to fetch and save the container record for the selected tag.
                  </Text>
                </Stack>
              </Alert>
            ) : null}

            {status === 'loading' ? (
              <Alert color="yellow" title="Loading container">
                Fetching container data from InvenTree.
              </Alert>
            ) : null}

            {message ? (
              <Alert color={status === 'error' ? 'red' : 'green'} title={status === 'error' ? 'Error' : 'Status'}>
                {message}
              </Alert>
            ) : null}

            {tagId ? (
              <Paper withBorder p="md" radius="md">
                <Stack gap="md">
                  <Group justify="space-between" align="center">
                    <div>
                      <Text fw={600}>Container name</Text>
                      <Text size="sm" c="dimmed">
                        Edit the value that will be sent back to the API.
                      </Text>
                    </div>
                    <Badge variant="light">{status}</Badge>
                  </Group>

                  <TextInput
                    label="Name"
                    value={containerName}
                    onChange={(event) => setContainerName(event.currentTarget.value)}
                    placeholder="Container name"
                  />

                  <Text size="sm" c="dimmed">
                    Raw API response
                  </Text>
                  <Paper withBorder p="sm" radius="sm">
                    <Text component="pre" size="xs" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(containerRecord, null, 2)}
                    </Text>
                  </Paper>

                  <Group justify="flex-end">
                    <Button
                      variant="default"
                      onClick={() => {
                        if (tagId) {
                          openContainerForValue(tagId)
                        }
                      }}
                    >
                      Reload
                    </Button>
                    <Button onClick={handleSave} disabled={!containerName.trim() || status === 'loading'}>
                      Save changes
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            ) : null}
          </Stack>
        </Paper>

        <BarcodeScanner
          opened={scannerOpened}
          onClose={() => setScannerOpened(false)}
          onDetected={openContainerForValue}
        />
      </Stack>
    </Container>
  )
}