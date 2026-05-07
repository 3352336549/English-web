import { escapeHTML, formatTime } from "../shared/utils/index.js";

export function renderAdminLoginPage({
  authDraft = {},
  authMessage = "",
  isSubmittingAuth = false
}) {
  return `
    <section class="admin-auth-shell">
      <article class="panel panel-padding">
        <div class="section-eyebrow">独立管理端</div>
        <h1 class="section-title">题库内容管理台</h1>
        <p class="section-desc">
          这里和学生端完全分开，专门负责维护篇章、试题、答案和解析。
          当前仍然是前端 mock 版本，保存的数据会写入浏览器本地。
        </p>
        <ul class="admin-simple-list">
          <li>新增篇章、新增题目、修改答案、修改解析</li>
          <li>设置草稿 / 已发布和首页推荐位</li>
          <li>保存后刷新学生端，就能看到最新展示结果</li>
          <li>演示账号：<code>admin</code> / <code>admin123</code></li>
        </ul>
      </article>

      <article class="auth-card">
        <div class="section-eyebrow">管理员登录</div>
        <h2 class="section-title">进入后台</h2>
        <p class="section-desc">建议单独开一个后台标签页维护题库，学生端用于验收展示效果。</p>
        ${authMessage ? `<div class="form-message is-error">${escapeHTML(authMessage)}</div>` : ""}
        <form class="auth-form" data-form="admin-login">
          <div class="field">
            <label for="admin-username">管理员账号</label>
            <input id="admin-username" name="username" type="text" value="${escapeHTML(authDraft.username || "")}" required ${isSubmittingAuth ? "disabled" : ""}>
          </div>
          <div class="field">
            <label for="admin-password">管理员密码</label>
            <input id="admin-password" name="password" type="password" value="${escapeHTML(authDraft.password || "")}" required ${isSubmittingAuth ? "disabled" : ""}>
          </div>
          <div class="action-row">
            <button class="button" type="submit" ${isSubmittingAuth ? "disabled" : ""}>${isSubmittingAuth ? "登录中..." : "进入管理台"}</button>
            <a class="button-ghost ${isSubmittingAuth ? "is-disabled" : ""}" href="../index.html" ${isSubmittingAuth ? 'aria-disabled="true" tabindex="-1"' : ""}>回学生端</a>
          </div>
        </form>
      </article>
    </section>
  `;
}

export function renderAdminConsole({
  adminSession,
  activeTab,
  contentMode = "search",
  dashboard,
  feedback = { type: "", message: "" },
  filters = {},
  availableYears = [],
  passageRows = [],
  selectedPassage = null,
  selectedQuestionId = null,
  passageDraft = {},
  questionDraft = {},
  userRows = []
}) {
  return `
    <header class="admin-console-topbar panel">
      <div class="admin-console-brand">
        <div>
          <div class="section-eyebrow">后台管理台</div>
          <h1 class="section-title">Grammar Studio 内容管理</h1>
          <p class="section-desc">当前登录：${escapeHTML(adminSession.name)} · ${escapeHTML(adminSession.role)}</p>
        </div>
        <div class="admin-toolbar">
          <a class="button-ghost" href="../index.html" target="_blank" rel="noreferrer">打开学生端</a>
          <button class="button-ghost" type="button" data-action="admin-logout">退出登录</button>
        </div>
      </div>

      <nav class="admin-console-nav" aria-label="后台标签">
        ${renderTabButton("总览", "overview", activeTab)}
        ${renderTabButton("题库管理", "content", activeTab)}
        ${renderTabButton("用户概览", "users", activeTab)}
      </nav>
    </header>

    ${feedback.message ? `<div class="surface-message ${feedback.type === "error" ? "is-error" : "is-info"}">${escapeHTML(feedback.message)}</div>` : ""}

    ${
      activeTab === "users"
        ? renderUsersTab(userRows)
        : activeTab === "content"
          ? renderContentTab({
              contentMode,
              filters,
              availableYears,
              passageRows,
              selectedPassage,
              selectedQuestionId,
              passageDraft,
              questionDraft
            })
          : renderOverviewTab(dashboard)
    }
  `;
}

function renderOverviewTab(dashboard) {
  return `
    <section class="admin-kpi-grid">
      ${renderMetricCard("篇章总数", dashboard.totalPassages)}
      ${renderMetricCard("题目总数", dashboard.totalQuestions)}
      ${renderMetricCard("已发布", dashboard.publishedCount)}
      ${renderMetricCard("草稿中", dashboard.draftCount)}
      ${renderMetricCard("推荐位", dashboard.featuredCount)}
      ${renderMetricCard("活跃用户", dashboard.activeUserCount)}
    </section>

    <section class="admin-summary-grid">
      <article class="panel panel-padding">
        <div class="section-header">
          <div>
            <div class="section-eyebrow">内容状态</div>
            <h2 class="section-title">当前题库盘点</h2>
          </div>
        </div>
        <div class="tag-row">
          <span class="pill">未出题篇章 ${dashboard.zeroQuestionCount} 篇</span>
          <span class="pill warm">注册用户 ${dashboard.registeredUserCount} 人</span>
          <span class="pill neutral">累计提交 ${dashboard.submissionCount} 次</span>
        </div>
        <div class="top-gap tag-row">
          ${dashboard.topTags.length ? dashboard.topTags.map((item) => `<span class="tag-chip">${escapeHTML(item.name)} · ${item.count} 题</span>`).join("") : `<span class="muted">还没有可统计的题目标签。</span>`}
        </div>
      </article>

      <article class="panel panel-padding">
        <div class="section-header">
          <div>
            <div class="section-eyebrow">学习薄弱点</div>
            <h2 class="section-title">学生高频回看考点</h2>
          </div>
        </div>
        ${
          dashboard.weakTags.length
            ? `<div class="tag-row">${dashboard.weakTags.map((item) => `<span class="tag-chip">${escapeHTML(item.name)} · ${item.count} 次</span>`).join("")}</div>`
            : `<p class="muted">目前还没有足够的提交记录，等学生开始刷题后，这里会慢慢有判断依据。</p>`
        }
      </article>
    </section>

    <section class="admin-summary-grid">
      <article class="panel panel-padding">
        <div class="section-header">
          <div>
            <div class="section-eyebrow">推荐位</div>
            <h2 class="section-title">首页优先展示的篇章</h2>
          </div>
        </div>
        ${
          dashboard.featuredPassages.length
            ? `<div class="admin-card-list">${dashboard.featuredPassages
                .map(
                  (item) => `
                    <article class="admin-card-row">
                      <div>
                        <strong>${escapeHTML(item.title)}</strong>
                        <p class="mini-note">${escapeHTML(item.year)} · ${escapeHTML(item.source)} · ${item.questionCount} 题</p>
                      </div>
                      <span class="status-chip good">已推荐</span>
                    </article>
                  `
                )
                .join("")}</div>`
            : `<p class="muted">还没有设置推荐位，学生端首页会按默认顺序展示。</p>`
        }
      </article>

      <article class="panel panel-padding">
        <div class="section-header">
          <div>
            <div class="section-eyebrow">最近提交</div>
            <h2 class="section-title">最新学习活动</h2>
          </div>
        </div>
        ${
          dashboard.recentSubmissions.length
            ? `<div class="admin-card-list">${dashboard.recentSubmissions
                .map(
                  (item) => `
                    <article class="admin-card-row">
                      <div>
                        <strong>${escapeHTML(item.nickname)}</strong>
                        <p class="mini-note">${escapeHTML(item.title)} · ${escapeHTML(item.grade)} · ${formatTime(item.createdAt)}</p>
                      </div>
                      <span class="status-chip ${item.accuracy >= 80 ? "good" : item.accuracy >= 60 ? "" : "bad"}">${item.accuracy}%</span>
                    </article>
                  `
                )
                .join("")}</div>`
            : `<p class="muted">当前还没有学生提交记录。</p>`
        }
      </article>
    </section>
  `;
}

function renderContentTab({
  contentMode,
  filters,
  availableYears,
  passageRows,
  selectedPassage,
  selectedQuestionId,
  passageDraft,
  questionDraft
}) {
  const questionRows = selectedPassage?.questions || [];
  const selectedPassageTitle = selectedPassage?.passage?.title || "";
  const selectedQuestionLabel = questionDraft?.blankNumber
    ? `第 ${questionDraft.blankNumber} 空`
    : "";
  const selectedQuestionTitle = questionDraft?.blankNumber
    ? `当前题目：第 ${questionDraft.blankNumber} 空`
    : "当前题目";

  if (contentMode === "search") {
    return renderContentSearchPage({
      filters,
      availableYears,
      passageRows
    });
  }

  return `
    <section class="admin-edit-page">
      <article class="panel panel-padding admin-edit-header">
        <div>
          <div class="section-eyebrow">${contentMode === "new" ? "新建篇章" : "篇章编辑"}</div>
          <h2 class="section-title">${contentMode === "new" ? "先把篇章建出来，再继续补题" : escapeHTML(selectedPassageTitle || passageDraft.title || "篇章内容修改")}</h2>
          <p class="section-desc">
            ${contentMode === "new" ? "这里是独立编辑页。先保存篇章基本信息，右侧题目区就可以继续新增和修改。" : "这是单独的编辑页面，左边改篇章，右边通过题号导航切换和修改题目。"}
          </p>
        </div>
        <div class="admin-toolbar">
          <a class="button-ghost" href="#content">返回篇章搜索</a>
          ${contentMode === "new" ? "" : `<button class="button-ghost" type="button" data-action="admin-delete-passage" data-passage-id="${passageDraft.id}">删除篇章</button>`}
        </div>
      </article>

      <section class="admin-edit-layout">
        <article class="panel panel-padding admin-question-panel">
          <div class="section-header">
            <div>
              <div class="section-eyebrow">左侧编辑区</div>
              <h2 class="section-title">篇章信息修改</h2>
              <p class="section-desc">
                ${passageDraft.id ? `当前篇章：${escapeHTML(selectedPassageTitle || passageDraft.title || "未命名篇章")}` : "先填好标题、来源、年份和原文，保存后再去右侧补题。"}
              </p>
            </div>
          </div>

          <form class="admin-form-grid" data-form="passage-editor">
            <input type="hidden" name="id" value="${escapeHTML(String(passageDraft.id || ""))}">
            <div class="field">
              <label for="passage-title">篇章标题</label>
              <input id="passage-title" name="title" type="text" value="${escapeHTML(passageDraft.title || "")}" required>
            </div>
            <div class="field">
              <label for="passage-source">篇章来源</label>
              <input id="passage-source" name="source" type="text" value="${escapeHTML(passageDraft.source || "")}" required>
            </div>
            <div class="field">
              <label for="passage-year">年份</label>
              <input id="passage-year" name="year" type="text" value="${escapeHTML(passageDraft.year || "")}" placeholder="例如 2022" required>
            </div>
            <div class="field">
              <label for="passage-status">发布状态</label>
              <select id="passage-status" name="status">
                <option value="draft" ${passageDraft.status === "draft" ? "selected" : ""}>草稿</option>
                <option value="published" ${passageDraft.status === "published" ? "selected" : ""}>已发布</option>
              </select>
            </div>
            <label class="admin-inline-check">
              <input type="checkbox" name="featured" value="true" ${passageDraft.featured ? "checked" : ""}>
              <span>首页推荐这篇内容</span>
            </label>
            <div class="field admin-span-2">
              <label for="passage-note">管理备注</label>
              <input id="passage-note" name="note" type="text" value="${escapeHTML(passageDraft.note || "")}" placeholder="例如：适合基础训练、待补充解析、首页推荐候选">
            </div>
            <div class="field admin-span-2 admin-passage-content-field">
              <label for="passage-content">篇章原文</label>
              <textarea id="passage-content" class="admin-large-textarea" name="content" rows="14" placeholder="在这里粘贴完整原文">${escapeHTML(passageDraft.content || "")}</textarea>
            </div>
            <div class="action-row admin-span-2">
              <button class="button" type="submit">保存篇章</button>
              <button class="button-ghost" type="button" data-action="admin-new-passage">清空并新建</button>
            </div>
          </form>
        </article>

        <article class="panel panel-padding admin-question-panel">
          <div class="section-header">
            <div>
              <div class="section-eyebrow">右侧编辑区</div>
              <h2 class="section-title">试题内容修改</h2>
              <p class="section-desc">
                ${
                  selectedPassage
                    ? selectedQuestionLabel
                      ? `当前题目：${escapeHTML(selectedPassageTitle)} · ${escapeHTML(selectedQuestionLabel)}`
                      : `当前篇章：${escapeHTML(selectedPassageTitle)}，可以先新增题目。`
                    : "先把左边篇章保存出来，这里就会出现题号导航和题目编辑表单。"
                }
              </p>
            </div>
            ${
              selectedPassage
                ? `<button class="button" type="button" data-action="admin-new-question" data-passage-id="${selectedPassage.passage.id}">新增题目</button>`
                : ""
            }
          </div>

          ${
            selectedPassage
              ? `
                <div class="admin-question-nav-shell">
                  <div class="admin-question-nav-header">
                    <div>
                      <div class="section-eyebrow">题号导航</div>
                      <h3 class="admin-subtitle">${escapeHTML(selectedPassage.passage.title)}</h3>
                    </div>
                    <span class="mini-note">${questionRows.length} 道题</span>
                  </div>
                  <div class="admin-question-chip-grid">
                    ${
                      questionRows.length
                        ? questionRows
                            .map(
                              (question) => `
                                <button
                                  class="admin-question-chip ${Number(selectedQuestionId) === Number(question.id) ? "is-active" : ""}"
                                  type="button"
                                  data-action="admin-select-question"
                                  data-question-id="${question.id}">
                                  ${question.blankNumber}
                                </button>
                              `
                            )
                            .join("")
                        : ""
                    }
                  </div>
                </div>

                <form class="admin-form-grid" data-form="question-editor">
                  <input type="hidden" name="id" value="${escapeHTML(String(questionDraft.id || ""))}">
                  <input type="hidden" name="passageId" value="${escapeHTML(String(questionDraft.passageId || selectedPassage.passage.id))}">
                  <div class="admin-span-2 admin-current-question">
                    <strong>${escapeHTML(selectedQuestionTitle)}</strong>
                    <span class="mini-note">${escapeHTML(questionDraft.correctAnswer || "还没有填写标准答案")}</span>
                  </div>
                  <div class="field">
                    <label for="question-blank-number">题号</label>
                    <input id="question-blank-number" name="blankNumber" type="number" min="1" value="${escapeHTML(String(questionDraft.blankNumber || 1))}" required>
                  </div>
                  <div class="field">
                    <label for="question-given-word">提示词</label>
                    <input id="question-given-word" name="givenWord" type="text" value="${escapeHTML(questionDraft.givenWord || "")}" placeholder="没有提示词可以留空">
                  </div>
                  <div class="field">
                    <label for="question-grammar-tag">语法标签</label>
                    <input id="question-grammar-tag" name="grammarTag" type="text" value="${escapeHTML(questionDraft.grammarTag || "")}" placeholder="例如 非谓语动词" required>
                  </div>
                  <div class="field">
                    <label for="question-difficulty">难度</label>
                    <select id="question-difficulty" name="difficulty">
                      <option value="简单" ${questionDraft.difficulty === "简单" ? "selected" : ""}>简单</option>
                      <option value="中等" ${questionDraft.difficulty === "中等" ? "selected" : ""}>中等</option>
                      <option value="困难" ${questionDraft.difficulty === "困难" ? "selected" : ""}>困难</option>
                      <option value="未标注" ${questionDraft.difficulty === "未标注" ? "selected" : ""}>未标注</option>
                    </select>
                  </div>
                  <div class="field admin-span-2">
                    <label for="question-text">题干</label>
                    <textarea id="question-text" class="admin-medium-textarea" name="questionText" rows="4" placeholder="例如：Question text...">${escapeHTML(questionDraft.questionText || "")}</textarea>
                  </div>
                  <div class="field">
                    <label for="question-answer">标准答案</label>
                    <input id="question-answer" name="correctAnswer" type="text" value="${escapeHTML(questionDraft.correctAnswer || "")}" placeholder="支持 which/that 这类多答案" required>
                  </div>
                  <div class="field">
                    <label for="question-type">题型</label>
                    <input id="question-type" name="type" type="text" value="${escapeHTML(questionDraft.type || "语法填空")}">
                  </div>
                  <div class="field admin-span-2">
                    <label for="question-explanation">解析</label>
                    <textarea id="question-explanation" class="admin-medium-textarea" name="explanation" rows="5" placeholder="解释为什么填这个答案">${escapeHTML(questionDraft.explanation || "")}</textarea>
                  </div>
                  <div class="action-row admin-span-2">
                    <button class="button" type="submit">保存题目</button>
                    <button class="button-ghost" type="button" data-action="admin-new-question" data-passage-id="${selectedPassage.passage.id}">新建空白题</button>
                    ${
                      questionDraft.id
                        ? `<button class="button-ghost" type="button" data-action="admin-delete-question" data-question-id="${questionDraft.id}">删除题目</button>`
                        : ""
                    }
                  </div>
                </form>
              `
              : `
                <section class="empty-panel">
                  <strong>先保存这篇文章</strong>
                  <p class="muted">篇章保存成功后，右侧会出现题号导航，你就可以按题号逐个进入修改。</p>
                </section>
              `
          }
        </article>
      </section>
    </section>
  `;
}

function renderContentSearchPage({ filters, availableYears, passageRows }) {
  return `
    <section class="admin-content-page">
      <section class="admin-filter-layout">
        <form class="filter-bar admin-filter-panel" data-form="admin-content-search">
          <div class="section-header">
            <div>
              <div class="section-eyebrow">篇章搜索</div>
              <h2 class="section-title">篇章筛选</h2>
            </div>
            <button class="button" type="button" data-action="admin-new-passage">新增篇章</button>
          </div>
          <p class="mini-note">这里只搜篇章。设置条件后点击搜索，再从结果里点进一篇开始修改。</p>

          <div class="filter-row admin-filter-row">
            <div class="field">
              <label for="admin-filter-year">年份</label>
              <select id="admin-filter-year" data-admin-filter="year">
                <option value="all">全部年份</option>
                ${[...new Set(availableYears)].sort((a, b) => Number(b) - Number(a)).map((year) => `<option value="${escapeHTML(year)}" ${filters.year === year ? "selected" : ""}>${escapeHTML(year)}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="admin-filter-status">状态</label>
              <select id="admin-filter-status" data-admin-filter="status">
                <option value="all" ${filters.status === "all" ? "selected" : ""}>全部状态</option>
                <option value="published" ${filters.status === "published" ? "selected" : ""}>已发布</option>
                <option value="draft" ${filters.status === "draft" ? "selected" : ""}>草稿</option>
              </select>
            </div>
            <div class="field admin-filter-search admin-span-2 field-inline-action">
              <label for="admin-filter-query">搜索</label>
              <div class="filter-inline-search">
                <input id="admin-filter-query" type="text" data-admin-filter="query" value="${escapeHTML(filters.query || "")}" placeholder="搜标题、来源、备注">
                <button class="button" type="submit">搜索篇章</button>
              </div>
            </div>
          </div>
          <p class="foot-note">当前筛到 ${passageRows.length} 篇，点一篇再进入单独的修改页面。</p>
        </form>

        ${
          passageRows.length
            ? `
              <section class="bank-grid admin-search-results">
                ${passageRows
                  .map(
                    (item) => `
                      <article class="passage-card admin-result-card">
                        <div class="meta-row">
                          <span class="pill">${escapeHTML(item.year)}</span>
                          <span class="pill warm">${item.questionCount} 题</span>
                          <span class="pill neutral">${escapeHTML(item.source)}</span>
                        </div>
                        <h3>${escapeHTML(item.title)}</h3>
                        <p class="muted">${escapeHTML(item.excerpt)}</p>
                        <div class="tag-row">
                          ${item.featured ? `<span class="tag-chip">首页推荐</span>` : ""}
                          ${item.tags.slice(0, 4).map((tag) => `<span class="tag-chip">${escapeHTML(tag)}</span>`).join("")}
                        </div>
                        <div class="bank-actions">
                          <button class="button" type="button" data-action="admin-open-passage-editor" data-passage-id="${item.id}">进入修改</button>
                        </div>
                      </article>
                    `
                  )
                  .join("")}
              </section>
            `
            : `
              <section class="empty-panel">
                <strong>没有搜到匹配篇章</strong>
                <p class="muted">可以放宽关键词，或者直接点击“新增篇章”。</p>
              </section>
            `
        }
      </section>
    </section>
  `;
}

function renderUsersTab(userRows) {
  return `
    <section class="panel panel-padding">
      <div class="section-header">
        <div>
          <div class="section-eyebrow">用户概览</div>
          <h2 class="section-title">学生练习情况</h2>
          <p class="section-desc">这里用当前浏览器本地已有的注册用户和练习记录做概览。</p>
        </div>
      </div>
      ${
        userRows.length
          ? `<div class="admin-users-grid">${userRows
              .map(
                (user) => `
                  <article class="admin-user-summary">
                    <div class="admin-row-top">
                      <strong>${escapeHTML(user.nickname)}</strong>
                      <span class="status-chip ${user.submissionCount ? "good" : ""}">${user.submissionCount ? "已练习" : "仅注册"}</span>
                    </div>
                    <p class="mini-note">${escapeHTML(user.username)} · ${escapeHTML(user.grade)} · ${formatTime(user.createdAt)}</p>
                    <div class="tag-row">
                      <span class="pill">${user.completedPassages} 篇</span>
                      <span class="pill warm">${user.submissionCount} 次提交</span>
                      <span class="pill neutral">平均 ${user.avgAccuracy}%</span>
                    </div>
                    <p class="mini-note">${user.latestTitle ? `${escapeHTML(user.latestTitle)} · 最近成绩 ${user.latestAccuracy}%` : "还没有练习记录"}</p>
                    ${user.weakTags.length ? `<div class="tag-row">${user.weakTags.slice(0, 4).map((item) => `<span class="tag-chip">${escapeHTML(item.name)} · ${item.count}</span>`).join("")}</div>` : ""}
                  </article>
                `
              )
              .join("")}</div>`
          : `<section class="empty-panel"><strong>还没有注册用户</strong><p class="muted">等学生开始注册和刷题后，这里就会有数据。</p></section>`
      }
    </section>
  `;
}

function renderTabButton(label, tab, activeTab) {
  return `
    <button
      class="admin-console-nav-button ${activeTab === tab ? "is-active" : ""}"
      type="button"
      data-action="admin-switch-tab"
      data-tab="${tab}">
      ${label}
    </button>
  `;
}

function renderMetricCard(label, value) {
  return `
    <article class="stat-card">
      <span class="stat-label">${label}</span>
      <strong>${value}</strong>
    </article>
  `;
}
