# AI 角色扮演聊天 - 会话管理功能使用指南

## 🎉 新功能概述

我们为AI角色扮演聊天平台添加了完整的会话管理功能，让您可以：

- ✅ **保存对话历史** - 自动保存每次与AI角色的对话
- ✅ **多会话管理** - 与同一角色创建多个独立的对话
- ✅ **会话切换** - 在不同对话之间自由切换
- ✅ **智能标题** - 自动根据对话内容生成会话标题
- ✅ **数据导出/导入** - 备份和恢复您的对话记录

## 📱 功能使用指南

### 1. 开始新对话

注意：聊天页面默认不会自动创建新会话，除非用户主动发送消息或通过“新对话”按钮创建。

**方法一：从首页进入角色并手动开始**
1. 访问首页（顶部有“角色管理”和“历史会话”快捷按钮）。
2. 在角色列表中点击角色卡片进入聊天界面。
3. 若需要立即创建一个空白会话，可以在侧边栏点击“新对话”；否则系统不会自动创建，会话会在您首次发送消息时被创建（并包含欢迎消息）。

**方法二：在侧边栏创建（推荐）**
1. 在聊天界面打开侧边栏（左侧）。
2. 点击侧边栏中的“新对话”按钮（或顶部折叠模式下的图标）。
3. 系统立即创建新的会话并导航到该会话页面；同时会插入一条角色的欢迎消息。

### 2. 管理会话历史

**查看所有会话：**
- 在首页顶部点击“历史会话”按钮，进入会话历史页面（`/sessions`），可导出/导入/清空会话。
- 在侧边栏也有“全部会话”入口，可快速跳转到会话历史页面。

**查看角色会话：**
- 在聊天界面侧边栏会列出当前角色的最近会话（默认显示最近 20 个）。
- 点击任意会话卡片即可切换到该会话，URL 会更新为 `/chat/{characterId}?session={sessionId}`。

### 3. 会话操作

**重命名会话：**
1. 在侧边栏的会话条目上点击编辑图标 ✏️（或在会话历史页面中编辑）。
2. 输入新的会话标题，按回车或点击“保存”完成。

**删除会话：**
1. 在侧边栏或会话历史页面点击删除图标 🗑️。
2. 系统会弹出确认框；确认后会从 localStorage 中移除对应会话（无法撤销）。

**切换会话：**
- 在侧边栏点击任意会话卡片即可切换到该对话，页面 URL 会更新以包含会话 ID（例如 `/chat/harry-potter?session=session-...`）。

### 4. 数据管理

**导出对话记录：**
1. 访问"会话历史"页面
2. 点击"导出"按钮
3. 下载JSON格式的备份文件

**导入对话记录：**
1. 在"会话历史"页面点击"导入"
2. 选择之前导出的JSON文件
3. 系统自动恢复所有对话记录

**清空所有数据：**
- 在"会话历史"页面点击"清空"按钮
- 确认操作后删除所有会话记录

## 🔧 技术特性

### 智能存储管理
- **本地存储**：数据保存在浏览器localStorage中
- **自动清理**：最多保存50个会话，超出后自动删除最旧的
- **压缩优化**：高效的数据压缩和存储方案

### 智能会话标题
- **自动生成**：根据用户第一条消息智能生成标题
- **角色相关**：结合角色名称和对话内容
- **可编辑**：支持手动修改会话标题

### 数据持久化
- **断点续传**：刷新页面后继续之前的对话
- **跨设备同步**：通过导出/导入实现数据迁移
- **备份恢复**：支持完整的数据备份和恢复

## 📊 存储信息

### 存储容量
- **当前使用**：实时显示已用存储空间
- **总容量**：约5MB的本地存储空间
- **使用率**：可视化的存储使用进度条

### 存储提醒
- **80%警告**：使用超过80%时显示警告
- **清理建议**：提供删除旧会话的建议
- **优化提示**：导出备份释放空间的指导

## 🚀 使用场景

### 教育学习
- **分主题学习**：为不同学科创建独立会话
- **进度追踪**：查看学习历史和进展
- **知识回顾**：重新访问之前的学习对话

### 娱乐体验
- **角色扮演**：与不同角色开展多种剧情
- **故事延续**：继续之前未完成的故事情节
- **情境探索**：探索角色在不同情境下的反应

### 语言练习
- **话题练习**：针对不同话题进行专项练习
- **水平对比**：比较不同时期的语言水平
- **错误回顾**：查看和学习之前的表达方式

## 💡 使用技巧

### 最佳实践
1. **定期备份**：定期导出对话记录以防数据丢失
2. **合理命名**：给重要会话起有意义的标题
3. **及时清理**：删除不需要的旧会话释放空间
4. **分类管理**：为不同用途创建不同的会话

### 性能优化
- **限制会话长度**：超长对话可能影响性能
- **定期清理**：删除无用会话保持系统流畅
- **避免重复**：复用现有会话而不是频繁创建新会话

## 🔒 隐私安全

### 数据安全
- **本地存储**：所有数据保存在本地，不上传服务器
- **用户控制**：用户完全控制自己的对话数据
- **可删除性**：随时可以删除所有存储的数据

### 隐私保护
- **匿名化**：不收集用户个人身份信息
- **加密传输**：API调用使用HTTPS加密
- **数据最小化**：只存储对话相关的必要信息

## 🆘 常见问题

### Q: 会话数据会丢失吗？
A: 数据保存在浏览器本地存储中，除非清除浏览器数据或手动删除，否则会一直保留。建议定期导出备份。

### Q: 可以在不同设备间同步吗？
A: 目前通过导出/导入功能实现跨设备数据迁移。未来会考虑添加云端同步功能。

### Q: 会话太多会影响性能吗？
A: 系统限制最多50个会话，超出后自动删除最旧的。正常使用不会影响性能。

### Q: 如何恢复误删的会话？
A: 误删的会话无法恢复，建议删除前确认。重要对话请及时导出备份。

### Q: 存储空间不足怎么办？
A: 删除不需要的旧会话，或导出重要对话后清空存储空间。

---

## 🎯 总结

会话管理功能让AI角色扮演聊天变得更加实用和个性化。您现在可以：

- 📚 **建立学习档案** - 记录与不同角色的学习进程
- 🎭 **创造故事世界** - 与角色们演绎不同的故事情节
- 💭 **保存智慧对话** - 永久保存有价值的思想交流
- 📱 **随时随地继续** - 在任何时候继续之前的对话

立即体验这些强大的新功能，让您的AI对话更加丰富和有意义！

## 🛠 实现细节与文件映射（开发者参考）

下面为开发者列出本仓库中会话管理功能的关键实现位置、常量、API 和常用调试方法，便于二次开发与维护。

- 主要实现文件
  - `src/services/session-storage.ts` — 会话存储与智能标题的核心实现（localStorage 读写、导入/导出、智能标题生成、最大会话数限制等）。
  - `src/components/Sidebar.tsx` — 会话侧边栏，负责列出、选择、新建、重命名、删除会话并导航到对应聊天页面。
  - `src/components/SessionExportDialog.tsx` — 会话导出弹窗，支持多选导出为 JSON 文件。
  - `src/app/sessions/page.tsx` — 会话历史页面（导入/导出/清空/查看存储占用等 UI 入口）。
  - `src/components/ChatLayout.tsx` — 聊天页面布局，维护侧边栏折叠状态（保存到 localStorage）。
  - `src/types/index.ts` — 相关数据类型定义：`ChatSession`、`ChatMessage`、`SessionSummary` 等。

- 重要常量与 localStorage key
  - 会话数据 key：`ai-roleplay-sessions`（在 `SessionStorageService.STORAGE_KEY` 中定义）
  - 自定义角色列表 key：`custom_characters`（用于生成会话标题时读取角色名）
  - 侧边栏折叠状态 key：`sidebarCollapsed`（在 `ChatLayout` 中读写）
  - 最大会话数：`MAX_SESSIONS = 50`（超过则按最近活动时间删除最旧的会话）
  - 估算 localStorage 容量：5MB（在 `getStorageInfo` 中使用）

- 主要 API（方法）概览（都在 `SessionStorageService` 中）
  - getAllSessions(): ChatSession[] — 读取并解析所有会话（将时间字符串转为 Date）
  - getSessionsByCharacter(characterId: string): ChatSession[] — 返回某角色的会话列表（按 lastActiveAt 排序）
  - getSessionSummaries(): SessionSummary[] — 返回会话的摘要信息，用于列表展示
  - getSession(sessionId: string): ChatSession | null — 根据 id 获取会话
  - createSession(characterId: string, title?: string): ChatSession — 新建会话并保存
  - saveSession(session: ChatSession): void — 保存或更新会话（同时维护 lastActiveAt、裁剪超出数量）
  - addMessage(sessionId: string, message: ChatMessage): ChatSession | null — 向会话追加消息，并在第一条用户消息时生成更好的标题
  - deleteSession(sessionId: string): void — 删除指定会话
  - renameSession(sessionId: string, newTitle: string): void — 重命名会话
  - clearAllSessions(): void — 清空所有会话数据（移除 localStorage key）
  - exportSessions(): string — 导出所有会话的 JSON 字符串
  - importSessions(data: string): boolean — 从 JSON 导入会话数据（会覆盖当前 key）
  - getStorageInfo(): { used:number; total:number; sessionCount:number } — 获取已用字节、总容量估算与会话数量
  - generateSmartSessionTitle(sessionId: string): string | null — 根据对话内容分析并生成智能标题（实体/动作/主题分析、降级策略）
  - updateSessionTitle(sessionId: string): void — 在默认标题时尝试用智能标题更新（不覆盖已自定义标题）

- 主要数据结构（位于 `src/types/index.ts`）
  - ChatMessage: { id, type: 'user'|'character', content, timestamp: Date, ... }
  - ChatSession: { id, characterId, title, messages: ChatMessage[], createdAt: Date, lastActiveAt: Date, isActive?: boolean }
  - SessionSummary: 列表展示使用的摘要结构（id, characterId, characterName, title, lastMessage, messageCount, createdAt, lastActiveAt）

- 常见调试 / 快速查看方法（在浏览器控制台执行）
  - 查看所有会话：
    - SessionStorageService.getAllSessions()
  - 导出 JSON（字符串）：
    - SessionStorageService.exportSessions()
  - 导入会话（将会覆盖当前数据）：
    - SessionStorageService.importSessions(jsonString)
  - 新建会话：
    - SessionStorageService.createSession('character-id')
  - 向会话添加消息（示例）：
    - SessionStorageService.addMessage('session-123', { id: 'm1', type: 'user', content: '你好', timestamp: new Date() })
  - 查看存储使用信息：
    - SessionStorageService.getStorageInfo()

- 注意事项与实现细节说明
  - 会话 JSON 存储中时间字段以 ISO 字符串形式保存，读取时会被转换为 Date 对象。
  - 导入操作会直接写入 `ai-roleplay-sessions` key（请在导入前备份），导入函数不做复杂的合并逻辑。
  - 智能标题生成采用关键词/实体抽取与主题匹配的多级降级方案，`generateSmartSessionTitle` 会在 `updateSessionTitle` 被调用时替换默认标题（但不会覆盖用户手动编辑后的标题）。
  - 为避免 localStorage 过大，保存时会根据 `MAX_SESSIONS` 裁剪最旧会话；如果需保存更长历史，建议导出备份到文件系统。

- 建议的后续改进（可选）
  - 添加增量导入（合并已有会话并去重）以提升导入安全性
  - 将会话备份迁移到云端（可选用户授权）以支持跨设备实时同步
  - 为大会话提供按需 lazy-loading（避免一次性加载全部消息导致内存占用过高）