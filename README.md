# Electron Vue Element Plus

Electron 기반 Vue 3 + Element Plus + TypeScript 데스크톱 앱입니다.

## 개발 실행

nvm에 설치된 Node.js 22.17.0을 사용합니다 (Node.js 22.12 이상 필요).

```powershell
cd E:\dev\vue_work\electron-vue-element-plus
nvm use 22.17.0
npm install
npm run dev
```

## 명령어

- `npm run dev`: 개발 서버와 Electron 실행, Vue 변경 자동 반영
- `npm run typecheck`: 메인/preload 및 Vue 타입 검사
- `npm run lint`: ESLint 검사
- `npm run format`: Prettier 포맷
- `npm run build`: 타입 검사 및 프로덕션 빌드
- `npm start`: 빌드된 앱 실행 (build 후 사용)
- `npm run build:unpack`: 설치하지 않고 실행할 앱 패키징
- `npm run build:win`: Windows 설치 파일 생성 (dist 폴더)

## 구조

- `src/main/index.ts`: Electron 창과 IPC 핸들러
- `src/preload/index.ts`: contextBridge를 통해 공개하는 API
- `src/shared/api.ts`: 메인과 프런트가 공유하는 API 타입
- `src/renderer/src/App.vue`: Element Plus 시작 화면
- `src/renderer/src/main.ts`: Vue 및 Element Plus 한국어 설정
- `electron.vite.config.ts`: 개발/빌드 설정
- `electron-builder.yml`: 배포 패키징 설정

화면의 이름 입력/메시지 버튼과 앱 정보 새로고침으로 UI와 IPC를 확인할 수 있습니다.
렌더러는 Node.js에 직접 접근하지 않으며 sandbox와 contextIsolation을 사용합니다.
기능 추가 시 shared 타입, main 핸들러, preload API를 함께 확장하세요.

앱 ID, 제품명, 작성자, 배포 아이콘은 실제 제품에 맞게 수정하세요.
자동 업데이트와 서명 인증서는 설정되어 있지 않습니다.

## Codex Chat

**채팅 > Chat** 메뉴에서 Codex CLI와 대화할 수 있습니다. 화면은
`src/renderer/src/pages/chat/index.vue`, CLI 실행은 `src/main/codex-chat.ts`에 있습니다.

1. CLI가 없다면 터미널에서 `npm install -g @openai/codex`를 실행합니다.
2. `codex login`으로 로그인합니다. 앱은 기존 CLI 인증을 사용하며 API 키를 입력받지 않습니다.
3. CLI를 새로 설치했다면 앱을 재시작하고, Chat에서 **연결 확인**을 누릅니다.
4. 메시지를 입력하고 Enter 또는 전송 버튼을 누릅니다. Shift+Enter는 줄바꿈입니다.

**새 대화**, **응답 중지**, 오류 안내를 지원합니다. 메뉴 이동 중 대화는 유지되며,
앱을 다시 실행하면 화면의 대화 내역은 초기화됩니다. CLI 세션 자체는 Codex의 기본
저장 위치에 남습니다. 각 창의 세션 ID를 사용하여 후속 대화를 이어갑니다.

CLI는 앱의 현재 작업 디렉터리에서 `codex exec --json` 및 `exec resume`으로 실행합니다.
메시지는 표준 입력으로 전달합니다. 읽기 전용 샌드박스와 승인 요청 비활성화를 적용하며,
CLI의 기본 모델 설정을 사용합니다. 응답은 CLI의 메시지 완료 이벤트 단위로 표시합니다.
응답이 5분을 초과하거나 창을 닫으면 실행 중인 프로세스를 종료합니다.

`npm run test:chat`은 실제 모델 호출 없이 CLI 이벤트 파싱, 대화 이어가기, 새 대화,
중복 요청 차단, 중지, 시간 초과, 오류 처리를 검증합니다 (Node.js 22.17 이상).

공식 문서: [Codex non-interactive mode](https://developers.openai.com/codex/noninteractive).

## Codex SDK Chat

**채팅 > chat(codex sdk)**는 공식 `@openai/codex-sdk`의 `startThread()`와
`runStreamed()`를 사용합니다. SDK는 메인 프로세스가 관리하는 별도 Worker에서 실행하며,
기존 **Chat**과 독립적인 대화·입력·이벤트 채널을 유지합니다.

- 메시지 전송, 대화 이어가기, 새 대화, 응답 중지, 마크다운 표시를 지원합니다.
- 기존 Codex 로그인 인증을 사용합니다. `codex login` 후 화면에서 **연결 확인**을 누릅니다.
- SDK가 의존하는 로컬 CLI 런타임을 사용하며, 배포 시 네이티브 실행 파일을 ASAR 밖에 포함합니다.
- SDK의 CLI 프로세스는 Windows 숨김 모드로 실행합니다. 읽기 전용 샌드박스와 승인 정책 `never`를 사용합니다.
- 화면: `src/renderer/src/pages/chat-sdk/index.vue`, 공통 UI: `src/renderer/src/components/CodexChatView.vue`.
- 연결 관리: `src/main/codex-sdk-chat.ts`, SDK 실행: `src/main/codex-sdk-worker.ts`.
- `npm run build` 후 `npm run test:chat-sdk`로 실제 SDK와 모의 CLI 간 연동을 검증합니다.
  테스트에서는 모델이나 네트워크를 호출하지 않습니다.

공식 문서: [Codex SDK](https://developers.openai.com/codex/sdk).

## SQLite 데이터베이스

Electron 메인 프로세스의 내장 `node:sqlite`를 사용합니다. 추가 네이티브 패키지 설치나
Electron용 모듈 재빌드 없이 실행합니다. DB 코드는 `src/main/database/store.ts`, 화면은
`src/renderer/src/pages/database/example/index.vue`에 있습니다.

- 개발 실행 (`npm run dev`): `resources/database/store.sqlite`를 직접 열어 사용합니다.
- 배포된 앱: `app.getPath('userData')/database/store.sqlite`를 사용합니다.
- 배포용 원본: `resources/database/store.sqlite` (테스트 사용자 12건 포함)
- 설치 패키지에는 `extraResources`로 원본 DB를 포함합니다. 최초 실행 시 사용자 DB가 없으면
  원본을 복사하며, 기존 사용자 DB는 덮어쓰지 않습니다. 배포된 앱은 원본 파일을 수정하지 않습니다.
- 개발 중 DB를 수정하면 배포용 원본에도 반영됩니다.
- Windows 기본 위치: `%APPDATA%/electron-vue-element-plus/database/store.sqlite`
- 테스트 테이블: `test_users` (ID, 사용자 코드, 이름, 이메일, 부서, 상태, 생성일)
- 환율 테이블: `t_exchange_rate` (`exchange_type` TEXT, `rate_date` TEXT, `exchange_rate` REAL).
  환율구분은 `USD/KRW` (1 USD당 KRW), 날짜는 API의 최신 공시일을 저장합니다.
  환율1·환율2 진입 및 새로고침 시 비동기로 조회하고, 환율구분/날짜가 없을 때만 저장합니다.
  두 컬럼을 복합 기본키로 사용하여 중복 삽입을 방지합니다. 기존 DB는 버전 2로 자동 마이그레이션합니다.
- 최초 생성 시 더미 데이터 12건을 트랜잭션으로 저장합니다. 재실행 시 기존 데이터를 유지합니다.
- **데이터베이스 > 예제**에서 Element Plus Table로 조회·검색·페이지 이동이 가능합니다.
- 화면에는 실제 저장 경로가 표시됩니다. 배포된 앱의 사용자 DB는 설치 폴더 외부에 저장합니다.
- 렌더러에는 데이터 조회 API만 노출하며 임의 SQL 실행 기능은 제공하지 않습니다.
- `npm run test:store`로 파일 생성, 데이터 유지, 중복 시드 방지와 제약 조건을 검증합니다.

## Python Backend

`backend/`의 FastAPI 서버를 Electron 메인이 실행하고, preload API로 연결합니다.
**Backend > hello**에서 이름을 입력하고 **API 호출**을 누르면 Python 응답을 확인할 수 있습니다.
화면은 Element Plus 컴포넌트를 사용합니다.

```powershell
npm run backend:setup
npm run dev
```

`npm run dev`도 `predev`에서 `uv sync --directory backend --frozen`을 실행합니다.
개발 시 uv가 만든 `backend/.venv`의 Python을 숨김 모드로 직접 실행합니다.
서버가 준비될 때까지 기다린 뒤 요청하고, 앱을 종료하면 백엔드도 종료합니다.
포트는 OS가 할당하며 실행마다 인증 토큰을 생성합니다. 토큰은 메인 프로세스와 Python만 공유합니다.
서버는 `127.0.0.1`에서만 수신하며, 렌더러는 HTTP에 직접 접근하지 않습니다.

- `backend/app/main.py`: FastAPI 앱과 토큰 인증
- `backend/app/__main__.py`: 로컬 포트 확보, 서버 실행, 부모 종료 감지
- `backend/app/routers/hello.py`: `GET /api/hello?name=...`
- `backend/app/services/hello.py`: 인사 메시지 생성
- `backend/app/schemas/`: 응답 모델
- `src/main/python/process.ts`: 실행·상태 확인·종료
- `src/main/python/client.ts`: 인증된 API 호출과 응답 검증
- `src/renderer/src/pages/backend/hello/index.vue`: hello 화면

`GET /health`와 hello API 모두 인증이 필요합니다. API 문서는 로컬 서버에서 공개하지 않습니다.
SQLite는 기존 Electron 모듈에서 계속 관리합니다.

검증 명령:

```powershell
npm run test:backend
npm run test:backend-integration
npm run build:backend
```

`build:backend`는 PyInstaller 폴더형 번들을 `backend/dist/desktop-backend/`에 만듭니다.
`build:win`, `build:mac`, `build:linux`, `build:unpack`은 백엔드도 빌드하여 설치 파일의
`resources/backend/`에 포함합니다. 배포된 앱은 동봉된 실행 파일을 사용하므로 사용자 PC에
Python이나 uv가 필요하지 않습니다. 배포할 운영체제에서 각각 빌드해야 합니다.

참고: [uv와 FastAPI](https://docs.astral.sh/uv/guides/integration/fastapi/).

## 주식차트

**주식 > 주식차트**에서 미국 주식 ticker(예: `AAPL`, `MSFT`, `BRK-B`)를 입력하고
종목검색을 누르면 선택한 기간의 수정주가를 조회합니다. 기간은 3년(기본)·5년·10년 중
선택하고, 기본은 일봉이며 일·주·월 버튼으로 주기를 전환합니다.
검색 결과가 있는 상태에서 기간이나 주기를 바꾸면 다시 조회합니다.

- 화면: `src/renderer/src/pages/stocks/chart/index.vue`
- 캔들 차트: `src/renderer/src/components/StockCandlestickChart.vue` (TradingView Lightweight Charts)
- 데이터는 `open`, `high`, `low`, `close`, `volume`을 제공합니다. 상단 캔들과 하단 거래량
  막대 차트는 날짜축과 확대·이동을 공유하며, 선택한 날짜의 OHLC와 거래량을 함께 표시합니다.
- API: `GET /api/stocks/history?symbol=AAPL&interval=1d&years=3` (`1d`, `1wk`, `1mo` 지원, `years`는 3·5·10, 생략 시 3, 토큰 인증)
- Python: `backend/app/routers/stocks.py`, `backend/app/services/stocks.py` (yfinance)
- 조회 기간은 미국 동부 날짜 기준 선택한 연수이며, 일봉·주봉·월봉의 날짜는 제공처 기준입니다.
- 주식차트는 앱 정보 화면과 동일한 공통 여백을 사용하며 창과 사이드바 크기에 맞춰 조절됩니다.
- 데이터가 없거나 조회에 실패하면 화면에 오류를 표시합니다. 네트워크 연결이 필요합니다.

참고: [Lightweight Charts](https://tradingview.github.io/lightweight-charts/),
[yfinance](https://ranaroussi.github.io/yfinance/).

## 개발 도구

이 프로젝트는 OpenAI Codex의 도움을 받아 개발했습니다.

## 외부 참고 자료

- [electron-vite](https://electron-vite.org/guide/)
- [Element Plus](https://element-plus.org/en-US/guide/quickstart.html)
