# Codex Headless Run Context

Current step: 09-三端联调与服务器核验
Current pass: 1
Project root: D:\CodeDevelopment\xueyinMiniapp

## Execution Rules

- You are running in headless mode.
- Work directly in the repository instead of only giving advice.
- Focus on finishing the current prompt requirement.
- At the end of this pass, provide a clear completion status and quality score.
- If earlier passes already completed part of the work, continue from there instead of starting over.

## Previous Prompt Summary

# 08-小程序核心闭环补齐 Summary

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

# Prompt 09: 三端联调与服务器核验

现在进入联调阶段。请把前 01-08 号提示词的产物都视为输入，重点检查三端是否真的串起来了。

## 额外上下文

- 服务器信息已经由项目负责人提供
- 本轮重点不是加新功能，而是验证已有能力是否能在真实环境串起来

## 目标

完成 backend、admin-web、miniprogram 三端的联调检查，并给出明确的阻塞点和修复优先级。

## 执行步骤

1. 列出三端联调所需的关键链路：
   - 登录
   - 星球发现
   - 加入星球
   - 发帖
   - 评论
   - 点赞
   - 后台查看数据
2. 对每条链路检查：
   - 前端参数是否正确
   - 后端返回是否稳定
   - 状态是否回写
   - 页面是否刷新正确
3. 如果可以访问服务器，就验证部署环境接口。
4. 记录线上/本地/开发环境差异。
5. 输出阻塞清单，并按“立刻修”“可延后修”分类。

## 输出要求

输出标题为“三端联调与服务器核验”的 Markdown 文档。

必须包含：

1. 联调链路总表
2. 每条链路结果
3. 服务器环境检查结果
4. 阻塞问题清单
5. 修复优先级
6. 给 10 号提示词的收尾输入


## Required Footer

Append the following machine-readable footer at the end of your final response:

FINAL_STATUS: COMPLETE | PARTIAL | BLOCKED
QUALITY_SCORE: 1-5
NEXT_ACTIONS:
- ...
CHANGED_FILES:
- ...
