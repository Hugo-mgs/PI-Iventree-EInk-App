import { Fragment, useState } from 'react'
import {
  Box,
  Button,
  Divider,
  Drawer,
  Group,
  Image,
  Loader,
  NumberInput,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import {
  apiGet,
  apiSend,
  buildPartSearchUrl,
  getApiBaseUrl,
  normalizeList,
  type PartRecord,
} from './api'

type Props = {
  opened: boolean
  onClose: () => void
  locationPk: number | null
  onAdded: (message: string) => void
}

function AddItemForm({ locationPk, onAdded }: { locationPk: number | null; onAdded: Props['onAdded'] }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PartRecord[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const [selectedPart, setSelectedPart] = useState<PartRecord | null>(null)
  const [quantity, setQuantity] = useState<number | string>(1)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  const handleSearch = async () => {
    const searchTerm = query.trim()
    if (!searchTerm) {
      return
    }

    setSearching(true)
    setSearchFailed(false)

    try {
      const data = await apiGet<PartRecord[] | { results: PartRecord[] }>(buildPartSearchUrl(searchTerm))
      setResults(normalizeList(data))
    } catch {
      setResults(null)
      setSearchFailed(true)
    } finally {
      setSearching(false)
    }
  }

  const handleAdd = async () => {
    if (!selectedPart || locationPk == null || typeof quantity !== 'number' || quantity <= 0) {
      return
    }

    setSaving(true)
    setSaveFailed(false)

    try {
      await apiSend(`${getApiBaseUrl()}/api/stock/`, 'POST', {
        part: selectedPart.pk,
        location: locationPk,
        quantity,
      })
      onAdded(`Added ${quantity.toLocaleString()} × ${selectedPart.name}`)
    } catch {
      setSaveFailed(true)
    } finally {
      setSaving(false)
    }
  }

  if (selectedPart) {
    return (
      <Stack gap="md" pb="md">
        <Group wrap="nowrap" gap="md" align="center">
          {selectedPart.thumbnail ? (
            <Image
              src={`${getApiBaseUrl()}${selectedPart.thumbnail}`}
              w={48}
              h={48}
              radius="md"
              fit="contain"
              alt=""
            />
          ) : null}
          <Box miw={0}>
            <Text fw={600}>{selectedPart.name}</Text>
            {selectedPart.description ? (
              <Text size="sm" c="dimmed" lineClamp={2}>
                {selectedPart.description}
              </Text>
            ) : null}
          </Box>
        </Group>

        <NumberInput
          label="Quantity"
          size="md"
          radius="md"
          min={0}
          value={quantity}
          onChange={setQuantity}
        />

        {saveFailed ? (
          <Text size="sm" c="red">
            The item could not be added. Try again.
          </Text>
        ) : null}

        <Group justify="space-between">
          <Button variant="subtle" color="gray" disabled={saving} onClick={() => setSelectedPart(null)}>
            Choose another part
          </Button>
          <Button
            radius="md"
            loading={saving}
            disabled={typeof quantity !== 'number' || quantity <= 0}
            onClick={handleAdd}
          >
            Add to container
          </Button>
        </Group>
      </Stack>
    )
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
            placeholder="Search parts…"
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
            Searching parts…
          </Text>
        </Group>
      ) : null}

      {searchFailed ? (
        <Text size="sm" c="red">
          The part search failed. Check your connection and try again.
        </Text>
      ) : null}

      {!searching && results && results.length === 0 ? (
        <Text size="sm" c="dimmed">
          No parts match “{query.trim()}”.
        </Text>
      ) : null}

      {!searching && results && results.length > 0 ? (
        <Stack gap={0}>
          {results.map((part, index) => (
            <Fragment key={part.pk}>
              {index > 0 ? <Divider /> : null}
              <UnstyledButton onClick={() => setSelectedPart(part)} py="sm">
                <Group wrap="nowrap" gap="sm">
                  {part.thumbnail ? (
                    <Image
                      src={`${getApiBaseUrl()}${part.thumbnail}`}
                      w={36}
                      h={36}
                      radius="sm"
                      fit="contain"
                      alt=""
                    />
                  ) : null}
                  <Box miw={0}>
                    <Text size="sm" fw={500} truncate>
                      {part.name}
                    </Text>
                    {part.description ? (
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {part.description}
                      </Text>
                    ) : null}
                  </Box>
                </Group>
              </UnstyledButton>
            </Fragment>
          ))}
        </Stack>
      ) : null}
    </Stack>
  )
}

export default function AddItemDrawer({ opened, onClose, locationPk, onAdded }: Props) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      radius="lg"
      title="Add an item"
      styles={{ title: { fontWeight: 600 } }}
    >
      {opened ? <AddItemForm locationPk={locationPk} onAdded={onAdded} /> : null}
    </Drawer>
  )
}
