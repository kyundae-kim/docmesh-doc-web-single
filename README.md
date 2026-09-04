# docmesh-doc-web-single

DocMesh Document Service(`docmesh-doc` v0.7.0)를 위한 단일 사용자 문서 콘솔입니다. React/Vite frontend와 Express BFF가 하나의 same-origin 웹 진입점을 제공하고, BFF가 내부 DocMesh application으로 REST 요청을 전달합니다.

```text
browser ──> Express BFF + React static files ──> docmesh-doc:8000
                                                  ├─ metadata store
                                                  └─ MinIO object store
```

## 기능

### 일반 문서 workspace

- multipart stream upload: `POST /documents`
- multipart file upload: `POST /documents/file`
- strict base64 JSON upload: `POST /documents/bytes`
- cursor, explicit page, iterator list: `GET /documents`, `/documents/page`, `/documents/iterator`
- filename/type/ID local search와 status filter
- public metadata refresh: `GET /documents/{document_id}`
- inline, eager, async, chunks, checksum-aware copy content reader
- attachment download와 `Content-*`, `X-Document-Checksum`, `X-Checksum-Verified` 표시
- parameterized soft delete와 명시적 soft delete
- idempotency upload operation 조회
- liveness와 dependency readiness를 분리한 상태 표시
- OpenAPI JSON, Swagger UI, OAuth redirect support route, ReDoc 링크

### 운영자 workspace

management, recovery, reset, hard-delete는 일반 사용자 화면에서 기본 잠겨 있습니다. 외부 authorization gateway와 격리된 operator network를 구성한 경우에만 build/runtime flag를 함께 활성화합니다.

```env
VITE_ENABLE_OPERATOR_CONSOLE=true
ALLOW_OPERATOR_ROUTES=true
```

운영자 화면은 internal metadata/inspection, recovery candidates(범위 조회와 iterator), single/batch/plan reconciliation, global/configured-partition reset 및 initialization, explicit hard delete를 제공합니다. `storage_key`와 destructive payload는 이 명시적인 운영자 화면에서만 다룹니다.

## 로컬 개발

```bash
npm install
npm run dev
```

Vite는 `/api`를 `http://docmesh-doc:8000`으로 proxy합니다. 기본 frontend API base는 `/api`이며, 직접 다른 origin을 사용할 때만 `.env`의 `VITE_API_BASE_URL`을 변경하세요. multipart 요청의 boundary는 브라우저가 만들도록 adapter가 `Content-Type`을 직접 지정하지 않습니다.

## 검증

```bash
npm test
npm run test:unit
npm run test:integration
npm run build
```

unit test는 API adapter와 React 상태/interaction을 검증하고, Express integration test는 실제 local HTTP upstream을 사용해 `/api` prefix 제거, query/body streaming, binary/header forwarding, correlation ID, operator route 차단과 context header 제거를 검증합니다.

## Docker Compose 배포

Docker Engine과 Compose v2가 필요합니다. `.env.example`의 값은 로컬 개발용 template이므로 production credential로 사용하지 마세요.

```bash
cp .env.example .env
# .env의 MINIO_ROOT_PASSWORD와 MINIO_SECRET_KEY를 긴 임의 값으로 교체
docker compose --env-file .env config --quiet
docker compose --env-file .env up -d --build
```

기본 접속 주소는 `http://localhost:8080`이며 `WEB_PORT`로 변경할 수 있습니다. `web`만 host port를 publish하고 DocMesh API와 MinIO는 Compose network 내부에만 노출합니다.

Compose stack은 다음을 수행합니다.

- `docmesh-doc:v0.7.0` image를 사용하고 API readiness가 통과한 뒤 web을 시작
- MinIO health 이후 `minio-init`에서 `documents` bucket을 idempotent하게 생성
- SQLite metadata volume(`docmesh-data`)과 MinIO object volume(`minio-data`) 유지
- DocMesh non-root user(`10001:10001`)가 SQLite volume을 쓸 수 있도록 one-shot volume init 실행
- `API_TARGET`, `DOCMESH_IMAGE`, `DMS_*`, `MINIO_*`, `WEB_PORT`를 environment substitution으로 설정

기본 API prefix는 `/api`입니다. 외부 `ROOT_PATH`를 사용하는 ingress 구성에서는 `ROOT_PATH`, `API_PREFIX`, `VITE_API_BASE_URL`을 같은 외부 prefix 정책으로 맞추고 web asset 경로를 ingress에서 함께 rewrite하세요. Express BFF는 `API_PREFIX`를 mount path로 사용하며 upstream에는 prefix를 전달하지 않습니다.

상태와 로그:

```bash
docker compose ps
```

`docker compose down -v`는 named volume을 삭제해 문서와 object를 파괴합니다. disposable 환경에서만 실행하세요.

PostgreSQL을 사용할 때는 `DMS_METADATA_BACKEND=postgresql`과 개별 `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`를 주입하고, `POSTGRES_DSN`은 사용하지 않습니다. SQLite를 사용해도 MinIO는 필수입니다.

## BFF 보안 경계

- browser-facing BFF는 `/management/**`, hard-delete route, `?hard=true`를 기본 `403`으로 차단합니다.
- `X-Subject`, `X-User-ID`, `X-Tenant-ID`, `X-Roles`, `X-Created-By`, `X-Idempotency-Scope`, `X-Audit-Actor`, `X-Default-Metadata` 등 browser-supplied context header는 기본적으로 upstream에 전달하지 않습니다.
- `X-Correlation-ID`는 BFF error response와 upstream 요청에 보존합니다.
- `ALLOW_OPERATOR_ROUTES`와 `FORWARD_TRUSTED_CONTEXT_HEADERS`는 신뢰된 gateway가 앞단에서 authorization을 소유하는 경우에만 명시적으로 설정합니다.
- 애플리케이션은 bearer/OAuth2/Keycloak middleware를 내장하지 않으며, v0.7.0의 fixed personal partition/application identity는 DocMesh service가 server-side에서 선택합니다.

## 구조

- `src/DocumentWorkspace.jsx` — 일반 사용자 React workspace, upload/list/content/delete/support flow
- `src/OperatorConsole.jsx` — opt-in operator/recovery/reset flow
- `src/api.js` — v0.7.0 REST adapter, binary header/error/cursor contract
- `server.mjs` — Express static server와 `/api` BFF proxy
- `src/*.test.*` — adapter, UI, BFF integration tests
- `Dockerfile` — React build와 Express runtime multi-stage image
- `docker-compose.yml` — web, docmesh-doc, MinIO, bucket/volume initialization

Python hosting API(`create_application`, `DmsSettings`, `create_dms_runtime`)는 `docmesh-doc` application의 host contract이며 browser frontend가 직접 호출하는 기능이 아닙니다. HTTP 공개 surface와 설정의 기준 문서는 `wiki/raw/articles/docmesh-api-reference-v0-7-0.md`, `docmesh-configuration-v0-7-0.md`, `docmesh-examples-v0-7-0.md`입니다.