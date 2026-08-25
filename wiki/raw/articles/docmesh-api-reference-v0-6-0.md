---
source_url: https://github.com/kyundae-kim/docmesh-doc/wiki/API-Reference-v0.6.0
ingested: 2026-08-25
sha256: 7572157b3610297f96014c8d781e40c732b3c49b543c6f4d4860826bb861792d
---
# DocMesh Document Service 공개 API Reference v0.6.0

이 페이지는 `docmesh-doc` 프로젝트 버전 `0.6.0`의 현재 공개 계약을 기록한다.

- 기준 commit: `b20c35c35eaf9352a3c56f6465ab4fe59845820e`
- 기준 branch: `dms-core-v0.10.0`
- 구현 범위: `docmesh_doc/`
- ASGI entrypoint: `docmesh_doc.main:app`
- application factory: `docmesh_doc.application:create_application`
- 설정: [[Configuration-v0.6.0]]
- 실행 예시: [[Examples-v0.6.0]]
- 검증 명령: `uv run --frozen pytest -q` → `43 passed, 1 warning`

> **버전 식별 주의:** `pyproject.toml`의 배포 버전은 `0.6.0`이지만 현재 `create_application()`이 FastAPI `app.version`과 OpenAPI `info.version`에 넣는 값은 `0.5.0`이다. 이 Wiki 페이지의 버전은 repository/project version인 `0.6.0`을 기준으로 한다. runtime metadata의 불일치는 숨기지 않고 기록한다.

> **보안 경계:** 현재 application은 bearer authentication, OAuth2, Keycloak middleware를 조립하지 않는다. `X-Subject`, `X-User-ID`, `X-Tenant-ID`, `X-Roles` 등 request header는 인증된 claim이 아니라 transport 입력으로 해석된다. 외부 gateway 또는 host가 management route와 context header를 반드시 보호·검증해야 한다.

## 1. 추적성 규칙과 근거

식별자 규칙은 다음과 같다.

- `API-*`: 호출 가능한 HTTP, Python hosting, ASGI 공개 표면
- `SCHEMA-*`: HTTP request/response payload
- `ERR-*`: 오류 mapping 또는 오류 envelope
- `CFG-*`: 설정 그룹. 상세 정의는 [[Configuration-v0.6.0]]
- `EX-*`: 실행 예시. 전체 예시는 [[Examples-v0.6.0]]
- `REQ-*`: 현재 checkout에서 도출한 제품 근거

각 `API-*`는 다음 경로를 가진다.

```text
API ID → REQ/evidence → implementation source path:line → test evidence → EX ID → CFG group
```

현재 branch에는 `docs/prd.md`와 `docs/srs.md`가 존재하지 않는다. 따라서 아래 `REQ-*`는 과거 요구사항을 재사용하지 않고, 현재 `README.md`, `pyproject.toml`, source, tests에서 도출한 근거 ID다.

| 근거 ID | 현재 근거 | 의미 |
| --- | --- | --- |
| `REQ-DOC-001` | `README.md:19-29`, `docmesh_doc/router.py:237-630` | 문서 upload/list/read/stream/delete HTTP surface |
| `REQ-UPLOAD-001` | `docmesh_doc/router.py:633-647`, `schemas.py:78-87` | upload operation 조회 surface |
| `REQ-MGMT-001` | `docmesh_doc/router.py:650-803`, `schemas.py:70-174` | internal metadata, inspection, recovery, reset surface |
| `REQ-OPS-001` | `docmesh_doc/application.py:156-163` | liveness/readiness surface |
| `REQ-SYS-001` | FastAPI default assembly, runtime route probe | OpenAPI/UI support routes |
| `REQ-HOST-001` | `docmesh_doc/application.py:90-190`, `docmesh_doc/main.py:1-4`, `pyproject.toml:[tool.fastapi]` | factory, lifecycle, ASGI entrypoint |
| `REQ-CONTRACT-001` | `docmesh_doc/schemas.py:12-186`, `errors.py:22-179` | public allowlist, error envelope, correlation ID |
| `REQ-CONFIG-001` | `docmesh_doc/dms_factory.py:18-252`, `.env.example` | environment and host-owned storage assembly |

## 2. 완전한 공개 surface

기본 `create_application()`을 실제로 조립해 확인한 runtime route와 OpenAPI path를 구분한다. FastAPI가 제공하는 `HEAD`는 대응하는 `GET`의 transport 변형이므로 별도 business ID를 만들지 않는다.

### 2.1 문서·upload route

| API ID | Method | Path | 성공 | 구현 | Example |
| --- | --- | --- | --- | --- | --- |
| `API-DOC-001` | `POST` | `/documents` | `201` 또는 idempotent 결과 `200` | `router.py:237-267` | `EX-DOC-001` |
| `API-DOC-002` | `POST` | `/documents/bytes` | `201` 또는 idempotent 결과 `200` | `router.py:270-298` | `EX-DOC-002` |
| `API-DOC-003` | `POST` | `/documents/file` | `201` 또는 idempotent 결과 `200` | `router.py:301-339` | `EX-DOC-003` |
| `API-DOC-004` | `GET` | `/documents` | `200` | `router.py:355-375` | `EX-DOC-004` |
| `API-DOC-005` | `GET` | `/documents/page` | `200` | `router.py:378-398` | `EX-DOC-005` |
| `API-DOC-006` | `GET` | `/documents/iterator` | `200` | `router.py:401-422` | `EX-DOC-006` |
| `API-DOC-007` | `GET` | `/documents/{document_id}` | `200` | `router.py:425-435` | `EX-DOC-007` |
| `API-DOC-008` | `GET` | `/documents/{document_id}/content` | `200` binary stream | `router.py:438-449` | `EX-DOC-008` |
| `API-DOC-009` | `GET` | `/documents/{document_id}/download` | `200` binary attachment | `router.py:452-470` | `EX-DOC-009` |
| `API-DOC-010` | `DELETE` | `/documents/{document_id}?hard=false` | `200` | `router.py:473-488` | `EX-DOC-010` |
| `API-DOC-011` | `GET` | `/documents/{document_id}/content/eager` | `200` binary body | `router.py:491-512` | `EX-DOC-011` |
| `API-DOC-012` | `GET` | `/documents/{document_id}/content/async` | `200` binary stream | `router.py:515-533` | `EX-DOC-012` |
| `API-DOC-013` | `GET` | `/documents/{document_id}/chunks` | `200` binary stream | `router.py:536-555` | `EX-DOC-013` |
| `API-DOC-014` | `GET` | `/documents/{document_id}/copy` | `200` binary attachment | `router.py:558-604` | `EX-DOC-014` |
| `API-DOC-015` | `DELETE` | `/documents/{document_id}/soft` | `200` | `router.py:607-617` | `EX-DOC-015` |
| `API-DOC-016` | `DELETE` | `/documents/{document_id}/hard` | `200` | `router.py:620-630` | `EX-DOC-016` |
| `API-UPLOAD-001` | `GET` | `/upload-operations/{idempotency_key}` | `200` | `router.py:633-647` | `EX-UPLOAD-001` |

### 2.2 management·recovery route

Management route는 public HTTP surface에 포함되지만, 현재 코드에 built-in authorization이 없다. production에서는 외부 authorization boundary 뒤에 배치한다.

| API ID | Method | Path | 성공 | 구현 | Example |
| --- | --- | --- | --- | --- | --- |
| `API-MGMT-001` | `GET` | `/management/documents/{document_id}/metadata` | `200` | `router.py:650-660` | `EX-MGMT-001` |
| `API-MGMT-002` | `GET` | `/management/documents/{document_id}/inspection` | `200` | `router.py:663-673` | `EX-MGMT-002` |
| `API-MGMT-003` | `GET` | `/management/recovery-candidates` | `200` | `router.py:676-694` | `EX-MGMT-003` |
| `API-MGMT-004` | `GET` | `/management/recovery-candidates/iterator` | `200` | `router.py:697-715` | `EX-MGMT-004` |
| `API-MGMT-005` | `POST` | `/management/documents/{document_id}/reconciliations` | `200` | `router.py:718-735` | `EX-MGMT-005` |
| `API-MGMT-006` | `POST` | `/management/reconciliations` | `200` | `router.py:738-755` | `EX-MGMT-006` |
| `API-MGMT-007` | `POST` | `/management/reconciliation-plans/executions` | `200` | `router.py:758-783` | `EX-MGMT-007` |
| `API-MGMT-008` | `DELETE` | `/management/data` | `200` | `router.py:786-794` | `EX-MGMT-008` |
| `API-MGMT-009` | `POST` | `/management/data/initializations` | `200` | `router.py:796-803` | `EX-MGMT-009` |

### 2.3 운영·문서 지원 route

| API ID | Method | Path | 성공 | 구현/근거 | Example |
| --- | --- | --- | --- | --- | --- |
| `API-OPS-001` | `GET` | `/health/liveness` | `200` | `application.py:156-159` | `EX-OPS-001` |
| `API-OPS-002` | `GET` | `/health/readiness` | `200` 또는 `503` | `application.py:48-87,160-163` | `EX-OPS-002` |
| `API-SYS-001` | `GET` | `/openapi.json` | `200` JSON | FastAPI assembly | `EX-SYS-001` |
| `API-SYS-002` | `GET` | `/docs` | `200` HTML | FastAPI assembly | `EX-SYS-002` |
| `API-SYS-003` | `GET` | `/docs/oauth2-redirect` | `200` HTML | FastAPI assembly | `EX-SYS-003` |
| `API-SYS-004` | `GET` | `/redoc` | `200` HTML | FastAPI assembly | `EX-SYS-004` |

`/openapi.json`, `/docs`, `/docs/oauth2-redirect`, `/redoc`은 live route지만 OpenAPI `paths`에 자기 자신을 포함하지 않는다. 따라서 OpenAPI path만 읽어 전체 외부 surface라고 판단하지 않는다.

### 2.4 Python hosting·lifecycle API

| API ID | 공개 symbol | 반환/동작 | 구현 | Example |
| --- | --- | --- | --- | --- |
| `API-HOST-001` | `docmesh_doc.application:create_application` | `FastAPI` application factory | `application.py:90-190` | `EX-HOST-001` |
| `API-HOST-002` | `docmesh_doc.main:app` | import 가능한 ASGI object | `main.py:1-4`, `pyproject.toml:12-13` | `EX-HOST-002` |
| `API-HOST-003` | `DmsSettings`, `DmsSettings.from_env()` | immutable host configuration parser | `dms_factory.py:18-129` | `EX-HOST-003` |
| `API-HOST-004` | `create_dms_runtime(settings=None)` | host-owned `DmsRuntime` assembly | `dms_factory.py:230-252` | `EX-HOST-004` |
| `API-HOST-005` | `DmsRuntime.check_readiness()`, `DmsRuntime.close()` | storage readiness와 idempotent engine dispose | `dms_factory.py:132-176` | `EX-HOST-005` |

`docmesh_doc.router`의 route helper, `dependencies.py`의 dependency callable, `document_http.py`의 parser, underscore 이름의 stream helper는 구현 detail이다. `schemas.py`의 public model은 아래 `SCHEMA-*`로 문서화하지만 module import compatibility를 별도 보장하지 않는다.

## 3. 공통 HTTP 계약

### 3.1 base URL과 root path

기본 base URL은 `http://127.0.0.1:8000` 같은 host URL이다. `ROOT_PATH=/dms` 또는 `create_application(root_path="/dms")`를 사용하면 reverse proxy가 외부 URL에 `/dms`를 붙이고 upload `Location` header에도 `/dms`가 포함된다. 내부 route path는 `/documents`, `/health/...` 등으로 유지된다.

### 3.2 correlation ID

- 요청 header `X-Correlation-ID`가 존재하고 128자 이하 printable ASCII이면 그대로 사용한다.
- 없거나 검증에 실패하면 application이 UUID를 생성한다.
- 모든 response에 `X-Correlation-ID`가 포함된다.
- 오류 body의 `error.correlation_id`와 response header 값은 동일하다.
- 구현: `application.py:39-45,148-154`, `errors.py:105-133`.

### 3.3 trusted operation context headers

`dependencies.py:24-71`은 아래 header를 `DmsOperationContext`로 변환한다. 이 값은 인증 provider의 검증된 claim을 자동으로 의미하지 않는다.

| Header | context field | 규칙 |
| --- | --- | --- |
| `X-Subject` | `access.subject`, `created_by`, `audit_actor` fallback | 문자열 |
| `X-User-ID` | `access.user_id`, `user_id` | user scope |
| `X-Tenant-ID` | `access.tenant` | tenant scope |
| `X-Roles` | `access.roles` | comma-separated, trim 후 `frozenset` |
| `X-Created-By` | `created_by` | 없으면 subject fallback |
| `X-Idempotency-Scope` | `idempotency_scope` | operation scope 기본값 |
| `X-Audit-Actor` | `audit_actor` | 없으면 subject fallback |
| `X-Default-Metadata` | `default_metadata` | 표준 JSON만 허용 |

`access`는 subject, user, tenant 또는 role 중 하나라도 있을 때 생성된다. 모든 route dependency는 `sdk.scoped(context)`를 사용한다.

### 3.4 content response headers

binary content route의 성공 response는 다음을 사용한다.

- `Content-Type`: 저장된 content type
- `Content-Length`: response byte 수
- `Content-Disposition`: percent-encoded filename을 포함한 `inline` 또는 `attachment`
- `X-Document-Checksum`: checksum이 있을 때
- `API-DOC-014`는 추가로 `X-Checksum-Verified: true|false`

`_DmsStreamingResponse`는 정상 종료, producer exception, client disconnect 모두에서 close callback을 한 번 호출한다. 구현: `router.py:109-123,142-212`.

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

`category`, `retryable`, `document_id`는 DMS 오류가 제공할 때만 포함된다. 내부 exception text, credential, DSN, storage key, stack trace는 public body에 넣지 않는다. 모델 구현: `schemas.py:176-186`; renderer: `errors.py:110-179`.

### 4.2 mapping과 도달성

| ERR ID | HTTP | code | 도달성/사용처 |
| --- | ---: | --- | --- |
| `ERR-VALIDATION-001` | 400 | `VALIDATION_ERROR` | multipart, JSON, query, context header JSON 검증 |
| `ERR-AUTH-001` | 403 | `FORBIDDEN` | injected DMS access policy가 거부할 때 |
| `ERR-DOC-001` | 404 | `DOCUMENT_NOT_FOUND` | 문서 없음 또는 deleted/readability 정책 |
| `ERR-UPLOAD-001` | 404 | `UPLOAD_OPERATION_NOT_FOUND` | `API-UPLOAD-001`의 없는 operation |
| `ERR-DOC-002` | 409 | `DOCUMENT_ALREADY_EXISTS` | duplicate document ID |
| `ERR-UPLOAD-002` | 409 | `IDEMPOTENCY_CONFLICT` | `API-DOC-002`에 다른 fingerprint 재사용 |
| `ERR-DOC-003` | 413 | `DOCUMENT_TOO_LARGE` | DMS max file size 초과 |
| `ERR-UPLOAD-003` | 425 | `IDEMPOTENCY_IN_PROGRESS` | idempotent upload가 pending |
| `ERR-DOC-004` | 500 | `DOCUMENT_CONSISTENCY_ERROR` | storage/metadata 상태 불일치 |
| `ERR-MGMT-001` | 500 | `DATA_RESET_ERROR` | reset partial failure |
| `ERR-HTTP-001` | 404 | `NOT_FOUND` | unknown HTTP path fallback |
| `ERR-HTTP-002` | 405 | `METHOD_NOT_ALLOWED` | unsupported method fallback |
| `ERR-SERVICE-001` | 503 | `SERVICE_UNAVAILABLE` | SDK dependency 미준비 |
| `ERR-SERVICE-002` | 503 | `SERVICE_CONFIGURATION_ERROR` | configuration/assembly error |
| `ERR-SERVICE-003` | 503 | `OBJECT_STORAGE_ERROR` | MinIO operation failure |
| `ERR-SERVICE-004` | 503 | `METADATA_STORE_ERROR` | metadata store failure |
| `ERR-INTERNAL-001` | 500 | `INTERNAL_ERROR` | 기타 DMS/처리 오류 |

DMS error mapping source는 `errors.py:22-102`이다. route decorator의 response metadata에는 `400/403/404/413/500/503`이 공통 선언되어 있으며, runtime에서 등록된 모든 mapping이 모든 route의 OpenAPI response로 자동 확장된다는 뜻은 아니다.

## 5. Public schema

### 5.1 document metadata

`SCHEMA-DOC-001` — `DocumentMetadataResponse`

| field | type | required | 설명 |
| --- | --- | :---: | --- |
| `document_id` | string | 예 | public document ID |
| `original_filename` | string | 예 | 원본 filename |
| `content_type` | string | 예 | media type |
| `file_size` | integer | 예 | bytes |
| `status` | enum | 예 | `uploaded`, `available`, `deleting`, `deleted`, `failed` |
| `created_at` | date-time | 예 | 생성 시각 |
| `updated_at` | date-time | 예 | 변경 시각 |
| `deleted_at` | date-time/null | 아니오 | 삭제 시각 |
| `created_by` | string/null | 아니오 | 작성자 |
| `user_id` | string/null | 아니오 | user scope |
| `checksum` | string/null | 아니오 | checksum |
| `metadata` | any | 아니오 | SDK `extra_metadata`의 외부 이름 |

`SCHEMA-DOC-002` — `UploadDocumentResponse`는 `SCHEMA-DOC-001`에 `created: boolean`을 추가한다.

`storage_key`는 public metadata allowlist에 없다. 일반 upload/list/read response에서는 절대 노출하지 않는다.

### 5.2 list와 upload operation

`SCHEMA-DOC-003` — `BytesUploadRequest`

| field | type | required | 규칙 |
| --- | --- | :---: | --- |
| `content_base64` | string | 예 | 길이 1 이상, strict base64, decoded content non-empty |
| `filename` | string | 예 | 길이 1 이상 |
| `content_type` | string | 예 | 길이 1 이상 |
| `document_id` | string/null | 아니오 | 생략 시 DMS ID 발급 |
| `metadata` | any/null | 아니오 | JSON-serializable 값 |
| `created_by` | string/null | 아니오 | 작성자 |
| `user_id` | string/null | 아니오 | context user와 불일치 시 DMS 정책에 따름 |
| `checksum` | string/null | 아니오 | SDK request로 전달 |
| `idempotency_key` | string/null | 아니오 | scope와 함께 idempotency 사용 |
| `idempotency_scope` | string/null | 아니오 | operation namespace |

`SCHEMA-DOC-004` — `DocumentPageResponse`

```json
{"items": [], "next_cursor": null, "has_more": false}
```

`limit`은 1~1000, 기본값 100이다. `next_cursor`는 opaque 값으로 해석·수정하지 않고 같은 조건으로 다음 요청에 전달한다.

`SCHEMA-DOC-005` — `DocumentItemsResponse`

```json
{"items": []}
```

`SCHEMA-UPLOAD-001` — `UploadOperationResponse`

```json
{
  "scope": "tenant-a",
  "idempotency_key": "import-0001",
  "document_id": "doc-001",
  "state": "pending",
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

`state`는 `pending`, `succeeded`, `failed` 중 하나다.

### 5.3 delete와 content

`SCHEMA-DOC-006` — `DeleteDocumentResponse`

```json
{
  "document_id": "doc-001",
  "deleted": true,
  "hard_deleted": false,
  "status": "deleted"
}
```

`SCHEMA-DOC-007` — binary response는 JSON schema가 아니라 `application/octet-stream`과 아래 headers를 계약으로 사용한다.

- `Content-Length`
- `Content-Disposition`
- optional `X-Document-Checksum`
- `API-DOC-014`의 `X-Checksum-Verified`

### 5.4 management schema

- `SCHEMA-MGMT-001` — `InternalDocumentMetadataResponse`: public metadata + `storage_key`. management boundary 전용.
- `SCHEMA-MGMT-002` — `InternalDocumentItemsResponse`: internal metadata list.
- `SCHEMA-MGMT-003` — `DocumentInspectionResponse`: `document_id`, `metadata_exists`, `object_exists`, `status`, `consistent`, `issue`, optional `storage_key`.
- `SCHEMA-MGMT-004` — `ReconciliationResultResponse`: `document_id`, `action`, `applied`, optional `inspection`, `error_type`, `error_message`.
- `SCHEMA-MGMT-005` — `BatchReconciliationResponse`: batch 상태·action·dry-run·offset/limit·items·`scanned/failed/eligible/applied/skipped`.
- `SCHEMA-MGMT-006` — `DataResetResponse`: `metadata_deleted`, `objects_deleted`, `upload_operations_deleted`, `ready_for_data_load`, `total_deleted`.

`DocumentStatus` enum: `uploaded`, `available`, `deleting`, `deleted`, `failed`.

`RecoveryAction` enum: `complete_deletion_soft`, `complete_deletion_hard`, `mark_failed`, `purge_orphan_object`.

`RecoveryIssue` enum: `none`, `metadata_missing`, `object_missing`, `deletion_incomplete`, `failed_status`.

## 6. Endpoint 상세

### 6.1 upload

#### `API-DOC-001` — multipart stream upload

```http
POST /documents
Content-Type: multipart/form-data
```

필드:

- `file`: required file. filename, content type, positive size와 non-empty body가 필요하다.
- `document_id`: optional string.
- `metadata`: optional JSON string. 표준 JSON만 허용하며 `NaN`, `Infinity`, `-Infinity`는 거부한다.
- `created_by`: optional string.

성공 response는 `SCHEMA-DOC-002`다. 새로운 문서는 `201 Created`, SDK가 기존 idempotent 결과를 반환하면 `200 OK`가 될 수 있다. `Location`은 `/documents/{document_id}`다.

#### `API-DOC-002` — base64 JSON upload

```http
POST /documents/bytes
Content-Type: application/json
```

body는 `SCHEMA-DOC-003`이다. `content_base64`, `filename`, `content_type`이 required다. metadata는 JSON-serializable이어야 하고, bytes upload는 checksum·user·idempotency 값을 SDK request로 전달한다.

#### `API-DOC-003` — multipart file upload

```http
POST /documents/file
Content-Type: multipart/form-data
```

`API-DOC-001`과 같은 multipart field를 사용하지만 adapter가 임시 파일로 복사한 뒤 SDK `upload_file()`을 호출한다. 임시 파일은 success와 exception 모두에서 삭제된다.

### 6.2 list/read

#### `API-DOC-004` — cursor list

```http
GET /documents?cursor=<opaque>&limit=100&status=available
```

- `cursor`: optional opaque cursor
- `limit`: 1~1000, default 100
- `status`: optional `DocumentStatus`
- response: `SCHEMA-DOC-004`

#### `API-DOC-005` — explicit page facade

`API-DOC-004`와 query/response는 같지만 host SDK의 `list_documents_page()` facade를 명시적으로 호출한다. SDK facade 선택을 HTTP consumer가 구분해야 할 때 사용한다.

#### `API-DOC-006` — iterator materialization

```http
GET /documents/iterator?page_size=100&status=available
```

`page_size`는 1~1000, default 100이다. response는 `SCHEMA-DOC-005`이며 iterator 결과를 JSON 배열로 materialize한다.

#### `API-DOC-007` — public metadata

```http
GET /documents/{document_id}
```

response는 `SCHEMA-DOC-001`이다. missing, deleted 또는 DMS readability 정책상 숨겨진 문서는 `404 DOCUMENT_NOT_FOUND`로 반환될 수 있다.

### 6.3 content

#### `API-DOC-008` — inline streaming content

```http
GET /documents/{document_id}/content
```

`application/octet-stream` binary schema와 `Content-Disposition: inline`을 사용한다. query chunk size는 노출하지 않으며 DMS 기본 chunk policy를 사용한다.

#### `API-DOC-009` — attachment download

```http
GET /documents/{document_id}/download?chunk_size=65536
```

`chunk_size`는 1~8,388,608 bytes, default 65,536 bytes다. response disposition은 `attachment`다.

#### `API-DOC-011` — eager content

```http
GET /documents/{document_id}/content/eager
```

SDK가 content 전체를 메모리에 읽어 `Response` body로 반환한다. 대용량 content에는 `API-DOC-008` 또는 `API-DOC-009`를 우선한다.

#### `API-DOC-012` — async streaming content

```http
GET /documents/{document_id}/content/async?chunk_size=65536
```

async SDK stream을 사용하지만 HTTP consumer contract는 binary streaming이다. `chunk_size` 범위는 `API-DOC-009`와 같다.

#### `API-DOC-013` — chunk iterator response

```http
GET /documents/{document_id}/chunks?chunk_size=65536
```

metadata를 먼저 조회해 headers를 구성한 뒤 chunk iterator를 streaming response로 감싼다. client disconnect에서도 iterator close를 수행한다.

#### `API-DOC-014` — checksum-aware copy

```http
GET /documents/{document_id}/copy?chunk_size=65536&verify_checksum=true
```

adapter가 최대 8 MiB memory spool을 사용해 SDK `copy_document_to()` 결과를 response stream으로 변환한다. `verify_checksum` 기본값은 `true`이고, 결과 header `X-Checksum-Verified`를 반환한다.

### 6.4 delete

#### `API-DOC-010` — parameterized delete

```http
DELETE /documents/{document_id}?hard=false
```

`hard` default는 `false`다. `false`이면 soft delete, `true`이면 hard delete를 SDK `delete_document()`에 전달한다. 현재 application에는 role/scope gate가 없으므로 production authorization은 외부 layer 책임이다.

#### `API-DOC-015` — explicit soft delete

```http
DELETE /documents/{document_id}/soft
```

SDK `soft_delete_document()`를 직접 호출한다.

#### `API-DOC-016` — explicit hard delete

```http
DELETE /documents/{document_id}/hard
```

SDK `hard_delete_document()`를 직접 호출한다. storage와 metadata를 영구 제거할 수 있으므로 외부 operator authorization이 필요하다.

### 6.5 upload operation

#### `API-UPLOAD-001` — idempotency operation 조회

```http
GET /upload-operations/{idempotency_key}?scope=<scope>
```

`scope`가 없으면 `X-Idempotency-Scope` context 값이 SDK scoped facade에 의해 사용될 수 있다. response는 `SCHEMA-UPLOAD-001`이며 존재하지 않으면 `404 UPLOAD_OPERATION_NOT_FOUND`다.

### 6.6 management·recovery

#### `API-MGMT-001` — internal metadata

```http
GET /management/documents/{document_id}/metadata
```

`storage_key`를 포함한 `SCHEMA-MGMT-001`을 반환한다. public document API로 재사용하지 않는다.

#### `API-MGMT-002` — inspection

```http
GET /management/documents/{document_id}/inspection
```

metadata/object 정합성을 확인해 `SCHEMA-MGMT-003`을 반환한다. metadata 자체가 없어도 typed inspection result를 반환할 수 있다.

#### `API-MGMT-003` — bounded recovery candidates

```http
GET /management/recovery-candidates?status=failed&offset=0&limit=100
```

`status`는 required, `offset`은 0 이상 default 0, `limit`은 1~1000 default 100이다. DMS가 허용하는 recovery status/action 정책은 SDK가 검증한다.

#### `API-MGMT-004` — recovery candidate iterator

```http
GET /management/recovery-candidates/iterator?status=failed&page_size=100
```

`status` required, `page_size`는 1~1000 default 100이다. response는 internal metadata items다.

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

`action`은 required이고, `dry_run` default는 `false`다. response는 `SCHEMA-MGMT-004`다.

#### `API-MGMT-006` — bounded batch reconciliation

```http
POST /management/reconciliations
Content-Type: application/json
```

body는 `status`, `action`이 required이고 `offset=0`, `limit=100`, `dry_run=false`, optional `actor`를 사용한다. response는 `SCHEMA-MGMT-005`다.

#### `API-MGMT-007` — reconciliation plan execution

```http
POST /management/reconciliation-plans/executions
Content-Type: application/json
```

body는 `status`, `action`, `items`가 required다. 각 item은 non-empty `document_id`, `action`, optional `storage_key`를 가진다. 실행 직전 stale item을 다시 검증하는 것은 DMS SDK contract다.

#### `API-MGMT-008` — clear all managed data

```http
DELETE /management/data
```

DMS가 관리하는 metadata, object, upload operation records를 삭제하고 `SCHEMA-MGMT-006`을 반환한다. partial failure는 `DATA_RESET_ERROR`와 result detail로 처리될 수 있다. production data에서 무조건 실행하지 않는다.

#### `API-MGMT-009` — initialize for data load

```http
POST /management/data/initializations
```

data-load 전용 초기화/reset 결과를 `SCHEMA-MGMT-006`으로 반환한다.

### 6.7 health와 docs

#### `API-OPS-001` — liveness

```http
GET /health/liveness
```

항상 정상적으로 route를 처리하면 다음을 반환한다.

```json
{"status":"ok"}
```

storage connection을 검사하지 않는다.

#### `API-OPS-002` — readiness

```http
GET /health/readiness
```

기본 payload는 다음 형태다.

```json
{
  "status": "ok",
  "ok": true,
  "details": {"dms": {"ok": true, "required": true}}
}
```

주입된 `readiness_check`가 있으면 host 결과를 사용한다. application-owned `DmsRuntime`이면 SQLAlchemy engine connection과 MinIO bucket existence를 검사한다. 실패 시 `503`과 `status=error`다.

#### `API-SYS-001` ~ `API-SYS-004`

FastAPI default docs support route다.

- `GET /openapi.json`: generated OpenAPI JSON
- `GET /docs`: Swagger UI HTML
- `GET /docs/oauth2-redirect`: Swagger UI callback HTML. 현재 OAuth provider가 조립되었다는 뜻은 아니다.
- `GET /redoc`: ReDoc HTML

### 6.8 hosting

#### `API-HOST-001` — `create_application`

```python
from docmesh_doc.application import create_application

app = create_application(
    sdk=host_owned_sdk,
    root_path="/dms",
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
    readiness_check: Callable[[], bool | dict[str, object]] | None = None,
) -> fastapi.FastAPI
```

`sdk`와 `runtime`을 동시에 주면 `ValueError`다. `sdk=` 또는 `runtime=` 주입 객체는 caller-owned이며 application lifespan이 닫지 않는다. 둘 다 생략하면 application이 runtime을 조립하고 자신이 만든 engine을 종료 시 dispose한다.

#### `API-HOST-002` — ASGI object

`docmesh_doc.main:app`은 `create_application()`의 결과다. `pyproject.toml`의 `[tool.fastapi].entrypoint`도 같은 symbol을 가리킨다.

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
})
```

`from_env()`는 전달 mapping 또는 process environment를 읽고, backend/boolean/integer/root path를 정규화한다. `POSTGRES_DSN`이 존재하면 지원되지 않는 legacy setting으로 `ConfigurationError`다.

#### `API-HOST-004` — `create_dms_runtime`

`create_dms_runtime(settings)`은 host SQLAlchemy `Engine`, MinIO client와 `dms.DocumentManagementSDKFactory`를 조립해 `DmsRuntime`을 반환한다. metadata backend 및 MinIO required field가 없으면 configuration error다. MinIO 조립 중 실패하면 이미 만든 engine을 dispose한다.

#### `API-HOST-005` — runtime readiness/lifecycle

- `runtime.check_readiness()`는 metadata engine connection과 MinIO bucket existence를 검사한다.
- `runtime.close()`는 engine을 idempotent하게 dispose한다.
- SDK facade 자체에는 전역 `close()` 또는 `check_health()`를 추가하지 않는다.
- application에 주입한 runtime은 caller-owned이고 application이 닫지 않는다.

## 7. 완전한 API → 근거 → 구현 → 테스트 → 예시 → 설정 matrix

아래 표는 모든 `API-*` ID를 한 행씩 명시한다. `runtime probe`와 `under-tested`는 전용 repository assertion이 없는 부분을 숨기지 않는 상태 표시다.

| API ID | REQ | 구현 source | test evidence | coverage | EX ID | CFG groups |
| --- | --- | --- | --- | --- | --- | --- |
| `API-DOC-001` | `REQ-DOC-001` | `router.py:237-267` | `test_api.py::test_upload_parses_metadata_and_returns_creation_state`; `test_api.py::test_upload_rejects_non_standard_json_metadata` | tested | `EX-DOC-001`, `EX-ERR-001` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-002` | `REQ-DOC-001` | `router.py:270-298` | `test_full_api.py::test_bytes_and_file_upload_variants_delegate_to_their_dms_operations`; `test_full_api.py::test_bytes_upload_rejects_non_standard_json_metadata` | tested | `EX-DOC-002`, `EX-ERR-001` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-003` | `REQ-DOC-001` | `router.py:301-339` | `test_full_api.py::test_bytes_and_file_upload_variants_delegate_to_their_dms_operations` | tested | `EX-DOC-003` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-004` | `REQ-DOC-001` | `router.py:355-375` | `test_api.py::test_list_passes_opaque_cursor_limit_and_status_to_dms`; `test_full_api.py::test_upload_operation_and_all_document_listing_forms_are_exposed` | tested | `EX-DOC-004`, `EX-ERR-001` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-005` | `REQ-DOC-001` | `router.py:378-398` | `test_full_api.py::test_upload_operation_and_all_document_listing_forms_are_exposed` | tested | `EX-DOC-005` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-006` | `REQ-DOC-001` | `router.py:401-422` | `test_full_api.py::test_upload_operation_and_all_document_listing_forms_are_exposed` | tested | `EX-DOC-006` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-007` | `REQ-DOC-001` | `router.py:425-435` | `test_api.py::test_dms_not_found_is_mapped_without_leaking_exception_text` | tested | `EX-DOC-007`, `EX-ERR-002` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-008` | `REQ-DOC-001` | `router.py:438-449` | `test_api.py::test_inline_content_uses_streaming_response`; `test_streaming.py::test_stream_closes_dms_resource_on_client_disconnect` | tested | `EX-DOC-008` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-009` | `REQ-DOC-001` | `router.py:452-470` | `test_api.py::test_streaming_download_closes_dms_stream`; `test_streaming.py::test_stream_closes_dms_resource_on_client_disconnect` | tested | `EX-DOC-009`, `EX-ERR-001` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-010` | `REQ-DOC-001` | `router.py:473-488` | `test_api.py::test_hard_delete_is_not_gated_by_user_permission` | tested | `EX-DOC-010` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-011` | `REQ-DOC-001` | `router.py:491-512` | `test_full_api.py::test_all_content_read_and_copy_forms_are_exposed` | tested | `EX-DOC-011` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-012` | `REQ-DOC-001` | `router.py:515-533` | `test_full_api.py::test_all_content_read_and_copy_forms_are_exposed`; `test_streaming.py::test_async_stream_closes_dms_resource_on_client_disconnect` | tested | `EX-DOC-012` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-013` | `REQ-DOC-001` | `router.py:536-555` | `test_full_api.py::test_all_content_read_and_copy_forms_are_exposed`; `test_streaming.py::test_chunk_iterator_closes_on_client_disconnect` | tested | `EX-DOC-013` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-014` | `REQ-DOC-001` | `router.py:558-604` | `test_full_api.py::test_all_content_read_and_copy_forms_are_exposed`; `test_full_api.py::test_copy_uses_a_bounded_in_memory_spool` | tested | `EX-DOC-014` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-015` | `REQ-DOC-001` | `router.py:607-617` | `test_full_api.py::test_explicit_delete_and_data_reset_operations_are_exposed` | tested | `EX-DOC-015` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-016` | `REQ-DOC-001` | `router.py:620-630` | `test_full_api.py::test_explicit_delete_and_data_reset_operations_are_exposed` | tested | `EX-DOC-016` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-UPLOAD-001` | `REQ-UPLOAD-001` | `router.py:633-647` | `test_full_api.py::test_upload_operation_and_all_document_listing_forms_are_exposed` | tested | `EX-UPLOAD-001` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-001` | `REQ-MGMT-001` | `router.py:650-660` | `test_full_api.py::test_internal_metadata_inspection_and_recovery_candidate_forms_are_exposed` | tested | `EX-MGMT-001` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-002` | `REQ-MGMT-001` | `router.py:663-673` | `test_full_api.py::test_internal_metadata_inspection_and_recovery_candidate_forms_are_exposed` | tested | `EX-MGMT-002` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-003` | `REQ-MGMT-001` | `router.py:676-694` | `test_full_api.py::test_internal_metadata_inspection_and_recovery_candidate_forms_are_exposed` | tested | `EX-MGMT-003` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-004` | `REQ-MGMT-001` | `router.py:697-715` | `test_full_api.py::test_internal_metadata_inspection_and_recovery_candidate_forms_are_exposed` | tested | `EX-MGMT-004` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-005` | `REQ-MGMT-001` | `router.py:718-735` | `test_full_api.py::test_single_batch_and_plan_reconciliation_forms_are_exposed` | tested | `EX-MGMT-005` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-006` | `REQ-MGMT-001` | `router.py:738-755` | `test_full_api.py::test_single_batch_and_plan_reconciliation_forms_are_exposed` | tested | `EX-MGMT-006` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-007` | `REQ-MGMT-001` | `router.py:758-783` | `test_full_api.py::test_single_batch_and_plan_reconciliation_forms_are_exposed` | tested | `EX-MGMT-007` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-008` | `REQ-MGMT-001` | `router.py:786-794` | `test_full_api.py::test_explicit_delete_and_data_reset_operations_are_exposed` | tested | `EX-MGMT-008` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-009` | `REQ-MGMT-001` | `router.py:796-803` | `test_full_api.py::test_explicit_delete_and_data_reset_operations_are_exposed` | tested | `EX-MGMT-009` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-OPS-001` | `REQ-OPS-001` | `application.py:156-159` | `test_api.py::test_liveness_and_injected_sdk_readiness_are_available_without_dms_health_api` | tested | `EX-OPS-001` | `CFG-APP` |
| `API-OPS-002` | `REQ-OPS-001` | `application.py:48-87,160-163` | `test_api.py::test_liveness_and_injected_sdk_readiness_are_available_without_dms_health_api`; `test_api.py::test_host_readiness_check_can_return_service_unavailable` | tested | `EX-OPS-002` | `CFG-APP`, `CFG-STORE`, `CFG-MINIO`, `CFG-PROGRAMMATIC` |
| `API-SYS-001` | `REQ-SYS-001` | FastAPI default assembly | runtime probe; `test_full_api.py::test_openapi_exposes_every_dms_operation_boundary` | runtime + tested path set | `EX-SYS-001` | `CFG-APP` |
| `API-SYS-002` | `REQ-SYS-001` | FastAPI default assembly | runtime probe; dedicated UI assertion gap | runtime-only | `EX-SYS-002` | `CFG-APP` |
| `API-SYS-003` | `REQ-SYS-001` | FastAPI default assembly | runtime probe; dedicated callback assertion gap | runtime-only | `EX-SYS-003` | `CFG-APP` |
| `API-SYS-004` | `REQ-SYS-001` | FastAPI default assembly | runtime probe; dedicated UI assertion gap | runtime-only | `EX-SYS-004` | `CFG-APP` |
| `API-HOST-001` | `REQ-HOST-001` | `application.py:90-190` | `test_api.py::test_lifespan_does_not_close_host_owned_dms_sdk`; `test_api.py::test_lifespan_closes_runtime_assembled_by_application` | tested | `EX-HOST-001` | `CFG-APP`, `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT`, `CFG-PROGRAMMATIC` |
| `API-HOST-002` | `REQ-HOST-001` | `main.py:1-4`, `pyproject.toml:12-13` | import/configuration evidence; dedicated startup assertion gap | runtime/import evidence | `EX-HOST-002` | `CFG-APP`, `CFG-DMS`, `CFG-STORE`, `CFG-MINIO` |
| `API-HOST-003` | `REQ-CONFIG-001` | `dms_factory.py:18-129` | `test_factory.py::test_legacy_postgres_dsn_is_rejected` | tested | `EX-HOST-003` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-PROGRAMMATIC` |
| `API-HOST-004` | `REQ-CONFIG-001` | `dms_factory.py:230-252` | `test_factory.py::test_sqlite_settings_create_a_host_owned_dms_runtime`; `test_factory.py::test_runtime_creation_disposes_engine_when_minio_assembly_fails` | tested | `EX-HOST-004` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-PROGRAMMATIC` |
| `API-HOST-005` | `REQ-HOST-001` | `dms_factory.py:132-176` | `test_api.py::test_lifespan_does_not_close_injected_host_owned_runtime`; `test_factory.py::test_sqlite_settings_create_a_host_owned_dms_runtime` | tested | `EX-HOST-005` | `CFG-STORE`, `CFG-MINIO`, `CFG-PROGRAMMATIC` |

## 8. 현재 구현의 명시적 한계

- project version `0.6.0`과 runtime/OpenAPI version `0.5.0`은 일치하지 않는다.
- authentication, OAuth2 token route, Keycloak integration, role/scope enforcement는 현재 application contract에 없다.
- management route는 HTTP surface지만 built-in authorization이 없고 외부 보호가 필요하다.
- `storage_key`는 일반 public schema에서 제외되지만 management schema에는 의도적으로 포함된다.
- `POST /documents`와 `POST /documents/file`의 multipart field는 현재 `file`, `document_id`, `metadata`, `created_by`다. bytes 전용 field인 checksum/idempotency를 multipart 예시로 확장하지 않는다.
- SDK/runtime이 caller-owned인지 application-owned인지에 따라 shutdown ownership이 달라진다.
- support route는 runtime에서는 live지만 generated OpenAPI `paths`에 포함되지 않는다.
- `uv run --frozen pytest -q`는 현재 `43 passed, 1 warning`이며, warning은 Starlette/httpx TestClient deprecation이다.
