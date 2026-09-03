---
title: DocMesh Configuration v0.7.0
created: 2026-09-04
updated: 2026-09-04
type: concept
tags: [api, integration, architecture, security, deployment, testing]
sources: [raw/articles/docmesh-configuration-v0-7-0.md, raw/articles/docmesh-api-reference-v0-7-0.md, raw/articles/docmesh-examples-v0-7-0.md]
confidence: medium
---

# DocMesh Configuration v0.7.0

## 설정 loading과 ownership

`.env`는 자동으로 load되지 않는다. process environment 또는 명시적인 immutable `DmsSettings`를 `create_application(settings=..., root_path=..., application_user_id=...)`에 전달하고, shell·Compose·container orchestrator·secret store가 값을 주입해야 한다. `sdk=` 또는 `runtime=`을 주입하면 host가 만든 caller-owned resource를 사용하며 application은 이를 닫지 않는다. ^[raw/articles/docmesh-configuration-v0-7-0.md]

둘 다 주입하지 않으면 application lifespan이 `create_dms_runtime()`으로 SQLAlchemy engine, MinIO client/bucket, DMS SDK를 조립한다. application-owned runtime은 shutdown 시 close되고, 조립 도중 MinIO 또는 factory가 실패하면 이미 만든 engine을 rollback dispose한다. `dms-core` facade 자체의 global `close()`·`check_health()` 대신 host adapter가 readiness와 lifecycle을 담당한다. ^[raw/articles/docmesh-configuration-v0-7-0.md]

## Process environment

| 그룹 | 주요 변수 | 계약 |
| --- | --- | --- |
| `CFG-APP` | `ROOT_PATH`, `CORS_ORIGINS` | root path는 leading slash와 trailing slash를 정규화한다. CORS origin은 comma split·trim하며 `*`일 때 credentials를 허용하지 않는다. |
| `CFG-DMS` | `DMS_METADATA_BACKEND`, `DMS_MAX_FILE_SIZE` | backend는 `postgresql` 또는 `sqlite`만 허용하며, max file size는 unset 또는 양의 integer bytes다. |
| `CFG-STORE` | `POSTGRES_*`, `SQLITE_PATH` | PostgreSQL은 `HOST/DB/USER/PASSWORD`가 runtime에 필요하고, SQLite는 `SQLITE_PATH`가 필요하다. |
| `CFG-MINIO` | `MINIO_ENDPOINT`, access/secret key, bucket, secure, region | 두 metadata backend 모두 MinIO가 필수다. `MINIO_ACCESS_KEY`가 `MINIO_ACCESS_KEY_ID` alias보다 우선한다. |
| `CFG-CONTEXT` | `DMS_APPLICATION_USER_ID`, legacy `DMS_USER_ID` | fixed application identity에서 personal partition과 `admin` access context를 파생한다. |
| `CFG-PROGRAMMATIC` | `DmsSettings`, `create_application()` 인자 | settings mapping, SDK/runtime injection, readiness hook을 Python에서 명시할 수 있다. |

parser의 dataclass default가 `None`인 것과 application-owned runtime requiredness는 다르다. `POSTGRES_DSN`은 backend와 무관한 forbidden legacy setting이며 process environment에 존재하면 `DmsSettings.from_env()`가 `ConfigurationError`를 낸다. ^[raw/articles/docmesh-configuration-v0-7-0.md]

## application identity와 partition

`DMS_APPLICATION_USER_ID`를 trim한 값이 canonical identity이고, 없을 때만 `DMS_USER_ID`, 그 다음 `docmesh-doc` default를 사용한다. direct override 또는 최종 selected value가 빈 값이면 application assembly가 실패한다. 모든 일반 document·operation·recovery 호출은 `DocumentPartition.personal(user_id)`와 `AccessContext(subject=user_id, user_id=user_id, roles={"admin"})`를 명시적으로 사용한다. ^[raw/articles/docmesh-configuration-v0-7-0.md] ^[raw/articles/docmesh-api-reference-v0-7-0.md]

request header에서 user, tenant, role, metadata default, idempotency scope를 읽는 설정은 v0.7 contract에 없다. group partition과 per-request multi-user authorization도 이 application contract의 범위가 아니다. global reset/data-load는 partition 없이 fixed access context만 사용하고, configured-partition reset/data-load는 derived personal partition을 사용한다. ^[raw/articles/docmesh-configuration-v0-7-0.md]

## Readiness와 lifecycle

| 조립 방식 | readiness source | shutdown |
| --- | --- | --- |
| `sdk=` injection | SDK 존재 여부 또는 custom `readiness_check` | SDK를 닫지 않음 |
| `runtime=` injection | `runtime.check_readiness()` 또는 custom hook | runtime/engine을 닫지 않음 |
| no injection | metadata engine connection + MinIO `bucket_exists()` | application-owned `runtime.close()` 호출 |

`DmsRuntime.check_readiness()`는 metadata와 object store detail을 반환하며 어느 하나라도 실패하면 `API-OPS-002`가 `503`/`status=error`를 반환한다. `runtime.close()`는 idempotent하게 engine을 dispose한다. ^[raw/articles/docmesh-configuration-v0-7-0.md] ^[raw/articles/docmesh-examples-v0-7-0.md]

## 배포·보안 영향

PostgreSQL 선택 시 individual `POSTGRES_*` fields를 사용하고 `POSTGRES_DSN`은 설정하지 않는다. SQLite는 metadata store 대안일 뿐 MinIO object store를 대체하지 않는다. production secret을 `.env.example`, wiki, source, image, API response, log에 저장하지 않으며 loader가 읽지 않는 `KEYCLOAK_*`, `NATS_*`, `MILVUS_*`, `OLLAMA_*`, `DOCMESH_SERVICES`, `CORS_CREDENTIALS`, `TOKEN_URL`은 활성 설정으로 취급하지 않는다. ^[raw/articles/docmesh-configuration-v0-7-0.md]

frontend와 배포 구성은 `ROOT_PATH`, CORS, readiness를 별도로 반영해야 한다. management·reset·hard-delete route의 operator authorization은 service 내부 설정이 아니라 외부 network/gateway 경계의 책임이다. ^[raw/articles/docmesh-api-reference-v0-7-0.md] ^[raw/articles/docmesh-examples-v0-7-0.md]

## 관련 문서

- [[docmesh-document-service]] — 설정이 적용되는 서비스와 frontend 경계
- [[api-reference-v0-7-0]] — 설정 group과 API ID의 reverse trace
- [[examples-v0-7-0]] — environment, hosting, readiness 실행 예시
- [[configuration-v0-6-0]] — 이전 설정 계약과의 역사적 비교
