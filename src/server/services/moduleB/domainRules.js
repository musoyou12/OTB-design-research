/**
 * domainRules.js
 *
 * 도메인 가이드 — 산업별 해석 규칙 엔진
 * AI 판단이 아닌 설계 철학을 코드로 번역한 층
 *
 * 구조:
 *   boost    — 이 산업에서 권장되는 패턴 (가중치 +)
 *   penalize — 이 산업에서 피해야 할 패턴 (가중치 -)
 *   mandate  — 반드시 포함해야 할 요소
 *   tone     — 카피/브랜드 톤 방향
 */

const DOMAIN_RULES = {
  "fashion": {
    boost:    ["editorial layout", "image-led", "whitespace", "brand storytelling", "visual hierarchy"],
    penalize: ["heavy text", "cluttered grid", "aggressive CTA", "price-first framing"],
    mandate:  ["high-quality imagery", "brand identity consistency", "minimal navigation"],
    tone:     "Aspirational, minimal text, image leads the story. Avoid discount framing.",
  },
  "beauty": {
    boost:    ["trust signals", "ingredient transparency", "before/after", "clinical proof", "soft palette"],
    penalize: ["exaggerated claims", "heavy dark UI", "complex navigation"],
    mandate:  ["dermatologist/clinical badge", "ingredient section", "real user proof"],
    tone:     "Clean, clinical trust. Warm but precise. Avoid over-promising.",
  },
  "f&b": {
    boost:    ["sensory imagery", "origin story", "earthy tones", "location/visit CTA", "brand warmth"],
    penalize: ["corporate feel", "heavy data", "B2B tone"],
    mandate:  ["food/product photography", "brand story", "clear location or order CTA"],
    tone:     "Warm, human, sensory. Avoid corporate. Let the product speak.",
  },
  "saas": {
    boost:    ["metric-first hero", "product screenshot", "use-case toggle", "ROI proof", "demo CTA"],
    penalize: ["consumer feel", "vague benefits", "no pricing signal", "heavy animation without function"],
    mandate:  ["clear value prop", "demo/trial CTA", "social proof (logos, numbers)"],
    tone:     "Confident, direct. Lead with outcomes. Numbers anchor credibility.",
  },
  "fintech": {
    boost:    ["trust signals", "clear IA", "security badges", "simple onboarding"],
    penalize: ["experimental UI", "unclear flows", "heavy animation", "ambiguous copy"],
    mandate:  ["regulatory/security proof", "clear fee structure", "simple primary CTA"],
    tone:     "Trustworthy, clear, no exaggeration. Precision over creativity.",
  },
  "lifestyle": {
    boost:    ["community feel", "aspirational imagery", "values-led story", "social proof"],
    penalize: ["corporate tone", "price-first", "cluttered layout"],
    mandate:  ["brand values", "community/social element", "emotional connection"],
    tone:     "Values-led, warm, community-driven. Let the lifestyle speak.",
  },
  "real_estate": {
    boost:    ["clear IA", "search/filter UX", "map integration", "detailed info structure"],
    penalize: ["heavy branding over function", "poor mobile", "vague CTAs"],
    mandate:  ["property search", "location context", "contact/inquiry CTA"],
    tone:     "Information-first. Clarity and credibility over aesthetics.",
  },
};

const DEFAULT_RULES = {
  boost:    ["clear hierarchy", "strong CTA", "mobile-first"],
  penalize: ["cluttered layout", "unclear navigation"],
  mandate:  ["clear value proposition", "primary CTA"],
  tone:     "Clear, purposeful, user-centered.",
};

/**
 * 산업명으로 도메인 룰 반환
 * @param {string} industry
 * @returns {Object} { boost, penalize, mandate, tone }
 */
export function getDomainRules(industry) {
  if (!industry) return DEFAULT_RULES;
  const key = industry.toLowerCase().replace(/[\s\/\-]/g, "_");
  return (
    DOMAIN_RULES[key] ||
    DOMAIN_RULES[Object.keys(DOMAIN_RULES).find(k => key.includes(k))] ||
    DEFAULT_RULES
  );
}

/**
 * 도메인 룰 → 프롬프트 텍스트 변환
 */
export function formatDomainRules(industry) {
  const rules = getDomainRules(industry);
  return `## Domain Rules (${industry})
Boost:    ${rules.boost.join(", ")}
Penalize: ${rules.penalize.join(", ")}
Mandate:  ${rules.mandate.join(", ")}
Tone:     ${rules.tone}`;
}
