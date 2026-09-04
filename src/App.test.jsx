import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const documents = [
  {
    document_id: 'doc-contract',
    original_filename: 'service-contract.pdf',
    content_type: 'application/pdf',
    file_size: 482304,
    status: 'available',
    created_at: '2026-08-17T02:00:00Z',
    updated_at: '2026-08-17T02:00:00Z',
    deleted_at: null,
    created_by: null,
    checksum: 'sha256:abc',
    metadata: {},
  },
  {
    document_id: 'doc-notes',
    original_filename: 'release-notes.md',
    content_type: 'text/markdown',
    file_size: 2048,
    status: 'uploaded',
    created_at: '2026-08-16T02:00:00Z',
    updated_at: '2026-08-16T02:00:00Z',
    deleted_at: null,
    created_by: null,
    checksum: null,
    metadata: {},
  },
]

function jsonResponse(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
  })
}

describe('DocMesh document workspace', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn((url) => {
      if (String(url).includes('/health/readiness')) {
        return jsonResponse({ status: 'ok', ok: true, details: { dms: { ok: true } } })
      }
      return jsonResponse({ items: documents, next_cursor: null, has_more: false })
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('loads document cards and filters them by filename', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByText('service-contract.pdf')).toBeInTheDocument()
    expect(screen.getByText('release-notes.md')).toBeInTheDocument()
    expect(screen.getByText('2 documents')).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: /문서 검색/i }), 'contract')

    expect(screen.getByText('service-contract.pdf')).toBeInTheDocument()
    expect(screen.queryByText('release-notes.md')).not.toBeInTheDocument()
  })

  it('shows dependency readiness separately from the document list', async () => {
    render(<App />)

    expect(await screen.findByText('service-contract.pdf')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'DocMesh 서비스 상태' })).toHaveTextContent('서비스 정상')
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/health/readiness'), expect.anything())
  })

  it('does not show a redundant workspace label in the sidebar', async () => {
    render(<App />)

    expect(await screen.findByText('service-contract.pdf')).toBeInTheDocument()
    expect(screen.queryByText('WORKSPACE', { exact: true })).not.toBeInTheDocument()
  })

  it('does not reserve space for the removed sidebar', async () => {
    render(<App />)

    expect(await screen.findByText('service-contract.pdf')).toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(screen.queryByText('Document Service')).not.toBeInTheDocument()
  })

  it('replaces the breadcrumb with a service icon in the page header', async () => {
    render(<App />)

    expect(await screen.findByText('service-contract.pdf')).toBeInTheDocument()
    expect(screen.queryByText('Workspace', { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByText('Documents', { exact: true })).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'DocMesh 서비스' })).toBeInTheDocument()
  })

  it('opens a document preview from its card', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /service-contract\.pdf 상세 보기/i }))

    expect(await screen.findByRole('dialog', { name: /service-contract\.pdf/i })).toBeInTheDocument()
    expect(screen.getByText('문서 상세')).toBeInTheDocument()
  })

  it('uploads a file through the document API and refreshes the list', async () => {
    const user = userEvent.setup()
    let uploaded = false
    globalThis.fetch = vi.fn((url, options = {}) => {
      if (String(url).includes('/health/readiness')) {
        return jsonResponse({ status: 'ok', ok: true, details: { dms: { ok: true } } })
      }
      if (options.method === 'POST') {
        uploaded = true
        return jsonResponse({ ...documents[0], document_id: 'doc-uploaded', original_filename: 'quarterly-report.docx' }, 201)
      }
      return jsonResponse({
        items: uploaded ? [...documents, { ...documents[0], document_id: 'doc-uploaded', original_filename: 'quarterly-report.docx' }] : documents,
        next_cursor: null,
        has_more: false,
      })
    })

    render(<App />)
    const input = await screen.findByLabelText('문서 파일 선택')
    const file = new File(['quarterly report'], 'quarterly-report.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    await user.upload(input, file)
    await user.click(screen.getByRole('button', { name: /업로드 시작/i }))

    await waitFor(() => expect(screen.getByText('quarterly-report.docx')).toBeInTheDocument())
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/documents'), expect.objectContaining({ method: 'POST' }))
  })

  it('lets the workspace choose cursor, page, and iterator list facades', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByText('service-contract.pdf')
    await user.click(screen.getByRole('button', { name: '페이지 목록' }))
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/documents/page'), expect.anything()))

    await user.click(screen.getByRole('button', { name: 'Iterator 목록' }))
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/documents/iterator'), expect.anything()))
  })

  it('supports bytes uploads with operation lookup from the upload panel', async () => {
    const user = userEvent.setup()
    let uploadRequest
    globalThis.fetch = vi.fn((url, options = {}) => {
      if (String(url).includes('/health/readiness')) return jsonResponse({ status: 'ok', ok: true })
      if (String(url).includes('/upload-operations/')) return jsonResponse({ state: 'succeeded', idempotency_key: 'operation-1' })
      if (options.method === 'POST') {
        uploadRequest = options
        return jsonResponse({ ...documents[0], document_id: 'doc-bytes', original_filename: 'bytes.txt' }, 201)
      }
      return jsonResponse({ items: documents, next_cursor: null, has_more: false })
    })

    render(<App />)
    const input = await screen.findByLabelText('문서 파일 선택')
    await user.upload(input, new File(['bytes body'], 'bytes.txt', { type: 'text/plain' }))
    await user.selectOptions(screen.getByLabelText('업로드 방식'), 'bytes')
    await user.type(screen.getByLabelText('Idempotency key'), 'operation-1')
    await user.click(screen.getByRole('button', { name: /업로드 시작/i }))

    await waitFor(() => expect(uploadRequest).toBeTruthy())
    expect(JSON.parse(uploadRequest.body)).toMatchObject({ filename: 'bytes.txt', content_type: 'text/plain', idempotency_key: 'operation-1' })
    expect(screen.getByText('작업 조회')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '작업 조회' }))
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/upload-operations/operation-1'), expect.anything()))
  })

  it('loads every binary content variant and keeps verification details visible', async () => {
    const user = userEvent.setup()
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:doc-preview')
    globalThis.URL.revokeObjectURL = vi.fn()
    globalThis.fetch = vi.fn((url) => {
      if (String(url).includes('/health/readiness')) return jsonResponse({ status: 'ok', ok: true })
      if (String(url).includes('/content') || String(url).includes('/chunks') || String(url).includes('/copy')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({
            'content-type': 'text/plain',
            'content-length': '12',
            'content-disposition': 'inline; filename="service-contract.pdf"',
            'x-document-checksum': 'sha256:abc',
            'x-checksum-verified': 'true',
          }),
          blob: () => Promise.resolve(new Blob(['preview body'], { type: 'text/plain' })),
        })
      }
      return jsonResponse({ items: documents, next_cursor: null, has_more: false })
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: /service-contract\.pdf 상세 보기/i }))
    for (const mode of ['inline', 'eager', 'async', 'chunks', 'copy']) {
      await user.click(screen.getByRole('button', { name: `${mode} 콘텐츠 불러오기` }))
      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining(`/documents/doc-contract/${mode === 'inline' ? 'content' : mode === 'eager' ? 'content/eager' : mode === 'async' ? 'content/async' : mode}`), expect.objectContaining({ headers: { Accept: '*/*' } })))
    }

    expect(await screen.findByText('X-Checksum-Verified: true')).toBeInTheDocument()
  })

  it('exposes the operator surface only when explicitly enabled', async () => {
    const user = userEvent.setup()
    render(<App operatorConsoleEnabled />)

    await screen.findByText('service-contract.pdf')
    await user.click(screen.getByRole('button', { name: '운영자 콘솔' }))
    expect(screen.getByRole('heading', { name: '운영자 / 복구' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('운영 문서 ID'), 'doc-contract')
    await user.click(screen.getByRole('button', { name: '내부 metadata 조회' }))

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/management/documents/doc-contract/metadata'), expect.anything()))
  })
})
