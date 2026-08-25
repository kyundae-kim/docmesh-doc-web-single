import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ApiError,
  deleteDocument,
  downloadDocument,
  getDocumentContentUrl,
  listDocuments,
  uploadDocument,
} from './api'
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

function UploadPanel({ file, onFileChange, onUpload, isUploading }) {
  const inputRef = useRef(null)
  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = ''
    onFileChange(null)
  }

  return (
    <section className={`upload-panel ${file ? 'has-file' : ''}`}>
      <div className="upload-symbol"><Icon name={file ? 'file' : 'upload'} size={22} /></div>
      <div className="upload-copy">
        <strong>{file ? file.name : '새 문서 추가'}</strong>
        <span>{file ? `${formatBytes(file.size)} · 업로드할 준비가 되었습니다` : '파일을 끌어 놓거나, 컴퓨터에서 선택하세요'}</span>
      </div>
      <div className="upload-actions">
        <label className="secondary-button file-picker">
          <input ref={inputRef} type="file" aria-label="문서 파일 선택" onChange={(event) => onFileChange(event.target.files?.[0] || null)} />
          {file ? '파일 변경' : '파일 선택'}
        </label>
        {file && <button type="button" className="secondary-button clear-file" onClick={resetInput}>취소</button>}
        <button type="button" className="primary-button" onClick={onUpload} disabled={!file || isUploading}>{isUploading ? <><span className="button-spinner" />업로드 중</> : <><Icon name="upload" size={16} />업로드 시작</>}</button>
      </div>
    </section>
  )
}

function DocumentPreview({ document, onClose, onDownload, onDelete }) {
  const kind = getFileKind(document)
  const contentUrl = getDocumentContentUrl(document.document_id)

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="preview-modal" role="dialog" aria-modal="true" aria-label={document.original_filename}>
        <header className="modal-header">
          <div><span className="modal-eyebrow">문서 상세</span><h2>{document.original_filename}</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="상세 보기 닫기"><Icon name="close" size={19} /></button>
        </header>
        <div className="preview-layout">
          <div className="preview-canvas">
            {kind === 'image' && <img src={contentUrl} alt={`${document.original_filename} 미리보기`} />}
            {kind === 'video' && <video src={contentUrl} controls aria-label={`${document.original_filename} 미리보기`} />}
            {kind === 'audio' && <audio src={contentUrl} controls aria-label={`${document.original_filename} 미리보기`} />}
            {(kind === 'pdf' || kind === 'text') && <iframe title={`${document.original_filename} 미리보기`} src={contentUrl} />}
            {kind === 'file' && <div className="generic-preview"><FileGlyph document={document} /><strong>이 파일 형식은 브라우저 미리보기를 지원하지 않습니다.</strong><button type="button" className="secondary-button" onClick={() => onDownload(document)}><Icon name="download" size={16} />파일 다운로드</button></div>}
          </div>
          <aside className="preview-details">
            <div className="detail-status"><span>현재 상태</span><StatusBadge status={document.status} /></div>
            <dl>
              <div><dt>파일 형식</dt><dd>{document.content_type || '—'}</dd></div>
              <div><dt>파일 크기</dt><dd>{formatBytes(document.file_size)}</dd></div>
              <div><dt>생성일</dt><dd>{formatDate(document.created_at)}</dd></div>
              <div><dt>수정일</dt><dd>{formatDate(document.updated_at)}</dd></div>
              <div><dt>문서 ID</dt><dd className="mono" title={document.document_id}>{document.document_id}</dd></div>
              {document.checksum && <div><dt>Checksum</dt><dd className="mono" title={document.checksum}>{document.checksum}</dd></div>}
            </dl>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => onDownload(document)}><Icon name="download" size={16} />다운로드</button><button type="button" className="danger-button" onClick={() => onDelete(document)}><Icon name="trash" size={16} />삭제</button></div>
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
          <button type="button" className="delete-option" onClick={() => onConfirm()} disabled={isDeleting}><span><strong>보관 처리</strong><small>목록에서 숨기고 soft delete를 수행합니다.</small></span><Icon name="arrow" size={17} /></button>
          <p className="operator-note">영구 삭제는 일반 사용자 화면에 노출하지 않는 운영자 작업입니다.</p>
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

function ServiceStatus({ readiness }) {
  return <div className={`service-status ${readiness.state}`} role="status" aria-label="DocMesh 서비스 상태"><span className="service-status-dot" />{readiness.message}</div>
}

export default function App() {
  const [documents, setDocuments] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [downloadId, setDownloadId] = useState(null)
  const [uploadFile, setUploadFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 4500)
  }, [])

  const loadDocuments = useCallback(async ({ append = false, cursor = '' } = {}) => {
    if (append) setIsRefreshing(true)
    else setIsLoading(true)
    setLoadError(null)
    try {
      const payload = await listDocuments({ cursor, status: statusFilter, limit: 100 })
      const items = Array.isArray(payload?.items) ? payload.items : []
      setDocuments((current) => append ? [...current, ...items] : items)
      setNextCursor(payload?.next_cursor || null)
      setHasMore(Boolean(payload?.has_more))
    } catch (error) {
      setLoadError(getApiMessage(error, '문서 목록을 불러오지 못했습니다.'))
      if (!append) setDocuments([])
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [statusFilter])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

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
      await uploadDocument(uploadFile)
      setUploadFile(null)
      showToast('문서를 성공적으로 업로드했습니다.')
      await loadDocuments()
    } catch (error) {
      showToast(getApiMessage(error, '문서 업로드에 실패했습니다.'), 'error')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownload = async (document) => {
    setDownloadId(document.document_id)
    try {
      await downloadDocument(document.document_id, document.original_filename)
      showToast('다운로드를 시작했습니다.')
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

  const openDelete = (document) => {
    setSelectedDocument(null)
    setDeleteTarget(document)
  }

  return (
    <div className="app-shell">
      <main className="main-content" id="documents">
<<<<<<< HEAD
        <header className="page-header"><div className="page-header-main"><div className="service-icon" role="img" aria-label="DocMesh 서비스"><span /></div><div><h1>Document library</h1><p>팀의 문서를 한곳에서 간결하게 관리하세요.</p></div></div><div className="page-header-actions"><ServiceStatus readiness={readiness} /><button type="button" className="refresh-button" onClick={() => loadDocuments()} disabled={isLoading || isRefreshing}><Icon name="refresh" size={16} />{isRefreshing ? '새로 고치는 중' : '새로 고침'}</button></div></header>
=======
        <header className="page-header"><div className="page-header-main"><div className="service-icon" role="img" aria-label="DocMesh 서비스"><span /></div><div><h1>Document library</h1><p>팀의 문서를 한곳에서 간결하게 관리하세요.</p></div></div><button type="button" className="refresh-button" onClick={() => loadDocuments()} disabled={isLoading || isRefreshing}><Icon name="refresh" size={16} />{isRefreshing ? '새로 고치는 중' : '새로 고침'}</button></header>
>>>>>>> 3a6e375e9966252b85187168e4aecc796b45b142

        <div className="stats-row"><div className="stat-card accent"><span className="stat-label">전체 문서</span><strong>{documents.length}</strong><span className="stat-foot"><Icon name="file" size={13} /> {documents.length === 1 ? '1 document' : `${documents.length} documents`}</span></div><div className="stat-card"><span className="stat-label">사용 가능</span><strong>{availableCount}</strong><span className="stat-foot"><span className="mini-dot green" /> 정상 상태</span></div><div className="stat-card"><span className="stat-label">저장 용량</span><strong>{formatBytes(totalSize)}</strong><span className="stat-foot">현재 문서 기준</span></div><div className="stat-card stat-hint"><div className="hint-icon"><Icon name="bolt" size={17} /></div><div><strong>빠른 시작</strong><span>파일을 업로드해 보세요.</span></div></div></div>

        <UploadPanel file={uploadFile} onFileChange={setUploadFile} onUpload={handleUpload} isUploading={isUploading} />

        <section className="library-section"><div className="section-heading"><div><h2>내 문서</h2><span>{visibleDocuments.length}개의 문서가 표시되고 있습니다</span></div><div className="library-controls"><label className="search-field"><Icon name="search" size={17} /><input type="search" aria-label="문서 검색" placeholder="문서 이름, 형식 검색" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="filter-select"><select aria-label="문서 상태 필터" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><Icon name="chevron" size={14} /></label></div></div>
          {loadError && <div className="error-banner" role="alert"><Icon name="alert" size={18} /><div><strong>문서를 불러오지 못했습니다.</strong><span>{loadError}</span></div><button type="button" className="text-button" onClick={() => loadDocuments()}>다시 시도</button></div>}
          {isLoading ? <LoadingGrid /> : visibleDocuments.length === 0 ? <EmptyState hasSearch={Boolean(search || statusFilter)} onReset={() => { setSearch(''); setStatusFilter('') }} /> : <div className="document-grid">{visibleDocuments.map((document) => <DocumentCard key={document.document_id} document={document} onOpen={setSelectedDocument} onDownload={handleDownload} onDelete={openDelete} />)}</div>}
          {!isLoading && hasMore && !search && <button type="button" className="load-more" onClick={() => loadDocuments({ append: true, cursor: nextCursor })} disabled={isRefreshing}>{isRefreshing ? '불러오는 중…' : '더 많은 문서 보기'}<Icon name="chevron" size={15} /></button>}
        </section>
      </main>
      {selectedDocument && <DocumentPreview document={selectedDocument} onClose={() => setSelectedDocument(null)} onDownload={handleDownload} onDelete={openDelete} />}
      {deleteTarget && <DeleteDialog document={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} isDeleting={isDeleting} />}
      {downloadId && <div className="download-progress" role="status"><span className="button-spinner" />{documents.find((document) => document.document_id === downloadId)?.original_filename || '문서'} 다운로드 준비 중</div>}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
