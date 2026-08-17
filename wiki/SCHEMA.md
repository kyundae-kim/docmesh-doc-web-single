# Wiki Schema

## Domain

이 위키는 문서 관리 web 프로젝트를 다룬다. 애플리케이션 계층과 비즈니스 로직은 별도 프로그램이 제공하는 RESTful API에 있으며, 이 프로젝트는 프론트엔드 web UI와 API 소비 계층만 책임진다.

### Scope

- 문서 목록·상세·작성·수정·삭제 등 사용자 흐름
- 프론트엔드 화면, 컴포넌트, 디자인 시스템, 상태 관리
- RESTful API와의 연동 계약, 요청·응답 매핑, 오류·로딩·권한 처리
- 검색, 필터, 정렬, 메타데이터, 접근성, 성능, 테스트, 배포
- 외부 API 변경이 UI에 미치는 영향과 대응 기록

### Out of scope

- API 서버의 내부 구현, 데이터베이스 스키마, 서버 배포
- 문서 도메인의 서버 측 비즈니스 규칙을 근거 없이 추론하는 것
- 프론트엔드에서 확인할 수 없는 권한·정합성 정책을 사실로 확정하는 것

## Conventions

- 파일 이름은 소문자·하이픈 조합을 사용한다(예: `document-list.md`).
- 모든 wiki 페이지는 아래 YAML frontmatter로 시작한다.
- 페이지 간 연결에는 `[[wikilinks]]`를 사용하고, 새 페이지는 최소 2개의 outbound link를 갖는다.
- 페이지를 수정하면 `updated` 날짜를 반드시 갱신한다.
- 새 페이지는 `index.md`의 올바른 섹션에 알파벳 순으로 추가한다.
- 모든 작업은 `log.md`에 append-only 형식으로 기록한다.
- 여러 출처를 합성한 문단에는 가능한 경우 `^[raw/articles/source-file.md]` 형식의 provenance marker를 붙인다.
- API 동작은 문서, 실제 코드, 테스트, 또는 사용자가 제공한 명시적 근거가 있을 때만 사실로 기록한다. 불확실한 API 계약은 `confidence: low` 또는 `contested: true`로 표시한다.
- UI에서 관찰된 동작과 API 서버가 보장하는 동작을 구분해 서술한다.

## Frontmatter

```yaml
---
title: Page Title
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: entity | concept | comparison | query | summary
tags: [from taxonomy below]
sources: [raw/articles/source-name.md]
# Optional quality signals:
confidence: high | medium | low
contested: true
contradictions: [other-page-slug]
---
```

`confidence`와 `contested`는 API 계약, UX 결정, 빠르게 변하는 구현처럼 재검증이 필요한 내용에 권장한다.

### Raw source frontmatter

`raw/` 아래의 원본도 다음 frontmatter를 가진다. `sha256`은 frontmatter를 제외한 본문만 해시한다.

```yaml
---
source_url: https://example.com/source
ingested: YYYY-MM-DD
sha256: <hex digest of the raw content below the frontmatter>
---
```

`raw/`는 immutable source layer다. 원본을 정정하지 말고, 해석이나 정정 내용은 Layer 2 페이지에 기록한다.

## Tag Taxonomy

페이지의 모든 태그는 아래 목록에서만 선택한다. 새 태그가 필요하면 먼저 이 섹션을 갱신한다.

- **제품·도메인:** `document`, `workflow`, `metadata`, `search`
- **프론트엔드:** `frontend`, `ui`, `ux`, `component`, `design-system`, `state-management`
- **연동·플랫폼:** `api`, `integration`, `authentication`, `security`
- **품질·운영:** `accessibility`, `performance`, `testing`, `deployment`, `architecture`

## Page Thresholds

- 한 출처에서 중심적으로 다뤄지거나, 2개 이상의 출처에 반복해서 등장하는 엔티티·개념만 페이지로 만든다.
- 단순한 passing mention, 근거 없는 서버 동작 추정, 도메인 범위 밖의 내용은 별도 페이지를 만들지 않는다.
- 약 200줄을 넘는 페이지는 하위 주제로 분할하고 상호 링크한다.
- 완전히 대체된 페이지는 `_archive/`로 이동하고 색인과 inbound link를 정리한다.

## Entity Pages

컴포넌트, 외부 API, 주요 화면, 사용자 역할처럼 식별 가능한 대상을 다룬다. 다음을 포함한다.

- 개요와 책임 범위
- 관련 화면·컴포넌트·API
- 입력, 출력, 상태, 오류 및 의존성
- 확인된 사실과 미확인 가정의 구분
- `[[wikilinks]]`를 통한 최소 2개의 관련 페이지 연결

## Concept Pages

문서 목록 UX, API 오류 처리, 캐시 무효화, 접근성 같은 반복적으로 참조할 개념을 다룬다. 정의, 현재 결정, trade-off, 열린 질문, 관련 페이지를 포함한다.

## Comparison Pages

프론트엔드 구현 방식이나 UX 대안을 비교한다. 비교 목적, 평가 차원, 장단점, 현재 결론, 남은 검증 과제, 출처를 표로 정리한다.

## Query Pages

다시 확인하기 어렵거나 여러 페이지를 합성한 질의 결과만 저장한다. 단순한 파일 조회나 일회성 답변은 기록하지 않는다.

## Update Policy

새 출처가 기존 내용과 충돌하면 다음 순서를 따른다.

1. 출처의 날짜와 신뢰도를 확인한다. 최신 출처가 우선일 수 있지만 자동으로 기존 내용을 삭제하지 않는다.
2. UI에서 관찰된 사실, 코드에 구현된 사실, API 계약에 명시된 보장 사항을 별도 문장으로 분리한다.
3. 진짜 모순이면 양쪽 주장과 날짜·출처를 남긴다.
4. frontmatter에 `contested: true`와 필요한 `contradictions: [...]`를 기록한다.
5. 사용자 검토가 필요한 사항은 `log.md`에 남긴다.

## API Integration Recording Rules

- API 페이지에는 가능하면 HTTP method, endpoint, 주요 query/path parameter, 요청·응답 형태, 오류 형태, 인증 요구사항을 기록한다.
- 응답 필드의 의미를 추론할 때는 추론임을 표시하고 출처를 연결한다.
- 프론트엔드가 API를 호출하는 방식과 서버가 보장한다고 알려진 계약을 혼동하지 않는다.
- 계약 변경은 기존 UI 영향, 마이그레이션 또는 호환성 전략, 테스트 범위를 함께 기록한다.
