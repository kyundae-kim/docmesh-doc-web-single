---
title: DocMesh 공개 API Reference v0.6.0
created: 2026-08-25
updated: 2026-08-25
type: concept
tags: [api, document, integration, security, testing, architecture]
sources: [raw/articles/docmesh-api-reference-v0-6-0.md, raw/articles/docmesh-configuration-v0-6-0.md, raw/articles/docmesh-examples-v0-6-0.md]
confidence: medium
---

# DocMesh 공개 API Reference v0.6.0

## 범위와 버전 주의

`docmesh-doc` project version `0.6.0`의 현재 공개 계약을 정리한다. 기준 commit은 `b20c35c35eaf9352a3c56f6465ab4fe59845820e`이며, 출처는 `uv run --frozen pytest -q` 결과를 `43 passed, 1 warning`으로 기록한다. 다만 `pyproject.toml`의 배포 버전과 달리 FastAPI/OpenAPI runtime metadata의 `app.version`과 `info.version`은 `0.5.0`이다. UI나 진단 화면에서 두 버전을 같은 값으로 가정하지 않는다. ^[raw/articles/docmesh-api-reference-v0-6-0.md]

현재 application은 bearer authentication, OAuth2, Keycloak middleware를 조립하지 않는다. `X-Subject`, `X-User-ID`, `X-Tenant-ID`, `X-Roles` 같은 header는 인증된 claim이 아니라 trusted transport input으로 처리되므로, gateway 또는 host가 검증과 management route 보호를 담당해야 한다. ^[raw/articles/docmesh-api-reference-v0-6-0.md] ^[raw/articles/docmesh-configuration-v0-6-0.md]

## 공개 surface

v0.5.0의 기본 upload/list/read/delete 경계에서 확장되어 bytes·file upload, 여러 list/content facade, upload operation 조회, management·recovery, host lifecycle API가 추가되었다. ^[raw/articles/docmesh-api-reference-v0-5-0.md] ^[raw/articles/docmesh-api-reference-v0-6-0.md]

| 영역 | API ID와 주요 경로 |
| --- | --- |
| Upload | `API-DOC-001` `POST /documents`, `API-DOC-002` `POST /documents/bytes`, `API-DOC-003` `POST /documents/file` |
| List/read | `API-DOC-004` `GET /documents`, `API-DOC-005` `GET /documents/page`, `API-DOC-006` `GET /documents/iterator`, `API-DOC-007` `GET /documents/{document_id}` |
| Content | `API-DOC-008` inline, `API-DOC-009` download, `API-DOC-011` eager, `API-DOC-012` async, `API-DOC-013` chunks, `API-DOC-014` checksum-aware copy |
| Delete | `API-DOC-010` `DELETE /documents/{document_id}?hard=false`, `API-DOC-015` `/soft`, `API-DOC-016` `/hard` |
| Upload operation | `API-UPLOAD-001 GET /upload-operations/{idempotency_key}` |
| Management/recovery | `API-MGMT-001`~`009`: internal metadata, inspection, recovery candidates, reconciliation, data reset/initialization |
| Operations/docs | `API-OPS-001` liveness, `API-OPS-002` readiness, `API-SYS-001`~`004` OpenAPI/Swagger/OAuth redirect/ReDoc |
| Hosting/lifecycle | `API-HOST-001` `create_application`, `API-HOST-002` ASGI object, `API-HOST-003` settings, `API-HOST-004` runtime assembly, `API-HOST-005` readiness/close |

## 요청·응답 계약

- `POST /documents`와 `/documents/file`은 multipart `file`, 선택적 `document_id`, 표준 JSON `metadata`, `created_by`를 사용한다. 새 문서는 `201`, 기존 idempotent 결과는 `200`이 될 수 있다.
- `POST /documents/bytes`는 strict base64의 `content_base64`, `filename`, `content_type`이 필수이며 `metadata`, `checksum`, `user_id`, `idempotency_key`, `idempotency_scope`를 전달할 수 있다.
- cursor list의 `next_cursor`는 opaque 값이다. `limit`(1~1000), `status`와 함께 해석·수정 없이 다음 요청에 전달한다. page facade는 `list_documents_page()`, iterator facade는 `{"items": [...]}` materialization을 명시한다.
- public metadata allowlist에는 document ID, filename, content type, size, status, timestamps, creator/user, checksum, metadata가 포함된다. `storage_key`는 public response에서 제외하고 management metadata에서만 노출한다.
- binary response는 저장된 `Content-Type`, `Content-Length`, percent-encoded filename을 포함한 `Content-Disposition`, 선택적 `X-Document-Checksum`을 사용한다. `API-DOC-014`는 `X-Checksum-Verified`도 반환한다. streaming resource는 정상 종료, producer exception, client disconnect에서 닫혀야 한다. ^[raw/articles/docmesh-api-reference-v0-6-0.md]

## 오류와 context

오류 envelope는 `error.code`, `message`, `correlation_id`를 기본으로 하고 DMS가 제공할 때 `category`, `retryable`, `document_id`를 추가한다. 내부 exception text, credential, DSN, storage key, stack trace는 public body로 전달하지 않는다. 대표 mapping은 `VALIDATION_ERROR`(400), `FORBIDDEN`(403), `DOCUMENT_NOT_FOUND`(404), `DOCUMENT_ALREADY_EXISTS`(409), `DOCUMENT_TOO_LARGE`(413), idempotency 오류(409/425), storage·metadata 오류(503)다. ^[raw/articles/docmesh-api-reference-v0-6-0.md]

`X-Correlation-ID`가 128자 이하 printable ASCII이면 유지하고, 없거나 유효하지 않으면 UUID를 만든다. 모든 response header와 오류 body의 correlation ID는 같아야 한다. `X-Default-Metadata`는 표준 JSON만 허용하며, 잘못된 context header는 validation error가 된다. ^[raw/articles/docmesh-api-reference-v0-6-0.md] ^[raw/articles/docmesh-examples-v0-6-0.md]

## Frontend·운영 영향

UI는 cursor/page/iterator를 서로 다른 사용 목적에 맞게 선택하고, eager content와 streaming/download를 파일 크기와 UX 요구에 따라 구분해야 한다. `API-DOC-014`의 checksum 검증 결과와 `API-OPS-002`의 dependency readiness는 단순 HTTP 200 여부와 별도로 표시할 수 있는 진단 정보다.

management, recovery, explicit hard delete와 `DELETE /management/data`는 일반 사용자 화면에 노출하지 말고 외부 operator authorization과 격리된 환경을 전제로 한다. API 문서의 route 목록과 generated OpenAPI `paths`는 support route 포함 여부가 다르므로, API client 생성이나 route inventory 검사에서 둘을 혼동하지 않는다. ^[raw/articles/docmesh-api-reference-v0-6-0.md] ^[raw/articles/docmesh-examples-v0-6-0.md]

## 관련 문서

- [[docmesh-document-service]] — 서비스 책임과 frontend/API 경계
- [[configuration-v0-6-0]] — API가 의존하는 backend, MinIO, context, lifecycle 설정
- [[examples-v0-6-0]] — API ID별 shell/Python/ASGI 실행 예시
- [[api-reference-v0-5-0]] — 이전 공개 surface와의 역사적 비교
