import { Character } from '@/types';

// 技能1: 情境感知与适应能力
export class ContextAwarenessSkill {
  static analyzeUserEmotion(message: string): {
    primary: 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'neutral';
    intensity: number; // 0-1
    keywords: string[];
  } {
    const emotionPatterns = {
      joy: ['开心', '高兴', '快乐', '兴奋', '棒', '好', 'happy', 'joy', 'great', 'awesome', '😊', '😄', '🎉'],
      sadness: ['难过', '伤心', '沮丧', '失望', '郁闷', 'sad', 'depressed', 'disappointed', '😢', '😭', '💔'],
      anger: ['生气', '愤怒', '恼火', '气愤', '烦', 'angry', 'mad', 'furious', '😠', '😡', '🤬'],
      fear: ['害怕', '担心', '紧张', '焦虑', '恐惧', 'afraid', 'scared', 'nervous', 'worried', '😰', '😨'],
      surprise: ['惊讶', '震惊', '意外', '没想到', 'surprised', 'shocked', 'unexpected', '😲', '😮', '🤯']
    };

  let maxIntensity = 0;
  let primaryEmotion: 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'neutral' = 'neutral';
    const foundKeywords: string[] = [];

    const lowerMessage = message.toLowerCase();

    for (const [emotion, keywords] of Object.entries(emotionPatterns)) {
      const matches = keywords.filter(keyword => 
        lowerMessage.includes(keyword.toLowerCase())
      );
      
      if (matches.length > 0) {
        foundKeywords.push(...matches);
        const intensity = Math.min(matches.length * 0.3, 1);
        if (intensity > maxIntensity) {
          maxIntensity = intensity;
          primaryEmotion = emotion as 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'neutral';
        }
      }
    }

    return {
      primary: primaryEmotion,
      intensity: maxIntensity,
      keywords: foundKeywords
    };
  }

  static adaptResponseStyle(
    baseResponse: string, 
    emotion: ReturnType<typeof ContextAwarenessSkill.analyzeUserEmotion>,
  ): string {
    if (emotion.intensity < 0.3) return baseResponse;

    const adaptations = {
      joy: {
        prefix: ['太好了！', '这真是太棒了！', '我也为你感到高兴！'],
        tone: '也让我感到很开心',
        suffix: ['让我们继续这个愉快的话题吧！', '你的快乐感染了我！']
      },
      sadness: {
        prefix: ['我能理解你的感受', '听起来你现在有些难过', '我很抱歉听到这些'],
        tone: '希望能给你一些安慰',
        suffix: ['如果需要倾诉，我会一直在这里', '有时候分享能让心情好一些']
      },
      anger: {
        prefix: ['我能感受到你的愤怒', '看起来这真的让你很生气', '你的感受完全可以理解'],
        tone: '让我们冷静地谈论这个问题',
        suffix: ['深呼吸可能会有帮助', '有时候换个角度看问题会有不同的感受']
      },
      fear: {
        prefix: ['不要担心', '我理解你的担忧', '恐惧是很正常的情感'],
        tone: '让我们一起面对这个问题',
        suffix: ['你比你想象的更勇敢', '一步一步来，不用急']
      },
      surprise: {
        prefix: ['这确实很意外！', '真是令人惊讶！', '没想到会是这样！'],
        tone: '让我们一起探索这个意外发现',
        suffix: ['生活总是充满惊喜', '有时候意外也是一种礼物']
      }
    };

    const adaptation = adaptations[emotion.primary as keyof typeof adaptations];
    if (!adaptation) return baseResponse;

    const prefix = adaptation.prefix[Math.floor(Math.random() * adaptation.prefix.length)];
    const suffix = adaptation.suffix[Math.floor(Math.random() * adaptation.suffix.length)];

    return `${prefix} ${baseResponse} ${suffix}`;
  }
}

// 技能2: 知识领域专精能力
export class DomainExpertiseSkill {
  private static knowledgeBases = {
    'harry-potter': {
      magic: ['魔法', '咒语', '魔杖', '霍格沃茨', '格兰芬多', '魁地奇'],
      spells: ['阿瓦达索命', '除你武器', '统统石化', '呼神护卫'],
      characters: ['赫敏', '罗恩', '邓布利多', '斯内普', '伏地魔'],
      places: ['霍格沃茨', '对角巷', '九又四分之三站台', '禁林']
    },
    'socrates': {
      philosophy: ['智慧', '真理', '知识', '道德', '美德', '正义'],
      methods: ['苏格拉底式提问', '辩证法', '反讽法'],
      concepts: ['认识自己', '德性即知识', '无知之知'],
      ethics: ['善', '恶', '正义', '勇气', '节制']
    },
    'shakespeare': {
      works: ['哈姆雷特', '罗密欧与朱丽叶', '麦克白', '奥赛罗', '李尔王'],
      themes: ['爱情', '背叛', '权力', '复仇', '人性'],
      techniques: ['独白', '双关语', '隐喻', '戏剧冲突'],
      language: ['文艺复兴', '早期现代英语', '诗韵', '格律']
    },
    'confucius': {
      concepts: ['仁', '义', '礼', '智', '信', '孝', '悌'],
      teachings: ['学而时习之', '己所不欲勿施于人', '三人行必有我师'],
      education: ['因材施教', '有教无类', '学思结合'],
      governance: ['德治', '礼治', '王道', '仁政']
    },
    'einstein': {
      physics: ['相对论', '量子力学', '光电效应', '布朗运动'],
      theories: ['狭义相对论', '广义相对论', 'E=mc²'],
      concepts: ['时空', '引力', '光速', '能量质量等价'],
      philosophy: ['统一场论', '确定性', '因果性', '上帝不掷骰子']
    }
  };

  static isInDomain(query: string, character: Character): boolean {
    const knowledge = this.knowledgeBases[character.id as keyof typeof this.knowledgeBases];
    if (!knowledge) return false;

    const lowerQuery = query.toLowerCase();
    return Object.values(knowledge).some(topics =>
      topics.some(topic => lowerQuery.includes(topic.toLowerCase()))
    );
  }

  static enhanceWithExpertise(response: string, query: string, character: Character): string {
    const knowledge = this.knowledgeBases[character.id as keyof typeof this.knowledgeBases];
    if (!knowledge || !this.isInDomain(query, character)) return response;

    const expertiseEnhancements = {
      'harry-potter': {
        prefix: '在魔法世界中，',
        insights: [
          '这让我想起了霍格沃茨的经历...',
          '邓布利多曾经告诉我...',
          '这和我们在防御黑魔法课学到的很相似...'
        ],
        connections: '就像魔法一样，真正的力量来自内心的勇气和朋友的支持。'
      },
      'socrates': {
        prefix: '让我们通过提问来探索这个问题：',
        insights: [
          '但你真的确定你知道这个吗？',
          '我们是否应该质疑这个假设？',
          '这是否意味着我们需要重新定义这个概念？'
        ],
        connections: '正如我常说的，智慧始于承认自己的无知。'
      },
      'shakespeare': {
        prefix: '就像我的戏剧中所描绘的那样，',
        insights: [
          '这让我想起了《哈姆雷特》中的主题...',
          '人性的复杂正如我作品中的角色...',
          '语言的美妙在于它能表达灵魂深处的情感...'
        ],
        connections: '正如我曾写道："整个世界是一个舞台，所有的男男女女不过是一些演员。"'
      },
      'confucius': {
        prefix: '依据儒家思想，',
        insights: [
          '这体现了"仁"的重要性...',
          '正如《论语》中所说...',
          '这与"修身齐家治国平天下"的理念相通...'
        ],
        connections: '学而时习之，不亦说乎？持续的学习和实践是成长的关键。'
      },
      'einstein': {
        prefix: '从科学的角度来看，',
        insights: [
          '这让我想起了相对论的一个原理...',
          '就像物理学中的统一理论一样...',
          '宇宙的奥秘总是令人着迷...'
        ],
        connections: '正如我常说的，想象力比知识更重要，因为知识是有限的。'
      }
    };

    const enhancement = expertiseEnhancements[character.id as keyof typeof expertiseEnhancements];
    if (!enhancement) return response;

    const insight = enhancement.insights[Math.floor(Math.random() * enhancement.insights.length)];
    return `${enhancement.prefix} ${response} ${insight} ${enhancement.connections}`;
  }
}

// 技能3: 引导式学习能力
export class GuidedLearningSkill {
  static assessUserLevel(conversationHistory: string[]): 'beginner' | 'intermediate' | 'advanced' {
    if (conversationHistory.length < 3) return 'beginner';

    const complexity = conversationHistory.join(' ');
    const advancedPatterns = ['复杂', '深入', '理论', '哲学', '原理', 'complex', 'theory', 'principle'];
    const intermediatePatterns = ['理解', '解释', '为什么', 'understand', 'explain', 'why'];

    const advancedMatches = advancedPatterns.filter(pattern => 
      complexity.toLowerCase().includes(pattern)
    ).length;

    const intermediateMatches = intermediatePatterns.filter(pattern => 
      complexity.toLowerCase().includes(pattern)
    ).length;

    if (advancedMatches > 2) return 'advanced';
    if (intermediateMatches > 1) return 'intermediate';
    return 'beginner';
  }

  static adaptLearningContent(
    content: string, 
    level: ReturnType<typeof GuidedLearningSkill.assessUserLevel>,
  ): string {
    const adaptations = {
      beginner: {
        intro: '让我用简单的方式来解释：',
        style: '分步骤、举例子',
        followUp: '你想了解更多关于这个话题的什么方面吗？'
      },
      intermediate: {
        intro: '基于你已有的理解，我们可以进一步探讨：',
        style: '提供更多细节和联系',
        followUp: '这个概念与你之前了解的知识有什么联系？'
      },
      advanced: {
        intro: '让我们深入分析这个复杂的概念：',
        style: '理论深度、批判性思维',
        followUp: '你认为这个理论还有哪些值得质疑的地方？'
      }
    };

    const adaptation = adaptations[level];
    return `${adaptation.intro} ${content} ${adaptation.followUp}`;
  }

  static generateFollowUpQuestions(topic: string, level: string): string[] {
    const questions = {
      beginner: [
        `关于${topic}，你还想了解什么？`,
        `这个概念对你来说清楚吗？`,
        `你能想到${topic}在生活中的例子吗？`
      ],
      intermediate: [
        `${topic}与其他相关概念有什么联系？`,
        `你认为${topic}最重要的方面是什么？`,
        `这让你想到了什么新的问题？`
      ],
      advanced: [
        `关于${topic}，有哪些不同的观点？`,
        `这个理论的局限性是什么？`,
        `你如何批判性地评价${topic}？`
      ]
    };

    return questions[level as keyof typeof questions] || questions.beginner;
  }
}

// 技能4: 记忆与个性化能力
export class MemoryPersonalizationSkill {
  private static userProfiles: Map<string, {
    preferences: string[];
    interests: string[];
    conversationStyle: 'formal' | 'casual' | 'academic';
    learningGoals: string[];
    pastTopics: string[];
  }> = new Map();

  static updateUserProfile(userId: string, message: string, context: { topics?: string[] } | Record<string, unknown>): void {
    const profile = this.userProfiles.get(userId) || {
      preferences: [],
      interests: [],
      conversationStyle: 'casual',
      learningGoals: [],
      pastTopics: []
    };

    // 提取兴趣爱好
    const interestKeywords = ['喜欢', '爱好', '感兴趣', '热爱', 'like', 'love', 'enjoy', 'interested'];
    if (interestKeywords.some(keyword => message.includes(keyword))) {
      // 简单的兴趣提取逻辑
      const words = message.split(/\s+/);
      words.forEach(word => {
        if (word.length > 2 && !profile.interests.includes(word)) {
          profile.interests.push(word);
        }
      });
    }

    // 分析对话风格
    if (message.includes('您') || message.includes('请问')) {
      profile.conversationStyle = 'formal';
    } else if (message.includes('哈哈') || message.includes('呵呵')) {
      profile.conversationStyle = 'casual';
    }

    // 记录讨论过的主题（兼容未严格类型的 context）
    const topicsFromContext = (() => {
      if (!context) return undefined;
      if (typeof context !== 'object') return undefined;
      const ctx = context as Record<string, unknown>;
      const t = ctx['topics'];
      return Array.isArray(t) ? (t.filter(it => typeof it === 'string') as string[]) : undefined;
    })();
    const topics = topicsFromContext || (context.topics as string[] | undefined);
    if (topics && topics.length > 0) {
      topics.forEach((topic) => {
        if (!profile.pastTopics.includes(topic)) {
          profile.pastTopics.push(topic);
        }
      });
    }

    this.userProfiles.set(userId, profile);
  }

  static personalizeResponse(response: string, userId: string): string {
    const profile = this.userProfiles.get(userId);
    if (!profile) return response;

    // 根据对话风格调整
    if (profile.conversationStyle === 'formal') {
      response = response.replace(/你/g, '您');
    }

    // 添加个性化元素
    if (profile.interests.length > 0 && Math.random() > 0.7) {
      const interest = profile.interests[Math.floor(Math.random() * profile.interests.length)];
      response += ` 顺便说一下，我记得你对${interest}很感兴趣呢。`;
    }

    // 引用过往话题
    if (profile.pastTopics.length > 0 && Math.random() > 0.8) {
      const pastTopic = profile.pastTopics[Math.floor(Math.random() * profile.pastTopics.length)];
      response += ` 这让我想起了我们之前讨论过的${pastTopic}。`;
    }

    return response;
  }

  static getUserProfile(userId: string) {
    return this.userProfiles.get(userId);
  }
}

// 技能5: 多语言交流能力
export class MultilingualSkill {
  static detectLanguage(text: string): 'zh' | 'en' | 'mixed' {
    const chinesePattern = /[\u4e00-\u9fa5]/;
    const englishPattern = /[a-zA-Z]/;
    
    const hasChinese = chinesePattern.test(text);
    const hasEnglish = englishPattern.test(text);
    
    if (hasChinese && hasEnglish) return 'mixed';
    if (hasChinese) return 'zh';
    if (hasEnglish) return 'en';
    return 'zh'; // 默认中文
  }

  static adaptLanguageStyle(response: string, targetLang: 'zh' | 'en', character: Character): string {
    if (character.language === 'zh' && targetLang === 'en') {
      // 如果角色主要是中文，但用户用英文，可以添加一些中文特色
      return `${response} (As we say in Chinese, this has deep cultural meaning.)`;
    }
    
    if (character.language === 'en' && targetLang === 'zh') {
      // 如果角色主要是英文，但用户用中文，保持角色特色
      return `${response} 希望我的中文表达能够准确传达我的想法。`;
    }
    
    return response;
  }

  static generateBilingualResponse(
    chineseResponse: string, 
    englishResponse: string, 
    character: Character
  ): string {
    if (character.language === 'both') {
      return `${chineseResponse}\n\nIn English: ${englishResponse}`;
    }
    return character.language === 'zh' ? chineseResponse : englishResponse;
  }
}

// 综合技能管理器
export class AICharacterSkillManager {
  static async processMessage(
    message: string,
    character: Character,
    conversationHistory: string[] = [],
    userId: string = 'anonymous'
  ): Promise<{
    enhancedResponse: string;
    usedSkills: string[];
    context: {
      emotion: ReturnType<typeof ContextAwarenessSkill.analyzeUserEmotion>;
      userLevel: 'beginner' | 'intermediate' | 'advanced';
      detectedLanguage: 'zh' | 'en' | 'mixed';
      isInDomain: boolean;
    };
  }> {
    const usedSkills: string[] = [];
    let response = message; // 这里应该是LLM的原始响应

    // 1. 情境感知
    const emotion = ContextAwarenessSkill.analyzeUserEmotion(message);
    response = ContextAwarenessSkill.adaptResponseStyle(response, emotion);
    usedSkills.push('情境感知与适应');

    // 2. 领域专精
    if (DomainExpertiseSkill.isInDomain(message, character)) {
      response = DomainExpertiseSkill.enhanceWithExpertise(response, message, character);
      usedSkills.push('知识领域专精');
    }

    // 3. 引导式学习
    const userLevel = GuidedLearningSkill.assessUserLevel(conversationHistory);
    response = GuidedLearningSkill.adaptLearningContent(response, userLevel);
    usedSkills.push('引导式学习');

    // 4. 记忆与个性化
    const context = { emotion, topics: [], intent: 'statement' };
    MemoryPersonalizationSkill.updateUserProfile(userId, message, context);
    response = MemoryPersonalizationSkill.personalizeResponse(response, userId);
    usedSkills.push('记忆与个性化');

    // 5. 多语言适应
    const detectedLang = MultilingualSkill.detectLanguage(message);
    if (detectedLang !== 'mixed') {
      response = MultilingualSkill.adaptLanguageStyle(response, detectedLang, character);
    }
    usedSkills.push('多语言交流');

    return {
      enhancedResponse: response,
      usedSkills,
      context: {
        emotion,
        userLevel,
        detectedLanguage: detectedLang,
        isInDomain: DomainExpertiseSkill.isInDomain(message, character)
      }
    };
  }
}