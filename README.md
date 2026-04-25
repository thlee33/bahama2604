# 🌊 Bahamas Digital Twin: Climate Change & NbS Scenarios

본 프로젝트는 바하마(Bahamas), 특히 나소(Nassau) 지역을 대상으로 **기후 변화에 따른 해수면 상승** 및 **자연기반해법(NbS, Nature-based Solutions)인 맹그로브 식재 방재 효과**를 직관적으로 시각화하는 PoC용 웹 기반 3D 디지털 트윈입니다.

## 🌎 주요 기능 (Features)

### 1. 3D 지형 위 해수면 상승 및 침수 가시화 
![해수면 상승 시뮬레이션]((./doc/NbS%20Flood%20Reduction.png)
- **Google Photorealistic 3D Tiles** 위경도 데이터를 활용한 정교한 모델링.
- 슬라이더 조절을 통한 **해수면 시나리오 변경** 및 지형의 상하 **수직 과장(Vertical Exaggeration)** 연동 기능.
- 해안가 인프라가 한눈에 들어오는 **최적의 카메라 뷰(정북 방향)** 및 시작 시 바하마 전역 오버뷰 제공.

### 2. GPU 물리 기반 `천해파(Shallow Water Wave)` 시뮬레이션 
![자연기반해법 시뮬레이션]((./doc/Sea%20Level%20Rise.png)
- ** 해류/파랑을 WebGL로 동적시각화 **:
  - `v = sqrt(g * h)` 공식 기반 파도 흐름 시각화.
  - 맹그로브 식재 영역에서 마찰계수로 인해 **파동 에너지 소멸(Shadow/Wake Effect)** 시각화.
- **WebGL Ping-Pong 렌더링**:
  - 브라우저 상에서 백엔드 없이 Float16 `.bin` 텍스처를 60FPS로 연산하며 최대 1만 6천 개의 입자 흐름을 실시간 제어.

### 3. 고도 데이터(DEM) 통합 제어 패널
- **독립적 DEM Drape**: 배경지도와 별개로 DEM 고도 레이어를 ON/OFF 할 수 있는 독립 스위치 구현.
- **실시간 투명도 조절**: 지형 위에 덧씌워진 DEM 데이터의 투명도를 슬라이더로 즉각 조정하여 실세계를 투영 분석.

## 📁 디렉토리 구조 및 핵심 스크립트
- `CesiumWind.js`: GPU를 활용한 WebGL 2.0 파티클 연산 코어 시스템.
- `generate_uv_bin.py` / `generate_dem_overlay.py`: Python 기반 백엔드 물리 엔진 처리기.

## ⚒️ 개발 환경 (Tech Stack)
- **Frontend Engine**: Vite + JavaScript (ES6)
- **3D Geospatial Engine**: CesiumJS (WebGL 2.0)
- **Data Pipeline**: Python (Rasterio, SciPy, Pillow)

## 🚀 실시간 데모 및 배포
Github Pages, Vercel 등의 호스팅 서비스에 정적 사이트로 손쉽게 배포할 수 있습니다.
1. `npm install` 로 의존성 설치.
2. `npm run build` 로 빌드 진행 (결과물은 `web` 디렉토리에 생성됨).
3. `web` 디렉토리 전체를 퍼블릭 호스팅에 올려 바로 서비스할 수 있습니다. (Vercel의 경우 Root Directory를 `web`으로 설정하거나 빌드 명령을 설정하여 자동 연동 가능)

## 📄 라이선스 (License)
해당 프로젝트 내 코드 및 구조의 저작권은 작성자에게 있으며, 내부 검토 및 사전 허가 없이 상업적 용도로 배포할 수 없습니다. 데이터(Copernicus DEM, Google Tiles 등)의 경우 각 제공처의 원 라이선스에 귀속됩니다.
