// Extension state management
class CodeGuideExtension {
  constructor() {
    this.chatContainer = document.getElementById('chat-container');
    this.userInput = document.getElementById('user-input');
    this.sendBtn = document.getElementById('send-btn');
    this.settingsBtn = document.getElementById('settings-btn');
    this.settingsModal = document.getElementById('settings-modal');
    this.closeSettings = document.getElementById('close-settings');
    this.apiKeyInput = document.getElementById('api-key');
    this.guidanceLevel = document.getElementById('guidance-level');
    this.focusMode = document.getElementById('focus-mode');
    this.saveSettings = document.getElementById('save-settings');
    this.analyzeBtn = document.getElementById('analyze-btn');
    this.clearBtn = document.getElementById('clear-btn');
    this.charCount = document.getElementById('char-count');
    this.apiStatus = document.getElementById('api-status');

    this.settings = {
      apiKey: '',
      guidanceLevel: 'balanced',
      focusMode: 'mixed'
    };

    this.messageHistory = [];
    this.isProcessing = false;

    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.updateApiStatus();
    await this.loadChatHistory();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['codeGuideSettings']);
      if (result.codeGuideSettings) {
        this.settings = { ...this.settings, ...result.codeGuideSettings };
      }
      this.updateSettingsUI();
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async saveSettingsToStorage() {
    try {
      await chrome.storage.local.set({ codeGuideSettings: this.settings });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  async loadChatHistory() {
    try {
      const result = await chrome.storage.local.get(['codeGuideChatHistory']);
      if (result.codeGuideChatHistory) {
        this.messageHistory = result.codeGuideChatHistory;
        this.renderChatHistory();
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }

  async saveChatHistory() {
    try {
      await chrome.storage.local.set({ codeGuideChatHistory: this.messageHistory });
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  }

  renderChatHistory() {
    // Clear existing messages except the welcome message
    const messages = this.chatContainer.querySelectorAll('.flex:not(:first-child)');
    messages.forEach(msg => msg.remove());

    // Render stored messages
    this.messageHistory.forEach(msg => {
      this.addMessageToChat(msg.role, msg.content, false);
    });
  }

  setupEventListeners() {
    // Input handling
    this.userInput.addEventListener('input', () => this.handleInputChange());
    this.userInput.addEventListener('keydown', (e) => this.handleKeyDown(e));

    // Button events
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.analyzeBtn.addEventListener('click', () => this.analyzeCurrentPage());
    this.clearBtn.addEventListener('click', () => this.clearChat());

    // Settings modal
    this.settingsBtn.addEventListener('click', () => this.openSettings());
    this.closeSettings.addEventListener('click', () => this.closeSettingsModal());
    this.saveSettings.addEventListener('click', () => this.saveSettingsHandler());

    // Close modal on outside click
    this.settingsModal.addEventListener('click', (e) => {
      if (e.target === this.settingsModal) {
        this.closeSettingsModal();
      }
    });
  }

  handleInputChange() {
    const length = this.userInput.value.length;
    this.charCount.textContent = `${length}/2000`;
    
    // Auto-resize textarea
    this.userInput.style.height = 'auto';
    this.userInput.style.height = Math.min(this.userInput.scrollHeight, 120) + 'px';

    // Enable/disable send button
    this.sendBtn.disabled = !this.userInput.value.trim() || this.isProcessing;
  }

  handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  updateSettingsUI() {
    this.apiKeyInput.value = this.settings.apiKey || '';
    this.guidanceLevel.value = this.settings.guidanceLevel;
    this.focusMode.value = this.settings.focusMode;
  }

  updateApiStatus() {
    if (this.settings.apiKey) {
      this.apiStatus.textContent = '✅ API configured';
      this.apiStatus.className = 'text-xs text-green-600';
    } else {
      this.apiStatus.textContent = '⚠️ API key needed';
      this.apiStatus.className = 'text-xs text-orange-600';
    }
  }

  async sendMessage() {
    const message = this.userInput.value.trim();
    if (!message || this.isProcessing) return;

    if (!this.settings.apiKey) {
      this.showError('Please configure your Gemini API key in settings first.');
      this.openSettings();
      return;
    }

    this.addMessageToChat('user', message);
    this.userInput.value = '';
    this.userInput.style.height = 'auto';
    this.handleInputChange();

    this.showTypingIndicator();
    this.isProcessing = true;

    try {
      const response = await this.getAIResponse(message);
      this.removeTypingIndicator();
      this.addMessageToChat('assistant', response);
    } catch (error) {
      this.removeTypingIndicator();
      this.addMessageToChat('assistant', `❌ Error: ${error.message}`, true);
    } finally {
      this.isProcessing = false;
      this.handleInputChange();
    }
  }

  async analyzeCurrentPage() {
    if (!this.settings.apiKey) {
      this.showError('Please configure your Gemini API key in settings first.');
      this.openSettings();
      return;
    }

    if (this.isProcessing) return;

    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Inject script to extract code elements
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: this.extractPageCode
      });

      const codeData = results[0].result;
      
      if (!codeData || (!codeData.codeBlocks.length && !codeData.scripts.length)) {
        this.addMessageToChat('assistant', '🔍 No code elements found on this page. Try navigating to a page with code examples, GitHub, or coding tutorials.', true);
        return;
      }

      const analysisPrompt = this.buildAnalysisPrompt(codeData, tab.url);
      
      this.addMessageToChat('user', '🔍 Analyze code on this page');
      this.showTypingIndicator();
      this.isProcessing = true;

      const response = await this.getAIResponse(analysisPrompt);
      this.removeTypingIndicator();
      this.addMessageToChat('assistant', response);

    } catch (error) {
      this.removeTypingIndicator();
      this.addMessageToChat('assistant', `❌ Analysis failed: ${error.message}`, true);
    } finally {
      this.isProcessing = false;
    }
  }

  // Function to inject into page for code extraction
  extractPageCode() {
    const codeBlocks = [];
    const scripts = [];
    
    // Extract code blocks (pre, code tags) with better detection
    document.querySelectorAll('pre, code, .highlight, .code-block, .codehilite').forEach((element, index) => {
      const text = element.textContent.trim();
      if (text && text.length > 15 && !element.closest('script')) {
        // Detect programming language patterns
        const detectLanguage = (content) => {
          if (content.includes('function ') || content.includes('const ') || content.includes('var ')) return 'javascript';
          if (content.includes('def ') || content.includes('import ') || content.includes('print(')) return 'python';
          if (content.includes('#include') || content.includes('int main')) return 'cpp';
          if (content.includes('public class') || content.includes('System.out')) return 'java';
          if (content.includes('<?php') || content.includes('echo ')) return 'php';
          if (content.includes('<html') || content.includes('</div>')) return 'html';
          if (content.includes('{') && content.includes(':') && content.includes(';')) return 'css';
          return 'unknown';
        };

        const className = element.className || '';
        let language = 'unknown';
        
        // Try to extract language from class name
        const langMatch = className.match(/(?:language-|lang-)(\w+)/);
        if (langMatch) {
          language = langMatch[1];
        } else {
          language = detectLanguage(text);
        }

        codeBlocks.push({
          index: index,
          tag: element.tagName.toLowerCase(),
          content: text.substring(0, 1500), // Increased limit
          language: language,
          className: className
        });
      }
    });

    // Extract inline scripts with better filtering
    document.querySelectorAll('script').forEach((script, index) => {
      const text = script.textContent.trim();
      if (text && !script.src && text.length > 20) {
        // Skip analytics and tracking scripts
        if (!text.includes('gtag') && !text.includes('analytics') && !text.includes('facebook')) {
          scripts.push({
            index: index,
            content: text.substring(0, 800),
            type: script.type || 'text/javascript'
          });
        }
      }
    });

    // Also look for JSON data (for API examples)
    const jsonBlocks = [];
    document.querySelectorAll('[type="application/json"], .json, pre:contains("{")').forEach((element, index) => {
      const text = element.textContent.trim();
      if (text.startsWith('{') || text.startsWith('[')) {
        try {
          JSON.parse(text);
          jsonBlocks.push({
            index: index,
            content: text.substring(0, 800),
            type: 'json'
          });
        } catch (e) {
          // Not valid JSON, skip
        }
      }
    });

    return {
      url: window.location.href,
      title: document.title,
      codeBlocks: codeBlocks,
      scripts: scripts,
      jsonBlocks: jsonBlocks,
      domain: window.location.hostname
    };
  }

  buildAnalysisPrompt(codeData, url) {
    let prompt = `🔍 **Page Analysis Request**\n\nURL: ${url}\nTitle: ${codeData.title}\nDomain: ${codeData.domain}\n\n`;
    
    if (codeData.codeBlocks.length > 0) {
      prompt += `**Code Blocks Found (${codeData.codeBlocks.length}):**\n`;
      codeData.codeBlocks.slice(0, 5).forEach((block, i) => {
        prompt += `\n${i + 1}. **${block.language.toUpperCase()}** (${block.tag}):\n\`\`\`${block.language}\n${block.content}\n\`\`\`\n`;
      });
      
      if (codeData.codeBlocks.length > 5) {
        prompt += `\n... and ${codeData.codeBlocks.length - 5} more code blocks\n`;
      }
    }

    if (codeData.scripts.length > 0) {
      prompt += `\n**JavaScript Code Found (${codeData.scripts.length}):**\n`;
      codeData.scripts.slice(0, 3).forEach((script, i) => {
        prompt += `\n${i + 1}. **Script** (${script.type}):\n\`\`\`javascript\n${script.content}\n\`\`\`\n`;
      });
    }

    if (codeData.jsonBlocks && codeData.jsonBlocks.length > 0) {
      prompt += `\n**JSON Data Found (${codeData.jsonBlocks.length}):**\n`;
      codeData.jsonBlocks.slice(0, 2).forEach((json, i) => {
        prompt += `\n${i + 1}. **JSON Data:**\n\`\`\`json\n${json.content}\n\`\`\`\n`;
      });
    }

    prompt += `\n**Analysis Instructions:**
- Response Style: ${this.settings.guidanceLevel}
- Focus Mode: ${this.settings.focusMode}

Please provide:
1. **Code Quality Assessment** - Rate and explain the overall quality
2. **Best Practices** - What's being done well and what could improve
3. **Learning Opportunities** - Key concepts and techniques demonstrated
4. **Potential Issues** - Security, performance, or maintenance concerns
5. **Next Steps** - Suggestions for improvement or further learning

Focus on educational value and actionable insights.`;

    return prompt;
  }

  async getAIResponse(message) {
    const systemPrompt = this.buildSystemPrompt();
    
    // Build conversation history for context
    const conversationHistory = this.messageHistory.slice(-6).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));
    
    // Add current message
    conversationHistory.push({
      role: 'user',
      parts: [{ text: `${systemPrompt}\n\n${message}` }]
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.settings.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: conversationHistory,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
            stopSequences: []
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 403) {
        throw new Error('API key is invalid or has no quota. Please check your Gemini API key in settings.');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }
      throw new Error(errorData.error?.message || `API request failed (${response.status})`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('No response generated. The content may have been filtered.');
    }

    return data.candidates[0].content.parts[0].text;
  }

  buildSystemPrompt() {
    let prompt = "You are Code Guide, an expert programming assistant. ";
    
    // Response style configuration
    switch (this.settings.guidanceLevel) {
      case 'concise':
        prompt += "Provide brief, focused responses with essential information only. ";
        break;
      case 'detailed':
        prompt += "Provide thorough explanations with comprehensive details, examples, and best practices. ";
        break;
      default:
        prompt += "Provide clear, balanced explanations with helpful examples when needed. ";
    }

    // Focus mode configuration
    switch (this.settings.focusMode) {
      case 'guidance':
        prompt += "Focus on guidance, explanations, and pointing users in the right direction without providing direct code solutions. Help them learn and understand concepts. ";
        break;
      case 'direct':
        prompt += "Provide direct code solutions and implementations when appropriate, along with explanations. ";
        break;
      default:
        prompt += "Balance guidance with helpful code examples when they would aid understanding. Provide code when specifically requested or when it significantly helps explain a concept. ";
    }

    prompt += "Always prioritize teaching good programming practices, code quality, and helping users understand the 'why' behind solutions.";
    
    return prompt;
  }

  addMessageToChat(role, content, isError = false) {
    const div = document.createElement('div');
    div.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-bubble ${role}-message${isError ? ' error-message' : ''}`;
    
    if (role === 'assistant') {
      messageDiv.innerHTML = this.formatMessageContent(content);
    } else {
      messageDiv.textContent = content;
    }
    
    div.appendChild(messageDiv);
    this.chatContainer.appendChild(div);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;

    // Save to history (excluding welcome message and errors)
    if (!isError) {
      this.messageHistory.push({ role, content, timestamp: Date.now() });
      this.saveChatHistory();
    }
  }

  showTypingIndicator() {
    const div = document.createElement('div');
    div.id = 'typing-indicator';
    div.className = 'flex justify-start';
    div.innerHTML = `
      <div class="message-bubble assistant-message">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    this.chatContainer.appendChild(div);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
  }

  formatMessageContent(content) {
    // Simple markdown-like formatting
    content = content
      // Headers
      .replace(/^### (.*$)/gm, '<h3 class="markdown">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="markdown">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="markdown">$1</h1>')
      
      // Code blocks
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="markdown"><code>$2</code></pre>')
      
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="markdown">$1</code>')
      
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong class="markdown">$1</strong>')
      
      // Italic
      .replace(/\*(.*?)\*/g, '<em class="markdown">$1</em>')
      
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="markdown">$1</a>')
      
      // Lists
      .replace(/^\* (.+)$/gm, '<li class="markdown">$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li class="markdown">$2</li>')
      
      // Line breaks
      .replace(/\n/g, '<br>');

    // Wrap consecutive list items
    content = content.replace(/(<li class="markdown">.*?<\/li>)/gs, '<ul class="markdown">$1</ul>');

    return `<div class="markdown">${content}</div>`;
  }

  async clearChat() {
    const messages = this.chatContainer.querySelectorAll('.flex:not(:first-child)');
    messages.forEach(msg => msg.remove());
    
    this.messageHistory = [];
    await this.saveChatHistory();
  }

  openSettings() {
    this.settingsModal.classList.remove('hidden');
    this.apiKeyInput.focus();
  }

  closeSettingsModal() {
    this.settingsModal.classList.add('hidden');
  }

  async saveSettingsHandler() {
    const newApiKey = this.apiKeyInput.value.trim();
    const newGuidanceLevel = this.guidanceLevel.value;
    const newFocusMode = this.focusMode.value;

    // Validate API key format (basic check)
    if (newApiKey && !newApiKey.match(/^AIza[0-9A-Za-z\-_]{35}$/)) {
      this.showError('Invalid API key format. Please check your Gemini API key.');
      return;
    }

    this.settings.apiKey = newApiKey;
    this.settings.guidanceLevel = newGuidanceLevel;
    this.settings.focusMode = newFocusMode;

    await this.saveSettingsToStorage();
    this.updateApiStatus();
    this.closeSettingsModal();

    this.showSuccess('Settings saved successfully!');
  }

  showError(message) {
    this.addMessageToChat('assistant', `❌ ${message}`, true);
  }

  showSuccess(message) {
    this.addMessageToChat('assistant', `✅ ${message}`, false);
  }
}

// Initialize the extension when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new CodeGuideExtension();
});