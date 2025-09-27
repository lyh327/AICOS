export interface Character {
  id: string;
  name: string;
  description: string;
  category: string;
  image: string;
  personality: string;
  background: string;
  skills: string[];
  language: 'zh' | 'en' | 'both';
  avatar: string;
  // 自定义角色相关字段
  isCustom?: boolean;
  source?: 'built-in' | 'user-created' | 'api-imported';
  createdAt?: Date;
  updatedAt?: Date;
  tags?: string[];
  prompt?: string; // 自定义系统提示
}

// 从网络获取角色信息的接口
export interface CharacterApiSource {
  url: string;
  name: string;
  description: string;
  enabled: boolean;
}

// 网络角色搜索结果
export interface OnlineCharacterResult {
  source: string;
  characters?: OnlineCharacter[];
  suggestions?: CharacterSuggestion[];
}

export interface CharacterSuggestion {
  name: string;
  description: string;
  personality: string;
  background: string;
  category: string;
  avatar: string;
  tags: string[];
}

export interface OnlineCharacter {
  id: string;
  name: string;
  description: string;
  personality?: string;
  background?: string;
  avatar?: string;
  image?: string;
  category?: string;
  tags?: string[];
  sourceUrl?: string;
  language?: 'zh' | 'en' | 'both';
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'character';
  content: string;
  timestamp: Date;
  audioUrl?: string;
  isComplete?: boolean; // 表示消息是否完整（是否被长度限制截断）
  canContinue?: boolean; // 表示是否可以继续生成
  isTemporary?: boolean; // 表示是否为临时加载消息
  attachedImage?: string | null; // 附加的图像URL
}

export interface ChatSession {
  id: string;
  characterId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  lastActiveAt: Date;
  isActive?: boolean;
}

export interface SessionSummary {
  id: string;
  characterId: string;
  characterName: string;
  title: string;
  lastMessage?: string;
  messageCount: number;
  createdAt: Date;
  lastActiveAt: Date;
}