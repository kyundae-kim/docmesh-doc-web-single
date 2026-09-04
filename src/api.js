const DEFAULT_API_BASE_URL = '/api'

export const PROJECT_VERSION = '0.7.0'
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, {
    status = 0,
    code = 'UNKNOWN_ERROR',
    correlationId = '',
    category = '',
    retryable = undefined,
    documentId = '',
  } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.correlationId = correlationId
    this.category = category
    this.retryable = retryable
    this.documentId = documentId
  }
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  if (response.status === 204) return null
  if (contentType.includes('json')) {
    try {
      return await response.json()
    } catch {
      return null
    }
  }
  return null
}

function queryString(entries) {
  const query = new URLSearchParams()
  Object.entries(entries).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) query.set(key, String(value))
  })
  const serialized = query.toString()
  return serialized ? `?${serialized}` : ''
}

function documentPath(documentId, suffix = '') {
  return `/documents/${encodeURIComponent(documentId)}${suffix}`
}

function uploadForm(file, { documentId = '', metadata, createdBy = '' } = {}) {
  const formData = new FormData()
  formData.append('file', file)
  if (String(documentId).trim()) formData.append('document_id', String(documentId).trim())
  if (metadata !== undefined && metadata !== null) formData.append('metadata', JSON.stringify(metadata))
  if (String(createdBy).trim()) formData.append('created_by', String(createdBy).trim())
  return formData
}

async function performRequest(path, options = {}) {
  const url = `${API_BASE_URL}${path}`
  let response

  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  }
  const hasContentType = Object.keys(headers).some((header) => header.toLowerCase() === 'content-type')
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  if (options.body && !isFormData && !hasContentType) {
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
      category: error?.category || '',
      retryable: error?.retryable,
      documentId: error?.document_id || '',
    })
  }

  return { payload, response }
}

export async function request(path, options = {}) {
  const { payload } = await performRequest(path, options)
  return payload
}

async function requestWithMeta(path, options = {}) {
  return performRequest(path, options)
}

function enrichUploadPayload({ payload, response }) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload
  return {
    ...payload,
    location: response.headers.get('Location') || '',
    correlationId: response.headers.get('X-Correlation-ID') || '',
  }
}

function listDocumentsFrom(path, { cursor = '', limit = 100, status = '' } = {}) {
  return request(`${path}${queryString({ cursor, limit, status })}`)
}

export function listDocuments(options = {}) {
  return listDocumentsFrom('/documents', options)
}

export function listDocumentsPage(options = {}) {
  return listDocumentsFrom('/documents/page', options)
}

export function listDocumentsIterator({ pageSize = 100, status = '' } = {}) {
  return request(`/documents/iterator${queryString({ page_size: pageSize, status })}`)
}

export async function uploadDocument(file, documentId = '', options = {}) {
  return enrichUploadPayload(await requestWithMeta('/documents', { method: 'POST', body: uploadForm(file, { ...options, documentId }) }))
}

export async function uploadDocumentFile(file, documentId = '', options = {}) {
  return enrichUploadPayload(await requestWithMeta('/documents/file', { method: 'POST', body: uploadForm(file, { ...options, documentId }) }))
}

export const uploadFileDocument = uploadDocumentFile

export function uploadDocumentBytes({
  contentBase64,
  filename,
  contentType,
  documentId,
  metadata,
  createdBy,
  checksum,
  idempotencyKey,
  idempotencyScope,
} = {}) {
  const body = {
    content_base64: contentBase64,
    filename,
    content_type: contentType,
  }
  const optionalFields = {
    document_id: documentId,
    metadata,
    created_by: createdBy,
    checksum,
    idempotency_key: idempotencyKey,
    idempotency_scope: idempotencyScope,
  }
  Object.entries(optionalFields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') body[key] = value
  })
  return requestWithMeta('/documents/bytes', { method: 'POST', body: JSON.stringify(body) }).then(enrichUploadPayload)
}

export const uploadBytesDocument = uploadDocumentBytes

export function getDocument(documentId) {
  return request(documentPath(documentId))
}

export function getDocumentContentUrl(documentId, { mode = 'inline', chunkSize, verifyChecksum } = {}) {
  const suffixes = {
    inline: '/content',
    eager: '/content/eager',
    async: '/content/async',
    chunks: '/chunks',
    copy: '/copy',
    download: '/download',
  }
  if (!suffixes[mode]) throw new RangeError(`Unsupported document content mode: ${mode}`)
  return `${API_BASE_URL}${documentPath(documentId, suffixes[mode])}${queryString({
    chunk_size: ['download', 'async', 'chunks', 'copy'].includes(mode) ? chunkSize : undefined,
    verify_checksum: mode === 'copy' ? verifyChecksum ?? true : undefined,
  })}`
}

function parseFilename(contentDisposition) {
  if (!contentDisposition) return ''
  const encoded = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) {
    try {
      return decodeURIComponent(encoded)
    } catch {
      return encoded
    }
  }
  return contentDisposition.match(/filename="?([^";]+)"?/i)?.[1] || ''
}

async function getBinary(documentId, options = {}) {
  let response
  try {
    response = await fetch(getDocumentContentUrl(documentId, options), {
      headers: { Accept: '*/*' },
    })
  } catch {
    throw new ApiError('DocMesh 서비스에 연결할 수 없습니다.', { code: 'NETWORK_ERROR' })
  }

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

  return response
}

function binaryResponseHeaders(response) {
  return {
    contentType: response.headers.get('content-type') || '',
    contentLength: response.headers.get('content-length') || '',
    contentDisposition: response.headers.get('content-disposition') || '',
    checksum: response.headers.get('X-Document-Checksum') || '',
    checksumVerified: response.headers.get('X-Checksum-Verified') || '',
    correlationId: response.headers.get('X-Correlation-ID') || '',
  }
}

export async function readDocumentContent(documentId, options = {}) {
  const response = await getBinary(documentId, options)
  return {
    blob: await response.blob(),
    ...binaryResponseHeaders(response),
  }
}

export async function downloadDocument(documentId, filename, options = {}) {
  const response = await getBinary(documentId, { ...options, mode: 'download' })

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  const resolvedFilename = filename || parseFilename(response.headers.get('content-disposition')) || 'document'
  link.download = resolvedFilename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
  return {
    filename: resolvedFilename,
    ...binaryResponseHeaders(response),
  }
}

export function deleteDocument(documentId, hard = false) {
  return request(`${documentPath(documentId)}${queryString({ hard })}`, {
    method: 'DELETE',
  })
}

export function deleteDocumentSoft(documentId) {
  return request(`${documentPath(documentId)}/soft`, { method: 'DELETE' })
}

export function deleteDocumentHard(documentId) {
  return request(`${documentPath(documentId)}/hard`, { method: 'DELETE' })
}

export function getUploadOperation(idempotencyKey, scope = '') {
  return request(`/upload-operations/${encodeURIComponent(idempotencyKey)}${queryString({ scope })}`)
}

export function getManagementMetadata(documentId) {
  return request(`/management/documents/${encodeURIComponent(documentId)}/metadata`)
}

export function getDocumentInspection(documentId) {
  return request(`/management/documents/${encodeURIComponent(documentId)}/inspection`)
}

export function listRecoveryCandidates({ status = '', offset = 0, limit = 100 } = {}) {
  return request(`/management/recovery-candidates${queryString({ status, offset, limit })}`)
}

export function getRecoveryCandidateIterator({ status = '', pageSize = 100 } = {}) {
  return request(`/management/recovery-candidates/iterator${queryString({ status, page_size: pageSize })}`)
}

export function reconcileDocument(documentId, {
  action,
  storageKey,
  dryRun = false,
  actor,
} = {}) {
  const body = { action, dry_run: Boolean(dryRun) }
  if (storageKey !== undefined && storageKey !== '') body.storage_key = storageKey
  if (actor !== undefined && actor !== '') body.actor = actor
  return request(`/management/documents/${encodeURIComponent(documentId)}/reconciliations`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function reconcileDocuments({
  status,
  action,
  offset = 0,
  limit = 100,
  dryRun = false,
  actor,
} = {}) {
  const body = {
    status,
    action,
    offset,
    limit,
    dry_run: Boolean(dryRun),
  }
  if (actor !== undefined && actor !== '') body.actor = actor
  return request('/management/reconciliations', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function executeReconciliationPlan({ status, action, items = [], actor } = {}) {
  const body = {
    status,
    action,
    items: items.map((item) => {
      const mapped = {
        document_id: item.documentId ?? item.document_id,
        action: item.action,
      }
      const storageKey = item.storageKey ?? item.storage_key
      if (storageKey !== undefined && storageKey !== '') mapped.storage_key = storageKey
      return mapped
    }),
  }
  if (actor !== undefined && actor !== '') body.actor = actor
  return request('/management/reconciliation-plans/executions', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function clearAllData() {
  return request('/management/data', { method: 'DELETE' })
}

export function initializeData() {
  return request('/management/data/initializations', { method: 'POST' })
}

export function clearPartitionData() {
  return request('/management/data/partition', { method: 'DELETE' })
}

export function initializePartitionData() {
  return request('/management/data/partition/initializations', { method: 'POST' })
}

export const getInternalDocumentMetadata = getManagementMetadata
export const inspectDocument = getDocumentInspection
export const getRecoveryCandidates = listRecoveryCandidates
export const getRecoveryCandidatesIterator = getRecoveryCandidateIterator

export function getReadiness() {
  return request('/health/readiness')
}

export function getLiveness() {
  return request('/health/liveness')
}

export function getOpenApiDocument() {
  return request('/openapi.json')
}

export function getSupportUrl(pathname) {
  const path = String(pathname || '').startsWith('/') ? pathname : `/${pathname}`
  return `${API_BASE_URL}${path}`
}
