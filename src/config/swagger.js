import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "OTB Design ResearchOps API",
      version: "1.0.0",
      description: "ResearchOps 자동화 API 스펙",
    },
  },
  apis: ["./src/server/index.js"], // Swagger 주석 위치
});

export const swaggerUiHandler = swaggerUi;
