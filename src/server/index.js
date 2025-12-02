import express from "express";
import "dotenv/config";  // OK

import { generateResearchV1, generateResearchV2 } from "./controllers/researchController.js";
import { crawlText } from "../crawlers/textCrawler.js";
import { crawlImage } from "../crawlers/imageCrawler.js";
import { cleanHtml } from "../crawlers/cleanText.js";
import { labelImage } from "./services/labelService.js";
import { buildImagePrompt } from "./services/promptBuilder.js";
import { requestComfyGeneration } from "./services/comfyService.js";

const app = express();
app.use(express.json());

app.post("/run-analysis", async (req, res) => {
  try {
    const { brief, targetUrl } = req.body;

    const v1 = await generateResearchV1(brief);
    const img = await crawlImage(targetUrl);

    const text = await crawlText(targetUrl);
    const cleaned = await cleanHtml(text.htmlPath);
    
    const v2 = await generateResearchV2(v1, cleaned);
    const labels = await labelImage(img.screenshotPath);

    const { prompt: imagePrompt, savePath: promptPath } =
      await buildImagePrompt(v2);
    const comfy = await requestComfyGeneration(imagePrompt);

    return res.json({
      v1,
      img,
      text,
      cleaned,
      v2,
      labels,
      imagePrompt,
      imagePromptPath: promptPath,
      comfy
    });

  } catch (err) {
    console.error("❌ Error in /run-analysis:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () =>
  console.log("🚀 Server running on http://localhost:3000")
);
