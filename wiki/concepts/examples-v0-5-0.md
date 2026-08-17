---
title: DocMesh API 사용 예시 v0.5.0
created: 2026-08-17
updated: 2026-08-17
type: concept
tags: [api, document, workflow, integration, testing, deployment]
sources: [raw/articles/docmesh-examples-v0-5-0.md, raw/articles/docmesh-api-reference-v0-5-0.md, raw/articles/docmesh-configuration-v0-5-0.md]
confidence: medium
---

# DocMesh API 사용 예시 v0.5.0

## 실행 전 준비

예시는 `BASE_URL`, 고유한 `DOCUMENT_ID`, 임시 파일을 준비한 뒤 실행한다. 실제 storage에 문서를 생성하므로 테스트가 끝나면 soft 또는 hard delete를 수행해야 하며, credential은 placeholder나 runtime secret injection으로 대체한다. ^[raw/articles/docmesh-examples-v0-5-0.md]

현재 서비스 자체에는 bearer middleware가 없으므로 예시 curl에는 `Authorization` header가 없다. 외부 reverse proxy나 상위 application이 인증을 추가할 수 있지만, 그 정책은 이 서비스의 현재 HTTP 예시에 포함되지 않는다. ^[raw/articles/docmesh-examples-v0-5-0.md] ^[raw/articles/docmesh-api-reference-v0-5-0.md]

## 대표 workflow

1. `GET /health/liveness`로 process 상태를 확인한다.
2. `GET /health/readiness`로 runtime과 MinIO bucket 준비 상태를 확인한다.
3. `POST /documents`에 `file`과 선택적 `document_id`를 multipart로 전송한다.
4. 목록에서 `next_cursor`를 해석하지 않고 다음 요청에 그대로 전달한다.
5. metadata, inline content, attachment download를 각각 확인한다.
6. 생성한 문서를 soft/hard delete한다. ^[raw/articles/docmesh-examples-v0-5-0.md] ^[raw/articles/docmesh-api-reference-v0-5-0.md]

inline content와 download는 파일을 `/tmp`에 저장한 뒤 `cmp`로 원본과 비교할 수 있다. download는 `chunk_size=65536` 같은 값을 사용할 수 있고, 허용 범위를 벗어난 값은 server 호출 전에 validation error가 된다. ^[raw/articles/docmesh-examples-v0-5-0.md] ^[raw/articles/docmesh-api-reference-v0-5-0.md]

## 오류와 문서 지원 route

`limit=0`, `chunk_size=0`, 존재하지 않는 document, file 없는 upload를 각각 호출해 `400 VALIDATION_ERROR` 또는 `404 DOCUMENT_NOT_FOUND` envelope를 확인할 수 있다. 오류 예시에서는 `curl --fail`을 생략해 response body와 HTTP status를 함께 확인한다. ^[raw/articles/docmesh-examples-v0-5-0.md]

`/openapi.json`, `/docs`, `/docs/oauth2-redirect`, `/redoc`도 curl로 확인할 수 있다. OpenAPI `paths`에는 FastAPI support route 자신이 포함되지 않으므로 runtime route inventory와 함께 해석한다. ^[raw/articles/docmesh-examples-v0-5-0.md] ^[raw/articles/docmesh-api-reference-v0-5-0.md]

## Hosting과 설정

Python에서는 `DmsSettings`를 만들고 `create_application(settings=..., root_path="/dms")`로 app을 조립할 수 있다. PostgreSQL/SQLite 선택과 MinIO 필수 설정은 [[configuration-v0-5-0]]의 규칙을 따른다. ASGI 실행은 `docmesh_doc.main:app` entrypoint를 사용한다. ^[raw/articles/docmesh-examples-v0-5-0.md] ^[raw/articles/docmesh-configuration-v0-5-0.md]

## 관련 문서

- [[docmesh-document-service]] — workflow가 호출하는 서비스 경계
- [[api-reference-v0-5-0]] — Example ID와 API 계약의 대응표
- [[configuration-v0-5-0]] — 실행 환경과 storage 설정
