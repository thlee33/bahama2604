# 바하마(Nassau) 디지털 트윈 구축 Task List

- [ ] **Phase 1: 초기 프로젝트 세팅**
  - [ ] Vite를 이용한 Vanilla JS 프로젝트 생성 (`npx create-vite-app` 등)
  - [ ] Cesium 웹팩/Vite 연동 설정 (정적 에셋 복사 등)
  - [ ] 프리미엄 UI 및 레이아웃 구조 (HTML/CSS) 작업 (유리 질감, 슬라이더, 제어 패널)
- [ ] **Phase 2: Base 데이터 렌더링**
  - [ ] Cesium Viewer 초기화 (바하마 나소 좌표 타겟팅)
  - [ ] Cesium OSM Buildings for CWB 로드
  - [ ] Cesium World Terrain 및 Cesium World Bathymetry 연동 설정
  - [ ] Base Imagery 레이어 추가 (Google Photorealistic 3D, Google 위성, Bing Maps 등) 및 전환 UI 연결
- [ ] **Phase 3: 파이썬 시뮬레이션 및 데이터 준비 (시나리오 A용)**
  - [ ] 나소 지역 일부 가상 DEM 생성 (또는 임의 구배 데이터 매핑) 코드 작성 
  - [ ] 2D 단순 유체 전파(Cellular Automata) 시뮬레이션 파이썬 기반 작성
  - [ ] 맹그로브 유/무 시나리오별 결과 스냅샷(연속 이미지) 생성
- [ ] **Phase 4: 시나리오 동적 연출 및 폴리싱**
  - [ ] 시나리오 A: 시계열 이미지 애니메이션 오버레이 렌더링
  - [ ] 시나리오 B: 해수면 상승 슬라이더를 통한 Water Polygon Extrusion 동적 조절
  - [ ] 디자인 폴리싱 및 테스트
