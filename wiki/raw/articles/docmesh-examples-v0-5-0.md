---
source_url: https://github.com/kyundae-kim/docmesh-doc/wiki/Examples-v0.5.0
ingested: 2026-08-17
sha256: 247f4e2d7aa062583f87fc38d85a4515b3d5f9742d213b48998a659ec2c720b9
---
# 공개 API 사용 예시 v0.5.0

[[API-Reference-v0.5.0]]에 정의된 현재 `docmesh_doc` surface를 같은 shell에서 확인하는 예시다. 각 `EX-*` ID는 API ID와 직접 연결된다.

> **현재 구현 기준:** 인증 라우터와 bearer middleware가 없다. 예시에는 `Authorization` header를 넣지 않는다. 인증은 외부 reverse proxy/상위 application이 제공할 수 있지만 이 서비스의 현재 HTTP 계약에는 포함되지 않는다.

> 실제 storage에 쓰는 예시는 document를 생성한다. `DOCUMENT_ID`를 재사용하면 duplicate 오류가 날 수 있으므로 실행 전 값을 바꾸고, 각 흐름의 마지막 delete를 실행한다. `<...>` placeholder에는 실제 credential을 직접 쓰지 말고 runtime secret injection을 사용한다.

## 1. Example → API trace

| Example ID | 시나리오 | API ID |
| --- | --- | --- |
| `EX-OPS-001` | liveness | `API-OPS-001` |
| `EX-OPS-002` | readiness | `API-OPS-002` |
| `EX-DOC-001` | caller ID upload | `API-DOC-001` |
| `EX-DOC-002` | list와 opaque cursor | `API-DOC-002` |
| `EX-DOC-003` | metadata 조회 | `API-DOC-003` |
| `EX-DOC-004` | inline content | `API-DOC-004` |
| `EX-DOC-005` | attachment download/chunk size | `API-DOC-005` |
| `EX-DOC-006` | soft delete | `API-DOC-006` |
| `EX-DOC-007` | hard delete | `API-DOC-007` |
| `EX-ERR-001` | validation error | `API-DOC-002`, `API-DOC-005` |
| `EX-ERR-002` | not found error | `API-DOC-003` |
| `EX-ERR-003` | missing upload file | `API-DOC-001` |
| `EX-SYS-001` | OpenAPI JSON | `API-SYS-001` |
| `EX-SYS-002` | Swagger UI | `API-SYS-002` |
| `EX-SYS-003` | OAuth redirect support route | `API-SYS-003` |
| `EX-SYS-004` | ReDoc | `API-SYS-004` |
| `EX-HOST-001` | Python application factory | `API-HOST-001` |
| `EX-HOST-002` | ASGI entrypoint | `API-HOST-002` |

## 2. 공통 준비

```bash
export BASE_URL='http://127.0.0.1:8000'
export DOCUMENT_ID="docmesh-example-$(date +%s)"
export EXAMPLE_FILE='/tmp/docmesh-example.txt'
printf '%s\n' 'DocMesh example document' > "${EXAMPLE_FILE}"
```

`ROOT_PATH=/dms`로 reverse proxy에 배포했다면 `BASE_URL='https://service.example.invalid/dms'`처럼 외부 prefix를 포함한다.

## 3. 운영 endpoint

<a id="ex-ops-001"></a>

### `EX-OPS-001` — `API-OPS-001` liveness

```bash
curl --fail --silent --show-error \
  "${BASE_URL}/health/liveness"
```

예상 body:

```json
{"status":"ok"}
```

liveness는 storage 연결을 검사하지 않는다.

<a id="ex-ops-002"></a>

### `EX-OPS-002` — `API-OPS-002` readiness

```bash
curl --silent --show-error \
  --write-out '\nHTTP %{http_code}\n' \
  "${BASE_URL}/health/readiness"
```

runtime과 MinIO bucket이 준비되면 `200`과 `status=ok`; required dependency가 실패하면 `503`과 `status=error`다. 오류 body까지 확인해야 하므로 이 예시에는 `--fail`을 사용하지 않는다.

## 4. 문서 lifecycle

<a id="ex-doc-001"></a>

### `EX-DOC-001` — `API-DOC-001` caller ID upload

```bash
UPLOAD_RESPONSE="$({
  curl --fail --silent --show-error \
    --request POST "${BASE_URL}/documents" \
    --form "file=@${EXAMPLE_FILE};type=text/plain" \
    --form "document_id=${DOCUMENT_ID}"
})"
printf '%s\n' "${UPLOAD_RESPONSE}"
export UPLOAD_ID="$({
  printf '%s' "${UPLOAD_RESPONSE}" | \
    python -c 'import json, sys; print(json.load(sys.stdin)["document_id"])'
})"
```

curl이 multipart boundary를 포함한 `Content-Type`을 자동으로 생성하므로 header를 직접 지정하지 않는다.

성공은 `201`과 `Location: /documents/${DOCUMENT_ID}`다. 현재 router가 선언한 upload field는 `file`과 선택적 `document_id`뿐이다. `metadata`, `created_by`, `checksum` form field는 public input이 아니며 전송하지 않는다.

<a id="ex-doc-002"></a>

### `EX-DOC-002` — `API-DOC-002` list와 cursor 전달

```bash
LIST_RESPONSE="$({
  curl --fail --silent --show-error \
    --get "${BASE_URL}/documents" \
    --data-urlencode 'limit=25' \
    --data-urlencode 'status=available'
})"
printf '%s\n' "${LIST_RESPONSE}"
export NEXT_CURSOR="$({
  printf '%s' "${LIST_RESPONSE}" | \
    python -c 'import json, sys; print(json.load(sys.stdin).get("next_cursor") or "")'
})"

if [ -n "${NEXT_CURSOR}" ]; then
  curl --fail --silent --show-error \
    --get "${BASE_URL}/documents" \
    --data-urlencode "cursor=${NEXT_CURSOR}" \
    --data-urlencode 'limit=25' \
    --data-urlencode 'status=available'
fi
```

`next_cursor`는 opaque 값이다. 내용을 해석하거나 수정하지 않고 같은 `limit`과 `status`로 전달한다. `limit`은 `1`~`1000`, `status`는 `uploaded`, `available`, `deleting`, `deleted`, `failed`다.

<a id="ex-doc-003"></a>

### `EX-DOC-003` — `API-DOC-003` metadata 조회

```bash
curl --fail --silent --show-error \
  "${BASE_URL}/documents/${UPLOAD_ID}"
```

응답은 다음 field를 포함할 수 있다: `document_id`, `original_filename`, `content_type`, `file_size`, `status`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `checksum`, `metadata`. `storage_key`는 포함되지 않는다.

<a id="ex-doc-004"></a>

### `EX-DOC-004` — `API-DOC-004` inline content

```bash
curl --fail --silent --show-error \
  --output /tmp/docmesh-inline.txt \
  "${BASE_URL}/documents/${UPLOAD_ID}/content"

cmp -- "${EXAMPLE_FILE}" /tmp/docmesh-inline.txt
```

응답은 저장된 `Content-Type`, `Content-Length`, `Content-Disposition: inline`을 사용한다. server-side DMS stream은 정상 종료와 client disconnect 모두에서 정리된다.

<a id="ex-doc-005"></a>

### `EX-DOC-005` — `API-DOC-005` attachment download

```bash
curl --fail --silent --show-error --location \
  --output /tmp/docmesh-download.txt \
  "${BASE_URL}/documents/${UPLOAD_ID}/download?chunk_size=65536"

cmp -- "${EXAMPLE_FILE}" /tmp/docmesh-download.txt
```

`chunk_size`는 `1`~`8388608` bytes 범위다. 파일 이름은 `Content-Disposition: attachment`로 전달된다.

<a id="ex-doc-006"></a>

### `EX-DOC-006` — `API-DOC-006` soft delete

```bash
curl --fail --silent --show-error \
  --request DELETE \
  "${BASE_URL}/documents/${UPLOAD_ID}"
```

성공 response의 `hard_deleted`는 `false`다. 이후 단건 metadata/content/download를 호출하면 DMS deleted/readability 정책에 따라 `404 DOCUMENT_NOT_FOUND`가 반환될 수 있다. 삭제한 document를 확인하려면 목록 API의 `status=deleted`를 사용한다.

<a id="ex-doc-007"></a>

### `EX-DOC-007` — `API-DOC-007` hard delete

soft-deleted document와 다른 ID를 사용해 hard delete 흐름을 검증한다.

```bash
export HARD_DELETE_ID="docmesh-hard-delete-$(date +%s)"

curl --fail --silent --show-error \
  --request POST "${BASE_URL}/documents" \
  --form "file=@${EXAMPLE_FILE};type=text/plain" \
  --form "document_id=${HARD_DELETE_ID}"

curl --fail --silent --show-error \
  --request DELETE \
  "${BASE_URL}/documents/${HARD_DELETE_ID}?hard=true"
```

현재 service code에는 hard-delete role/scope 검사가 없으므로 별도 bearer token이 필요하지 않다. 외부 인증 계층이 있으면 그 계층의 정책이 먼저 적용될 수 있다.

## 5. 오류 예시

<a id="ex-err-001"></a>

### `EX-ERR-001` — 잘못된 limit 또는 chunk size

```bash
curl --silent --show-error \
  --get "${BASE_URL}/documents" \
  --data-urlencode 'limit=0' \
  --write-out '\nHTTP %{http_code}\n'

curl --silent --show-error \
  "${BASE_URL}/documents/${UPLOAD_ID}/download?chunk_size=0" \
  --write-out '\nHTTP %{http_code}\n'
```

예상 envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid.",
    "correlation_id": "<correlation-id>"
  }
}
```

<a id="ex-err-002"></a>

### `EX-ERR-002` — 존재하지 않는 document

```bash
curl --silent --show-error \
  --header 'X-Correlation-ID: example-not-found' \
  --write-out '\nHTTP %{http_code}\n' \
  "${BASE_URL}/documents/does-not-exist"
```

예상 status는 `404`이고 `error.code`는 `DOCUMENT_NOT_FOUND`다. 내부 DMS exception message는 response에 노출되지 않는다.

<a id="ex-err-003"></a>

### `EX-ERR-003` — file 없는 upload

```bash
curl --silent --show-error \
  --request POST "${BASE_URL}/documents" \
  --write-out '\nHTTP %{http_code}\n'
```

예상 status는 `400`, code는 `VALIDATION_ERROR`다.

## 6. OpenAPI와 API UI

<a id="ex-sys-001"></a>

### `EX-SYS-001` — `API-SYS-001` OpenAPI JSON

```bash
curl --fail --silent --show-error \
  --output /tmp/docmesh-openapi.json \
  "${BASE_URL}/openapi.json"
python -m json.tool /tmp/docmesh-openapi.json > /dev/null
python -c 'import json; d=json.load(open("/tmp/docmesh-openapi.json")); print("\n".join(sorted(d["paths"])))'
```

`paths`에는 health/document route가 포함되며 `/openapi.json`, `/docs`, `/docs/oauth2-redirect`, `/redoc` 자신은 포함되지 않는다. FastAPI support route는 live route inventory에서 별도로 확인한다.

<a id="ex-sys-002"></a>

### `EX-SYS-002` — `API-SYS-002` Swagger UI

```bash
curl --fail --silent --show-error \
  --output /tmp/docmesh-swagger.html \
  "${BASE_URL}/docs"
```

<a id="ex-sys-003"></a>

### `EX-SYS-003` — `API-SYS-003` OAuth redirect support route

현재 app에 OAuth2 auth flow는 없지만 FastAPI docs UI가 제공하는 지원 route는 live다.

```bash
curl --fail --silent --show-error \
  --output /tmp/docmesh-oauth-redirect.html \
  "${BASE_URL}/docs/oauth2-redirect"
```

<a id="ex-sys-004"></a>

### `EX-SYS-004` — `API-SYS-004` ReDoc

```bash
curl --fail --silent --show-error \
  --output /tmp/docmesh-redoc.html \
  "${BASE_URL}/redoc"
```

## 7. Hosting 예시

<a id="ex-host-001"></a>

### `EX-HOST-001` — Python `create_application`

```python
from docmesh_doc.application import create_application
from docmesh_doc.dms_factory import DmsSettings

settings = DmsSettings(
    metadata_backend="sqlite",
    sqlite_path=":memory:",
    minio_endpoint="localhost:9000",
    minio_access_key="<access-key>",
    minio_secret_key="<secret-key>",
    minio_bucket="documents",
    minio_secure=False,
)

app = create_application(
    settings=settings,
    root_path="/dms",
)
```

이 코드는 application object를 조립한다. `TestClient` 또는 ASGI server가 lifespan을 시작하면 실제 MinIO bucket 접근이 필요하다. 이미 host가 DMS SDK를 만들었다면 `sdk=...`를 주입하고, `sdk`와 `runtime`을 동시에 주입하지 않는다. 주입 자원은 caller-owned다.

<a id="ex-host-002"></a>

### `EX-HOST-002` — `API-HOST-002` ASGI entrypoint

```bash
uv run python -m fastapi run \
  --entrypoint docmesh_doc.main:app \
  --host 0.0.0.0 \
  --port 8000
```

또는 pyproject의 `[tool.fastapi] entrypoint`를 사용해 다음처럼 실행할 수 있다.

```bash
uv run fastapi run --host 0.0.0.0 --port 8000
```

## 8. 실행 전 확인

1. `DMS_METADATA_BACKEND`를 `postgresql` 또는 `sqlite`로 명시한다.
2. 선택한 metadata backend의 필수 field와 MinIO bucket을 준비한다.
3. `POSTGRES_DSN`을 설정하지 않는다.
4. `BASE_URL`에 외부 `ROOT_PATH`를 포함한다.
5. `curl --fail`은 오류 response를 shell failure로 만들므로 오류 예시에서는 `--fail`을 생략한다.
6. 생성한 document를 soft/hard delete해 example resource를 남기지 않는다.

## 9. Source/test trace

| Example group | 구현 source | 테스트 근거 |
| --- | --- | --- |
| upload/list/read/delete | `docmesh_doc/router.py:89-204` | `test_docmesh_doc/test_api.py` |
| stream close | `docmesh_doc/router.py:41-86` | `test_docmesh_doc/test_streaming.py::test_stream_closes_dms_resource_on_client_disconnect` |
| error envelope/correlation | `docmesh_doc/application.py:40-45`, `errors.py:106-124` | `test_docmesh_doc/test_api.py` error cases |
| storage assembly | `docmesh_doc/dms_factory.py:18-251` | `test_docmesh_doc/test_factory.py` |
| app ownership/readiness | `docmesh_doc/application.py:49-190` | `test_docmesh_doc/test_api.py` lifespan/readiness cases |
