# DG Management Portal — 개발 규칙

> 이 문서는 프로젝트의 개발 원칙과 워크플로우를 정의합니다.
> 모든 개발 작업 시 반드시 참조하며, 규칙은 필요에 따라 추가/수정/삭제할 수 있습니다.

---

## 1. Git 브랜치 전략

### 브랜치 네이밍
```
feat/<기능명>       — 신규 기능 개발
fix/<버그명>        — 버그 수정
refactor/<대상>     — 리팩토링
docs/<문서명>       — 문서 작업
chore/<작업명>      — 설정, 의존성 등 기타
```

### 워크플로우
```
1. main에서 feature 브랜치 생성
   git checkout -b feat/<기능명> main

2. 기능 개발 및 커밋
   - 작은 단위로 자주 커밋
   - 커밋 메시지는 conventional commits 형식

3. 검증 (빌드 & 테스트)
   - npm run build 통과 확인
   - 주요 기능 동작 확인

4. PR 생성
   - gh pr create --base main
   - PR 제목은 간결하게 (70자 이내)
   - 변경 요약 + 테스트 계획 포함

5. main에 merge
   - PR merge 후 로컬 main 업데이트

6. push
   - git push origin main
```

### 금지 사항
- main 브랜치에 직접 커밋하지 않는다
- force push 하지 않는다
- 검증 없이 PR을 생성하지 않는다

---

## 2. 커밋 컨벤션

### 형식
```
<type>: <설명>

[본문 (선택)]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

### 타입
| 타입 | 용도 |
|------|------|
| `feat` | 새로운 기능 추가 |
| `fix` | 버그 수정 |
| `refactor` | 코드 리팩토링 (기능 변화 없음) |
| `docs` | 문서 추가/수정 |
| `chore` | 빌드, 설정, 의존성 등 |
| `style` | 코드 포맷팅 (동작 변화 없음) |
| `test` | 테스트 추가/수정 |

---

## 3. 검증 체크리스트

PR 생성 전 반드시 확인:

- [ ] `npm run build` 성공
- [ ] 신규/수정 페이지 렌더링 확인
- [ ] API 엔드포인트 정상 응답 확인
- [ ] 기존 기능 회귀(regression) 없음
- [ ] TypeScript 타입 오류 없음

---

## 4. PR 규칙

- base 브랜치: `main`
- PR 본문에 `## Summary`와 `## Test plan` 포함
- 관련 모듈의 DEV_STATUS.md 업데이트 포함

---

## 5. 코드 작성 원칙

- 과도한 엔지니어링 금지 — 요청된 것만 구현
- 기존 패턴/컨벤션을 따른다
- 보안 취약점 주의 (XSS, SQL Injection 등)
- 한국어 UI 텍스트 일관성 유지

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|-----------|
| 2026-02-24 | 초기 규칙 수립 (브랜치 전략, 커밋 컨벤션, 검증, PR, 코드 원칙) |
