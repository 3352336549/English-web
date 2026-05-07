# 语法填空训练平台接口文档

## 1. 文档说明

本文档用于定义“语法填空训练平台”前后端接口规范，包含：

- 学生端接口
- 管理端接口
- 通用返回格式
- 主要数据结构说明

当前约定：

- 接口前缀统一为 `/api`
- 数据库字段使用 `snake_case`
- 接口请求/响应字段使用 `camelCase`
- 如需在数据库层与接口层做映射，请以后端 DTO（接口出入参）定义为准
- 时间字段统一返回 ISO 8601 字符串
- 所有 JSON 请求头统一为 `Content-Type: application/json`

## 1.1 认证说明

### 学生端认证

- `POST /api/auth/register` 和 `POST /api/auth/login` 成功后返回学生 token
- `GET /api/profile` 必须携带请求头：`Authorization: Bearer <studentToken>`
- `POST /api/practice/draft` 必须携带请求头：`Authorization: Bearer <studentToken>`
- `POST /api/practice/submit` 可以匿名调用；如果携带学生 token，后端应同时把本次提交写入该学生的练习记录

### 管理端认证

- `POST /api/admin/auth/login` 成功后返回管理员 token
- 除登录接口外，所有 `/api/admin/*` 接口都必须携带请求头：`Authorization: Bearer <adminToken>`

---

## 2. 通用返回格式

### 成功返回

```json
{
  "code": 1,
  "data": {},
  "msg": "success"
}
```

### 失败返回

```json
{
  "code": 0,
  "data": null,
  "msg": "参数错误"
}
```

### 字段说明

| 名称 | 类型 | 是否必须 | 备注 |
| --- | --- | --- | --- |
| code | number | 是 | `1` 表示成功，`0` 表示失败 |
| data | any | 否 | 返回数据主体 |
| msg | string | 否 | 提示信息 |

---

## 学生端接口

## 3. 题库相关接口

## 3.1 题库分页查询

### 基本信息

**Path：** `/api/passages`  
**Method：** `GET`  
**接口描述：** 查询学生端可见的篇章列表，默认只返回已发布内容。

### 请求参数

#### Query

| 参数名称 | 是否必须 | 示例 | 备注 |
| --- | --- | --- | --- |
| page | 否 | 1 | 页码，默认 1 |
| pageSize | 否 | 10 | 每页记录数，默认 10 |
| year | 否 | 2022 | 年份筛选 |
| tag | 否 | 非谓语动词 | 语法标签筛选 |
| query | 否 | business | 关键词搜索 |

### 返回数据

```json
{
  "code": 1,
  "data": {
    "list": [
      {
        "id": 1,
        "title": "How to Start a New Business",
        "year": "2022",
        "source": "2022年上海高考真题",
        "questionCount": 10,
        "featured": true,
        "tags": ["代词", "非谓语动词"],
        "excerpt": "An entrepreneur is a person..."
      }
    ],
    "total": 9,
    "page": 1,
    "pageSize": 10
  },
  "msg": "success"
}
```

### 返回字段说明

| 名称 | 类型 | 是否必须 | 备注 |
| --- | --- | --- | --- |
| list | object[] | 是 | 篇章列表 |
| total | number | 是 | 总记录数 |
| page | number | 是 | 当前页 |
| pageSize | number | 是 | 每页条数 |

### 说明

- `featured` 用于学生端首页推荐排序；如果不返回，前端会退回到按年份排序

---

## 3.2 查询篇章详情

### 基本信息

**Path：** `/api/passages/{id}`  
**Method：** `GET`  
**接口描述：** 查询某一篇练习详情，返回题目但不返回标准答案和解析。

### 请求参数

#### 路径参数

| 参数名称 | 是否必须 | 示例 | 备注 |
| --- | --- | --- | --- |
| id | 是 | 1 | 篇章 id |

### 返回数据

```json
{
  "code": 1,
  "data": {
    "id": 1,
    "title": "How to Start a New Business",
    "content": "篇章全文",
    "source": "2022年上海高考真题",
    "year": "2022",
    "questionCount": 10,
    "tags": ["代词", "非谓语动词"],
    "questions": [
      {
        "id": 1,
        "passageId": 1,
        "blankNumber": 21,
        "questionText": "Interviewing entrepreneurs to aid (21)...",
        "givenWord": "",
        "grammarTag": "代词",
        "difficulty": "简单",
        "type": "语法填空"
      }
    ]
  },
  "msg": "success"
}
```

### 说明

- 该接口 **不返回** `correctAnswer`
- 该接口 **不返回** `explanation`

---

## 4. 练习相关接口

## 4.1 提交练习并批改

### 基本信息

**Path：** `/api/practice/submit`  
**Method：** `POST`  
**接口描述：** 提交某一篇的答案，返回完整批改结果。

### 请求参数

#### Body

```json
{
  "passageId": 1,
  "answers": [
    {
      "blankNumber": 21,
      "userAnswer": "them"
    }
  ]
}
```

#### Body 字段说明

| 名称 | 类型 | 是否必须 | 备注 |
| --- | --- | --- | --- |
| passageId | number | 是 | 篇章 id |
| answers | object[] | 是 | 用户答案列表 |
| answers[].blankNumber | number | 是 | 空号 |
| answers[].userAnswer | string | 是 | 用户填写答案 |

### 返回数据

```json
{
  "code": 1,
  "data": {
    "passageId": 1,
    "title": "How to Start a New Business",
    "year": "2022",
    "createdAt": "2026-04-29T10:00:00.000Z",
    "accuracy": 70,
    "correctCount": 7,
    "wrongCount": 3,
    "focusTags": ["代词", "名词性从句"],
    "details": [
      {
        "blankNumber": 21,
        "questionText": "Interviewing entrepreneurs to aid (21)...",
        "userAnswer": "them",
        "correctAnswer": "them",
        "grammarTag": "代词",
        "difficulty": "简单",
        "givenWord": "",
        "explanation": "考查代词作宾语。",
        "isCorrect": true
      }
    ],
    "recommendations": [
      {
        "passageId": 2,
        "title": "Another Passage",
        "year": "2021",
        "blankNumber": 32,
        "grammarTag": "代词",
        "difficulty": "中等",
        "givenWord": ""
      }
    ]
  },
  "msg": "success"
}
```

### 说明

- 已登录学生在调用该接口时，前端会自动携带 `Authorization` 请求头
- 后端如果识别到学生 token，应把本次提交写入该学生的历史记录，供 `/api/profile` 返回

---

## 4.2 保存练习草稿（可选）

### 基本信息

**Path：** `/api/practice/draft`  
**Method：** `POST`  
**接口描述：** 保存某篇练习的临时作答状态。

### 请求参数

#### Headers

| 参数名称 | 是否必须 | 示例 | 备注 |
| --- | --- | --- | --- |
| Authorization | 是 | Bearer student-token | 学生登录后的 token |

#### Body

```json
{
  "passageId": 1,
  "answers": {
    "21": "them",
    "22": "which"
  }
}
```

### 返回数据

```json
{
  "code": 1,
  "data": {
    "passageId": 1,
    "saved": true
  },
  "msg": "保存成功"
}
```

---

## 5. 学生账号相关接口

## 5.1 学生注册

### 基本信息

**Path：** `/api/auth/register`  
**Method：** `POST`  
**接口描述：** 学生注册账号。

### 请求参数

#### Body

```json
{
  "username": "tom",
  "password": "123456",
  "confirmPassword": "123456",
  "nickname": "Tom",
  "grade": "高三"
}
```

### 返回数据

```json
{
  "code": 1,
  "data": {
    "id": "user-1",
    "username": "tom",
    "nickname": "Tom",
    "grade": "高三",
    "token": "mock-token"
  },
  "msg": "注册成功"
}
```

---

## 5.2 学生登录

### 基本信息

**Path：** `/api/auth/login`  
**Method：** `POST`  
**接口描述：** 学生登录。

### 请求参数

#### Body

```json
{
  "username": "tom",
  "password": "123456"
}
```

### 返回数据

```json
{
  "code": 1,
  "data": {
    "id": "user-1",
    "username": "tom",
    "nickname": "Tom",
    "grade": "高三",
    "token": "mock-token"
  },
  "msg": "登录成功"
}
```

---

## 5.3 获取个人中心数据

### 基本信息

**Path：** `/api/profile`  
**Method：** `GET`  
**接口描述：** 获取学生个人中心统计数据。

### 请求参数

#### Headers

| 参数名称 | 是否必须 | 示例 | 备注 |
| --- | --- | --- | --- |
| Authorization | 是 | Bearer student-token | 学生登录后的 token |

无 Query 参数。

### 返回数据

```json
{
  "code": 1,
  "data": {
    "user": {
      "id": "user-1",
      "username": "tom",
      "nickname": "Tom",
      "grade": "高三",
      "createdAt": "2026-04-20T10:00:00.000Z"
    },
    "summary": {
      "completedPassages": 5,
      "submissionCount": 12,
      "avgAccuracy": 76,
      "bestAccuracy": 92,
      "weakTags": [
        { "name": "非谓语动词", "count": 4 },
        { "name": "名词性从句", "count": 3 }
      ]
    },
    "history": [
      {
        "passageId": 1,
        "title": "How to Start a New Business",
        "year": "2022",
        "accuracy": 70,
        "focusTags": ["代词"],
        "createdAt": "2026-04-29T10:00:00.000Z"
      }
    ],
    "draftAnswersByPassage": {
      "1": {
        "21": "them",
        "22": "which"
      }
    },
    "lastResult": {
      "passageId": 1,
      "title": "How to Start a New Business",
      "year": "2022",
      "createdAt": "2026-04-29T10:00:00.000Z",
      "accuracy": 70,
      "correctCount": 7,
      "wrongCount": 3,
      "focusTags": ["代词"],
      "details": [
        {
          "blankNumber": 21,
          "questionText": "Interviewing entrepreneurs to aid (21)...",
          "userAnswer": "them",
          "correctAnswer": "them",
          "grammarTag": "代词",
          "difficulty": "简单",
          "givenWord": "",
          "explanation": "考查代词作宾语。",
          "isCorrect": true
        }
      ],
      "recommendations": []
    }
  },
  "msg": "success"
}
```

### 说明

- `draftAnswersByPassage` 用来恢复学生未提交完成的作答草稿
- `lastResult` 返回最近一次提交的完整结果对象，结构与 `Result` 一致

---

## 管理端接口

## 6. 管理员认证接口

## 6.1 管理员登录

### 基本信息

**Path：** `/api/admin/auth/login`  
**Method：** `POST`  
**接口描述：** 管理员登录管理端。

### 请求参数

#### Body

```json
{
  "username": "admin",
  "password": "admin123"
}
```

### 返回数据

```json
{
  "code": 1,
  "data": {
    "id": "admin-1",
    "username": "admin",
    "name": "内容管理员",
    "role": "content_manager",
    "token": "admin-token"
  },
  "msg": "登录成功"
}
```

---

## 7. 管理端总览接口

## 7.1 获取后台总览数据

### 基本信息

**Path：** `/api/admin/overview`  
**Method：** `GET`  
**接口描述：** 获取后台首页总览数据。

### 请求参数

#### Headers

| 参数名称 | 是否必须 | 示例 | 备注 |
| --- | --- | --- | --- |
| Authorization | 是 | Bearer admin-token | 管理员登录后的 token |

无 Query 参数。

### 返回数据

```json
{
  "code": 1,
  "data": {
    "totalPassages": 9,
    "totalQuestions": 90,
    "publishedCount": 7,
    "draftCount": 2,
    "featuredCount": 3,
    "zeroQuestionCount": 1,
    "registeredUserCount": 12,
    "activeUserCount": 6,
    "submissionCount": 48,
    "avgAccuracy": 73,
    "topTags": [
      { "name": "非谓语动词", "count": 18 }
    ],
    "weakTags": [
      { "name": "名词性从句", "count": 9 }
    ],
    "featuredPassages": [],
    "recentSubmissions": []
  },
  "msg": "success"
}
```

---

## 8. 管理端篇章接口

## 8.1 篇章分页查询

### 基本信息

**Path：** `/api/admin/passages`  
**Method：** `GET`  
**接口描述：** 查询后台篇章列表，支持筛选。

### 请求参数

#### Headers

| 参数名称 | 是否必须 | 示例 | 备注 |
| --- | --- | --- | --- |
| Authorization | 是 | Bearer admin-token | 管理员登录后的 token |

#### Query

| 参数名称 | 是否必须 | 示例 | 备注 |
| --- | --- | --- | --- |
| page | 否 | 1 | 页码 |
| pageSize | 否 | 20 | 每页条数 |
| year | 否 | 2022 | 年份 |
| status | 否 | published | 状态：`published` / `draft` |
| keyword | 否 | business | 标题/来源/备注关键词 |

### 返回数据

```json
{
  "code": 1,
  "data": {
    "list": [
      {
        "id": 1,
        "title": "How to Start a New Business",
        "source": "2022年上海高考真题",
        "year": "2022",
        "content": "篇章全文",
        "excerpt": "An entrepreneur is a person...",
        "questionCount": 10,
        "tags": ["代词", "非谓语动词"],
        "status": "published",
        "featured": true,
        "note": "适合首页推荐",
        "updatedAt": "2026-04-29T10:00:00.000Z"
      }
    ],
    "total": 9,
    "page": 1,
    "pageSize": 20
  },
  "msg": "success"
}
```

---

## 8.2 查询篇章详情

### 基本信息

**Path：** `/api/admin/passages/{id}`  
**Method：** `GET`  
**接口描述：** 查询后台篇章详情，包含题目列表。

### 请求参数

#### Headers

| 参数名称 | 是否必须 | 示例 | 备注 |
| --- | --- | --- | --- |
| Authorization | 是 | Bearer admin-token | 管理员登录后的 token |

#### 路径参数

| 参数名称 | 是否必须 | 示例 | 备注 |
| --- | --- | --- | --- |
| id | 是 | 1 | 篇章 id |

### 返回数据

```json
{
  "code": 1,
  "data": {
    "id": 1,
    "title": "How to Start a New Business",
    "source": "2022年上海高考真题",
    "year": "2022",
    "content": "篇章全文",
    "status": "published",
    "featured": true,
    "note": "适合首页推荐",
    "questions": [
      {
        "id": 1,
        "passageId": 1,
        "blankNumber": 21,
        "questionText": "Interviewing entrepreneurs to aid (21)...",
        "givenWord": "",
        "correctAnswer": "them",
        "grammarTag": "代词",
        "difficulty": "简单",
        "explanation": "考查代词作宾语。",
        "type": "语法填空"
      }
    ]
  },
  "msg": "success"
}
```

---

## 8.3 新增篇章

### 基本信息

**Path：** `/api/admin/passages`  
**Method：** `POST`  
**接口描述：** 新增篇章。

### 请求参数

#### Headers

| 参数名称 | 是否必须 | 示例 | 备注 |
| --- | --- | --- | --- |
| Authorization | 是 | Bearer admin-token | 管理员登录后的 token |

#### Body

```json
{
  "title": "新篇章标题",
  "content": "完整原文",
  "source": "2026 模拟题",
  "year": "2026",
  "status": "draft",
  "featured": false,
  "note": "待补题"
}
```

### 返回数据

```json
{
  "code": 1,
  "data": {
    "id": 10
  },
  "msg": "篇章创建成功"
}
```

---

## 8.4 修改篇章

### 基本信息

**Path：** `/api/admin/passages/{id}`  
**Method：** `PATCH`  
**接口描述：** 修改篇章基本信息、发布状态、推荐位、备注。

### 请求参数

#### Headers

| 参数名称 | 是否必须 | 示例 | 备注 |
| --- | --- | --- | --- |
| Authorization | 是 | Bearer admin-token | 管理员登录后的 token |

#### 路径参数

| 参数名称 | 是否必须 | 示例 | 备注 |
| --- | --- | --- | --- |
| id | 是 | 10 | 篇章 id |

#### Body

```json
{
  "title": "修改后的标题",
  "content": "修改后的原文",
  "source": "2026 模拟题",
  "year": "2026",
  "status": "published",
  "featured": true,
  "note": "已完成校对"
}
```

### 返回数据

```json
{
  "code": 1,
  "data": null,
  "msg": "篇章更新成功"
}
```

---

## 8.5 删除篇章

### 基本信息

**Path：** `/api/admin/passages/{id}`  
**Method：** `DELETE`  
**接口描述：** 删除篇章，同时删除其关联题目。

### 请求参数

#### Headers

| 参数名称 | 是否必须 | 示例 | 备注 |
| --- | --- | --- | --- |
| Authorization | 是 | Bearer admin-token | 管理员登录后的 token |

#### 路径参数

| 参数名称 | 是否必须 | 示例 | 备注 |
| --- | --- | --- | --- |
| id | 是 | 10 | 篇章 id |

### 返回数据

```json
{
  "code": 1,
  "data": null,
  "msg": "篇章删除成功"
}
```

---

## 9. 管理端题目接口

## 9.1 新增题目

### 基本信息

**Path：** `/api/admin/questions`  
**Method：** `POST`  
**接口描述：** 给某一篇新增题目。

### 请求参数

#### Headers

| 参数名称 | 是否必须 | 示例 | 备注 |
| --- | --- | --- | --- |
| Authorization | 是 | Bearer admin-token | 管理员登录后的 token |

#### Body

```json
{
  "passageId": 1,
  "blankNumber": 21,
  "questionText": "题干",
  "givenWord": "",
  "correctAnswer": "them",
  "grammarTag": "代词",
  "difficulty": "简单",
  "explanation": "考查代词作宾语。",
  "type": "语法填空"
}
```

### 返回数据

```json
{
  "code": 1,
  "data": {
    "id": 101
  },
  "msg": "题目创建成功"
}
```

---

## 9.2 修改题目

### 基本信息

**Path：** `/api/admin/questions/{id}`  
**Method：** `PATCH`  
**接口描述：** 修改题干、答案、标签、难度、解析。

### 请求参数

#### Headers

| 参数名称 | 是否必须 | 示例 | 备注 |
| --- | --- | --- | --- |
| Authorization | 是 | Bearer admin-token | 管理员登录后的 token |

#### 路径参数

| 参数名称 | 是否必须 | 示例 | 备注 |
| --- | --- | --- | --- |
| id | 是 | 101 | 题目 id |

#### Body

```json
{
  "blankNumber": 21,
  "questionText": "修改后的题干",
  "givenWord": "",
  "correctAnswer": "them",
  "grammarTag": "代词",
  "difficulty": "中等",
  "explanation": "修改后的解析",
  "type": "语法填空"
}
```

### 返回数据

```json
{
  "code": 1,
  "data": null,
  "msg": "题目更新成功"
}
```

---

## 9.3 删除题目

### 基本信息

**Path：** `/api/admin/questions/{id}`  
**Method：** `DELETE`  
**接口描述：** 删除某道题目。

### 请求参数

#### Headers

| 参数名称 | 是否必须 | 示例 | 备注 |
| --- | --- | --- | --- |
| Authorization | 是 | Bearer admin-token | 管理员登录后的 token |

#### 路径参数

| 参数名称 | 是否必须 | 示例 | 备注 |
| --- | --- | --- | --- |
| id | 是 | 101 | 题目 id |

### 返回数据

```json
{
  "code": 1,
  "data": null,
  "msg": "题目删除成功"
}
```

---

## 10. 管理端用户概览接口

## 10.1 查询用户学习概览

### 基本信息

**Path：** `/api/admin/users`  
**Method：** `GET`  
**接口描述：** 查询学生学习概览列表。

### 请求参数

#### Headers

| 参数名称 | 是否必须 | 示例 | 备注 |
| --- | --- | --- | --- |
| Authorization | 是 | Bearer admin-token | 管理员登录后的 token |

#### Query

| 参数名称 | 是否必须 | 示例 | 备注 |
| --- | --- | --- | --- |
| page | 否 | 1 | 页码 |
| pageSize | 否 | 20 | 每页条数 |
| keyword | 否 | tom | 用户名/昵称搜索 |

### 返回数据

```json
{
  "code": 1,
  "data": {
    "list": [
      {
        "id": "user-1",
        "username": "tom",
        "nickname": "Tom",
        "grade": "高三",
        "createdAt": "2026-04-20T10:00:00.000Z",
        "completedPassages": 5,
        "submissionCount": 12,
        "avgAccuracy": 76,
        "bestAccuracy": 92,
        "weakTags": [
          { "name": "非谓语动词", "count": 4 }
        ],
        "latestTitle": "How to Start a New Business",
        "latestAccuracy": 70,
        "latestAt": "2026-04-29T10:00:00.000Z"
      }
    ],
    "total": 12,
    "page": 1,
    "pageSize": 20
  },
  "msg": "success"
}
```

---

## 11. 主要对象定义

## 11.1 Passage

```json
{
  "id": 1,
  "title": "How to Start a New Business",
  "content": "篇章全文",
  "source": "2022年上海高考真题",
  "year": "2022",
  "questionCount": 10,
  "tags": ["代词", "非谓语动词"],
  "excerpt": "前 180 个字符摘要"
}
```

## 11.2 Question

```json
{
  "id": 1,
  "passageId": 1,
  "blankNumber": 21,
  "questionText": "Interviewing entrepreneurs to aid (21)...",
  "givenWord": "",
  "correctAnswer": "them",
  "grammarTag": "代词",
  "difficulty": "简单",
  "explanation": "考查代词作宾语。",
  "type": "语法填空"
}
```

## 11.3 Result

```json
{
  "passageId": 1,
  "title": "How to Start a New Business",
  "year": "2022",
  "createdAt": "2026-04-29T10:00:00.000Z",
  "accuracy": 70,
  "correctCount": 7,
  "wrongCount": 3,
  "focusTags": ["代词"],
  "details": [],
  "recommendations": []
}
```

## 11.4 AdminPassageMeta

```json
{
  "passageId": 1,
  "status": "published",
  "featured": true,
  "note": "适合首页推荐",
  "updatedAt": "2026-04-29T10:00:00.000Z"
}
```

---

## 12. 判题规则说明

后端判题建议与前端保持一致：

1. 忽略大小写
2. 忽略多余空格
3. 支持多答案，例如：`which/that`
4. 空答案判错
5. 结果中返回每一空的：
   - 用户答案
   - 标准答案
   - 是否正确
   - 语法标签
   - 解析

---

## 13. 后续数据库设计建议

虽然当前还没正式建库，但完全可以先按接口反推表结构。  
第一批建议至少包含：

- `users`
- `admin_accounts`
- `passages`
- `questions`
- `passage_meta`
- `practice_records`
- `practice_answers`

---
