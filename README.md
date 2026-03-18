# OTB Design Research

디자인 브리프를 입력하면 트렌드 분석 · 경쟁사 크롤링 · 레퍼런스 수집을 자동화하고, 전략 A/B/C와 프롬프트 팩을 생성하는 디자인 리서치 자동화 시스템.

---

## 시스템 구조

```
┌─────────────────────────────────────────────────────┐
│  Module A  —  Python 배치 파이프라인 (데이터 수집)      │
│                                                     │
│  runDaily.py        RSS 기사 · Google Trends ·      │
│                     Visual Trends 수집 →            │
│                     ux_evidence_documents (RAG)     │
│                                                     │
│  brandPipeline.py   실제 브랜드 사이트 크롤 →          │
│                     design_references + axis_scores │
└───────────────────────────┬─────────────────────────┘
                            │ Supabase (pgvector)
┌───────────────────────────▼─────────────────────────┐
│  Module B  —  Node.js 실시간 파이프라인 (브리프 처리)   │
│                                                     │
│  1. 브리프 파싱 (GPT-4o)                              │
│  2. 브리프 임베딩                                     │
│  3. 벡터 검색 (pgvector cosine)                      │
│  4. 업종 필터                                        │
│  5. 16축 재랭킹                                      │
│  6. UX Evidence RAG (citation 생성)                 │
│  7. 경쟁사 탐색 + Playwright 크롤                     │
│  8. 전략 A/B/C 생성 (GPT-4o)                        │
│  9. 프롬프트 팩 생성                                  │
│  10. Supabase 저장                                   │
│  11. Brand References 실시간 수집 (16개 소스)          │
└─────────────────────────────────────────────────────┘
```

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 백엔드 | Node.js · Express · SSE 스트리밍 |
| AI | OpenAI GPT-4o / GPT-4o-mini · text-embedding-3-small (1536d) |
| DB | Supabase (PostgreSQL + pgvector) |
| 크롤링 | Playwright (headless Chromium) |
| 배치 파이프라인 | Python 3.13 |
| 프론트엔드 | Vanilla JS · HTML/CSS |

---

## 데이터베이스

| 테이블 | 역할 | 채우는 파이프라인 |
|--------|------|-----------------|
| `design_references` | 실제 브랜드 사이트 원문 | `brandPipeline.py` |
| `reference_chunks` | 청크 단위 벡터 (1536d) | `brandPipeline.py` |
| `axis_scores` | 16축 점수 (0~1) | `brandPipeline.py` |
| `ux_evidence_documents` | UX 아티클 RAG 소스 | `runDaily.py` |
| `cluster_labels` | 레퍼런스 클러스터 semantic 라벨 | `runDaily.py` (clusterPipeline) |
| `trend_signals` | Google Trends 수치 | `runDaily.py` |
| `visual_trends` | Behance/Dribbble 비주얼 트렌드 | `runDaily.py` |
| `briefs` | 브리프 입력 히스토리 | Module B 실행 시 |
| `strategy_variants` | 생성된 전략 A/B/C | Module B 실행 시 |
| `prompt_outputs` | 프롬프트 팩 | Module B 실행 시 |

---

## 16축 평가 체계

레퍼런스의 디자인 품질을 16개 축으로 정량화 (0~1):

```
Brand (4)         brand_concept · tone_manner · color_mood · brand_distinctiveness
Visual Depth (3)  effect_2d · effect_3d · effect_spatial
Structure (3)     layout_structure · interaction_pattern · hierarchy_strength
Content (3)       channel_fit · image_category · conversion_focus
Quality (3)       ux_flow_clarity · mobile_readiness · reference_quality
```

업종별 가중치 부스트 적용 (beauty → tone_manner/color_mood, SaaS → ux_flow_clarity/conversion_focus 등)

---

## 전략 구조

| 전략 | 방향 | 설명 |
|------|------|------|
| **A · Essential** | Trend-aligned | 현재 트렌드 + 레퍼런스 consensus 기반 안전한 최적해 |
| **B · Distinctive** | Differentiated | 경쟁사 패턴 역전 + 브랜드 아이덴티티 주도 |
| **C · Experimental** | Experimental | 소수 상승 신호 기반 고위험/고보상 방향 |

각 전략에 `keyword_pack` (Pinterest/Behance 검색용 복합 키워드 6-8개) + UX Evidence citation 포함.

---

## 설치 및 실행

### 환경 변수 (.env)
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
OPENAI_API_KEY=
```

### Node.js 서버
```bash
npm install
npm start          # localhost:3000
```

### Python 파이프라인
```bash
cd python-pipeline
pip install -r requirements.txt

# 일일 UX Evidence 수집 (RSS + Google Trends + Visual Trends)
python runDaily.py

# 브랜드 사이트 크롤 (design_references 채우기)
python -m moduleA.brand.brandPipeline

# 자동 소스 탐색만
python runDiscovery.py
```

---

## Brand References 수집 소스 (실시간)

브리프 실행 시 16개 소스에서 실시간 스크래핑:

`Behance · Dribbble · Land-book · Godly · SiteInspire · Designspiration · One Page Love · Lapa Ninja · CSS Design Awards · Page Flows · Awwwards (카테고리) · Pinterest`

쿼리는 `keyword_pack` (프롬프트 생성기 출력) + `dominant_patterns` (레퍼런스 분석) + 16축 기반 검색어 조합.

---

## 디렉토리 구조

```
OTB-design-research/
├── src/
│   ├── server/
│   │   ├── controllers/
│   │   │   └── packetController.js   # Module B 오케스트레이션
│   │   └── services/moduleB/
│   │       ├── briefParser.js
│   │       ├── vectorRetriever.js
│   │       ├── axisReranker.js
│   │       ├── strategyGenerator.js
│   │       ├── promptGenerator.js
│   │       ├── competitorCrawler.js
│   │       ├── uiReferenceRetriever.js
│   │       ├── referenceSiteCapture.js
│   │       └── ...
│   └── supabase/schema/              # SQL 마이그레이션
├── python-pipeline/
│   └── moduleA/
│       ├── brand/                    # 브랜드 사이트 크롤
│       ├── collectors/               # RSS · Trends · Visual
│       ├── clustering/               # UMAP + HDBSCAN
│       ├── discovery/                # 자동 소스 탐색
│       ├── embedder/
│       └── writers/supabaseWriter.py
├── viewer/
│   ├── otb_entry.html                # 브리프 입력 폼
│   └── otb_demo.html                 # 결과 뷰어
└── README.md
```
