# 项目交接文档

## 1. 项目定位

这是一个“语法填空训练平台”前端原型，包含：

- 用户端：学生做题、看结果、看个人记录
- 管理端：维护篇章、题目、答案、解析和发布状态

当前还没有真实后端和数据库，项目主要用于：

1. 先把产品流程跑通
2. 先把接口边界定清楚
3. 给后端同学一个稳定的联调目标

---

## 2. 当前代码结构

```text
src/
  user/
  admin/
  shared/
```

### `src/user/`

用户端代码：

- `main.js`：入口、路由、事件流转
- `views.js`：页面模板
- `styles.css`：用户端补充样式

### `src/admin/`

管理端代码：

- `main.js`：后台入口、页面切换、表单提交
- `views.js`：后台页面模板
- `content-service.js`：篇章和题目的增删改规则
- `styles.css`：后台样式

### `src/shared/`

公共层：

- `api/`：接口入口、mock 实现、未来真实后端适配
- `services/`：题库处理、判题、推荐、存储、管理端共用规则
- `utils/`：工具函数
- `styles/`：基础全局样式

---

## 3. 当前哪些是真的，哪些还是 mock

### 已经跑通的前端能力

- 用户端页面流
- 管理端页面流
- 本地题库读写
- 本地练习记录
- 本地管理员登录
- 本地新增 / 修改 / 删除篇章和题目
- 学生端 `backend.js` 已对齐题库、提交、注册、登录、个人中心、练习草稿接口
- 管理端 `backend.js` 已对齐登录、总览、篇章 CRUD、题目 CRUD、用户概览接口

### 还没接真实后端的部分

- 真正的服务端实现
- 数据库存储
- 服务端鉴权校验
- 练习草稿和提交结果的服务端持久化
- 管理端保存到数据库
- 用户中心真实统计返回

也就是说：

**当前源码默认仍是 mock 预览模式，但接口调用层已经按文档接口 shape 对齐；切到 `apiMode: "backend"` 后即可进入真实联调。**

---

## 4. 联调建议顺序

### 第一阶段

先联调用户端主流程：

1. `GET /api/passages`
2. `GET /api/passages/:id`
3. `POST /api/practice/submit`

### 第二阶段

再联调学生账号：

4. `POST /api/auth/register`
5. `POST /api/auth/login`
6. `GET /api/profile`

### 第三阶段

最后联调管理端：

7. `POST /api/admin/auth/login`
8. `GET /api/admin/overview`
9. `GET /api/admin/passages`
10. `POST /api/admin/passages`
11. `PATCH /api/admin/passages/:id`
12. `DELETE /api/admin/passages/:id`
13. `POST /api/admin/questions`
14. `PATCH /api/admin/questions/:id`
15. `DELETE /api/admin/questions/:id`
16. `GET /api/admin/users`

---

## 5. 关键文件

| 文件 | 作用 |
| --- | --- |
| `src/user/main.js` | 用户端入口 |
| `src/admin/main.js` | 管理端入口 |
| `src/shared/api/client.js` | API 统一入口 |
| `src/shared/api/mock.js` | 当前 mock 数据接口 |
| `src/shared/api/backend.js` | 未来真实接口适配层 |
| `src/shared/services/data-service.js` | 判题、推荐、统计 |
| `src/admin/content-service.js` | 后台篇章/题目编辑逻辑 |
| `src/shared/services/storage.js` | 本地存储 |
| `question.json` | 原始题库数据 |

---

## 6. 给后端同学的重点

你们现在最该统一的不是数据库细节，而是接口边界。

先看：

1. `docs/api.md`
2. `question.json`
3. `src/shared/services/data-service.js`
4. `src/admin/content-service.js`

重点共识：

- 接口返回字段统一用 `camelCase`
- 数据库字段统一用 `snake_case`
- `question.json` 原结构不要改
- 学生端 `/api/profile` 需要返回 `draftAnswersByPassage` 和完整 `lastResult`
- 学生端 `/api/practice/submit` 如果带学生 token，后端要把本次提交写入该学生历史记录
- 除登录接口外，所有 `/api/admin/*` 都要校验 `Authorization: Bearer <adminToken>`
- 第一阶段只先打通用户端主流程

---

## 7. 当前最重要的一句实话

这个项目现在已经适合继续前后端分工，但**还不是正式可上线版本**。  
它现在最有价值的地方，是：

- 前端结构已经清楚
- 管理端和用户端已经分开
- 接口文档已经明确
- 后端可以开始按接口建库和写接口
