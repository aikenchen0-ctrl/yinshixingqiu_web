const http = require('http');
const https = require('https');

const API_CONFIG = {
  baseUrl: 'https://api.siliconflow.cn/v1',
  apiKey: 'sk-zworlcojkbhmkpwfwcglmagfleloggisvlcabbjdbkuohlhy',
  model: 'deepseek-ai/DeepSeek-V3'
};

async function postJson(url, payload, apiKey) {
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(url);
    const body = JSON.stringify(payload);
    const isHttps = requestUrl.protocol === 'https:';
    const requestLib = isHttps ? https : http;

    const req = requestLib.request(
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
          
          let data = null;
          try {
            data = JSON.parse(responseBody);
          } catch (error) {
            console.log('响应内容:', responseBody.substring(0, 500));
            reject(new Error('API返回了无法解析的内容'));
            return;
          }

          if (response.statusCode < 200 || response.statusCode >= 300) {
            const message =
              (data && data.error && (data.error.message || data.error.code)) ||
              `API请求失败，状态码 ${response.statusCode}`;
            console.log('错误信息:', message);
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

async function testSiliconFlow() {
  console.log('\n 测试硅基流动 API');
  console.log('='.repeat(60));
  console.log(`API地址: ${API_CONFIG.baseUrl}`);
  console.log(`模型: ${API_CONFIG.model}\n`);
  
  try {
    const payload = {
      model: API_CONFIG.model,
      messages: [
        {
          role: 'user',
          content: '你好，请用一句话介绍一下你自己。'
        }
      ],
      temperature: 0.5,
      max_tokens: 200
    };

    console.log('📤 发送请求...');
    const result = await postJson(
      `${API_CONFIG.baseUrl}/chat/completions`,
      payload,
      API_CONFIG.apiKey
    );

    const content = result.choices?.[0]?.message?.content || '';
    if (content) {
      console.log('\n✅ 成功! AI回复:');
      console.log('-'.repeat(60));
      console.log(content);
      console.log('-'.repeat(60));
    } else {
      console.log('\n⚠️ 返回空内容');
      console.log('完整响应:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.log('\n❌ 失败:', error.message);
  }
}

testSiliconFlow().catch(console.error);
