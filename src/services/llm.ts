import axios from 'axios';
import { Character } from '@/types';

// 智谱GLM配置
const GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

// 安全配置 - 优化超时设置
const REQUEST_TIMEOUT = 60000; // 60秒超时，适应长文本处理
const LONG_TEXT_TIMEOUT = 90000; // 90秒超时，用于特别长的文本
const MAX_RETRY_ATTEMPTS = 2; // 减少重试次数，避免累积超时
const RETRY_DELAY = 2000; // 2秒基础延迟

// 注意: API key 现在通过服务器端环境变量获取，不再暴露到客户端
// 这个服务只能在服务器端使用 (API routes)
function getGLMApiKey(): string {
  // 在客户端环境下，这个服务不应该被直接调用
  if (typeof window !== 'undefined') {
    throw new Error('LLMService should only be used on the server side');
  }
  
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    throw new Error('GLM_API_KEY environment variable is not configured');
  }
  
  return apiKey;
}

// 安全的延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 带重试的安全请求函数
async function secureApiRequest(requestData: any, retryCount = 0, isLongText = false): Promise<any> {
  try {
    // 根据文本长度选择超时时间
    const timeout = isLongText ? LONG_TEXT_TIMEOUT : REQUEST_TIMEOUT;
    
    const response = await axios.post(GLM_API_URL, requestData, {
      headers: {
        'Authorization': `Bearer ${getGLMApiKey()}`,
        'Content-Type': 'application/json'
      },
      timeout: timeout,
      // 安全配置
      validateStatus: (status) => status < 500, // 只有5xx错误才重试
    });

    if (!response.data || !response.data.choices || !response.data.choices[0]) {
      throw new Error('Invalid response format from GLM API');
    }

    return response;
  } catch (error: any) {
    // 记录错误
    console.error(`GLM API request failed (attempt ${retryCount + 1}):`, {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
      timeout: isLongText ? LONG_TEXT_TIMEOUT : REQUEST_TIMEOUT
    });

    // 检查是否应该重试
    const shouldRetry = retryCount < MAX_RETRY_ATTEMPTS && (
      error.code === 'ECONNABORTED' || // 超时
      error.code === 'ENOTFOUND' ||   // 网络错误
      (error.response?.status >= 500)  // 服务器错误
    );

    if (shouldRetry) {
      const delayMs = RETRY_DELAY * Math.pow(2, retryCount); // 指数退避
      console.log(`Retrying in ${delayMs}ms... (${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
      await delay(delayMs);
      return secureApiRequest(requestData, retryCount + 1, isLongText);
    }

    throw error;
  }
}

export interface LLMResponse {
  content: string;
  success: boolean;
  error?: string;
  isComplete?: boolean; // 表示回复是否完整
  finishReason?: string; // 结束原因：'stop' | 'length' | 'content_filter' | 'tool_calls'
  thinkingProcess?: string; // GLM-4.5 深度思考过程
  imageAnalysis?: string; // GLM-4.5V 视觉分析结果
}

export interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | MessageContent[];
}

export class LLMService {
  // GLM模型配置
  private static readonly GLM_MODELS = {
    standard: 'glm-4.5',
    thinking: 'glm-4.5', // 支持深度思考
    vision: 'glm-4.5v', // 支持视觉理解
  };

  private static generateSystemPrompt(character: Character): string {
    // 如果角色有自定义prompt，优先使用
    if (character.prompt && character.prompt.trim()) {
      return character.prompt;
    }

    // 否则生成默认prompt
    return `你是${character.name}，${character.description}。
    
个性特征: ${character.personality}
背景信息: ${character.background}
核心技能: ${Array.isArray(character.skills) ? character.skills.join('、') : character.tags?.join('、') || '通用对话'}

请始终保持以下角色特征：
1. 情境感知与适应：根据对话内容和用户情绪调整回应风格
2. 知识领域专精：在你的专业领域展现深度知识
3. 引导式学习：根据用户水平提供适当的信息和引导
4. 记忆与个性化：记住对话中的重要信息，建立个性化关系
5. 多语言交流：根据用户语言偏好智能切换，保持角色特色

请用${character.language === 'zh' ? '中文' : character.language === 'en' ? '英文' : '用户使用的语言'}回应，保持${character.name}的说话风格和思维方式。回答要生动、有趣，体现角色的独特魅力。`;
  }

  // 深度思考功能 - GLM-4.5 支持
  static async generateResponseWithThinking(
    character: Character,
    userMessage: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [],
    enableThinking: boolean = false
  ): Promise<LLMResponse> {
    try {
      const systemPrompt = this.generateSystemPrompt(character);

      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-6),
        { role: 'user', content: userMessage }
      ];

      // 检测是否为长文本
      const totalLength = systemPrompt.length + userMessage.length + 
        conversationHistory.reduce((sum, msg) => sum + msg.content.length, 0);
      const isLongText = totalLength > 2000 || userMessage.length > 1000;

      const requestBody: any = {
        model: this.GLM_MODELS.thinking,
        messages: messages,
        temperature: 0.8,
        max_tokens: isLongText ? 4000 : 2000, // 长文本增加token限制
        top_p: 0.9,
        stream: false
      };

      // 启用深度思考功能
      if (enableThinking) {
        requestBody.thinking = {
          type: 'enabled'  // 使用正确的GLM-4.5深度思考参数格式
        };
        requestBody.max_tokens = isLongText ? 5000 : 3000; // 增加token限制以支持思考过程
      }

      // Debug logging removed for production. Request body prepared for GLM-4.5 thinking.

      const response = await secureApiRequest(requestBody, 0, isLongText);

      const choice = response.data.choices[0];
      const content = choice?.message?.content;
      const finishReason = choice?.finish_reason;

      // 根据官方文档，GLM-4.5 深度思考的响应格式可能包含思考过程
      // 尝试从不同字段提取思考过程内容
      let thinkingProcess = null;

      // 检查message对象中可能的思考过程字段
      if (choice?.message) {
        thinkingProcess = choice.message.reasoning_content ||  // GLM-4.5的实际字段名
          choice.message.think ||
          choice.message.thinking ||
          choice.message.thought_process ||
          choice.message.reasoning ||
          choice.message.analysis ||
          choice.message.thoughts ||
          choice.message.reflection;
      }

      // 检查choice对象本身的字段
      if (!thinkingProcess && choice) {
        thinkingProcess = choice.think ||
          choice.thinking ||
          choice.thought_process ||
          choice.reasoning ||
          choice.analysis;
      }

      // 检查顶层响应对象是否包含思考过程
      if (!thinkingProcess && response.data) {
        thinkingProcess = response.data.think ||
          response.data.thinking ||
          response.data.thought_process;
      }

      // 检查content是否包含思考标记
      if (!thinkingProcess && content && enableThinking) {
        // 尝试从content中提取思考过程（有些模型可能在content中包含特殊标记）
        const thinkingMatch = content.match(/<think>([\s\S]*?)<\/think>/) ||
          content.match(/【思考】([\s\S]*?)【\/思考】/) ||
          content.match(/## 思考过程\n([\s\S]*?)\n## /);
        if (thinkingMatch) {
          thinkingProcess = thinkingMatch[1].trim();
        }
      }

      // Debug logging removed for production. Response parsed for content and thinking process.

      if (!content) {
        throw new Error('No content received from LLM');
      }

      return {
        content: content.trim(),
        success: true,
        isComplete: finishReason === 'stop',
        finishReason: finishReason,
        thinkingProcess: thinkingProcess
      };
    } catch (error) {
      console.error('LLM Thinking API Error:', error);
      return this.getFallbackLLMResponse(character, userMessage, error);
    }
  }

  // 视觉理解功能 - GLM-4.5V 支持
  static async generateResponseWithVision(
    character: Character,
    userMessage: string,
    imageUrl?: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
  ): Promise<LLMResponse> {
    try {
      const systemPrompt = this.generateSystemPrompt(character);

      // 构建消息内容
      const userContent: MessageContent[] = [
        { type: 'text', text: userMessage }
      ];

      if (imageUrl) {
        userContent.push({
          type: 'image_url',
          image_url: {
            url: imageUrl,
            detail: 'high' // 使用高质量分析
          }
        });
      }

      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-6),
        { role: 'user', content: userContent }
      ];

      // 视觉处理通常需要更多时间
      const isLongText = true;

      const requestData = {
        model: this.GLM_MODELS.vision,
        messages: messages,
        temperature: 0.8,
        max_tokens: 3000, // 视觉分析增加token限制
        top_p: 0.9,
        stream: false
      };

      const response = await secureApiRequest(requestData, 0, isLongText);

      const choice = response.data.choices[0];
      const content = choice?.message?.content;
      const finishReason = choice?.finish_reason;

      if (!content) {
        throw new Error('No content received from LLM');
      }

      return {
        content: content.trim(),
        success: true,
        isComplete: finishReason === 'stop',
        finishReason: finishReason,
        imageAnalysis: imageUrl ? '已完成图像分析' : undefined
      };
    } catch (error) {
      console.error('LLM Vision API Error:', error);
      return this.getFallbackLLMResponse(character, userMessage, error);
    }
  }

  // 综合功能：同时支持深度思考和视觉理解
  static async generateAdvancedResponse(
    character: Character,
    userMessage: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [],
    options: {
      enableThinking?: boolean;
      imageUrl?: string;
      analysisMode?: 'standard' | 'detailed' | 'creative';
    } = {}
  ): Promise<LLMResponse> {
    const { enableThinking = false, imageUrl, analysisMode = 'standard' } = options;

    // 如果有图像，使用视觉模型
    if (imageUrl) {
      return this.generateResponseWithVision(character, userMessage, imageUrl, conversationHistory);
    }

    // 根据分析模式决定是否使用深度思考
    const shouldUseThinking = enableThinking || analysisMode === 'detailed';

    return this.generateResponseWithThinking(character, userMessage, conversationHistory, shouldUseThinking);
  }

  // 智能模式选择
  static async generateSmartResponse(
    character: Character,
    userMessage: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [],
    imageUrl?: string
  ): Promise<LLMResponse> {
    // 分析消息复杂度，决定是否需要深度思考
    const needsThinking = this.shouldUseThinking(userMessage, character);

    return this.generateAdvancedResponse(character, userMessage, conversationHistory, {
      enableThinking: needsThinking,
      imageUrl: imageUrl,
      analysisMode: needsThinking ? 'detailed' : 'standard'
    });
  }

  // 判断是否需要深度思考
  private static shouldUseThinking(message: string, character: Character): boolean {
    const thinkingTriggers = [
      // 哲学思考
      '为什么', '原因', '本质', '意义', '哲学', '思考', '分析', 'why', 'reason', 'meaning',
      // 复杂问题
      '解释', '如何', '方法', '步骤', '过程', 'explain', 'how', 'process', 'method',
      // 科学推理
      '证明', '推理', '逻辑', '理论', 'prove', 'logic', 'theory', 'reasoning',
      // 创意和设计
      '设计', '创造', '想象', '创新', 'design', 'create', 'imagine', 'innovation',
      // 比较分析
      '比较', '对比', '区别', '优缺点', 'compare', 'difference', 'advantage'
    ];

    // 检查消息是否包含思考触发词
    const messageContainsThinkingTriggers = thinkingTriggers.some(trigger =>
      message.toLowerCase().includes(trigger.toLowerCase())
    );

    // 特定角色更倾向于深度思考
    const thinkingCharacters = ['socrates', 'einstein', 'confucius'];
    const isThinkingCharacter = thinkingCharacters.includes(character.id);

    // 消息长度和复杂度
    const isComplexMessage = message.length > 50 && message.includes('？');

    return messageContainsThinkingTriggers || (isThinkingCharacter && isComplexMessage);
  }

  // 生成fallback响应的辅助方法
  private static getFallbackLLMResponse(character: Character, userMessage: string, error: any): LLMResponse {
    console.error('LLM API调用失败:', error);

    // 构建详细的错误信息
    let errorMessage = 'AI服务暂时不可用';

    if (error?.response?.status) {
      errorMessage += ` (HTTP ${error.response.status})`;
    }

    if (error?.response?.data?.error?.message) {
      errorMessage += `: ${error.response.data.error.message}`;
    } else if (error?.message) {
      errorMessage += `: ${error.message}`;
    }

    return {
      content: `抱歉，${errorMessage}。请稍后重试或联系管理员。`,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      isComplete: true
    };
  }

  static async continueResponse(
    character: Character,
    previousContent: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
  ): Promise<LLMResponse> {
    try {
      const systemPrompt = this.generateSystemPrompt(character);

      // 构建消息历史，让AI知道之前的回复被截断了
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-6),
        {
          role: 'assistant',
          content: previousContent
        },
        {
          role: 'user',
          content: '请继续你刚才未完成的回答，直接从停止的地方继续，不要重复之前的内容。'
        }
      ];

      const requestData = {
        model: 'glm-4.5',
        messages: messages,
        temperature: 0.8,
        max_tokens: 3000,
        top_p: 0.9,
        stream: false
      };

      const response = await secureApiRequest(requestData);

      const content = response.data.choices[0]?.message?.content;
      const finishReason = response.data.choices[0]?.finish_reason;

      if (!content) {
        throw new Error('No content received from LLM');
      }

      // 清理可能的重复内容
      let cleanedContent = content.trim();

      // 移除可能的重复开头
      const previousWords = previousContent.split(' ').slice(-5); // 取最后5个词
      if (previousWords.length > 0) {
        const lastPart = previousWords.join(' ');
        if (cleanedContent.startsWith(lastPart)) {
          cleanedContent = cleanedContent.substring(lastPart.length).trim();
        }
      }

      return {
        content: cleanedContent,
        success: true,
        isComplete: finishReason === 'stop',
        finishReason: finishReason
      };
    } catch (error) {
      console.error('LLM Continue API Error:', error);

      return {
        content: '... (继续生成时发生错误，请重试)',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        isComplete: true
      };
    }
  }

  // 新的主要生成方法 - 集成所有功能
  static async generateResponse(
    character: Character,
    userMessage: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [],
    options?: {
      enableThinking?: boolean;
      imageUrl?: string;
      mode?: 'standard' | 'smart' | 'thinking' | 'vision';
    }
  ): Promise<LLMResponse> {
    const mode = options?.mode || 'smart';

    switch (mode) {
      case 'thinking':
        return this.generateResponseWithThinking(character, userMessage, conversationHistory, true);

      case 'vision':
        return this.generateResponseWithVision(character, userMessage, options?.imageUrl, conversationHistory);

      case 'smart':
        return this.generateSmartResponse(character, userMessage, conversationHistory, options?.imageUrl);

      default:
        return this.generateStandardResponse(character, userMessage, conversationHistory);
    }
  }

  // 标准生成方法（原有功能）
  static async generateStandardResponse(
    character: Character,
    userMessage: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
  ): Promise<LLMResponse> {
    try {
      const systemPrompt = this.generateSystemPrompt(character);

      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-6), // 保留最近6轮对话作为上下文
        { role: 'user', content: userMessage }
      ];

      // 检测是否为长文本
      const totalLength = systemPrompt.length + userMessage.length + 
        conversationHistory.reduce((sum, msg) => sum + msg.content.length, 0);
      const isLongText = totalLength > 2000 || userMessage.length > 800;

      const requestData = {
        model: this.GLM_MODELS.standard,
        messages: messages,
        temperature: 0.8,
        max_tokens: isLongText ? 2000 : 1000,
        top_p: 0.9,
        stream: false
      };

      const response = await secureApiRequest(requestData, 0, isLongText);

      const content = response.data.choices[0]?.message?.content;
      const finishReason = response.data.choices[0]?.finish_reason;

      if (!content) {
        throw new Error('No content received from LLM');
      }

      return {
        content: content.trim(),
        success: true,
        isComplete: finishReason === 'stop',
        finishReason: finishReason
      };
    } catch (error) {
      console.error('LLM API Error:', error);
      return this.getFallbackLLMResponse(character, userMessage, error);
    }
  }

  private static getFallbackResponse(character: Character, userMessage: string): string {
    const fallbackResponses: Record<string, string[]> = {
      'harry-potter': [
        '这让我想起了在霍格沃茨的经历... 你想听听我在魔法学校的故事吗？',
        '赫敏总是说学习很重要，我觉得勇气同样重要。你怎么看？',
        '面对困难时，朋友的支持是最重要的。你有这样的朋友吗？'
      ],
      'socrates': [
        '这是一个很有趣的问题。让我们一起思考它的本质是什么？',
        '我认为智慧始于承认自己的无知。你对此有什么看法？',
        '通过不断提问，我们可以更接近真理。你还想探讨什么？'
      ],
      'shakespeare': [
        '生活如同舞台，每个人都在扮演自己的角色...你在演什么角色呢？',
        '文字是思想的羽翼，让我们的灵魂自由飞翔。',
        '爱情、友谊、勇气...这些永恒的主题在你心中如何体现？'
      ],
      'confucius': [
        '学而时习之，不亦说乎？你在学习中有什么体会？',
        '己所不欲，勿施于人。这个道理在生活中很有用。',
        '三人行，必有我师焉。每个人都有值得学习的地方。'
      ],
      'einstein': [
        '想象力比知识更重要，你同意这个观点吗？',
        '宇宙最不可理解的就是它是可以理解的。科学充满了奇迹。',
        '好奇心是推动我探索的动力。你对什么最好奇？'
      ]
    };

    const responses = fallbackResponses[character.id] || [
      '这是一个很有趣的观点，让我们继续深入讨论吧。',
      '你的想法很独特，我很想听听更多。',
      '让我们从另一个角度来看这个问题。'
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  // 实现情境感知能力
  static analyzeContext(message: string): {
    emotion: 'positive' | 'negative' | 'neutral';
    topics: string[];
    intent: 'question' | 'statement' | 'greeting' | 'farewell';
  } {
    const lowerMessage = message.toLowerCase();

    // 简单的情绪分析
    const positiveWords = ['好', '棒', '开心', '高兴', '喜欢', 'good', 'great', 'happy', 'love'];
    const negativeWords = ['坏', '难过', '生气', '讨厌', '糟糕', 'bad', 'sad', 'angry', 'hate'];

    let emotion: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (positiveWords.some(word => lowerMessage.includes(word))) {
      emotion = 'positive';
    } else if (negativeWords.some(word => lowerMessage.includes(word))) {
      emotion = 'negative';
    }

    // 主题识别
    const topics: string[] = [];
    if (lowerMessage.includes('学习') || lowerMessage.includes('学校') || lowerMessage.includes('study')) {
      topics.push('education');
    }
    if (lowerMessage.includes('朋友') || lowerMessage.includes('友谊') || lowerMessage.includes('friend')) {
      topics.push('friendship');
    }
    if (lowerMessage.includes('工作') || lowerMessage.includes('职业') || lowerMessage.includes('work')) {
      topics.push('career');
    }

    // 意图识别
    let intent: 'question' | 'statement' | 'greeting' | 'farewell' = 'statement';
    if (lowerMessage.includes('?') || lowerMessage.includes('？') || lowerMessage.includes('what') || lowerMessage.includes('how')) {
      intent = 'question';
    } else if (lowerMessage.includes('你好') || lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      intent = 'greeting';
    } else if (lowerMessage.includes('再见') || lowerMessage.includes('goodbye') || lowerMessage.includes('bye')) {
      intent = 'farewell';
    }

    return { emotion, topics, intent };
  }
}