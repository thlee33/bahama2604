# 바하마(뉴프로비던스 섬) 디지털 트윈 구축 및 시나리오 시연 PoC 구현 계획

본 계획서는 바하마의 뉴프로비던스(New Providence) 섬을 대상으로, 기후변화에 따른 해수면 상승과 제한적 천수 방정식/Cellular Automata를 활용한 맹그로브의 홍수 저감 효과를 동적으로 연출하기 위한 디지털 트윈을 구축합니다.

---

## 1. 구현 전략 (Implementation Strategy)

*   **기술 스택**: HTML, Vanilla CSS, JS (Vite), CesiumJS, Python (데이터 전처리 및 시뮬레이션용)
*   **아키텍처**:
    *   **Data Pipeline (Python)**: 나소 인근 해안 범위의 DEM 기반 격자를 생성하고, 맹그로브 유/무에 따른 지면 마찰력(Friction) 차이를 적용한 2D 홍수 시뮬레이션(Cellular Automata 또는 간략화된 유체 역학 식)을 구동합니다. 시간 흐름에 따른 수위 스냅샷을 연속된 이미지(또는 배열)로 산출합니다.
    *   **Cesium Base**: Google Photorealistic 3D Tiles, Bing Maps 등 고해상도 영상을 복합 적용하여 현실감 극대화.
    *   **Visualization Layer**: 파이썬으로 도출된 시계열 침수 스냅샷을 CesiumJS의 Clock/Timeline과 연동하여 동적 애니메이션으로 렌더링.
*   **프리미엄 UI/UX**: 유리 질감(Glassmorphism), 부드러운 애니메이션을 적용한 최상위 수준의 인터페이스 구축.

---

## 2. 지형 및 건물 모델링 구성 

*   **지형 및 해저**: `Cesium World Terrain` 및 `Cesium World Bathymetry(CWB)` 동시 적용.
*   **건물 모델**: CWB 지형과의 완벽한 호환성을 위해 일반 OSM이 아닌 **`Cesium OSM Buildings for CWB`** 플러그인을 활용하여 건물 기초의 붕뜸 현상을 방지합니다.
*   **영상 및 백그라운드 (Imagery & 3D Tiles)**:
    *   Google Photorealistic 3D Tiles (주요 도심지 현실감 묘사)
    *   Google Maps 2D Satellite (위성 영상 기본 베이스)
    *   Bing Maps Aerial 레이어 (우회 수단 또는 고해상도 타겟 교체용)
    *   위 다양한 레이어를 UI에서 쉽게 전환/중첩할 수 있도록 BaseLayerPicker 연동 및 커스텀.

---

## 3. 시나리오별 디지털 트윈 구현 (Scenario Implementation)

### 3.1 [시나리오 A] 맹그로브(NbS) 폭풍 서지 홍수 저감 시뮬레이션 (동적 애니메이션)
*   **파이썬 시뮬레이터 (Backend Offline)**: 
    *   간략화된 범위를 지정하여 가상의 파도 에너지가 해안가로 밀려오는 시뮬레이션 코드를 작성(`simulation.py`).
    *   해안선 구역에 마찰 계수(Manning's n 등)를 크게 적용하여 '맹그로브 조림지'를 가정.
    *   결과물: t=0 부터 t=N 까지의 각 스텝별 침수 깊이(Water Depth)를 투명도가 적용된 스냅샷 이미지(PNG) 또는 직렬화된 데이터로 추출.
*   **Cesium 프론트엔드 연동**:
    *   추출된 시계열 스냅샷을 CesiumJS `CallbackProperty`나 `SampledProperty`를 활용한 Entity/Imagery Layer로 로드하여 시간 흐름에 따라 재생.
    *   맹그로브 유/무 탭을 통해 두 애니메이션 시뮬레이션 결과를 직관적으로 비교.

### 3.2 [시나리오 B] 기후변화 최악 시나리오(SSP5-8.5) 연도별 해수면 상승
*   **UI 슬라이더**: 특정 연도(또는 수위 상승 치)를 조절하는 슬라이더. 
*   **글로벌 수면 조절**: 나소 섬 주위를 덮는 전역적인 물(Water Volume) 폴리곤을 배치하고, 슬라이더 변경 시 높이(Altitude) 설정값을 동적으로 조절하여 저지대 침수를 시각화. 자연스러운 렌더링을 위해 Water Material Custom Shader 적용 고려.

---

## 4. 진행 단계 (Phase)

1.  **Phase 1**: Vite 기반 개발 환경 구성, CesiumJS 의존성 설치, 기본 UI 마크업 뼈대 작성.
2.  **Phase 2**: 나소 중심부 대상 Cesium 지형 세팅 (CWB, OSM Buildings for CWB, Google/Bing Imagery 연동). 최고급 UI 디자인 적용.
3.  **Phase 3**: 시나리오 A용 파이썬 유체 시뮬레이션 스크립트 작성 및 시계열 스냅샷 이미지 자산 생성.
4.  **Phase 4**: 시나리오 A 애니메이션 렌더링 및 시나리오 B 해수면 슬라이더 기능 개발, 최종 폴리싱.
