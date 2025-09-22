#!/usr/bin/env node

// 智谱GLM-4 API测试脚本
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const GLM_API_KEY = process.env.NEXT_PUBLIC_GLM_API_KEY;

async function testGLMAPI() {
  console.log('🧪 开始测试智谱GLM-4 API配置...\n');
  
  if (!GLM_API_KEY || GLM_API_KEY === 'your-glm-api-key-here') {
    console.error('❌ 错误: 请在 .env.local 文件中配置有效的 GLM API 密钥');
    console.error('📝 配置步骤:');
    console.error('   1. 访问 https://open.bigmodel.cn/ 注册账号');
    console.error('   2. 在控制台中创建API密钥');
    console.error('   3. 在 .env.local 文件中设置 NEXT_PUBLIC_GLM_API_KEY');
    process.exit(1);
  }

  console.log('🔑 API密钥:', GLM_API_KEY.substring(0, 10) + '...' + GLM_API_KEY.slice(-10));
  console.log('🌐 API地址:', GLM_API_URL);
  console.log('');

  try {
    const response = await axios.post(
      GLM_API_URL,
      {
        model: 'glm-4-flash',
        messages: [
          {
            role: 'user',
            content: '你好，请简单介绍一下你自己。'
          }
        ],
        temperature: 0.8,
        max_tokens: 100
      },
      {
        headers: {
          'Authorization': `Bearer ${GLM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30秒超时
      }
    );

    const content = response.data.choices?.[0]?.message?.content;
    
    if (content) {
      console.log('✅ API测试成功！');
      console.log('📤 发送消息: 你好，请简单介绍一下你自己。');
      console.log('📥 AI回复:', content);
      console.log('');
      console.log('🎉 智谱GLM-4 API配置正确，可以开始使用了！');
    } else {
      console.error('❌ API响应格式异常:', response.data);
    }
    
  } catch (error) {
    console.error('❌ API测试失败:');
    
    if (error.response) {
      console.error('📊 HTTP状态码:', error.response.status);
      console.error('📝 错误信息:', error.response.data);
      
      if (error.response.status === 401) {
        console.error('🔐 认证失败，请检查API密钥是否正确');
      } else if (error.response.status === 429) {
        console.error('⏰ 请求过于频繁，请稍后重试');
      } else if (error.response.status === 500) {
        console.error('🖥️ 服务器内部错误，请稍后重试');
      }
    } else if (error.request) {
      console.error('🌐 网络连接错误，请检查网络连接');
    } else {
      console.error('❌ 请求配置错误:', error.message);
    }
    
    console.error('\n🔧 故障排除建议:');
    console.error('   1. 检查API密钥是否正确');
    console.error('   2. 确认网络连接正常');
    console.error('   3. 检查智谱AI账户余额');
    console.error('   4. 访问 https://open.bigmodel.cn/ 查看API状态');
  }
}

testGLMAPI();