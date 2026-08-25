---
title: DocMesh Configuration v0.6.0
created: 2026-08-25
updated: 2026-08-25
type: concept
tags: [api, integration, architecture, security, deployment, testing]
sources: [raw/articles/docmesh-configuration-v0-6-0.md, raw/articles/docmesh-api-reference-v0-6-0.md, raw/articles/docmesh-examples-v0-6-0.md]
confidence: medium
---

# DocMesh Configuration v0.6.0

## 설정 loading과 ownership

`.env`는 자동으로 load되지 않는다. process environment 또는 명시적인 immutable `DmsSettings`를 `create_application(settings=..., root_path=...)`에 전달하고, application은 FastAPI state와 lifespan을 구성한다. `sdk=` 또는 `runtime=`을 주입하면 host가 만든 caller-owned resource를 사용하며 application이 닫지 않는다. 둘 다 생략하면 application lifespan이 `create_dms_runtime()`으로 runtime을 만들고 종료 시 engine을 dispose한다. ^[raw/articles/docmesh-configuration-v0-6-0.md]

project version은 `0.6.0`이지만 runtime FastAPI/OpenAPI metadata는 `0.5.0`이다. 설정 문서, release 진단, frontend의 version 표시에서 page/project version과 runtime metadata를 분리한다. ^[raw/articles/docmesh-configuration-v0-6-0.md]

## Process environment

| 그룹 | 주요 변수 | 계약 |
| --- | --- | --- |
| `CFG-APP` | `ROOT_PATH` | 빈 문자열 또는 `/dms`로 정규화되며 FastAPI root path와 upload `Location`에 반영된다. |
| `CFG-APP` | `CORS_ORIGINS` | comma split·trim 후 origin이 있을 때만 middleware를 추가한다. `*`이면 credentials를 허용하지 않는다. `CORS_CREDENTIALS`는 읽지 않는다. |
| `CFG-DMS` | `DMS_METADATA_BACKEND` | `postgresql` 또는 `sqlite`; 그 외에는 `ConfigurationError`. |
| `CFG-DMS` | `DMS_MAX_FILE_SIZE` | unset 또는 양의 integer bytes; 0 이하·비정수는 거부한다. |
| `CFG-STORE` | `POSTGRES_HOST/PORT/DB/USER/PASSWORD/SSLMODE` | PostgreSQL 선택 시 individual field를 사용한다. `POSTGRES_PASSWORD`는 secret이다. |
| `CFG-STORE` | `SQLITE_PATH` | SQLite 선택 시 file path 또는 `:memory:`가 필요하다. |
| `CFG-MINIO` | `MINIO_ENDPOINT`, access/secret key, `MINIO_BUCKET`, `MINIO_SECURE`, `MINIO_REGION` | 두 metadata backend 모두 MinIO가 필수다. `MINIO_ACCESS_KEY`가 alias보다 우선하며 boolean은 명시된 true/false 문자열만 허용한다. |

`None`인 dataclass default와 runtime requiredness는 다르다. 예를 들어 PostgreSQL 필수 field, SQLite `SQLITE_PATH`, 모든 backend의 MinIO 연결 정보는 application-owned runtime 조립 시 검증된다. `POSTGRES_DSN`은 backend와 무관하게 legacy forbidden setting이며 존재하면 parser가 `ConfigurationError`를 낸다. ^[raw/articles/docmesh-configuration-v0-6-0.md]

## Request context와 programmatic API

`CFG-CONTEXT-001`은 process setting이 아니라 route dependency가 읽는 transport context다. `X-Subject`, `X-User-ID`, `X-Tenant-ID`, `X-Roles`, `X-Created-By`, `X-Idempotency-Scope`, `X-Audit-Actor`, `X-Default-Metadata`가 `DmsOperationContext`로 변환된다. service가 header 신뢰성을 검증하지 않으므로 gateway가 authenticated claim을 만들고 client의 임의 덮어쓰기를 차단해야 한다. ^[raw/articles/docmesh-configuration-v0-6-0.md]

`DmsSettings.from_env(env: Mapping[str, str] | None = None)`는 전달 mapping을 사용할 수 있어 process environment mutation 없이 테스트·embedding이 가능하다. `create_application()`은 `sdk`, `settings`, `runtime`, `root_path`, `readiness_check`를 선택적으로 받으며 `sdk`와 `runtime`은 동시에 전달하지 않는다. ^[raw/articles/docmesh-configuration-v0-6-0.md] ^[raw/articles/docmesh-examples-v0-6-0.md]

## Readiness와 lifecycle

| 조립 방식 | readiness source | shutdown |
| --- | --- | --- |
| `sdk=` injection | SDK 존재 여부 또는 custom `readiness_check` | SDK를 닫지 않음 |
| `runtime=` injection | `runtime.check_readiness()` 또는 custom hook | runtime/engine을 닫지 않음 |
| no injection | SQLAlchemy engine connection + MinIO `bucket_exists()` | application-owned `runtime.close()` 호출 |

`DmsRuntime.check_readiness()`는 metadata와 object store detail을 반환하고 하나라도 실패하면 `API-OPS-002`가 `503`/`status=error`를 반환한다. `close()`는 lock으로 중복 호출을 무시하고 engine을 dispose한다. runtime assembly 중 MinIO/factory 생성이 실패하면 이미 만든 engine을 rollback dispose한다. ^[raw/articles/docmesh-configuration-v0-6-0.md]

## 보안·비계약 설정

production secret을 `.env.example`, wiki, source, image, API response, log에 저장하지 않는다. 현재 loader가 읽지 않는 `KEYCLOAK_*`, `NATS_*`, `MILVUS_*`, `OLLAMA_*`, `DOCMESH_SERVICES`, `DMS_CONFIGURATION_STRICT`, `CORS_CREDENTIALS`, `TOKEN_URL`은 활성화된 기능이나 configuration contract로 기록하지 않는다. ^[raw/articles/docmesh-configuration-v0-6-0.md]

Frontend는 `ROOT_PATH`를 API base URL, upload `Location`, redirect와 download link에 반영하고, CORS origin 정책과 readiness를 별도로 진단해야 한다. SQLite는 metadata store 대안일 뿐 object store를 대체하지 않는다.

## 관련 문서

- [[docmesh-document-service]] — 설정이 적용되는 서비스와 frontend 경계
- [[api-reference-v0-6-0]] — 설정 group과 API ID의 reverse trace
- [[examples-v0-6-0]] — environment, hosting, readiness 실행 예시
- [[configuration-v0-5-0]] — 이전 설정 계약과의 역사적 비교
