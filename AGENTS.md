# AGENTS.md

## 목적
- `example` 데이터셋(YOLO26)을 기준으로 프론트엔드 라벨링 사이트를 구축한다.
- 백엔드 연동은 현재 범위에서 제외한다.

## 사용자 지시사항 기록
1. 백엔드(API) 없이 브라우저에서 이미지 업로드/로드가 가능해야 한다.
2. 초기에는 `train/valid/test`를 분리해서 로드하지 않고, 이미지를 한 번에 전체 로드한다.
3. 라벨링 완료 후에 `train/valid/test`로 나누는 흐름을 목표로 한다.
4. 업로드 관련 데이터(가상돔 상태 제외)는 `front-end/src/class/Upload.tsx`의 클래스 인스턴스 변수/메소드로 관리한다.
5. 인수인계 용도로 클래스/메소드에 JSDoc 주석을 남긴다.

## 현재 반영 상태
- 라우트 `/`에서 데이터셋 로더 페이지 진입:
  - `front-end/src/index.tsx`
- 이미지 로더 화면 구현:
  - `front-end/src/component/DatasetLoaderPage.tsx`
  - `front-end/src/component/DatasetLoaderPage.scss`
- 업로드 상태/로직 클래스 분리:
  - `front-end/src/class/Upload.tsx`
  - `iv_images`, `iv_selectedId`, `iv_statusMessage` 등 인스턴스 변수로 관리
  - `im_importFromDirectoryInput`, `im_importFromFileInput`, `im_selectImage`, `im_clearLoadedImages`, `im_dispose` 등 메소드로 처리
- `Upload.tsx` 주요 메소드에 인수인계용 JSDoc 작성 완료

## 작업 규칙(현 시점)
- 프론트엔드 우선 개발
- 백엔드 의존 최소화(또는 없음)
- 업로드/파일 처리 로직은 컴포넌트가 아닌 `Upload` 클래스에 유지
- 컴포넌트는 렌더링 및 이벤트 연결 중심으로 유지

## 다음 권장 작업
1. Bounding Box 그리기/이동/리사이즈 UI 추가
2. 이미지별 좌표 데이터 구조 정의(px, YOLO normalized 동시 지원)
3. 라벨 결과를 기준으로 `train/valid/test` 분할 및 export(예: zip/txt) 구현
