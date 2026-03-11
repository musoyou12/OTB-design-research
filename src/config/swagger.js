import swaggerUi from "swagger-ui-express";

const spec = {
  openapi: "3.0.0",
  info: {
    title: "OTB Design Research API",
    version: "2.0.0",
    description: `## OTB Design Research Automation

브리프(Brief) 입력 → RAG 기반 레퍼런스 검색 → 전략 A/B/C → 프롬프트 팩 생성

### 시스템 구조
- **Module A (Python)**: 매일 RSS/블로그 크롤링 → 임베딩 → 16축 스코어링 → Supabase 저장
- **Module B (Node.js)**: 브리프 입력 → pgvector 검색 → 재랭킹 → 전략/프롬프트 생성

### 주요 엔드포인트
| 엔드포인트 | 설명 |
|---|---|
| \`POST /generate\` | 리서치 패킷 생성 (메인) |
| \`GET /health\` | 서버 상태 |
| \`GET /test-db\` | Supabase 연결 확인 |`,
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "로컬 개발 서버",
    },
  ],

  // ── 공통 스키마 정의 ───────────────────────────────────
  components: {
    schemas: {
      // 입력
      GenerateRequest: {
        type: "object",
        required: ["brief"],
        properties: {
          brief: {
            type: "string",
            description: "디자인 브리프 원문",
            example:
              "패션 커머스 모바일 앱 UX 고도화. 20대 여성 타겟. 직관적인 탐색과 빠른 구매 전환 중심.",
          },
        },
      },

      // 브리프 파싱 결과
      ParsedBrief: {
        type: "object",
        properties: {
          industry: { type: "string", example: "fashion" },
          intent: { type: "string", example: "모바일 커머스 UX 전환율 개선" },
          keywords: {
            type: "array",
            items: { type: "string" },
            example: ["mobile UX", "conversion", "minimalist"],
          },
          constraints: {
            type: "array",
            items: { type: "string" },
            example: ["20대 여성 타겟", "모바일 우선"],
          },
        },
      },

      // 추천 레퍼런스 1개
      Reference: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          title: { type: "string", example: "Musinsa 2025 리뉴얼 케이스" },
          source_url: {
            type: "string",
            format: "uri",
            example: "https://uxdesign.cc/...",
          },
          industry: { type: "string", example: "fashion" },
          relevance_score: {
            type: "number",
            format: "float",
            example: 0.8742,
          },
          relevance_explanation: {
            type: "string",
            example: "모바일 커머스 UX 패턴과 높은 유사성",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            example: ["mobile", "e-commerce", "minimalist"],
          },
        },
      },

      // 전략 1개 (A / B / C)
      Strategy: {
        type: "object",
        properties: {
          title: { type: "string", example: "검증된 전환 중심 설계" },
          design_direction: {
            type: "string",
            example: "카드 기반 PLP, 하단 고정 CTA, 간결한 타이포그래피",
          },
          ux_reasoning: {
            type: "string",
            example: "패션 커머스에서 빠른 탐색과 구매 전환에 효과적인 패턴",
          },
          explanation: {
            type: "string",
            example: "상위 레퍼런스 3개에서 공통으로 나타난 레이아웃 패턴을 기반으로 함",
          },
        },
      },

      // 프롬프트 팩 1개
      PromptPack: {
        type: "object",
        properties: {
          visual_prompt: {
            type: "string",
            example: "Clean minimal fashion e-commerce UI, soft neutral palette",
          },
          layout_prompt: {
            type: "string",
            example: "Card grid PLP, sticky bottom CTA, generous whitespace",
          },
          tone_prompt: {
            type: "string",
            example: "Confident, modern, approachable. Short sentences, action-driven copy.",
          },
          keyword_pack: {
            type: "array",
            items: { type: "string" },
            example: ["minimal", "conversion", "trust", "mobile-first"],
          },
        },
      },

      // 최종 패킷 전체
      ResearchPacket: {
        type: "object",
        properties: {
          brief_id: { type: "string", format: "uuid" },
          generated_at: { type: "string", format: "date-time" },
          brief: {
            type: "object",
            properties: {
              raw: { type: "string" },
              industry: { type: "string" },
              intent: { type: "string" },
              keywords: { type: "array", items: { type: "string" } },
              constraints: { type: "array", items: { type: "string" } },
            },
          },
          recommended_references: {
            type: "array",
            items: { $ref: "#/components/schemas/Reference" },
          },
          ux_evidence: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                content: { type: "string" },
                source_url: { type: "string" },
              },
            },
          },
          strategies: {
            type: "object",
            properties: {
              A: { $ref: "#/components/schemas/Strategy" },
              B: { $ref: "#/components/schemas/Strategy" },
              C: { $ref: "#/components/schemas/Strategy" },
            },
          },
          prompt_pack: {
            type: "object",
            properties: {
              A: { $ref: "#/components/schemas/PromptPack" },
              B: { $ref: "#/components/schemas/PromptPack" },
              C: { $ref: "#/components/schemas/PromptPack" },
            },
          },
        },
      },

      // 에러
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string", example: "brief는 필수 문자열입니다." },
        },
      },
    },
  },

  // ── 엔드포인트 정의 ────────────────────────────────────
  paths: {
    "/generate": {
      post: {
        tags: ["Module B — Packet Generator"],
        summary: "디자인 리서치 패킷 생성",
        description: `브리프 원문을 입력하면 10단계 RAG 파이프라인을 실행하여 리서치 패킷을 반환합니다.

**파이프라인 순서**
1. 브리프 파싱 → \`{ industry, intent, keywords, constraints }\`
2. 브리프 임베딩 (OpenAI \`text-embedding-3-small\`)
3. pgvector 벡터 검색 → 후보 50개
4. 산업 필터 적용 (\`industry_patterns\` 테이블)
5. 16축 재랭킹 → TOP 10 선별
6. UX 근거 문서 검색
7. 전략 A/B/C 생성 (GPT-4o)
8. 프롬프트 팩 생성 (GPT-4o-mini, 병렬)
9. Supabase 저장
10. 최종 패킷 조립 및 반환`,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GenerateRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "패킷 생성 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    packet: { $ref: "#/components/schemas/ResearchPacket" },
                  },
                },
              },
            },
          },
          400: {
            description: "브리프 누락 또는 잘못된 입력",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          500: {
            description: "서버 내부 오류",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/health": {
      get: {
        tags: ["System"],
        summary: "서버 상태 확인",
        responses: {
          200: {
            description: "정상",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },

    "/test-db": {
      get: {
        tags: ["System"],
        summary: "Supabase 연결 확인",
        description: "`briefs` 테이블에서 최근 3개 레코드를 조회합니다.",
        responses: {
          200: {
            description: "연결 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "connected" },
                    sample: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
          500: {
            description: "연결 실패",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
};

export const swaggerSpec = spec;

export const swaggerUiHandler = {
  serve: swaggerUi.serve,
  setup: swaggerUi.setup,
};
