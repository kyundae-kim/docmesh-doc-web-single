---
source_url: https://github.com/kyundae-kim/docmesh-doc/wiki/Configuration-v0.5.0
ingested: 2026-08-17
sha256: c2b7f69754824d143ad112e45cf319a25b9a059d2d7826a403ada8cf7ddc9fe1
---
# 설정 정의서 v0.5.0

DocMesh Document Service의 process environment, Python factory 설정, storage ownership과 readiness 정책을 정의한다. API 계약은 [[API-Reference-v0.5.0]], 실행 순서는 [[Examples-v0.5.0]]을 참조한다.

- 구현 기준: `docmesh_doc/dms_factory.py`, `docmesh_doc/application.py`
- 환경 template: repository `.env.example`
- `.env` 자동 로딩: 없음
- 지원 metadata backend: `postgresql`, `sqlite`
- object store: MinIO 필수

> **범위:** 현재 서비스는 DMS storage와 FastAPI hosting 설정만 소비한다. Keycloak, NATS, Milvus, OAuth2, `DOCMESH_SERVICES` 같은 과거 Wiki의 설정은 이 checkout의 구현에 존재하지 않으므로 제품 설정이 아니다.

## 1. 설정 소유권과 로딩 흐름

```text
process environment / explicit DmsSettings
        │
        ▼
create_application(settings=..., root_path=...)
        │
        ├─ FastAPI root_path / CORS policy
        └─ lifespan에서 create_dms_runtime(settings)
                │
                ├─ SQLAlchemy Engine (PostgreSQL 또는 SQLite)
                ├─ MinIO client + bucket
                └─ DocumentManagementSDKFactory(...).create()
```

- `DmsSettings.from_env()`가 문자열 환경을 immutable `DmsSettings`로 변환한다.
- `create_application()`은 settings를 선택하고 app state에 보관한다. SDK/runtime을 주입하지 않은 경우 실제 storage runtime 조립은 lifespan에서 수행한다.
- host가 `sdk=` 또는 `runtime=`을 주입하면 해당 객체와 자원은 caller-owned이며 application lifespan이 닫지 않는다.
- application이 만든 `DmsRuntime`만 lifespan 종료 때 `close()`하며, 현재 `close()`는 SQLAlchemy engine을 idempotent하게 dispose한다. DMS facade의 전역 `close()`나 `check_health()`를 호출하지 않는다.

## 2. 설정 ID와 requiredness

| group | 설정 ID | 책임 |
| --- | --- | --- |
| `CFG-APP` | `CFG-APP-001` | `ROOT_PATH`와 외부 URL prefix |
| `CFG-APP` | `CFG-APP-002` | `CORS_ORIGINS` CSV와 CORS middleware |
| `CFG-DMS` | `CFG-DMS-001` | metadata backend 선택 |
| `CFG-DMS` | `CFG-DMS-002` | DMS file-size policy |
| `CFG-PG` | `CFG-PG-001` | PostgreSQL connection fields |
| `CFG-SQLITE` | `CFG-SQLITE-001` | SQLite metadata path |
| `CFG-MINIO` | `CFG-MINIO-001` | MinIO endpoint/credential/bucket |
| `CFG-PROGRAMMATIC` | `CFG-PROGRAMMATIC-001` | `DmsSettings` injection |
| `CFG-PROGRAMMATIC` | `CFG-PROGRAMMATIC-002` | SDK/runtime/readiness injection |

제품 requiredness와 dataclass 기본값은 다르다. 예를 들어 `DmsSettings.postgres_host`의 Python 기본값은 `None`이지만 PostgreSQL runtime 조립 때는 필수다. `minio_*`도 parse 단계에서는 `None`일 수 있지만 runtime 조립 때 필수다.

## 3. Process environment

### `CFG-APP` — application settings

| 변수 | Python field | 타입/기본값 | requiredness | secret | 소비 |
| --- | --- | --- | --- | --- | --- |
| `ROOT_PATH` | `root_path` | string, `""` | 선택 | 아니오 | root path가 없으면 빈 문자열 |
| `CORS_ORIGINS` | `cors_origins` | comma-separated string, 빈 tuple | 선택 | 아니오 | 값이 하나 이상일 때만 CORS middleware 추가 |

`ROOT_PATH`는 다음과 같이 정규화된다.

- 빈 값: `""`
- `/`로 시작하지 않으면 앞에 `/` 추가
- `/`가 아닌 trailing slash는 제거
- 예: `dms/` → `/dms`

`CORS_ORIGINS`는 comma로 나누고 각 항목을 trim한다. 값이 `*`를 포함하면 `allow_credentials=False`; 그 외에는 `allow_credentials=True`로 middleware를 만든다. methods와 headers는 `*`다. `CORS_CREDENTIALS`, access log, token URL은 현재 loader가 읽지 않는다.

### `CFG-DMS` — DMS policy

| 변수 | Python field | 타입/기본값 | 규칙 |
| --- | --- | --- | --- |
| `DMS_METADATA_BACKEND` | `metadata_backend` | `postgresql` | `postgresql` 또는 `sqlite`만 허용 |
| `DMS_MAX_FILE_SIZE` | `max_file_size` | 없음(`None`) | 지정하면 양의 integer bytes |
| `POSTGRES_DSN` | 없음 | 지원하지 않음 | 존재하면 backend와 무관하게 `ConfigurationError` |

`DMS_METADATA_BACKEND`가 알 수 없는 값이면 `DmsSettings.from_env()`가 `dms.ConfigurationError`를 발생시킨다. `DMS_MAX_FILE_SIZE`가 숫자가 아니거나 0 이하인 경우도 parse 단계에서 거부된다.

### `CFG-PG` — PostgreSQL metadata store

`DMS_METADATA_BACKEND=postgresql`일 때 runtime 조립에 필요하다.

| 변수 | Python field | 타입/기본값 | runtime requiredness |
| --- | --- | --- | --- |
| `POSTGRES_HOST` | `postgres_host` | string, 없음 | 필수 |
| `POSTGRES_PORT` | `postgres_port` | integer, `5432` | 선택 |
| `POSTGRES_DB` | `postgres_database` | string, 없음 | 필수 |
| `POSTGRES_USER` | `postgres_user` | string, 없음 | 필수 |
| `POSTGRES_PASSWORD` | `postgres_password` | string, 없음 | 필수 |
| `POSTGRES_SSLMODE` | `postgres_sslmode` | string/null, 없음 | 선택; 지정 시 SQLAlchemy URL query에 전달 |

구성은 individual `POSTGRES_*` fields로 한다. `POSTGRES_DSN`을 individual fields와 함께 쓰거나 단독으로 쓰지 않는다.

### `CFG-SQLITE` — SQLite metadata store

`DMS_METADATA_BACKEND=sqlite`일 때 `SQLITE_PATH`가 runtime 조립에 필요하다.

| 변수 | Python field | 타입/기본값 | 설명 |
| --- | --- | --- | --- |
| `SQLITE_PATH` | `sqlite_path` | string, 없음 | 파일 path 또는 `:memory:` |

`:memory:`는 process-local SQLite engine을 만들고, 파일 path는 parent directory를 만든 뒤 사용한다. SQLite를 선택해도 MinIO object store 설정은 계속 필수다.

### `CFG-MINIO` — object store

PostgreSQL과 SQLite 모두에서 필요하다.

| 변수 | Python field | 타입/기본값 | runtime requiredness |
| --- | --- | --- | --- |
| `MINIO_ENDPOINT` | `minio_endpoint` | string, 없음 | 필수 |
| `MINIO_ACCESS_KEY` | `minio_access_key` | string, 없음 | 필수 |
| `MINIO_ACCESS_KEY_ID` | same field | fallback alias | `MINIO_ACCESS_KEY`가 없을 때만 사용 |
| `MINIO_SECRET_KEY` | `minio_secret_key` | string, 없음 | 필수 |
| `MINIO_BUCKET` | `minio_bucket` | string, 없음 | 필수 |
| `MINIO_SECURE` | `minio_secure` | boolean, `false` | 선택; true면 TLS |
| `MINIO_REGION` | `minio_region` | string/null, 없음 | 선택 |

boolean은 `true/1/yes/on` 또는 `false/0/no/off`를 대소문자 무시하고 인식한다. 그 밖의 값은 `ConfigurationError`다. secret은 source, Wiki 예제, response, log에 실제 값을 넣지 않는다.

## 4. 복사 가능한 환경 예시

### PostgreSQL + MinIO baseline

```bash
export DMS_METADATA_BACKEND=postgresql
export POSTGRES_HOST=postgres
export POSTGRES_PORT=5432
export POSTGRES_DB=docmesh
export POSTGRES_USER=docmesh
export POSTGRES_PASSWORD='<postgres-password>'
# export POSTGRES_SSLMODE=require

export MINIO_ENDPOINT=minio:9000
export MINIO_ACCESS_KEY='<minio-access-key>'
export MINIO_SECRET_KEY='<minio-secret-key>'
export MINIO_BUCKET=documents
export MINIO_SECURE=false

# optional
# export DMS_MAX_FILE_SIZE=10485760
# export ROOT_PATH=/dms
# export CORS_ORIGINS=https://app.example.invalid
```

### SQLite + MinIO local alternative

```bash
export DMS_METADATA_BACKEND=sqlite
export SQLITE_PATH=./data/docmesh.sqlite3
export MINIO_ENDPOINT=localhost:9000
export MINIO_ACCESS_KEY='<minio-access-key>'
export MINIO_SECRET_KEY='<minio-secret-key>'
export MINIO_BUCKET=documents
export MINIO_SECURE=false
```

SQLite를 선택할 때 PostgreSQL 값은 주석 처리하거나 environment에서 제거한다. `POSTGRES_DSN`은 어느 backend에서도 설정하지 않는다.

## 5. Programmatic configuration API

### `CFG-PROGRAMMATIC-001` — `DmsSettings`

```python
from docmesh_doc.dms_factory import DmsSettings

settings = DmsSettings(
    metadata_backend="sqlite",
    sqlite_path=":memory:",
    minio_endpoint="localhost:9000",
    minio_access_key="<access-key>",
    minio_secret_key="<secret-key>",
    minio_bucket="documents",
    minio_secure=False,
    max_file_size=10 * 1024 * 1024,
    root_path="/dms",
)
```

전체 dataclass field는 다음과 같다.

```text
metadata_backend, postgres_host, postgres_port, postgres_database,
postgres_user, postgres_password, postgres_sslmode, sqlite_path,
minio_endpoint, minio_access_key, minio_secret_key, minio_bucket,
minio_secure, minio_region, max_file_size, root_path, cors_origins
```

`DmsSettings.from_env(env: Mapping[str, str] | None = None)`는 전달한 mapping을 읽는다. 명시 mapping을 사용하면 test/embedding에서 process environment를 mutate하지 않고 동일한 parser를 검증할 수 있다.

### `CFG-PROGRAMMATIC-002` — application/runtime injection

```python
from docmesh_doc.application import create_application

# host가 이미 생성하고 소유하는 SDK를 주입하는 예
app = create_application(
    sdk=host_owned_sdk,
    settings=settings,
    root_path="/dms",
    readiness_check=lambda: True,
)
```

`create_application`의 public parameters:

| parameter | 기본값 | 설명 |
| --- | --- | --- |
| `sdk` | `None` | host-owned DMS SDK. `runtime`과 동시 사용 불가 |
| `settings` | `None` | `DmsSettings`; 생략하면 environment parser 사용 |
| `runtime` | `None` | host-owned `DmsRuntime`; 전달하면 `runtime.sdk` 사용 |
| `root_path` | `None` | 선택된 settings의 root path override |
| `readiness_check` | `None` | bool 또는 payload mapping을 반환하는 host hook |

`create_dms_runtime(settings=None)`는 Engine, MinIO client와 `DocumentManagementSDKFactory`를 조립한다. PostgreSQL/MinIO 필수값이 없으면 `dms.ConfigurationError`가 발생하며 MinIO 조립 전에 실패해도 이미 만든 engine을 dispose한다.

## 6. Readiness와 lifecycle

`API-OPS-002`의 소유권은 application/host다.

| 조립 방식 | readiness source | 종료 시 application 동작 |
| --- | --- | --- |
| `sdk=` 주입 | SDK가 존재하는지 확인하거나 `readiness_check` 사용 | SDK를 닫지 않음 |
| `runtime=` 주입 | `runtime.check_readiness()` 또는 custom hook | runtime을 닫지 않음 |
| 아무것도 주입하지 않음 | application-owned runtime의 engine + MinIO bucket | application-owned runtime `close()` 호출 |

`DmsRuntime.check_readiness()`는 engine connection과 MinIO `bucket_exists(bucket_name)`를 검사한다. 모든 detail이 true이면 `200`; 하나라도 false이면 `503`이다. 네트워크 readiness를 DMS facade의 전역 health API로 추론하지 않는다.

## 7. 설정 오류와 금지 항목

- `DMS_METADATA_BACKEND`는 `postgresql`/`sqlite` 외 값을 사용하지 않는다.
- `POSTGRES_DSN`은 현재 host adapter에서 금지된 legacy setting이다.
- PostgreSQL 선택 시 `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`가 필요하다.
- SQLite 선택 시 `SQLITE_PATH`가 필요하다.
- 두 backend 모두 `MINIO_ENDPOINT`, access key, secret key, bucket이 필요하다.
- production secret을 `.env.example`, source, Wiki, Docker image, API response, log에 저장하지 않는다.
- 현재 구현이 읽지 않는 `KEYCLOAK_*`, `NATS_*`, `MILVUS_*`, `OLLAMA_*`, `DOCMESH_SERVICES`, `TOKEN_URL`, `CORS_CREDENTIALS`는 이 서비스의 설정 계약으로 추가하지 않는다.

## 8. API 역추적 matrix

| API ID | 설정 근거 |
| --- | --- |
| `API-DOC-001` | `CFG-DMS-001`, `CFG-DMS-002`, `CFG-PG` 또는 `CFG-SQLITE`, `CFG-MINIO`, `CFG-APP-001` |
| `API-DOC-002` | `CFG-DMS-001`, `CFG-PG` 또는 `CFG-SQLITE`, `CFG-MINIO` |
| `API-DOC-003` | `CFG-DMS-001`, `CFG-PG` 또는 `CFG-SQLITE`, `CFG-MINIO` |
| `API-DOC-004` | `CFG-DMS-001`, `CFG-PG` 또는 `CFG-SQLITE`, `CFG-MINIO` |
| `API-DOC-005` | `CFG-DMS-001`, `CFG-DMS-002`, `CFG-PG` 또는 `CFG-SQLITE`, `CFG-MINIO` |
| `API-DOC-006` | `CFG-DMS-001`, `CFG-PG` 또는 `CFG-SQLITE`, `CFG-MINIO` |
| `API-DOC-007` | `CFG-DMS-001`, `CFG-PG` 또는 `CFG-SQLITE`, `CFG-MINIO` |
| `API-OPS-001` | `CFG-APP-001` |
| `API-OPS-002` | `CFG-PROGRAMMATIC-002`, `CFG-PG` 또는 `CFG-SQLITE`, `CFG-MINIO` |
| `API-SYS-001` | `CFG-APP-001` |
| `API-SYS-002` | `CFG-APP-001` |
| `API-SYS-003` | `CFG-APP-001` |
| `API-SYS-004` | `CFG-APP-001` |
| `API-HOST-001` | `CFG-PROGRAMMATIC-001`, `CFG-PROGRAMMATIC-002`, 모든 선택 storage group |
| `API-HOST-002` | `CFG-APP-001`, `CFG-DMS-001`, 선택 storage group |

## 9. 설정 검증 근거

| 항목 | 구현 | 테스트 |
| --- | --- | --- |
| legacy DSN 거부 | `dms_factory.py:71-75` | `test_factory.py::test_legacy_postgres_dsn_is_rejected` |
| SQLite runtime 조립 | `dms_factory.py:184-197`, `229-251` | `test_factory.py::test_sqlite_settings_create_a_host_owned_dms_runtime` |
| engine rollback | `dms_factory.py:232-245` | `test_factory.py::test_runtime_creation_disposes_engine_when_minio_assembly_fails` |
| root path/CORS selection | `dms_factory.py:84-97`, `application.py:109-147` | `test_api.py::test_upload_location_respects_root_path` |
| injected/application-owned lifecycle | `application.py:116-127` | `test_api.py` lifespan ownership cases |

실행 검증은 repository root에서 다음으로 수행한다.

```bash
uv run pytest -q
```
