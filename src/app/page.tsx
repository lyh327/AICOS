'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { characters, categories } from '@/data/characters';
import { CharacterCard } from '@/components/CharacterCard';
import { CharacterSearch } from '@/components/CharacterSearch';
import { ChatLayout } from '@/components/ChatLayout';
import { Character } from '@/types';
import { CharacterManager } from '@/services/character-manager';

// 防抖动Hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function HomePage() {
  const [currentCategory, setCurrentCategory] = useState('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [customCharacters, setCustomCharacters] = useState<Character[]>([]);
  
  // 对搜索查询进行防抖处理，300ms延迟
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    // 加载自定义角色
    const custom = CharacterManager.getCustomCharacters();
    setCustomCharacters(custom);
  }, []);

  const allCharacters = useMemo(() => {
    // 合并预设角色和自定义角色
    return [...characters, ...customCharacters];
  }, [customCharacters]);

  const allCategories = useMemo(() => {
    // 合并所有分类
    const customCategories = Array.from(new Set(customCharacters.map(char => char.category).filter(Boolean)));
    const uniqueCategories = Array.from(new Set([...categories, ...customCategories]));
    return ['全部', ...uniqueCategories.filter(cat => cat !== '全部')];
  }, [customCharacters]);

  // 模糊搜索函数
  const fuzzyMatch = useCallback((str: string, query: string): number => {
    const strLower = str.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // 完全匹配得分最高
    if (strLower === queryLower) return 100;
    
    // 开头匹配
    if (strLower.startsWith(queryLower)) return 90;
    
    // 包含完整查询
    if (strLower.includes(queryLower)) return 80;
    
    // 模糊匹配算法
    let score = 0;
    let queryIndex = 0;
    
    for (let i = 0; i < strLower.length && queryIndex < queryLower.length; i++) {
      if (strLower[i] === queryLower[queryIndex]) {
        score += (queryLower.length - queryIndex) * 2; // 越早匹配得分越高
        queryIndex++;
      }
    }
    
    // 如果所有查询字符都找到了，给额外分数
    if (queryIndex === queryLower.length) {
      score += 20;
    }
    
    return score;
  }, []);

  const filteredCharacters = useMemo(() => {
    let result = currentCategory === '全部' 
      ? allCharacters 
      : allCharacters.filter(char => char.category === currentCategory);
    
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      
      // 计算每个角色的匹配分数
      const scoredCharacters = result.map(character => {
        let maxScore = 0;
        
        // 在名称中搜索（权重最高）
        maxScore = Math.max(maxScore, fuzzyMatch(character.name, query));
        
        // 在描述中搜索
        maxScore = Math.max(maxScore, fuzzyMatch(character.description, query) * 0.8);
        
        // 在标签中搜索
        if (character.tags) {
          const tagScore = Math.max(...character.tags.map(tag => fuzzyMatch(tag, query) * 0.9));
          maxScore = Math.max(maxScore, tagScore);
        }
        
        // 在技能中搜索
        if (character.skills) {
          const skillScore = Math.max(...character.skills.map(skill => fuzzyMatch(skill, query) * 0.7));
          maxScore = Math.max(maxScore, skillScore);
        }
        
        // 在个性描述中搜索
        maxScore = Math.max(maxScore, fuzzyMatch(character.personality, query) * 0.6);
        
        // 在背景中搜索
        maxScore = Math.max(maxScore, fuzzyMatch(character.background, query) * 0.6);
        
        // 在分类中搜索
        maxScore = Math.max(maxScore, fuzzyMatch(character.category, query) * 0.5);
        
        return { character, score: maxScore };
      });
      
      // 过滤掉分数太低的结果并按分数排序
      result = scoredCharacters
        .filter(item => item.score > 10) // 最低分数阈值
        .sort((a, b) => b.score - a.score)
        .map(item => item.character);
    }
    
    return result;
  }, [currentCategory, debouncedSearchQuery, allCharacters, fuzzyMatch]);

  return (
    <ChatLayout>
      <div className="min-h-screen flex flex-col">
        {/* 头部 */}
        <header className="border-b border-border bg-background/95 backdrop-blur flex-shrink-0">
          <div className="px-6 py-3">
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">AI 角色扮演聊天</h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                与历史人物、文学角色进行智能语音对话，体验沉浸式角色扮演
              </p>
            </div>
          </div>
        </header>

        {/* 主要内容 */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-6 py-8">
            <div className="space-y-8">
              {/* 搜索和筛选 */}
              <CharacterSearch
                onSearch={setSearchQuery}
                onCategoryFilter={setCurrentCategory}
                categories={allCategories}
                currentCategory={currentCategory}
                isSearching={searchQuery !== debouncedSearchQuery}
              />

              {/* 角色网格 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredCharacters.map((character) => (
                  <CharacterCard key={character.id} character={character} />
                ))}
              </div>

              {/* 无结果提示 */}
              {filteredCharacters.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🔍</div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    {debouncedSearchQuery ? `未找到与 "${debouncedSearchQuery}" 匹配的角色` : '未找到匹配的角色'}
                  </h3>
                  <p className="text-muted-foreground">
                    {debouncedSearchQuery 
                      ? '尝试使用其他关键词，如角色名称、技能或标签'
                      : '尝试使用其他关键词或选择不同的分类'
                    }
                  </p>
                  {debouncedSearchQuery && (
                    <div className="mt-4">
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="text-primary hover:text-primary/80 text-sm underline"
                      >
                        清除搜索条件
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* 页脚 */}
        <footer className="border-t border-border flex-shrink-0">
          <div className="px-6 py-8">
            <div className="text-center text-muted-foreground">
              <p>&copy; 2025 AI 角色扮演聊天平台. 探索无限可能的对话体验.</p>
            </div>
          </div>
        </footer>
      </div>
    </ChatLayout>
  );
}
