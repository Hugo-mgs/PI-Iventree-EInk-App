import { Fragment, useState } from 'react'
import {
  Badge,
  Box,
  Button,
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
  apiGet,
  buildStockSearchUrl,
  deriveStockItemName,
  normalizeList,
  type StockItemRecord,
} from './api'

type Props = {
  opened: boolean
  onClose: () => void
  onOpenLocation: (locationPk: number) => void
}

function formatStockQuantity(item: StockItemRecord) {
  if (item.serial) {
    return `№ ${item.serial}`
  }
  const units = item.part_detail?.units ? ` ${item.part_detail.units}` : ''
  return `${Number(item.quantity).toLocaleString()}${units}`
}

function SearchForm({ onOpenLocation }: { onOpenLocation: Props['onOpenLocation'] }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StockItemRecord[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)

  const handleSearch = async () => {
    const searchTerm = query.trim()
    if (!searchTerm) {
      return
    }

    setSearching(true)
    setSearchFailed(false)

    try {
      const data = await apiGet<StockItemRecord[] | { results: StockItemRecord[] }>(
        buildStockSearchUrl(searchTerm)
      )
      setResults(normalizeList(data))
    } catch {
      setResults(null)
      setSearchFailed(true)
    } finally {
      setSearching(false)
    }
  }

  return (
    <Stack gap="md" pb="md">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void handleSearch()
        }}
      >
        <Group gap="sm" wrap="nowrap">
          <TextInput
            flex={1}
            size="md"
            radius="md"
            placeholder="e.g. M3 screws"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            autoFocus
          />
          <Button type="submit" size="md" radius="md" variant="light" disabled={!query.trim()}>
            Search
          </Button>
        </Group>
      </form>

      {searching ? (
        <Group gap="sm">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">
            Searching stock…
          </Text>
        </Group>
      ) : null}

      {searchFailed ? (
        <Text size="sm" c="red">
          The search failed. Check your connection and try again.
        </Text>
      ) : null}

      {!searching && results && results.length === 0 ? (
        <Text size="sm" c="dimmed">
          Nothing in stock matches “{query.trim()}”.
        </Text>
      ) : null}

      {!searching && results && results.length > 0 ? (
        <Stack gap={0}>
          {results.map((item, index) => {
            const location = item.location_detail
            return (
              <Fragment key={item.pk}>
                {index > 0 ? <Divider /> : null}
                <UnstyledButton
                  onClick={() => {
                    if (location) {
                      onOpenLocation(location.pk)
                    }
                  }}
                  disabled={!location}
                  py="sm"
                >
                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <Box miw={0}>
                      <Text size="sm" fw={500} truncate>
                        {deriveStockItemName(item)}
                      </Text>
                      {location ? (
                        <Text size="xs" c="dimmed" truncate>
                          {location.pathstring ?? location.name} ↗
                        </Text>
                      ) : (
                        <Text size="xs" c="dimmed">
                          No location
                        </Text>
                      )}
                    </Box>
                    <Badge size="lg" variant="light" radius="sm" style={{ flexShrink: 0 }}>
                      {formatStockQuantity(item)}
                    </Badge>
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

export default function SearchDrawer({ opened, onClose, onOpenLocation }: Props) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      radius="lg"
      title="Find a part"
      styles={{ title: { fontWeight: 600 } }}
    >
      {opened ? <SearchForm onOpenLocation={onOpenLocation} /> : null}
    </Drawer>
  )
}
