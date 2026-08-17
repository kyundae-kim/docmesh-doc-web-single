const DEFAULT_API_BASE_URL = 'http://docmesh-doc:8000'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '/api' : DEFAULT_API_BASE_URL)).replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN_ERROR', correlationId = '' } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.correlationId = correlationId
  }
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  if (response.status === 204) return null
  if (contentType.includes('application/json')) {
    return response.json()
  }
  return null
}

export async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`
  let response

  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  }
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  try {
    response = await fetch(url, {
      ...options,
      headers,
    })
  } catch (error) {
    throw new ApiError('DocMesh 서비스에 연결할 수 없습니다.', { code: 'NETWORK_ERROR' })
  }

  const correlationId = response.headers.get('X-Correlation-ID') || ''
  const payload = await parseResponse(response)

  if (!response.ok) {
    const error = payload?.error
    throw new ApiError(error?.message || `요청을 처리하지 못했습니다. (${response.status})`, {
      status: response.status,
      code: error?.code || 'REQUEST_FAILED',
      correlationId: error?.correlation_id || correlationId,
    })
  }

  return payload
}

export function listDocuments({ cursor = '', limit = 100, status = '' } = {}) {
  const query = new URLSearchParams({ limit: String(limit) })
  if (cursor) query.set('cursor', cursor)
  if (status) query.set('status', status)
  return request(`/documents?${query.toString()}`)
}

export function uploadDocument(file, documentId = '') {
  const formData = new FormData()
  formData.append('file', file)
  if (documentId.trim()) formData.append('document_id', documentId.trim())
  return request('/documents', { method: 'POST', body: formData })
}

export function getDocument(documentId) {
  return request(`/documents/${encodeURIComponent(documentId)}`)
}

export function getDocumentContentUrl(documentId) {
  return `${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/content`
}

export async function downloadDocument(documentId, filename) {
  const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/download`, {
    headers: { Accept: '*/*' },
  })

  if (!response.ok) {
    let payload = null
    try {
      payload = await response.json()
    } catch {
      // Keep the public error contract even when a proxy returns non-JSON.
    }
    const error = payload?.error
    throw new ApiError(error?.message || '문서를 다운로드하지 못했습니다.', {
      status: response.status,
      code: error?.code || 'DOWNLOAD_FAILED',
      correlationId: error?.correlation_id || response.headers.get('X-Correlation-ID') || '',
    })
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename || 'document'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

export function deleteDocument(documentId, hard = false) {
  return request(`/documents/${encodeURIComponent(documentId)}?hard=${String(hard)}`, {
    method: 'DELETE',
  })
}

export function getReadiness() {
  return request('/health/readiness')
}
