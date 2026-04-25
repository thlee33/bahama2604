# 🌊 Bahamas Digital Twin: Climate Change & NbS Scenarios

본 프로젝트는 바하마(Bahamas), 특히 나소(Nassau) 지역을 대상으로 **기후 변화에 따른 해수면 상승** 및 **자연기반해법(NbS, Nature-based Solutions)인 맹그로브 식재 방재 효과**를 직관적으로 시각화하는 웹 기반 3D 디지털 트윈입니다.

## 🚀 실시간 데모 및 배포
Github Pages, Vercel 등의 호스팅 서비스에 정적 사이트로 손쉽게 배포할 수 있습니다.
1. `npm install` 로 의존성 설치.
2. `npm run build` 로 빌드 진행 (결과물은 `web` 디렉토리에 생성됨).
3. `web` 디렉토리 전체를 퍼블릭 호스팅에 올려 바로 서비스할 수 있습니다. (Vercel의 경우 Root Directory를 `web`으로 설정하거나 빌드 명령을 설정하여 자동 연동 가능)

## 🌎 주요 기능 (Features)

### 1. 3D 지형 위 해수면 상승 및 침수 가시화
- **Google Photorealistic 3D Tiles** 위경도 데이터를 활용한 정교한 모델링.
- 슬라이더 조절을 통한 **해수면 시나리오 변경** 및 지형의 상하 **수직 과장(Vertical Exaggeration)** 연동 기능.
- 해안가 인프라가 한눈에 들어오는 **최적의 카메라 뷰(정북 방향)** 및 시작 시 바하마 전역 오버뷰 제공.

### 2. GPU 물리 기반 `천해파(Shallow Water Wave)` 시뮬레이션
- **단순 윈드(Wind) 역학 렌더가 아닌 실제 해류/파랑 물리 베이킹**:
  - `v = sqrt(g * h)` 공식과 10m급 ESA 고해상도 수치표고모델(DEM)에 기반한 유체 저항 계산.
  - 마찰계수에 더해 맹그로브 장애물 관통 후 발생하는 **파동 에너지 소멸(Shadow/Wake Effect)** 구현.
- **WebGL Ping-Pong 렌더링**:
  - 브라우저 상에서 백엔드 없이 Float16 `.bin` 텍스처를 60FPS로 연산하며 최대 1만 6천 개의 입자 흐름을 실시간 제어.

### 3. 고도 데이터(DEM) 통합 제어 패널
- **독립적 DEM Drape**: 배경지도와 별개로 DEM 고도 레이어를 ON/OFF 할 수 있는 독립 스위치 구현.
- **실시간 투명도 조절**: 지형 위에 덧씌워진 DEM 데이터의 투명도를 슬라이더로 즉각 조정하여 실세계를 투영 분석.
- **단계구분도 레전드 상시 노출**: 고도값(-1m ~ 32m+)에 따른 색상 범례를 UI에 고정하여 데이터 판독성 강화.

## 📁 배포 최적화 (Public Deployment)
- **CDN 기반 CesiumJS**: 프로젝트 용량을 획기적으로 줄이고 로딩 속도를 높이기 위해 로컬 패키지 대신 CDN 리소스를 사용하도록 런타임 환경 개선.
- **GitHub Pages 최적화**: 상대 경로 빌드 설정을 통해 하위 디렉토리 호스팅 환경에서도 완벽 작동 지원.
- **불필요 데이터 정리**: 프로토타입용 PNG 시퀀스 데이터를 제거하여 배포 패키지 경량화.

## 📁 디렉토리 구조 및 핵심 스크립트
- `CesiumWind.js`: GPU를 활용한 WebGL 2.0 파티클 연산 코어 시스템.
- `generate_uv_bin.py` / `generate_dem_overlay.py`: Python 기반 백엔드 물리 엔진 처리기. (원도 및 해저 DEM을 분석하여 입자를 렌더링할 벡터 좌표 생성).
- `doc/`: 아키텍처 및 효과가 정리된 기술블로그 및 C-Level 보고용 PPTX 포함.

## ⚒️ 개발 환경 (Tech Stack)
- **Frontend Engine**: Vite + JavaScript (ES6)
- **3D Geospatial Engine**: CesiumJS (WebGL 2.0)
- **Data Pipeline**: Python (Rasterio, SciPy, Pillow)

## 📄 라이선스 (License)
해당 프로젝트 내 코드 및 구조의 저작권은 작성자에게 있으며, 내부 검토 및 사전 허가 없이 상업적 용도로 배포할 수 없습니다. 데이터(Copernicus DEM, Google Tiles 등)의 경우 각 제공처의 원 라이선스에 귀속됩니다.
