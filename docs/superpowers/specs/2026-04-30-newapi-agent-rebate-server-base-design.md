# NewAPI 代理分销功能整合设计

## 1. 背景

本次目标不是直接修改服务器运行中的项目，而是先以服务器当前部署快照为基线，在本地完成代理分销功能整合与验证，确认可用后再推回服务器。

当前已确认的基线与来源如下：

- 服务器当前部署快照基线：`/home/ubuntu/newapi-plus-main-nav`
- 本地工作副本目标路径：`/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base`
- 代理分销功能来源：`/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1`

## 2. 目标

- 以服务器部署快照为唯一基线创建本地工作副本
- 将代理分销相关能力定向移植到本地工作副本
- 保持当前服务器运行行为尽量不变，只新增代理分销闭环
- 在本地完成编译、测试与功能链路验证
- 最终产出一份可安全推回服务器的本地版本

## 3. 非目标

- 不直接在服务器上修改源码
- 不直接在服务器上合并功能
- 不整仓替换为 `newapi-plus-agent-rebate-220f1b1`
- 不引入与代理分销无关的 inspect、playground、导航实验性改动
- 不顺带修改无关 Dockerfile、支付网关、UI 重构

## 4. 方案选择

本次采用以下方案：

1. 从服务器拉取 `/home/ubuntu/newapi-plus-main-nav` 到本地新目录
2. 以本地副本为整合目标
3. 从 `newapi-plus-agent-rebate-220f1b1` 中定向移植代理分销相关文件与逻辑
4. 本地完成验证后，再准备推回服务器

选择该方案的原因：

- 最贴近服务器当前真实运行状态
- 最小化与线上现状的偏差
- 便于控制变更范围
- 降低后续回推服务器时的不可控风险

## 5. 整合范围

本次整合严格限制在代理分销闭环，包含以下部分。

### 5.1 后端数据模型

- `model/user.go`
  - 代理身份字段
  - 代理返利比例字段
  - 代理返利余额字段
  - 代理返利历史累计字段
- `model/agent_rebate.go`
  - 代理返利记录模型
  - 代理返利汇总与明细查询
  - 充值返利结算
  - 管理员余额调整
- `model/main.go`
  - 注册 `AgentRebateRecord` 自动迁移

### 5.2 后端业务逻辑

- `controller/user.go`
  - 登录返回补齐代理字段
  - `GetSelf` 返回补齐代理字段
  - `GetUser` 返回补齐代理字段
- `controller/agent_rebate.go`
  - 用户侧代理返利查询
  - 管理员设置代理身份与返利比例
  - 管理员调整代理返利余额
- `controller/topup.go`
  - 充值成功后接入代理返利自动结算

### 5.3 路由接入

- `router/api-router.go`
  - 用户侧 `GET /api/user/agent_rebate`
  - 管理侧代理身份更新接口
  - 管理侧代理返利调整接口

### 5.4 前端页面与入口

- `web/src/App.jsx`
  - 接入代理返利页面路由
- `web/src/components/layout/SiderBar.jsx`
  - 新增“代理返利”菜单入口
  - 按代理身份做显隐控制
- 代理返利页面目录
  - 页面主体
  - 列表与汇总展示
- 用户管理相关组件
  - 展示代理身份
  - 展示返利比例、余额、历史累计
  - 编辑代理身份与返利比例

### 5.5 测试

- `model/agent_rebate_test.go`
- `model/agent_rebate_topup_test.go`
- `controller/agent_rebate_test.go`

## 6. 明确排除项

以下内容本次不进入整合范围：

- inspect 版本中的非代理分销增强
- playground 相关增强
- 无关导航重构
- 无关组件抽象
- 无关 Docker 运行时定制
- 无关第三方支付能力扩展
- 无关数据库修复脚本

## 7. 文件改动清单

预计重点改动以下文件或目录：

- `model/user.go`
- `model/agent_rebate.go`
- `model/main.go`
- `controller/user.go`
- `controller/agent_rebate.go`
- `controller/topup.go`
- `router/api-router.go`
- `web/src/App.jsx`
- `web/src/components/layout/SiderBar.jsx`
- `web/src/pages/AgentRebate/`
- `web/src/components/table/users/`
- 代理相关测试文件

如果整合过程中发现代理页面依赖少量公共组件，只允许按最小依赖补齐，不允许整包搬运无关模块。

## 8. 执行顺序

### 步骤 1：建立本地基线副本

- 从服务器复制 `/home/ubuntu/newapi-plus-main-nav`
- 落到本地 `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base`
- 回读目录结构，确认副本落盘成功

### 步骤 2：后端模型整合

- 先补用户代理字段
- 再补代理返利记录模型
- 再补自动迁移注册

### 步骤 3：后端业务与接口整合

- 接入返利结算逻辑
- 接入查询与管理接口
- 接入路由
- 补齐登录、自身信息、用户详情接口返回

### 步骤 4：测试红绿验证

- 先移植或补齐代理相关测试
- 先看失败点
- 再修到通过

### 步骤 5：前端页面与入口整合

- 接入路由
- 接入左侧菜单
- 接入代理返利页面
- 接入用户管理中的代理字段展示与编辑

### 步骤 6：本地验证与收口

- 跑后端测试
- 跑整体编译
- 跑前端构建
- 整理最终可推服务器说明

## 9. 验证标准

### 9.1 编译与测试

后端至少执行：

- `go test ./model/...`
- `go test ./controller/...`
- `go test ./...`
- `go build ./...`

前端至少执行项目现有构建命令：

- `npm build`
- 或 `npm run build`
- 或项目实际使用的等价命令

以仓库原有包管理方式为准，不强行更换。

### 9.2 功能链路

至少验证以下 4 条：

1. 用户结构中能返回代理字段
2. 充值成功后能触发代理返利结算
3. 用户侧能查询代理返利汇总与明细
4. 管理员能设置代理身份并调整返利余额

## 10. 风险与处理

### 风险 1：服务器快照与来源版本存在局部实现差异

处理方式：

- 以服务器快照为主
- 仅按功能补缺
- 不为了“保持来源一致”而覆盖服务器现有实现

### 风险 2：前端代理页面依赖 inspect 中其它无关组件

处理方式：

- 优先抽取最小依赖
- 不能整包搬入 unrelated 组件

### 风险 3：数据库迁移与当前 SQLite 兼容性问题

处理方式：

- 先在本地副本验证
- 只在本地确认迁移影响
- 不在服务器上直接试错

## 11. 交付物

本次最终交付应包含：

1. 本地整合后的服务器基线副本
2. 代理分销功能并入后的源码变更
3. 本地验证结果记录
4. 可推服务器说明

## 12. 收口标准

仅当以下条件全部满足，才可认为本次本地整合完成：

- 本地工作副本已完成代理分销整合
- 后端编译通过
- 代理相关测试通过
- 前端构建通过
- 未直接修改服务器源码
- 已形成可回推服务器的清晰说明

