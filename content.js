// Content script for Code Guide Chrome Extension
// This script runs on web pages to extract code elements

(() => {
  'use strict';

  // Enhanced code extraction function
  window.extractPageCodeAdvanced = function() {
    const results = {
      codeBlocks: [],
      scripts: [],
      jsonBlocks: [],
      apiEndpoints: [],
      metadata: {
        url: window.location.href,
        title: document.title,
        domain: window.location.hostname,
        hasReact: false,
        hasVue: false,
        hasAngular: false,
        hasJQuery: false
      }
    };

    // Detect popular frameworks
    if (window.React || document.querySelector('[data-reactroot]')) {
      results.metadata.hasReact = true;
    }
    if (window.Vue || document.querySelector('[data-v-]')) {
      results.metadata.hasVue = true;
    }
    if (window.angular || document.querySelector('[ng-app]')) {
      results.metadata.hasAngular = true;
    }
    if (window.jQuery || window.$) {
      results.metadata.hasJQuery = true;
    }

    // Enhanced code block extraction
    const codeSelectors = [
      'pre', 'code', '.highlight', '.code-block', '.codehilite', 
      '.language-*', '.hljs', '.code', '.source-code',
      'div[class*="code"]', 'div[class*="highlight"]'
    ];

    codeSelectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach((element, index) => {
          const text = element.textContent?.trim();
          if (!text || text.length < 20) return;

          // Skip if already processed or is a child of another code block
          if (element.hasAttribute('data-code-guide-processed')) return;
          if (element.closest('pre, code') !== element && element.tagName !== 'PRE' && element.tagName !== 'CODE') return;

          element.setAttribute('data-code-guide-processed', 'true');

          const language = detectLanguage(text, element.className);
          const context = getCodeContext(element);

          results.codeBlocks.push({
            index: results.codeBlocks.length,
            content: text.substring(0, 2000),
            language: language,
            context: context,
            selector: getElementSelector(element),
            size: text.length
          });
        });
      } catch (e) {
        console.warn('Code Guide: Error processing selector', selector, e);
      }
    });

    // Extract inline scripts with better filtering
    document.querySelectorAll('script').forEach((script, index) => {
      const text = script.textContent?.trim();
      if (!text || script.src || text.length < 30) return;

      // Skip tracking and analytics scripts
      const skipPatterns = [
        'gtag', 'analytics', 'facebook', 'google-analytics',
        'googletagmanager', 'hotjar', 'mixpanel', 'segment'
      ];
      
      if (skipPatterns.some(pattern => text.toLowerCase().includes(pattern))) return;

      results.scripts.push({
        index: results.scripts.length,
        content: text.substring(0, 1000),
        type: script.type || 'text/javascript',
        size: text.length
      });
    });

    // Extract JSON data and API endpoints
    document.querySelectorAll('script[type="application/json"], pre:contains("{"), code:contains("{")').forEach(element => {
      const text = element.textContent?.trim();
      if (!text || (!text.startsWith('{') && !text.startsWith('['))) return;

      try {
        const parsed = JSON.parse(text);
        results.jsonBlocks.push({
          index: results.jsonBlocks.length,
          content: text.substring(0, 1000),
          type: 'json',
          isArray: Array.isArray(parsed),
          keys: Array.isArray(parsed) ? [] : Object.keys(parsed).slice(0, 10)
        });
      } catch (e) {
        // Not valid JSON
      }
    });

    // Look for API endpoints in code
    const apiPatterns = [
      /https?:\/\/[^\s'"`,;)]+\/api\/[^\s'"`,;)]*/g,
      /\/api\/[^\s'"`,;)]*/g,
      /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /axios\.[get|post|put|delete]+\s*\(\s*['"`]([^'"`]+)['"`]/g
    ];

    results.codeBlocks.forEach(block => {
      apiPatterns.forEach(pattern => {
        const matches = block.content.match(pattern);
        if (matches) {
          matches.forEach(match => {
            if (!results.apiEndpoints.some(ep => ep.url === match)) {
              results.apiEndpoints.push({
                url: match,
                method: 'unknown',
                source: 'code-analysis'
              });
            }
          });
        }
      });
    });

    return results;
  };

  // Helper function to detect programming language
  function detectLanguage(content, className = '') {
    // Check class name first
    const langMatch = className.match(/(?:language-|lang-|hljs-)(\w+)/);
    if (langMatch) return langMatch[1].toLowerCase();

    // Pattern-based detection
    const patterns = {
      javascript: [/function\s+\w+\s*\(/, /const\s+\w+\s*=/, /var\s+\w+/, /let\s+\w+/, /=>\s*{/, /console\.log/],
      python: [/def\s+\w+\s*\(/, /import\s+\w+/, /from\s+\w+\s+import/, /print\s*\(/, /if\s+__name__\s*==/, /class\s+\w+:/],
      java: [/public\s+class\s+\w+/, /public\s+static\s+void\s+main/, /System\.out\.println/, /private\s+\w+\s+\w+/],
      cpp: [/#include\s*</, /int\s+main\s*\(/, /std::/, /cout\s*<</, /namespace\s+\w+/],
      csharp: [/using\s+System/, /public\s+class\s+\w+/, /Console\.WriteLine/, /namespace\s+\w+/],
      php: [/<\?php/, /echo\s+/, /\$\w+\s*=/, /function\s+\w+\s*\(/],
      ruby: [/def\s+\w+/, /end\s*$/, /puts\s+/, /class\s+\w+/],
      go: [/package\s+main/, /func\s+\w+\s*\(/, /import\s+\(/, /fmt\.Print/],
      rust: [/fn\s+\w+\s*\(/, /let\s+mut\s+/, /println!\s*\(/, /use\s+std::/],
      sql: [/SELECT\s+.*FROM/, /INSERT\s+INTO/, /UPDATE\s+.*SET/, /CREATE\s+TABLE/],
      html: [/<html/, /<\/html>/, /<div/, /<script/, /<style/],
      css: [/\{[^}]*:[^}]*;[^}]*\}/, /@media/, /@import/, /\.[\w-]+\s*\{/],
      json: [/^\s*\{/, /^\s*\[/, /"[\w-]+":\s*["\d\{\[]/, /\}\s*,\s*\{/],
      yaml: [/^\s*\w+:\s*/, /^\s*-\s+/, /---\s*$/, /\.\.\.\s*$/],
      xml: [/<\?xml/, /<\/\w+>/, /xmlns/, /<\w+[^>]*>/],
      markdown: [/^#{1,6}\s+/, /\*\*.*\*\*/, /\[.*\]\(.*\)/, /```/],
      shell: [/#!/, /ls\s+/, /cd\s+/, /grep\s+/, /sudo\s+/],
      dockerfile: [/FROM\s+/, /RUN\s+/, /COPY\s+/, /EXPOSE\s+/]
    };

    for (const [lang, regexes] of Object.entries(patterns)) {
      if (regexes.some(regex => regex.test(content))) {
        return lang;
      }
    }

    return 'unknown';
  }

  // Get context information about code element
  function getCodeContext(element) {
    const context = {
      hasLineNumbers: false,
      hasHighlighting: false,
      isInArticle: false,
      isInTutorial: false,
      nearbyText: ''
    };

    // Check for line numbers
    context.hasLineNumbers = element.querySelector('.line-number, .lineno') !== null ||
                             element.className.includes('line-numbers');

    // Check for syntax highlighting
    context.hasHighlighting = element.querySelector('.highlight, .hljs, [class*="token"]') !== null ||
                              element.className.includes('highlight');

    // Check if in article or tutorial context
    const container = element.closest('article, .tutorial, .documentation, .guide, .example');
    context.isInArticle = container !== null;
    context.isInTutorial = element.closest('.tutorial, .step, .lesson') !== null;

    // Get nearby text for context
    const prevSibling = element.previousElementSibling;
    const nextSibling = element.nextElementSibling;
    
    if (prevSibling?.textContent) {
      context.nearbyText += prevSibling.textContent.substring(0, 100) + ' ';
    }
    if (nextSibling?.textContent) {
      context.nearbyText += nextSibling.textContent.substring(0, 100);
    }

    return context;
  }

  // Generate CSS selector for element
  function getElementSelector(element) {
    if (element.id) return `#${element.id}`;
    
    const path = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
      let selector = element.nodeName.toLowerCase();
      if (element.className) {
        selector += '.' + element.className.trim().split(/\s+/).slice(0, 2).join('.');
      }
      path.unshift(selector);
      element = element.parentNode;
      if (path.length > 3) break; // Limit depth
    }
    return path.join(' > ');
  }

  // Message listener for requests from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractCode') {
      try {
        const result = window.extractPageCodeAdvanced();
        sendResponse({ success: true, data: result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
  });

})();