---
title: DocMesh 공개 API Reference v0.5.0
created: 2026-08-17
updated: 2026-08-17
type: concept
tags: [api, document, integration, security, testing, architecture]
sources: [raw/articles/docmesh-api-reference-v0-5-0.md, raw/articles/docmesh-configuration-v0-5-0.md, raw/articles/docmesh-examples-v0-5-0.md]
confidence: medium
---

# DocMesh 공개 API Reference v0.5.0

## 핵심 HTTP 표면

문서 API는 multipart upload(`POST /documents`), 목록(`GET /documents`), metadata 조회, inline content, attachment download, soft delete, hard delete로 구성된다. upload의 public input은 `file`과 선택적 `document_id`이며, 성공 시 `201`과 `Location`을 반환한다. ^[raw/articles/docmesh-api-reference-v0-5-0.md]

목록 API는 `cursor`, `limit`, `status`를 받는다. `limit`은 `1`~`1000`, status는 `uploaded`, `available`, `deleting`, `deleted`, `failed` 중 하나이며 `next_cursor`는 opaque 값이다. ^[raw/articles/docmesh-api-reference-v0-5-0.md] ^[raw/articles/docmesh-examples-v0-5-0.md]

content와 download는 저장된 content type·byte 수·filename을 사용한 streaming response다. download의 `chunk_size`는 `1`~`8388608` bytes 범위이며, 정상 종료·producer 오류·client disconnect 모두에서 server-side stream을 닫는다. ^[raw/articles/docmesh-api-reference-v0-5-0.md]

## 응답과 오류

문서 metadata public allowlist에는 `document_id`, filename, content type, size, status, timestamps, creator, checksum, metadata가 포함된다. 내부 `storage_key`는 public response에 포함되지 않는다. ^[raw/articles/docmesh-api-reference-v0-5-0.md]

모든 오류는 `error.code`, `error.message`, `error.correlation_id`를 갖는 envelope를 사용한다. 유효한 `X-Correlation-ID`는 그대로 재사용하고, 없거나 유효하지 않으면 새 ID를 생성해 응답 header와 오류 body에 함께 넣는다. ^[raw/articles/docmesh-api-reference-v0-5-0.md]

## 운영·호스팅

`/health/liveness`는 process가 요청을 처리할 수 있는지만 확인하고, `/health/readiness`는 주입된 readiness policy 또는 runtime dependency 상태를 반영한다. `/openapi.json`, `/docs`, `/docs/oauth2-redirect`, `/redoc`은 FastAPI support route로 live surface에 포함되지만 OpenAPI `paths`만으로 전체 route inventory를 판단해서는 안 된다. ^[raw/articles/docmesh-api-reference-v0-5-0.md]

`ROOT_PATH=/dms` 또는 `create_application(root_path="/dms")`를 사용하면 외부 URL과 upload `Location`에 prefix가 포함된다. frontend의 base URL, download link, redirect 처리는 이 배포 경계를 반영해야 한다. ^[raw/articles/docmesh-api-reference-v0-5-0.md] ^[raw/articles/docmesh-configuration-v0-5-0.md]

## 인증 및 버전 주의

현재 checkout에는 OAuth2/Keycloak/auth middleware가 없으므로 예시 요청은 `Authorization` header 없이 작성되어 있다. 인증은 외부 계층의 책임일 수 있으며 서비스 자체 계약으로 가정하지 않는다. 또한 project version `0.5.0`과 runtime `app.version=0.4.0`의 불일치를 UI·진단 문서에서 숨기지 않는다. ^[raw/articles/docmesh-api-reference-v0-5-0.md] ^[raw/articles/docmesh-examples-v0-5-0.md]

## 관련 문서

- [[docmesh-document-service]] — 서비스의 책임과 경계
- [[configuration-v0-5-0]] — API가 의존하는 환경·runtime 설정
- [[examples-v0-5-0]] — 각 API ID에 대응하는 호출 예시
