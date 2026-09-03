---
source_url: https://github.com/kyundae-kim/docmesh-doc/wiki/Examples-v0.7.0
ingested: 2026-09-04
sha256: c94df646e12f531df2cd2caed3b8b8f877ff970a9953746b909b64aa1aeffe4b
---
# DocMesh Document Service 실행 예시 v0.7.0

이 페이지는 [[API-Reference-v0.7.0]]의 모든 `API-*` 계약을 같은 release의 shell/Python/ASGI 예시로 연결한다.

- 기준 project version: `0.7.0`
- 기준 implementation commit: `14cef6e25943ed5ab9f7f0c56b5948c130b69c7e`
- upstream DMS: `dms-core 0.11.0`
- configuration: [[Configuration-v0.7.0]]
- 인증: 현재 application에는 bearer/OAuth2 middleware가 없으므로 `Authorization` header를 사용하지 않는다.
- 검증: shell block은 `bash -n`, Python block은 AST compile, JSON block은 JSON parse 대상이다.

> **실행 순서:** 1) 공통 준비 → 2) upload/list/read → 3) operation/management → 4) delete/cleanup 순으로 실행한다. `API-MGMT-*`와 hard delete는 격리된 operator/test 환경에서만 실행한다.

> **application identity:** server는 `DMS_APPLICATION_USER_ID` 하나의 personal partition과 `admin` access context를 모든 일반 작업에 사용한다. `X-User-ID`, `X-Subject`, `X-Tenant-ID`, `X-Roles` 등 header로 이를 바꿀 수 없다.

## 1. Example → API 역추적 matrix

각 `API-*`에는 하나 이상의 명시적 `EX-*`를 배정한다. `EX-ERR-*`는 정상 예시와 별도의 오류 variant다.

| Example ID | API ID | 시나리오 |
| --- | --- | --- |
| `EX-DOC-001` | `API-DOC-001` | multipart stream upload |
| `EX-DOC-002` | `API-DOC-002` | base64 JSON upload |
| `EX-DOC-003` | `API-DOC-003` | multipart file upload |
| `EX-DOC-004` | `API-DOC-004` | cursor list |
| `EX-DOC-005` | `API-DOC-005` | explicit page facade |
| `EX-DOC-006` | `API-DOC-006` | iterator list |
| `EX-DOC-007` | `API-DOC-007` | public metadata |
| `EX-DOC-008` | `API-DOC-008` | inline stream |
| `EX-DOC-009` | `API-DOC-009` | attachment download |
| `EX-DOC-010` | `API-DOC-010` | parameterized soft delete |
| `EX-DOC-011` | `API-DOC-011` | eager content |
| `EX-DOC-012` | `API-DOC-012` | async stream route |
| `EX-DOC-013` | `API-DOC-013` | chunk iterator response |
| `EX-DOC-014` | `API-DOC-014` | checksum-aware copy |
| `EX-DOC-015` | `API-DOC-015` | explicit soft delete |
| `EX-DOC-016` | `API-DOC-016` | explicit hard delete |
| `EX-UPLOAD-001` | `API-UPLOAD-001` | upload operation lookup |
| `EX-MGMT-001` | `API-MGMT-001` | internal metadata |
| `EX-MGMT-002` | `API-MGMT-002` | consistency inspection |
| `EX-MGMT-003` | `API-MGMT-003` | bounded recovery candidates |
| `EX-MGMT-004` | `API-MGMT-004` | recovery candidate iterator |
| `EX-MGMT-005` | `API-MGMT-005` | single reconciliation |
| `EX-MGMT-006` | `API-MGMT-006` | batch reconciliation |
| `EX-MGMT-007` | `API-MGMT-007` | reconciliation plan execution |
| `EX-MGMT-008` | `API-MGMT-008` | global clear all data |
| `EX-MGMT-009` | `API-MGMT-009` | global data-load initialization |
| `EX-MGMT-010` | `API-MGMT-010` | configured partition clear |
| `EX-MGMT-011` | `API-MGMT-011` | configured partition initialization |
| `EX-OPS-001` | `API-OPS-001` | liveness |
| `EX-OPS-002` | `API-OPS-002` | readiness |
| `EX-SYS-001` | `API-SYS-001` | OpenAPI JSON |
| `EX-SYS-002` | `API-SYS-002` | Swagger UI |
| `EX-SYS-003` | `API-SYS-003` | OAuth redirect support route |
| `EX-SYS-004` | `API-SYS-004` | ReDoc |
| `EX-HOST-001` | `API-HOST-001` | `create_application()` |
| `EX-HOST-002` | `API-HOST-002` | ASGI entrypoint |
| `EX-HOST-003` | `API-HOST-003` | `DmsSettings.from_env()` |
| `EX-HOST-004` | `API-HOST-004` | `create_dms_runtime()` |
| `EX-HOST-005` | `API-HOST-005` | readiness and close ownership |
| `EX-ERR-001` | `API-DOC-001`, `API-DOC-002`, `API-DOC-004`, `API-DOC-009` | validation errors |
| `EX-ERR-002` | `API-DOC-007` | not found and correlation ID |

## 2. 공통 준비

서버 환경은 [[Configuration-v0.7.0]]에 따라 먼저 주입한다. 이 예시는 request identity header를 사용하지 않는다.

```bash
export BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
export EXAMPLE_FILE="${EXAMPLE_FILE:-/tmp/docmesh-example-v070.txt}"
printf '%s\n' 'DocMesh v0.7.0 example document' > "${EXAMPLE_FILE}"
export DOCUMENT_ID="docmesh-example-$(date +%s)"
```

`ROOT_PATH=/dms`로 reverse proxy에 배포했다면 `BASE_URL`에 외부 prefix를 포함한다. 예: `https://service.example.invalid/dms`.

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

liveness는 storage connection을 검사하지 않는다.

<a id="ex-ops-002"></a>

### `EX-OPS-002` — `API-OPS-002` readiness

```bash
curl --silent --show-error \
  --write-out '\nHTTP %{http_code}\n' \
  "${BASE_URL}/health/readiness"
```

application-owned runtime이 metadata store와 MinIO bucket을 사용할 수 있으면 `200`/`status=ok`, required dependency가 실패하면 `503`/`status=error`다. 오류 body도 확인해야 하므로 `--fail`을 사용하지 않는다.

## 4. 문서 upload

<a id="ex-doc-001"></a>

### `EX-DOC-001` — `API-DOC-001` multipart stream upload

```bash
UPLOAD_RESPONSE=$(curl --fail --silent --show-error \
  --request POST "${BASE_URL}/documents" \
  --form "file=@${EXAMPLE_FILE};type=text/plain" \
  --form "document_id=${DOCUMENT_ID}" \
  --form 'metadata={"source":"wiki-example","version":"0.7.0"}' \
  --form 'created_by=wiki-example')
printf '%s\n' "${UPLOAD_RESPONSE}"
export UPLOAD_ID=$(printf '%s' "${UPLOAD_RESPONSE}" | \
  python -c 'import json, sys; print(json.load(sys.stdin)["document_id"])')
```

`curl`이 multipart boundary를 자동 생성하므로 `Content-Type` header를 직접 지정하지 않는다. 성공 response는 `201`이며 idempotent 재시도 결과는 `200`일 수 있다. `Location`은 `/documents/${UPLOAD_ID}`다.

<a id="ex-doc-002"></a>

### `EX-DOC-002` — `API-DOC-002` base64 JSON upload

```bash
export BYTES_ID="docmesh-bytes-$(date +%s)"
export BYTES_CONTENT=$(python -c 'import base64; print(base64.b64encode(b"bytes example").decode("ascii"))')
BYTES_RESPONSE=$(curl --fail --silent --show-error \
  --request POST "${BASE_URL}/documents/bytes" \
  --header 'Content-Type: application/json' \
  --data "$(python -c 'import json, os; print(json.dumps({
    "content_base64": os.environ["BYTES_CONTENT"],
    "filename": "bytes.txt",
    "content_type": "text/plain",
    "document_id": os.environ["BYTES_ID"],
    "metadata": {"source": "wiki-example", "version": "0.7.0"},
    "created_by": "wiki-example"
  }))')")
printf '%s\n' "${BYTES_RESPONSE}"
```

`content_base64`, `filename`, `content_type`가 required다. `metadata`는 object여야 한다. `checksum`, `idempotency_key`, `idempotency_scope`는 이 JSON variant에서만 추가할 수 있고, `user_id`는 request field가 아니다.

<a id="ex-doc-003"></a>

### `EX-DOC-003` — `API-DOC-003` multipart file upload

```bash
export FILE_ID="docmesh-file-$(date +%s)"
curl --fail --silent --show-error \
  --request POST "${BASE_URL}/documents/file" \
  --form "file=@${EXAMPLE_FILE};type=text/plain" \
  --form "document_id=${FILE_ID}" \
  --form 'metadata={"source":"file-example"}' \
  --form 'created_by=wiki-example'
```

adapter가 임시 파일을 만들고 SDK `upload_file()`을 호출한 뒤 임시 파일을 삭제한다. `file` field의 filename/content type/size/body가 검증된다.

## 5. 문서 목록과 metadata

<a id="ex-doc-004"></a>

### `EX-DOC-004` — `API-DOC-004` cursor list

```bash
LIST_RESPONSE=$(curl --fail --silent --show-error \
  --get "${BASE_URL}/documents" \
  --data-urlencode 'limit=25' \
  --data-urlencode 'status=available')
printf '%s\n' "${LIST_RESPONSE}"
export NEXT_CURSOR=$(printf '%s' "${LIST_RESPONSE}" | \
  python -c 'import json, sys; print(json.load(sys.stdin).get("next_cursor") or "")')

if [ -n "${NEXT_CURSOR}" ]; then
  curl --fail --silent --show-error \
    --get "${BASE_URL}/documents" \
    --data-urlencode "cursor=${NEXT_CURSOR}" \
    --data-urlencode 'limit=25' \
    --data-urlencode 'status=available'
fi
```

`next_cursor`는 opaque 값이다. 내용을 해석·수정하지 않고 같은 partition, `limit`, `status` 조건으로 전달한다.

<a id="ex-doc-005"></a>

### `EX-DOC-005` — `API-DOC-005` explicit page facade

```bash
curl --fail --silent --show-error \
  --get "${BASE_URL}/documents/page" \
  --data-urlencode 'limit=25' \
  --data-urlencode 'status=available'
```

HTTP shape은 cursor list와 같지만 host SDK의 `list_documents_page()`를 명시 호출한다.

<a id="ex-doc-006"></a>

### `EX-DOC-006` — `API-DOC-006` iterator list

```bash
curl --fail --silent --show-error \
  --get "${BASE_URL}/documents/iterator" \
  --data-urlencode 'page_size=25' \
  --data-urlencode 'status=available'
```

response는 `{"items": [...]}` 형태로 iterator를 materialize한다.

<a id="ex-doc-007"></a>

### `EX-DOC-007` — `API-DOC-007` public metadata

```bash
curl --fail --silent --show-error \
  "${BASE_URL}/documents/${UPLOAD_ID}"
```

response에는 `document_id`, filename/content type/size, status, timestamps, `partition`, optional checksum/created_by/metadata가 포함될 수 있다. `user_id`와 `storage_key`는 포함되지 않는다.

## 6. content 읽기

<a id="ex-doc-008"></a>

### `EX-DOC-008` — `API-DOC-008` inline streaming content

```bash
curl --fail --silent --show-error \
  --output /tmp/docmesh-inline-v070.txt \
  "${BASE_URL}/documents/${UPLOAD_ID}/content"
cmp -- "${EXAMPLE_FILE}" /tmp/docmesh-inline-v070.txt
```

`Content-Disposition`은 `inline`이다. stream은 정상 종료, producer exception, client disconnect에서 닫힌다.

<a id="ex-doc-009"></a>

### `EX-DOC-009` — `API-DOC-009` attachment download

```bash
curl --fail --silent --show-error \
  --output /tmp/docmesh-download-v070.txt \
  "${BASE_URL}/documents/${UPLOAD_ID}/download?chunk_size=65536"
cmp -- "${EXAMPLE_FILE}" /tmp/docmesh-download-v070.txt
```

`chunk_size` 허용 범위는 1~8,388,608 bytes이며 disposition은 `attachment`다.

<a id="ex-doc-011"></a>

### `EX-DOC-011` — `API-DOC-011` eager content

```bash
curl --fail --silent --show-error \
  --output /tmp/docmesh-eager-v070.txt \
  "${BASE_URL}/documents/${UPLOAD_ID}/content/eager"
cmp -- "${EXAMPLE_FILE}" /tmp/docmesh-eager-v070.txt
```

전체 content를 buffered response로 받는다. 대용량 문서는 streaming route를 사용한다.

<a id="ex-doc-012"></a>

### `EX-DOC-012` — `API-DOC-012` async stream route

```bash
curl --fail --silent --show-error \
  --output /tmp/docmesh-async-v070.txt \
  "${BASE_URL}/documents/${UPLOAD_ID}/content/async?chunk_size=65536"
cmp -- "${EXAMPLE_FILE}" /tmp/docmesh-async-v070.txt
```

HTTP 호출은 일반 binary response지만 server 내부에서는 async DMS content stream을 사용한다.

<a id="ex-doc-013"></a>

### `EX-DOC-013` — `API-DOC-013` chunk iterator response

```bash
curl --fail --silent --show-error \
  --output /tmp/docmesh-chunks-v070.txt \
  "${BASE_URL}/documents/${UPLOAD_ID}/chunks?chunk_size=1024"
cmp -- "${EXAMPLE_FILE}" /tmp/docmesh-chunks-v070.txt
```

chunk iterator가 response lifecycle에 연결되어 client disconnect에서도 close된다.

<a id="ex-doc-014"></a>

### `EX-DOC-014` — `API-DOC-014` checksum-aware copy

```bash
curl --fail --silent --show-error \
  --dump-header /tmp/docmesh-copy-v070.headers \
  --output /tmp/docmesh-copy-v070.txt \
  "${BASE_URL}/documents/${UPLOAD_ID}/copy?chunk_size=65536&verify_checksum=true"
cmp -- "${EXAMPLE_FILE}" /tmp/docmesh-copy-v070.txt
grep --fixed-strings 'X-Checksum-Verified: true' /tmp/docmesh-copy-v070.headers
```

adapter는 최대 8 MiB bounded spool을 사용하고 `X-Document-Checksum`, `X-Checksum-Verified`를 반환한다.

## 7. 삭제 lifecycle

각 예시는 별도 ID를 생성해 다른 예시와 충돌하지 않게 한다. 이 section의 create/delete pair는 독립적으로 실행할 수 있다.

<a id="ex-doc-010"></a>

### `EX-DOC-010` — `API-DOC-010` parameterized soft delete

```bash
export PARAM_DELETE_ID="docmesh-parameter-delete-$(date +%s)"
curl --fail --silent --show-error \
  --request POST "${BASE_URL}/documents" \
  --form "file=@${EXAMPLE_FILE};type=text/plain" \
  --form "document_id=${PARAM_DELETE_ID}"
curl --fail --silent --show-error \
  --request DELETE \
  "${BASE_URL}/documents/${PARAM_DELETE_ID}?hard=false"
```

`hard`를 생략해도 `false`와 같다. response의 `hard_deleted`는 `false`다.

<a id="ex-doc-015"></a>

### `EX-DOC-015` — `API-DOC-015` explicit soft delete

```bash
export SOFT_DELETE_ID="docmesh-soft-delete-$(date +%s)"
curl --fail --silent --show-error \
  --request POST "${BASE_URL}/documents" \
  --form "file=@${EXAMPLE_FILE};type=text/plain" \
  --form "document_id=${SOFT_DELETE_ID}"
curl --fail --silent --show-error \
  --request DELETE \
  "${BASE_URL}/documents/${SOFT_DELETE_ID}/soft"
```

<a id="ex-doc-016"></a>

### `EX-DOC-016` — `API-DOC-016` explicit hard delete

```bash
export HARD_DELETE_ID="docmesh-hard-delete-$(date +%s)"
curl --fail --silent --show-error \
  --request POST "${BASE_URL}/documents" \
  --form "file=@${EXAMPLE_FILE};type=text/plain" \
  --form "document_id=${HARD_DELETE_ID}"
curl --fail --silent --show-error \
  --request DELETE \
  "${BASE_URL}/documents/${HARD_DELETE_ID}/hard"
```

hard delete는 metadata까지 제거할 수 있다. 외부 authorization이 없는 개발 환경에서는 격리된 operator network에서만 실행한다.

<a id="ex-upload-001"></a>

### `EX-UPLOAD-001` — `API-UPLOAD-001` operation 조회

먼저 bytes upload에 idempotency key를 사용하고 같은 scope/key로 조회한다.

```bash
export IDEMPOTENCY_KEY="wiki-operation-$(date +%s)"
export OPERATION_ID="docmesh-operation-$(date +%s)"
export OPERATION_CONTENT=$(python -c 'import base64; print(base64.b64encode(b"operation example").decode("ascii"))')
OPERATION_RESPONSE=$(python -c 'import json, os; print(json.dumps({
  "content_base64": os.environ["OPERATION_CONTENT"],
  "filename": "operation.txt",
  "content_type": "text/plain",
  "document_id": os.environ["OPERATION_ID"],
  "idempotency_key": os.environ["IDEMPOTENCY_KEY"],
  "idempotency_scope": "wiki-example"
}))')
printf '%s' "${OPERATION_RESPONSE}" > /tmp/docmesh-operation-v070.json
curl --fail --silent --show-error \
  --request POST "${BASE_URL}/documents/bytes" \
  --header 'Content-Type: application/json' \
  --data-binary @/tmp/docmesh-operation-v070.json
curl --fail --silent --show-error \
  "${BASE_URL}/upload-operations/${IDEMPOTENCY_KEY}?scope=wiki-example"
```

`scope` query가 생략되면 server의 configured application user ID를 사용한다. request header로 scope를 공급하지 않는다. 이 예시가 끝난 뒤 `OPERATION_ID`를 hard-delete하거나 격리된 reset으로 정리한다.

## 8. management·recovery

아래 route는 현재 application이 자체 authorization을 제공하지 않으므로 격리된 operator network에서만 호출한다. `storage_key`는 operator가 확인한 값만 전달한다.

<a id="ex-mgmt-001"></a>

### `EX-MGMT-001` — `API-MGMT-001` internal metadata

```bash
curl --fail --silent --show-error \
  "${BASE_URL}/management/documents/${UPLOAD_ID}/metadata"
```

response에 `storage_key`가 포함될 수 있다. 이 payload를 일반 사용자에게 전달하지 않는다.

<a id="ex-mgmt-002"></a>

### `EX-MGMT-002` — `API-MGMT-002` inspection

```bash
curl --fail --silent --show-error \
  "${BASE_URL}/management/documents/${UPLOAD_ID}/inspection"
```

`issue`, metadata/object 존재 여부, consistency를 확인한다.

<a id="ex-mgmt-003"></a>

### `EX-MGMT-003` — `API-MGMT-003` bounded recovery candidates

```bash
curl --fail --silent --show-error \
  --get "${BASE_URL}/management/recovery-candidates" \
  --data-urlencode 'status=failed' \
  --data-urlencode 'offset=0' \
  --data-urlencode 'limit=100'
```

<a id="ex-mgmt-004"></a>

### `EX-MGMT-004` — `API-MGMT-004` recovery iterator

```bash
curl --fail --silent --show-error \
  --get "${BASE_URL}/management/recovery-candidates/iterator" \
  --data-urlencode 'status=failed' \
  --data-urlencode 'page_size=100'
```

<a id="ex-mgmt-005"></a>

### `EX-MGMT-005` — `API-MGMT-005` single reconciliation

```bash
curl --fail --silent --show-error \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{
    "action": "mark_failed",
    "storage_key": "private/<operator-verified-id>",
    "dry_run": true,
    "actor": "wiki-operator"
  }' \
  "${BASE_URL}/management/documents/<operator-verified-id>/reconciliations"
```

`dry_run=true`는 상태를 바꾸지 않고 reconciliation result를 반환한다. 이 block은 operator가 확인한 document ID와 storage key를 넣어 실행하는 manual prerequisite 예시다.

<a id="ex-mgmt-006"></a>

### `EX-MGMT-006` — `API-MGMT-006` bounded batch reconciliation

```bash
curl --fail --silent --show-error \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{
    "status": "failed",
    "action": "mark_failed",
    "offset": 0,
    "limit": 100,
    "dry_run": true,
    "actor": "wiki-operator"
  }' \
  "${BASE_URL}/management/reconciliations"
```

`dry_run=true`로 대상과 counter를 먼저 확인한다.

<a id="ex-mgmt-007"></a>

### `EX-MGMT-007` — `API-MGMT-007` reconciliation plan execution

```bash
curl --fail --silent --show-error \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{
    "status": "failed",
    "action": "mark_failed",
    "items": [
      {
        "document_id": "<operator-verified-id>",
        "action": "mark_failed"
      }
    ],
    "actor": "wiki-operator"
  }' \
  "${BASE_URL}/management/reconciliation-plans/executions"
```

plan execution은 dry-run field가 없고 상태를 변경할 수 있다. `<operator-verified-id>`를 실제 failed document로 바꾼 뒤 격리된 operator 환경에서 실행한다. adapter와 DMS는 fixed application partition을 plan에 적용한다.

<a id="ex-mgmt-008"></a>

### `EX-MGMT-008` — `API-MGMT-008` clear all managed data

> **파괴적 작업:** 현재 service가 관리하는 모든 partition의 metadata, objects, upload operations를 대상으로 한다. production에서 실행하지 말고 별도 test database/bucket에서만 실행한다.

```bash
curl --fail --silent --show-error \
  --request DELETE \
  "${BASE_URL}/management/data"
```

<a id="ex-mgmt-009"></a>

### `EX-MGMT-009` — `API-MGMT-009` global initialize for data load

```bash
curl --fail --silent --show-error \
  --request POST \
  "${BASE_URL}/management/data/initializations"
```

이 global operation은 request partition을 받지 않는다.

<a id="ex-mgmt-010"></a>

### `EX-MGMT-010` — `API-MGMT-010` configured partition clear

> **파괴적 작업:** 현재 application의 configured personal partition만 삭제한다. production에서는 operator authorization과 별도 승인 절차를 사용한다.

```bash
curl --fail --silent --show-error \
  --request DELETE \
  "${BASE_URL}/management/data/partition"
```

partition ID를 query/body로 전달하지 않는다. server의 `DMS_APPLICATION_USER_ID`에서 personal partition을 만든다.

<a id="ex-mgmt-011"></a>

### `EX-MGMT-011` — `API-MGMT-011` configured partition initialization

```bash
curl --fail --silent --show-error \
  --request POST \
  "${BASE_URL}/management/data/partition/initializations"
```

`API-MGMT-009`와 달리 configured personal partition을 DMS에 명시한다.

## 9. 오류 예시

<a id="ex-err-001"></a>

### `EX-ERR-001` — validation error (`API-DOC-001`, `API-DOC-002`, `API-DOC-004`, `API-DOC-009`)

```bash
curl --silent --show-error \
  --get "${BASE_URL}/documents" \
  --data-urlencode 'limit=0' \
  --write-out '\nHTTP %{http_code}\n'

curl --silent --show-error \
  --request POST "${BASE_URL}/documents/bytes" \
  --header 'Content-Type: application/json' \
  --data '{"content_base64":"not-base64","filename":"bad.txt","content_type":"text/plain"}' \
  --write-out '\nHTTP %{http_code}\n'

curl --silent --show-error \
  "${BASE_URL}/documents/${UPLOAD_ID}/download?chunk_size=0" \
  --write-out '\nHTTP %{http_code}\n'
```

예상 status는 `400`, code는 `VALIDATION_ERROR`다. 오류 body를 보기 위해 `--fail`을 생략한다.

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

### `EX-ERR-002` — not found와 correlation ID (`API-DOC-007`)

```bash
curl --silent --show-error \
  --header 'X-Correlation-ID: wiki-not-found-v070' \
  --write-out '\nHTTP %{http_code}\n' \
  "${BASE_URL}/documents/does-not-exist"
```

예상 status는 `404`, `error.code`는 `DOCUMENT_NOT_FOUND`, response와 body의 correlation ID는 `wiki-not-found-v070`다. 내부 exception text는 body에 노출되지 않는다.

현재 default application은 auth middleware를 조립하지 않으므로 별도의 login/forbidden curl 예시는 만들지 않는다. `403 FORBIDDEN`은 injected DMS access policy가 거부하는 host 구성에서만 도달할 수 있다.

## 10. OpenAPI와 API UI

<a id="ex-sys-001"></a>

### `EX-SYS-001` — `API-SYS-001` OpenAPI JSON

```bash
curl --fail --silent --show-error \
  --output /tmp/docmesh-openapi-v070.json \
  "${BASE_URL}/openapi.json"
python -m json.tool /tmp/docmesh-openapi-v070.json > /dev/null
python -c 'import json; data=json.load(open("/tmp/docmesh-openapi-v070.json")); assert data["info"]["version"] == "0.7.0"; print("\n".join(sorted(data["paths"])))'
```

generated `info.version`은 project version `0.7.0`이다. OpenAPI `paths`에는 `/openapi.json`, `/docs`, `/docs/oauth2-redirect`, `/redoc` 자기 자신이 포함되지 않는다.

<a id="ex-sys-002"></a>

### `EX-SYS-002` — `API-SYS-002` Swagger UI

```bash
curl --fail --silent --show-error \
  --output /tmp/docmesh-swagger-v070.html \
  "${BASE_URL}/docs"
```

<a id="ex-sys-003"></a>

### `EX-SYS-003` — `API-SYS-003` OAuth redirect support route

```bash
curl --fail --silent --show-error \
  --output /tmp/docmesh-oauth-redirect-v070.html \
  "${BASE_URL}/docs/oauth2-redirect"
```

이 route가 live라는 것은 FastAPI docs UI support route가 있다는 뜻이며, OAuth provider 또는 token endpoint가 조립되었다는 뜻은 아니다.

<a id="ex-sys-004"></a>

### `EX-SYS-004` — `API-SYS-004` ReDoc

```bash
curl --fail --silent --show-error \
  --output /tmp/docmesh-redoc-v070.html \
  "${BASE_URL}/redoc"
```

## 11. Python hosting 예시

<a id="ex-host-001"></a>

### `EX-HOST-001` — `API-HOST-001` `create_application()`

```python
from docmesh_doc.application import create_application

# Host가 만들고 소유하는 SDK를 주입하는 application boundary.
app = create_application(
    sdk=object(),
    root_path="/dms",
    application_user_id="wiki-user",
    readiness_check=lambda: True,
)
assert app.version == "0.7.0"
assert app.state.dms_context.user_id == "wiki-user"
assert app.state.dms_context.partition.partition_id == "wiki-user"
```

실제 운영에서는 `object()` 대신 host가 조립한 `dms-core 0.11.0` SDK를 주입한다. `sdk=` 또는 `runtime=` 주입 객체는 caller-owned이고 application lifespan이 닫지 않는다.

<a id="ex-host-002"></a>

### `EX-HOST-002` — `API-HOST-002` ASGI entrypoint

```bash
uv run --frozen python -c \
  'from docmesh_doc.main import app; print(app.version, app.title)'
uv run --frozen fastapi run --host 0.0.0.0 --port 8000
```

`pyproject.toml`의 `[tool.fastapi].entrypoint`는 `docmesh_doc.main:app`을 가리킨다. Docker runtime command는 다음과 같다.

```bash
python -m fastapi run docmesh_doc/main.py --host 0.0.0.0
```

<a id="ex-host-003"></a>

### `EX-HOST-003` — `API-HOST-003` `DmsSettings.from_env()`

```python
from docmesh_doc.dms_factory import DmsSettings

settings = DmsSettings.from_env({
    "DMS_METADATA_BACKEND": "sqlite",
    "SQLITE_PATH": ":memory:",
    "MINIO_ENDPOINT": "localhost:9000",
    "MINIO_ACCESS_KEY": "<access-key>",
    "MINIO_SECRET_KEY": "<secret-key>",
    "MINIO_BUCKET": "documents",
    "MINIO_SECURE": "false",
    "DMS_APPLICATION_USER_ID": "  configured-user  ",
    "ROOT_PATH": "dms/",
})
assert settings.application_user_id == "configured-user"
assert settings.root_path == "/dms"
assert settings.metadata_backend == "sqlite"
```

`DmsSettings.from_env()`는 process environment를 변경하지 않고 전달 mapping을 파싱한다. `DMS_APPLICATION_USER_ID`가 없으면 `DMS_USER_ID`, 그 다음 `docmesh-doc` default를 사용한다. `POSTGRES_DSN`은 지원하지 않는다.

<a id="ex-host-004"></a>

### `EX-HOST-004` — `API-HOST-004` `create_dms_runtime()`

```python
from docmesh_doc.dms_factory import DmsSettings, create_dms_runtime

settings = DmsSettings(
    metadata_backend="sqlite",
    sqlite_path=":memory:",
    minio_endpoint="localhost:9000",
    minio_access_key="<access-key>",
    minio_secret_key="<secret-key>",
    minio_bucket="documents",
    minio_secure=False,
    application_user_id="wiki-user",
)
runtime = create_dms_runtime(settings)
try:
    print(type(runtime.sdk).__name__, runtime.bucket_name)
finally:
    runtime.close()
```

이 예시는 실제로 접근 가능한 MinIO endpoint/bucket credential이 필요하다. runtime이 만든 engine은 `close()`에서 dispose한다. MinIO 또는 DMS factory 조립이 실패하면 이미 만든 engine을 rollback한다.

<a id="ex-host-005"></a>

### `EX-HOST-005` — `API-HOST-005` readiness와 lifecycle ownership

```python
from docmesh_doc.dms_factory import DmsSettings, create_dms_runtime

settings = DmsSettings(
    metadata_backend="sqlite",
    sqlite_path=":memory:",
    minio_endpoint="localhost:9000",
    minio_access_key="<access-key>",
    minio_secret_key="<secret-key>",
    minio_bucket="documents",
)
runtime = create_dms_runtime(settings)
try:
    ready = runtime.check_readiness()
    print(ready["status"], ready["ok"])
finally:
    runtime.close()
    runtime.close()  # idempotent close
```

`DmsRuntime.check_readiness()`는 metadata connection과 MinIO bucket을 확인한다. `DmsRuntime.close()`는 host-owned engine을 한 번만 dispose하고 DMS SDK facade의 global close를 호출하지 않는다. `create_application(runtime=runtime)`으로 주입한 runtime은 application이 닫지 않는다.

## 12. 실행 전 체크리스트

1. [[Configuration-v0.7.0]]에 따라 `DMS_METADATA_BACKEND`, storage settings, `DMS_APPLICATION_USER_ID`를 주입한다.
2. `.env` 파일은 자동으로 로딩되지 않으므로 process environment, container environment 또는 secret store로 주입한다.
3. PostgreSQL은 individual `POSTGRES_*` fields를 사용하고 `POSTGRES_DSN`은 설정하지 않는다.
4. SQLite를 선택해도 MinIO object store는 필수다.
5. multipart 예시에서 `Content-Type`을 수동 지정하지 않는다.
6. request identity header로 application partition을 바꾸려 하지 않는다.
7. management, global/partition reset, hard-delete 예시는 격리된 operator 환경에서 실행한다.
8. plan execution에는 operator가 확인한 failed document ID와 action만 넣는다.
9. 생성한 example document와 idempotency operation은 delete/reset 흐름으로 정리한다.
10. project/OpenAPI version은 `0.7.0`, upstream DMS version은 `0.11.0`으로 구분한다.

선택적인 전체 정리:

```bash
for variable in UPLOAD_ID BYTES_ID FILE_ID OPERATION_ID PARAM_DELETE_ID SOFT_DELETE_ID HARD_DELETE_ID; do
  value=${!variable:-}
  if [ -n "${value}" ]; then
    curl --silent --show-error --request DELETE \
      "${BASE_URL}/documents/${value}/hard" > /dev/null || true
  fi
done
rm -f \
  "${EXAMPLE_FILE}" \
  /tmp/docmesh-operation-v070.json \
  /tmp/docmesh-inline-v070.txt \
  /tmp/docmesh-download-v070.txt \
  /tmp/docmesh-eager-v070.txt \
  /tmp/docmesh-async-v070.txt \
  /tmp/docmesh-chunks-v070.txt \
  /tmp/docmesh-copy-v070.txt \
  /tmp/docmesh-copy-v070.headers
```

## 13. Source/test trace 요약

| 범위 | 구현 | 테스트/probe |
| --- | --- | --- |
| upload/list/read/delete | `docmesh_doc/router.py:235-698` | `test_docmesh_doc/test_api.py`, `test_full_api.py` |
| upload operation/management/reset | `docmesh_doc/router.py:701-936` | `test_docmesh_doc/test_full_api.py`, `test_v011_application.py` |
| fixed identity/partition forwarding | `docmesh_doc/application.py:118-149`, `dependencies.py:15-39` | `test_v011_application.py` partition cases |
| stream close | `docmesh_doc/router.py:107-210` | `test_docmesh_doc/test_streaming.py` |
| error envelope/correlation | `docmesh_doc/application.py:46-54`, `errors.py:105-179` | `test_docmesh_doc/test_api.py` error cases |
| storage assembly | `docmesh_doc/dms_factory.py:18-258` | `test_docmesh_doc/test_factory.py` |
| app ownership/readiness/version | `docmesh_doc/application.py:57-203` | `test_docmesh_doc/test_api.py` lifecycle/readiness/version cases |
| OpenAPI operation coverage | generated `app.openapi()` | `test_docmesh_doc/test_full_api.py::test_openapi_exposes_every_dms_operation_boundary` |
| docs support routes | `/openapi.json`, `/docs`, `/docs/oauth2-redirect`, `/redoc` probe | runtime probe; no dedicated UI assertion in repository |
| full suite | current checkout | `uv run --frozen pytest -q` → `48 passed, 1 warning` |
