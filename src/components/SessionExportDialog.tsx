'use client';

import { useState, useEffect } from 'react';
import { SessionStorageService } from '@/services/session-storage';
import { SessionSummary } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Calendar, MessageSquare, User, X } from 'lucide-react';

interface SessionExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SessionExportDialog({ open, onOpenChange }: SessionExportDialogProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (open) {
      const allSessions = SessionStorageService.getSessionSummaries();
      setSessions(allSessions);
      setSelectedSessions(new Set());
    }
  }, [open]);

  const handleSelectAll = () => {
    if (selectedSessions.size === sessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(sessions.map(s => s.id)));
    }
  };

  const handleSelectSession = (sessionId: string) => {
    const newSelected = new Set(selectedSessions);
    if (newSelected.has(sessionId)) {
      newSelected.delete(sessionId);
    } else {
      newSelected.add(sessionId);
    }
    setSelectedSessions(newSelected);
  };

  const handleExport = async () => {
    if (selectedSessions.size === 0) {
      alert('请至少选择一个会话进行导出');
      return;
    }

    setIsExporting(true);

    try {
      // 获取选中的会话详细数据
      const selectedSessionsData = Array.from(selectedSessions)
        .map(sessionId => SessionStorageService.getSession(sessionId))
        .filter(session => session !== null);

      // 准备导出数据
      const exportData = {
        exportTime: new Date().toISOString(),
        sessionCount: selectedSessionsData.length,
        sessions: selectedSessionsData
      };

      // 创建下载文件
      const data = JSON.stringify(exportData, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // 生成文件名
      const timestamp = new Date().toISOString().split('T')[0];
      const sessionCountText = selectedSessions.size === 1 ? 'session' : 'sessions';
      link.download = `ai-roleplay-${selectedSessions.size}-${sessionCountText}-${timestamp}.json`;
      
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

      // 关闭对话框
      onOpenChange(false);
      
    } catch (error) {
      console.error('Export failed:', error);
      alert('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Download className="w-5 h-5" />
              选择要导出的会话
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              选择您想要导出的对话会话。您可以选择单个会话或多个会话一起导出。
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="p-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-hidden p-6 space-y-4">
          {/* 全选/取消全选 */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="select-all"
                checked={selectedSessions.size === sessions.length && sessions.length > 0}
                onChange={handleSelectAll}
                className="rounded border-gray-300"
              />
              <label htmlFor="select-all" className="text-sm font-medium">
                全选 ({sessions.length} 个会话)
              </label>
            </div>
            <div className="text-sm text-muted-foreground">
              已选择: {selectedSessions.size} 个
            </div>
          </div>

          {/* 会话列表 */}
          <div className="max-h-[400px] overflow-y-auto space-y-2 p-2">
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无会话记录
              </div>
            ) : (
              sessions.map((session) => (
                <Card 
                  key={session.id} 
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedSessions.has(session.id) ? 'ring-2 ring-primary bg-primary/5' : ''
                  }`}
                  onClick={() => handleSelectSession(session.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedSessions.has(session.id)}
                        onChange={() => handleSelectSession(session.id)}
                        className="mt-1 rounded border-gray-300"
                      />
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <h4 className="font-medium text-sm line-clamp-2">
                            {session.title}
                          </h4>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                            <User className="w-3 h-3" />
                            {session.characterName}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {session.messageCount} 条消息
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(session.lastActiveAt)}
                          </div>
                        </div>
                        
                        {session.lastMessage && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {session.lastMessage}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-2 p-6 border-t border-border">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            取消
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={selectedSessions.size === 0 || isExporting}
            className="min-w-[100px]"
          >
            {isExporting ? '导出中...' : `导出 (${selectedSessions.size})`}
          </Button>
        </div>
      </div>
    </div>
  );
}