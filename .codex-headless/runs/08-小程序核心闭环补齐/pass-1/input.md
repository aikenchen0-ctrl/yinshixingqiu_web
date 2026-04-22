# Codex Headless Run Context

Current step: 08-小程序核心闭环补齐
Current pass: 1
Project root: D:\CodeDevelopment\xueyinMiniapp

## Execution Rules

- You are running in headless mode.
- Work directly in the repository instead of only giving advice.
- Focus on finishing the current prompt requirement.
- At the end of this pass, provide a clear completion status and quality score.
- If earlier passes already completed part of the work, continue from there instead of starting over.

## Previous Prompt Summary

# 07-小程序现状盘点与联调前检查 Summary

Source pass: pass-4

DRY RUN

FINAL_STATUS: PARTIAL
QUALITY_SCORE: 1
NEXT_ACTIONS:
- Run the script without -DryRun to invoke Codex.
CHANGED_FILES:
- None

## Current Prompt Previous Pass Outputs

None

## Current Prompt Body

# Prompt 08: 小程序核心闭环补齐

你现在开始补 `miniprogram` 的核心闭环，但只围绕第一轮范围做，不要发散。

## 目标

基于已有后端接口和前面几轮结论，把小程序补到“用户可以完成知识星球核心链路”的状态。

## 第一轮建议覆盖链路

1. 登录/登录态恢复
2. 星球发现
3. 查看星球主页
4. 加入星球
5. 浏览帖子
6. 发帖
7. 评论
8. 点赞
9. 查看我的星球/我的内容

## 编码约束

- 只能改小程序相关目录
- 必须使用小程序原生语法和原生 API
- 页面数据变更只能通过 `this.setData()`
- 优先复用已有 `utils` 和页面结构

## 执行步骤

1. 先列出本轮要补的页面与接口映射。
2. 先修正请求参数、登录态、路由不一致问题。
3. 再补关键页面的数据获取和展示。
4. 再补发帖、评论、点赞等交互。
5. 再补空态、错误态、加载态。
6. 每完成一条链路，就写清楚如何人工验证。
你可以使用SKILL\MCP尝试跑通或获取数据测试
## 输出要求

最终输出必须包含：

1. 本轮补齐了哪些页面与交互
2. 接入了哪些接口
3. 哪些链路已经闭环
4. 哪些链路仍有阻塞
5. 给 09 号提示词的联调验收输入


## Required Footer

Append the following machine-readable footer at the end of your final response:

FINAL_STATUS: COMPLETE | PARTIAL | BLOCKED
QUALITY_SCORE: 1-5
NEXT_ACTIONS:
- ...
CHANGED_FILES:
- ...
