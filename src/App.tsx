import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
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

function resolveTargetUrl(rawValue: string) {
  const value = rawValue.trim()
  if (!value) {
    return ''
  }

  if (isUrl(value)) {
    return value
  }

  const baseUrl = import.meta.env.VITE_INVENTREE_PAGE_BASE_URL?.trim().replace(/\/$/, '') ?? ''
  const pagePath = import.meta.env.VITE_INVENTREE_PAGE_PATH?.trim() ?? '/inventory/update'
  const normalizedPath = pagePath.startsWith('/') ? pagePath : `/${pagePath}`

  if (!baseUrl) {
    return `${normalizedPath}?tag=${encodeURIComponent(value)}`
  }

  return `${baseUrl}${normalizedPath}?tag=${encodeURIComponent(value)}`
}

function readInitialTagId() {
  return new URLSearchParams(window.location.search).get('tag')?.trim() ?? ''
}

function App() {
  const [scannerOpened, setScannerOpened] = useState(false)
  const [scannedCode, setScannedCode] = useState('')
  const [tagId, setTagId] = useState(readInitialTagId)
  const [manualInput, setManualInput] = useState(readInitialTagId)

  const targetUrl = useMemo(() => {
    if (!tagId) {
      return ''
    }

    return resolveTargetUrl(tagId)
  }, [tagId])

  useEffect(() => {
    const nextQuery = tagId ? `?tag=${encodeURIComponent(tagId)}` : ''
    const nextUrl = `${window.location.pathname}${nextQuery}${window.location.hash}`
    window.history.replaceState({}, '', nextUrl)
  }, [tagId])

  const openTargetForValue = (value: string) => {
    const resolvedTagId = extractTagId(value)
    if (!resolvedTagId) {
      return
    }

    setTagId(resolvedTagId)
    setManualInput(value)
    setScannedCode(value)
    setScannerOpened(false)

    const resolvedTargetUrl = resolveTargetUrl(resolvedTagId)
    const currentUrl = `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`

    if (resolvedTargetUrl !== currentUrl) {
      window.location.assign(resolvedTargetUrl)
    }
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Paper p="xl" radius="lg" shadow="sm">
          <Stack gap="md">
            <div>
              <Title order={1}>Inventory QR gateway</Title>
              <Text c="dimmed" mt="xs">
                Scan a tag QR code and this app resolves the tag id into the corresponding inventory update page.
              </Text>
            </div>

            <Alert color="blue" title="Expected QR format">
              The QR code can contain either a raw tag id like <Text span fw={600}>TAG-001</Text> or a full URL that
              already points to your InvenTree page.
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
                  openTargetForValue(manualInput)
                }}
              >
                Open page
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
                Open the scanner or paste a tag id to navigate to the inventory update page.
              </Alert>
            )}

            {tagId ? (
              <Alert color="teal" title="Resolved target">
                <Stack gap={6}>
                  <Text size="sm">{targetUrl}</Text>
                  <Text size="sm" c="dimmed">
                    This value can be sent to your InvenTree update page as the tag-specific identifier.
                  </Text>
                </Stack>
              </Alert>
            ) : null}
          </Stack>
        </Paper>

        <BarcodeScanner
          opened={scannerOpened}
          onClose={() => setScannerOpened(false)}
          onDetected={openTargetForValue}
        />
      </Stack>
    </Container>
  )
}

export default App
