import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Center,
  Container,
  Divider,
  Drawer,
  Group,
  Image,
  Loader,
  NumberInput,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core'
import BarcodeScanner from './BarcodeScanner'
import AddItemDrawer from './AddItemDrawer'
import MoveItemDrawer from './MoveItemDrawer'
import SearchDrawer from './SearchDrawer'
import {
  apiGet,
  apiSend,
  buildContainerApiUrl,
  buildContainerWebUrl,
  buildPartWebUrl,
  buildStockApiUrl,
  deriveContainerName,
  deriveContainerPath,
  deriveContainerPk,
  deriveStockItemName,
  extractTagId,
  getApiBaseUrl,
  normalizeList,
  type ContainerRecord,
  type StockItemRecord,
} from './api'
import { pushHistory, readHistory, type HistoryEntry } from './history'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error' | 'not_found'

type StockLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function readInitialTagId() {
  return new URLSearchParams(window.location.search).get('tag')?.trim() ?? ''
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === '') {
    return null
  }

  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
      <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Text size="sm" fw={500} ta="right" style={{ wordBreak: 'break-word' }}>
        {value}
      </Text>
    </Group>
  )
}

function InkstockMark({ size = 72 }: { size?: number }) {
  // Ink drop sliced into stacked inventory layers. Tile + bars use the theme
  // primary colour so they follow whatever Mantine primaryColor is set to.
  const brand = 'var(--mantine-primary-color-filled)'
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" role="img" aria-label="Inkstock">
      <rect x="0" y="0" width="80" height="80" rx="20" fill={brand} />
      <path d="M40 12 C57 31.6 57 52 40 68 C23 52 23 31.6 40 12 Z" fill="#ffffff" />
      <rect x="33" y="36" width="14" height="4" rx="2" fill={brand} />
      <rect x="31" y="44" width="18" height="4" rx="2" fill={brand} />
      <rect x="33" y="52" width="14" height="4" rx="2" fill={brand} />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

export default function App() {
  const [scannerOpened, setScannerOpened] = useState(false)
  const [searchOpened, setSearchOpened] = useState(false)
  const [addItemOpened, setAddItemOpened] = useState(false)
  const [moveItem, setMoveItem] = useState<StockItemRecord | null>(null)
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
  const [editedQuantities, setEditedQuantities] = useState<Record<number, number | ''>>({})
  const [quantitySavingPk, setQuantitySavingPk] = useState<number | null>(null)
  const [quantityErrorPk, setQuantityErrorPk] = useState<number | null>(null)
  const [quantitySavedPk, setQuantitySavedPk] = useState<number | null>(null)
  const [detailItem, setDetailItem] = useState<StockItemRecord | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>(readHistory)
  const [flash, setFlash] = useState('')
  const [deletingPk, setDeletingPk] = useState<number | null>(null)
  const [deleteErrorPk, setDeleteErrorPk] = useState<number | null>(null)
  const [confirmDeletePk, setConfirmDeletePk] = useState<number | null>(null)
  const savedResetRef = useRef<number | null>(null)
  const quantitySavedResetRef = useRef<number | null>(null)
  const flashResetRef = useRef<number | null>(null)

  const containerPk = deriveContainerPk(containerRecord)
  const containerPath = deriveContainerPath(containerRecord)

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
        const data = await apiGet<ContainerRecord>(buildContainerApiUrl(tagId), abortController.signal)
        if (abortController.signal.aborted) {
          return
        }

        const name = deriveContainerName(data, tagId)
        setContainerRecord(data)
        setContainerName(name)
        setStatus('ready')
        setHistory(pushHistory(tagId, name))
      } catch (error) {
        if (abortController.signal.aborted) {
          return
        }

        setContainerRecord(null)
        setContainerName('')
        setStatus(error instanceof Error && error.message === '404' ? 'not_found' : 'error')
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
        const data = await apiGet<StockItemRecord[] | { results: StockItemRecord[] }>(
          buildStockApiUrl(containerPk),
          abortController.signal
        )
        if (abortController.signal.aborted) {
          return
        }

        setStockItems(normalizeList(data))
        setEditedQuantities({})
        setQuantityErrorPk(null)
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
      if (quantitySavedResetRef.current != null) {
        window.clearTimeout(quantitySavedResetRef.current)
      }
      if (flashResetRef.current != null) {
        window.clearTimeout(flashResetRef.current)
      }
    }
  }, [])

  const showFlash = (message: string) => {
    if (flashResetRef.current != null) {
      window.clearTimeout(flashResetRef.current)
    }
    setFlash(message)
    flashResetRef.current = window.setTimeout(() => {
      setFlash('')
      flashResetRef.current = null
    }, 3500)
  }

  const openContainerForTag = (value: string) => {
    const resolvedTagId = extractTagId(value)
    if (!resolvedTagId) {
      return
    }

    setManualInput('')
    setSaveState('idle')
    setStockItems([])
    setStockStatus('idle')
    setEditedQuantities({})
    setQuantityErrorPk(null)
    setQuantitySavedPk(null)
    setConfirmDeletePk(null)
    setDeleteErrorPk(null)
    setDetailItem(null)
    setMoveItem(null)
    setAddItemOpened(false)
    setSearchOpened(false)
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
    setEditedQuantities({})
    setQuantityErrorPk(null)
    setQuantitySavedPk(null)
    setConfirmDeletePk(null)
    setDeleteErrorPk(null)
    setDetailItem(null)
    setMoveItem(null)
    setHistory(readHistory())
  }

  const reloadStock = () => setReloadKey((key) => key + 1)

  const clearEditedQuantity = (itemPk: number) => {
    setEditedQuantities((previous) => {
      const next = { ...previous }
      delete next[itemPk]
      return next
    })
    setQuantityErrorPk((current) => (current === itemPk ? null : current))
  }

  const handleQuantitySave = async (item: StockItemRecord) => {
    const edited = editedQuantities[item.pk]
    if (typeof edited !== 'number' || edited < 0) {
      return
    }

    setQuantitySavingPk(item.pk)
    setQuantityErrorPk(null)

    try {
      await apiSend(`${getApiBaseUrl()}/api/stock/count/`, 'POST', {
        items: [{ pk: item.pk, quantity: edited }],
      })

      setStockItems((items) =>
        items.map((existing) => (existing.pk === item.pk ? { ...existing, quantity: edited } : existing))
      )
      clearEditedQuantity(item.pk)

      if (quantitySavedResetRef.current != null) {
        window.clearTimeout(quantitySavedResetRef.current)
      }
      setQuantitySavedPk(item.pk)
      quantitySavedResetRef.current = window.setTimeout(() => {
        setQuantitySavedPk(null)
        quantitySavedResetRef.current = null
      }, 3000)
    } catch {
      setQuantityErrorPk(item.pk)
    } finally {
      setQuantitySavingPk(null)
    }
  }

  const handleDeleteItem = async (item: StockItemRecord) => {
    // First tap arms the confirmation; second tap actually deletes.
    if (confirmDeletePk !== item.pk) {
      setConfirmDeletePk(item.pk)
      setDeleteErrorPk(null)
      return
    }

    setDeletingPk(item.pk)
    setDeleteErrorPk(null)

    try {
      await apiSend(`${getApiBaseUrl()}/api/stock/${item.pk}/`, 'DELETE', undefined)
      setStockItems((items) => items.filter((existing) => existing.pk !== item.pk))
      clearEditedQuantity(item.pk)
      setConfirmDeletePk(null)
      showFlash(`Removed ${deriveStockItemName(item)}`)
    } catch {
      setDeleteErrorPk(item.pk)
    } finally {
      setDeletingPk(null)
    }
  }

  const cancelItemEdit = (itemPk: number) => {
    clearEditedQuantity(itemPk)
    setConfirmDeletePk((current) => (current === itemPk ? null : current))
    setDeleteErrorPk((current) => (current === itemPk ? null : current))
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
      const data = await apiSend<ContainerRecord>(
        buildContainerApiUrl(tagId),
        (import.meta.env.VITE_INVENTREE_UPDATE_METHOD?.trim() || 'PATCH').toUpperCase(),
        { name: containerName.trim() }
      )

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
            <InkstockMark size={72} />
            <Title order={2}>Inkstock</Title>
            <Text c="dimmed" size="sm" maw={320}>
              Scan the tag on a drawer or container to see what's inside, adjust stock, and rename
              it.
            </Text>
          </Stack>

          <Stack gap="sm">
            <Button size="lg" radius="md" fullWidth onClick={() => setScannerOpened(true)}>
              Scan QR code
            </Button>
            <Button size="md" radius="md" variant="light" fullWidth onClick={() => setSearchOpened(true)}>
              Find a part
            </Button>
          </Stack>

          {history.length > 0 ? (
            <Paper withBorder radius="lg" p="lg">
              <Text size="xs" tt="uppercase" fw={600} c="dimmed" lts={0.6} mb="sm">
                Recently viewed
              </Text>
              <Stack gap={0}>
                {history.map((entry, index) => (
                  <Fragment key={entry.tag}>
                    {index > 0 ? <Divider /> : null}
                    <UnstyledButton onClick={() => openContainerForTag(entry.tag)} py="sm">
                      <Group justify="space-between" wrap="nowrap">
                        <Text size="sm" fw={500} truncate>
                          {entry.name}
                        </Text>
                        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                          #{entry.tag}
                        </Text>
                      </Group>
                    </UnstyledButton>
                  </Fragment>
                ))}
              </Stack>
            </Paper>
          ) : null}

          {manualEntryVisible ? (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                openContainerForTag(manualInput)
              }}
            >
              <Group gap="sm" wrap="nowrap">
                <TextInput
                  flex={1}
                  size="md"
                  radius="md"
                  placeholder="e.g. 1"
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
              <Button radius="md" onClick={reloadStock}>
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
          <Group justify="space-between" align="center">
            <Button variant="subtle" size="compact-md" px={0} onClick={goHome}>
              ← Back
            </Button>
            <Button variant="subtle" size="compact-md" onClick={() => setSearchOpened(true)}>
              Find a part
            </Button>
          </Group>

          {flash ? (
            <Alert color="teal" radius="md" py="xs">
              {flash}
            </Alert>
          ) : null}

          <Paper withBorder radius="lg" p="lg">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text size="xs" tt="uppercase" fw={600} c="dimmed" lts={0.6}>
                  Drawer
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

              {containerPath ? (
                <Text size="xs" c="dimmed">
                  {containerPath.split('/').join(' / ')}
                </Text>
              ) : null}

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
                  {stockItems.map((item, index) => {
                    const originalQuantity = Number(item.quantity)
                    const edited = editedQuantities[item.pk]
                    const currentQuantity = edited === undefined ? originalQuantity : edited
                    const isDirty = typeof edited === 'number' && edited !== originalQuantity
                    const isSaving = quantitySavingPk === item.pk
                    const hasError = quantityErrorPk === item.pk
                    const isZero = currentQuantity === 0
                    const isDeleting = deletingPk === item.pk
                    const deleteHasError = deleteErrorPk === item.pk
                    const isConfirmingDelete = confirmDeletePk === item.pk
                    const showActions = isDirty || hasError || deleteHasError || (isZero && !item.serial)

                    return (
                      <Fragment key={item.pk}>
                        {index > 0 ? <Divider /> : null}
                        <Stack gap={6} py="sm">
                          <Group justify="space-between" align="center" wrap="nowrap">
                            <UnstyledButton
                              onClick={() => setDetailItem(item)}
                              style={{ minWidth: 0, flex: 1 }}
                              aria-label={`Show details for ${deriveStockItemName(item)}`}
                            >
                              <Text size="sm" fw={500} truncate>
                                {deriveStockItemName(item)}
                              </Text>
                              {item.part_detail?.description ? (
                                <Text size="xs" c="dimmed" lineClamp={1}>
                                  {item.part_detail.description}
                                </Text>
                              ) : null}
                            </UnstyledButton>

                            {item.serial ? (
                              <Badge size="lg" variant="light" radius="sm" style={{ flexShrink: 0 }}>
                                № {item.serial}
                              </Badge>
                            ) : (
                              <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
                                <ActionIcon
                                  variant="default"
                                  size="lg"
                                  radius="md"
                                  aria-label="Decrease quantity"
                                  disabled={isSaving || typeof currentQuantity !== 'number' || currentQuantity <= 0}
                                  onClick={() =>
                                    setEditedQuantities((previous) => ({
                                      ...previous,
                                      [item.pk]: Math.max(
                                        0,
                                        (typeof currentQuantity === 'number' ? currentQuantity : 0) - 1
                                      ),
                                    }))
                                  }
                                >
                                  −
                                </ActionIcon>
                                <NumberInput
                                  value={currentQuantity}
                                  onChange={(value) =>
                                    setEditedQuantities((previous) => ({
                                      ...previous,
                                      [item.pk]: typeof value === 'number' ? value : '',
                                    }))
                                  }
                                  min={0}
                                  hideControls
                                  size="sm"
                                  w={64}
                                  radius="md"
                                  disabled={isSaving}
                                  styles={{ input: { textAlign: 'center' } }}
                                  aria-label="Quantity"
                                />
                                <ActionIcon
                                  variant="default"
                                  size="lg"
                                  radius="md"
                                  aria-label="Increase quantity"
                                  disabled={isSaving}
                                  onClick={() =>
                                    setEditedQuantities((previous) => ({
                                      ...previous,
                                      [item.pk]:
                                        (typeof currentQuantity === 'number' ? currentQuantity : 0) + 1,
                                    }))
                                  }
                                >
                                  +
                                </ActionIcon>
                              </Group>
                            )}
                          </Group>

                          {showActions ? (
                            <Group justify="space-between" align="center">
                              <Text size="xs" c={hasError || deleteHasError ? 'red' : 'dimmed'} style={{ flex: 1, minWidth: 0 }}>
                                {hasError
                                  ? "Couldn't update the stock. Try again."
                                  : deleteHasError
                                    ? "Couldn't delete the item. Try again."
                                    : isZero
                                      ? isConfirmingDelete
                                        ? 'Delete permanently?'
                                        : 'Empty — delete this item?'
                                      : `Was ${originalQuantity.toLocaleString()}`}
                              </Text>
                              <Group gap="xs" wrap="nowrap">
                                <Button
                                  variant="subtle"
                                  color="gray"
                                  size="compact-sm"
                                  disabled={isSaving || isDeleting}
                                  onClick={() => cancelItemEdit(item.pk)}
                                >
                                  Cancel
                                </Button>
                                {isZero ? (
                                  <Button
                                    color="red"
                                    variant={isConfirmingDelete ? 'filled' : 'light'}
                                    size="compact-sm"
                                    loading={isDeleting}
                                    leftSection={<TrashIcon />}
                                    onClick={() => handleDeleteItem(item)}
                                  >
                                    {isConfirmingDelete ? 'Confirm' : 'Delete'}
                                  </Button>
                                ) : (
                                  <Button
                                    size="compact-sm"
                                    loading={isSaving}
                                    disabled={!isDirty}
                                    onClick={() => handleQuantitySave(item)}
                                  >
                                    Update stock
                                  </Button>
                                )}
                              </Group>
                            </Group>
                          ) : (
                            <Group justify="space-between" align="center">
                              {quantitySavedPk === item.pk ? (
                                <Text size="xs" c="teal" fw={500}>
                                  Stock updated in InvenTree ✓
                                </Text>
                              ) : (
                                <span />
                              )}
                              <Button
                                variant="subtle"
                                color="gray"
                                size="compact-sm"
                                onClick={() => setMoveItem(item)}
                              >
                                Move
                              </Button>
                            </Group>
                          )}
                        </Stack>
                      </Fragment>
                    )
                  })}
                </Stack>
              ) : null}

              {stockStatus === 'ready' ? (
                <Button
                  variant="light"
                  radius="md"
                  mt="xs"
                  onClick={() => setAddItemOpened(true)}
                  disabled={containerPk == null}
                >
                  + Add item
                </Button>
              ) : null}
            </Stack>
          </Paper>
        </Stack>
      ) : null}

      <Drawer
        opened={detailItem != null}
        onClose={() => setDetailItem(null)}
        position="bottom"
        radius="lg"
        title="Item details"
        styles={{ title: { fontWeight: 600 } }}
      >
        {detailItem ? (
          <Stack gap="md" pb="md">
            <Group wrap="nowrap" gap="md" align="center">
              {detailItem.part_detail?.thumbnail ? (
                <Image
                  src={`${getApiBaseUrl()}${detailItem.part_detail.thumbnail}`}
                  w={56}
                  h={56}
                  radius="md"
                  fit="contain"
                  alt=""
                />
              ) : null}
              <Box miw={0}>
                <Text fw={600}>{deriveStockItemName(detailItem)}</Text>
                {detailItem.part_detail?.description ? (
                  <Text size="sm" c="dimmed">
                    {detailItem.part_detail.description}
                  </Text>
                ) : null}
              </Box>
            </Group>

            <Divider />

            <Stack gap={8}>
              {detailItem.serial ? (
                <DetailRow label="Serial number" value={detailItem.serial} />
              ) : (
                <DetailRow
                  label="In stock"
                  value={`${Number(detailItem.quantity).toLocaleString()}${
                    detailItem.part_detail?.units ? ` ${detailItem.part_detail.units}` : ''
                  }`}
                />
              )}
              <DetailRow label="Part number" value={detailItem.part_detail?.IPN} />
              <DetailRow label="Revision" value={detailItem.part_detail?.revision} />
              <DetailRow label="Batch" value={detailItem.batch} />
              <DetailRow label="Status" value={detailItem.status_text} />
              <DetailRow label="Packaging" value={detailItem.packaging} />
              <DetailRow label="Last updated" value={detailItem.updated} />
              <DetailRow label="Notes" value={detailItem.notes} />
            </Stack>

            <Divider />

            <Stack gap="xs">
              <Anchor
                href={buildPartWebUrl(detailItem.part)}
                target="_blank"
                rel="noreferrer"
                size="sm"
                fw={500}
              >
                Open part in InvenTree ↗
              </Anchor>
              {detailItem.link ? (
                <Anchor href={detailItem.link} target="_blank" rel="noreferrer" size="sm" fw={500}>
                  External link ↗
                </Anchor>
              ) : null}
            </Stack>
          </Stack>
        ) : null}
      </Drawer>

      <SearchDrawer
        opened={searchOpened}
        onClose={() => setSearchOpened(false)}
        onOpenLocation={(locationPk) => {
          setSearchOpened(false)
          openContainerForTag(String(locationPk))
        }}
      />

      <AddItemDrawer
        opened={addItemOpened}
        onClose={() => setAddItemOpened(false)}
        locationPk={containerPk}
        onAdded={(message) => {
          setAddItemOpened(false)
          showFlash(message)
          reloadStock()
        }}
      />

      <MoveItemDrawer
        opened={moveItem != null}
        onClose={() => setMoveItem(null)}
        item={moveItem}
        currentLocationPk={containerPk}
        onMoved={(message) => {
          setMoveItem(null)
          showFlash(message)
          reloadStock()
        }}
      />

      <BarcodeScanner
        opened={scannerOpened}
        onClose={() => setScannerOpened(false)}
        onDetected={openContainerForTag}
      />
    </Container>
  )
}
