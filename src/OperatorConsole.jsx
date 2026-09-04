import { useMemo, useState } from 'react'
import {
  clearAllData,
  clearPartitionData,
  deleteDocumentHard,
  deleteDocumentSoft,
  executeReconciliationPlan,
  getDocumentInspection,
  getManagementMetadata,
  getRecoveryCandidateIterator,
  initializeData,
  initializePartitionData,
  listRecoveryCandidates,
  reconcileDocument,
  reconcileDocuments,
} from './api'

const RECOVERY_ACTIONS = [
  { value: 'complete_deletion_soft', label: '삭제 완료 (soft)' },
  { value: 'complete_deletion_hard', label: '삭제 완료 (hard)' },
  { value: 'mark_failed', label: '실패로 표시' },
  { value: 'purge_orphan_object', label: '고립 object 정리' },
]

const DOCUMENT_STATUSES = [
  { value: 'failed', label: '실패' },
  { value: 'uploaded', label: '업로드됨' },
  { value: 'available', label: '사용 가능' },
  { value: 'deleting', label: '삭제 중' },
  { value: 'deleted', label: '삭제됨' },
]

function pretty(value) {
  if (value === null || value === undefined) return '응답 없음'
  return JSON.stringify(value, null, 2)
}

function confirmDestructive(message) {
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') return false
  try {
    return window.confirm(message)
  } catch {
    return false
  }
}

export default function OperatorConsole({ documents = [], onNotify }) {
  const [documentId, setDocumentId] = useState('')
  const [status, setStatus] = useState('failed')
  const [action, setAction] = useState('mark_failed')
  const [storageKey, setStorageKey] = useState('')
  const [actor, setActor] = useState('web-operator')
  const [dryRun, setDryRun] = useState(true)
  const [offset, setOffset] = useState('0')
  const [limit, setLimit] = useState('100')
  const [planItems, setPlanItems] = useState('[]')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState('')

  const selectedDocument = useMemo(
    () => documents.find((document) => document.document_id === documentId),
    [documents, documentId],
  )

  const run = async (label, operation) => {
    setBusy(label)
    try {
      setResult({ label, value: await operation() })
      onNotify?.(`${label} 작업이 완료되었습니다.`)
    } catch (error) {
      setResult({ label, error: error.message || '작업에 실패했습니다.' })
      onNotify?.(error.message || `${label} 작업에 실패했습니다.`, 'error')
    } finally {
      setBusy('')
    }
  }

  const requireDocument = (operation) => {
    if (!documentId.trim()) {
      onNotify?.('운영 문서 ID를 입력하세요.', 'error')
      return
    }
    return operation(documentId.trim())
  }

  const parsePlanItems = () => {
    const parsed = JSON.parse(planItems || '[]')
    if (!Array.isArray(parsed)) throw new Error('Plan items는 JSON 배열이어야 합니다.')
    return parsed
  }

  return (
    <section className="operator-console" aria-labelledby="operator-title">
      <div className="operator-header">
        <div>
          <span className="section-kicker">EXTERNAL AUTHORIZATION REQUIRED</span>
          <h2 id="operator-title">운영자 / 복구</h2>
          <p>management, reconciliation, reset, hard-delete 기능은 격리된 operator network에서만 사용하세요.</p>
        </div>
        {selectedDocument && <span className="operator-selection">선택됨 · {selectedDocument.original_filename}</span>}
      </div>

      <div className="operator-grid">
        <section className="operator-card">
          <h3>문서 정합성</h3>
          <label className="form-field">
            <span>운영 문서 ID</span>
            <input value={documentId} onChange={(event) => setDocumentId(event.target.value)} placeholder="document_id" />
          </label>
          <div className="button-row">
            <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => run('내부 metadata 조회', () => requireDocument(getManagementMetadata))}>내부 metadata 조회</button>
            <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => run('inspection 조회', () => requireDocument(getDocumentInspection))}>inspection 조회</button>
          </div>
          <div className="button-row">
            <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => run('명시적 soft delete', () => requireDocument(deleteDocumentSoft))}>명시적 soft delete</button>
            <button type="button" className="danger-button" disabled={Boolean(busy) || !documentId.trim()} onClick={() => confirmDestructive('이 문서를 영구 삭제할까요?') && run('hard delete', () => deleteDocumentHard(documentId.trim()))}>영구 hard delete</button>
          </div>
        </section>

        <section className="operator-card">
          <h3>Recovery candidates</h3>
          <div className="form-grid">
            <label className="form-field"><span>상태</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{DOCUMENT_STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="form-field"><span>offset</span><input type="number" min="0" value={offset} onChange={(event) => setOffset(event.target.value)} /></label>
            <label className="form-field"><span>limit</span><input type="number" min="1" max="1000" value={limit} onChange={(event) => setLimit(event.target.value)} /></label>
          </div>
          <div className="button-row">
            <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => run('recovery candidates', () => listRecoveryCandidates({ status, offset: Number(offset), limit: Number(limit) }))}>bounded candidates</button>
            <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => run('recovery iterator', () => getRecoveryCandidateIterator({ status, pageSize: Number(limit) }))}>iterator candidates</button>
          </div>
        </section>

        <section className="operator-card operator-wide">
          <h3>Reconciliation</h3>
          <div className="form-grid operator-form-grid">
            <label className="form-field"><span>action</span><select value={action} onChange={(event) => setAction(event.target.value)}>{RECOVERY_ACTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="form-field"><span>actor</span><input value={actor} onChange={(event) => setActor(event.target.value)} /></label>
            <label className="form-field"><span>storage_key (operator 확인)</span><input value={storageKey} onChange={(event) => setStorageKey(event.target.value)} placeholder="private/..." /></label>
            <label className="check-field"><input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} /><span>dry run</span></label>
          </div>
          <div className="button-row">
            <button type="button" className="secondary-button" disabled={Boolean(busy) || !documentId.trim()} onClick={() => run('single reconciliation', () => reconcileDocument(documentId.trim(), { action, storageKey, dryRun, actor }))}>single reconciliation</button>
            <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => run('batch reconciliation', () => reconcileDocuments({ status, action, offset: Number(offset), limit: Number(limit), dryRun, actor }))}>batch reconciliation</button>
          </div>
          <label className="form-field plan-field"><span>plan items JSON · 실행에는 dry run이 없습니다</span><textarea rows="4" value={planItems} onChange={(event) => setPlanItems(event.target.value)} placeholder='[{"documentId":"doc-1","action":"mark_failed"}]' /></label>
          <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => run('reconciliation plan', () => executeReconciliationPlan({ status, action, actor, items: parsePlanItems() }))}>reconciliation plan 실행</button>
        </section>

        <section className="operator-card">
          <h3>Data lifecycle</h3>
          <p className="operator-warning">아래 작업은 metadata, object, upload-operation을 삭제하거나 data-load 상태를 바꿀 수 있습니다.</p>
          <div className="button-stack">
            <button type="button" className="danger-button" disabled={Boolean(busy)} onClick={() => confirmDestructive('전체 managed data를 삭제할까요?') && run('global clear', clearAllData)}>global data 삭제</button>
            <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => run('global initialize', initializeData)}>global data-load 초기화</button>
            <button type="button" className="danger-button" disabled={Boolean(busy)} onClick={() => confirmDestructive('configured partition data를 삭제할까요?') && run('partition clear', clearPartitionData)}>configured partition 삭제</button>
            <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => run('partition initialize', initializePartitionData)}>partition data-load 초기화</button>
          </div>
        </section>
      </div>

      {result && <section className={`operator-result ${result.error ? 'has-error' : ''}`} aria-live="polite"><div><strong>{result.label}</strong>{busy && <span> 처리 중…</span>}</div><pre>{result.error || pretty(result.value)}</pre></section>}
    </section>
  )
}
