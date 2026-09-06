# my_reading_space_ver1

**도트 서재** — 도트 아바타로 걸어다니는 독서모임 마을.

내 방에 책을 꽂고, 남의 책장을 구경하고, 책을 빌려오고,
마음에 남은 문장은 참새에 실어 보냅니다.

---

## 무엇인가

마이스페이스와 싸이월드 미니홈피가 가졌던 건 타임라인이 아니라 **공간**이었습니다.
그 감각으로 책을 다루는 서비스입니다.

- **방** — 내가 꾸미는 개인 공간. 책장, 포스터, 화분, 벽 색까지
- **마을** — 독서모임 하나가 마을 하나. 도서관 · 헌책방 · 박물관 · 우체국 · 가구점 · 꽃집 · 재즈바
- **전국 · 세계** — 버스 · 기차 · 비행기로 다른 마을에

## 이 서비스의 규칙

| | |
|---|---|
| **방문은 흔적을 남기지 않는다** | 조용히 구경하고 나갈 수 있다. 남길지는 온 사람이 정한다 |
| **흔적은 행위로만** | 책을 빌려가면 대출카드에, 쪽지를 끼우면 책 사이에 |
| **밖에서는 친구만 보인다** | 낯선 사람은 재즈바에서만 만난다 (정원 100명) |
| **숫자가 아니라 문장** | 공개 별점은 없다. 밑줄과 한 줄만 |

## 실행

```bash
node prototype/server.js
# → http://localhost:5173
```

`prototype/room.html` 을 그냥 열어도 돌아갑니다.
다만 전시·도서·신문은 예비 자료로 나오고, 서버를 켜야 실제 데이터가 들어옵니다.

## 실제 데이터

서버가 공공 API를 대신 불러 줍니다. 브라우저가 직접 못 부르는 이유는 세 가지입니다 —
`file://` 차단, CORS 헤더 없음, API 키 노출. 프록시가 그 셋을 한 번에 풉니다.

| | API | 키 |
|---|---|---|
| 전시 | 한국문화정보원 전시정보(통합) `API_CCA_145` | 필요 |
| 도서 | 한국문화정보원 기관별 도서정보 `API_LIB_051` | 필요 |
| 신문 | 연합 · 경향 · 동아 · 매경 문화면 RSS | 불필요 |

키는 [culture.go.kr/data](https://www.culture.go.kr/data) 에서 위 두 API를 활용신청하면 하나로 둘 다 됩니다.

```bash
# PowerShell
$env:KCISA_KEY = "발급받은 인증키"
node prototype/server.js
```

## 계정 · 친구 · 방 저장 (Supabase)

계정·친구·방 정보는 [Supabase](https://supabase.com) 무료 Postgres에 저장합니다.
Render 무료 플랜은 디스크가 임시라서(서버가 잠들었다 깨면 초기화) 파일로 저장하면 안 됩니다.

1. [supabase.com](https://supabase.com) 에서 무료 프로젝트를 하나 만듭니다.
2. 프로젝트의 **SQL Editor** 에서 아래를 실행해 테이블을 만듭니다.

   ```sql
   create table su_users (
     code text primary key,
     id text unique,
     salt text,
     pw text,
     token text,
     who text,
     created_at bigint
   );
   create table su_rooms (
     code text primary key references su_users(code) on delete cascade,
     room jsonb,
     updated_at bigint
   );
   create table su_friends (
     code text references su_users(code) on delete cascade,
     friend text references su_users(code) on delete cascade,
     primary key (code, friend)
   );
   create table su_libbind (
     key text primary key,
     lib_name text,
     at bigint
   );
   alter table su_users enable row level security;
   alter table su_rooms enable row level security;
   alter table su_friends enable row level security;
   alter table su_libbind enable row level security;
   -- 정책을 하나도 안 만들어도 됩니다 — 서버는 RLS를 건너뛰는 service_role 키로 접속합니다.
   ```

3. **Project Settings → API** 에서 `Project URL` 과 `service_role` 키(⚠️ `anon` 키가 아닙니다)를 복사합니다.
4. Render 대시보드 환경변수에 `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` 로 넣습니다.

로컬에서 켤 때도 같은 두 값을 환경변수로 넣어줘야 로그인·친구 기능이 동작합니다.

```powershell
$env:SUPABASE_URL = "https://xxxxx.supabase.co"
$env:SUPABASE_SERVICE_KEY = "발급받은 service_role 키"
node prototype/server.js
```

## 이미지 생성 (배경 그림)

방·상점 배경 그림을 AI로 생성할 때 쓰는 키입니다. 게임 실행에는 필요 없고,
배경 작업할 때만 로컬에서 사용합니다. [aistudio.google.com/api-keys](https://aistudio.google.com/api-keys)
에서 무료로 발급받을 수 있습니다.

`.env` 파일(깃에 올라가지 않음)에 넣어 씁니다.

```
GEMINI_API_KEY=발급받은 키
```

## 배포

`render.yaml` 이 들어 있어 [Render](https://render.com) 에서 Blueprint로 바로 뜹니다.
`KCISA_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` 를 대시보드에서 넣어주세요.

## 구조

```
prototype/
  room.html            화면과 스타일
  server.js            정적 서빙 + API 프록시
  sw.js                서비스 워커 (앱처럼 설치)
  manifest.webmanifest
  icons/               코드로 그린 앱 아이콘
  tools/make-icons.js
  js/
    audio.js    피아노 5곡 + 효과음 (오디오 파일 없이 합성)
    art.js      스프라이트 · 도트 변환 · 랜드마크 · 전국 지도
    season.js   계절 · 명절 · 떨어지는 잎
    weather.js  날씨 · 햇살 · 비 · 천둥번개
    expo.js     전시
    news.js     신문
    data.js     장서 · 마을 · 사람
    game.js     본체
```
