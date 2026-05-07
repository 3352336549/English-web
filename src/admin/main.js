import {
  ADMIN_CONSOLE_TABS,
  ADMIN_CONTENT_FILTERS,
  buildAdminContentDetail,
  buildAdminContentRows,
  buildPassageDraft,
  buildQuestionDraft,
  createEmptyPassageDraft,
  createEmptyQuestionDraft,
  ensureRawLibrary
} from "./content-service.js";
import {
  deleteAdminPassage,
  deleteAdminQuestion,
  getAdminSnapshot,
  loadAdminWorkspace,
  loginAdmin,
  logoutAdmin,
  saveAdminPassage,
  saveAdminQuestion
} from "../shared/api/client.js";
import { cleanString, uniqueList } from "../shared/utils/index.js";
import { renderAdminConsole, renderAdminLoginPage } from "./views.js";

const app = document.getElementById("app");

const state = {
  rawLibrary: ensureRawLibrary(),
  adminSession: null,
  passageMeta: {},
  dashboard: createEmptyDashboard(),
  userRows: [],
  filters: { ...ADMIN_CONTENT_FILTERS },
  filterDraft: { ...ADMIN_CONTENT_FILTERS },
  selectedPassageId: null,
  selectedQuestionId: null,
  isCreatingQuestionDraft: false,
  passageDraft: createEmptyPassageDraft(),
  questionDraft: createEmptyQuestionDraft(),
  authDraft: {
    username: "",
    password: ""
  },
  authMessage: "",
  feedback: {
    type: "",
    message: ""
  },
  isSubmittingAuth: false
};

document.addEventListener("click", handleClick);
document.addEventListener("input", handleInput);
document.addEventListener("change", handleChange);
document.addEventListener("submit", handleSubmit);
window.addEventListener("hashchange", render);

init();

async function init() {
  try {
    ensureAdminHash();
    const snapshot = await getAdminSnapshot();
    state.adminSession = snapshot.adminSession || null;

    if (state.adminSession) {
      await refreshAdminWorkspace();
    }

    render();
  } catch (error) {
    app.innerHTML = `
      <section class="empty-panel">
        <strong>管理端初始化失败</strong>
        <p class="muted">${cleanString(error.message) || "请检查管理端接口是否可以正常访问。"}</p>
      </section>
    `;
  }
}

function render() {
  if (!state.adminSession) {
    app.innerHTML = renderAdminLoginPage({
      authDraft: state.authDraft,
      authMessage: state.authMessage,
      isSubmittingAuth: state.isSubmittingAuth
    });
    return;
  }

  const route = getAdminRoute();
  const activeTab = resolveActiveTab(route);
  syncStateWithRoute(route);

  const passageRows = buildAdminContentRows(state.rawLibrary, state.passageMeta, state.filters);
  const selectedPassage = state.selectedPassageId
    ? buildAdminContentDetail(state.rawLibrary, state.passageMeta, state.selectedPassageId)
    : null;

  app.innerHTML = renderAdminConsole({
    adminSession: state.adminSession,
    activeTab,
    contentMode: resolveContentMode(route),
    dashboard: state.dashboard,
    feedback: state.feedback,
    filters: state.filterDraft,
    availableYears: uniqueList((state.rawLibrary?.passages || []).map((item) => cleanString(item.year))),
    passageRows,
    selectedPassage,
    selectedQuestionId: state.selectedQuestionId,
    passageDraft: state.passageDraft,
    questionDraft: state.questionDraft,
    userRows: state.userRows
  });
}

function handleClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }

  const action = target.dataset.action;

  if (action === "admin-switch-tab") {
    const tab = target.dataset.tab || ADMIN_CONSOLE_TABS.overview;
    state.isCreatingQuestionDraft = false;
    window.location.hash = buildAdminHash(tab === ADMIN_CONSOLE_TABS.content ? "content" : tab);
    return;
  }

  if (action === "admin-open-passage-editor") {
    const passageId = Number(target.dataset.passageId);
    if (!passageId) {
      return;
    }

    state.isCreatingQuestionDraft = false;
    window.location.hash = buildAdminHash("content-edit", passageId);
    return;
  }

  if (action === "admin-back-to-content") {
    state.isCreatingQuestionDraft = false;
    window.location.hash = buildAdminHash("content");
    return;
  }

  if (action === "admin-select-question") {
    state.isCreatingQuestionDraft = false;
    state.selectedQuestionId = Number(target.dataset.questionId);
    syncEditorsFromSelection({ preservePassage: true, ignoreFilters: true });
    clearFeedback();
    render();
    return;
  }

  if (action === "admin-new-passage") {
    state.selectedPassageId = null;
    state.selectedQuestionId = null;
    state.isCreatingQuestionDraft = false;
    state.passageDraft = createEmptyPassageDraft(getSuggestedYear());
    state.questionDraft = createEmptyQuestionDraft();
    clearFeedback();
    window.location.hash = buildAdminHash("content-new");
    return;
  }

  if (action === "admin-new-question") {
    const passageId = Number(target.dataset.passageId) || state.selectedPassageId;
    if (!beginNewQuestion(passageId)) {
      return;
    }

    clearFeedback();
    render();
    return;
  }

  if (action === "admin-delete-passage") {
    void deleteCurrentPassageFlow(Number(target.dataset.passageId));
    return;
  }

  if (action === "admin-delete-question") {
    void deleteCurrentQuestionFlow(Number(target.dataset.questionId));
    return;
  }

  if (action === "admin-logout") {
    void logoutFlow();
  }
}

function handleInput(event) {
  const input = event.target;

  if (input.form?.dataset.form === "admin-login" && input.name) {
    state.authDraft[input.name] = input.value;
    return;
  }

  if (input.dataset.adminFilter === "query") {
    state.filterDraft.query = input.value;
  }
}

function handleChange(event) {
  const field = event.target;
  const filterType = field.dataset.adminFilter;
  if (!filterType) {
    return;
  }

  state.filterDraft[filterType] = field.value;
}

function handleSubmit(event) {
  const form = event.target;
  const formType = form.dataset.form;
  if (!formType) {
    return;
  }

  event.preventDefault();
  const formData = Object.fromEntries(new FormData(form).entries());

  if (formType === "admin-login") {
    if (state.isSubmittingAuth) {
      return;
    }

    state.authDraft = {
      ...state.authDraft,
      ...formData
    };
    void submitAdminLogin(formData);
    return;
  }

  if (formType === "passage-editor") {
    void submitPassageEditor(formData);
    return;
  }

  if (formType === "question-editor") {
    void submitQuestionEditor(formData);
    return;
  }

  if (formType === "admin-content-search") {
    state.filters = {
      ...state.filterDraft,
      query: cleanString(state.filterDraft.query)
    };
    clearFeedback();
    render();
  }
}

async function submitAdminLogin(formData) {
  state.isSubmittingAuth = true;
  render();

  try {
    const result = await loginAdmin(formData);
    state.adminSession = result.adminSession || null;
    state.authDraft = {
      username: "",
      password: ""
    };
    state.authMessage = "";
    await refreshAdminWorkspace();
    state.feedback = {
      type: "info",
      message: "后台已连接，当前数据正在从后端接口加载。"
    };
    if (!window.location.hash) {
      window.location.hash = buildAdminHash("overview");
    }
    render();
  } catch (error) {
    state.authMessage = cleanString(error.message) || "管理员登录失败。";
    render();
  } finally {
    state.isSubmittingAuth = false;
    if (!state.adminSession) {
      render();
    }
  }
}

async function submitPassageEditor(formData) {
  try {
    const result = await saveAdminPassage({
      ...formData,
      featured: Boolean(formData.featured)
    });
    state.selectedPassageId = result.passageId;
    await refreshAdminWorkspace({ preservePassage: true, ignoreFilters: true });
    state.feedback = {
      type: "info",
      message: formData.id ? "篇章已更新。" : "篇章已创建。"
    };
    if (window.location.hash !== buildAdminHash("content-edit", result.passageId)) {
      window.location.hash = buildAdminHash("content-edit", result.passageId);
      return;
    }
    render();
  } catch (error) {
    state.feedback = {
      type: "error",
      message: cleanString(error.message) || "篇章保存失败。"
    };
    render();
  }
}

async function submitQuestionEditor(formData) {
  try {
    const result = await saveAdminQuestion(formData);
    state.selectedPassageId = Number(formData.passageId);
    state.selectedQuestionId = Number(result.questionId) || null;
    state.isCreatingQuestionDraft = false;
    await refreshAdminWorkspace({ preservePassage: true, preserveQuestion: true, ignoreFilters: true });
    state.feedback = {
      type: "info",
      message: formData.id ? "题目已更新。" : "题目已创建。"
    };
    render();
  } catch (error) {
    state.feedback = {
      type: "error",
      message: cleanString(error.message) || "题目保存失败。"
    };
    render();
  }
}

async function deleteCurrentPassageFlow(passageId) {
  if (!passageId) {
    return;
  }

  const confirmed = window.confirm("确定删除这篇篇章及其关联题目吗？");
  if (!confirmed) {
    return;
  }

  try {
    await deleteAdminPassage(passageId);
    state.selectedPassageId = null;
    state.selectedQuestionId = null;
    await refreshAdminWorkspace();
    state.feedback = {
      type: "info",
      message: "篇章已删除。"
    };
    window.location.hash = buildAdminHash("content");
  } catch (error) {
    state.feedback = {
      type: "error",
      message: cleanString(error.message) || "篇章删除失败。"
    };
    render();
  }
}

async function deleteCurrentQuestionFlow(questionId) {
  if (!questionId) {
    return;
  }

  const confirmed = window.confirm("确定删除这道题目吗？");
  if (!confirmed) {
    return;
  }

  try {
    await deleteAdminQuestion(questionId);
    await refreshAdminWorkspace({ preservePassage: true, ignoreFilters: true });
    syncEditorsAfterQuestionDelete();
    state.feedback = {
      type: "info",
      message: "题目已删除。"
    };
    render();
  } catch (error) {
    state.feedback = {
      type: "error",
      message: cleanString(error.message) || "题目删除失败。"
    };
    render();
  }
}

async function logoutFlow() {
  await logoutAdmin();
  state.adminSession = null;
  state.rawLibrary = ensureRawLibrary();
  state.passageMeta = {};
  state.dashboard = createEmptyDashboard();
  state.userRows = [];
  state.selectedPassageId = null;
  state.selectedQuestionId = null;
  state.isCreatingQuestionDraft = false;
  state.passageDraft = createEmptyPassageDraft();
  state.questionDraft = createEmptyQuestionDraft();
  state.authMessage = "";
  state.feedback = {
    type: "",
    message: ""
  };
  window.location.hash = buildAdminHash("overview");
  render();
}

async function refreshAdminWorkspace(options = {}) {
  const workspace = await loadAdminWorkspace();
  state.rawLibrary = ensureRawLibrary(workspace.rawLibrary);
  state.passageMeta = workspace.passageMeta || {};
  state.dashboard = workspace.dashboard || createEmptyDashboard();
  state.userRows = Array.isArray(workspace.userRows) ? workspace.userRows : [];
  state.filterDraft = {
    ...state.filters
  };
  syncEditorsFromSelection(options);
}

function syncEditorsFromSelection(options = {}) {
  const effectiveFilters = options.ignoreFilters ? ADMIN_CONTENT_FILTERS : state.filters;
  const rows = buildAdminContentRows(state.rawLibrary, state.passageMeta, effectiveFilters);

  if (!rows.length) {
    if (!options.preservePassage) {
      state.selectedPassageId = null;
    }
    state.selectedQuestionId = null;
    state.passageDraft = createEmptyPassageDraft(getSuggestedYear());
    state.questionDraft = createEmptyQuestionDraft();
    return;
  }

  const rowIds = rows.map((item) => Number(item.id));
  if (!rowIds.includes(Number(state.selectedPassageId))) {
    state.selectedPassageId = null;
    state.selectedQuestionId = null;
  }

  if (!state.selectedPassageId) {
    state.passageDraft = createEmptyPassageDraft(getSuggestedYear());
    state.questionDraft = createEmptyQuestionDraft();
    return;
  }

  state.passageDraft = buildPassageDraft(state.rawLibrary, state.passageMeta, state.selectedPassageId);

  const detail = buildAdminContentDetail(state.rawLibrary, state.passageMeta, state.selectedPassageId);
  const questionRows = detail?.questions || [];
  if (
    state.isCreatingQuestionDraft &&
    Number(state.questionDraft?.passageId) === Number(state.selectedPassageId)
  ) {
    return;
  }

  state.isCreatingQuestionDraft = false;

  if (!questionRows.length) {
    state.selectedQuestionId = null;
    state.questionDraft = createEmptyQuestionDraft(state.selectedPassageId, 1);
    return;
  }

  if (!questionRows.some((item) => Number(item.id) === Number(state.selectedQuestionId))) {
    state.selectedQuestionId = options.preserveQuestion ? state.selectedQuestionId : questionRows[0].id;
  }

  state.questionDraft = buildQuestionDraft(state.rawLibrary, state.selectedPassageId, state.selectedQuestionId);
}

function syncEditorsAfterQuestionDelete() {
  const detail = buildAdminContentDetail(state.rawLibrary, state.passageMeta, state.selectedPassageId);
  const firstQuestionId = detail?.questions?.[0]?.id || null;
  state.selectedQuestionId = firstQuestionId;
  syncEditorsFromSelection({
    preservePassage: true,
    preserveQuestion: Boolean(firstQuestionId),
    ignoreFilters: true
  });
}

function beginNewQuestion(passageId) {
  const normalizedPassageId = Number(passageId);
  if (!normalizedPassageId) {
    return false;
  }

  const detail = buildAdminContentDetail(state.rawLibrary, state.passageMeta, normalizedPassageId);
  state.selectedPassageId = normalizedPassageId;
  state.selectedQuestionId = null;
  state.isCreatingQuestionDraft = true;
  state.questionDraft = createEmptyQuestionDraft(normalizedPassageId, getNextBlankNumber(detail?.questions || []));
  return true;
}

function getNextBlankNumber(questionRows = []) {
  return questionRows.reduce((maxBlank, item) => Math.max(maxBlank, Number(item.blankNumber) || 0), 0) + 1;
}

function syncStateWithRoute(route) {
  if (route.view === "content-new") {
    state.selectedPassageId = null;
    state.selectedQuestionId = null;
    state.isCreatingQuestionDraft = false;
    state.passageDraft = createEmptyPassageDraft(getSuggestedYear());
    state.questionDraft = createEmptyQuestionDraft();
    return;
  }

  if (route.view !== "content-edit") {
    return;
  }

  const nextPassageId = Number(route.entityId);
  if (!nextPassageId) {
    window.location.hash = buildAdminHash("content");
    return;
  }

  if (Number(state.selectedPassageId) !== nextPassageId) {
    state.selectedPassageId = nextPassageId;
    state.selectedQuestionId = null;
    state.isCreatingQuestionDraft = false;
  }

  syncEditorsFromSelection({ preservePassage: true, ignoreFilters: true });

  if (!state.selectedPassageId) {
    window.location.hash = buildAdminHash("content");
  }
}

function clearFeedback() {
  state.feedback = {
    type: "",
    message: ""
  };
}

function getSuggestedYear() {
  return (
    uniqueList((state.rawLibrary?.passages || []).map((item) => cleanString(item.year))).sort(
      (a, b) => Number(b) - Number(a)
    )[0] || String(new Date().getFullYear())
  );
}

function ensureAdminHash() {
  if (!window.location.hash) {
    window.location.hash = buildAdminHash("overview");
    return;
  }
}

function getAdminRoute(hashValue = window.location.hash) {
  const rawHash = hashValue.replace(/^#/, "") || "overview";
  const [view, entityId = ""] = rawHash.split("/");

  return {
    view: view || "overview",
    entityId
  };
}

function resolveActiveTab(route) {
  if (route.view === "users") {
    return ADMIN_CONSOLE_TABS.users;
  }

  if (route.view.startsWith("content")) {
    return ADMIN_CONSOLE_TABS.content;
  }

  return ADMIN_CONSOLE_TABS.overview;
}

function resolveContentMode(route) {
  if (route.view === "content-edit") {
    return "edit";
  }

  if (route.view === "content-new") {
    return "new";
  }

  return "search";
}

function buildAdminHash(view, entityId = null) {
  return entityId ? `#${view}/${entityId}` : `#${view}`;
}

function createEmptyDashboard() {
  return {
    totalPassages: 0,
    totalQuestions: 0,
    publishedCount: 0,
    draftCount: 0,
    featuredCount: 0,
    zeroQuestionCount: 0,
    registeredUserCount: 0,
    activeUserCount: 0,
    submissionCount: 0,
    avgAccuracy: 0,
    topTags: [],
    weakTags: [],
    featuredPassages: [],
    recentSubmissions: []
  };
}
