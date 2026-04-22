# Codex Headless Run Context

Current step: 07-小程序现状盘点与联调前检查
Current pass: 3
Project root: D:\CodeDevelopment\xueyinMiniapp

## Execution Rules

- You are running in headless mode.
- Work directly in the repository instead of only giving advice.
- Focus on finishing the current prompt requirement.
- At the end of this pass, provide a clear completion status and quality score.
- If earlier passes already completed part of the work, continue from there instead of starting over.

## Previous Prompt Summary

# 06-admin-web一期开发提示词 Summary

Source pass: pass-4

DRY RUN

FINAL_STATUS: PARTIAL
QUALITY_SCORE: 1
NEXT_ACTIONS:
- Run the script without -DryRun to invoke Codex.
CHANGED_FILES:
- None

## Current Prompt Previous Pass Outputs

## pass-1

DRY RUN

FINAL_STATUS: PARTIAL
QUALITY_SCORE: 1
NEXT_ACTIONS:
- Run the script without -DryRun to invoke Codex.
CHANGED_FILES:
- None


## pass-2

DRY RUN

FINAL_STATUS: PARTIAL
QUALITY_SCORE: 1
NEXT_ACTIONS:
- Run the script without -DryRun to invoke Codex.
CHANGED_FILES:
- None


## pass-3

DRY RUN

FINAL_STATUS: PARTIAL
QUALITY_SCORE: 1
NEXT_ACTIONS:
- Run the script without -DryRun to invoke Codex.
CHANGED_FILES:
- None


## pass-4

DRY RUN

FINAL_STATUS: PARTIAL
QUALITY_SCORE: 1
NEXT_ACTIONS:
- Run the script without -DryRun to invoke Codex.
CHANGED_FILES:
- None

## Current Prompt Body

# Prompt 07: 小程序现状盘点与联调前检查

现在前面已经先做了后端和 admin-web，这一轮开始处理 `miniprogram`，但先做盘点和联调前检查。

## 目标

判断小程序哪些页面和能力已经具备接入条件，哪些地方会在联调时卡住，并输出一份小程序第一轮优先级。

## 小程序硬约束

- 只能使用原生微信小程序能力
- 不得使用 HTML 标签
- 网络请求必须是 `wx.request`
- 数据更新必须用 `this.setData()`
- 路由必须遵守小程序规则

## 执行步骤

1. 盘点 `pages` 和 `utils`。
2. 判断以下能力当前状态：
   - 登录
   - 星球列表
   - 星球首页
   - 发帖
   - 评论
   - 点赞
   - 创建星球
   - 我的星球
3. 确认 `utils/request.ts` 与 `utils/planet-api.ts` 是否足以支撑第一轮联调。
4. 识别页面中哪些仍依赖本地缓存或假数据。
5. 识别哪些页面路由、接口参数、状态流可能与后端不一致。
6. 输出“小程序第一轮要补的顺序”。
你可以使用SKILL\MCP尝试跑通或获取数据测试
## 输出要求

输出标题为“小程序现状盘点与联调前检查”的 Markdown 文档。

必须包含：

1. 页面清单
2. 已联调能力
3. 半联调能力
4. 未联调能力
5. 关键风险点
6. 给 08 号提示词的执行摘要


## Required Footer

Append the following machine-readable footer at the end of your final response:

FINAL_STATUS: COMPLETE | PARTIAL | BLOCKED
QUALITY_SCORE: 1-5
NEXT_ACTIONS:
- ...
CHANGED_FILES:
- ...
