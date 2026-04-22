# Codex Headless Run Context

Current step: 06-admin-web一期开发提示词
Current pass: 4
Project root: D:\CodeDevelopment\xueyinMiniapp

## Execution Rules

- You are running in headless mode.
- Work directly in the repository instead of only giving advice.
- Focus on finishing the current prompt requirement.
- At the end of this pass, provide a clear completion status and quality score.
- If earlier passes already completed part of the work, continue from there instead of starting over.

## Previous Prompt Summary

# 05-admin-web现状盘点与页面优先级 Summary

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

# Prompt 06: admin-web 一期开发提示词

你现在开始实现 `admin-web` 第一轮页面，但必须以 05 号提示词整理出的优先级为准，并且优先消费 04 号提示词里已经可用的后端接口。

## 目标

让管理后台从“菜单 + 占位页面”提升到“至少有一批可用页面能查看真实数据”的状态。

## 页面开发原则

- 优先补真实业务页面，不优先做花哨视觉
- 优先复用已有布局、表格、统计卡片组件
- 先做能展示真实接口结果的版本
- 允许先保留少量占位模块，但要把主要业务区接上数据

## 执行步骤

1. 根据 05 号文档，列出第一批要做的页面。
2. 先补 API service 层，统一数据获取方法。
3. 再补页面的数据获取、加载态、空态、错误态。
4. 再补列表、统计卡片、趋势区等结构。
5. 如果某页后端接口还不够，就明确标记依赖，不要假装完成。
6. 每完成一页，记录：
   - 页面是否接入真实接口
   - 哪些区块是真数据
   - 哪些区块仍是占位

## 输出要求

最终输出必须包含：

1. 实际完成的页面清单
2. 接入的接口清单
3. 每页真实数据覆盖度
4. 仍待补齐的后台页面缺口
5. 给 07 号提示词的后台可消费能力摘要


## Required Footer

Append the following machine-readable footer at the end of your final response:

FINAL_STATUS: COMPLETE | PARTIAL | BLOCKED
QUALITY_SCORE: 1-5
NEXT_ACTIONS:
- ...
CHANGED_FILES:
- ...
