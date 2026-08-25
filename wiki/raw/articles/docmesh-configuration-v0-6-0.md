---
source_url: https://github.com/kyundae-kim/docmesh-doc/wiki/Configuration-v0.6.0
ingested: 2026-08-25
sha256: 576cb64269a3101561723bde20e708ab3bb8841b8f0455046595d23c8f739160
---
# DocMesh Document Service 설정 정의서 v0.6.0

이 페이지는 `docmesh-doc` project version `0.6.0`의 process environment, programmatic settings, host-owned storage assembly, request context와 lifecycle 계약을 정의한다.

- 기준 commit: `b20c35c35eaf9352a3c56f6465ab4fe59845820e`
- API reference: [[API-Reference-v0.6.0]]
- 실행 예시: [[Examples-v0.6.0]]
- 구현: `docmesh_doc/dms_factory.py`, `docmesh_doc/application.py`, `docmesh_doc/dependencies.py`
- repository template: `.env.example`
- `.env` 자동 로딩: 없음
- 지원 metadata backend: `postgresql`, `sqlite`
- object store: MinIO 필수

> **버전 식별 주의:** `pyproject.toml` 버전은 `0.6.0`이지만 runtime FastAPI/OpenAPI metadata는 현재 `0.5.0`이다. 설정 문서와 page version은 project version `0.6.0`을 사용한다.

> **범위:** 현재 host adapter가 읽는 설정만 문서화한다. Keycloak, OAuth2, NATS, Milvus, Ollama, `DOCMESH_SERVICES`, `DMS_CONFIGURATION_STRICT`, `CORS_CREDENTIALS`, `POSTGRES_DSN`은 현재 설정 계약에 추가하지 않는다. `POSTGRES_DSN`은 존재할 때 명시적으로 거부된다.

## 1. 설정 ownership과 loading flow

```text
process environment 또는 명시적인 DmsSettings
                  │
                  ▼
create_application(settings=..., root_path=...)
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
 FastAPI app state       lifespan
 root_path/CORS          create_dms_runtime(settings)
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
             SQLAlchemy Engine   MinIO client + bucket
                    │                   │
                    └─────────┬─────────┘
                              ▼
              dms.DocumentManagementSDKFactory(...).create()
```

- `DmsSettings.from_env()`가 문자열 environment를 immutable `DmsSettings`로 변환한다.
- `create_application()`은 settings를 선택하고 app state에 저장한다.
- `sdk=` 또는 `runtime=`을 주입하면 host가 만든 객체를 사용하며 application은 caller-owned resource를 닫지 않는다.
- 둘 다 생략하면 application lifespan 안에서 runtime을 조립하고 application-owned engine을 종료 때 dispose한다.
- `dms-core` facade 자체는 global `close()` 또는 `check_health()`를 제공하지 않는다. readiness와 storage lifecycle은 이 host adapter가 담당한다.

## 2. Config ID와 requiredness

| group | group 의미 | 정의 ID |
| --- | --- | --- |
| `CFG-APP` | application URL prefix와 CORS | `CFG-APP-001`, `CFG-APP-002` |
| `CFG-DMS` | DMS backend policy와 file-size policy | `CFG-DMS-001`, `CFG-DMS-002` |
| `CFG-STORE` | metadata store 선택과 backend 연결 | `CFG-STORE-001`, `CFG-STORE-002` |
| `CFG-MINIO` | object store endpoint/credential/bucket | `CFG-MINIO-001` |
| `CFG-CONTEXT` | request header에서 만드는 operation context | `CFG-CONTEXT-001` |
| `CFG-PROGRAMMATIC` | Python settings/runtime injection | `CFG-PROGRAMMATIC-001`, `CFG-PROGRAMMATIC-002` |

parser에서 `None`인 값과 제품 runtime requiredness는 다르다. 예를 들어 `DmsSettings.postgres_host`와 `minio_endpoint`의 dataclass default는 `None`이지만 application-owned runtime 조립에서는 선택 backend와 object store에 필요한 값이다.

## 3. Process environment

### `CFG-APP` — application settings

#### `CFG-APP-001` — `ROOT_PATH`

| 항목 | 계약 |
| --- | --- |
| environment | `ROOT_PATH` |
| Python field | `DmsSettings.root_path` |
| type/default | string, `""` |
| product requiredness | optional |
| secret | no |
| consumer | `create_application`, FastAPI root path, upload `Location` |
| normalization | empty → `""`; leading `/` added; non-root trailing `/` removed |

예: `ROOT_PATH=dms/` → `settings.root_path == "/dms"`.

#### `CFG-APP-002` — `CORS_ORIGINS`

| 항목 | 계약 |
| --- | --- |
| environment | `CORS_ORIGINS` |
| Python field | `DmsSettings.cors_origins` |
| type/default | comma-separated string, empty tuple |
| product requiredness | optional |
| secret | no |
| consumer | origin이 하나 이상이면 `CORSMiddleware` 추가 |

각 origin은 comma split 후 trim한다. `*`를 포함하면 `allow_credentials=False`, 그 외에는 `True`; methods와 headers는 `*`다. 현재 loader는 `CORS_CREDENTIALS`를 읽지 않는다.

### `CFG-DMS` — DMS policy

#### `CFG-DMS-001` — metadata backend selection

| 항목 | 계약 |
| --- | --- |
| environment | `DMS_METADATA_BACKEND` |
| Python field | `DmsSettings.metadata_backend` |
| type/default | lower-cased string, `postgresql` |
| allowed | `postgresql`, `sqlite` |
| invalid value | `dms.ConfigurationError` |
| consumer | `_create_engine()`, application-owned runtime |

#### `CFG-DMS-002` — file-size policy

| 항목 | 계약 |
| --- | --- |
| environment | `DMS_MAX_FILE_SIZE` |
| Python field | `DmsSettings.max_file_size` |
| type/default | positive integer bytes, unset → `None` |
| invalid value | non-integer 또는 `<= 0`이면 `dms.ConfigurationError` |
| consumer | `create_dms_runtime()` → DMS factory `max_file_size` |

#### 금지 setting — `POSTGRES_DSN`

`POSTGRES_DSN`은 host adapter가 지원하지 않는다. process environment에 값이 존재하면 metadata backend가 SQLite여도 `DmsSettings.from_env()`가 `ConfigurationError`를 발생시킨다. PostgreSQL은 아래 individual `POSTGRES_*` fields를 사용한다.

### `CFG-STORE` — metadata store

#### `CFG-STORE-001` — PostgreSQL fields

`DMS_METADATA_BACKEND=postgresql`일 때 application-owned runtime 조립에 필요하다.

| environment | Python field | type/default | runtime requiredness | secret |
| --- | --- | --- | :---: | :---: |
| `POSTGRES_HOST` | `postgres_host` | string, unset | required | no |
| `POSTGRES_PORT` | `postgres_port` | integer, `5432` | optional | no |
| `POSTGRES_DB` | `postgres_database` | string, unset | required | no |
| `POSTGRES_USER` | `postgres_user` | string, unset | required | no |
| `POSTGRES_PASSWORD` | `postgres_password` | string, unset | required | yes |
| `POSTGRES_SSLMODE` | `postgres_sslmode` | string/null, unset | optional | no |

`POSTGRES_SSLMODE`가 있으면 SQLAlchemy URL query의 `sslmode`로 전달한다.

#### `CFG-STORE-002` — SQLite field

`DMS_METADATA_BACKEND=sqlite`일 때 `SQLITE_PATH`가 runtime 조립에 필요하다.

| environment | Python field | type/default | 설명 |
| --- | --- | --- | --- |
| `SQLITE_PATH` | `sqlite_path` | string, unset | file path 또는 `:memory:` |

`:memory:`는 process-local SQLite engine을 만들고, file path는 parent directory를 만든다. SQLite를 선택해도 MinIO는 계속 필요하다.

### `CFG-MINIO` — object store

#### `CFG-MINIO-001` — MinIO connection

PostgreSQL과 SQLite 모두에서 application-owned DMS runtime 조립에 필요하다.

| environment | Python field | type/default | runtime requiredness | secret |
| --- | --- | --- | :---: | :---: |
| `MINIO_ENDPOINT` | `minio_endpoint` | string, unset | required | no |
| `MINIO_ACCESS_KEY` | `minio_access_key` | string, unset | required | yes |
| `MINIO_ACCESS_KEY_ID` | same field fallback | alias | optional fallback | yes |
| `MINIO_SECRET_KEY` | `minio_secret_key` | string, unset | required | yes |
| `MINIO_BUCKET` | `minio_bucket` | string, unset | required | no |
| `MINIO_SECURE` | `minio_secure` | boolean, `false` | optional | no |
| `MINIO_REGION` | `minio_region` | string/null, unset | optional | no |

`MINIO_ACCESS_KEY`가 있으면 `MINIO_ACCESS_KEY_ID`보다 우선한다. Boolean은 `true/1/yes/on`, `false/0/no/off`를 case-insensitive로 인식한다. 그 외 값은 `ConfigurationError`다.

### `CFG-CONTEXT` — request operation context

#### `CFG-CONTEXT-001` — trusted request headers

이 group은 process setting이 아니라 모든 DMS route dependency가 읽는 transport context다.

| header | DmsOperationContext field | default/normalization |
| --- | --- | --- |
| `X-Subject` | `access.subject`, `created_by`, `audit_actor` | created/audit fallback |
| `X-User-ID` | `access.user_id`, `user_id` | user scope |
| `X-Tenant-ID` | `access.tenant` | optional |
| `X-Roles` | `access.roles` | comma split, trim, empty 제거 |
| `X-Created-By` | `created_by` | subject보다 우선 |
| `X-Idempotency-Scope` | `idempotency_scope` | operation lookup default |
| `X-Audit-Actor` | `audit_actor` | subject보다 우선 |
| `X-Default-Metadata` | `default_metadata` | strict standard JSON; invalid이면 400 |

현재 service는 이 header의 신뢰성을 검증하지 않는다. gateway가 인증 claim에서 값을 만들고 client가 임의로 덮어쓰지 못하게 해야 한다.

### `CFG-PROGRAMMATIC` — Python configuration

#### `CFG-PROGRAMMATIC-001` — `DmsSettings`

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

전체 dataclass fields:

```text
metadata_backend, postgres_host, postgres_port, postgres_database,
postgres_user, postgres_password, postgres_sslmode, sqlite_path,
minio_endpoint, minio_access_key, minio_secret_key, minio_bucket,
minio_secure, minio_region, max_file_size, root_path, cors_origins
```

`DmsSettings.from_env(env: Mapping[str, str] | None = None)`는 전달 mapping을 사용하면 process environment를 mutate하지 않고 동일 parser를 검증할 수 있다.

#### `CFG-PROGRAMMATIC-002` — application/runtime/readiness injection

```python
from docmesh_doc.application import create_application

app = create_application(
    sdk=host_owned_sdk,
    settings=settings,
    root_path="/dms",
    readiness_check=lambda: True,
)
```

`create_application()` parameters:

| parameter | default | 계약 |
| --- | --- | --- |
| `sdk` | `None` | host-owned DMS SDK. `runtime`과 동시 사용 불가 |
| `settings` | `None` | `DmsSettings`; 없으면 `os.environ` parser |
| `runtime` | `None` | host-owned `DmsRuntime`; `runtime.sdk` 사용 |
| `root_path` | `None` | selected settings root path override |
| `readiness_check` | `None` | `bool` 또는 `{ok, status, details}` 반환 hook |

`create_application()`은 `sdk=`/`runtime=` 객체를 닫지 않는다. 둘 다 생략하면 lifespan이 `create_dms_runtime()`을 호출하고 application-owned runtime을 닫는다.

## 4. 복사 가능한 environment 예시

### 4.1 PostgreSQL + MinIO baseline

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

### 4.2 SQLite + MinIO local alternative

```bash
export DMS_METADATA_BACKEND=sqlite
export SQLITE_PATH=./data/docmesh.sqlite3
export MINIO_ENDPOINT=localhost:9000
export MINIO_ACCESS_KEY='<minio-access-key>'
export MINIO_SECRET_KEY='<minio-secret-key>'
export MINIO_BUCKET=documents
export MINIO_SECURE=false
```

SQLite를 선택할 때 PostgreSQL fields는 주석 처리하거나 environment에서 제거한다. `POSTGRES_DSN`은 어느 backend에서도 설정하지 않는다.

### 4.3 repository `.env.example`와 injection

`.env.example`은 template일 뿐 자동으로 load되지 않는다. 현재 code path는 `DmsSettings.from_env()`에서 process environment를 읽는다. container orchestrator, Docker Compose, CI secret store 또는 shell export로 값을 주입한다. template의 `change-me` 값은 production credential이 아니다.

## 5. startup, readiness, lifecycle

| assembly | readiness source | shutdown behavior |
| --- | --- | --- |
| `sdk=` injection | SDK 존재 여부 또는 custom `readiness_check` | SDK를 닫지 않음 |
| `runtime=` injection | `runtime.check_readiness()` 또는 custom hook | runtime/engine을 닫지 않음 |
| 아무것도 injection하지 않음 | application-owned engine connection + MinIO `bucket_exists()` | application-owned `runtime.close()` 호출 |

`DmsRuntime.check_readiness()`는 다음을 반환한다.

```json
{
  "status": "ok",
  "details": {
    "metadata": {"ok": true},
    "object_store": {"ok": true}
  },
  "ok": true
}
```

어느 detail이라도 false이면 `API-OPS-002`는 503을 반환한다. `DmsRuntime.close()`는 lock으로 중복 호출을 무시하며 SQLAlchemy engine을 dispose한다. DMS SDK facade의 global close를 호출하지 않는다.

runtime 조립 중 MinIO client 또는 factory 생성이 실패하면 이미 만든 engine을 rollback dispose한다.

## 6. 설정 오류와 금지 항목

- `DMS_METADATA_BACKEND`는 `postgresql` 또는 `sqlite`만 허용한다.
- PostgreSQL 선택 시 `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`가 필요하다.
- SQLite 선택 시 `SQLITE_PATH`가 필요하다.
- 두 backend 모두 `MINIO_ENDPOINT`, access key, secret key, bucket이 필요하다.
- `MINIO_SECURE`, `MINIO_MAX_*` 등 loader에 없는 값은 계약이 아니다.
- `POSTGRES_DSN`은 legacy forbidden setting이다.
- production secret을 `.env.example`, Wiki, source, image, response, log에 넣지 않는다.
- 현재 loader가 읽지 않는 `KEYCLOAK_*`, `NATS_*`, `MILVUS_*`, `OLLAMA_*`, `DOCMESH_SERVICES`, `TOKEN_URL`, `CORS_CREDENTIALS`는 이 서비스 설정으로 추가하지 않는다.

## 7. API ↔ 설정 reverse trace matrix

API reference의 모든 `API-*` ID를 설정 group으로 역추적한다. `CFG-STORE`에는 PostgreSQL/SQLite alternative가 포함되고, `CFG-MINIO`는 application-owned runtime에서 required다. 각 행의 group 집합은 API reference matrix와 동일하다.

| API ID | CFG groups |
| --- | --- |
| `API-DOC-001` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-002` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-003` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-004` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-005` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-006` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-007` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-008` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-009` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-010` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-011` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-012` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-013` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-014` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-015` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-DOC-016` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-UPLOAD-001` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-001` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-002` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-003` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-004` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-005` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-006` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-007` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-008` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-MGMT-009` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT` |
| `API-OPS-001` | `CFG-APP` |
| `API-OPS-002` | `CFG-APP`, `CFG-STORE`, `CFG-MINIO`, `CFG-PROGRAMMATIC` |
| `API-SYS-001` | `CFG-APP` |
| `API-SYS-002` | `CFG-APP` |
| `API-SYS-003` | `CFG-APP` |
| `API-SYS-004` | `CFG-APP` |
| `API-HOST-001` | `CFG-APP`, `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-CONTEXT`, `CFG-PROGRAMMATIC` |
| `API-HOST-002` | `CFG-APP`, `CFG-DMS`, `CFG-STORE`, `CFG-MINIO` |
| `API-HOST-003` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-PROGRAMMATIC` |
| `API-HOST-004` | `CFG-DMS`, `CFG-STORE`, `CFG-MINIO`, `CFG-PROGRAMMATIC` |
| `API-HOST-005` | `CFG-STORE`, `CFG-MINIO`, `CFG-PROGRAMMATIC` |

## 8. 검증 근거

| 확인 항목 | 구현 근거 | test evidence |
| --- | --- | --- |
| legacy DSN 거부 | `dms_factory.py:71-75` | `test_factory.py::test_legacy_postgres_dsn_is_rejected` |
| SQLite engine/runtime assembly | `dms_factory.py:184-197,230-252` | `test_factory.py::test_sqlite_settings_create_a_host_owned_dms_runtime` |
| engine rollback | `dms_factory.py:232-245` | `test_factory.py::test_runtime_creation_disposes_engine_when_minio_assembly_fails` |
| root path/CORS selection | `dms_factory.py:84-97`, `application.py:108-147` | `test_api.py::test_upload_location_respects_root_path` |
| injected/application-owned lifecycle | `application.py:115-127` | `test_api.py` lifecycle ownership cases |
| context header conversion | `dependencies.py:24-71` | `test_full_api.py::test_request_headers_are_converted_to_a_scoped_dms_context` |
| full runtime verification | current checkout | `uv run --frozen pytest -q` → `43 passed, 1 warning` |

## 9. 문서가 약속하지 않는 설정

아래 값은 과거 Wiki 또는 upstream capability에 등장할 수 있지만 현재 `DmsSettings.from_env()`가 읽지 않으므로 이 서비스의 configuration contract가 아니다.

```text
POSTGRES_DSN
KEYCLOAK_*
NATS_*
MILVUS_*
OLLAMA_*
DOCMESH_SERVICES
DMS_CONFIGURATION_STRICT
CORS_CREDENTIALS
TOKEN_URL
```

이 목록을 활성 environment에 추가해도 current host adapter의 기능이 활성화되지 않는다.
