import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SessionSummary } from '@/types';
import { SessionStorageService } from '@/services/session-storage';
import { MessageCircle, Calendar, Trash2, Edit2, Plus, User } from 'lucide-react';

interface SessionManagerProps {
  characterId?: string;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: (characterId: string) => void;
  currentSessionId?: string;
}

export const SessionManager: React.FC<SessionManagerProps> = ({
  characterId,
  onSelectSession,
  onCreateSession,
  currentSessionId
}) => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    loadSessions();
  }, [characterId]);

  const loadSessions = () => {
    const allSessions = SessionStorageService.getSessionSummaries();
    const filteredSessions = characterId 
      ? allSessions.filter(session => session.characterId === characterId)
      : allSessions;
    setSessions(filteredSessions);
  };

  const handleDeleteSession = (sessionId: string) => {
    if (confirm('确定要删除这个会话吗？此操作无法撤销。')) {
      SessionStorageService.deleteSession(sessionId);
      loadSessions();
    }
  };

  const handleRenameSession = (sessionId: string, title: string) => {
    setEditingId(sessionId);
    setEditTitle(title);
  };

  const saveRename = () => {
    if (editingId && editTitle.trim()) {
      SessionStorageService.renameSession(editingId, editTitle.trim());
      setEditingId(null);
      setEditTitle('');
      loadSessions();
    }
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffDays === 1) {
      return '昨天';
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* 头部操作栏 */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          {characterId ? '角色会话' : '所有会话'}
        </h2>
        {characterId && (
          <Button
            onClick={() => onCreateSession(characterId)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新建会话
          </Button>
        )}
      </div>

      {/* 会话列表 */}
      <div className="grid gap-4">
        {sessions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageCircle className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">还没有会话记录</h3>
              <p className="text-muted-foreground text-center mb-4">
                {characterId 
                  ? '与这个角色开始您的第一次对话吧！' 
                  : '选择一个角色开始聊天，创建您的第一个会话。'
                }
              </p>
              {characterId && (
                <Button onClick={() => onCreateSession(characterId)}>
                  开始对话
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          sessions.map((session) => (
            <Card 
              key={session.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                currentSessionId === session.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => onSelectSession(session.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      {editingId === session.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="flex-1 px-2 py-1 border rounded text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveRename();
                              if (e.key === 'Escape') cancelRename();
                            }}
                            autoFocus
                          />
                          <Button size="sm" onClick={saveRename}>
                            保存
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelRename}>
                            取消
                          </Button>
                        </div>
                      ) : (
                        <CardTitle className="text-base truncate">
                          {session.title}
                        </CardTitle>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {session.characterName}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {session.messageCount} 条消息
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(session.lastActiveAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRenameSession(session.id, session.title);
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(session.id);
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              {session.lastMessage && (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground truncate">
                    {session.lastMessage}
                  </p>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      {/* 存储信息 */}
      <div className="text-xs text-muted-foreground text-center">
        已保存 {sessions.length} 个会话
      </div>
    </div>
  );
};