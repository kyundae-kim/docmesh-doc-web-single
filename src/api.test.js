import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PROJECT_VERSION,
  clearAllData,
  clearPartitionData,
  deleteDocumentHard,
  deleteDocumentSoft,
  executeReconciliationPlan,
  getDocumentInspection,
  getDocumentContentUrl,
  getManagementMetadata,
  getLiveness,
  getOpenApiDocument,
  getReadiness,
  getRecoveryCandidateIterator,
  initializeData,
  initializePartitionData,
  listRecoveryCandidates,
  reconcileDocument,
  reconcileDocuments,
  getUploadOperation,
  listDocumentsIterator,
  listDocumentsPage,
  uploadDocument,
  uploadDocumentBytes,
} from './api'

function jsonResponse(body, status = 200, headers = {}) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json', ...headers }),
    json: () => Promise.resolve(body),
  })
}

describe('DocMesh API adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps opaque cursors unchanged when using the explicit page facade', async () => {
    globalThis.fetch = vi.fn(() => jsonResponse({ items: [], next_cursor: null, has_more: false }))

    await listDocumentsPage({ cursor: 'opaque+/cursor==', limit: 25, status: 'available' })

    const [url, options] = globalThis.fetch.mock.calls[0]
    const parsedUrl = new URL(url, 'http://localhost')
    expect(parsedUrl.pathname).toBe('/api/documents/page')
    expect(parsedUrl.searchParams.get('cursor')).toBe('opaque+/cursor==')
    expect(parsedUrl.searchParams.get('limit')).toBe('25')
    expect(parsedUrl.searchParams.get('status')).toBe('available')
    expect(options.headers.Accept).toBe('application/json')
  })

  it('supports iterator listing and strict base64 upload requests', async () => {
    globalThis.fetch = vi.fn((url) => {
      if (String(url).includes('/documents/iterator')) return jsonResponse({ items: [] })
      return jsonResponse({ document_id: 'doc-bytes', created: true }, 201)
    })

    await listDocumentsIterator({ pageSize: 40, status: 'uploaded' })
    await uploadDocumentBytes({
      contentBase64: 'SGVsbG8=',
      filename: 'hello.txt',
      contentType: 'text/plain',
      documentId: 'doc-bytes',
      metadata: { source: 'test' },
      checksum: 'sha256:abc',
      idempotencyKey: 'upload-1',
      idempotencyScope: 'test-scope',
    })

    const iteratorUrl = new URL(globalThis.fetch.mock.calls[0][0], 'http://localhost')
    expect(iteratorUrl.pathname).toBe('/api/documents/iterator')
    expect(iteratorUrl.searchParams.get('page_size')).toBe('40')
    expect(iteratorUrl.searchParams.get('status')).toBe('uploaded')

    const [uploadUrl, uploadOptions] = globalThis.fetch.mock.calls[1]
    expect(uploadUrl).toBe('/api/documents/bytes')
    expect(uploadOptions.method).toBe('POST')
    expect(JSON.parse(uploadOptions.body)).toEqual({
      content_base64: 'SGVsbG8=',
      filename: 'hello.txt',
      content_type: 'text/plain',
      document_id: 'doc-bytes',
      metadata: { source: 'test' },
      checksum: 'sha256:abc',
      idempotency_key: 'upload-1',
      idempotency_scope: 'test-scope',
    })
  })

  it('uses the v0.7 contract for bytes uploads and checksum-aware copy URLs', async () => {
    expect(PROJECT_VERSION).toBe('0.7.0')
    globalThis.fetch = vi.fn(() => jsonResponse({ document_id: 'doc-bytes', created: true }, 201))

    await uploadDocumentBytes({
      contentBase64: 'SGVsbG8=',
      filename: 'hello.txt',
      contentType: 'text/plain',
      userId: 'must-not-cross-the-v0.7-boundary',
    })

    expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body)).toEqual({
      content_base64: 'SGVsbG8=',
      filename: 'hello.txt',
      content_type: 'text/plain',
    })
    expect(getDocumentContentUrl('doc-1', { mode: 'copy' })).toBe('/api/documents/doc-1/copy?verify_checksum=true')
  })

  it('returns the upload Location and correlation metadata without changing the public payload', async () => {
    globalThis.fetch = vi.fn(() => jsonResponse(
      { document_id: 'doc-upload', created: true },
      201,
      { Location: '/documents/doc-upload', 'X-Correlation-ID': 'upload-correlation' },
    ))

    const result = await uploadDocument(new File(['body'], 'body.txt', { type: 'text/plain' }))

    expect(result.document_id).toBe('doc-upload')
    expect(result.created).toBe(true)
    expect(result.location).toBe('/documents/doc-upload')
    expect(result.correlationId).toBe('upload-correlation')
  })

  it('builds every public content route without exposing management metadata', () => {
    expect(getDocumentContentUrl('doc/1', { mode: 'inline' })).toBe('/api/documents/doc%2F1/content')
    expect(getDocumentContentUrl('doc/1', { mode: 'eager' })).toBe('/api/documents/doc%2F1/content/eager')
    expect(getDocumentContentUrl('doc/1', { mode: 'async', chunkSize: 1024 })).toBe('/api/documents/doc%2F1/content/async?chunk_size=1024')
    expect(getDocumentContentUrl('doc/1', { mode: 'chunks', chunkSize: 1024 })).toBe('/api/documents/doc%2F1/chunks?chunk_size=1024')
    expect(getDocumentContentUrl('doc/1', { mode: 'copy', chunkSize: 1024, verifyChecksum: true })).toBe('/api/documents/doc%2F1/copy?chunk_size=1024&verify_checksum=true')
    expect(getDocumentContentUrl('doc/1', { mode: 'download', chunkSize: 1024 })).toBe('/api/documents/doc%2F1/download?chunk_size=1024')
  })

  it('exposes explicit public soft delete and upload operation lookups', async () => {
    globalThis.fetch = vi.fn((url, options = {}) => {
      if (String(url).includes('/upload-operations/')) return jsonResponse({ state: 'succeeded' })
      return jsonResponse({ document_id: 'doc-1', deleted: true })
    })

    await deleteDocumentSoft('doc-1')
    await getUploadOperation('key/1', 'scope-a')

    expect(globalThis.fetch.mock.calls[0][0]).toBe('/api/documents/doc-1/soft')
    expect(globalThis.fetch.mock.calls[0][1].method).toBe('DELETE')
    expect(globalThis.fetch.mock.calls[1][0]).toBe('/api/upload-operations/key%2F1?scope=scope-a')

    await deleteDocumentHard('doc-1')
    expect(globalThis.fetch.mock.calls[2][0]).toBe('/api/documents/doc-1/hard')
  })

  it('maps every management and operations route to its v0.7 HTTP contract', async () => {
    globalThis.fetch = vi.fn(() => jsonResponse({ ok: true }))

    await getManagementMetadata('doc/1')
    await getDocumentInspection('doc/1')
    await listRecoveryCandidates({ status: 'failed', offset: 5, limit: 20 })
    await getRecoveryCandidateIterator({ status: 'failed', pageSize: 20 })
    await reconcileDocument('doc/1', { action: 'mark_failed', storageKey: 'private/doc-1', dryRun: true, actor: 'operator' })
    await reconcileDocuments({ status: 'failed', action: 'mark_failed', offset: 5, limit: 20, dryRun: true, actor: 'operator' })
    await executeReconciliationPlan({
      status: 'failed',
      action: 'mark_failed',
      actor: 'operator',
      items: [{ documentId: 'doc/1', action: 'mark_failed', storageKey: 'private/doc-1' }],
    })
    await clearAllData()
    await initializeData()
    await clearPartitionData()
    await initializePartitionData()
    await getLiveness()
    await getReadiness()
    await getOpenApiDocument()

    const calls = globalThis.fetch.mock.calls
    expect(calls.map(([url, options = {}]) => [url, options.method || 'GET'])).toEqual([
      ['/api/management/documents/doc%2F1/metadata', 'GET'],
      ['/api/management/documents/doc%2F1/inspection', 'GET'],
      ['/api/management/recovery-candidates?status=failed&offset=5&limit=20', 'GET'],
      ['/api/management/recovery-candidates/iterator?status=failed&page_size=20', 'GET'],
      ['/api/management/documents/doc%2F1/reconciliations', 'POST'],
      ['/api/management/reconciliations', 'POST'],
      ['/api/management/reconciliation-plans/executions', 'POST'],
      ['/api/management/data', 'DELETE'],
      ['/api/management/data/initializations', 'POST'],
      ['/api/management/data/partition', 'DELETE'],
      ['/api/management/data/partition/initializations', 'POST'],
      ['/api/health/liveness', 'GET'],
      ['/api/health/readiness', 'GET'],
      ['/api/openapi.json', 'GET'],
    ])
    expect(JSON.parse(calls[4][1].body)).toEqual({
      action: 'mark_failed',
      storage_key: 'private/doc-1',
      dry_run: true,
      actor: 'operator',
    })
    expect(JSON.parse(calls[6][1].body)).toEqual({
      status: 'failed',
      action: 'mark_failed',
      items: [{ document_id: 'doc/1', action: 'mark_failed', storage_key: 'private/doc-1' }],
      actor: 'operator',
    })
  })

  it('preserves binary response headers needed by the document workspace', async () => {
    const blob = new Blob(['document body'], { type: 'text/plain' })
    globalThis.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'text/plain',
        'content-length': '13',
        'content-disposition': 'inline; filename="notes.txt"',
        'x-document-checksum': 'sha256:abc',
        'x-checksum-verified': 'true',
        'x-correlation-id': 'binary-correlation',
      }),
      blob: () => Promise.resolve(blob),
    }))

    const result = await (await import('./api')).readDocumentContent('doc-1', { mode: 'copy', verifyChecksum: true })

    expect(result.blob).toBe(blob)
    expect(result.contentLength).toBe('13')
    expect(result.contentDisposition).toContain('notes.txt')
    expect(result.checksum).toBe('sha256:abc')
    expect(result.checksumVerified).toBe('true')
    expect(result.correlationId).toBe('binary-correlation')
  })
})
