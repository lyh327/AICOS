'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChatLayout } from '@/components/ChatLayout';
import { CharacterForm } from '@/components/CharacterForm';
import { Character } from '@/types';
import { CharacterManager } from '@/services/character-manager';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Users, 
  Filter,
  Download,
  Upload,
  BarChart3
} from 'lucide-react';

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | undefined>();
  const [stats, setStats] = useState<any>({});

  useEffect(() => {
    loadCharacters();
    loadStats();
  }, []);

  const loadCharacters = () => {
    const customCharacters = CharacterManager.getCustomCharacters();
    setCharacters(customCharacters);
  };

  const loadStats = () => {
    const characterStats = CharacterManager.getCharacterStats();
    setStats(characterStats);
  };

  const filteredCharacters = characters.filter(character => {
    const matchesSearch = !searchQuery || 
      character.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      character.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      character.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = !selectedCategory || character.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(characters.map(char => char.category).filter(Boolean)));

  const handleCreateCharacter = () => {
    setEditingCharacter(undefined);
    setShowForm(true);
  };

  const handleEditCharacter = (character: Character) => {
    setEditingCharacter(character);
    setShowForm(true);
  };

  const handleDeleteCharacter = (character: Character) => {
    if (confirm(`确定要删除角色"${character.name}"吗？\n\n此操作无法撤销，与该角色的所有会话记录也将被清理。`)) {
      const success = CharacterManager.deleteCustomCharacter(character.id);
      if (success) {
        loadCharacters();
        loadStats();
      } else {
        alert('删除失败，请重试');
      }
    }
  };

  const handleSaveCharacter = (character: Character) => {
    setShowForm(false);
    setEditingCharacter(undefined);
    loadCharacters();
    loadStats();
  };

  const handleExportCharacters = () => {
    try {
      const data = JSON.stringify(characters, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `custom-characters-${new Date().toISOString().split('T')[0]}.json`;
      
      // 安全的DOM操作：确保元素存在且是body的子元素
      document.body.appendChild(link);
      link.click();
      
      // 使用setTimeout确保click事件完成后再移除
      setTimeout(() => {
        try {
          if (link.parentNode === document.body) {
            document.body.removeChild(link);
          }
          URL.revokeObjectURL(url);
        } catch (error) {
          console.warn('Failed to clean up download link:', error);
        }
      }, 100);
    } catch (error) {
      console.error('Export failed:', error);
      alert('导出失败，请重试');
    }
  };

  const handleImportCharacters = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = e.target?.result as string;
            const importedCharacters = JSON.parse(data);
            
            if (Array.isArray(importedCharacters)) {
              importedCharacters.forEach((char: any) => {
                if (char.name && char.description) {
                  CharacterManager.saveCustomCharacter({
                    name: char.name,
                    description: char.description,
                    personality: char.personality || '',
                    background: char.background || '',
                    category: char.category || '导入角色',
                    image: char.image || '',
                    avatar: char.avatar || '🎭',
                    skills: char.skills || char.tags || [],
                    language: char.language || 'zh',
                    tags: char.tags || [],
                    prompt: char.prompt || ''
                  });
                }
              });
              
              loadCharacters();
              loadStats();
              alert(`成功导入 ${importedCharacters.length} 个角色！`);
            } else {
              alert('导入失败：文件格式不正确');
            }
          } catch (error) {
            console.error('Import failed:', error);
            alert('导入失败：文件格式不正确');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <ChatLayout>
      <div className="flex-1 flex flex-col">
        {/* 头部 */}
        <header className="border-b border-border bg-background/95 backdrop-blur">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Users className="w-6 h-6" />
                  角色管理
                </h1>
                <p className="text-sm text-muted-foreground">
                  创建和管理您的自定义AI角色
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCharacters}>
                  <Download className="w-4 h-4 mr-2" />
                  导出
                </Button>
                <Button variant="outline" size="sm" onClick={handleImportCharacters}>
                  <Upload className="w-4 h-4 mr-2" />
                  导入
                </Button>
                <Button onClick={handleCreateCharacter}>
                  <Plus className="w-4 h-4 mr-2" />
                  创建角色
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* 主要内容 */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-6 py-6">
            {/* 统计信息 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">总角色数</p>
                      <p className="text-2xl font-bold">{stats.total || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Edit className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">自创角色</p>
                      <p className="text-2xl font-bold">{stats.userCreated || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Download className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">导入角色</p>
                      <p className="text-2xl font-bold">{stats.apiImported || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">分类数</p>
                      <p className="text-2xl font-bold">{categories.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 搜索和筛选 */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索角色名称、描述或标签..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-background"
                >
                  <option value="">所有分类</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 角色列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCharacters.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">
                    {characters.length === 0 ? '还没有自定义角色' : '没有找到匹配的角色'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {characters.length === 0 
                      ? '创建您的第一个自定义角色，让AI聊天更有趣'
                      : '尝试调整搜索条件或创建新角色'
                    }
                  </p>
                  <Button onClick={handleCreateCharacter}>
                    <Plus className="w-4 h-4 mr-2" />
                    创建角色
                  </Button>
                </div>
              ) : (
                filteredCharacters.map((character) => (
                  <Card key={character.id} className="group hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="text-3xl">{character.avatar}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-medium truncate">{character.name}</h3>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8"
                                onClick={() => handleEditCharacter(character)}
                                title="编辑角色"
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 text-red-500 hover:text-red-600"
                                onClick={() => handleDeleteCharacter(character)}
                                title="删除角色"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {character.description}
                          </p>
                          
                          <div className="flex flex-wrap gap-1 mb-2">
                            <Badge variant="secondary" className="text-xs">
                              {character.category}
                            </Badge>
                            {character.source && (
                              <Badge variant="outline" className="text-xs">
                                {character.source === 'user-created' ? '自创' : '导入'}
                              </Badge>
                            )}
                          </div>
                          
                          {character.tags && character.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {character.tags.slice(0, 3).map((tag, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {character.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{character.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </main>
      </div>

      {/* 角色表单弹窗 */}
      {showForm && (
        <CharacterForm
          character={editingCharacter}
          onSave={handleSaveCharacter}
          onCancel={() => {
            setShowForm(false);
            setEditingCharacter(undefined);
          }}
          isOpen={showForm}
        />
      )}
    </ChatLayout>
  );
}