# docmesh-doc-web-single

DocMesh 프로젝트의 단일 사용자용 문서 관리 웹 UI입니다. React + Vite로 구성되어 있으며 `DocMesh Document Service` REST API를 application layer로 사용합니다.

## 제공 기능

- `GET /documents` 기반 문서 카드 목록
- 파일명·형식·문서 ID 로컬 검색
- API status 필터와 opaque cursor 기반 추가 목록 로드
- `POST /documents` multipart 파일 업로드
- 문서 metadata 상세 보기와 content inline preview
- attachment download
- soft delete / hard delete
- `/health/readiness` 기반 서비스 상태 표시
- 오류 envelope의 사용자 메시지 표시 및 로딩·빈 상태 처리

## 실행

```bash
npm install
npm run dev
```

개발 서버는 `/api` 요청을 `http://docmesh-doc:8000`으로 프록시합니다. 따라서 브라우저에서 REST API의 CORS 설정이 없어도 로컬 개발을 진행할 수 있습니다.

API base를 직접 지정해야 하는 환경에서는 `.env`를 추가합니다.

```env
VITE_API_BASE_URL=http://docmesh-doc:8000
```

직접 지정하는 경우 배포 origin에 대한 API CORS 허용이 필요합니다. 배포 서버가 `/api`를 DocMesh 서비스로 전달한다면 다음처럼 사용할 수 있습니다.

```env
VITE_API_BASE_URL=/api
```

## 검증

```bash
npm test
npm run build
```

## Docker 배포

`Dockerfile`은 Vite 애플리케이션을 빌드한 뒤 Node 정적 서버로 제공하는 multi-stage 이미지입니다. `server.mjs`가 정적 파일, SPA fallback, `/api` 요청의 Compose 내부 `docmesh-doc:8000` 프록시를 담당하므로 브라우저와 API가 같은 origin을 사용합니다.

배포 전 Docker Engine과 Compose v2를 준비하고, `DOCMESH_IMAGE`로 지정한 DocMesh Document Service 이미지를 로컬 또는 접근 가능한 레지스트리에 준비합니다.

```bash
cp .env.example .env
# .env의 MINIO_ROOT_PASSWORD를 실제 임의의 긴 값으로 변경
docker compose up -d --build
```

기본 접속 주소는 `http://localhost:8080`이며 `WEB_PORT`로 변경할 수 있습니다. Compose는 MinIO bucket을 초기화하고 API readiness가 통과한 뒤 웹 컨테이너를 시작합니다. 문서 metadata와 object는 각각 `docmesh-data`, `minio-data` named volume에 보존됩니다.

```bash
docker compose ps
docker compose logs -f web docmesh-doc
```

데이터까지 삭제하려면 `docker compose down -v`를 사용합니다. API와 MinIO 포트는 기본적으로 외부에 publish하지 않고 웹 컨테이너 네트워크에서만 접근하도록 구성했습니다.

## 구조

- `src/App.jsx` — 문서 workspace 화면과 관리 interaction
- `src/api.js` — DocMesh REST API adapter
- `src/styles.css` — 간결한 카드형 반응형 UI
- `server.mjs` — production 정적 파일 서버와 `/api` reverse proxy
- `vite.config.js` — `/api` → `http://docmesh-doc:8000` 개발 프록시
