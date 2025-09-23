import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SessionSummary, Character } from '@/types';
import { SessionStorageService } from '@/services/session-storage';
import { 
  MessageSquare, 
  Plus, 
  Edit2, 
  Trash2, 
  Home,
  PanelRightClose,
  PanelRightOpen,
  History,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

// 快速响应的 Tooltip 组件
const QuickTooltip: React.FC<{ content: string; children: React.ReactNode }> = ({ content, children }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative flex-1 min-w-0"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className="absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg -top-8 left-0 whitespace-nowrap pointer-events-none">
          {content}
          <div className="absolute top-full left-2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

interface SidebarProps {
  currentCharacter?: Character;
  currentSessionId?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentCharacter,
  currentSessionId,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    loadSessions();
  }, [currentCharacter]);

  const loadSessions = () => {
    const allSessions = SessionStorageService.getSessionSummaries();
    const filteredSessions = currentCharacter 
      ? allSessions.filter(session => session.characterId === currentCharacter.id)
      : allSessions;
    setSessions(filteredSessions.slice(0, 20)); // 显示最近20个会话
  };

  const handleCreateNewSession = () => {
    if (currentCharacter) {
      const newSession = SessionStorageService.createSession(currentCharacter.id);
      router.push(`/chat/${currentCharacter.id}?session=${newSession.id}`);
      loadSessions();
    }
  };

  const handleSelectSession = (sessionId: string) => {
    const session = SessionStorageService.getSession(sessionId);
    if (session) {
      router.push(`/chat/${session.characterId}?session=${sessionId}`);
    }
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const session = sessions.find(s => s.id === sessionId);
    const sessionTitle = session?.title || '这个会话';
    
    if (confirm(`确定要删除会话"${sessionTitle}"吗？\n\n此操作无法撤销，会话中的所有消息都将被永久删除。`)) {
      try {
        SessionStorageService.deleteSession(sessionId);
        loadSessions();
        
        // 如果删除的是当前会话，跳转到角色页面
        if (sessionId === currentSessionId && currentCharacter) {
          router.push(`/chat/${currentCharacter.id}`);
        }
        
  // 显示成功提示（可选）
  logger.debug(`会话"${sessionTitle}"已删除`);
      } catch (error) {
        console.error('删除会话失败:', error);
        alert('删除失败，请重试');
      }
    }
  };

  const handleRenameSession = (sessionId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(sessionId);
    setEditTitle(currentTitle);
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

  if (isCollapsed) {
    return (
      <div className="w-16 h-full bg-background border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="w-8 h-8"
          >
            <PanelRightClose className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex-1 flex flex-col items-center py-4 space-y-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              router.push('/');
            }}
            className={cn("w-8 h-8", pathname === '/' && "bg-muted")}
            title="首页"
          >
            <Home className="w-4 h-4" />
          </Button>
          
          {currentCharacter && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleCreateNewSession();
              }}
              className="w-8 h-8"
              title="新对话"
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              router.push('/sessions');
            }}
            className={cn("w-8 h-8", pathname === '/sessions' && "bg-muted")}
            title="全部会话"
          >
            <History className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              router.push('/characters');
            }}
            className={cn("w-8 h-8", pathname === '/characters' && "bg-muted")}
            title="角色管理"
          >
            <Users className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 h-full bg-background border-r border-border flex flex-col">
      {/* 头部 */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {currentCharacter ? `${currentCharacter.name}` : 'AI 角色聊天'}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="w-8 h-8"
          >
            <PanelRightOpen className="w-4 h-4" />
          </Button>
        </div>

        {/* 导航按钮 */}
        <div className="space-y-2">
          <Button
            variant={pathname === '/' ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => router.push('/')}
          >
            <Home className="w-4 h-4 mr-2" />
            首页
          </Button>
          
          {currentCharacter && (
            <Button
              variant="default"
              className="w-full justify-start"
              onClick={handleCreateNewSession}
            >
              <Plus className="w-4 h-4 mr-2" />
              新对话
            </Button>
          )}
          
          <Button
            variant={pathname === '/sessions' ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => router.push('/sessions')}
          >
            <History className="w-4 h-4 mr-2" />
            全部会话
          </Button>
          
          <Button
            variant={pathname === '/characters' ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => router.push('/characters')}
          >
            <Users className="w-4 h-4 mr-2" />
            角色管理
          </Button>
        </div>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {currentCharacter && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2 px-2">
                当前角色的对话
              </h3>
            </div>
          )}
          
          <div className="space-y-1">
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">还没有对话记录</p>
                {currentCharacter && (
                  <p className="text-xs mt-1">点击"新对话"开始聊天</p>
                )}
              </div>
            ) : (
              sessions.map((session) => (
                <Card
                  key={session.id}
                  className={cn(
                    "group p-3 cursor-pointer transition-all hover:bg-muted/50 border-0 bg-muted/20",
                    currentSessionId === session.id && "bg-muted border-l-2 border-l-primary"
                  )}
                  onClick={() => handleSelectSession(session.id)}
                >
                  <div className="space-y-2">
                    {editingId === session.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full px-2 py-1 text-sm border rounded"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRename();
                            if (e.key === 'Escape') cancelRename();
                          }}
                          autoFocus
                        />
                        <div className="flex gap-1">
                          <Button size="sm" variant="default" onClick={saveRename} className="h-6 px-2 text-xs">
                            保存
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelRename} className="h-6 px-2 text-xs">
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between group">
                          <QuickTooltip content={session.title}>
                            <h4 className="text-sm font-medium truncate">
                              {session.title}
                            </h4>
                          </QuickTooltip>
                          <div className="flex items-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity sm:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-md"
                              onClick={(e) => handleRenameSession(session.id, session.title, e)}
                              title="重命名会话"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 text-red-500 hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-600 dark:hover:text-red-400 rounded-md ml-1"
                              onClick={(e) => handleDeleteSession(session.id, e)}
                              title="删除会话"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};