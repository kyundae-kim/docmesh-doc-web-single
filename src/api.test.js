import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  deleteDocumentHard,
  deleteDocumentSoft,
  getDocumentContentUrl,
  getUploadOperation,
  listDocumentsIterator,
  listDocumentsPage,
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
})
