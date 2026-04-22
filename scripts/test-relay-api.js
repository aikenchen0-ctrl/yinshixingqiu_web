const http = require('http');

const API_CONFIG = {
  baseUrl: 'http://120.27.159.152:6543/v1',
  apiKey: 'sk-he8WvGY8Rovo8LYst5zJg82xC1agqvPL9bhJUcE1ILzZZL68',
  model: 'claude-sonnet-4-6'
};

async function postJson(url, payload, apiKey) {
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(url);
    const body = JSON.stringify(payload);

    const req = http.request(
      {
        hostname: requestUrl.hostname,
        port: requestUrl.port,
        path: `${requestUrl.pathname}${requestUrl.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Authorization: `Bearer ${apiKey}`,
        },
      },
      (response) => {
        let responseBody = '';

        response.on('data', (chunk) => {
          responseBody += chunk;
        });

        response.on('end', () => {
          console.log('\n=== 响应状态码:', response.statusCode, '===');
          console.log('=== 响应内容 ===');
          console.log(responseBody);
          console.log('================\n');

          let data = null;
          try {
            data = JSON.parse(responseBody);
          } catch (error) {
            reject(new Error('API返回了无法解析的内容'));
            return;
          }

          if (response.statusCode < 200 || response.statusCode >= 300) {
            const message =
              (data && data.error && (data.error.message || data.error.code)) ||
              `API请求失败，状态码 ${response.statusCode}`;
            reject(new Error(message));
            return;
          }

          resolve(data);
        });
      }
    );

    req.on('error', (error) => {
      console.error('请求错误:', error);
      reject(error);
    });

    req.write(body);
    req.end();
  });
}

async function testOpenAIFormat() {
  console.log('\n🧪 测试1: OpenAI 兼容格式 (/chat/completions)');
  console.log('='.repeat(60));
  
  const models = [
    'claude-sonnet-4-6',
    'claude-opus-4-6',
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-3.5-turbo'
  ];
  
  for (const model of models) {
    console.log(`\n  尝试模型: ${model}`);
    
    try {
      const payload = {
        model: model,
        messages: [
          {
            role: 'user',
            content: '你好，请用一句话介绍一下你自己。'
          }
        ],
        temperature: 0.5,
        max_tokens: 200
      };

      const result = await postJson(
        `${API_CONFIG.baseUrl}/chat/completions`,
        payload,
        API_CONFIG.apiKey
      );

      const content = result.choices?.[0]?.message?.content || '';
      if (content) {
        console.log(`  ✅ 成功! 回复: ${content.substring(0, 100)}`);
        return model; // 返回成功的模型
      } else {
        console.log(`  ⚠️ 返回空内容`);
      }
    } catch (error) {
      console.log(`  ❌ 失败: ${error.message}`);
    }
  }
  
  return null;
}

async function testAnthropicFormat() {
  console.log('\n🧪 测试2: Anthropic/Claude 格式 (/messages)');
  console.log('='.repeat(60));
  
  const models = [
    'claude-sonnet-4-6',
    'claude-opus-4-6'
  ];
  
  for (const model of models) {
    console.log(`\n  尝试模型: ${model}`);
    
    try {
      const payload = {
        model: model,
        messages: [
          {
            role: 'user',
            content: '你好，请用一句话介绍一下你自己。'
          }
        ],
        max_tokens: 200
      };

      const result = await postJson(
        `${API_CONFIG.baseUrl}/messages`,
        payload,
        API_CONFIG.apiKey
      );

      const content = result.content;
      if (content) {
        const text = Array.isArray(content) 
          ? content.map(c => c.text).join('')
          : content;
        if (text) {
          console.log(`  ✅ 成功! 回复: ${text.substring(0, 100)}`);
          return model;
        }
      }
      console.log(`  ⚠️ 返回空内容`);
    } catch (error) {
      console.log(`  ❌ 失败: ${error.message}`);
    }
  }
  
  return null;
}

async function testModelsEndpoint() {
  console.log('\n🧪 测试3: 获取可用模型列表 (/models)');
  console.log('='.repeat(60));
  
  try {
    const result = await new Promise((resolve, reject) => {
      const req = http.request(
        `${API_CONFIG.baseUrl}/models`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${API_CONFIG.apiKey}`,
          },
        },
        (response) => {
          let responseBody = '';
          response.on('data', (chunk) => {
            responseBody += chunk;
          });
          response.on('end', () => {
            resolve({ status: response.statusCode, data: responseBody });
          });
        }
      );
      req.on('error', reject);
      req.end();
    });

    console.log(`状态码: ${result.status}`);
    try {
      const data = JSON.parse(result.data);
      console.log('✅ 成功! 可用模型:');
      if (data.data && Array.isArray(data.data)) {
        // 筛选包含 claude 和 sonnet 的模型
        const claudeModels = data.data.filter(model => 
          model.id.toLowerCase().includes('claude') && 
          model.id.toLowerCase().includes('sonnet')
        );
        
        console.log('\n找到 Claude Sonnet 相关模型:');
        claudeModels.forEach(model => {
          console.log(`  - ${model.id}`);
        });
        
        console.log('\n所有 Claude 模型 (前20个):');
        const allClaude = data.data.filter(model => 
          model.id.toLowerCase().includes('claude')
        ).slice(0, 20);
        allClaude.forEach(model => {
          console.log(`  - ${model.id}`);
        });
        
        console.log(`\n总计: ${data.data.length} 个模型，Claude系列: ${allClaude.length} 个`);
      }
    } catch (e) {
      console.log('❌ 解析失败,响应内容:', result.data.substring(0, 200));
    }
  } catch (error) {
    console.log('❌ 失败:', error.message);
  }
}

async function main() {
  console.log('\n🚀 开始测试中转站API...');
  console.log(`API地址: ${API_CONFIG.baseUrl}`);
  console.log(`API密钥: ${API_CONFIG.apiKey.substring(0, 12)}...`);
  console.log(`模型: ${API_CONFIG.model}`);
  
  await testModelsEndpoint();
  await testOpenAIFormat();
  await testAnthropicFormat();
  
  console.log('\n✨ 测试完成!');
}

main().catch(console.error);
