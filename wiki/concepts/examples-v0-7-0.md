---
title: DocMesh API 사용 예시 v0.7.0
created: 2026-09-04
updated: 2026-09-04
type: concept
tags: [api, document, workflow, integration, testing, deployment, security]
sources: [raw/articles/docmesh-examples-v0-7-0.md, raw/articles/docmesh-api-reference-v0-7-0.md, raw/articles/docmesh-configuration-v0-7-0.md]
confidence: medium
---

# DocMesh API 사용 예시 v0.7.0

## 실행 목적과 순서

출처는 [[api-reference-v0-7-0]]의 모든 `API-*` 경계에 하나 이상의 `EX-*` shell/Python/ASGI 시나리오를 배정한다. 권장 순서는 공통 environment 준비, liveness/readiness, upload/list/read, operation·management, delete/cleanup이다. shell block은 `bash -n`, Python block은 AST compile, JSON block은 JSON parse 대상으로 검증한다. ^[raw/articles/docmesh-examples-v0-7-0.md]

server는 `DMS_APPLICATION_USER_ID` 하나의 personal partition과 `admin` access context를 사용하므로 예시는 `Authorization` 또는 request identity header를 넣지 않는다. `ROOT_PATH=/dms` 배포에서는 `BASE_URL`에 외부 prefix를 포함하고, 설정 주입은 [[configuration-v0-7-0]]의 process environment 규칙을 따른다. ^[raw/articles/docmesh-examples-v0-7-0.md] ^[raw/articles/docmesh-configuration-v0-7-0.md]

## Example coverage

| 흐름 | 주요 Example ID | 확인하는 경계 |
| --- | --- | --- |
| 운영 | `EX-OPS-001`, `EX-OPS-002` | liveness와 metadata/MinIO readiness |
| Upload | `EX-DOC-001`~`003` | multipart stream, base64 JSON, multipart file |
| List/metadata | `EX-DOC-004`~`007` | cursor, explicit page, iterator, public metadata |
| Content | `EX-DOC-008`, `009`, `011`~`014` | inline/download, eager, async, chunks, checksum-aware copy |
| Delete/operation | `EX-DOC-010`, `015`, `016`, `EX-UPLOAD-001` | parameterized·explicit delete, idempotency lookup |
| Management | `EX-MGMT-001`~`011` | internal metadata, inspection, recovery, reconciliation, reset |
| Docs UI | `EX-SYS-001`~`004` | OpenAPI JSON, Swagger UI, OAuth redirect support, ReDoc |
| Hosting | `EX-HOST-001`~`005` | factory, ASGI, settings/runtime/readiness/close |
| Error | `EX-ERR-001`, `EX-ERR-002` | validation envelope, not-found, correlation ID |

## 대표 document workflow

1. `GET /health/liveness`로 process 수신 가능 여부를 확인한다.
2. `GET /health/readiness`로 metadata store와 MinIO bucket 준비 상태를 확인한다. 오류 body도 확인해야 하므로 readiness curl에는 `--fail`을 쓰지 않는다.
3. 필요한 upload form을 선택한다: multipart stream, strict base64 JSON, 또는 temporary-file adapter.
4. `/documents`, `/documents/page`, `/documents/iterator`를 목적에 맞게 사용하고 `next_cursor`는 opaque 값으로 보존한다.
5. 작은 content에는 eager response를, 큰 파일에는 inline/download/async/chunk streaming을 사용한다. copy에서는 `X-Document-Checksum`과 `X-Checksum-Verified`를 확인한다.
6. parameterized 또는 explicit soft/hard delete로 example resource를 정리한다. ^[raw/articles/docmesh-examples-v0-7-0.md] ^[raw/articles/docmesh-api-reference-v0-7-0.md]

## 오류와 operator 흐름

`limit=0`, 잘못된 base64, `chunk_size=0`은 `400 VALIDATION_ERROR`를 확인하는 예시다. 존재하지 않는 문서는 `404 DOCUMENT_NOT_FOUND`와 명시적인 `X-Correlation-ID`가 response header와 error body에서 일치하는지 확인한다. `--fail`을 생략해야 오류 body를 볼 수 있다. ^[raw/articles/docmesh-examples-v0-7-0.md]

`EX-MGMT-001`~`007`은 internal metadata, consistency inspection, bounded recovery와 reconciliation을 다룬다. 단일·batch reconciliation은 `dry_run=true`로 먼저 대상을 확인할 수 있지만 plan execution에는 dry-run field가 없다. `EX-MGMT-008` global reset과 `EX-MGMT-010` configured-partition reset은 파괴적 작업이며, hard delete·data initialization과 함께 격리된 operator/test 환경에서만 실행한다. ^[raw/articles/docmesh-examples-v0-7-0.md]

management payload의 `storage_key`와 recovery action은 일반 사용자 화면에 노출하지 않는다. operator가 확인한 document ID와 storage key만 전달하고, production에서는 외부 authorization·별도 승인 절차를 사용한다. ^[raw/articles/docmesh-api-reference-v0-7-0.md] ^[raw/articles/docmesh-examples-v0-7-0.md]

## Python hosting 예시

`EX-HOST-001`은 host-owned SDK를 `create_application()`에 주입하고 fixed identity/partition을 확인한다. `EX-HOST-002`는 `docmesh_doc.main:app` ASGI entrypoint를, `EX-HOST-003`은 `DmsSettings.from_env({...})` 정규화를, `EX-HOST-004`~`005`는 `create_dms_runtime()`, readiness, idempotent close와 resource ownership을 보여준다. runtime 조립 예시는 접근 가능한 MinIO endpoint·credential·bucket이 필요하다. ^[raw/articles/docmesh-examples-v0-7-0.md] ^[raw/articles/docmesh-configuration-v0-7-0.md]

## 실행 전 체크리스트

- project/OpenAPI version `0.7.0`과 upstream DMS version `0.11.0`을 구분한다.
- `.env` 자동 로딩을 가정하지 않고 process/container environment로 값을 주입한다.
- PostgreSQL은 individual `POSTGRES_*` fields를 사용하고 `POSTGRES_DSN`은 설정하지 않는다.
- SQLite를 선택해도 MinIO object store를 준비한다.
- multipart 요청에서 `Content-Type` boundary를 수동 지정하지 않는다.
- request identity header로 application partition을 바꾸려 하지 않는다.
- management, global/partition reset, hard-delete는 격리된 operator 환경에서 실행한다.
- 생성한 document와 idempotency operation은 delete/reset 흐름으로 정리한다. ^[raw/articles/docmesh-examples-v0-7-0.md] ^[raw/articles/docmesh-configuration-v0-7-0.md]

## 관련 문서

- [[docmesh-document-service]] — 예시가 검증하는 서비스 경계
- [[api-reference-v0-7-0]] — Example ID와 공개 API의 대응
- [[configuration-v0-7-0]] — environment와 storage/lifecycle 전제
- [[examples-v0-6-0]] — 이전 실행 흐름과의 역사적 비교
