---
title: DocMesh 공개 API Reference v0.7.0
created: 2026-09-04
updated: 2026-09-04
type: concept
tags: [api, document, integration, security, testing, architecture]
sources: [raw/articles/docmesh-api-reference-v0-7-0.md, raw/articles/docmesh-configuration-v0-7-0.md, raw/articles/docmesh-examples-v0-7-0.md]
confidence: medium
---

# DocMesh 공개 API Reference v0.7.0

## 범위와 release 정합성

`docmesh-doc` project version, `create_application()`의 FastAPI version, 생성된 OpenAPI `info.version`은 모두 `0.7.0`이다. 기준 implementation commit은 `14cef6e25943ed5ab9f7f0c56b5948c130b69c7e`이며, `dms-core 0.11.0`은 별도의 upstream dependency version이다. 출처는 `uv run --frozen pytest -q` 결과를 `48 passed, 1 warning`으로 기록한다. ^[raw/articles/docmesh-api-reference-v0-7-0.md]

현재 application은 bearer/OAuth2/Keycloak middleware를 조립하지 않는다. 모든 요청은 설정된 하나의 personal partition과 `admin` `AccessContext`로 전달되며, `X-Subject`, `X-User-ID`, `X-Tenant-ID`, `X-Roles` 등의 request header는 application identity를 바꾸지 않는다. management와 hard-delete는 외부 gateway 또는 host authorization 뒤에 배치해야 한다. ^[raw/articles/docmesh-api-reference-v0-7-0.md] ^[raw/articles/docmesh-configuration-v0-7-0.md]

## 공개 surface

v0.7.0은 문서 lifecycle뿐 아니라 partition-scoped reset, checksum-aware copy, reconciliation, host-owned runtime lifecycle까지 하나의 adapter 계약으로 명시한다.

| 영역 | 공개 API 범위 |
| --- | --- |
| Upload/list/read/delete | `API-DOC-001`~`016`: multipart·bytes·file upload, cursor/page/iterator list, public metadata, inline/download/eager/async/chunk/copy content, parameterized·explicit delete |
| Upload operation | `API-UPLOAD-001`: `GET /upload-operations/{idempotency_key}` |
| Management/recovery | `API-MGMT-001`~`011`: internal metadata, inspection, recovery candidates, reconciliation, global reset/initialization, configured-partition reset/initialization |
| Operations/docs | `API-OPS-001`~`002`: liveness/readiness; `API-SYS-001`~`004`: OpenAPI, Swagger UI, OAuth redirect support route, ReDoc |
| Python hosting | `API-HOST-001`~`005`: `create_application`, `docmesh_doc.main:app`, `DmsSettings`, `create_dms_runtime`, readiness/close |

`API-MGMT-008`와 `API-MGMT-009`는 global operation이라 partition 없이 호출하고, `API-MGMT-010`과 `API-MGMT-011`은 server-side에서 선택한 configured personal partition을 대상으로 한다. `API-SYS-*` support route는 runtime에서 live지만 generated OpenAPI `paths`에는 자신을 포함하지 않는다. ^[raw/articles/docmesh-api-reference-v0-7-0.md]

## 요청·응답과 context 계약

public metadata는 document ID, filename, content type, size, status, timestamps, `partition`, optional creator/checksum/metadata를 제공한다. `user_id`와 `storage_key`는 public metadata에 없고, `storage_key`는 internal management schema에서만 노출된다. `BytesUploadRequest`에는 `content_base64`, filename, content type이 필수이며 multipart route에는 checksum·idempotency·user field를 추가하지 않는다. ^[raw/articles/docmesh-api-reference-v0-7-0.md]

list의 `next_cursor`는 opaque 값이다. UI나 client는 이를 해석·수정하지 않고 동일한 partition/status/page-size 조건으로 전달한다. binary response는 `Content-Type`, `Content-Length`, percent-encoded filename이 포함된 `Content-Disposition`과 optional `X-Document-Checksum`을 사용하며, checksum-aware copy는 `X-Checksum-Verified`도 반환한다. ^[raw/articles/docmesh-api-reference-v0-7-0.md] ^[raw/articles/docmesh-examples-v0-7-0.md]

`X-Correlation-ID`가 128자 이하 printable ASCII이면 유지하고, 없거나 유효하지 않으면 application이 UUID를 생성한다. 정상·오류 response header와 오류 body의 correlation ID는 같아야 한다. 오류 envelope는 `code`, `message`, `correlation_id`를 기본으로 하며 DMS가 제공할 때만 `category`, `retryable`, `document_id`를 추가한다. 내부 exception text, credential, DSN, storage key, stack trace는 public body에 포함하지 않는다. ^[raw/articles/docmesh-api-reference-v0-7-0.md]

## Frontend·운영 영향

`ROOT_PATH=/dms` 또는 factory override를 사용하면 외부 URL과 upload `Location`에 `/dms`가 포함된다. frontend는 API base URL, redirect, download link를 이 prefix와 함께 구성해야 한다. `/health/liveness`는 storage를 검사하지 않고, `/health/readiness`는 runtime 상태에 따라 `200` 또는 `503`을 반환하므로 단순 liveness와 dependency readiness를 구분한다. ^[raw/articles/docmesh-api-reference-v0-7-0.md] ^[raw/articles/docmesh-configuration-v0-7-0.md]

injected SDK/runtime은 caller-owned라서 application lifespan이 닫지 않는다. 아무것도 주입하지 않은 경우에만 application이 runtime을 조립하고 shutdown 시 engine을 dispose한다. `API-DOC-014`는 최대 8 MiB bounded spool을 사용하고 streaming resource는 정상 종료·producer 오류·client disconnect에서 닫혀야 한다. ^[raw/articles/docmesh-api-reference-v0-7-0.md] ^[raw/articles/docmesh-configuration-v0-7-0.md]

## 관련 문서

- [[docmesh-document-service]] — 서비스 책임과 frontend/API 경계
- [[configuration-v0-7-0]] — API가 의존하는 environment, partition, storage, lifecycle 설정
- [[examples-v0-7-0]] — API ID별 shell/Python/ASGI 실행 예시
- [[api-reference-v0-6-0]] — 이전 공개 surface와의 역사적 비교
