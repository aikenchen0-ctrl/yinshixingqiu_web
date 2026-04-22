# Codex Headless Run Context

Current step: 03-后端一期开发计划
Current pass: 2
Project root: D:\CodeDevelopment\xueyinMiniapp

## Execution Rules

- You are running in headless mode.
- Work directly in the repository instead of only giving advice.
- Focus on finishing the current prompt requirement.
- At the end of this pass, provide a clear completion status and quality score.
- If earlier passes already completed part of the work, continue from there instead of starting over.

## Previous Prompt Summary

# 02-后端现状审计与缺口清单 Summary

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

# Prompt 03: 后端一期开发计划

你现在承接 01 和 02 的结果，输出一份“后端先行”的一期开发计划。

这一步仍然先不要直接改代码，先把后端第一轮要补的内容规划成明确步骤，避免边做边漂移。

## 目标

围绕知识星球核心闭环，输出后端一期的最小可运行计划，让后面的 04 号提示词可以按步骤逐项落地。

## 计划原则

- 优先补闭环，不追求一次把 schema 所有能力都写完
- 优先补真实可被 admin-web 和小程序消费的接口
- 优先复用现有 Prisma 模型和 service 结构
- 优先补最短路径，而不是最理想的大而全架构

## 执行步骤

1. 回看 02 号提示词里的 P0/P1/P2 缺口。
2. 只选择“第一轮必须做”的后端任务。
3. 将任务拆成 4 到 8 个顺序阶段，每个阶段必须有：
   - 目标
   - 涉及文件
   - 输入
   - 输出
   - 验收标准
4. 对每个阶段再拆执行步骤，要求足够细，可以被直接照做。
5. 标注哪些阶段是 admin-web 前置依赖，哪些阶段是小程序前置依赖。
6. 明确哪些内容本轮暂不处理，避免范围失控。
你可以使用SKILL\MCP尝试跑通或获取数据测试
## 输出要求

输出标题为“后端一期开发计划”的 Markdown 文档。

文档必须包含：

1. 后端一期目标
2. 能力边界
3. 阶段计划
4. 每阶段详细步骤
5. 风险与回退点
6. 给 04 号提示词的执行清单

## 建议阶段示例

你可以参考类似顺序，但必须结合真实项目调整：

1. 登录态与身份统一
2. 星球内容与帖子接口补齐
3. 后台统计数据接口补齐
4. 运营能力最小集补齐
5. 联调与验收接口整理


## Required Footer

Append the following machine-readable footer at the end of your final response:

FINAL_STATUS: COMPLETE | PARTIAL | BLOCKED
QUALITY_SCORE: 1-5
NEXT_ACTIONS:
- ...
CHANGED_FILES:
- ...
