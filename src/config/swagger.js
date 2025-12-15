import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "OTB Design ResearchOps API",
      version: "1.0.0",
      description: "ResearchOps 자동화 API 스펙",
    },
  },
  apis: ["./src/server/index.js"], // 절대경로 또는 상대경로 정확히 지정 필요
});

// swagger-ui-express의 serve, setup 그대로 export
export const swaggerUiHandler = {
  serve: swaggerUi.serve,
  setup: swaggerUi.setup,
};
