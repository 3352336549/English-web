import { buildResultAdvice } from "../shared/services/data-service.js";
import { buildHash, cleanString, escapeHTML, formatTime } from "../shared/utils/index.js";

// views.js 是“视图层”文件。
// 你可以把它理解成一个模板仓库：
// 外面把数据准备好，传进来；
// 这里把这些数据拼成 HTML 字符串，再交给页面显示。
// 所以这里不负责判分、不负责存储，只负责“长什么样”。

// 顶部导航的渲染规则：
// 1. 所有人都能看到首页、题库
// 2. 登录后显示个人中心和退出
// 3. 未登录时显示登录、注册
export function renderNav(route, currentUser) {
  const links = [
    { href: "#home", label: "首页", active: route.view === "home" },
    { href: "#bank", label: "题库", active: route.view === "bank" }
  ];

  if (currentUser) {
    links.push({
      href: "#profile",
      label: currentUser.nickname || currentUser.username,
      active: route.view === "profile"
    });
  } else {
    links.push(
      { href: "#login", label: "登录", active: route.view === "login" },
      { href: "#register", label: "注册", active: route.view === "register" }
    );
  }

  return `
    ${links
      .map(
        (link) =>
          `<a class="nav-link ${link.active ? "is-active" : ""}" href="${link.href}">${escapeHTML(link.label)}</a>`
      )
      .join("")}
    ${
      currentUser
        ? `<button class="nav-link nav-button" type="button" data-action="logout">退出</button>`
        : ""
    }
  `;
}

// 首页主要做三件事：
// 1. 告诉用户这个网站是干什么的
// 2. 给出适合当前状态的推荐入口
// 3. 展示高频考点和推荐真题
export function renderHomePage({
  library,
  currentUser,
  practiceState,
  summary,
  featuredPassages = []
}) {
  const latestResult = practiceState.lastResult;
  const topTags = library.tags.slice(0, 6);
  const promotedPassages = featuredPassages.length ? featuredPassages : library.passages.slice(0, 3);
  // 首页优先展示最近一次练习的薄弱点；没有记录时退回到高频考点。
  const currentFocus = latestResult?.focusTags?.slice(0, 3) || topTags.slice(0, 3).map((item) => item.name);

  return `
    <section class="hero-panel hero-panel-home student-home-top">
      <div class="student-home-main">
        <div class="hero-eyebrow">上海高考英语 · 语法填空专项训练</div>
        <h1 class="hero-title">先做整篇，再看错因，把语法点练成会用的反应</h1>
        <p class="hero-desc">
          这不是单纯的题库展示，而是一套围绕上海高考语法填空的练习流程。
          先挑一篇做，再直接看解析和推荐题，能更快把薄弱点补起来。
        </p>
        <div class="hero-actions">
          <a class="button" href="#bank">开始刷题</a>
          <a class="button-secondary" href="${latestResult ? `#result/${latestResult.passageId}` : currentUser ? "#profile" : "#login"}">
            ${latestResult ? "继续上次复盘" : currentUser ? "进入我的学习" : "登录保存记录"}
          </a>
        </div>

        <div class="student-metric-strip">
          <article class="student-metric-card">
            <span class="stat-label">真题篇章</span>
            <strong>${library.passages.length}</strong>
          </article>
          <article class="student-metric-card">
            <span class="stat-label">题目总数</span>
            <strong>${library.totalQuestions}</strong>
          </article>
          <article class="student-metric-card">
            <span class="stat-label">高频考点</span>
            <strong>${library.tags.length}</strong>
          </article>
          <article class="student-metric-card">
            <span class="stat-label">已完成篇章</span>
            <strong>${summary.completedPassages}</strong>
          </article>
        </div>
      </div>

      <div class="student-home-side">
        <article class="student-side-card">
          <span class="hero-callout-label">${currentUser ? "当前进度" : "入门建议"}</span>
          <strong>${currentUser ? `欢迎回来，${escapeHTML(currentUser.nickname || currentUser.username)}` : "先从近两年真题开始"}</strong>
          <p class="muted">
            ${
              currentUser
                ? latestResult
                  ? `你最近一次练习的准确率是 ${latestResult.accuracy}% ，建议先回看 ${escapeHTML(currentFocus.join("、"))}。`
                  : `你已经累计提交 ${summary.submissionCount} 次练习，今天可以先完成一篇整篇训练。`
                : "建议先做 2022 或 2021 年的整篇真题，先熟悉上海高考语法填空的出题节奏。"
            }
          </p>
          <div class="tag-row">
            ${renderChips(currentFocus, "tag-chip")}
          </div>
        </article>

        <article class="student-side-card student-side-muted">
          <strong>${latestResult ? "最近一次成绩" : "做完以后会看到什么"}</strong>
          <p class="muted">
            ${
              latestResult
                ? `${escapeHTML(latestResult.title)} · 答对 ${latestResult.correctCount} 空，待回看 ${latestResult.wrongCount} 空。`
                : "做完一篇之后，系统会直接给出答案、语法解释和同类推荐，不用来回切页面。"
            }
          </p>
          <div class="student-inline-actions">
            <a class="button-ghost" href="#bank">去题库</a>
            ${currentUser ? `<a class="button-ghost" href="#profile">看记录</a>` : `<a class="button-ghost" href="#register">建账号</a>`}
          </div>
        </article>
      </div>
    </section>

    <section class="student-quick-grid">
      <article class="panel panel-padding student-quick-card">
        <div class="section-header">
          <div>
            <div class="section-eyebrow">今天先做什么</div>
            <h2 class="section-title">一个比较顺的练法</h2>
          </div>
        </div>
        <div class="student-steps">
          <article class="student-step">
            <span class="path-index">01</span>
            <div>
              <strong>先做一篇完整真题</strong>
              <p class="muted">先别拆成单题练，先把上下文语感做出来。</p>
            </div>
          </article>
          <article class="student-step">
            <span class="path-index">02</span>
            <div>
              <strong>做完马上看解析</strong>
              <p class="muted">不要只看答案，要把为什么填这个结构看明白。</p>
            </div>
          </article>
          <article class="student-step">
            <span class="path-index">03</span>
            <div>
              <strong>顺着错题继续补</strong>
              <p class="muted">把同类语法点连续刷几道，比跳来跳去更有效。</p>
            </div>
          </article>
        </div>
      </article>

      <article class="panel panel-padding student-quick-card">
        <div class="section-header">
          <div>
            <div class="section-eyebrow">高频考点</div>
            <h2 class="section-title">先把最常考的几类练熟</h2>
          </div>
          <a class="button-ghost" href="#bank">去题库筛题</a>
        </div>
        <div class="tag-row">
          ${topTags.map((item) => `<span class="tag-chip">${escapeHTML(item.name)} · ${item.count} 题</span>`).join("")}
        </div>
      </article>

      <article class="panel panel-padding student-quick-card">
        <div class="section-header">
          <div>
            <div class="section-eyebrow">当前建议</div>
            <h2 class="section-title">${latestResult ? "先从这几个点回看" : "先选近年的一篇"}</h2>
          </div>
        </div>
        <p class="muted">
          ${
            latestResult
              ? `你上一次的薄弱点主要集中在 ${escapeHTML(currentFocus.join("、"))}，先顺着这些点往下刷会更有针对性。`
              : "如果你刚开始用，建议先做 2022 年或 2021 年的整篇真题，先熟悉出题密度和空位节奏。"
          }
        </p>
        <div class="tag-row">
          ${renderChips(currentFocus, "tag-chip")}
        </div>
      </article>
    </section>

    <section class="panel panel-padding student-feature-section">
      <div class="section-header">
        <div>
          <div class="section-eyebrow">推荐真题</div>
          <h2 class="section-title">先从这些篇章开始</h2>
          <p class="section-desc">优先展示近年和推荐篇章，方便直接进入练习。</p>
        </div>
      </div>
      ${
        promotedPassages.length
          ? `
            <div class="featured-grid">
              ${promotedPassages.map((passage) => renderFeaturedPassageCard(passage)).join("")}
            </div>
          `
              : `
            <section class="empty-panel">
              <strong>当前还没有发布中的真题篇章</strong>
              <p class="muted">可以先去独立管理端把需要展示的内容发布出来。</p>
            </section>
          `
      }
    </section>
  `;
}

// 题库页展示的是“筛选后的篇章列表”。
// 注意：真正的筛选逻辑不在这里，
// 这里拿到 passages 后只负责把结果渲染出来。
export function renderBankPage({ library, filters, passages, currentUser }) {
  return `
    <section class="section-header">
      <div>
        <div class="section-eyebrow">题库</div>
        <h1 class="section-title">按年份、考点和关键词筛题</h1>
        <p class="section-desc">先选一篇完整真题开始做，也可以直接盯着薄弱语法点刷。</p>
      </div>
      <div class="bank-actions">
        <a class="button-ghost" href="${currentUser ? "#profile" : "#login"}">${currentUser ? "查看个人中心" : "登录保存记录"}</a>
      </div>
    </section>

    <section class="student-bank-summary">
      <article class="student-bank-card">
        <span class="stat-label">当前篇章</span>
        <strong>${passages.length}</strong>
      </article>
      <article class="student-bank-card">
        <span class="stat-label">总题量</span>
        <strong>${passages.reduce((sum, item) => sum + item.questionCount, 0)}</strong>
      </article>
      <article class="student-bank-card">
        <span class="stat-label">覆盖年份</span>
        <strong>${library.years.length}</strong>
      </article>
    </section>

    <form class="filter-bar" data-form="bank-search">
      <div class="filter-row">
        <div class="field">
          <label for="filter-year">年份</label>
          <select id="filter-year" data-filter="year">
            <option value="all">全部年份</option>
            ${library.years
              .map(
                (year) =>
                  `<option value="${escapeHTML(year)}" ${filters.year === year ? "selected" : ""}>${escapeHTML(year)}</option>`
              )
              .join("")}
          </select>
        </div>

        <div class="field">
          <label for="filter-tag">语法考点</label>
          <select id="filter-tag" data-filter="tag">
            <option value="all">全部考点</option>
            ${library.tags
              .map(
                (item) =>
                  `<option value="${escapeHTML(item.name)}" ${filters.tag === item.name ? "selected" : ""}>${escapeHTML(item.name)} (${item.count})</option>`
              )
              .join("")}
          </select>
        </div>

        <div class="field field-inline-action">
          <label for="filter-query">关键词</label>
          <div class="filter-inline-search">
            <input id="filter-query" data-filter="query" type="text" value="${escapeHTML(filters.query)}" placeholder="例如 entrepreneur / aurora / disease">
            <button class="button" type="submit">搜索篇章</button>
          </div>
        </div>
      </div>
      <p class="foot-note">设置好条件后点击“搜索篇章”。当前筛到 ${passages.length} 篇，挑一篇开始做就可以。</p>
    </form>

    ${
      passages.length
        ? `<section class="bank-grid">${passages.map((passage) => renderPassageCard(passage)).join("")}</section>`
        : `
          <section class="empty-panel">
            <strong>没有筛到对应篇章</strong>
            <p class="muted">可以把年份或考点放宽一点，再试试看。</p>
          </section>
        `
    }
  `;
}

// 练习页是最重要的交互页面。
// 左边是篇章原文，右边是答题卡；
// 同一空号会在两个区域都出现，方便来回定位。
export function renderPracticePage({
  passage,
  answers,
  currentUser,
  isSubmitting = false,
  feedback = null
}) {
  const answeredCount = Object.values(answers || {}).filter((value) => cleanString(value)).length;

  return `
    <section class="section-header">
      <div>
        <div class="section-eyebrow">篇章练习</div>
        <h1 class="section-title">${escapeHTML(passage.title)}</h1>
        <p class="section-desc">${escapeHTML(passage.source)} · 共 ${passage.questionCount} 题 · ${renderInlineTags(passage.tags.slice(0, 4))}</p>
      </div>
      <div class="bank-actions">
        <a class="button-ghost" href="#bank">返回题库</a>
      </div>
    </section>

    ${
      currentUser
        ? ""
        : `
          <section class="panel panel-padding">
            <div class="section-header">
              <div>
                <div class="section-eyebrow">未登录也能练题</div>
                <p class="section-desc">现在可以直接开始做题；如果想保存记录和成绩，再登录也来得及。</p>
              </div>
              <a class="button-ghost" href="#login">去登录</a>
            </div>
          </section>
        `
    }

    <section class="practice-layout practice-layout-study">
      <article class="practice-card practice-panel practice-reading-panel">
        <div class="passage-header">
          <div>
            <div class="question-meta">
              <span class="pill">${escapeHTML(passage.year)}</span>
              <span class="pill warm">${passage.questionCount} 空</span>
            </div>
            <h2 class="result-title top-gap">篇章原文</h2>
          </div>
          <span class="status-chip">${answeredCount}/${passage.questionCount} 已作答</span>
        </div>

        <div class="passage-body practice-reading-body">
          <div class="progress-strip">
            ${passage.questions
              .map((question) => {
                const value = cleanString(answers[question.blankNumber]);
                return `
                  <button
                    class="progress-pill ${value ? "is-filled" : ""}"
                    type="button"
                    data-action="scroll-question"
                    data-target="question-${question.blankNumber}"
                    data-blank-number="${question.blankNumber}">
                    ${question.blankNumber}
                  </button>
                `;
              })
              .join("")}
          </div>

          <div class="passage-text practice-reading-text">
            ${renderPassageContent(passage)}
          </div>
        </div>
      </article>

      <aside class="practice-card sticky practice-panel practice-answer-panel">
        <div class="passage-header">
          <div>
            <h2 class="result-title">答题区</h2>
            <p class="mini-note">右侧题目区可以单独滚动，做题时左边文章会一直保留。</p>
          </div>
        </div>

        <div class="progress-strip practice-answer-strip">
          ${passage.questions
            .map((question) => {
              const value = cleanString(answers[question.blankNumber]);
              return `
                <button
                  class="progress-pill ${value ? "is-filled" : ""}"
                  type="button"
                  data-action="scroll-question"
                  data-target="question-${question.blankNumber}"
                  data-blank-number="${question.blankNumber}">
                  ${question.blankNumber}
                </button>
              `;
            })
            .join("")}
        </div>

        <div class="question-list practice-question-list">
          ${passage.questions.map((question) => renderQuestionCard(question, answers, isSubmitting)).join("")}
        </div>

        <div class="practice-submit practice-submit-bar">
          ${renderSurfaceMessage(feedback)}
          <p class="mini-note" id="practice-progress-note">当前已填写 ${answeredCount}/${passage.questionCount} 空，空着也可以提交。</p>
          <div class="action-row">
            <button class="button" type="button" data-action="submit-practice" data-passage-id="${passage.id}" ${isSubmitting ? "disabled" : ""}>${isSubmitting ? "正在批改..." : "提交批改"}</button>
            <button class="button-ghost" type="button" data-action="reset-practice" data-passage-id="${passage.id}" ${isSubmitting ? "disabled" : ""}>清空本篇答案</button>
          </div>
        </div>
      </aside>
    </section>
  `;
}

// 结果页把批改结果映射成字典，方便原文中的空号和右侧解析卡片联动。
// detailMap 的结构类似：
// { 1: 第1空详情, 2: 第2空详情, ... }
export function renderResultPage({ passage, result }) {
  const detailMap = Object.fromEntries(result.details.map((item) => [item.blankNumber, item]));

  return `
    <section class="score-panel">
      <div class="score-header">
        <div>
          <div class="hero-eyebrow score-eyebrow">提交完成</div>
          <h1 class="hero-title hero-title-compact">${escapeHTML(passage.title)}</h1>
          <p class="muted">做对的继续保持，做错的直接看解析，再顺着推荐题往下刷。</p>
        </div>
      </div>

      <div class="score-main">
        <article class="score-box">
          <span>准确率</span>
          <strong>${result.accuracy}%</strong>
        </article>
        <article class="score-box">
          <span>答对</span>
          <strong>${result.correctCount}</strong>
        </article>
        <article class="score-box">
          <span>待回看</span>
          <strong>${result.wrongCount}</strong>
        </article>
      </div>

      <div class="score-actions top-gap">
        <a class="button-ghost" href="${buildHash("practice", passage.id)}">再练一遍</a>
        <a class="button-secondary" href="#bank">换一篇继续</a>
      </div>
    </section>

    <section class="result-layout result-layout-review">
      <article class="practice-card practice-panel practice-reading-panel result-reading-panel">
        <div class="passage-header">
          <div>
            <h2 class="result-title">原文对照</h2>
            <p class="mini-note">左边一直保留原文，点空号就能和右侧解析联动查看。</p>
          </div>
          <span class="status-chip">${result.correctCount}/${result.details.length} 已批改</span>
        </div>

        <div class="progress-strip">
          ${result.details
            .map(
              (item) => `
                <button
                  class="progress-pill ${item.isCorrect ? "is-correct" : "is-wrong"}"
                  type="button"
                  data-action="scroll-question"
                  data-target="analysis-${item.blankNumber}"
                  data-blank-number="${item.blankNumber}">
                  ${item.blankNumber}
                </button>
              `
            )
            .join("")}
        </div>

        <div class="passage-body practice-reading-body result-reading-body">
          <div class="passage-text practice-reading-text">
            ${renderPassageContent(passage, detailMap)}
          </div>
        </div>
      </article>

      <aside class="practice-card sticky practice-panel practice-answer-panel result-analysis-panel">
        <div class="passage-header">
          <div>
            <h2 class="result-title">逐题解析</h2>
            <p class="mini-note">${escapeHTML(buildResultAdvice(result))}</p>
          </div>
          <span class="status-chip ${result.wrongCount ? "bad" : "good"}">${result.wrongCount ? `${result.wrongCount} 空待回看` : "全部答对"}</span>
        </div>

        <div class="question-meta">
          ${renderChips(result.focusTags, "tag-chip")}
        </div>

        <div class="progress-strip practice-answer-strip result-answer-strip">
          ${result.details
            .map(
              (item) => `
                <button
                  class="progress-pill ${item.isCorrect ? "is-correct" : "is-wrong"}"
                  type="button"
                  data-action="scroll-question"
                  data-target="analysis-${item.blankNumber}"
                  data-blank-number="${item.blankNumber}">
                  ${item.blankNumber}
                </button>
              `
            )
            .join("")}
        </div>

        <div class="question-list practice-question-list result-analysis-list">
          ${result.details.map((item) => renderAnalysisCard(item)).join("")}
        </div>

        <div class="practice-submit practice-submit-bar result-submit-bar">
          <p class="mini-note">提交时间：${formatTime(result.createdAt)}</p>
          <div class="action-row">
            <a class="button" href="${buildHash("practice", passage.id)}">继续复盘</a>
            <a class="button-ghost" href="#profile">查看个人中心</a>
          </div>
        </div>
      </aside>
    </section>

    <section>
      <div class="section-header">
        <div>
          <div class="section-eyebrow">继续练</div>
          <h2 class="section-title">根据薄弱点继续刷相近题</h2>
        </div>
      </div>
      ${
        result.recommendations.length
          ? `<div class="recommend-grid">${result.recommendations.map((item) => renderRecommendationCard(item)).join("")}</div>`
          : `
            <section class="empty-panel">
              <strong>当前没有更多推荐题</strong>
              <p class="muted">可以直接回到题库继续选一篇。</p>
            </section>
          `
      }
    </section>
  `;
}

// 登录页只负责渲染表单。
// 点击提交以后，真正的处理逻辑在 main.js 的 handleSubmit 里。
export function renderLoginPage({ message = "", isSubmitting = false, values = {} } = {}) {
  return `
    <section class="auth-layout">
      <article class="auth-card">
        <div class="section-eyebrow">登录</div>
        <h1 class="section-title">回到你的练习进度</h1>
        <p class="section-desc">登录后可以在个人中心查看最近练习记录和成绩变化。</p>
        ${renderSurfaceMessage(message ? { type: "error", message } : null, "form-message")}

        <form class="auth-form" data-form="login">
          <div class="field">
            <label for="login-username">用户名</label>
            <input id="login-username" name="username" type="text" placeholder="请输入用户名" required value="${escapeHTML(values.username || "")}" ${isSubmitting ? "disabled" : ""}>
          </div>
          <div class="field">
            <label for="login-password">密码</label>
            <input id="login-password" name="password" type="password" placeholder="请输入密码" required value="${escapeHTML(values.password || "")}" ${isSubmitting ? "disabled" : ""}>
          </div>
          <div class="action-row">
            <button class="button" type="submit" ${isSubmitting ? "disabled" : ""}>${isSubmitting ? "登录中..." : "登录"}</button>
            <a class="button-ghost ${isSubmitting ? "is-disabled" : ""}" href="#register" ${isSubmitting ? 'aria-disabled="true" tabindex="-1"' : ""}>还没有账号？去注册</a>
          </div>
        </form>
      </article>
    </section>
  `;
}

// 注册页和登录页一样，负责展示表单，不直接处理提交逻辑。
export function renderRegisterPage({ message = "", isSubmitting = false, values = {} } = {}) {
  return `
    <section class="auth-layout">
      <article class="auth-card">
        <div class="section-eyebrow">注册</div>
        <h1 class="section-title">先建一个学习账号</h1>
        <p class="section-desc">注册后可以保存练习记录、最近一次成绩和个人中心里的学习统计。</p>
        ${renderSurfaceMessage(message ? { type: "error", message } : null, "form-message")}

        <form class="auth-form" data-form="register">
          <div class="field">
            <label for="register-username">用户名</label>
            <input id="register-username" name="username" type="text" placeholder="建议用英文或拼音" required value="${escapeHTML(values.username || "")}" ${isSubmitting ? "disabled" : ""}>
          </div>
          <div class="field">
            <label for="register-password">密码</label>
            <input id="register-password" name="password" type="password" placeholder="至少 6 位" required value="${escapeHTML(values.password || "")}" ${isSubmitting ? "disabled" : ""}>
          </div>
          <div class="field">
            <label for="register-confirm-password">确认密码</label>
            <input id="register-confirm-password" name="confirmPassword" type="password" placeholder="再输入一次密码" required value="${escapeHTML(values.confirmPassword || "")}" ${isSubmitting ? "disabled" : ""}>
          </div>
          <div class="field">
            <label for="register-nickname">昵称</label>
            <input id="register-nickname" name="nickname" type="text" placeholder="页面显示名称，可不填" value="${escapeHTML(values.nickname || "")}" ${isSubmitting ? "disabled" : ""}>
          </div>
          <div class="field">
            <label for="register-grade">年级</label>
            <input id="register-grade" name="grade" type="text" placeholder="例如 高三 / 高二" value="${escapeHTML(values.grade || "")}" ${isSubmitting ? "disabled" : ""}>
          </div>
          <div class="action-row">
            <button class="button" type="submit" ${isSubmitting ? "disabled" : ""}>${isSubmitting ? "注册中..." : "注册并登录"}</button>
            <a class="button-ghost ${isSubmitting ? "is-disabled" : ""}" href="#login" ${isSubmitting ? 'aria-disabled="true" tabindex="-1"' : ""}>已有账号？去登录</a>
          </div>
        </form>
      </article>
    </section>
  `;
}

// 个人中心集中展示一个用户的学习状态。
// summary 是数据层提前算好的统计结果，视图层只负责把它显示出来。
export function renderProfilePage({ currentUser, summary, practiceState }) {
  if (!currentUser) {
    return `
      <section class="empty-panel">
        <strong>还没有登录</strong>
        <p class="muted">登录后才能看到你的练习记录、最近成绩和常错语法点。</p>
        <div class="action-row center-row">
          <a class="button" href="#login">去登录</a>
          <a class="button-ghost" href="#register">先注册</a>
        </div>
      </section>
    `;
  }

  const latestResult = practiceState.lastResult;

  return `
    <section class="profile-layout">
      <article class="profile-card profile-main">
        <div class="section-eyebrow">个人中心</div>
        <h1 class="section-title">${escapeHTML(currentUser.nickname || currentUser.username)}</h1>
        <p class="section-desc">用户名：${escapeHTML(currentUser.username)} · ${escapeHTML(currentUser.grade || "高三")} · 注册时间 ${formatTime(currentUser.createdAt)}</p>

        <div class="metrics-grid">
          <article class="stat-card">
            <span class="stat-label">完成篇章</span>
            <strong>${summary.completedPassages}</strong>
          </article>
          <article class="stat-card">
            <span class="stat-label">提交次数</span>
            <strong>${summary.submissionCount}</strong>
          </article>
          <article class="stat-card">
            <span class="stat-label">平均准确率</span>
            <strong>${summary.avgAccuracy}%</strong>
          </article>
        </div>
      </article>

      <article class="profile-card">
        <div class="passage-header">
          <div>
            <h2 class="result-title">最近一次成绩</h2>
            <p class="mini-note">${latestResult ? escapeHTML(latestResult.title) : "还没有提交记录"}</p>
          </div>
        </div>
        ${
          latestResult
            ? `
              <div class="question-meta">
                <span class="pill">${escapeHTML(latestResult.year)}</span>
                <span class="pill warm">准确率 ${latestResult.accuracy}%</span>
              </div>
              <div class="practice-submit">
                <div class="action-row">
                  <a class="button" href="${buildHash("result", latestResult.passageId)}">查看讲解</a>
                  <a class="button-ghost" href="${buildHash("practice", latestResult.passageId)}">再练一遍</a>
                </div>
              </div>
            `
            : `<p class="muted">先去做一篇题，这里会自动生成你的最近成绩。</p>`
        }
      </article>
    </section>

    <section class="result-grid">
      <article class="profile-card">
        <div class="passage-header">
          <div>
            <h2 class="result-title">常回看的语法点</h2>
            <p class="mini-note">最近练习里出现比较多的薄弱点</p>
          </div>
        </div>
        ${
          summary.weakTags.length
            ? `<div class="tag-row">${summary.weakTags
                .map((item) => `<span class="tag-chip">${escapeHTML(item.name)} · ${item.count} 次</span>`)
                .join("")}</div>`
            : `<p class="muted">你还没有足够的练习记录，先去做几篇题吧。</p>`
        }
      </article>

      <article class="profile-card">
        <div class="passage-header">
          <div>
            <h2 class="result-title">最好成绩</h2>
            <p class="mini-note">最近练习中的最高准确率</p>
          </div>
        </div>
        <strong class="profile-score">${summary.bestAccuracy}%</strong>
      </article>
    </section>

    <section class="profile-card">
      <div class="section-header">
        <div>
          <div class="section-eyebrow">最近记录</div>
          <h2 class="section-title">继续从最近做过的题接着练</h2>
        </div>
      </div>
      ${
        practiceState.history?.length
          ? `
            <div class="history-list">
              ${practiceState.history
                .map(
                  (item) => `
                    <article class="history-item">
                      <div>
                        <strong>${escapeHTML(item.title)}</strong>
                        <p class="mini-note">${escapeHTML(item.year)} · ${formatTime(item.createdAt)} · 准确率 ${item.accuracy}%</p>
                      </div>
                      <a class="button-ghost" href="${buildHash("practice", item.passageId)}">再做一遍</a>
                    </article>
                  `
                )
                .join("")}
            </div>
          `
          : `<p class="muted">还没有练习记录，先去题库挑一篇开始。</p>`
      }
    </section>
  `;
}

// 找不到题目、找不到结果记录时，用统一的兜底页面提醒用户。
export function renderMissingPage(message, href, label) {
  return `
    <section class="empty-panel">
      <strong>${escapeHTML(message)}</strong>
      <p class="muted">可以先回到题库重新选择一篇。</p>
      <a class="button" href="${href}">${escapeHTML(label)}</a>
    </section>
  `;
}

// 如果题库 JSON 加载失败，就渲染错误说明页。
export function renderLoadError(error, { apiMode = "mock" } = {}) {
  return `
    <section class="empty-panel">
      <strong>题库没有成功加载</strong>
      <p class="muted">${escapeHTML(error.message || "未知错误")}</p>
      ${
        apiMode === "backend"
          ? `
            <p class="muted">当前前端已经切到后端接口模式。优先检查 <code>/api/passages</code>、<code>/api/passages/:id</code> 是否能从浏览器正常访问。</p>
            <p class="muted">如果页面和接口不在同一个域名下，还要确认服务器代理或跨域配置已经准备好。</p>
          `
          : `
            <p class="muted">如果你是直接双击打开 <code>index.html</code>，浏览器通常会拦截本地 JSON 读取。建议在当前目录运行：</p>
            <pre class="panel panel-pre"><code>python -m http.server 5500</code></pre>
            <p class="muted">然后访问 <code>http://localhost:5500</code>。</p>
          `
      }
    </section>
  `;
}

// 题库列表中的普通文章卡片。
function renderPassageCard(passage) {
  return `
    <article class="passage-card">
      <div class="meta-row">
        <span class="pill">${escapeHTML(passage.year)}</span>
        <span class="pill warm">${passage.questionCount} 空</span>
        <span class="pill neutral">${escapeHTML(passage.source)}</span>
      </div>
      <h3>${escapeHTML(passage.title)}</h3>
      <p class="muted">${escapeHTML(passage.excerpt)}</p>
      <div class="tag-row">
        ${renderChips(passage.tags.slice(0, 5), "tag-chip")}
      </div>
      <div class="bank-actions">
        <a class="button" href="${buildHash("practice", passage.id)}">开始练习</a>
      </div>
    </article>
  `;
}

// 首页精选区的简版卡片。
function renderFeaturedPassageCard(passage) {
  return `
    <article class="featured-card">
      <div class="meta-row">
        <span class="pill">${escapeHTML(passage.year)}</span>
        <span class="pill warm">${passage.questionCount} 空</span>
      </div>
      <h3>${escapeHTML(passage.title)}</h3>
      <p class="muted">${escapeHTML(passage.excerpt)}</p>
      <div class="tag-row">
        ${renderChips(passage.tags.slice(0, 3), "tag-chip")}
      </div>
      <a class="button-ghost" href="${buildHash("practice", passage.id)}">开始这篇</a>
    </article>
  `;
}

// 右侧答题区的单题卡片。
// 这里埋了很多 data-* 属性，后面点击、输入、聚焦时，
// 入口文件就是靠这些属性判断“当前操作的是哪一空”。
function renderQuestionCard(question, answers, isDisabled = false) {
  const answer = cleanString(answers[question.blankNumber]);
  const status = answer ? "已填写" : "待填写";

  return `
    <article class="question-card" id="question-${question.blankNumber}" data-blank-number="${question.blankNumber}">
      <div class="question-top">
        <div>
          <div class="question-meta">
            <span class="question-number">第 ${question.blankNumber} 空</span>
            <span class="pill">${escapeHTML(question.grammarTag)}</span>
            <span class="pill neutral">${escapeHTML(question.difficulty)}</span>
          </div>
        </div>
        <span class="status-chip ${answer ? "good" : ""}">${status}</span>
      </div>

      ${question.givenWord ? `<div class="given-word"><span class="pill warm">提示词：${escapeHTML(question.givenWord)}</span></div>` : ""}

      ${question.questionText ? `<p class="mini-note question-stem">${escapeHTML(question.questionText)}</p>` : ""}

      <label class="field-note" for="answer-${question.blankNumber}">填写答案</label>
      <input
        id="answer-${question.blankNumber}"
        class="answer-input"
        type="text"
        data-answer-input="true"
        data-passage-id="${question.passageId}"
        data-blank-number="${question.blankNumber}"
        autocomplete="off"
        placeholder="${question.givenWord ? `根据提示词 ${escapeHTML(question.givenWord)} 作答` : "请输入答案"}"
        value="${escapeHTML(answer)}"
        ${isDisabled ? "disabled" : ""}
      >
    </article>
  `;
}

// 结果页右侧的逐题解析卡片。
// 每张卡片都对应 buildResult 生成的一条 detail 数据。
function renderAnalysisCard(item) {
  return `
    <article
      class="result-card analysis-card ${item.isCorrect ? "is-correct" : "is-wrong"}"
      id="analysis-${item.blankNumber}"
      data-blank-number="${item.blankNumber}">
      <div class="analysis-top">
        <div class="analysis-meta">
          <span class="question-number">第 ${item.blankNumber} 空</span>
          <span class="pill">${escapeHTML(item.grammarTag)}</span>
          <span class="pill neutral">${escapeHTML(item.difficulty)}</span>
          ${item.givenWord ? `<span class="pill warm">提示词：${escapeHTML(item.givenWord)}</span>` : ""}
        </div>
        <span class="status-chip ${item.isCorrect ? "good" : "bad"}">${item.isCorrect ? "答对了" : "需要回看"}</span>
      </div>

      ${item.questionText ? `<p class="mini-note question-stem">${escapeHTML(item.questionText)}</p>` : ""}

      <div class="analysis-grid">
        <div class="analysis-cell">
          <span>你的答案</span>
          <p>${escapeHTML(item.userAnswer || "未作答")}</p>
        </div>
        <div class="analysis-cell">
          <span>标准答案</span>
          <p>${escapeHTML(item.correctAnswer)}</p>
        </div>
      </div>

      <p class="muted">${escapeHTML(item.explanation)}</p>
    </article>
  `;
}

// 推荐卡片强调“为什么推荐”。
// 所以会把第几空、考点、难度这些信息突出显示出来。
function renderRecommendationCard(item) {
  return `
    <article class="recommend-card">
      <div class="meta-row">
        <span class="pill">${escapeHTML(item.year)}</span>
        <span class="pill warm">${escapeHTML(item.grammarTag)}</span>
        <span class="pill neutral">${escapeHTML(item.difficulty)}</span>
      </div>
      <h3>${escapeHTML(item.title)}</h3>
      <p class="muted">推荐回刷第 ${item.blankNumber} 空${item.givenWord ? `，提示词 ${escapeHTML(item.givenWord)}` : ""}。</p>
      <a class="button-ghost" href="${buildHash("practice", item.passageId)}">去练这篇</a>
    </article>
  `;
}

// 把原文中的 "(n) ____" 替换成可点击空号，练习态跳到答题区，结果态跳到解析区。
function renderPassageContent(passage, detailMap = null) {
  const paragraphs = passage.content.split(/\n\s*\n/).filter(Boolean);

  return paragraphs
    .map((paragraph) => {
      // 先把原文转义成安全的 HTML 文本，
      // 后面再把空号位置替换成我们自己的按钮。
      let html = escapeHTML(paragraph);

      passage.questions.forEach((question) => {
        const detail = detailMap ? detailMap[question.blankNumber] : null;
        const stateClass = detail ? (detail.isCorrect ? "is-correct" : "is-wrong") : "";
        const replacement = `
          <button
            type="button"
            class="blank-token ${stateClass}"
            data-action="scroll-question"
            data-target="${detail ? `analysis-${question.blankNumber}` : `question-${question.blankNumber}`}"
            data-blank-number="${question.blankNumber}">
            <span>${question.blankNumber}</span>
            ${question.givenWord ? `<em>${escapeHTML(question.givenWord)}</em>` : ""}
          </button>
        `;

        const exactPattern = new RegExp(
          `\\(\\s*${question.blankNumber}\\s*\\)\\s*(?:_+\\s*)+(?:\\(\\s*([^()]+?)\\s*\\))?`,
          "g"
        );
        html = html.replace(exactPattern, replacement);

        // 有些原文只有空号没有下划线，回退到更宽松的匹配规则。
        const fallbackPattern = new RegExp(`\\(\\s*${question.blankNumber}\\s*\\)`, "g");
        html = html.replace(fallbackPattern, replacement);
      });

      return `<p>${html}</p>`;
    })
    .join("");
}

// 把一组文本标签渲染成一排小胶囊。
function renderChips(items, className) {
  return (items || [])
    .map((item) => `<span class="${className}">${escapeHTML(item)}</span>`)
    .join("");
}

// 行内标签不需要复杂结构，所以只拼成一段文本。
function renderInlineTags(items) {
  return (items || []).map((item) => `#${item}`).join(" · ");
}

function renderSurfaceMessage(feedback, className = "surface-message") {
  if (!feedback?.message) {
    return "";
  }

  const tone = feedback.type === "error" ? "is-error" : "is-info";
  return `<div class="${className} ${tone}">${escapeHTML(feedback.message)}</div>`;
}
