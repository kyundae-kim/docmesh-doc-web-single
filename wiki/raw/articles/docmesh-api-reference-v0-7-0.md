---
source_url: https://github.com/kyundae-kim/docmesh-doc/wiki/API-Reference-v0.7.0
ingested: 2026-09-04
sha256: af3e1234af4450aaaab24bc364397e15e98ce4b0581f9253daba05a5ee03aad3
---
# DocMesh Document Service 공개 API Reference v0.7.0

이 페이지는 `docmesh-doc` 프로젝트 버전 `0.7.0`의 현재 공개 계약이다. `dms-core` `0.11.0`의 partition-required facade에 맞춰 HTTP 경계를 기록하며, 이전 버전의 `DmsOperationContext`/scoped facade 계약을 현재 계약으로 재사용하지 않는다.

- 기준 project version: `0.7.0`
- 기준 implementation commit: `14cef6e25943ed5ab9f7f0c56b5948c130b69c7e`
- 기준 branch: `dms-core-v0.11.0`
- 구현 범위: `docmesh_doc/`
- ASGI entrypoint: `docmesh_doc.main:app`
- application factory: `docmesh_doc.application:create_application`
- configuration: [[Configuration-v0.7.0]]
- runnable examples: [[Examples-v0.7.0]]
- verification: `uv run --frozen pytest -q` → `48 passed, 1 warning`

> **버전 식별:** `pyproject.toml`의 project version, `create_application()`의 FastAPI version, 생성된 OpenAPI `info.version`을 모두 `0.7.0`으로 맞춘다. `dms-core` 의존성 버전 `0.11.0`은 이 서비스의 project version과 별개다.

> **인증·권한 경계:** 현재 application은 bearer authentication, OAuth2 token endpoint, Keycloak middleware를 조립하지 않는다. 모든 요청은 설정된 하나의 personal partition과 `admin` `AccessContext`로 DMS에 전달된다. `X-Subject`, `X-User-ID`, `X-Tenant-ID`, `X-Roles` 같은 요청 header는 application identity를 덮어쓰지 않는다. management와 hard-delete route는 외부 gateway/host authorization 뒤에 배치해야 한다.

## 1. 추적성 규칙과 근거

식별자는 release 사이에서도 의미가 유지되도록 분류별로 고정한다.

- `API-*`: 호출 가능한 HTTP, documentation-support, Python hosting/ASGI 공개 표면
- `SCHEMA-*`: HTTP request/response payload
- `ERR-*`: 오류 mapping 또는 오류 envelope
- `CFG-*`: 설정 group. 상세 정의는 [[Configuration-v0.7.0]]
- `EX-*`: 실행 예시. 전체 예시는 [[Examples-v0.7.0]]
- `REQ-*`: 현재 checkout에서 확인한 제품 근거/evidence

각 API row는 다음 경로로 추적된다.

```text
API ID → REQ/evidence → implementation source path:line → test evidence → EX ID → CFG group
```

현재 checkout에는 `docs/prd.md`와 `docs/srs.md`가 없다. 아래 `REQ-*`는 과거 요구사항을 복사하지 않고 현재 README, manifest, source, tests에서 도출했다.

| 근거 ID | 현재 근거 | 의미 |
| --- | --- | --- |
| `REQ-DOC-001` | `README.md:20-52`, `docmesh_doc/router.py:235-698` | 문서 upload/list/read/stream/delete HTTP surface |
| `REQ-UPLOAD-001` | `docmesh_doc/router.py:701-719`, `schemas.py:84-92` | idempotency upload-operation 조회 |
| `REQ-MGMT-001` | `docmesh_doc/router.py:722-936`, `schemas.py:104-180` | internal metadata, inspection, recovery, global/partition reset |
| `REQ-OPS-001` | `docmesh_doc/application.py:169-176` | liveness/readiness |
| `REQ-SYS-001` | FastAPI default assembly 및 support-route probe | OpenAPI/UI support route |
| `REQ-HOST-001` | `application.py:99-203`, `main.py:1-3`, `pyproject.toml:[tool.fastapi]` | factory, lifecycle, ASGI entrypoint |
| `REQ-CONTRACT-001` | `schemas.py:12-193`, `errors.py:22-179` | public allowlist, partition projection, error envelope, correlation ID |
| `REQ-PARTITION-001` | `application.py:118-149`, `dependencies.py:15-39`, `test_v011_application.py:76-149` | fixed application identity, personal partition, access context |
| `REQ-CONFIG-001` | `dms_factory.py:18-258`, `.env.example` | environment and host-owned storage assembly |
| `REQ-DEPLOY-001` | `Dockerfile`, `docker-compose.yml`, `.env.example` | container, readiness, and local storage deployment boundary |

## 2. 완전한 공개 surface

기본 `create_application()`을 기준으로 product route, health route, FastAPI support route, Python hosting symbol을 분리한다. FastAPI가 제공하는 `HEAD`는 대응하는 `GET`의 transport 변형이므로 별도 business ID를 만들지 않는다.

### 2.1 문서·upload route

| API ID | Method | Path | 성공 | 구현 | Example |
| --- | --- | --- | --- | --- | --- |
| `API-DOC-001` | `POST` | `/documents` | `201` 또는 idempotent 결과 `200` | `router.py:235-268` | `EX-DOC-001` |
| `API-DOC-002` | `POST` | `/documents/bytes` | `201` 또는 idempotent 결과 `200` | `router.py:271-305` | `EX-DOC-002` |
| `API-DOC-003` | `POST` | `/documents/file` | `201` 또는 idempotent 결과 `200` | `router.py:308-350` | `EX-DOC-003` |
| `API-DOC-004` | `GET` | `/documents` | `200` | `router.py:370-392` | `EX-DOC-004` |
| `API-DOC-005` | `GET` | `/documents/page` | `200` | `router.py:395-417` | `EX-DOC-005` |
| `API-DOC-006` | `GET` | `/documents/iterator` | `200` | `router.py:420-444` | `EX-DOC-006` |
| `API-DOC-007` | `GET` | `/documents/{document_id}` | `200` | `router.py:447-462` | `EX-DOC-007` |
| `API-DOC-008` | `GET` | `/documents/{document_id}/content` | `200` binary stream | `router.py:465-481` | `EX-DOC-008` |
| `API-DOC-009` | `GET` | `/documents/{document_id}/download` | `200` binary attachment | `router.py:484-505` | `EX-DOC-009` |
| `API-DOC-010` | `DELETE` | `/documents/{document_id}?hard=false` | `200` | `router.py:508-526` | `EX-DOC-010` |
| `API-DOC-011` | `GET` | `/documents/{document_id}/content/eager` | `200` binary body | `router.py:529-555` | `EX-DOC-011` |
| `API-DOC-012` | `GET` | `/documents/{document_id}/content/async` | `200` binary stream | `router.py:558-579` | `EX-DOC-012` |
| `API-DOC-013` | `GET` | `/documents/{document_id}/chunks` | `200` binary stream | `router.py:582-608` | `EX-DOC-013` |
| `API-DOC-014` | `GET` | `/documents/{document_id}/copy` | `200` binary attachment | `router.py:611-662` | `EX-DOC-014` |
| `API-DOC-015` | `DELETE` | `/documents/{document_id}/soft` | `200` | `router.py:665-680` | `EX-DOC-015` |
| `API-DOC-016` | `DELETE` | `/documents/{document_id}/hard` | `200` | `router.py:683-698` | `EX-DOC-016` |

### 2.2 upload operation route

| API ID | Method | Path | 성공 | 구현 | Example |
| --- | --- | --- | --- | --- | --- |
| `API-UPLOAD-001` | `GET` | `/upload-operations/{idempotency_key}` | `200` | `router.py:701-719` | `EX-UPLOAD-001` |

### 2.3 management·recovery route

Management route는 public HTTP surface에 포함되지만 built-in operator authorization이 없다. `API-MGMT-001`의 `storage_key`와 recovery payload는 외부 보호 경계 없이 노출하지 않는다.

| API ID | Method | Path | 성공 | 구현 | Example |
| --- | --- | --- | --- | --- | --- |
| `API-MGMT-001` | `GET` | `/management/documents/{document_id}/metadata` | `200` | `router.py:722-737` | `EX-MGMT-001` |
| `API-MGMT-002` | `GET` | `/management/documents/{document_id}/inspection` | `200` | `router.py:740-755` | `EX-MGMT-002` |
| `API-MGMT-003` | `GET` | `/management/recovery-candidates` | `200` | `router.py:758-779` | `EX-MGMT-003` |
| `API-MGMT-004` | `GET` | `/management/recovery-candidates/iterator` | `200` | `router.py:782-803` | `EX-MGMT-004` |
| `API-MGMT-005` | `POST` | `/management/documents/{document_id}/reconciliations` | `200` | `router.py:806-826` | `EX-MGMT-005` |
| `API-MGMT-006` | `POST` | `/management/reconciliations` | `200` | `router.py:829-849` | `EX-MGMT-006` |
| `API-MGMT-007` | `POST` | `/management/reconciliation-plans/executions` | `200` | `router.py:852-884` | `EX-MGMT-007` |
| `API-MGMT-008` | `DELETE` | `/management/data` | `200` | `router.py:887-895` | `EX-MGMT-008` |
| `API-MGMT-009` | `POST` | `/management/data/initializations` | `200` | `router.py:910-920` | `EX-MGMT-009` |
| `API-MGMT-010` | `DELETE` | `/management/data/partition` | `200` | `router.py:897-907` | `EX-MGMT-010` |
| `API-MGMT-011` | `POST` | `/management/data/partition/initializations` | `200` | `router.py:923-936` | `EX-MGMT-011` |

`API-MGMT-008`와 `API-MGMT-009`는 global reset/data-load operation이고 partition을 전달하지 않는다. `API-MGMT-010`과 `API-MGMT-011`은 설정된 personal partition만 대상으로 한다.

### 2.4 운영·문서 지원 route

| API ID | Method | Path | 성공 | 구현/근거 | Example |
| --- | --- | --- | --- | --- | --- |
| `API-OPS-001` | `GET` | `/health/liveness` | `200` | `application.py:169-171` | `EX-OPS-001` |
| `API-OPS-002` | `GET` | `/health/readiness` | `200` 또는 runtime 실패 시 `503` | `application.py:173-176`, `57-96` | `EX-OPS-002` |
| `API-SYS-001` | `GET` | `/openapi.json` | `200` JSON | FastAPI default assembly | `EX-SYS-001` |
| `API-SYS-002` | `GET` | `/docs` | `200` HTML | FastAPI default assembly | `EX-SYS-002` |
| `API-SYS-003` | `GET` | `/docs/oauth2-redirect` | `200` HTML | FastAPI default assembly | `EX-SYS-003` |
| `API-SYS-004` | `GET` | `/redoc` | `200` HTML | FastAPI default assembly | `EX-SYS-004` |

`API-SYS-001`부터 `API-SYS-004`는 live route지만 generated OpenAPI `paths`에 자기 자신을 포함하지 않는다. `/health/readiness`도 runtime에서는 `503`을 반환할 수 있지만 현재 decorator의 generated response에는 `200`만 선언된다. 이 두 차이를 문서에서 숨기지 않는다.

### 2.5 Python hosting·lifecycle API

| API ID | 공개 symbol | 반환/동작 | 구현 | Example |
| --- | --- | --- | --- | --- |
| `API-HOST-001` | `docmesh_doc.application:create_application` | `FastAPI` application factory | `application.py:99-203` | `EX-HOST-001` |
| `API-HOST-002` | `docmesh_doc.main:app` | import 가능한 ASGI object | `main.py:1-3`, `pyproject.toml:[tool.fastapi]` | `EX-HOST-002` |
| `API-HOST-003` | `DmsSettings`, `DmsSettings.from_env()` | immutable host configuration parser | `dms_factory.py:18-135` | `EX-HOST-003` |
| `API-HOST-004` | `create_dms_runtime(settings=None)` | host-owned `DmsRuntime` assembly | `dms_factory.py:236-258` | `EX-HOST-004` |
| `API-HOST-005` | `DmsRuntime.check_readiness()`, `DmsRuntime.close()` | storage readiness와 idempotent engine dispose | `dms_factory.py:138-182` | `EX-HOST-005` |

`docmesh_doc.router`의 route callable, `dependencies.py`의 dependency callable, `document_http.py` parser, underscore 이름의 stream helper는 import 가능하더라도 compatibility가 보장되는 hosting API가 아니다. `DmsApplicationContext`와 `build_dms_application_context()`도 이 release에서는 application 내부 context assembly detail로 분류한다. `schemas.py`의 명시된 response/request model만 HTTP payload contract로 추적한다.

## 3. 공통 HTTP 계약

### 3.1 base URL과 root path

기본 base URL은 `http://127.0.0.1:8000` 같은 host URL이다. `ROOT_PATH=/dms` 또는 `create_application(root_path="/dms")`를 사용하면 reverse proxy 외부 URL에는 `/dms`가 포함되고 upload `Location` header에도 `/dms`가 포함된다. 내부 route path는 `/documents`, `/health/...` 등으로 유지된다.

### 3.2 application identity와 partition

- `DMS_APPLICATION_USER_ID`를 trim한 값이 application의 고정 identity다.
- canonical setting이 없으면 legacy alias `DMS_USER_ID`를 사용하고, 둘 다 없으면 `docmesh-doc`을 사용한다.
- 최종 selected identity가 빈 값이면 application assembly에서 `dms.ConfigurationError`가 발생한다. 단, environment의 빈 `DMS_APPLICATION_USER_ID`는 미설정으로 처리되어 `DMS_USER_ID` 또는 default로 fallback한다.
- application은 `DocumentPartition.personal(application_user_id)`와 `AccessContext(subject=user_id, user_id=user_id, roles={"admin"})`를 한 번 만든다.
- 일반 upload, list, metadata/content read, delete, operation lookup, recovery, partition reset은 이 partition/access context를 DMS facade에 명시 전달한다.
- global `clear_all_data()`와 `initialize_for_data_load()`만 partition 없이 호출하고, 여전히 fixed `AccessContext`를 전달한다.
- request header로 user/tenant/role/context를 바꾸는 계약은 없다. 특히 `X-User-ID`, `X-Subject`, `X-Tenant-ID`, `X-Roles`, `X-Idempotency-Scope`, `X-Default-Metadata`는 현재 adapter의 context input이 아니다.
- public metadata에는 `partition: {kind, partition_id}`가 포함되고 `user_id`는 포함되지 않는다.

### 3.3 correlation ID

- `X-Correlation-ID`가 있고 128자 이하 printable ASCII이면 그대로 사용한다.
- 없거나 검증에 실패하면 application이 UUID를 생성한다.
- 정상/오류 response에 `X-Correlation-ID` header가 포함된다.
- 오류 body의 `error.correlation_id`와 response header 값은 동일하다.
- 구현: `application.py:46-54,161-167`, `errors.py:105-133`.

### 3.4 content response headers와 stream ownership

binary content route의 성공 response는 다음을 사용한다.

- `Content-Type`: 저장된 content type
- `Content-Length`: response byte 수
- `Content-Disposition`: percent-encoded filename을 포함한 `inline` 또는 `attachment`
- `X-Document-Checksum`: checksum이 있을 때
- `API-DOC-014`의 `X-Checksum-Verified`: `true` 또는 `false`

`_DmsStreamingResponse`는 정상 종료, producer exception, client disconnect 모두에서 close callback을 한 번 호출한다. 구현: `router.py:107-121,140-210`. `API-DOC-014`의 최대 memory spool은 8 MiB다.

## 4. 오류 계약

### 4.1 public envelope

모든 product 오류는 다음 구조를 사용한다.

```json
{
  "error": {
    "code": "DOCUMENT_NOT_FOUND",
    "message": "Document was not found.",
    "correlation_id": "<generated-or-supplied-id>",
    "category": "not_found",
    "retryable": false,
    "document_id": "<optional-document-id>"
  }
}
```

`category`, `retryable`, `document_id`는 DMS 오류가 제공할 때만 포함된다. 내부 exception text, credential, DSN, storage key, stack trace는 public body에 넣지 않는다. 모델: `schemas.py:183-193`; renderer: `errors.py:110-179`.

### 4.2 mapping과 도달성

| ERR ID | HTTP | code | 도달성/사용처 |
| --- | ---: | --- | --- |
| `ERR-VALIDATION-001` | 400 | `VALIDATION_ERROR` | multipart, JSON, query validation 및 plan construction |
| `ERR-AUTH-001` | 403 | `FORBIDDEN` | injected DMS access policy가 거부할 때; 현재 default app에는 policy가 없음 |
| `ERR-DOC-001` | 404 | `DOCUMENT_NOT_FOUND` | missing 또는 deleted/unreadable document |
| `ERR-UPLOAD-001` | 404 | `UPLOAD_OPERATION_NOT_FOUND` | `API-UPLOAD-001`의 없는 operation |
| `ERR-DOC-002` | 409 | `DOCUMENT_ALREADY_EXISTS` | duplicate document ID |
| `ERR-UPLOAD-002` | 409 | `IDEMPOTENCY_CONFLICT` | 다른 fingerprint로 key 재사용 |
| `ERR-DOC-003` | 413 | `DOCUMENT_TOO_LARGE` | DMS max file size 초과 |
| `ERR-UPLOAD-003` | 425 | `IDEMPOTENCY_IN_PROGRESS` | idempotent upload pending |
| `ERR-DOC-004` | 500 | `DOCUMENT_CONSISTENCY_ERROR` | storage/metadata 상태 불일치 |
| `ERR-MGMT-001` | 500 | `DATA_RESET_ERROR` | reset partial failure |
| `ERR-SERVICE-001` | 503 | `SERVICE_UNAVAILABLE` | DMS SDK가 준비되지 않음 또는 HTTP 503 |
| `ERR-SERVICE-002` | 503 | `SERVICE_CONFIGURATION_ERROR` | configuration/assembly error |
| `ERR-SERVICE-003` | 503 | `OBJECT_STORAGE_ERROR` | MinIO operation failure |
| `ERR-SERVICE-004` | 503 | `METADATA_STORE_ERROR` | metadata store failure |
| `ERR-INTERNAL-001` | 500 | `INTERNAL_ERROR` | 기타 DMS/처리 오류 |
| `ERR-HTTP-001` | 404 | `NOT_FOUND` | HTTP exception 404 fallback |
| `ERR-HTTP-002` | 405 | `METHOD_NOT_ALLOWED` | HTTP exception 405 fallback |

DMS mapping source는 `errors.py:22-94`, HTTP mapping은 `errors.py:97-102`다. product route의 decorator response metadata에는 `400/403/404/409/413/425/500/503`의 `ErrorResponse`가 선언된다. 실제 특정 오류가 모든 route에서 발생한다는 뜻은 아니다.

## 5. Public schema

### 5.1 partition과 document metadata

`SCHEMA-DOC-001` — `DocumentPartitionResponse`

| field | type | required | 설명 |
| --- | --- | :---: | --- |
| `kind` | enum | 예 | `personal` 또는 `group`; current application은 `personal`만 생성 |
| `partition_id` | string | 예 | configured application user ID |

`SCHEMA-DOC-002` — `DocumentMetadataResponse`

| field | type | required | 설명 |
| --- | --- | :---: | --- |
| `document_id` | string | 예 | public document ID |
| `original_filename` | string | 예 | 원본 filename |
| `content_type` | string | 예 | media type |
| `file_size` | integer | 예 | bytes |
| `status` | enum | 예 | `uploaded`, `available`, `deleting`, `deleted`, `failed` |
| `created_at` | date-time | 예 | 생성 시각 |
| `updated_at` | date-time | 예 | 변경 시각 |
| `partition` | `SCHEMA-DOC-001` | 예 | partition projection |
| `deleted_at` | date-time/null | 아니오 | 삭제 시각 |
| `created_by` | string/null | 아니오 | 작성자 |
| `checksum` | string/null | 아니오 | checksum |
| `metadata` | JSON value | 아니오 | SDK `extra_metadata`의 외부 이름 |

`user_id`와 `storage_key`는 일반 public metadata에 없다. `InternalDocumentMetadataResponse`에서만 `storage_key`가 추가된다.

`SCHEMA-DOC-003` — `UploadDocumentResponse`는 `SCHEMA-DOC-002`에 `created: boolean`을 추가한다.

### 5.2 upload request와 list

`SCHEMA-DOC-004` — `BytesUploadRequest`

| field | type | required | 규칙 |
| --- | --- | :---: | --- |
| `content_base64` | string | 예 | strict base64, decoded content non-empty |
| `filename` | string | 예 | 길이 1 이상 |
| `content_type` | string | 예 | 길이 1 이상 |
| `document_id` | string/null | 아니오 | 생략 시 DMS ID 발급 |
| `metadata` | object/null | 아니오 | `dict[str, Any]`; 표준 JSON만 허용 |
| `created_by` | string/null | 아니오 | 작성자 |
| `checksum` | string/null | 아니오 | SDK request로 전달 |
| `idempotency_key` | string/null | 아니오 | scope와 함께 idempotency 사용 |
| `idempotency_scope` | string/null | 아니오 | 생략 시 fixed application user ID |

`user_id`는 이 request에 없다. multipart route도 `user_id`, checksum, idempotency field를 받지 않는다.

`SCHEMA-DOC-005` — `DocumentPageResponse`

```json
{"items": [], "next_cursor": null, "has_more": false}
```

`limit`은 1~1000, 기본값 100이다. `next_cursor`는 opaque 값으로 해석·수정하지 않고 동일한 partition/status/page size 조건으로 전달한다.

`SCHEMA-DOC-006` — `DocumentItemsResponse`

```json
{"items": []}
```

`SCHEMA-UPLOAD-001` — `UploadOperationResponse`

```json
{
  "scope": "application-user",
  "idempotency_key": "import-0001",
  "document_id": "doc-001",
  "state": "succeeded",
  "created_at": "2026-09-04T00:00:00Z",
  "updated_at": "2026-09-04T00:00:00Z"
}
```

`state`는 `pending`, `succeeded`, `failed` 중 하나다.

### 5.3 delete와 content

`SCHEMA-DOC-007` — `DeleteDocumentResponse`

```json
{
  "document_id": "doc-001",
  "deleted": true,
  "hard_deleted": false,
  "status": "deleted"
}
```

`SCHEMA-DOC-008` — binary response는 JSON schema가 아니라 `application/octet-stream`과 아래 headers를 계약으로 사용한다.

- `Content-Length`
- `Content-Disposition`
- optional `X-Document-Checksum`
- `API-DOC-014`의 `X-Checksum-Verified`

### 5.4 management schema

- `SCHEMA-MGMT-001` — `InternalDocumentMetadataResponse`: public metadata + `storage_key`; management boundary 전용.
- `SCHEMA-MGMT-002` — `InternalDocumentItemsResponse`: internal metadata list.
- `SCHEMA-MGMT-003` — `DocumentInspectionResponse`: `document_id`, `metadata_exists`, `object_exists`, `status`, `consistent`, `issue`, optional `storage_key`.
- `SCHEMA-MGMT-004` — `ReconciliationResultResponse`: `document_id`, `action`, `applied`, optional `inspection`, `error_type`, `error_message`.
- `SCHEMA-MGMT-005` — `BatchReconciliationResponse`: required `partition`, status/action/dry-run/offset/limit/items 및 `scanned/failed/eligible/applied/skipped` counters.
- `SCHEMA-MGMT-006` — `DataResetResponse`: `metadata_deleted`, `objects_deleted`, `upload_operations_deleted`, `ready_for_data_load`, `total_deleted`.

`DocumentStatus` enum: `uploaded`, `available`, `deleting`, `deleted`, `failed`.

`PartitionKind` enum: `personal`, `group`.

`RecoveryAction` enum: `complete_deletion_soft`, `complete_deletion_hard`, `mark_failed`, `purge_orphan_object`.

`RecoveryIssue` enum: `none`, `metadata_missing`, `object_missing`, `deletion_incomplete`, `failed_status`.

### 5.5 reconciliation request

- `SCHEMA-MGMT-007` — `ReconcileDocumentRequest`: required `action`, optional `storage_key`, `dry_run=false`, `actor`.
- `SCHEMA-MGMT-008` — `ReconcileDocumentsRequest`: required `status`/`action`, `offset=0`, `limit=100` (1~1000), `dry_run=false`, optional `actor`.
- `SCHEMA-MGMT-009` — `ReconciliationPlanItemRequest`: required non-empty `document_id`/`action`, optional `storage_key`.
- `SCHEMA-MGMT-010` — `ExecuteReconciliationPlanRequest`: required `status`/`action`/`items`, optional `actor`.

## 6. Endpoint 상세

### 6.1 upload

#### `API-DOC-001` — multipart stream upload

```http
POST /documents
Content-Type: multipart/form-data
```

필드:

- `file`: required file. filename, content type, positive size와 non-empty body가 필요하다.
- `document_id`: optional string; trim 후 전달한다.
- `metadata`: optional JSON object string. `NaN`, `Infinity`, `-Infinity` 및 object가 아닌 JSON은 거부한다.
- `created_by`: optional string.

adapter는 `dms.UploadDocumentStreamRequest`와 configured partition/access context를 사용한다. 새 문서는 `201 Created`, 기존 idempotent 결과는 `200 OK`가 될 수 있고 response는 `SCHEMA-DOC-003`이다. `Location`은 `/documents/{document_id}`이며 root path가 있으면 prefix를 포함한다.

#### `API-DOC-002` — base64 JSON upload

```http
POST /documents/bytes
Content-Type: application/json
```

body는 `SCHEMA-DOC-004`다. `content_base64`, `filename`, `content_type`이 required다. `metadata`는 object여야 한다. `idempotency_scope`가 없으면 configured application user ID가 scope로 사용된다. `partition`과 `access_context`는 HTTP body가 아니라 application이 server-side로 주입한다.

#### `API-DOC-003` — multipart file upload

```http
POST /documents/file
Content-Type: multipart/form-data
```

`API-DOC-001`과 같은 multipart field를 사용한다. adapter가 임시 파일로 복사한 뒤 SDK `upload_file()`을 호출하며 임시 파일은 success/exception 모두에서 삭제된다.

### 6.2 list/read

#### `API-DOC-004` — cursor list

```http
GET /documents?cursor=<opaque>&limit=100&status=available
```

- `cursor`: optional opaque cursor
- `limit`: 1~1000, default 100
- `status`: optional `DocumentStatus`
- response: `SCHEMA-DOC-005`

DMS call에는 fixed application partition/access context가 포함된다.

#### `API-DOC-005` — explicit page facade

`API-DOC-004`와 query/response는 같지만 host SDK의 `list_documents_page()` facade를 명시 호출한다. partition/status/limit/cursor는 동일하게 전달한다.

#### `API-DOC-006` — iterator materialization

```http
GET /documents/iterator?page_size=100&status=available
```

`page_size`는 1~1000, default 100이다. response는 `SCHEMA-DOC-006`이며 iterator 결과를 JSON array로 materialize한다.

#### `API-DOC-007` — public metadata

```http
GET /documents/{document_id}
```

response는 `SCHEMA-DOC-002`다. missing, deleted 또는 DMS readability 정책상 숨겨진 문서는 `404 DOCUMENT_NOT_FOUND`로 반환될 수 있다. response의 `partition`은 서버가 선택한 personal partition이다.

### 6.3 content

#### `API-DOC-008` — inline streaming content

```http
GET /documents/{document_id}/content
```

저장된 media type과 `Content-Disposition: inline`을 사용한다. query chunk size는 노출하지 않고 DMS 기본 chunk policy를 사용한다.

#### `API-DOC-009` — attachment download

```http
GET /documents/{document_id}/download?chunk_size=65536
```

`chunk_size`는 1~8,388,608 bytes, default 65,536 bytes다. disposition은 `attachment`다.

#### `API-DOC-011` — eager content

```http
GET /documents/{document_id}/content/eager
```

SDK가 content 전체를 memory에 읽어 `Response` body로 반환한다. 대용량 content에는 `API-DOC-008` 또는 `API-DOC-009`를 우선한다.

#### `API-DOC-012` — async streaming content

```http
GET /documents/{document_id}/content/async?chunk_size=65536
```

async DMS stream을 사용하지만 HTTP contract는 binary streaming이다. `chunk_size` 범위는 `API-DOC-009`와 같다. 정상 종료·오류·취소에서 stream close를 보장한다.

#### `API-DOC-013` — chunk iterator response

```http
GET /documents/{document_id}/chunks?chunk_size=65536
```

metadata를 먼저 조회해 headers를 구성한 뒤 chunk iterator를 streaming response로 감싼다. client disconnect에서도 iterator close를 시도한다.

#### `API-DOC-014` — checksum-aware copy

```http
GET /documents/{document_id}/copy?chunk_size=65536&verify_checksum=true
```

adapter가 최대 8 MiB `SpooledTemporaryFile`에 SDK `copy_document_to()` 결과를 받고 response stream으로 변환한다. `verify_checksum` 기본값은 `true`이며 `X-Document-Checksum`, `X-Checksum-Verified`를 반환한다.

### 6.4 delete

#### `API-DOC-010` — parameterized delete

```http
DELETE /documents/{document_id}?hard=false
```

`hard` 기본값은 `false`다. `false`이면 soft delete, `true`이면 hard delete를 SDK `delete_document()`에 전달한다. 현재 application에 role/scope gate가 없으므로 production authorization은 외부 layer 책임이다.

#### `API-DOC-015` — explicit soft delete

```http
DELETE /documents/{document_id}/soft
```

SDK `soft_delete_document()`를 호출한다. response는 `SCHEMA-DOC-007`이다.

#### `API-DOC-016` — explicit hard delete

```http
DELETE /documents/{document_id}/hard
```

SDK `hard_delete_document()`를 호출한다. storage와 metadata를 영구 제거할 수 있으므로 외부 operator authorization이 필요하다.

### 6.5 upload operation

#### `API-UPLOAD-001` — idempotency operation 조회

```http
GET /upload-operations/{idempotency_key}?scope=<scope>
```

`scope` query가 없으면 fixed application user ID를 사용한다. request header로 scope를 공급하지 않는다. response는 `SCHEMA-UPLOAD-001`이며 존재하지 않으면 `404 UPLOAD_OPERATION_NOT_FOUND`다.

### 6.6 management·recovery

#### `API-MGMT-001` — internal metadata

```http
GET /management/documents/{document_id}/metadata
```

`storage_key`를 포함한 `SCHEMA-MGMT-001`을 반환한다. configured partition/access context가 적용되며 public user API로 재사용하지 않는다.

#### `API-MGMT-002` — inspection

```http
GET /management/documents/{document_id}/inspection
```

metadata/object 정합성을 확인해 `SCHEMA-MGMT-003`을 반환한다. metadata가 없어도 typed inspection result를 반환할 수 있다.

#### `API-MGMT-003` — bounded recovery candidates

```http
GET /management/recovery-candidates?status=failed&offset=0&limit=100
```

`status` required, `offset`은 0 이상 default 0, `limit`은 1~1000 default 100이다. response는 `SCHEMA-MGMT-002`다.

#### `API-MGMT-004` — recovery candidate iterator

```http
GET /management/recovery-candidates/iterator?status=failed&page_size=100
```

`status` required, `page_size`는 1~1000 default 100이다. response는 `SCHEMA-MGMT-002`다.

#### `API-MGMT-005` — single reconciliation

```http
POST /management/documents/{document_id}/reconciliations
Content-Type: application/json
```

body:

```json
{
  "action": "mark_failed",
  "storage_key": "private/doc-001",
  "dry_run": true,
  "actor": "operator-001"
}
```

`action` required, `dry_run` default `false`; response는 `SCHEMA-MGMT-004`다. `storage_key`는 operator가 확인한 값만 전달한다.

#### `API-MGMT-006` — bounded batch reconciliation

```http
POST /management/reconciliations
Content-Type: application/json
```

body는 `status`, `action` required이며 `offset=0`, `limit=100`, `dry_run=false`, optional `actor`를 사용한다. response는 partition projection을 포함한 `SCHEMA-MGMT-005`다.

#### `API-MGMT-007` — reconciliation plan execution

```http
POST /management/reconciliation-plans/executions
Content-Type: application/json
```

body는 `status`, `action`, `items` required다. item은 non-empty `document_id`, `action`, optional `storage_key`를 가진다. adapter는 fixed partition을 plan에 넣고 실행 직전 DMS가 stale item을 재검증한다.

#### `API-MGMT-008` — clear all managed data

```http
DELETE /management/data
```

DMS가 관리하는 metadata, object, upload-operation records를 global 범위에서 삭제하고 `SCHEMA-MGMT-006`을 반환한다. partition은 전달하지 않으며 fixed `AccessContext`만 전달한다. partial failure는 `500 DATA_RESET_ERROR`가 될 수 있다.

#### `API-MGMT-009` — initialize for data load

```http
POST /management/data/initializations
```

global data-load 전용 초기화 결과를 `SCHEMA-MGMT-006`으로 반환한다. production data에서 무조건 실행하지 않는다.

#### `API-MGMT-010` — clear configured partition data

```http
DELETE /management/data/partition
```

현재 application의 configured personal partition에 한정해 metadata, object, operation data를 reset한다. response는 `SCHEMA-MGMT-006`이며 partition은 request body/query가 아니라 server-side context에서 선택된다.

#### `API-MGMT-011` — initialize configured partition for data load

```http
POST /management/data/partition/initializations
```

configured personal partition만 대상으로 data-load 초기화를 수행한다. `API-MGMT-009`와 달리 DMS에 fixed partition을 명시한다.

### 6.7 health와 docs

#### `API-OPS-001` — liveness

```http
GET /health/liveness
```

항상 route를 처리하면 다음을 반환한다.

```json
{"status":"ok"}
```

storage connection을 검사하지 않는다.

#### `API-OPS-002` — readiness

```http
GET /health/readiness
```

injected `readiness_check`가 있으면 그 결과를 사용한다. application-owned `DmsRuntime`이면 SQLAlchemy engine connection과 MinIO bucket existence를 검사한다. SDK만 주입하면 DMS SDK 존재 여부를 정상으로 보고한다. 실패 시 runtime은 `503`과 `status=error`를 반환한다.

#### `API-SYS-001`부터 `API-SYS-004` — FastAPI support route

- `GET /openapi.json`: generated OpenAPI JSON, `info.version=0.7.0`
- `GET /docs`: Swagger UI HTML
- `GET /docs/oauth2-redirect`: Swagger UI callback HTML; 이 route가 live라는 것은 OAuth provider가 조립됐다는 뜻이 아니다.
- `GET /redoc`: ReDoc HTML

### 6.8 hosting

#### `API-HOST-001` — `create_application`

```python
from docmesh_doc.application import create_application

app = create_application(
    sdk=host_owned_sdk,
    root_path="/dms",
    application_user_id="service-user",
    readiness_check=lambda: True,
)
```

signature:

```text
create_application(
    sdk: dms.DefaultDocumentManagementSDK | None = None,
    *,
    settings: DmsSettings | None = None,
    runtime: DmsRuntime | None = None,
    root_path: str | None = None,
    application_user_id: str | None = None,
    readiness_check: Callable[[], bool | dict[str, object]] | None = None,
) -> fastapi.FastAPI
```

`sdk`와 `runtime`을 동시에 주면 `ValueError`다. `sdk=` 또는 `runtime=` 주입 객체는 caller-owned이며 application lifespan이 닫지 않는다. 둘 다 생략하면 application이 runtime을 조립하고 자신이 만든 engine을 종료 때 dispose한다. `application_user_id`는 settings 값보다 명시 override가 우선한다.

#### `API-HOST-002` — ASGI object

`docmesh_doc.main:app`은 `create_application()` 결과다. `pyproject.toml`의 `[tool.fastapi].entrypoint`도 이 symbol을 가리킨다. Docker runtime은 `python -m fastapi run docmesh_doc/main.py --host 0.0.0.0`으로 실행한다.

#### `API-HOST-003` — `DmsSettings`

```python
from docmesh_doc.dms_factory import DmsSettings

settings = DmsSettings.from_env({
    "DMS_METADATA_BACKEND": "sqlite",
    "SQLITE_PATH": ":memory:",
    "MINIO_ENDPOINT": "localhost:9000",
    "MINIO_ACCESS_KEY": "<access-key>",
    "MINIO_SECRET_KEY": "<secret-key>",
    "MINIO_BUCKET": "documents",
    "DMS_APPLICATION_USER_ID": " configured-user ",
})
assert settings.application_user_id == "configured-user"
```

`from_env()`는 전달 mapping 또는 process environment를 읽고 backend, boolean, integer, root path, CORS, application identity를 정규화한다. `POSTGRES_DSN`이 존재하면 backend와 무관하게 `ConfigurationError`다. `DMS_APPLICATION_USER_ID`가 없으면 `DMS_USER_ID`, 그 다음 `docmesh-doc` default를 사용한다.

#### `API-HOST-004` — `create_dms_runtime`

`create_dms_runtime(settings)`은 host SQLAlchemy `Engine`, MinIO client와 `dms.DocumentManagementSDKFactory`를 조립해 `DmsRuntime`을 반환한다. metadata backend/MinIO required field가 없으면 configuration error다. MinIO 또는 DMS factory 조립 중 실패하면 이미 만든 engine을 dispose한다.

#### `API-HOST-005` — runtime readiness/lifecycle

- `runtime.check_readiness()`는 metadata engine connection과 MinIO bucket existence를 검사한다.
- `runtime.close()`는 engine을 idempotent하게 dispose한다.
- DMS SDK facade 자체에는 global `close()` 또는 `check_health()`를 추가하지 않는다.
- application에 주입한 runtime은 caller-owned이고 application이 닫지 않는다.

## 7. 완전한 API → 근거 → 구현 → 테스트 → 예시 → 설정 matrix

아래 표는 모든 `API-*` ID를 한 행씩 명시한다. `runtime-only`, `runtime + tested path set`, `tested`를 구분해 dedicated test가 없는 support/hosting surface를 숨기지 않는다.

| API ID | REQ | 구현 source | test evidence | coverage | EX ID | CFG groups |
| --- | --- | --- | --- | --- | --- | --- |
| `API-DOC-001` | `REQ-DOC-001` | `router.py:235-268` | `test_api.py::test_upload_parses_metadata_and_returns_creation_state`; `test_api.py::test_upload_rejects_non_standard_json_metadata` | tested | `EX-DOC-001`, `EX-ERR-001` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-002` | `REQ-DOC-001` | `router.py:271-305` | `test_full_api.py::test_bytes_and_file_upload_variants_delegate_to_their_dms_operations`; `test_full_api.py::test_bytes_upload_rejects_non_standard_json_metadata` | tested | `EX-DOC-002`, `EX-ERR-001` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-003` | `REQ-DOC-001` | `router.py:308-350` | `test_full_api.py::test_bytes_and_file_upload_variants_delegate_to_their_dms_operations` | tested | `EX-DOC-003` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-004` | `REQ-DOC-001` | `router.py:370-392` | `test_api.py::test_list_passes_opaque_cursor_limit_and_status_to_dms`; `test_v011_application.py::test_application_binds_every_request_to_one_dms_user_partition` | tested | `EX-DOC-004`, `EX-ERR-001` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-005` | `REQ-DOC-001` | `router.py:395-417` | `test_full_api.py::test_upload_operation_and_all_document_listing_forms_are_exposed` | tested | `EX-DOC-005` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-006` | `REQ-DOC-001` | `router.py:420-444` | `test_full_api.py::test_upload_operation_and_all_document_listing_forms_are_exposed` | tested | `EX-DOC-006` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-007` | `REQ-DOC-001` | `router.py:447-462` | `test_api.py::test_dms_not_found_is_mapped_without_leaking_exception_text` | tested | `EX-DOC-007`, `EX-ERR-002` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-008` | `REQ-DOC-001` | `router.py:465-481` | `test_api.py::test_inline_content_uses_streaming_response`; `test_streaming.py::test_stream_closes_dms_resource_on_client_disconnect` | tested | `EX-DOC-008` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-009` | `REQ-DOC-001` | `router.py:484-505` | `test_api.py::test_streaming_download_closes_dms_stream`; `test_streaming.py::test_stream_closes_dms_resource_on_client_disconnect` | tested | `EX-DOC-009`, `EX-ERR-001` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-010` | `REQ-DOC-001` | `router.py:508-526` | `test_api.py::test_hard_delete_is_not_gated_by_user_permission`; `test_full_api.py::test_explicit_delete_and_data_reset_operations_are_exposed` | tested | `EX-DOC-010` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-011` | `REQ-DOC-001` | `router.py:529-555` | `test_full_api.py::test_all_content_read_and_copy_forms_are_exposed` | tested | `EX-DOC-011` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-012` | `REQ-DOC-001` | `router.py:558-579` | `test_full_api.py::test_all_content_read_and_copy_forms_are_exposed`; `test_streaming.py::test_async_stream_closes_dms_resource_on_client_disconnect` | tested | `EX-DOC-012` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-013` | `REQ-DOC-001` | `router.py:582-608` | `test_full_api.py::test_all_content_read_and_copy_forms_are_exposed`; `test_streaming.py::test_chunk_iterator_closes_on_client_disconnect` | tested | `EX-DOC-013` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-014` | `REQ-DOC-001` | `router.py:611-662` | `test_full_api.py::test_all_content_read_and_copy_forms_are_exposed`; `test_full_api.py::test_copy_uses_a_bounded_in_memory_spool` | tested | `EX-DOC-014` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-015` | `REQ-DOC-001` | `router.py:665-680` | `test_full_api.py::test_explicit_delete_and_data_reset_operations_are_exposed` | tested | `EX-DOC-015` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-016` | `REQ-DOC-001` | `router.py:683-698` | `test_full_api.py::test_explicit_delete_and_data_reset_operations_are_exposed` | tested | `EX-DOC-016` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-UPLOAD-001` | `REQ-UPLOAD-001` | `router.py:701-719` | `test_full_api.py::test_upload_operation_and_all_document_listing_forms_are_exposed` | tested | `EX-UPLOAD-001` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-001` | `REQ-MGMT-001` | `router.py:722-737` | `test_full_api.py::test_internal_metadata_inspection_and_recovery_candidate_forms_are_exposed` | tested | `EX-MGMT-001` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-002` | `REQ-MGMT-001` | `router.py:740-755` | `test_full_api.py::test_internal_metadata_inspection_and_recovery_candidate_forms_are_exposed` | tested | `EX-MGMT-002` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-003` | `REQ-MGMT-001` | `router.py:758-779` | `test_full_api.py::test_internal_metadata_inspection_and_recovery_candidate_forms_are_exposed` | tested | `EX-MGMT-003` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-004` | `REQ-MGMT-001` | `router.py:782-803` | `test_full_api.py::test_internal_metadata_inspection_and_recovery_candidate_forms_are_exposed` | tested | `EX-MGMT-004` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-005` | `REQ-MGMT-001` | `router.py:806-826` | `test_full_api.py::test_single_batch_and_plan_reconciliation_forms_are_exposed` | tested | `EX-MGMT-005` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-006` | `REQ-MGMT-001` | `router.py:829-849` | `test_full_api.py::test_single_batch_and_plan_reconciliation_forms_are_exposed` | tested | `EX-MGMT-006` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-007` | `REQ-MGMT-001` | `router.py:852-884` | `test_full_api.py::test_single_batch_and_plan_reconciliation_forms_are_exposed` | tested | `EX-MGMT-007` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-008` | `REQ-MGMT-001` | `router.py:887-895` | `test_full_api.py::test_explicit_delete_and_data_reset_operations_are_exposed`; `test_v011_application.py::test_global_reset_routes_remain_partitionless` | tested | `EX-MGMT-008` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-009` | `REQ-MGMT-001` | `router.py:910-920` | `test_full_api.py::test_explicit_delete_and_data_reset_operations_are_exposed`; `test_v011_application.py::test_global_reset_routes_remain_partitionless` | tested | `EX-MGMT-009` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-010` | `REQ-MGMT-001`, `REQ-PARTITION-001` | `router.py:897-907` | `test_v011_application.py::test_application_exposes_partition_scoped_reset_operations` | tested | `EX-MGMT-010` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-011` | `REQ-MGMT-001`, `REQ-PARTITION-001` | `router.py:923-936` | `test_v011_application.py::test_application_exposes_partition_scoped_reset_operations` | tested | `EX-MGMT-011` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-OPS-001` | `REQ-OPS-001` | `application.py:169-171` | `test_api.py::test_liveness_and_injected_sdk_readiness_are_available_without_dms_health_api` | tested | `EX-OPS-001` | `CFG-APP` |
| `API-OPS-002` | `REQ-OPS-001` | `application.py:57-96,173-176` | `test_api.py::test_liveness_and_injected_sdk_readiness_are_available_without_dms_health_api`; `test_api.py::test_host_readiness_check_can_return_service_unavailable` | tested | `EX-OPS-002` | `CFG-APP`, `CFG-STORE`, `CFG-MINIO`, `CFG-PROGRAMMATIC` |
| `API-SYS-001` | `REQ-SYS-001` | FastAPI default assembly | support probe; `test_full_api.py::test_openapi_exposes_every_dms_operation_boundary` | runtime + tested path set | `EX-SYS-001` | `CFG-APP` |
| `API-SYS-002` | `REQ-SYS-001` | FastAPI default assembly | support probe; no dedicated UI assertion | runtime-only | `EX-SYS-002` | `CFG-APP` |
| `API-SYS-003` | `REQ-SYS-001` | FastAPI default assembly | support probe; no dedicated callback assertion | runtime-only | `EX-SYS-003` | `CFG-APP` |
| `API-SYS-004` | `REQ-SYS-001` | FastAPI default assembly | support probe; no dedicated UI assertion | runtime-only | `EX-SYS-004` | `CFG-APP` |
| `API-HOST-001` | `REQ-HOST-001`, `REQ-PARTITION-001` | `application.py:99-203` | `test_api.py` lifecycle/readiness cases; `test_v011_application.py` partition cases | tested | `EX-HOST-001` | `CFG-APP`, `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT`, `CFG-PROGRAMMATIC` |
| `API-HOST-002` | `REQ-HOST-001` | `main.py:1-3`, `pyproject.toml:[tool.fastapi]` | import/configuration evidence; dedicated startup assertion gap | runtime/import evidence | `EX-HOST-002` | `CFG-APP`, `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-HOST-003` | `REQ-CONFIG-001`, `REQ-PARTITION-001` | `dms_factory.py:18-135` | `test_factory.py::test_legacy_postgres_dsn_is_rejected`; `test_v011_application.py::test_application_user_id_is_loaded_from_the_host_environment`; `test_v011_application.py::test_application_rejects_an_empty_application_user_id` | tested | `EX-HOST-003` | `CFG-APP`, `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT`, `CFG-PROGRAMMATIC` |
| `API-HOST-004` | `REQ-CONFIG-001` | `dms_factory.py:236-258` | `test_factory.py::test_sqlite_settings_create_a_host_owned_dms_runtime`; `test_factory.py::test_runtime_creation_disposes_engine_when_minio_assembly_fails` | tested | `EX-HOST-004` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-PROGRAMMATIC` |
| `API-HOST-005` | `REQ-HOST-001` | `dms_factory.py:138-182` | `test_api.py::test_lifespan_does_not_close_injected_host_owned_runtime`; `test_api.py::test_lifespan_closes_runtime_assembled_by_application`; `test_factory.py::test_sqlite_settings_create_a_host_owned_dms_runtime` | tested | `EX-HOST-005` | `CFG-STORE`, `CFG-MINIO`, `CFG-PROGRAMMATIC` |

## 8. 현재 구현의 명시적 한계와 migration notes

- `docmesh-doc` project version은 `0.7.0`, `dms-core` dependency는 `0.11.0`이다. 두 버전을 같은 release number로 해석하지 않는다.
- `dms-core` v0.11에는 `DmsOperationContext`와 scoped facade가 없으므로 이 consumer는 request header를 DMS context로 변환하지 않는다.
- 현재 application은 하나의 configured personal partition만 사용한다. group partition과 per-request multi-user authorization은 이 product contract에 없다.
- `DocumentMetadataResponse`와 `BytesUploadRequest`에서 `user_id`가 제거됐고, public metadata와 batch reconciliation response에 `partition`이 추가됐다.
- multipart upload의 server-derived partition/application identity는 body field가 아니다. `API-DOC-001`과 `API-DOC-003`에 checksum/idempotency/user field를 추가하지 않는다.
- `storage_key`는 일반 public schema에서 제외되지만 internal metadata/inspection/recovery에는 의도적으로 포함된다.
- management, global reset, partition reset, hard-delete는 built-in authorization이 없고 operator network/external gateway 보호가 필요하다.
- support route는 runtime에서는 live지만 generated OpenAPI `paths`에는 포함되지 않는다.
- `/health/readiness` runtime `503`은 현재 generated OpenAPI의 `200` response declaration과 차이가 있다.
- injected SDK/runtime은 caller-owned이고 application lifespan이 닫지 않는다. application이 자체 조립한 runtime만 application shutdown에서 닫는다.
- `POSTGRES_DSN`은 forbidden legacy setting이다. individual `POSTGRES_*` fields를 사용한다.
- `uv run --frozen pytest -q`는 `48 passed, 1 warning`이며 warning은 Starlette/httpx TestClient deprecation이다.
