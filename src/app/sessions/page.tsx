'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChatLayout } from '@/components/ChatLayout';
import { SessionStorageService } from '@/services/session-storage';
import { SessionExportDialog } from '@/components/SessionExportDialog';
import { ArrowLeft, Download, Upload, Trash2 } from 'lucide-react';

export default function SessionHistoryPage() {
  const router = useRouter();
  const [storageInfo, setStorageInfo] = useState({ used: 0, total: 0, sessionCount: 0 });
  const [showExportDialog, setShowExportDialog] = useState(false);

  useEffect(() => {
    updateStorageInfo();
  }, []);

  const updateStorageInfo = () => {
    const info = SessionStorageService.getStorageInfo();
    setStorageInfo(info);
  };

  const handleExportSessions = () => {
    setShowExportDialog(true);
  };

  const handleImportSessions = () => {
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
            const success = SessionStorageService.importSessions(data);
            if (success) {
              alert('导入成功！');
              updateStorageInfo();
              window.location.reload(); // 刷新页面显示新数据
            } else {
              alert('导入失败，请检查文件格式');
            }
          } catch (error) {
            console.error('Import failed:', error);
            alert('导入失败，请检查文件格式');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleClearAllSessions = () => {
    if (confirm('确定要删除所有会话记录吗？此操作无法撤销！')) {
      SessionStorageService.clearAllSessions();
      updateStorageInfo();
      window.location.reload();
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <ChatLayout>
      <div className="flex-1 flex flex-col">
        {/* 头部 */}
        <header className="border-b border-border bg-background/95 backdrop-blur">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="md:hidden">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold">会话管理</h1>
                  <p className="text-sm text-muted-foreground">管理您的所有AI角色对话记录</p>
                </div>
              </div>
              
              {/* 工具栏 */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExportSessions}>
                  <Download className="w-4 h-4 mr-2" />
                  导出
                </Button>
                <Button variant="outline" size="sm" onClick={handleImportSessions}>
                  <Upload className="w-4 h-4 mr-2" />
                  导入
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleClearAllSessions}
                  disabled={storageInfo.sessionCount === 0}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  清空
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* 主要内容 */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-6 py-6">
            {/* 存储状态卡片 */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">存储信息</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {storageInfo.sessionCount}
                    </div>
                    <div className="text-sm text-muted-foreground">会话总数</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {formatBytes(storageInfo.used)}
                    </div>
                    <div className="text-sm text-muted-foreground">已使用存储</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-muted-foreground">
                      {formatBytes(storageInfo.total)}
                    </div>
                    <div className="text-sm text-muted-foreground">总存储空间</div>
                  </div>
                </div>
                
                {/* 存储使用进度条 */}
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-muted-foreground mb-1">
                    <span>存储使用率</span>
                    <span>{((storageInfo.used / storageInfo.total) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min((storageInfo.used / storageInfo.total) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                
                {storageInfo.used / storageInfo.total > 0.8 && (
                  <div className="mt-2 text-sm text-orange-600 dark:text-orange-400">
                    ⚠️ 存储空间即将用完，建议删除一些旧会话或导出备份
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 说明文字 */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">会话管理说明</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-primary font-semibold text-sm">1</span>
                    </div>
                    <div>
                      <h3 className="font-medium">侧边栏访问</h3>
                      <p className="text-sm text-muted-foreground">
                        您可以通过左侧边栏快速访问和切换所有会话，无需返回此页面
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-primary font-semibold text-sm">2</span>
                    </div>
                    <div>
                      <h3 className="font-medium">智能组织</h3>
                      <p className="text-sm text-muted-foreground">
                        会话按角色自动分组，系统自动生成智能标题，便于查找和管理
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-primary font-semibold text-sm">3</span>
                    </div>
                    <div>
                      <h3 className="font-medium">数据管理</h3>
                      <p className="text-sm text-muted-foreground">
                        支持导出和导入会话数据，方便备份和迁移您的对话记录
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 pt-4 border-t border-border">
                  <Button onClick={() => router.push('/')} className="w-full">
                    开始新对话
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* 会话导出对话框 */}
      <SessionExportDialog 
        open={showExportDialog} 
        onOpenChange={setShowExportDialog} 
      />
    </ChatLayout>
  );
}
