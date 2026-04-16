export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <main className="container">
        <div className="text-center">
          <h1>Barcode API</h1>
          <p>Generate and decode barcodes with one API call</p>
          <div className="grid grid-cols-3">
            <div style={{ padding: '1.5rem', background: '#333', borderRadius: '8px' }}>
              <h2>Generate</h2>
              <p>Create barcodes in 9 different formats with customizable options.</p>
            </div>
            <div style={{ padding: '1.5rem', background: '#333', borderRadius: '8px' }}>
              <h2>Decode</h2>
              <p>Extract data from barcode images with high accuracy.</p>
            </div>
            <div style={{ padding: '1.5rem', background: '#333', borderRadius: '8px' }}>
              <h2>Validate</h2>
              <p>Verify barcode data format and checksums.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}