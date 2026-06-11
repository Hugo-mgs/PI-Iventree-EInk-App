import { Fragment, useState } from 'react'
import {
  Badge,
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
  buildStockListUrl,
  buildStockSearchUrl,
  deriveStockItemName,
  type StockItemRecord,
} from './api'
import { useLiveSearch } from './useLiveSearch'

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
  const { results, loading, failed, isDefault } = useLiveSearch<StockItemRecord>(
    query,
    buildStockListUrl,
    buildStockSearchUrl
  )

  return (
    <Stack gap="md" pb="md">
      <TextInput
        size="md"
        radius="md"
        placeholder="e.g. M3 screws"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        rightSection={loading ? <Loader size="xs" /> : null}
        autoFocus
      />

      {failed ? (
        <Text size="sm" c="red">
          The search failed. Check your connection and try again.
        </Text>
      ) : null}

      {!loading && results && results.length === 0 ? (
        <Text size="sm" c="dimmed">
          {query.trim() ? `Nothing in stock matches “${query.trim()}”.` : 'No stock items found.'}
        </Text>
      ) : null}

      {results && results.length > 0 ? (
        <Stack gap={0}>
          {isDefault ? (
            <Text size="xs" tt="uppercase" fw={600} c="dimmed" lts={0.6} pb={4}>
              Recent stock
            </Text>
          ) : null}
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
