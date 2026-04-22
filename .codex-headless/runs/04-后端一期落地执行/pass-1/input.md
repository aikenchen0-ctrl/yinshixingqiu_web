# Codex Headless Run Context

Current step: 04-后端一期落地执行
Current pass: 1
Project root: D:\CodeDevelopment\xueyinMiniapp

## Execution Rules

- You are running in headless mode.
- Work directly in the repository instead of only giving advice.
- Focus on finishing the current prompt requirement.
- At the end of this pass, provide a clear completion status and quality score.
- If earlier passes already completed part of the work, continue from there instead of starting over.

## Previous Prompt Summary

# 03-后端一期开发计划 Summary

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

# Prompt 04: 后端一期落地执行

你现在进入编码执行阶段，但只处理 `backend`，并且必须严格参考 03 号提示词的后端一期开发计划。

## 目标

把后端第一轮缺失能力补到“可联调、可验证、可继续扩展”的状态。

## 编码约束

- 优先沿用已有目录结构
- 优先复用现有 service / Prisma 模式
- 不要为了完美重构整个后端
- 每做完一组能力就立刻验证
- 不要顺手扩范围

## 执行步骤

1. 先根据 03 号计划列出本轮要改的文件清单。
2. 按阶段顺序执行，不允许跳步。
3. 每完成一个阶段，就做以下检查：
   - 路由是否接入
   - service 是否可调用
   - Prisma 查询/更新是否闭环
   - 错误分支是否可返回明确提示
4. 如遇现有代码与计划冲突，优先保留已有稳定逻辑，再做增量补齐。
5. 完成后生成一份“后端变更清单”和“接口验收清单”。
你可以使用SKILL\MCP尝试跑通或获取数据测试
## 输出要求

最终输出必须包含：

1. 本轮改了哪些后端能力
2. 改了哪些文件
3. 每个能力如何验证
4. 还剩哪些后端缺口没做
5. 给 05 号提示词的接口可用清单

## 验收重点

- admin-web 需要的数据接口是否可用
- 小程序核心闭环需要的接口是否可用
- 是否仍然存在大量静态占位返回


## Required Footer

Append the following machine-readable footer at the end of your final response:

FINAL_STATUS: COMPLETE | PARTIAL | BLOCKED
QUALITY_SCORE: 1-5
NEXT_ACTIONS:
- ...
CHANGED_FILES:
- ...
