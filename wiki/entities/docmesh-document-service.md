---
title: DocMesh Document Service
created: 2026-08-17
updated: 2026-09-04
type: entity
tags: [document, api, integration, architecture, security]
sources: [raw/articles/docmesh-api-reference-v0-5-0.md, raw/articles/docmesh-configuration-v0-5-0.md, raw/articles/docmesh-examples-v0-5-0.md, raw/articles/docmesh-api-reference-v0-6-0.md, raw/articles/docmesh-configuration-v0-6-0.md, raw/articles/docmesh-examples-v0-6-0.md, raw/articles/docmesh-api-reference-v0-7-0.md, raw/articles/docmesh-configuration-v0-7-0.md, raw/articles/docmesh-examples-v0-7-0.md]
confidence: medium
---

# DocMesh Document Service

## 개요

DocMesh Document Service는 문서 binary와 metadata를 저장·조회·삭제하는 FastAPI 기반 서비스다. 이 프로젝트의 web UI는 이 서비스가 제공하는 RESTful HTTP 표면을 소비하며, 서버 내부의 metadata store와 object store 구현은 프론트엔드의 직접 책임이 아니다. ^[raw/articles/docmesh-api-reference-v0-5-0.md]

현재 checkout의 제품 버전 기준은 `0.5.0`이지만 FastAPI runtime metadata의 `app.version`은 `0.4.0`으로 기록되어 있다. 이 차이는 화면의 버전 표시나 진단 화면에서 별도 취급해야 한다. ^[raw/articles/docmesh-api-reference-v0-5-0.md]

## 프론트엔드가 의존하는 경계

문서 lifecycle은 `POST /documents`, `GET /documents`, metadata·content·download 조회, soft/hard delete로 구성된다. 목록의 `next_cursor`는 opaque 값이므로 UI가 해석하거나 변환하지 않고 같은 query 조건으로 전달해야 한다. ^[raw/articles/docmesh-api-reference-v0-5-0.md] ^[raw/articles/docmesh-examples-v0-5-0.md]

성공·실패 응답은 public schema와 오류 envelope를 따른다. 오류에는 `code`, 사용자에게 노출 가능한 `message`, `correlation_id`가 포함되며 내부 exception text, credential, storage key, stack trace는 UI로 전달하지 않는다. ^[raw/articles/docmesh-api-reference-v0-5-0.md]

## 운영 및 보안 경계

현재 서비스 checkout에는 OAuth2, Keycloak, bearer middleware가 조립되어 있지 않다. 외부 reverse proxy나 상위 application이 인증을 제공할 수 있지만, 현재 서비스 자체 API 계약으로 인증 header를 전제해서는 안 된다. ^[raw/articles/docmesh-api-reference-v0-5-0.md] ^[raw/articles/docmesh-examples-v0-5-0.md]

서비스 설정은 process environment 또는 명시적인 `DmsSettings`에서 로드된다. metadata backend는 PostgreSQL 또는 SQLite이며, 두 경우 모두 MinIO object store 설정이 필요하다. `ROOT_PATH`와 CORS 설정은 배포 URL과 브라우저 호출 가능성에 직접 영향을 준다. ^[raw/articles/docmesh-configuration-v0-5-0.md]

## v0.6.0 업데이트

v0.6.0은 기존 문서 lifecycle 경계 위에 bytes/file upload, page·iterator list, eager·async·chunk·checksum-aware content read, upload operation 조회, management·recovery route와 host lifecycle API를 추가한 공개 surface다. 이 페이지의 frontend 소비자는 cursor를 opaque 값으로 유지하고, public metadata의 `storage_key` 비노출과 binary response header를 보존해야 한다. ^[raw/articles/docmesh-api-reference-v0-6-0.md]

새 API의 `X-Subject`, `X-User-ID`, `X-Tenant-ID`, `X-Roles` 등 context header는 application이 인증 claim으로 검증하지 않는다. management·recovery·hard delete·data reset은 일반 사용자 경로가 아니라 외부 authorization boundary와 operator 환경을 전제로 한다. ^[raw/articles/docmesh-api-reference-v0-6-0.md] ^[raw/articles/docmesh-configuration-v0-6-0.md] ^[raw/articles/docmesh-examples-v0-6-0.md]

설정 측면에서는 `ROOT_PATH`, CORS, PostgreSQL/SQLite 선택, MinIO 필수성, `POSTGRES_DSN` 금지, caller-owned/application-owned runtime lifecycle을 v0.6.0 기준으로 재확인한다. project version `0.6.0`과 runtime/OpenAPI metadata `0.5.0`의 불일치는 UI와 진단에서 별도 표시해야 한다. ^[raw/articles/docmesh-configuration-v0-6-0.md]

## v0.7.0 업데이트

v0.7.0은 `docmesh-doc` project version과 FastAPI/OpenAPI runtime version을 모두 `0.7.0`으로 정렬한다. upstream `dms-core` version은 `0.11.0`으로 별도 식별하며, 기준 implementation commit은 `14cef6e25943ed5ab9f7f0c56b5948c130b69c7e`이다. ^[raw/articles/docmesh-api-reference-v0-7-0.md]

`dms-core` v0.11의 partition-required facade에 맞춰 application은 하나의 configured personal partition과 `admin` access context를 모든 일반 작업에 사용한다. v0.6.0에서 기록했던 request context header 의존과 달리 v0.7.0에서는 `X-User-ID`, `X-Subject`, `X-Tenant-ID`, `X-Roles` 등이 application identity를 덮어쓰지 않으며, bearer/OAuth2/Keycloak middleware도 내장하지 않는다. management, reset, hard-delete authorization은 외부 gateway·host 경계의 책임이다. ^[raw/articles/docmesh-api-reference-v0-7-0.md] ^[raw/articles/docmesh-configuration-v0-7-0.md]

public metadata에는 `partition` projection이 포함되고 `user_id`와 `storage_key`는 제외된다. `storage_key`는 internal metadata·inspection·recovery boundary에서만 사용하며, public bytes request에서도 `user_id`를 받지 않는다. v0.7.0은 configured-partition reset/initialization과 reconciliation plan surface를 추가하고, global reset과 partition reset의 범위를 분리한다. ^[raw/articles/docmesh-api-reference-v0-7-0.md]

frontend는 `ROOT_PATH`가 반영된 base URL과 upload `Location`, opaque cursor, binary response headers를 보존해야 한다. liveness와 metadata/MinIO readiness를 구분하고, injected SDK/runtime은 caller-owned로 취급하며 application-owned runtime만 shutdown에서 닫는다. streaming과 checksum-aware copy의 lifecycle·검증 header도 UI와 운영 진단에서 별도로 고려한다. ^[raw/articles/docmesh-api-reference-v0-7-0.md] ^[raw/articles/docmesh-configuration-v0-7-0.md] ^[raw/articles/docmesh-examples-v0-7-0.md]

## 관련 문서

- [[api-reference-v0-5-0]] — HTTP route, schema, 오류 계약
- [[configuration-v0-5-0]] — 환경 변수와 runtime 조립
- [[examples-v0-5-0]] — curl 및 hosting 실행 흐름
- [[api-reference-v0-6-0]] — 확장된 공개 API와 management/recovery 계약
- [[configuration-v0-6-0]] — v0.6.0 환경, context, readiness와 lifecycle
- [[examples-v0-6-0]] — v0.6.0 API ID별 실행 예시
- [[api-reference-v0-7-0]] — v0.7.0 공개 API와 partition-required 계약
- [[configuration-v0-7-0]] — v0.7.0 environment, storage, identity와 lifecycle
- [[examples-v0-7-0]] — v0.7.0 API ID별 실행 예시
