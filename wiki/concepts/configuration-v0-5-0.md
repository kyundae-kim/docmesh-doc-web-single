---
title: DocMesh Configuration v0.5.0
created: 2026-08-17
updated: 2026-08-17
type: concept
tags: [api, integration, architecture, security, deployment]
sources: [raw/articles/docmesh-configuration-v0-5-0.md, raw/articles/docmesh-api-reference-v0-5-0.md, raw/articles/docmesh-examples-v0-5-0.md]
confidence: medium
---

# DocMesh Configuration v0.5.0

## 설정 로딩 모델

설정은 자동 `.env` 로딩이 아니라 process environment 또는 명시적인 immutable `DmsSettings`에서 읽는다. `create_application()`은 settings를 선택하고, SDK/runtime을 주입하지 않은 경우 lifespan에서 실제 storage runtime을 조립한다. ^[raw/articles/docmesh-configuration-v0-5-0.md]

metadata backend는 `postgresql` 또는 `sqlite`다. PostgreSQL은 `POSTGRES_HOST`, DB, user, password가 필요하고 SQLite는 `SQLITE_PATH`가 필요하다. 두 backend 모두 `MINIO_ENDPOINT`, access key, secret key, bucket이 필요하다. ^[raw/articles/docmesh-configuration-v0-5-0.md]

## Web UI에 직접 영향을 주는 설정

`ROOT_PATH`는 빈 문자열 또는 `/dms` 같은 외부 prefix로 정규화되며 API URL과 upload `Location`에 반영된다. `CORS_ORIGINS`가 지정되면 CORS middleware가 추가되고, `*`를 포함하는 경우 credentials는 허용되지 않는다. ^[raw/articles/docmesh-configuration-v0-5-0.md] ^[raw/articles/docmesh-api-reference-v0-5-0.md]

`DMS_MAX_FILE_SIZE`는 양의 integer bytes로 검증된다. 이 값에 걸리는 upload는 `413 DOCUMENT_TOO_LARGE`가 될 수 있으므로 UI는 client-side 사전 검증과 server 오류 처리를 함께 제공해야 한다. ^[raw/articles/docmesh-configuration-v0-5-0.md] ^[raw/articles/docmesh-api-reference-v0-5-0.md]

## Runtime ownership과 readiness

host가 `sdk=` 또는 `runtime=`을 주입하면 해당 자원은 caller-owned이며 application lifespan이 닫지 않는다. 아무것도 주입하지 않으면 application이 만든 runtime을 종료 시 닫는다. readiness는 runtime의 engine·MinIO 상태 또는 host가 주입한 hook을 사용한다. ^[raw/articles/docmesh-configuration-v0-5-0.md]

따라서 frontend의 readiness 화면은 단순 process liveness와 storage dependency readiness를 구분해야 한다. readiness 실패는 `503`과 `status=error`가 될 수 있다. ^[raw/articles/docmesh-configuration-v0-5-0.md] ^[raw/articles/docmesh-api-reference-v0-5-0.md]

## 금지된 설정과 보안

`POSTGRES_DSN`은 현재 adapter에서 지원하지 않는 legacy 설정이다. `KEYCLOAK_*`, `NATS_*`, `MILVUS_*`, `OLLAMA_*`, `DOCMESH_SERVICES`, `TOKEN_URL`, `CORS_CREDENTIALS`도 이 checkout의 제품 설정 계약으로 추가하지 않는다. 실제 secret은 source, 예제, wiki, 이미지, API response, log에 저장하지 않는다. ^[raw/articles/docmesh-configuration-v0-5-0.md]

## 관련 문서

- [[docmesh-document-service]] — 설정이 적용되는 서비스 경계
- [[api-reference-v0-5-0]] — 설정이 API route와 response에 미치는 영향
- [[examples-v0-5-0]] — PostgreSQL/SQLite 및 application 실행 예시
