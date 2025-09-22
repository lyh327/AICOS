# 智谱GLM-4 API配置检查清单

## ✅ 配置步骤检查清单

### 1. 账号注册和认证
- [ ] 访问 https://open.bigmodel.cn/ 并注册账号
- [ ] 完成手机号验证
- [ ] 完成实名认证（使用API必需）
- [ ] 确认账户状态正常

### 2. API密钥获取
- [ ] 登录控制台
- [ ] 点击"API密钥"菜单
- [ ] 创建新的API密钥
- [ ] 复制并保存API密钥（格式：xxx.xxxxxxxxxxxxxxxx）
- [ ] 确认密钥状态为"启用"

### 3. 本地环境配置
- [ ] 复制 `.env.example` 为 `.env.local`
- [ ] 在 `.env.local` 中设置 `NEXT_PUBLIC_GLM_API_KEY`
- [ ] 确认 `.env.local` 已被 `.gitignore` 忽略
- [ ] 运行 `node test-glm-api.js` 测试API连接

### 4. 费用和限制检查
- [ ] 检查账户余额（新用户通常有免费额度）
- [ ] 了解GLM-4-Flash的计费规则（约 ¥0.1/1K tokens）
- [ ] 设置合理的API调用限制
- [ ] 确认API调用频率限制

### 5. 网络和安全
- [ ] 确认网络可以访问 open.bigmodel.cn
- [ ] 如在企业网络，确认防火墙允许HTTPS请求
- [ ] 不要在代码中硬编码API密钥
- [ ] 不要将 `.env.local` 提交到版本控制

## 🚨 常见问题排查

### API密钥错误
```
❌ 错误: 401 Unauthorized
🔧 解决: 检查API密钥是否正确，确认账户状态正常
```

### 余额不足
```
❌ 错误: 账户余额不足
🔧 解决: 充值账户或检查免费额度使用情况
```

### 网络连接问题
```
❌ 错误: Network Error / ECONNREFUSED
🔧 解决: 检查网络连接，确认可以访问智谱AI API
```

### 请求频率限制
```
❌ 错误: 429 Too Many Requests
🔧 解决: 降低请求频率，添加请求间隔
```

## 📞 技术支持

- 官方文档: https://open.bigmodel.cn/docs
- API文档: https://open.bigmodel.cn/docs/api
- 技术支持: 通过控制台提交工单
- 社区论坛: https://chatglm.cn/

## 💡 最佳实践

1. **API密钥管理**
   - 定期轮换API密钥
   - 为不同环境使用不同密钥
   - 监控API使用情况

2. **成本控制**
   - 设置每日/月度使用限额
   - 实现本地缓存减少重复请求
   - 优化prompt长度

3. **错误处理**
   - 实现重试机制
   - 提供降级方案（预设回复）
   - 记录和监控API错误

4. **性能优化**
   - 使用连接池
   - 实现请求队列
   - 适当设置超时时间