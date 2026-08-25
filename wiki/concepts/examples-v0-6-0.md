---
title: DocMesh API 사용 예시 v0.6.0
created: 2026-08-25
updated: 2026-08-25
type: concept
tags: [api, document, workflow, integration, testing, deployment, security]
sources: [raw/articles/docmesh-examples-v0-6-0.md, raw/articles/docmesh-api-reference-v0-6-0.md, raw/articles/docmesh-configuration-v0-6-0.md]
confidence: medium
---

# DocMesh API 사용 예시 v0.6.0

## 실행 목적과 순서

출처의 예시는 `[[api-reference-v0-6-0]]`의 모든 `API-*` 경계에 최소 하나의 `EX-*` 시나리오를 배정한다. 공통 준비 후 upload/list/read를 실행하고, 마지막에 delete로 example resource를 정리하는 순서를 권장한다. `BASE_URL`에는 reverse proxy의 `ROOT_PATH`를 포함하고, credential은 placeholder나 runtime secret injection으로 대체한다. ^[raw/articles/docmesh-examples-v0-6-0.md]

출처는 shell block을 `bash -n`, Python block을 AST compile, JSON block을 JSON parse 대상으로 검증한다고 기록한다. 이 예시는 production authorization을 제공하지 않으며, `X-*` context header와 management route는 인증 gateway 또는 격리된 operator network를 전제로 한다. ^[raw/articles/docmesh-examples-v0-6-0.md]

## Example coverage

| 흐름 | 주요 Example ID | 확인하는 경계 |
| --- | --- | --- |
| 운영 | `EX-OPS-001`, `EX-OPS-002` | liveness와 metadata/MinIO readiness의 차이 |
| Upload | `EX-DOC-001`~`003` | multipart stream, base64 JSON, multipart file upload |
| List/metadata | `EX-DOC-004`~`007` | cursor, explicit page, iterator, public metadata |
| Content | `EX-DOC-008`, `009`, `011`~`014` | inline/download, eager, async, chunks, checksum-aware copy |
| Delete/operation | `EX-DOC-010`, `015`, `016`, `EX-UPLOAD-001` | parameterized·explicit delete와 idempotency operation 조회 |
| Management | `EX-MGMT-001`~`009` | internal metadata, inspection, recovery, reconciliation, reset |
| Docs UI | `EX-SYS-001`~`004` | OpenAPI JSON, Swagger UI, OAuth redirect support, ReDoc |
| Hosting | `EX-HOST-001`~`005` | application factory, ASGI, settings/runtime/readiness/close |
| Error | `EX-ERR-001`, `EX-ERR-002` | validation envelope, not-found와 correlation ID |

## 대표 document workflow

1. `GET /health/liveness`로 process가 요청을 받을 수 있는지 확인한다.
2. `GET /health/readiness`를 호출해 application-owned metadata store와 MinIO bucket 준비 상태를 확인한다.
3. `POST /documents`의 multipart stream, `POST /documents/bytes`의 strict base64 JSON, `POST /documents/file`의 temporary-file adapter 중 필요한 upload form을 선택한다.
4. `GET /documents`, `/documents/page`, `/documents/iterator`를 목적에 맞게 사용한다. cursor와 `next_cursor`는 opaque 값으로 보존한다.
5. 작은 응답은 eager content를 고려하고, 큰 파일은 inline/download/async/chunk streaming을 사용한다. copy example에서는 `X-Document-Checksum`과 `X-Checksum-Verified`를 확인한다.
6. parameterized delete 또는 explicit soft/hard delete를 실행해 생성한 resource를 정리한다. ^[raw/articles/docmesh-examples-v0-6-0.md] ^[raw/articles/docmesh-api-reference-v0-6-0.md]

## 오류와 운영자 흐름

오류 예시에서는 response body와 HTTP status를 보기 위해 `curl --fail`을 생략한다. `limit=0`, 잘못된 base64, `chunk_size=0`은 `400 VALIDATION_ERROR`를 확인하는 사례이며, 존재하지 않는 문서는 `404 DOCUMENT_NOT_FOUND`와 `X-Correlation-ID: wiki-not-found`를 비교하는 사례다. ^[raw/articles/docmesh-examples-v0-6-0.md]

`EX-MGMT-001`~`007`은 internal metadata, consistency inspection, bounded recovery와 reconciliation을 다룬다. `dry_run=true`는 단일·batch reconciliation에서 상태 변경 없이 결과를 확인하는 안전한 첫 단계다. `EX-MGMT-008`의 `DELETE /management/data`는 metadata, objects, upload operations를 모두 대상으로 하는 파괴적 작업이므로 production에서 실행하지 않고 격리된 test database/bucket에서만 사용한다. ^[raw/articles/docmesh-examples-v0-6-0.md]

## Python hosting 예시

`EX-HOST-001`은 host-owned SDK를 `create_application(sdk=..., root_path="/dms")`에 주입하는 경계를, `EX-HOST-002`는 `docmesh_doc.main:app` ASGI entrypoint를 보여준다. `EX-HOST-003`은 `DmsSettings.from_env({...})`로 환경 mapping을 파싱하는 방법을, `EX-HOST-004`는 `create_dms_runtime()`과 `close()`를, `EX-HOST-005`는 readiness와 idempotent lifecycle ownership을 확인한다. ^[raw/articles/docmesh-examples-v0-6-0.md] ^[raw/articles/docmesh-configuration-v0-6-0.md]

runtime을 실제로 조립하는 예시는 접근 가능한 MinIO endpoint, credential, bucket이 필요하다. `sdk=` 또는 `runtime=`으로 주입한 자원은 caller-owned이므로 application이 닫지 않으며, 아무것도 주입하지 않은 application-owned runtime만 lifespan 종료 시 닫힌다.

## 관련 문서

- [[docmesh-document-service]] — 예시가 검증하는 서비스 경계
- [[api-reference-v0-6-0]] — Example ID와 공개 API의 대응
- [[configuration-v0-6-0]] — environment와 storage/lifecycle 전제
- [[examples-v0-5-0]] — 이전 실행 흐름과의 역사적 비교
