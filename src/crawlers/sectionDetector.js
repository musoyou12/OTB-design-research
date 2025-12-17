/**
 * @file sectionDetector.js
 * @description HTML 구조 분석으로 페이지 섹션(헤더/바디/푸터) 감지
 * 
 * @output 각 섹션의 bounds (x, y, width, height)
 */

/**
 * 페이지에서 헤더/바디/푸터 영역 감지
 * @param {import('playwright').Page} page - Playwright 페이지 객체
 * @returns {Promise<Object>} 섹션 정보 (bounds, confidence)
 */
export async function detectSections(page) {
  return await page.evaluate(() => {
    // ========================================
    // 1. 우선순위 셀렉터 정의
    // ========================================
    const headerSelectors = [
      'header',
      '[role="banner"]',
      'nav',
      '.header',
      '.navbar',
      '#header',
      '.site-header',
      '.main-header',
      '.top-bar'
    ];
    
    const footerSelectors = [
      'footer',
      '[role="contentinfo"]',
      '.footer',
      '#footer',
      '.site-footer',
      '.main-footer',
      '.bottom-bar'
    ];
    
    const mainSelectors = [
      'main',
      '[role="main"]',
      '.main-content',
      '#main',
      '#content',
      '.content',
      'article'
    ];
    
    // ========================================
    // 2. 요소 찾기 헬퍼 함수
    // ========================================
    const findFirst = (selectors) => {
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          
          // 보이지 않는 요소 건너뛰기
          if (style.display === 'none' || style.visibility === 'hidden') {
            continue;
          }
          
          return {
            found: true,
            selector: selector,
            bounds: {
              x: Math.round(rect.x),
              y: Math.round(rect.y + window.scrollY),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              top: Math.round(rect.top + window.scrollY),
              bottom: Math.round(rect.bottom + window.scrollY)
            },
            position: style.position
          };
        }
      }
      return { found: false };
    };
    
    // ========================================
    // 3. 각 섹션 감지
    // ========================================
    const header = findFirst(headerSelectors);
    const footer = findFirst(footerSelectors);
    const main = findFirst(mainSelectors);
    
    // ========================================
    // 4. 바디 영역 계산
    // ========================================
    const viewportHeight = document.documentElement.scrollHeight;
    const viewportWidth = window.innerWidth;
    
    const bodyBounds = {
      x: 0,
      y: header.found ? header.bounds.bottom : 0,
      width: viewportWidth,
      height: footer.found 
        ? footer.bounds.top - (header.found ? header.bounds.bottom : 0)
        : viewportHeight - (header.found ? header.bounds.bottom : 0)
    };
    
    // ========================================
    // 5. 최종 반환
    // ========================================
    return {
      viewport: {
        width: viewportWidth,
        height: viewportHeight
      },
      sections: {
        header: header.found ? header : null,
        body: { found: true, bounds: bodyBounds },
        footer: footer.found ? footer : null
      },
      confidence: {
        header: header.found ? 0.9 : 0,
        body: 1.0,
        footer: footer.found ? 0.9 : 0
      },
      detectedAt: new Date().toISOString()
    };
  });
}

/**
 * 감지된 섹션별로 스크린샷 촬영
 * @param {import('playwright').Page} page
 * @param {Object} sectionData - detectSections() 결과
 * @param {string} outputDir - 저장 경로
 * @returns {Promise<Object>} 각 섹션의 이미지 경로
 */
export async function capturePageSections(page, sectionData, outputDir) {
  const timestamp = Date.now();
  const screenshots = {};
  
  // 전체 페이지 (기존 동작 유지)
  const fullPath = path.join(outputDir, `screenshot-full-${timestamp}.png`);
  await page.screenshot({ path: fullPath, fullPage: true });
  screenshots.full = fullPath;
  
  // 헤더
  if (sectionData.sections.header?.found) {
    const clip = sanitizeClip(
      sectionData.sections.header.bounds, 
      sectionData.viewport
    );
    const headerPath = path.join(outputDir, `screenshot-header-${timestamp}.png`);
    await page.screenshot({ path: headerPath, clip });
    screenshots.header = headerPath;
  }
  
  // 바디 (최대 3000px로 제한)
  if (sectionData.sections.body?.found) {
    const bodyBounds = sectionData.sections.body.bounds;
    const maxBodyHeight = 3000;
    
    const clip = sanitizeClip({
      x: bodyBounds.x,
      y: bodyBounds.y,
      width: bodyBounds.width,
      height: Math.min(bodyBounds.height, maxBodyHeight)
    }, sectionData.viewport);
    
    const bodyPath = path.join(outputDir, `screenshot-body-${timestamp}.png`);
    await page.screenshot({ path: bodyPath, clip });
    screenshots.body = bodyPath;
  }
  
  // 푸터
  if (sectionData.sections.footer?.found) {
    const clip = sanitizeClip(
      sectionData.sections.footer.bounds, 
      sectionData.viewport
    );
    const footerPath = path.join(outputDir, `screenshot-footer-${timestamp}.png`);
    await page.screenshot({ path: footerPath, clip });
    screenshots.footer = footerPath;
  }
  
  return screenshots;
}

/**
 * 스크린샷 clip 좌표 보정 (음수/범위 초과 방지)
 */
function sanitizeClip(bounds, viewport) {
  return {
    x: Math.max(0, bounds.x),
    y: Math.max(0, bounds.y),
    width: Math.min(viewport.width, bounds.width),
    height: Math.max(1, bounds.height) // 최소 1px
  };
}