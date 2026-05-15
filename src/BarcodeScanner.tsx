import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Group, Loader, Modal, Stack, Text } from '@mantine/core'
import { Html5Qrcode } from 'html5-qrcode'

type Props = {
  opened: boolean;
  onClose: () => void;
  onDetected: (code: string) => void; // callback when a code is scanned
  fps?: number;
  qrbox?: number; // size of the scanning area
};

export default function BarcodeScanner({
  opened,
  onClose,
  onDetected,
  fps = 10,
  qrbox = 250,
}: Props) {
  const mountId = 'html5qr-reader'
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [scannerReady, setScannerReady] = useState(false)
  const [status, setStatus] = useState<'idle' | 'starting' | 'running' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!opened || !scannerReady) return

    let cancelled = false
    setStatus('starting')
    setErrorMessage('')

    const scanner = new Html5Qrcode(mountId)
    scannerRef.current = scanner

    const startScanner = async () => {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps, qrbox: { width: qrbox, height: qrbox } },
          (decodedText) => {
            onDetected(decodedText)
          },
          () => {
            // Camera feed can be noisy; ignore per-frame scan misses.
          }
        )

        if (!cancelled) {
          setStatus('running')
        }
      } catch (error) {
        if (cancelled) {
          return
        }

        console.warn('Failed to start QR scanner', error)
        setStatus('error')
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to start the camera scanner. Check browser permissions and camera access.'
        )
      }
    }

    void startScanner()

    return () => {
      cancelled = true

      const scannerToStop = scannerRef.current
      scannerRef.current = null

      if (scannerToStop) {
        void scannerToStop
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              scannerToStop.clear()
            } catch {
              // Ignore cleanup errors when the scanner is already torn down.
            }
          })
      }
    }
  }, [opened, scannerReady, fps, qrbox, onDetected])

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Scan barcode/QR"
      size="lg"
      centered
      onEnterTransitionEnd={() => {
        setScannerReady(true)
      }}
      onExitTransitionEnd={() => {
        setScannerReady(false)
      }}
    >
      <Stack gap="md">
        <div id={mountId} style={{ width: '100%', minHeight: 320 }} />

        {status === 'starting' && (
          <Group gap="sm">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Starting camera...
            </Text>
          </Group>
        )}

        {status === 'error' && (
          <Alert color="red" title="Scanner error">
            {errorMessage}
          </Alert>
        )}

        <Text size="sm" c="dimmed">
          Tip: Allow camera permission and prefer a well-lit area for better results.
        </Text>

        <Group justify="flex-end">
          <Button
            onClick={() => {
              const scannerToStop = scannerRef.current
              scannerRef.current = null

              if (scannerToStop) {
                void scannerToStop
                  .stop()
                  .catch(() => {})
                  .finally(() => {
                    try {
                      scannerToStop.clear()
                    } catch {
                      // Ignore cleanup errors when the scanner is already torn down.
                    }
                    onClose()
                  })
              } else {
                onClose()
              }
            }}
          >
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}