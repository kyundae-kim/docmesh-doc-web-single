import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ApiError,
  PROJECT_VERSION,
  deleteDocument,
  downloadDocument,
  getDocument,
  getDocumentContentUrl,
  getLiveness,
  getOpenApiDocument,
  getReadiness,
  getSupportUrl,
  getUploadOperation,
  listDocuments,
  listDocumentsIterator,
  listDocumentsPage,
  readDocumentContent,
  uploadDocument,
  uploadDocumentBytes,
  uploadDocumentFile,
} from './api'
import OperatorConsole from './OperatorConsole'
import './styles.css'

const STATUS_OPTIONS = [
  { value: '', label: '모든 상태' },
  { value: 'available', label: '사용 가능' },
  { value: 'uploaded', label: '업로드됨' },
  { value: 'deleting', label: '삭제 중' },
  { value: 'failed', label: '실패' },
  { value: 'deleted', label: '삭제됨' },
]

const STATUS_LABELS = {
  available: '사용 가능',
  uploaded: '업로드됨',
  deleting: '삭제 중',
  deleted: '삭제됨',
  failed: '실패',
}

const STATUS_TONES = {
  available: 'success',
  uploaded: 'info',
  deleting: 'warning',
  deleted: 'muted',
  failed: 'danger',
}

const LIST_MODES = [
  { value: 'cursor', label: '커서 목록', description: 'opaque cursor' },
  { value: 'page', label: '페이지 목록', description: 'explicit page facade' },
  { value: 'iterator', label: 'Iterator 목록', description: 'materialized items' },
]

const CONTENT_MODES = [
  { value: 'inline', label: 'inline' },
  { value: 'eager', label: 'eager' },
  { value: 'async', label: 'async' },
  { value: 'chunks', label: 'chunks' },
  { value: 'copy', label: 'copy · checksum' },
]

const UPLOAD_MODES = [
  { value: 'stream', label: 'multipart stream' },
  { value: 'file', label: 'multipart file' },
  { value: 'bytes', label: 'base64 JSON bytes' },
]

const ICON_PATHS = {
  search: 'm21 21-4.35-4.35m2.35-5.15a7.5 7.5 0 1 1-15 0Z',
  upload: 'M12 16V4m0 0L7 9m5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4',
  refresh: 'M20 11a8.1 8.1 0 0 0-14.9-3M4 5v4h4m-4 2a8.1 8.1 0 0 0 14.9 3M20 19v-4h-4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  download: 'M12 3v12m0 0 5-5m-5 5-5-5M4 21h16',
  trash: 'M4 7h16m-10 4v6m4-6v6M9 7V4h6v3m4 0-1 14H6L5 7',
  close: 'm6 6 12 12M18 6 6 18',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  file: 'M6 3h8l4 4v14H6zM14 3v5h5M9 13h6M9 17h6',
  image: 'M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM8 9h.01M4 17l4-4 3 3 2-2 5 5',
  check: 'm5 12 4 4L19 6',
  alert: 'M12 3 2.5 20h19zM12 9v4m0 4h.01',
  bolt: 'm13 2-9 11h7l-2 9 9-12h-7z',
  chevron: 'm6 9 6 6 6-6',
  external: 'M14 4h6v6m-1-5-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  shield: 'M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6zM9 12l2 2 4-4',
}

function Icon({ name, size = 18, strokeWidth = 1.8 }) {
  return (
    <svg aria-hidden="true" className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}

function formatBytes(bytes = 0) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function getExtension(filename = '') {
  const extension = filename.split('.').pop()
  return extension && extension !== filename ? extension.slice(0, 5).toUpperCase() : 'FILE'
}

function getFileKind(document) {
  const contentType = document.content_type || ''
  if (contentType.startsWith('image/')) return 'image'
  if (contentType.startsWith('video/')) return 'video'
  if (contentType.startsWith('audio/')) return 'audio'
  if (contentType.includes('pdf')) return 'pdf'
  if (contentType.startsWith('text/')) return 'text'
  return 'file'
}

function getApiMessage(error, fallback = '요청을 처리하지 못했습니다.') {
  if (error instanceof ApiError) return error.message
  return error?.message || fallback
}

function parseMetadata(value) {
  if (!value.trim()) return undefined
  const parsed = JSON.parse(value)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('metadata는 JSON object여야 합니다.')
  return parsed
}

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

function StatusBadge({ status }) {
  return <span className={`status-badge ${STATUS_TONES[status] || 'muted'}`}><span className="status-dot" />{STATUS_LABELS[status] || status || '알 수 없음'}</span>
}

function FileGlyph({ document }) {
  const kind = getFileKind(document)
  return (
    <div className={`file-glyph ${kind}`} aria-hidden="true">
      {kind === 'image' ? <Icon name="image" size={25} /> : <><span>{getExtension(document.original_filename)}</span><Icon name="file" size={29} /></>}
    </div>
  )
}

function DocumentCard({ document, onOpen, onDownload, onDelete }) {
  return (
    <article className="document-card">
      <button className="card-main" type="button" onClick={() => onOpen(document)} aria-label={`${document.original_filename} 상세 보기`}>
        <div className="card-topline"><FileGlyph document={document} /><StatusBadge status={document.status} /></div>
        <div className="card-copy">
          <h3 title={document.original_filename}>{document.original_filename}</h3>
          <p>{document.content_type || '알 수 없는 형식'}</p>
        </div>
        <div className="card-meta"><span>{formatBytes(document.file_size)}</span><span>{formatDate(document.updated_at || document.created_at)}</span></div>
        {document.partition?.partition_id && <span className="partition-chip">partition · {document.partition.partition_id}</span>}
      </button>
      <div className="card-actions">
        <button className="icon-button" type="button" onClick={() => onDownload(document)} aria-label={`${document.original_filename} 다운로드`} title="다운로드"><Icon name="download" size={16} /></button>
        <button className="icon-button danger-hover" type="button" onClick={() => onDelete(document)} aria-label={`${document.original_filename} 삭제`} title="삭제"><Icon name="trash" size={16} /></button>
        <button className="icon-button" type="button" onClick={() => onOpen(document)} aria-label={`${document.original_filename} 메뉴`} title="상세 보기"><Icon name="more" size={18} /></button>
      </div>
    </article>
  )
}

function EmptyState({ hasSearch, onReset }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon name={hasSearch ? 'search' : 'file'} size={26} /></div>
      <h3>{hasSearch ? '검색 결과가 없습니다' : '아직 문서가 없습니다'}</h3>
      <p>{hasSearch ? '다른 이름이나 파일 형식으로 다시 검색해 보세요.' : '첫 문서를 업로드하면 이곳에서 바로 관리할 수 있습니다.'}</p>
      {hasSearch && <button type="button" className="text-button" onClick={onReset}>검색 초기화 <Icon name="arrow" size={15} /></button>}
    </div>
  )
}

function LoadingGrid() {
  return <div className="document-grid" aria-label="문서 불러오는 중">{Array.from({ length: 6 }, (_, index) => <div className="document-card skeleton-card" key={index}><div className="skeleton skeleton-glyph" /><div className="skeleton skeleton-title" /><div className="skeleton skeleton-line" /></div>)}</div>
}

function UploadPanel({
  file,
  onFileChange,
  onUpload,
  isUploading,
  mode,
  onModeChange,
  documentId,
  onDocumentIdChange,
  metadata,
  onMetadataChange,
  createdBy,
  onCreatedByChange,
  checksum,
  onChecksumChange,
  idempotencyKey,
  onIdempotencyKeyChange,
  idempotencyScope,
  onIdempotencyScopeChange,
  operationResult,
  onLookupOperation,
  uploadLocation,
}) {
  const inputRef = useRef(null)
  useEffect(() => {
    if (!file && inputRef.current) inputRef.current.value = ''
  }, [file])

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = ''
    onFileChange(null)
  }

  return (
    <section className={`upload-panel upload-panel-expanded ${file ? 'has-file' : ''}`}>
      <div className="upload-symbol"><Icon name={file ? 'file' : 'upload'} size={22} /></div>
      <div className="upload-copy">
        <strong>{file ? file.name : '새 문서 추가'}</strong>
        <span>{file ? `${formatBytes(file.size)} · ${UPLOAD_MODES.find((item) => item.value === mode)?.label} 준비` : '파일을 끌어 놓거나, 컴퓨터에서 선택하세요'}</span>
      </div>
      <div className="upload-actions upload-actions-main">
        <label className="secondary-button file-picker">
          <input ref={inputRef} type="file" aria-label="문서 파일 선택" onChange={(event) => onFileChange(event.target.files?.[0] || null)} />
          {file ? '파일 변경' : '파일 선택'}
        </label>
        {file && <button type="button" className="secondary-button clear-file" onClick={resetInput}>취소</button>}
        <button type="button" className="primary-button" onClick={onUpload} disabled={!file || isUploading}>{isUploading ? <><span className="button-spinner" />업로드 중</> : <><Icon name="upload" size={16} />업로드 시작</>}</button>
      </div>
      <div className="upload-form-grid">
        <label className="form-field"><span>업로드 방식</span><select aria-label="업로드 방식" value={mode} onChange={(event) => onModeChange(event.target.value)}>{UPLOAD_MODES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="form-field"><span>document_id (선택)</span><input value={documentId} onChange={(event) => onDocumentIdChange(event.target.value)} placeholder="DMS가 ID를 발급하도록 비워둘 수 있습니다" /></label>
        <label className="form-field"><span>created_by (선택)</span><input value={createdBy} onChange={(event) => onCreatedByChange(event.target.value)} placeholder="작성자" /></label>
        <label className="form-field form-field-wide"><span>metadata JSON object (선택)</span><input value={metadata} onChange={(event) => onMetadataChange(event.target.value)} placeholder='{"source":"web"}' /></label>
        {mode === 'bytes' && <>
          <label className="form-field"><span>checksum (선택)</span><input value={checksum} onChange={(event) => onChecksumChange(event.target.value)} placeholder="sha256:..." /></label>
          <label className="form-field"><span>Idempotency key</span><input aria-label="Idempotency key" value={idempotencyKey} onChange={(event) => onIdempotencyKeyChange(event.target.value)} placeholder="재시도 키" /></label>
          <label className="form-field"><span>idempotency scope (선택)</span><input value={idempotencyScope} onChange={(event) => onIdempotencyScopeChange(event.target.value)} placeholder="기본: application identity" /></label>
        </>}
      </div>
      {idempotencyKey.trim() && <div className="operation-lookup">
        <div><strong>Upload operation</strong><span>같은 scope와 key의 처리 상태를 조회합니다.</span></div>
        <button type="button" className="secondary-button" onClick={onLookupOperation}>작업 조회</button>
        {operationResult && <code>{JSON.stringify(operationResult)}</code>}
      </div>}
      {uploadLocation && <div className="upload-location" role="status"><span>Location</span><code>{uploadLocation}</code></div>}
    </section>
  )
}

function ContentPreview({ document, onClose, onDownload, onDelete, onRefreshMetadata }) {
  const [loaded, setLoaded] = useState(null)
  const [isReading, setIsReading] = useState(false)
  const [readError, setReadError] = useState('')
  const [chunkSize, setChunkSize] = useState('65536')
  const [verifyChecksum, setVerifyChecksum] = useState(true)
  const objectUrlRef = useRef('')
  const kind = getFileKind(document)
  const inlineUrl = getDocumentContentUrl(document.document_id, { mode: 'inline' })

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
  }, [])

  const loadVariant = async (mode) => {
    setIsReading(true)
    setReadError('')
    try {
      const result = await readDocumentContent(document.document_id, {
        mode,
        chunkSize: Number(chunkSize),
        verifyChecksum,
      })
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      const nextUrl = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(result.blob) : ''
      objectUrlRef.current = nextUrl
      setLoaded({ mode, url: nextUrl || getDocumentContentUrl(document.document_id, { mode, chunkSize: Number(chunkSize), verifyChecksum }), ...result })
    } catch (error) {
      setReadError(getApiMessage(error, '콘텐츠를 읽지 못했습니다.'))
    } finally {
      setIsReading(false)
    }
  }

  const sourceUrl = loaded?.url || inlineUrl
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="preview-modal preview-modal-v2" role="dialog" aria-modal="true" aria-label={document.original_filename}>
        <header className="modal-header">
          <div><span className="modal-eyebrow">문서 상세</span><span className="modal-version">v{PROJECT_VERSION}</span><h2>{document.original_filename}</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="상세 보기 닫기"><Icon name="close" size={19} /></button>
        </header>
        <div className="content-mode-toolbar">
          <div><strong>콘텐츠 읽기 방식</strong><span>각 공개 binary route를 같은 문서로 확인합니다.</span></div>
          <div className="content-mode-buttons">{CONTENT_MODES.map((item) => <button key={item.value} type="button" className={`variant-button ${loaded?.mode === item.value ? 'active' : ''}`} onClick={() => loadVariant(item.value)} disabled={isReading} aria-label={`${item.value} 콘텐츠 불러오기`}>{item.label}</button>)}</div>
          <label className="compact-field"><span>chunk size</span><input type="number" min="1" max="8388608" value={chunkSize} onChange={(event) => setChunkSize(event.target.value)} /></label>
          <label className="check-field compact-check"><input type="checkbox" checked={verifyChecksum} onChange={(event) => setVerifyChecksum(event.target.checked)} /><span>copy checksum 검증</span></label>
        </div>
        <div className="preview-layout">
          <div className="preview-canvas">
            {kind === 'image' && <img src={sourceUrl} alt={`${document.original_filename} 미리보기`} />}
            {kind === 'video' && <video src={sourceUrl} controls aria-label={`${document.original_filename} 미리보기`} />}
            {kind === 'audio' && <audio src={sourceUrl} controls aria-label={`${document.original_filename} 미리보기`} />}
            {(kind === 'pdf' || kind === 'text') && <iframe title={`${document.original_filename} 미리보기`} src={sourceUrl} />}
            {kind === 'file' && <div className="generic-preview"><FileGlyph document={document} /><strong>이 파일 형식은 브라우저 미리보기를 지원하지 않습니다.</strong><button type="button" className="secondary-button" onClick={() => onDownload(document)}><Icon name="download" size={16} />파일 다운로드</button></div>}
            {isReading && <span className="preview-loading"><span className="button-spinner" />콘텐츠 읽는 중…</span>}
            {readError && <span className="preview-error" role="alert">{readError}</span>}
          </div>
          <aside className="preview-details">
            <div className="detail-status"><span>현재 상태</span><StatusBadge status={document.status} /></div>
            <dl>
              <div><dt>파일 형식</dt><dd>{document.content_type || '—'}</dd></div>
              <div><dt>파일 크기</dt><dd>{formatBytes(document.file_size)}</dd></div>
              <div><dt>partition</dt><dd>{document.partition?.partition_id || '—'}</dd></div>
              <div><dt>생성일</dt><dd>{formatDate(document.created_at)}</dd></div>
              <div><dt>수정일</dt><dd>{formatDate(document.updated_at)}</dd></div>
              <div><dt>문서 ID</dt><dd className="mono" title={document.document_id}>{document.document_id}</dd></div>
              {document.checksum && <div><dt>Checksum</dt><dd className="mono" title={document.checksum}>{document.checksum}</dd></div>}
            </dl>
            {loaded && <div className="binary-headers" aria-label="binary response headers">
              <strong>응답 headers · {loaded.mode}</strong>
              {loaded.contentType && <span>Content-Type: {loaded.contentType}</span>}
              {loaded.contentLength && <span>Content-Length: {loaded.contentLength}</span>}
              {loaded.contentDisposition && <span>Content-Disposition: {loaded.contentDisposition}</span>}
              {loaded.checksum && <span>X-Document-Checksum: {loaded.checksum}</span>}
              <span>X-Checksum-Verified: {loaded.checksumVerified || '—'}</span>
            </div>}
            <div className="modal-actions modal-actions-stacked">
              <button type="button" className="secondary-button" onClick={() => onRefreshMetadata(document)}><Icon name="refresh" size={16} />metadata 새로 조회</button>
              <div className="button-row"><button type="button" className="secondary-button" onClick={() => onDownload(document)}><Icon name="download" size={16} />다운로드</button><button type="button" className="danger-button" onClick={() => onDelete(document)}><Icon name="trash" size={16} />삭제</button></div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}

function DeleteDialog({ document, onClose, onConfirm, isDeleting }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <div className="confirm-icon"><Icon name="trash" size={21} /></div>
        <span className="modal-eyebrow">문서 삭제</span>
        <h2 id="delete-title">{document.original_filename}</h2>
        <p>문서를 일반 목록에서 숨기고 보관 처리합니다. 운영자 환경의 영구 삭제는 이 화면에서 제공하지 않습니다.</p>
        <div className="delete-options">
          <button type="button" className="delete-option" onClick={onConfirm} disabled={isDeleting}><span><strong>보관 처리</strong><small>목록에서 숨기고 parameterized soft delete를 수행합니다.</small></span><Icon name="arrow" size={17} /></button>
          <p className="operator-note">hard delete와 recovery는 운영자 콘솔에서 외부 승인을 거쳐 실행합니다.</p>
        </div>
        <button type="button" className="text-button cancel-button" onClick={onClose} disabled={isDeleting}>취소</button>
      </section>
    </div>
  )
}

function Toast({ toast, onClose }) {
  if (!toast) return null
  return <div className={`toast ${toast.type || 'success'}`} role="status"><Icon name={toast.type === 'error' ? 'alert' : 'check'} size={17} /><span>{toast.message}</span><button type="button" onClick={onClose} aria-label="알림 닫기"><Icon name="close" size={15} /></button></div>
}

function ServiceStatus({ readiness, liveness }) {
  return <div className="service-status-group" role="status" aria-label="DocMesh 서비스 상태">
    <div className={`service-status ${readiness.state}`} role="status" aria-label="DocMesh readiness"><span className="service-status-dot" />readiness · {readiness.message}</div>
    <div className={`service-status ${liveness.state}`} role="status" aria-label="DocMesh liveness"><span className="service-status-dot" />liveness · {liveness.message}</div>
  </div>
}

function SupportPanel({ onLoadOpenApi, openApiSummary }) {
  return (
    <section className="support-panel" aria-labelledby="support-title">
      <div className="support-copy"><span className="section-kicker">APPLICATION SURFACE</span><h2 id="support-title">문서와 진단</h2><p>DocMesh의 generated OpenAPI와 지원 UI를 같은 BFF origin에서 엽니다.</p></div>
      <div className="support-links">
        <a className="support-link" href={getSupportUrl('/docs')} target="_blank" rel="noreferrer"><span>Swagger UI</span><Icon name="external" size={14} /></a>
        <a className="support-link" href={getSupportUrl('/docs/oauth2-redirect')} target="_blank" rel="noreferrer"><span>OAuth redirect support</span><Icon name="external" size={14} /></a>
        <a className="support-link" href={getSupportUrl('/redoc')} target="_blank" rel="noreferrer"><span>ReDoc</span><Icon name="external" size={14} /></a>
        <button type="button" className="support-link" onClick={onLoadOpenApi}><span>OpenAPI JSON 확인</span><Icon name="arrow" size={14} /></button>
      </div>
      {openApiSummary && <pre className="openapi-summary">{JSON.stringify(openApiSummary, null, 2)}</pre>}
    </section>
  )
}

export default function DocumentWorkspace({ operatorConsoleEnabled = import.meta.env.VITE_ENABLE_OPERATOR_CONSOLE === 'true' }) {
  const [activeView, setActiveView] = useState('documents')
  const [documents, setDocuments] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [listMode, setListMode] = useState('cursor')
  const [readiness, setReadiness] = useState({ state: 'checking', message: '확인 중' })
  const [liveness, setLiveness] = useState({ state: 'checking', message: '확인 중' })
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [downloadId, setDownloadId] = useState(null)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadMode, setUploadMode] = useState('stream')
  const [uploadDocumentId, setUploadDocumentId] = useState('')
  const [uploadMetadata, setUploadMetadata] = useState('')
  const [uploadCreatedBy, setUploadCreatedBy] = useState('')
  const [uploadChecksum, setUploadChecksum] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [idempotencyScope, setIdempotencyScope] = useState('')
  const [operationResult, setOperationResult] = useState(null)
  const [uploadLocation, setUploadLocation] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [toast, setToast] = useState(null)
  const [openApiSummary, setOpenApiSummary] = useState(null)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 4500)
  }, [])

  const loadDocuments = useCallback(async ({ append = false, cursor = '' } = {}) => {
    if (append) setIsRefreshing(true)
    else setIsLoading(true)
    setLoadError(null)
    try {
      let payload
      if (listMode === 'page') payload = await listDocumentsPage({ cursor, status: statusFilter, limit: 100 })
      else if (listMode === 'iterator') payload = await listDocumentsIterator({ pageSize: 100, status: statusFilter })
      else payload = await listDocuments({ cursor, status: statusFilter, limit: 100 })
      const items = Array.isArray(payload?.items) ? payload.items : []
      setDocuments((current) => append && listMode !== 'iterator' ? [...current, ...items] : items)
      setNextCursor(listMode === 'iterator' ? null : payload?.next_cursor || null)
      setHasMore(listMode === 'iterator' ? false : Boolean(payload?.has_more))
    } catch (error) {
      setLoadError(getApiMessage(error, '문서 목록을 불러오지 못했습니다.'))
      if (!append) setDocuments([])
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [listMode, statusFilter])

  useEffect(() => {
    setNextCursor(null)
    setHasMore(false)
    loadDocuments()
  }, [loadDocuments])

  const refreshHealth = useCallback(() => {
    getReadiness().then((payload) => {
      const ready = payload?.ok !== false && payload?.status !== 'error'
      setReadiness({ state: ready ? 'ready' : 'error', message: ready ? '서비스 정상' : '서비스 점검 필요' })
    }).catch(() => setReadiness({ state: 'error', message: '연결 오류' }))
    getLiveness().then((payload) => {
      const alive = payload?.status !== 'error'
      setLiveness({ state: alive ? 'ready' : 'error', message: alive ? '수신 가능' : '중단됨' })
    }).catch(() => setLiveness({ state: 'error', message: '연결 오류' }))
  }, [])

  useEffect(() => {
    refreshHealth()
  }, [refreshHealth])

  const visibleDocuments = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return documents
    return documents.filter((document) => [document.original_filename, document.content_type, document.document_id].some((value) => String(value || '').toLowerCase().includes(query)))
  }, [documents, search])

  const availableCount = documents.filter((document) => document.status === 'available').length
  const totalSize = documents.reduce((sum, document) => sum + (Number(document.file_size) || 0), 0)

  const handleUpload = async () => {
    if (!uploadFile) return
    setIsUploading(true)
    try {
      const metadata = parseMetadata(uploadMetadata)
      let uploadResult
      if (uploadMode === 'bytes') {
        uploadResult = await uploadDocumentBytes({
          contentBase64: await fileToBase64(uploadFile),
          filename: uploadFile.name,
          contentType: uploadFile.type || 'application/octet-stream',
          documentId: uploadDocumentId,
          metadata,
          createdBy: uploadCreatedBy,
          checksum: uploadChecksum,
          idempotencyKey,
          idempotencyScope,
        })
      } else if (uploadMode === 'file') {
        uploadResult = await uploadDocumentFile(uploadFile, uploadDocumentId, { metadata, createdBy: uploadCreatedBy })
      } else {
        uploadResult = await uploadDocument(uploadFile, uploadDocumentId, { metadata, createdBy: uploadCreatedBy })
      }
      setUploadLocation(uploadResult?.location || '')
      setUploadFile(null)
      showToast(`${UPLOAD_MODES.find((item) => item.value === uploadMode)?.label} 방식으로 업로드했습니다.`)
      await loadDocuments()
    } catch (error) {
      showToast(getApiMessage(error, '문서 업로드에 실패했습니다.'), 'error')
    } finally {
      setIsUploading(false)
    }
  }

  const handleLookupOperation = async () => {
    try {
      setOperationResult(await getUploadOperation(idempotencyKey, idempotencyScope))
    } catch (error) {
      showToast(getApiMessage(error, 'upload operation 조회에 실패했습니다.'), 'error')
    }
  }

  const handleDownload = async (document) => {
    setDownloadId(document.document_id)
    try {
      const result = await downloadDocument(document.document_id, document.original_filename, { chunkSize: 65536 })
      showToast(`다운로드를 시작했습니다${result.checksumVerified ? ` · checksum ${result.checksumVerified}` : ''}.`)
    } catch (error) {
      showToast(getApiMessage(error, '문서 다운로드에 실패했습니다.'), 'error')
    } finally {
      setDownloadId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteDocument(deleteTarget.document_id, false)
      setDocuments((current) => current.filter((document) => document.document_id !== deleteTarget.document_id))
      if (selectedDocument?.document_id === deleteTarget.document_id) setSelectedDocument(null)
      setDeleteTarget(null)
      showToast('문서를 보관 처리했습니다.')
    } catch (error) {
      showToast(getApiMessage(error, '문서 삭제에 실패했습니다.'), 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleRefreshMetadata = async (document) => {
    try {
      const refreshed = await getDocument(document.document_id)
      if (refreshed && !Array.isArray(refreshed.items)) {
        setSelectedDocument((current) => current?.document_id === document.document_id ? { ...current, ...refreshed } : current)
        setDocuments((current) => current.map((item) => item.document_id === document.document_id ? { ...item, ...refreshed } : item))
      }
      showToast('public metadata를 새로 조회했습니다.')
    } catch (error) {
      showToast(getApiMessage(error, 'metadata 조회에 실패했습니다.'), 'error')
    }
  }

  const handleOpenApi = async () => {
    try {
      const document = await getOpenApiDocument()
      setOpenApiSummary({ version: document?.info?.version || 'unknown', title: document?.info?.title || 'DocMesh', pathCount: Object.keys(document?.paths || {}).length })
    } catch (error) {
      showToast(getApiMessage(error, 'OpenAPI 문서를 조회하지 못했습니다.'), 'error')
    }
  }

  const openDelete = (document) => {
    setSelectedDocument(null)
    setDeleteTarget(document)
  }

  return (
    <div className="app-shell">
      <main className="main-content" id="documents">
        <header className="page-header">
          <div className="page-header-main"><div className="service-icon" role="img" aria-label="DocMesh 서비스"><span /></div><div><span className="section-kicker">DOCUMENT SERVICE · v{PROJECT_VERSION}</span><h1>Document library</h1><p>문서 lifecycle과 운영 경계를 한곳에서 확인하세요.</p></div></div>
          <div className="page-header-actions"><ServiceStatus readiness={readiness} liveness={liveness} /><button type="button" className="refresh-button" onClick={() => { loadDocuments(); refreshHealth() }} disabled={isLoading || isRefreshing}><Icon name="refresh" size={16} />{isRefreshing ? '새로 고치는 중' : '새로 고침'}</button></div>
        </header>

        <nav className="workspace-nav" aria-label="workspace navigation">
          <button type="button" className={activeView === 'documents' ? 'active' : ''} onClick={() => setActiveView('documents')}><Icon name="file" size={15} />문서 workspace</button>
          <button type="button" className={`${activeView === 'operator' ? 'active' : ''} ${!operatorConsoleEnabled ? 'locked' : ''}`} onClick={() => operatorConsoleEnabled && setActiveView('operator')} disabled={!operatorConsoleEnabled} title={operatorConsoleEnabled ? '외부 operator authorization이 필요합니다' : 'VITE_ENABLE_OPERATOR_CONSOLE=true로 활성화'}><Icon name={operatorConsoleEnabled ? 'shield' : 'shield'} size={15} />운영자 콘솔 {!operatorConsoleEnabled && <span>잠김</span>}</button>
        </nav>

        {activeView === 'operator' && operatorConsoleEnabled ? <OperatorConsole documents={documents} onNotify={showToast} /> : <>
          <div className="stats-row"><div className="stat-card accent"><span className="stat-label">전체 문서</span><strong>{documents.length}</strong><span className="stat-foot"><Icon name="file" size={13} /> {documents.length === 1 ? '1 document' : `${documents.length} documents`}</span></div><div className="stat-card"><span className="stat-label">사용 가능</span><strong>{availableCount}</strong><span className="stat-foot"><span className="mini-dot green" /> 정상 상태</span></div><div className="stat-card"><span className="stat-label">저장 용량</span><strong>{formatBytes(totalSize)}</strong><span className="stat-foot">현재 문서 기준</span></div><div className="stat-card stat-hint"><div className="hint-icon"><Icon name="bolt" size={17} /></div><div><strong>v0.7 public surface</strong><span>upload · content · recovery</span></div></div></div>

          <UploadPanel file={uploadFile} onFileChange={setUploadFile} onUpload={handleUpload} isUploading={isUploading} mode={uploadMode} onModeChange={setUploadMode} documentId={uploadDocumentId} onDocumentIdChange={setUploadDocumentId} metadata={uploadMetadata} onMetadataChange={setUploadMetadata} createdBy={uploadCreatedBy} onCreatedByChange={setUploadCreatedBy} checksum={uploadChecksum} onChecksumChange={setUploadChecksum} idempotencyKey={idempotencyKey} onIdempotencyKeyChange={setIdempotencyKey} idempotencyScope={idempotencyScope} onIdempotencyScopeChange={setIdempotencyScope} operationResult={operationResult} onLookupOperation={handleLookupOperation} uploadLocation={uploadLocation} />

          <section className="library-section"><div className="section-heading"><div><span className="section-kicker">PUBLIC DOCUMENT API</span><h2>내 문서</h2><span>{visibleDocuments.length}개의 문서가 표시되고 있습니다 · {LIST_MODES.find((item) => item.value === listMode)?.description}</span></div><div className="library-controls"><label className="search-field"><Icon name="search" size={17} /><input type="search" aria-label="문서 검색" placeholder="문서 이름, 형식 검색" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="filter-select"><select aria-label="문서 상태 필터" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><Icon name="chevron" size={14} /></label></div></div>
            <div className="list-mode-tabs" role="tablist" aria-label="문서 목록 API 방식">{LIST_MODES.map((item) => <button key={item.value} type="button" aria-selected={listMode === item.value} className={listMode === item.value ? 'active' : ''} onClick={() => setListMode(item.value)}>{item.label}</button>)}</div>
            {loadError && <div className="error-banner" role="alert"><Icon name="alert" size={18} /><div><strong>문서를 불러오지 못했습니다.</strong><span>{loadError}</span></div><button type="button" className="text-button" onClick={() => loadDocuments()}>다시 시도</button></div>}
            {isLoading ? <LoadingGrid /> : visibleDocuments.length === 0 ? <EmptyState hasSearch={Boolean(search || statusFilter)} onReset={() => { setSearch(''); setStatusFilter('') }} /> : <div className="document-grid">{visibleDocuments.map((document) => <DocumentCard key={document.document_id} document={document} onOpen={setSelectedDocument} onDownload={handleDownload} onDelete={openDelete} />)}</div>}
            {!isLoading && hasMore && !search && <button type="button" className="load-more" onClick={() => loadDocuments({ append: true, cursor: nextCursor })} disabled={isRefreshing}>{isRefreshing ? '불러오는 중…' : '더 많은 문서 보기'}<Icon name="chevron" size={15} /></button>}
          </section>
          <SupportPanel onLoadOpenApi={handleOpenApi} openApiSummary={openApiSummary} />
        </>}
      </main>
      {selectedDocument && <ContentPreview document={selectedDocument} onClose={() => setSelectedDocument(null)} onDownload={handleDownload} onDelete={openDelete} onRefreshMetadata={handleRefreshMetadata} />}
      {deleteTarget && <DeleteDialog document={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} isDeleting={isDeleting} />}
      {downloadId && <div className="download-progress" role="status"><span className="button-spinner" />{documents.find((document) => document.document_id === downloadId)?.original_filename || '문서'} 다운로드 준비 중</div>}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
