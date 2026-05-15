import { useState } from 'react'
import { Alert, Button, Container, Stack, Text, Title } from '@mantine/core'
import BarcodeScanner from './BarcodeScanner'
import './App.css'

function App() {
  const [scannerOpened, setScannerOpened] = useState(false)
  const [scannedCode, setScannedCode] = useState('')

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>QR code reader</Title>
          <Text c="dimmed" mt="xs">
            Open the scanner, point your camera at a barcode or QR code, and the decoded value will appear below.
          </Text>
        </div>

        <Button onClick={() => setScannerOpened(true)}>Open scanner</Button>

        {scannedCode ? (
          <Alert color="green" title="Last scanned value">
            {scannedCode}
          </Alert>
        ) : (
          <Alert color="blue" title="No scan yet">
            Scan a QR code or barcode to see the result here.
          </Alert>
        )}
      </Stack>

      <BarcodeScanner
        opened={scannerOpened}
        onClose={() => setScannerOpened(false)}
        onDetected={(code) => {
          setScannedCode(code)
          setScannerOpened(false)
        }}
      />
    </Container>
  )
}

export default App
