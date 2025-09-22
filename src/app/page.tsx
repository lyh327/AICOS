'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { characters, categories, getCharactersByCategory } from '@/data/characters';
import { CharacterCard } from '@/components/CharacterCard';
import { CharacterSearch } from '@/components/CharacterSearch';
import { ChatLayout } from '@/components/ChatLayout';
import { Button } from '@/components/ui/button';
import { Character } from '@/types';
import { CharacterManager } from '@/services/character-manager';
import { History, MessageSquare, Plus, Users } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [currentCategory, setCurrentCategory] = useState('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [customCharacters, setCustomCharacters] = useState<Character[]>([]);

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

  const filteredCharacters = useMemo(() => {
    let result = currentCategory === '全部' 
      ? allCharacters 
      : allCharacters.filter(char => char.category === currentCategory);
    
    if (searchQuery.trim()) {
      result = result.filter(character =>
        character.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        character.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        character.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        character.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    return result;
  }, [currentCategory, searchQuery, allCharacters]);

  return (
    <ChatLayout>
      <div className="flex-1 flex flex-col">
        {/* 头部 */}
        <header className="border-b border-border bg-background/95 backdrop-blur">
          <div className="px-6 py-6">
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold tracking-tight">AI 角色扮演聊天</h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                与历史人物、文学角色进行智能语音对话，体验沉浸式角色扮演
              </p>
              
              {/* 快捷操作 */}
              <div className="flex justify-center gap-3 pt-2">
                <Button 
                  variant="outline"
                  onClick={() => router.push('/characters')}
                  className="gap-2"
                >
                  <Users className="w-4 h-4" />
                  角色管理
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => router.push('/sessions')}
                  className="gap-2"
                >
                  <History className="w-4 h-4" />
                  历史会话
                </Button>
              </div>
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
                  <h3 className="text-lg font-medium text-foreground mb-2">未找到匹配的角色</h3>
                  <p className="text-muted-foreground">尝试使用其他关键词或选择不同的分类</p>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* 页脚 */}
        <footer className="border-t border-border">
          <div className="px-6 py-8">
            <div className="text-center text-muted-foreground">
              <p>&copy; 2024 AI 角色扮演聊天平台. 探索无限可能的对话体验.</p>
            </div>
          </div>
        </footer>
      </div>
    </ChatLayout>
  );
}
