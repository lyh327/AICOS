'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Character, OnlineCharacter, OnlineCharacterResult } from '@/types';
import { CharacterManager } from '@/services/character-manager';
import { 
  Search, 
  Plus, 
  Save, 
  X, 
  Globe, 
  User, 
  Sparkles,
  Download,
  Loader2,
  Tag,
  ImageIcon
} from 'lucide-react';

interface CharacterFormProps {
  character?: Character;
  onSave?: (character: Character) => void;
  onCancel?: () => void;
  isOpen?: boolean;
}

export const CharacterForm: React.FC<CharacterFormProps> = ({
  character,
  onSave,
  onCancel,
  isOpen = true
}) => {
  const [formData, setFormData] = useState<Partial<Character>>({
    name: '',
    description: '',
    personality: '',
    background: '',
    category: '自定义角色',
    image: '',
    avatar: '🎭',
    skills: [],
    language: 'zh',
    tags: [],
    prompt: ''
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OnlineCharacterResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showOnlineSearch, setShowOnlineSearch] = useState(false);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (character) {
      setFormData(character);
    }
  }, [character]);

  const handleInputChange = (field: keyof Character, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!formData.name?.trim()) {
      alert('请输入角色名称');
      return;
    }

    const characterData: Omit<Character, 'id' | 'createdAt' | 'updatedAt'> = {
      name: formData.name,
      description: formData.description || '',
      personality: formData.personality || '',
      background: formData.background || '',
      category: formData.category || '自定义角色',
      image: formData.image || '',
      avatar: formData.avatar || '🎭',
      skills: formData.skills || [],
      language: formData.language || 'zh',
      isCustom: true,
      source: 'user-created',
      tags: formData.tags || [],
      prompt: formData.prompt || ''
    };

    let savedCharacter: Character;
    
    if (character && character.id) {
      // 更新现有角色
      savedCharacter = CharacterManager.updateCustomCharacter(character.id, characterData) || character;
    } else {
      // 创建新角色
      savedCharacter = CharacterManager.saveCustomCharacter(characterData);
    }

    onSave?.(savedCharacter);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // 根据关键词生成角色设定建议
      const suggestions = await CharacterManager.generateCharacterSuggestions(searchQuery);
      setSearchResults(suggestions);
    } catch (error) {
      console.error('Search failed:', error);
      alert('搜索失败，请重试');
    } finally {
      setIsSearching(false);
    }
  };

  const handleApplySuggestion = (suggestion: any) => {
    // 将建议应用到表单中
    setFormData(prev => ({
      ...prev,
      name: suggestion.name || prev.name,
      description: suggestion.description || prev.description,
      personality: suggestion.personality || prev.personality,
      background: suggestion.background || prev.background,
      category: suggestion.category || prev.category,
      avatar: suggestion.avatar || prev.avatar,
      tags: [...(prev.tags || []), ...(suggestion.tags || [])].filter((tag, index, arr) => arr.indexOf(tag) === index)
    }));
    setShowOnlineSearch(false);
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      const newTags = [...(formData.tags || []), tagInput.trim()];
      handleInputChange('tags', newTags);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = formData.tags?.filter(tag => tag !== tagToRemove) || [];
    handleInputChange('tags', newTags);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <h2 className="text-xl font-semibold">
            {character ? '编辑角色' : '创建新角色'}
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOnlineSearch(!showOnlineSearch)}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {showOnlineSearch ? '手动创建' : '智能建议'}
            </Button>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 主要内容区域 - 可滚动 */}
        <div className="flex-1 overflow-y-auto p-6">
            {showOnlineSearch ? (
              /* 智能建议界面 */
              <div className="space-y-6">
                <div className="flex gap-2">
                  <Input
                    placeholder="输入关键词获取角色设定建议（如：历史、科技、艺术等）..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch} disabled={isSearching}>
                    {isSearching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    智能建议
                  </Button>
                </div>

                <div className="space-y-4">
                  {searchResults.map((result, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Sparkles className="w-5 h-5" />
                          {result.source}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          基于"{searchQuery}"为您推荐以下角色设定模板
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 gap-4">
                          {result.suggestions?.map((suggestion: any, suggestionIndex: number) => (
                            <Card key={suggestionIndex} className="border-border">
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  <div className="text-2xl">{suggestion.avatar || '🎭'}</div>
                                  <div className="flex-1 min-w-0 space-y-2">
                                    <h4 className="font-medium">{suggestion.name}</h4>
                                    <p className="text-sm text-muted-foreground">
                                      {suggestion.description}
                                    </p>
                                    <div className="text-xs text-muted-foreground">
                                      <p><strong>性格:</strong> {suggestion.personality}</p>
                                      <p><strong>背景:</strong> {suggestion.background}</p>
                                    </div>
                                    {suggestion.tags && suggestion.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {suggestion.tags.map((tag: string, tagIndex: number) => (
                                          <Badge key={tagIndex} variant="secondary" className="text-xs">
                                            {tag}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => handleApplySuggestion(suggestion)}
                                  >
                                    <Download className="w-3 h-3 mr-1" />
                                    应用
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {searchResults.length === 0 && searchQuery && !isSearching && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>未能生成相关建议</p>
                      <p className="text-sm mt-1">尝试其他关键词或手动创建角色</p>
                    </div>
                  )}

                  {searchResults.length === 0 && !searchQuery && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>输入关键词获取智能建议</p>
                      <p className="text-sm mt-1">例如：历史、科技、艺术、商业等</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* 手动创建/编辑界面 */
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 基本信息 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="w-5 h-5" />
                        基本信息
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">角色名称 *</label>
                        <Input
                          placeholder="输入角色名称"
                          value={formData.name || ''}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">头像表情</label>
                        <Input
                          placeholder="🎭"
                          value={formData.avatar || ''}
                          onChange={(e) => handleInputChange('avatar', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">分类</label>
                        <Input
                          placeholder="角色分类"
                          value={formData.category || ''}
                          onChange={(e) => handleInputChange('category', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">语言偏好</label>
                        <select
                          className="w-full px-3 py-2 border rounded-md"
                          value={formData.language || 'zh'}
                          onChange={(e) => handleInputChange('language', e.target.value)}
                        >
                          <option value="zh">中文</option>
                          <option value="en">English</option>
                          <option value="both">双语</option>
                        </select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 角色设定 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        角色设定
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">角色描述</label>
                        <Textarea
                          placeholder="简要描述这个角色..."
                          value={formData.description || ''}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange('description', e.target.value)}
                          rows={3}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">性格特点</label>
                        <Textarea
                          placeholder="描述角色的性格特点..."
                          value={formData.personality || ''}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange('personality', e.target.value)}
                          rows={2}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">背景故事</label>
                        <Textarea
                          placeholder="角色的背景故事..."
                          value={formData.background || ''}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange('background', e.target.value)}
                          rows={3}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 标签管理 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Tag className="w-5 h-5" />
                      标签
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 mb-3">
                      <Input
                        placeholder="添加标签..."
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addTag()}
                      />
                      <Button onClick={addTag} size="sm">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {formData.tags?.map((tag, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => removeTag(tag)}
                        >
                          {tag}
                          <X className="w-3 h-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* 高级设置 */}
                <Card>
                  <CardHeader>
                    <CardTitle>高级设置</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">头像图片URL</label>
                      <Input
                        placeholder="https://example.com/avatar.jpg"
                        value={formData.image || ''}
                        onChange={(e) => handleInputChange('image', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">自定义系统提示</label>
                      <Textarea
                        placeholder="为这个角色定制特殊的系统提示..."
                        value={formData.prompt || ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange('prompt', e.target.value)}
                        rows={4}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
        </div>

        {/* 底部按钮 */}
        {!showOnlineSearch && (
          <div className="flex justify-end gap-2 p-6 border-t flex-shrink-0">
            <Button variant="outline" onClick={onCancel}>
              取消
            </Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              保存
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};