# Grammar Studio

一个面向上海高考英语语法填空场景的前端原型项目，当前包含两套独立入口：

- 用户端：`/`
- 管理端：`/admin/`

当前版本重点不是做完整后端，而是先把前端产品形态、接口边界和管理端操作流跑通。

## 当前能力

### 用户端

- 题库浏览与筛选
- 整篇练习
- 提交批改
- 结果复盘
- 推荐继续练
- 登录 / 注册 / 个人中心原型

### 管理端

- 管理员登录
- 新增 / 修改 / 删除篇章
- 新增 / 修改 / 删除题目
- 修改答案、解析、标签、难度
- 草稿 / 发布状态
- 首页推荐位
- 用户学习概览

## 当前目录

```text
index.html
admin/
  index.html
src/
  user/
    main.js
    views.js
    styles.css
  admin/
    main.js
    views.js
    content-service.js
    styles.css
  shared/
    api/
      client.js
      mock.js
      backend.js
    services/
      data-service.js
      admin-service.js
      storage.js
    utils/
      index.js
    styles/
      base.css
docs/
  api.md
  handoff.md
tools/
  smoke-check.ps1
question.json
```

## 目录说明

- `src/user/`：用户端入口、页面模板、页面样式
- `src/admin/`：管理端入口、页面模板、后台内容编辑逻辑
- `src/shared/`：两端共用的 API、业务服务、工具函数、基础样式
- `docs/api.md`：接口文档
- `docs/handoff.md`：项目交接文档

这次整理后，代码结构已经更接近常规前端项目的分层方式：按“端”拆目录，再抽一层 shared。

## 运行方式

在项目根目录启动静态服务：

```bash
python -m http.server 5500
```

打开：

- 用户端：[http://127.0.0.1:5500/](http://127.0.0.1:5500/)
- 管理端：[http://127.0.0.1:5500/admin/](http://127.0.0.1:5500/admin/)

## 自检

```powershell
powershell -ExecutionPolicy Bypass -File tools\smoke-check.ps1
```

## mock / backend 切换

- 默认预览页面时使用 `mock`
- 和后端联调时，把 [index.html](C:/Users/33523/Desktop/codex3/codex3/index.html) 与 [admin/index.html](C:/Users/33523/Desktop/codex3/codex3/admin/index.html) 里的 `apiMode` 改成 `backend`
- [src/shared/api/backend.js](C:/Users/33523/Desktop/codex3/codex3/src/shared/api/backend.js) 已经按 [docs/api.md](C:/Users/33523/Desktop/codex3/codex3/docs/api.md) 定义的接口 shape 请求真实后端

## 当前状态说明

- 默认以 `mock` 模式预览页面
- `question.json` 是题库基础数据
- 管理端修改内容后，用户端会读取本地覆盖数据进行展示
- 真实后端、数据库、登录鉴权、正式保存逻辑还需要后端实现

## 文档

- [接口文档](C:/Users/33523/Desktop/codex3/codex3/docs/api.md)
- [交接文档](C:/Users/33523/Desktop/codex3/codex3/docs/handoff.md)
