# AI 中转站配置文档

## 当前配置（硅基流动）

### API 配置信息

| 配置项 | 值 |
|--------|-----|
| API 地址 | `https://api.siliconflow.cn/v1` |
| API 密钥 | `sk-zworlcojkbhmkpwfwcglmagfleloggisvlcabbjdbkuohlhy` |
| 模型名称 | `deepseek-ai/DeepSeek-V3` |
| 请求端点 | `/chat/completions` |

### 测试结果

✅ **API 正常工作**，返回内容正常。

---

## 修改的文件

### 1. `backend/.env`

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/xueyin?schema=public"
WECHAT_APP_ID="wxe2d0484c74a647ef"
WECHAT_APP_SECRET="653dd10b04fbd063208298f77c7e60e8"
HOST="0.0.0.0"
PORT="3000"
OPENAI_API_KEY="sk-zworlcojkbhmkpwfwcglmagfleloggisvlcabbjdbkuohlhy"
OPENAI_BASE_URL="https://api.siliconflow.cn/v1"
OPENAI_MODEL="deepseek-ai/DeepSeek-V3"
```

### 2. `backend/src/services/llmService.js`

**修改内容：**
- 添加了对 `http://` 协议的支持（之前仅支持 `https`）
- 自动根据 URL 协议选择 `http` 或 `https` 模块

**修改代码：**

```javascript
const http = require("http");
const https = require("https");

function postJson(url, payload, apiKey) {
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(url);
    const body = JSON.stringify(payload || {});
    const isHttps = requestUrl.protocol === "https:";
    const requestLib = isHttps ? https : http;

    const req = requestLib.request(
      {
        hostname: requestUrl.hostname,
        port: requestUrl.port,
        path: `${requestUrl.pathname}${requestUrl.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Authorization: `Bearer ${apiKey}`,
        },
      },
      // ...
    );
  });
}
```

### 3. `backend/src/services/aiService.js`

**修改内容：**
- 在 System Prompt 中添加了"禁止使用 Markdown 格式"的要求
- 确保 AI 返回纯文本内容，适配小程序端展示

**System Prompt 示例：**

```javascript
{
  role: "system",
  content: "你是AI问血饮的中文助手。你的任务是基于给定知识库资料回答用户问题。重要：输出内容必须是纯文本，绝对不要使用任何Markdown格式！禁止使用**加粗**、*斜体*、#标题、-列表等任何Markdown语法。如果需要使用要点，直接用数字如1.、2.、3.即可。要求：1. 优先依据知识库，不要编造资料外事实；2. 语气自然，像真人分析，不要用固定模板标题；3. 可以做归纳，但要明确哪些判断来自资料；4. 如果资料不足，要直接说明不足；5. 回答控制在 3 到 6 段，避免太像报告。"
}
```

---

## 启动后端服务

```bash
cd backend
npm run dev
```

---

## 已废弃的配置

### 柴犬中转站（已废弃）

| 配置项 | 值 |
|--------|-----|
| API 地址 | `http://120.27.159.152:6543/v1` |
| API 密钥 | `sk-he8WvGY8Rovo8LYst5zJg82xC1agqvPL9bhJUcE1ILzZZL68` |
| 模型名称 | `claude-sonnet-4-6` |

**废弃原因：** 模型返回内容为空，需要在中转站后台配置 API 渠道。

---

## 注意事项

1. 硅基流动使用 **HTTPS** 协议，已测试通过
2. DeepSeek-V3 模型完全兼容 OpenAI API 格式
3. 小程序端不支持 Markdown 渲染，AI 返回内容已设置为纯文本格式
4. 如需更换模型，只需修改 `.env` 中的 `OPENAI_MODEL` 即可
5. 测试脚本位于 `scripts/test-siliconflow.js`，可随时测试 API 连通性

---

## 测试 API

```bash
# 测试硅基流动 API
node scripts/test-siliconflow.js
```

**预期输出：**

```
✅ 成功! AI回复:
------------------------------------------------------------
你好，我是DeepSeek Chat，由深度求索公司打造的AI助手，
擅长用中文和英文回答各种问题，随时为你提供高效、智能的帮助！
------------------------------------------------------------
```

---

## 硅基流动支持的模型

访问 https://siliconflow.cn 查看所有可用模型。常见模型包括：

- `deepseek-ai/DeepSeek-V3`（当前使用）
- `deepseek-ai/DeepSeek-V2.5`
- `Qwen/Qwen2.5-72B-Instruct`
- `THUDM/glm-4-9b-chat`
- `01-ai/Yi-1.5-34B-Chat`
