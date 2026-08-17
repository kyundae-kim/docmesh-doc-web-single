---
source_url: https://github.com/kyundae-kim/docmesh-doc/wiki/API-Reference-v0.5.0
ingested: 2026-08-17
sha256: 35e998105a498e34ff6cae8ae0dab044e28cc64a04d3dc37441f6e51ffbffa7a
---
# 공개 API Reference v0.5.0

DocMesh Document Service의 현재 checkout(`45a21e3`)에 도달 가능한 HTTP, FastAPI 지원 route, Python hosting entrypoint, public response schema와 오류 계약을 하나의 ID 체계로 추적한다.

- 구현 기준: `docmesh_doc/`
- ASGI entrypoint: `docmesh_doc.main:app`
- application factory: `docmesh_doc.application:create_application`
- 실행 예시: [[Examples-v0.5.0]]
- 설정 정의: [[Configuration-v0.5.0]]
- 테스트 기준: `uv run pytest -q` → `21 passed, 1 warning`

> **버전 주의:** `pyproject.toml`의 프로젝트 버전은 `0.5.0`이지만 `docmesh_doc.application`이 FastAPI metadata에 넣는 `app.version`은 현재 `0.4.0`이다. 이 문서는 repository/project 버전 `0.5.0`을 페이지 버전으로 사용하고, runtime metadata 차이를 숨기지 않는다.

> **인증 경계:** 현재 checkout에는 OAuth2/Keycloak/auth middleware가 조립되어 있지 않다. 아래 HTTP API는 별도 reverse proxy 또는 상위 서비스가 인증을 제공하지 않는 한 bearer token을 요구하지 않는다. 이전 Wiki v0.4.0의 `/token`, `/user`, role/scope 설명은 현재 구현에 대한 계약이 아니다.

## 1. 추적성 규칙

`API-*`는 호출 가능한 외부 표면, `SCHEMA-*`는 HTTP payload, `ERR-*`는 오류, `EX-*`는 실행 예시, `CFG-*`는 설정을 식별한다.

각 계약은 다음으로 되돌아간다.

```text
계약 ID → 현재 제품 근거/요구사항 → 구현 source path:line → test path::test → Examples ID
```

현재 branch에는 `docs/prd.md`와 `docs/srs.md`가 없으므로 `REQ-*`는 README, `.env.example`, pyproject와 현재 source에서 도출한 제품 근거 ID다. 추적성 표에서 test가 `runtime inventory`로 표시되는 항목은 전용 assertion이 아직 없는 지원 route다.

### 제품 근거 ID

| 근거 ID | 현재 근거 | 의미 |
| --- | --- | --- |
| `REQ-DOC-001` | `README.md:19-29` | 문서 upload/list/read/content/download/delete HTTP surface |
| `REQ-OPS-001` | `README.md:19-29` | liveness/readiness surface |
| `REQ-HOST-001` | `README.md:5-17`, `pyproject.toml:[tool.fastapi]` | host-owned DMS assembly, lifecycle와 ASGI entrypoint |
| `REQ-CONTRACT-001` | `docmesh_doc/schemas.py`, `docmesh_doc/errors.py` | public response allowlist와 correlation-ID 오류 envelope |
| `REQ-CONFIG-001` | `.env.example:7-41`, `docmesh_doc/dms_factory.py` | PostgreSQL/SQLite metadata와 MinIO 설정 |

## 2. 공개 표면 전체 목록

기본 `create_application()`에서 실제 route inventory를 확인한 결과다. FastAPI가 docs route에 추가하는 `HEAD`는 대응하는 `GET`의 transport 변형으로 별도 business ID를 만들지 않는다.

| API ID | Method | 경로/import | 성공 | 구현 | 테스트/예시 |
| --- | --- | --- | --- | --- | --- |
| `API-DOC-001` | `POST` | `/documents` | `201` | `router.py:89-118` | `test_api.py::test_upload_ignores_metadata_form_field`, `EX-DOC-001` |
| `API-DOC-002` | `GET` | `/documents` | `200` | `router.py:121-140` | `test_api.py::test_list_passes_opaque_cursor_limit_and_status_to_dms`, `EX-DOC-002` |
| `API-DOC-003` | `GET` | `/documents/{document_id}` | `200` | `router.py:143-153` | `test_api.py::test_dms_not_found_is_mapped_without_leaking_exception_text`, `EX-DOC-003` |
| `API-DOC-004` | `GET` | `/documents/{document_id}/content` | `200` | `router.py:156-166` | `test_api.py::test_inline_content_uses_streaming_response`, `EX-DOC-004` |
| `API-DOC-005` | `GET` | `/documents/{document_id}/download` | `200` | `router.py:169-186` | `test_api.py::test_streaming_download_closes_dms_stream`, `EX-DOC-005` |
| `API-DOC-006` | `DELETE` | `/documents/{document_id}?hard=false` | `200` | `router.py:189-204` | `test_api.py::test_hard_delete_is_not_gated_by_user_permission`, `EX-DOC-006` |
| `API-DOC-007` | `DELETE` | `/documents/{document_id}?hard=true` | `200` | `router.py:189-204` | same test, `EX-DOC-007` |
| `API-OPS-001` | `GET` | `/health/liveness` | `200` | `application.py:157-159` | `test_api.py::test_liveness_and_injected_sdk_readiness_are_available_without_dms_health_api`, `EX-OPS-001` |
| `API-OPS-002` | `GET` | `/health/readiness` | `200`/`503` | `application.py:161-164` | `test_api.py::test_host_readiness_check_can_return_service_unavailable`, `EX-OPS-002` |
| `API-SYS-001` | `GET` | `/openapi.json` | `200` | FastAPI assembly | runtime inventory, `EX-SYS-001` |
| `API-SYS-002` | `GET` | `/docs` | `200` | FastAPI assembly | runtime inventory, `EX-SYS-002` |
| `API-SYS-003` | `GET` | `/docs/oauth2-redirect` | `200` | FastAPI assembly | runtime inventory, `EX-SYS-003` |
| `API-SYS-004` | `GET` | `/redoc` | `200` | FastAPI assembly | runtime inventory, `EX-SYS-004` |
| `API-HOST-001` | Python | `create_application(...)` | `FastAPI` | `application.py:91-190` | `test_api.py` lifespan cases, `EX-HOST-001` |
| `API-HOST-002` | ASGI | `docmesh_doc.main:app` | ASGI app | `main.py:1-4` | `pyproject.toml`, `EX-HOST-002` |

`ROOT_PATH=/dms` 또는 `create_application(root_path="/dms")`이면 외부 URL과 upload `Location`에 `/dms`가 포함된다. backend route의 path 자체는 `/documents`와 `/health/...`로 유지된다.

## 3. 공통 HTTP 계약

### Content type와 correlation ID

- upload request: `multipart/form-data`
- JSON payload: `application/json`
- content/download response: SDK metadata의 `content_type`
- `X-Correlation-ID`가 128자 이하의 printable ASCII이면 그대로 사용한다.
- 헤더가 없거나 유효하지 않으면 UUID를 생성한다.
- middleware가 모든 응답에 `X-Correlation-ID`를 넣고, 오류 body의 `error.correlation_id`와 같은 값을 사용한다. (`application.py:40-45`, `149-155`)

### 오류 envelope

```json
{
  "error": {
    "code": "DOCUMENT_NOT_FOUND",
    "message": "Document was not found.",
    "correlation_id": "<generated-or-supplied-id>"
  }
}
```

내부 exception text, credential, DSN, object storage key와 stack trace는 body로 전달하지 않는다. `ErrorResponse`는 `schemas.py:46-54`, 공통 renderer는 `errors.py:111-124`에 있다.

## 4. 문서 API

### `API-DOC-001` — 문서 upload

```http
POST /documents
Content-Type: multipart/form-data
```

| field | 타입 | 필수 | 계약 |
| --- | --- | --- | --- |
| `file` | file | 예 | filename, content type, size가 있고 내용이 0보다 커야 한다. |
| `document_id` | string | 아니오 | 공백이면 생략과 같고 DMS SDK가 ID를 생성한다. |

현재 HTTP adapter는 `metadata`, `created_by`, `checksum`, `idempotency_key` form field를 API 입력으로 선언하지 않는다. 추가 field는 무시되며 metadata는 `{}`로 저장된다. 이 동작을 이용하기보다 위 두 field만 전송한다. (`router.py:96-118`, `document_http.py:10-24`)

성공:

- status `201 Created`
- body `SCHEMA-DOC-001`
- `Location: /documents/{document_id}` 또는 root path를 포함한 외부 path
- 내부 `storage_key` 없음

주요 runtime 오류는 `400 VALIDATION_ERROR`, `409 DOCUMENT_ALREADY_EXISTS`, `413 DOCUMENT_TOO_LARGE`, `503 OBJECT_STORAGE_ERROR`, `503 METADATA_STORE_ERROR`다.

### `API-DOC-002` — 문서 목록

```http
GET /documents?cursor=<opaque>&limit=100&status=available
```

| query | 기본값 | 규칙 |
| --- | --- | --- |
| `cursor` | 없음 | opaque 값이며 첫 요청에는 생략한다. |
| `limit` | `100` | `1` 이상 `1000` 이하 |
| `status` | 없음 | `uploaded`, `available`, `deleting`, `deleted`, `failed` 중 하나 |

성공 body는 `SCHEMA-DOC-002`다. `next_cursor`는 직접 해석·수정하지 않고 같은 `limit`/`status`와 함께 다음 요청에 전달한다. 잘못된 query는 DMS를 호출하지 않고 `400 VALIDATION_ERROR`다.

### `API-DOC-003` — metadata 조회

```http
GET /documents/{document_id}
```

성공 body는 `SCHEMA-DOC-001`이다. 존재하지 않거나 DMS가 deleted/unreadable로 판정한 문서는 `404 DOCUMENT_NOT_FOUND`다. route는 DMS의 public metadata/readability 계약에 위임하며 HTTP adapter가 storage key를 추가로 조회하지 않는다.

### `API-DOC-004` — inline content

```http
GET /documents/{document_id}/content
```

응답은 `DocumentContentStream`을 wrapping한 streaming response다.

- status `200 OK`
- `Content-Type`: 저장된 content type
- `Content-Length`: 저장된 byte 수
- `Content-Disposition`: `inline; filename*=UTF-8''<percent-encoded-filename>`
- caller가 chunk size를 지정하는 query는 없다.
- 정상 종료, producer 오류, client disconnect 모두에서 DMS stream을 한 번 닫는다.

### `API-DOC-005` — attachment download

```http
GET /documents/{document_id}/download?chunk_size=65536
```

`API-DOC-004`와 같은 stream lifecycle을 사용하지만 다음 차이가 있다.

- `Content-Disposition`이 `attachment`
- `chunk_size` 기본값은 `65536` bytes
- 허용 범위는 `1`부터 `8388608` bytes까지
- 범위를 벗어나면 DMS 호출 전에 `400 VALIDATION_ERROR`

### `API-DOC-006` — soft delete

```http
DELETE /documents/{document_id}
```

`hard`가 생략되거나 `false`이면 SDK의 `delete_document(..., hard_delete=False)`를 호출한다. 성공 body는 `SCHEMA-DOC-003`이며 `hard_deleted=false`다. DMS가 soft delete를 수행하면 object와 metadata의 후속 read 정책은 DMS runtime에 따른다.

### `API-DOC-007` — hard delete

```http
DELETE /documents/{document_id}?hard=true
```

`hard=true`이면 SDK의 `delete_document(..., hard_delete=True)`를 호출한다. 현재 application에는 hard-delete role/scope 검사가 없으므로 인증/권한은 이 서비스의 계약이 아니다. 성공 body는 `SCHEMA-DOC-003`이며 `hard_deleted=true`다.

## 5. 운영·문서 지원 API

### `API-OPS-001` — liveness

```http
GET /health/liveness
```

```json
{"status":"ok"}
```

process가 route를 처리할 수 있음을 나타내며 storage 연결을 검사하지 않는다.

### `API-OPS-002` — readiness

```http
GET /health/readiness
```

기본 응답은 다음 형태다.

```json
{
  "status": "ok",
  "ok": true,
  "details": {"dms": {"ok": true, "required": true}}
}
```

- `readiness_check`를 주입하면 bool 또는 `{ok, status, details}` 결과를 host policy로 사용한다.
- 주입 runtime이 있으면 host-owned SQLAlchemy engine 연결과 MinIO bucket 존재를 검사한다.
- SDK만 주입하면 SDK health API에 의존하지 않고 DMS dependency가 존재하는지만 확인한다.
- runtime/SDK가 준비되지 않았거나 required check가 실패하면 `503`과 `status=error`를 반환한다.

### Framework-provided support routes

| API ID | 경로 | 설명 |
| --- | --- | --- |
| `API-SYS-001` | `GET /openapi.json` | 생성된 OpenAPI schema JSON |
| `API-SYS-002` | `GET /docs` | Swagger UI HTML |
| `API-SYS-003` | `GET /docs/oauth2-redirect` | Swagger UI 지원 callback HTML |
| `API-SYS-004` | `GET /redoc` | ReDoc HTML |

위 route들은 `app.routes`에는 live로 존재하지만 OpenAPI `paths`에는 자기 자신의 support route가 포함되지 않는다. 따라서 OpenAPI JSON만 열거해 전체 외부 표면이라고 판단하지 않는다.

## 6. Public schema

### `SCHEMA-DOC-001` — `DocumentMetadataResponse`

| field | 타입 | 설명 |
| --- | --- | --- |
| `document_id` | string | 공개 문서 ID |
| `original_filename` | string | 원본 filename |
| `content_type` | string | media type |
| `file_size` | integer | bytes |
| `status` | enum | `uploaded`, `available`, `deleting`, `deleted`, `failed` |
| `created_at` | date-time | 생성 시각 |
| `updated_at` | date-time | 변경 시각 |
| `deleted_at` | date-time/null | 삭제 시각 |
| `created_by` | string/null | 작성자. 현재 upload HTTP form에서 받지 않는다. |
| `checksum` | string/null | DMS가 계산한 checksum |
| `metadata` | object | SDK의 `extra_metadata`를 외부 이름으로 표현한 값. 현재 HTTP upload에서는 `{}`. |

`storage_key`는 allowlist에 없으므로 절대 public response에 포함하지 않는다. 구현: `schemas.py:10-27`.

### `SCHEMA-DOC-002` — `DocumentPageResponse`

```json
{"items": [], "next_cursor": null, "has_more": false}
```

`items`는 `SCHEMA-DOC-001` 배열이며 세 key 모두 응답에 존재한다. 구현: `schemas.py:29-35`.

### `SCHEMA-DOC-003` — `DeleteDocumentResponse`

```json
{
  "document_id": "<id>",
  "deleted": true,
  "hard_deleted": false,
  "status": "deleted"
}
```

구현: `schemas.py:37-44`.

### `SCHEMA-ERR-001` — `ErrorResponse`

`error.code`, `error.message`, `error.correlation_id`가 항상 존재한다. 구현: `schemas.py:46-54`.

### `SCHEMA-OPS-001` — readiness payload

readiness는 `status`, `ok`, `details`를 사용한다. `details`의 구체적인 storage 항목은 host runtime 또는 주입된 `readiness_check`가 소유하므로 SDK public schema로 고정하지 않는다.

## 7. 오류 계약과 도달성

오류 mapping은 `docmesh_doc/errors.py:23-103`에 등록되어 있으며 실제 route 도달성과 OpenAPI 선언은 구분한다.

| HTTP | code | 상황 | 현재 HTTP 도달성 |
| ---: | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | multipart/query/type/값 검증 실패 | 도달 가능 |
| `403` | `FORBIDDEN` | DMS access policy 거부 | SDK가 발생시키면 도달 가능 |
| `404` | `DOCUMENT_NOT_FOUND` | 문서 없음 또는 deleted/read 불가 | 도달 가능 |
| `404` | `NOT_FOUND` | unknown route/HTTP 404 | framework fallback |
| `405` | `METHOD_NOT_ALLOWED` | 허용되지 않은 method | framework fallback |
| `409` | `DOCUMENT_ALREADY_EXISTS` | duplicate document ID | DMS runtime에 따라 도달 가능; route OpenAPI에는 별도 선언 없음 |
| `413` | `DOCUMENT_TOO_LARGE` | DMS file-size limit 초과 | 도달 가능 |
| `425` | `IDEMPOTENCY_IN_PROGRESS` | DMS idempotency operation 진행 중 | mapping 등록; 현재 HTTP 입력/route 없음 |
| `500` | `DOCUMENT_CONSISTENCY_ERROR` | metadata/object 정합성 실패 | DMS runtime에 따라 도달 가능 |
| `500` | `DATA_RESET_ERROR` | reset 실패 | 현재 HTTP reset route 없음 |
| `500` | `INTERNAL_ERROR` | 기타 DMS/처리 오류 | fallback |
| `503` | `SERVICE_UNAVAILABLE` | SDK dependency 미준비 | 도달 가능 |
| `503` | `SERVICE_CONFIGURATION_ERROR` | 설정 오류 | startup/runtime |
| `503` | `OBJECT_STORAGE_ERROR` | MinIO 오류 | 도달 가능 |
| `503` | `METADATA_STORE_ERROR` | metadata store 오류 | 도달 가능 |
| `409` | `IDEMPOTENCY_CONFLICT` | scope/key fingerprint 충돌 | mapping 등록; 현재 HTTP 입력/route 없음 |
| `404` | `UPLOAD_OPERATION_NOT_FOUND` | operation 조회 실패 | mapping 등록; 현재 HTTP route 없음 |

현재 `router.py:_ERROR_RESPONSES`는 `400/403/404/413/500/503`를 route metadata에 선언한다. runtime renderer가 지원하는 모든 mapping을 OpenAPI가 자동으로 의미하지 않으므로, 위 표의 “등록/route 없음” 상태를 유지한다.

## 8. Hosting API

### `API-HOST-001` — `create_application`

```python
from docmesh_doc.application import create_application

app = create_application(
    sdk=host_owned_sdk,
    root_path="/dms",
)
```

현재 signature:

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

- `sdk`와 `runtime`을 동시에 전달하면 `ValueError`다.
- `runtime`을 전달하면 `runtime.sdk`를 route dependency에 사용한다.
- `sdk` 또는 `runtime`을 주입한 경우 caller ownership을 보존하며 application lifespan이 닫지 않는다. 근거: `test_api.py::test_lifespan_does_not_close_host_owned_dms_sdk`, `test_lifespan_does_not_close_injected_host_owned_runtime`.
- 둘 다 생략하면 lifespan에서 `create_dms_runtime(settings)`를 호출하고, application이 만든 runtime의 `close()`를 종료 시 호출한다.
- `settings`를 생략하면 process environment에서 `DmsSettings.from_env()`를 사용한다.
- `root_path`는 settings 값을 override한다.
- `readiness_check`는 host가 readiness 결과를 명시적으로 제공하는 hook이다.

### `API-HOST-002` — ASGI object

`docmesh_doc.main:app`은 `create_application()` 결과이며 `pyproject.toml`의 `[tool.fastapi].entrypoint`가 같은 symbol을 가리킨다.

```bash
uv run python -m fastapi run \
  --entrypoint docmesh_doc.main:app \
  --host 0.0.0.0 \
  --port 8000
```

## 9. 완전한 역추적 matrix

모든 `API-*` ID를 한 행씩 유지한다.

| API ID | 근거 | 구현 | 테스트 근거 | Example ID |
| --- | --- | --- | --- | --- |
| `API-DOC-001` | `REQ-DOC-001` | `router.py:89-118` | `test_api.py::test_upload_ignores_metadata_form_field`; `test_upload_location_respects_root_path` | `EX-DOC-001` |
| `API-DOC-002` | `REQ-DOC-001` | `router.py:121-140` | `test_api.py::test_list_passes_opaque_cursor_limit_and_status_to_dms`; `test_invalid_query_is_a_product_400_error` | `EX-DOC-002` |
| `API-DOC-003` | `REQ-DOC-001` | `router.py:143-153` | `test_api.py::test_dms_not_found_is_mapped_without_leaking_exception_text` | `EX-DOC-003`, `EX-ERR-003` |
| `API-DOC-004` | `REQ-DOC-001` | `router.py:156-166` | `test_api.py::test_inline_content_uses_streaming_response`; `test_streaming.py::test_stream_closes_dms_resource_on_client_disconnect` | `EX-DOC-004` |
| `API-DOC-005` | `REQ-DOC-001` | `router.py:169-186` | `test_api.py::test_streaming_download_closes_dms_stream`; `test_streaming.py::test_stream_closes_dms_resource_on_client_disconnect` | `EX-DOC-005`, `EX-ERR-001` |
| `API-DOC-006` | `REQ-DOC-001` | `router.py:189-204` | `test_api.py::test_hard_delete_is_not_gated_by_user_permission` (`hard=false` branch not separately named) | `EX-DOC-006` |
| `API-DOC-007` | `REQ-DOC-001` | `router.py:189-204` | `test_api.py::test_hard_delete_is_not_gated_by_user_permission` | `EX-DOC-007` |
| `API-OPS-001` | `REQ-OPS-001` | `application.py:157-159` | `test_api.py::test_liveness_and_injected_sdk_readiness_are_available_without_dms_health_api` | `EX-OPS-001` |
| `API-OPS-002` | `REQ-OPS-001` | `application.py:49-88`, `161-164` | `test_api.py::test_host_readiness_check_can_return_service_unavailable` | `EX-OPS-002` |
| `API-SYS-001` | `REQ-CONTRACT-001` | FastAPI default assembly | runtime route/OpenAPI probe; dedicated test gap | `EX-SYS-001` |
| `API-SYS-002` | `REQ-CONTRACT-001` | FastAPI default assembly | runtime route probe; dedicated test gap | `EX-SYS-002` |
| `API-SYS-003` | `REQ-CONTRACT-001` | FastAPI default assembly | runtime route probe; dedicated test gap | `EX-SYS-003` |
| `API-SYS-004` | `REQ-CONTRACT-001` | FastAPI default assembly | runtime route probe; dedicated test gap | `EX-SYS-004` |
| `API-HOST-001` | `REQ-HOST-001` | `application.py:91-190` | `test_api.py` lifespan/ownership cases; `test_factory.py` runtime cases | `EX-HOST-001` |
| `API-HOST-002` | `REQ-HOST-001` | `main.py:1-4`, `pyproject.toml` | import/runtime configuration; dedicated startup test gap | `EX-HOST-002` |

## 10. Known gaps and non-contracts

- 현재 API에는 authentication, authorization, `/token`, `/user`, search, presigned URL, upload idempotency field, operation lookup, reset route가 없다.
- `storage_key`와 DMS internal metadata는 HTTP response에 노출하지 않는다.
- framework support route는 live surface지만 OpenAPI path matrix만으로는 확인할 수 없다.
- runtime error mapping 중 idempotency/operation/reset 항목은 미래 route를 약속하지 않는다.
- `app.version=0.4.0`과 project version `0.5.0` 불일치는 문서화만 했으며 이 작업에서 code를 변경하지 않았다.
