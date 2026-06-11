import { Fragment, useState } from 'react'
import {
  Box,
  Divider,
  Drawer,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import {
  apiSend,
  buildLocationListUrl,
  buildLocationSearchUrl,
  deriveStockItemName,
  getApiBaseUrl,
  type LocationRecord,
  type StockItemRecord,
} from './api'
import { useLiveSearch } from './useLiveSearch'

type Props = {
  opened: boolean
  onClose: () => void
  item: StockItemRecord | null
  currentLocationPk: number | null
  onMoved: (message: string) => void
}

function MoveItemForm({
  item,
  currentLocationPk,
  onMoved,
}: {
  item: StockItemRecord
  currentLocationPk: number | null
  onMoved: Props['onMoved']
}) {
  const [query, setQuery] = useState('')
  const { results, loading, failed, isDefault } = useLiveSearch<LocationRecord>(
    query,
    buildLocationListUrl,
    buildLocationSearchUrl
  )
  const [movingTo, setMovingTo] = useState<number | null>(null)
  const [moveFailed, setMoveFailed] = useState(false)

  const handleMove = async (destination: LocationRecord) => {
    setMovingTo(destination.pk)
    setMoveFailed(false)

    try {
      await apiSend(`${getApiBaseUrl()}/api/stock/transfer/`, 'POST', {
        items: [{ pk: item.pk, quantity: item.quantity }],
        location: destination.pk,
      })
      onMoved(`Moved ${deriveStockItemName(item)} to ${destination.name}`)
    } catch {
      setMoveFailed(true)
    } finally {
      setMovingTo(null)
    }
  }

  return (
    <Stack gap="md" pb="md">
      <Box>
        <Text size="sm" c="dimmed">
          Moving
        </Text>
        <Text fw={600}>{deriveStockItemName(item)}</Text>
      </Box>

      <Divider />

      <TextInput
        size="md"
        radius="md"
        placeholder="Search destination…"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        rightSection={loading ? <Loader size="xs" /> : null}
        autoFocus
      />

      {failed ? (
        <Text size="sm" c="red">
          The location search failed. Try again.
        </Text>
      ) : null}

      {moveFailed ? (
        <Text size="sm" c="red">
          The item could not be moved. Try a different location or try again.
        </Text>
      ) : null}

      {!loading && results && results.length === 0 ? (
        <Text size="sm" c="dimmed">
          {query.trim() ? `No locations match “${query.trim()}”.` : 'No locations found.'}
        </Text>
      ) : null}

      {results && results.length > 0 ? (
        <Stack gap={0}>
          {isDefault ? (
            <Text size="xs" tt="uppercase" fw={600} c="dimmed" lts={0.6} pb={4}>
              Locations
            </Text>
          ) : null}
          {results.map((location, index) => {
            const isCurrent = location.pk === currentLocationPk
            const isStructural = location.structural === true

            return (
              <Fragment key={location.pk}>
                {index > 0 ? <Divider /> : null}
                <UnstyledButton
                  onClick={() => {
                    if (!isCurrent && !isStructural) {
                      void handleMove(location)
                    }
                  }}
                  disabled={isCurrent || isStructural || movingTo != null}
                  py="sm"
                  style={{ opacity: isCurrent || isStructural ? 0.5 : 1 }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Box miw={0}>
                      <Text size="sm" fw={500} truncate>
                        {location.name}
                      </Text>
                      {location.pathstring ? (
                        <Text size="xs" c="dimmed" truncate>
                          {location.pathstring}
                        </Text>
                      ) : null}
                    </Box>
                    {movingTo === location.pk ? (
                      <Loader size="xs" />
                    ) : isCurrent ? (
                      <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                        Current
                      </Text>
                    ) : isStructural ? (
                      <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                        Can't hold stock
                      </Text>
                    ) : null}
                  </Group>
                </UnstyledButton>
              </Fragment>
            )
          })}
        </Stack>
      ) : null}
    </Stack>
  )
}

export default function MoveItemDrawer({ opened, onClose, item, currentLocationPk, onMoved }: Props) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      radius="lg"
      title="Move item"
      styles={{ title: { fontWeight: 600 } }}
    >
      {opened && item ? (
        <MoveItemForm item={item} currentLocationPk={currentLocationPk} onMoved={onMoved} />
      ) : null}
    </Drawer>
  )
}
