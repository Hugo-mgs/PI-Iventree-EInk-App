import { useEffect, useState } from 'react'
import { Button, Code, Drawer, Group, Stack, Text, TextInput } from '@mantine/core'
import {
  getApiBaseOverride,
  getDefaultApiBaseUrl,
  setApiBaseOverride,
  testApiBaseUrl,
} from './api'

type Props = {
  opened: boolean
  onClose: () => void
  onSaved: (message: string) => void
}

type TestState = 'idle' | 'testing' | 'ok' | 'fail'

function SettingsForm({ onClose, onSaved }: { onClose: () => void; onSaved: Props['onSaved'] }) {
  const [value, setValue] = useState(() => getApiBaseOverride())
  const [testState, setTestState] = useState<TestState>('idle')
  const defaultUrl = getDefaultApiBaseUrl()
  const effectiveUrl = value.trim().replace(/\/$/, '') || defaultUrl

  // Clear any previous test result whenever the address is edited.
  useEffect(() => {
    setTestState('idle')
  }, [value])

  const runTest = async () => {
    setTestState('testing')
    try {
      const ok = await testApiBaseUrl(effectiveUrl)
      setTestState(ok ? 'ok' : 'fail')
    } catch {
      setTestState('fail')
    }
  }

  const save = () => {
    setApiBaseOverride(value)
    const saved = value.trim().replace(/\/$/, '')
    onSaved(saved ? `Server set to ${saved}` : 'Using the built-in server address')
    onClose()
  }

  return (
    <Stack gap="md" pb="md">
      <Text size="sm" c="dimmed">
        The InvenTree address this app connects to. Change it when your server's IP changes — for
        example when switching between home Wi-Fi and a phone hotspot. No rebuild needed.
      </Text>

      <TextInput
        size="md"
        radius="md"
        label="Server address"
        placeholder={defaultUrl || 'http://192.168.1.93'}
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />

      <Text size="xs" c="dimmed">
        Leave blank to use the built-in default
        {defaultUrl ? (
          <>
            {' '}
            (<Code>{defaultUrl}</Code>)
          </>
        ) : null}
        .
      </Text>

      {testState === 'ok' ? (
        <Text size="sm" c="green">
          ✓ Connected — the server answered.
        </Text>
      ) : null}
      {testState === 'fail' ? (
        <Text size="sm" c="red">
          Couldn't reach the server at {effectiveUrl || 'that address'}.
        </Text>
      ) : null}

      <Group grow>
        <Button
          variant="default"
          radius="md"
          loading={testState === 'testing'}
          disabled={!effectiveUrl}
          onClick={runTest}
        >
          Test
        </Button>
        <Button radius="md" onClick={save}>
          Save
        </Button>
      </Group>
    </Stack>
  )
}

export default function SettingsDrawer({ opened, onClose, onSaved }: Props) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      radius="lg"
      title="Server settings"
      styles={{ title: { fontWeight: 600 } }}
    >
      {opened ? <SettingsForm onClose={onClose} onSaved={onSaved} /> : null}
    </Drawer>
  )
}
