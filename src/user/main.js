import {
  buildFeaturedPassages,
  buildPublishedLibrary
} from "../shared/services/admin-service.js";
import {
  buildProfileSummary,
  countAnswered,
  findPassage,
  getAnswersForPassage,
  getFilteredPassages,
  resetPassageAnswers,
  updatePassageAnswer
} from "../shared/services/data-service.js";
import {
  getApiMode,
  getAdminSnapshot,
  getLearningSnapshot,
  loadLibrary,
  login,
  logout,
  register,
  savePracticeState,
  submitPractice
} from "../shared/api/client.js";
import { cleanString, parseRoute } from "../shared/utils/index.js";
import {
  renderBankPage,
  renderHomePage,
  renderLoadError,
  renderLoginPage,
  renderMissingPage,
  renderNav,
  renderPracticePage,
  renderProfilePage,
  renderRegisterPage,
  renderResultPage
} from "./views.js";

const app = document.getElementById("app");
const nav = document.getElementById("nav");

const state = {
  library: null,
  libraryMeta: {},
  filters: {
    year: "all",
    tag: "all",
    query: ""
  },
  filterDraft: {
    year: "all",
    tag: "all",
    query: ""
  },
  currentUser: null,
  practiceState: {
    answersByPassage: {},
    history: [],
    lastResult: null
  },
  profileSummary: null,
  activeBlankNumber: null,
  authMessage: {
    login: "",
    register: ""
  },
  authDraft: {
    login: {
      username: "",
      password: ""
    },
    register: {
      username: "",
      password: "",
      confirmPassword: "",
      nickname: "",
      grade: ""
    }
  },
  practiceFeedback: {
    type: "",
    message: ""
  },
  isSubmittingPractice: false,
  isSubmittingAuth: false,
  apiMode: getApiMode()
};

document.addEventListener("click", handleClick);
document.addEventListener("input", handleInput);
document.addEventListener("focusin", handleFocusIn);
document.addEventListener("change", handleChange);
document.addEventListener("submit", handleSubmit);
window.addEventListener("hashchange", render);

init();

async function init() {
  try {
    const [snapshot, library, adminSnapshot] = await Promise.all([
      getLearningSnapshot(),
      loadLibrary(),
      getAdminSnapshot()
    ]);

    applyLearningSnapshot(snapshot);
    state.library = library;
    state.libraryMeta = library?.metaMap || adminSnapshot?.adminPassageMeta || {};

    if (!window.location.hash) {
      window.location.hash = "#home";
      render();
      return;
    }

    render();
  } catch (error) {
    nav.innerHTML = "";
    app.innerHTML = renderLoadError(error, { apiMode: state.apiMode });
  }
}

function render() {
  if (!state.library) {
    return;
  }

  const route = parseRoute();
  if (route.view === "admin") {
    window.location.href = "../admin/";
    return;
  }

  const studentLibrary = getStudentLibrary();
  nav.innerHTML = renderNav(route, state.currentUser);

  switch (route.view) {
    case "bank":
      app.innerHTML = renderBankPage({
        library: studentLibrary,
        filters: state.filterDraft,
        passages: getFilteredPassages(studentLibrary, state.filters),
        currentUser: state.currentUser
      });
      break;
    case "practice":
      renderPracticeRoute(route.passageId);
      break;
    case "result":
      renderResultRoute(route.passageId);
      break;
    case "login":
      app.innerHTML = renderLoginPage({
        message: state.authMessage.login,
        isSubmitting: state.isSubmittingAuth,
        values: state.authDraft.login
      });
      break;
    case "register":
      app.innerHTML = renderRegisterPage({
        message: state.authMessage.register,
        isSubmitting: state.isSubmittingAuth,
        values: state.authDraft.register
      });
      break;
    case "profile":
      app.innerHTML = renderProfilePage({
        currentUser: state.currentUser,
        summary: state.profileSummary || buildProfileSummary(state.practiceState),
        practiceState: state.practiceState
      });
      break;
    case "home":
    default:
      app.innerHTML = renderHomePage({
        library: studentLibrary,
        currentUser: state.currentUser,
        practiceState: state.practiceState,
        summary: state.profileSummary || buildProfileSummary(state.practiceState),
        featuredPassages: buildFeaturedPassages(state.library, state.libraryMeta)
      });
      break;
  }
}

function renderPracticeRoute(passageId) {
  const passage = findPassage(getStudentLibrary(), passageId);
  if (!passage) {
    app.innerHTML = renderMissingPage("没有找到这篇练习。", "#bank", "回到题库");
    return;
  }

  const answers = getAnswersForPassage(state.practiceState, passage.id);
  app.innerHTML = renderPracticePage({
    passage,
    answers,
    currentUser: state.currentUser,
    isSubmitting: state.isSubmittingPractice,
    feedback: state.practiceFeedback
  });
  setActiveBlank(getInitialPracticeBlank(passage, answers));
}

function renderResultRoute(passageId) {
  const result = state.practiceState.lastResult;
  if (!result || Number(result.passageId) !== Number(passageId)) {
    app.innerHTML = renderMissingPage("这篇结果页还没有可展示的提交记录。", `#practice/${passageId}`, "去做题");
    return;
  }

  const passage = findPassage(state.library, result.passageId);
  if (!passage) {
    app.innerHTML = renderMissingPage("题目原文不存在，无法展示讲解。", "#bank", "回到题库");
    return;
  }

  app.innerHTML = renderResultPage({
    passage,
    result
  });
  setActiveBlank(getInitialResultBlank(result));
}

function handleClick(event) {
  const clickableBlank = event.target.closest("[data-blank-number]");
  if (clickableBlank) {
    setActiveBlank(Number(clickableBlank.dataset.blankNumber));
  }

  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }

  const action = target.dataset.action;

  if (action === "scroll-question") {
    const blankNumber = Number(target.dataset.blankNumber) || extractBlankNumber(target.dataset.target);
    if (blankNumber) {
      setActiveBlank(blankNumber);
    }

    const destination = document.getElementById(target.dataset.target);
    if (destination) {
      destination.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return;
  }

  if (action === "submit-practice") {
    void submitPracticeFlow(Number(target.dataset.passageId));
    return;
  }

  if (action === "reset-practice") {
    const passageId = Number(target.dataset.passageId);
    resetPassageAnswers(state.practiceState, passageId);
    setPracticeFeedback("info", "当前这篇的答案已经清空，可以重新开始作答。");
    void persistPracticeState();
    renderPracticeRoute(passageId);
    return;
  }

  if (action === "logout") {
    void logoutFlow();
  }
}

function handleFocusIn(event) {
  const focusTarget = event.target.closest("[data-blank-number]");
  if (!focusTarget) {
    return;
  }

  setActiveBlank(Number(focusTarget.dataset.blankNumber));
}

function handleInput(event) {
  const input = event.target;

  if (input.dataset.answerInput === "true") {
    const passageId = Number(input.dataset.passageId);
    const blankNumber = Number(input.dataset.blankNumber);

    if (state.practiceFeedback.message) {
      clearPracticeFeedback();
      document.querySelector(".practice-submit-bar .surface-message")?.remove();
    }

    updatePassageAnswer(state.practiceState, passageId, blankNumber, input.value);
    void persistPracticeState();
    syncPracticeUI(passageId, blankNumber);
    return;
  }

  const formType = input.form?.dataset.form;
  if (formType && input.name && state.authDraft[formType]) {
    state.authDraft[formType][input.name] = input.value;
  }

  if (input.dataset.filter === "query") {
    state.filterDraft.query = input.value;
  }
}

function handleChange(event) {
  const field = event.target;
  const filterType = field.dataset.filter;
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
  if (state.isSubmittingAuth) {
    return;
  }

  const formData = Object.fromEntries(new FormData(form).entries());

  if (formType === "login") {
    state.authDraft.login = {
      ...state.authDraft.login,
      ...formData
    };
    void submitLogin(formData);
    return;
  }

  if (formType === "register") {
    state.authDraft.register = {
      ...state.authDraft.register,
      ...formData
    };
    void submitRegister(formData);
    return;
  }

  if (formType === "bank-search") {
    state.filters = {
      ...state.filterDraft,
      query: cleanString(state.filterDraft.query)
    };
    render();
  }
}

async function submitPracticeFlow(passageId) {
  if (state.isSubmittingPractice) {
    return;
  }

  clearPracticeFeedback();
  state.isSubmittingPractice = true;
  renderPracticeRoute(passageId);

  try {
    const response = await submitPractice({
      library: getStudentLibrary(),
      passageId,
      practiceState: state.practiceState,
      currentUser: state.currentUser
    });

    if (!response.ok) {
      setPracticeFeedback("error", response.message || "提交失败。");
      return;
    }

    applyLearningSnapshot(response);
    clearPracticeFeedback();
    window.location.hash = `#result/${passageId}`;
  } catch (error) {
    setPracticeFeedback("error", error.message || "提交失败，请稍后再试。");
  } finally {
    state.isSubmittingPractice = false;
    const route = parseRoute();
    if (route.view === "practice" && Number(route.passageId) === Number(passageId)) {
      renderPracticeRoute(passageId);
    }
  }
}

async function persistPracticeState() {
  const route = parseRoute();
  const snapshot = await savePracticeState(state.currentUser, state.practiceState, {
    passageId: route.view === "practice" ? Number(route.passageId) : null
  });
  applyLearningSnapshot({
    currentUser: snapshot.currentUser,
    practiceState: snapshot.practiceState,
    profileSummary: snapshot.profileSummary
  });
}

async function submitLogin(formData) {
  state.isSubmittingAuth = true;
  render();

  try {
    const result = await login(formData);
    if (!result.ok) {
      state.authMessage.login = result.message;
      render();
      return;
    }

    state.authMessage.login = "";
    state.authMessage.register = "";
    state.authDraft.login = {
      username: "",
      password: ""
    };
    applyLearningSnapshot(result);
    window.location.hash = "#profile";
  } catch (error) {
    state.authMessage.login = error.message || "登录失败，请稍后再试。";
  } finally {
    state.isSubmittingAuth = false;
    if (parseRoute().view === "login") {
      render();
    }
  }
}

async function submitRegister(formData) {
  state.isSubmittingAuth = true;
  render();

  try {
    const result = await register(formData);
    if (!result.ok) {
      state.authMessage.register = result.message;
      render();
      return;
    }

    state.authMessage.register = "";
    state.authMessage.login = "";
    state.authDraft.register = {
      username: "",
      password: "",
      confirmPassword: "",
      nickname: "",
      grade: ""
    };
    applyLearningSnapshot(result);
    window.location.hash = "#profile";
  } catch (error) {
    state.authMessage.register = error.message || "注册失败，请稍后再试。";
  } finally {
    state.isSubmittingAuth = false;
    if (parseRoute().view === "register") {
      render();
    }
  }
}

async function logoutFlow() {
  const snapshot = await logout();
  applyLearningSnapshot(snapshot);
  render();
}

function applyLearningSnapshot(snapshot = {}) {
  state.currentUser = snapshot.currentUser || null;
  state.practiceState = snapshot.practiceState || {
    answersByPassage: {},
    history: [],
    lastResult: null
  };
  state.profileSummary = snapshot.profileSummary || buildProfileSummary(state.practiceState);
}

function setPracticeFeedback(type, message) {
  state.practiceFeedback = {
    type: type || "",
    message: message || ""
  };
}

function clearPracticeFeedback() {
  setPracticeFeedback("", "");
}

function getStudentLibrary() {
  return buildPublishedLibrary(state.library, state.libraryMeta) || state.library;
}

function syncPracticeUI(passageId, blankNumber) {
  const passage = findPassage(getStudentLibrary(), passageId);
  if (!passage) {
    return;
  }

  const answers = getAnswersForPassage(state.practiceState, passageId);
  const value = answers[blankNumber];
  const card = document.getElementById(`question-${blankNumber}`);
  const indexPills = document.querySelectorAll(`.progress-pill[data-target="question-${blankNumber}"]`);
  const progressNote = document.getElementById("practice-progress-note");
  const answeredCount = countAnswered(answers);
  const totalCountChip = document.querySelector(".practice-reading-panel .passage-header .status-chip");

  setActiveBlank(blankNumber);

  if (card) {
    const statusChip = card.querySelector(".status-chip");
    if (statusChip) {
      statusChip.textContent = value ? "已填写" : "待填写";
      statusChip.classList.toggle("good", Boolean(value));
    }
  }

  indexPills.forEach((pill) => {
    pill.classList.toggle("is-filled", Boolean(value));
  });

  if (totalCountChip) {
    totalCountChip.textContent = `${answeredCount}/${passage.questionCount} 已作答`;
  }

  if (progressNote) {
    progressNote.textContent = `当前已填写 ${answeredCount}/${passage.questionCount} 空，空着也可以提交。`;
  }
}

function setActiveBlank(blankNumber) {
  const parsedBlankNumber = Number(blankNumber);
  state.activeBlankNumber = Number.isFinite(parsedBlankNumber) ? parsedBlankNumber : null;

  document
    .querySelectorAll(".progress-pill.is-active, .blank-token.is-active, .question-card.is-active, .analysis-card.is-active")
    .forEach((element) => element.classList.remove("is-active"));

  if (!state.activeBlankNumber) {
    return;
  }

  document
    .querySelectorAll(
      [
        `.progress-pill[data-blank-number="${state.activeBlankNumber}"]`,
        `.blank-token[data-blank-number="${state.activeBlankNumber}"]`,
        `.question-card[data-blank-number="${state.activeBlankNumber}"]`,
        `.analysis-card[data-blank-number="${state.activeBlankNumber}"]`
      ].join(", ")
    )
    .forEach((element) => element.classList.add("is-active"));
}

function getInitialPracticeBlank(passage, answers) {
  return (
    passage.questions.find((question) => !cleanString(answers[question.blankNumber]))?.blankNumber ||
    passage.questions[0]?.blankNumber ||
    null
  );
}

function getInitialResultBlank(result) {
  return result.details.find((item) => !item.isCorrect)?.blankNumber || result.details[0]?.blankNumber || null;
}

function extractBlankNumber(target = "") {
  const matched = String(target).match(/(\d+)/);
  return matched ? Number(matched[1]) : null;
}
