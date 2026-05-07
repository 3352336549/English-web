import {
  buildProfileSummary,
  composeLibrary,
  findPassage,
  getAnswersForPassage,
  pushHistory
} from "../services/data-service.js";
import {
  getAdminSession,
  getBackendStudentSession,
  getGuestLearningState,
  saveAdminSession,
  saveBackendStudentSession,
  saveGuestPracticeState
} from "../services/storage.js";
import { cleanString, uniqueList } from "../utils/index.js";

const runtimeConfig = window.__GRAMMAR_APP_CONFIG__ || {};
const API_BASE = cleanString(runtimeConfig.apiBase) || "/api";

export async function loadLibrary() {
  const listPayload = await requestJSON("/passages?page=1&pageSize=100");
  const list = Array.isArray(listPayload.list) ? listPayload.list : [];

  const detailPassages = await Promise.all(
    list.map(async (summary) => {
      const detail = await requestJSON(`/passages/${summary.id}`);
      return normalizeBackendPassage(detail, summary);
    })
  );

  const library = composeLibrary(detailPassages);
  library.metaMap = buildPassageMetaMap(list);
  return library;
}

export async function getLearningSnapshot() {
  const studentSession = getBackendStudentSession();
  if (!studentSession?.token) {
    return getGuestLearningState();
  }

  try {
    return await fetchProfileSnapshot(studentSession);
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      saveBackendStudentSession(null);
      return getGuestLearningState();
    }

    throw error;
  }
}

export async function register(formData) {
  const payload = await requestJSON("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      username: cleanString(formData.username),
      password: cleanString(formData.password),
      confirmPassword: cleanString(formData.confirmPassword),
      nickname: cleanString(formData.nickname),
      grade: cleanString(formData.grade)
    }),
    authScope: "none"
  });

  const studentSession = saveBackendStudentSession(buildStudentSession(payload));
  return fetchProfileSnapshot(studentSession);
}

export async function login(formData) {
  const payload = await requestJSON("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      username: cleanString(formData.username),
      password: cleanString(formData.password)
    }),
    authScope: "none"
  });

  const studentSession = saveBackendStudentSession(buildStudentSession(payload));
  return fetchProfileSnapshot(studentSession);
}

export async function logout() {
  saveBackendStudentSession(null);
  return getGuestLearningState();
}

export async function savePracticeState(currentUser, practiceState, context = {}) {
  const studentSession = getBackendStudentSession();
  if (!studentSession?.token) {
    const guestSnapshot = saveGuestPracticeState(practiceState);
    return {
      currentUser: guestSnapshot.currentUser,
      practiceState: guestSnapshot.practiceState,
      profileSummary: buildProfileSummary(guestSnapshot.practiceState)
    };
  }

  const passageId = Number(context.passageId);
  if (passageId) {
    await requestJSON("/practice/draft", {
      method: "POST",
      body: JSON.stringify({
        passageId,
        answers: normalizeDraftAnswers(getAnswersForPassage(practiceState, passageId))
      }),
      authScope: "student"
    });
  }

  return {
    currentUser: buildStudentUser(studentSession, currentUser),
    practiceState,
    profileSummary: buildProfileSummary(practiceState)
  };
}

export async function submitPractice({ library, passageId, practiceState, currentUser }) {
  const passage = findPassage(library, passageId);
  const answers = buildAnswerPayload(passage, getAnswersForPassage(practiceState, passageId));
  const studentSession = getBackendStudentSession();

  const payload = await requestJSON("/practice/submit", {
    method: "POST",
    body: JSON.stringify({
      passageId: Number(passageId),
      answers
    }),
    authScope: studentSession?.token ? "studentOptional" : "none"
  });
  const result = normalizeResult(payload) || payload;

  pushHistory(practiceState, result);
  const savedSnapshot = studentSession?.token
    ? {
        currentUser: buildStudentUser(studentSession, currentUser),
        practiceState,
        profileSummary: buildProfileSummary(practiceState)
      }
    : await savePracticeState(currentUser, practiceState, { passageId });

  return {
    ok: true,
    result,
    ...savedSnapshot
  };
}

export async function getAdminSnapshot() {
  return {
    adminSession: getAdminSession(),
    adminPassageMeta: {},
    registeredUsers: []
  };
}

export async function loginAdmin(formData) {
  const payload = await requestJSON("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({
      username: cleanString(formData.username),
      password: cleanString(formData.password)
    })
  });

  const adminSession = {
    id: payload.id,
    username: payload.username,
    name: payload.name,
    role: payload.role,
    token: payload.token || "",
    loggedAt: new Date().toISOString()
  };

  saveAdminSession(adminSession);
  return {
    ok: true,
    adminSession
  };
}

export async function logoutAdmin() {
  saveAdminSession(null);
  return getAdminSnapshot();
}

export async function loadAdminWorkspace() {
  const [overview, passageListPayload, userPayload] = await Promise.all([
    requestJSON("/admin/overview"),
    requestJSON("/admin/passages?page=1&pageSize=100"),
    requestJSON("/admin/users?page=1&pageSize=100")
  ]);

  const list = Array.isArray(passageListPayload.list) ? passageListPayload.list : [];
  const details = await Promise.all(
    list.map((item) => requestJSON(`/admin/passages/${item.id}`))
  );

  const rawLibrary = {
    passages: details.map((detail) => ({
      id: Number(detail.id),
      title: cleanString(detail.title),
      content: cleanString(detail.content),
      source: cleanString(detail.source),
      year: cleanString(detail.year)
    })),
    questions: details.flatMap((detail) =>
      (Array.isArray(detail.questions) ? detail.questions : []).map((question) => ({
        id: Number(question.id),
        passage_id: Number(question.passageId),
        type: cleanString(question.type) || "语法填空",
        question_text: cleanString(question.questionText),
        blank_number: Number(question.blankNumber),
        given_word: cleanString(question.givenWord) || null,
        options: null,
        correct_answer: cleanString(question.correctAnswer),
        grammar_tag: cleanString(question.grammarTag),
        difficulty: cleanString(question.difficulty),
        source: cleanString(detail.source),
        year: cleanString(detail.year),
        explanation: cleanString(question.explanation)
      }))
    )
  };

  const passageMeta = list.reduce((map, item) => {
    map[item.id] = {
      status: cleanString(item.status) === "draft" ? "draft" : "published",
      featured: Boolean(item.featured),
      note: cleanString(item.note),
      updatedAt: cleanString(item.updatedAt)
    };
    return map;
  }, {});

  return {
    rawLibrary,
    passageMeta,
    dashboard: overview,
    userRows: Array.isArray(userPayload.list) ? userPayload.list : []
  };
}

export async function saveAdminPassage(draft) {
  const method = draft.id ? "PATCH" : "POST";
  const pathname = draft.id ? `/admin/passages/${Number(draft.id)}` : "/admin/passages";
  const payload = await requestJSON(pathname, {
    method,
    body: JSON.stringify({
      title: cleanString(draft.title),
      content: cleanString(draft.content),
      source: cleanString(draft.source),
      year: cleanString(draft.year),
      status: cleanString(draft.status) === "draft" ? "draft" : "published",
      featured: Boolean(draft.featured),
      note: cleanString(draft.note)
    })
  });

  return {
    ok: true,
    passageId: Number(payload?.id || draft.id)
  };
}

export async function deleteAdminPassage(passageId) {
  await requestJSON(`/admin/passages/${Number(passageId)}`, { method: "DELETE" });
  return { ok: true };
}

export async function saveAdminQuestion(draft) {
  const method = draft.id ? "PATCH" : "POST";
  const pathname = draft.id ? `/admin/questions/${Number(draft.id)}` : "/admin/questions";
  const payload = await requestJSON(pathname, {
    method,
    body: JSON.stringify({
      passageId: Number(draft.passageId),
      blankNumber: Number(draft.blankNumber),
      questionText: cleanString(draft.questionText),
      givenWord: cleanString(draft.givenWord),
      correctAnswer: cleanString(draft.correctAnswer),
      grammarTag: cleanString(draft.grammarTag),
      difficulty: cleanString(draft.difficulty),
      explanation: cleanString(draft.explanation),
      type: cleanString(draft.type) || "语法填空"
    })
  });

  return {
    ok: true,
    questionId: Number(payload?.id || draft.id)
  };
}

export async function deleteAdminQuestion(questionId) {
  await requestJSON(`/admin/questions/${Number(questionId)}`, { method: "DELETE" });
  return { ok: true };
}

async function requestJSON(pathname, options = {}) {
  const { authScope = inferAuthScope(pathname), headers = {}, ...fetchOptions } = options;
  const response = await fetch(`${API_BASE}${pathname}`, {
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(authScope),
      ...headers
    },
    ...fetchOptions
  });

  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(
      cleanString(payload?.msg) ||
        cleanString(payload?.message) ||
        cleanString(text) ||
        `接口请求失败，状态码 ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  if (payload && typeof payload === "object" && "code" in payload) {
    if (Number(payload.code) !== 1) {
      const error = new Error(cleanString(payload.msg) || "接口返回失败");
      error.status = response.status;
      throw error;
    }

    return payload.data;
  }

  return payload;
}

function buildAuthHeaders(authScope) {
  if (authScope === "student" || authScope === "studentOptional") {
    const studentSession = getBackendStudentSession();
    if (studentSession?.token) {
      return {
        Authorization: `Bearer ${studentSession.token}`
      };
    }
  }

  if (authScope === "admin") {
    const adminSession = getAdminSession();
    if (adminSession?.token) {
      return {
        Authorization: `Bearer ${adminSession.token}`
      };
    }
  }

  return {};
}

function inferAuthScope(pathname) {
  if (pathname.startsWith("/admin/") && pathname !== "/admin/auth/login") {
    return "admin";
  }

  if (pathname === "/profile" || pathname === "/practice/draft") {
    return "student";
  }

  if (pathname === "/practice/submit") {
    return "studentOptional";
  }

  return "none";
}

function buildStudentSession(payload = {}) {
  return {
    id: cleanString(payload.id),
    username: cleanString(payload.username),
    nickname: cleanString(payload.nickname) || cleanString(payload.username),
    grade: cleanString(payload.grade) || "高三",
    createdAt: cleanString(payload.createdAt),
    token: cleanString(payload.token),
    loggedAt: new Date().toISOString()
  };
}

function buildStudentUser(session = {}, fallbackUser = {}) {
  return {
    id: cleanString(fallbackUser.id) || cleanString(session.id),
    username: cleanString(fallbackUser.username) || cleanString(session.username),
    nickname: cleanString(fallbackUser.nickname) || cleanString(session.nickname) || cleanString(session.username),
    grade: cleanString(fallbackUser.grade) || cleanString(session.grade) || "高三",
    createdAt: cleanString(fallbackUser.createdAt) || cleanString(session.createdAt)
  };
}

async function fetchProfileSnapshot(session = getBackendStudentSession()) {
  const payload = await requestJSON("/profile", { authScope: "student" });
  const currentUser = buildStudentUser(
    session,
    payload?.user || {}
  );

  return {
    currentUser,
    practiceState: {
      answersByPassage: normalizeDraftAnswersByPassage(payload?.draftAnswersByPassage),
      history: normalizeHistoryList(payload?.history),
      lastResult: normalizeResult(payload?.lastResult)
    },
    profileSummary: normalizeProfileSummary(payload?.summary)
  };
}

function buildPassageMetaMap(list = []) {
  return (Array.isArray(list) ? list : []).reduce((map, item) => {
    map[item.id] = {
      status: cleanString(item.status) === "draft" ? "draft" : "published",
      featured: Boolean(item.featured),
      note: cleanString(item.note),
      updatedAt: cleanString(item.updatedAt)
    };
    return map;
  }, {});
}

function normalizeDraftAnswers(answerMap = {}) {
  return Object.entries(answerMap || {}).reduce((map, [blankNumber, answer]) => {
    const value = cleanString(answer);
    const normalizedBlankNumber = Number(blankNumber);
    if (value && Number.isFinite(normalizedBlankNumber)) {
      map[String(normalizedBlankNumber)] = value;
    }
    return map;
  }, {});
}

function normalizeDraftAnswersByPassage(answersByPassage = {}) {
  return Object.entries(answersByPassage || {}).reduce((map, [passageId, answerMap]) => {
    const normalizedPassageId = Number(passageId);
    if (Number.isFinite(normalizedPassageId)) {
      map[String(normalizedPassageId)] = normalizeDraftAnswers(answerMap);
    }
    return map;
  }, {});
}

function normalizeHistoryList(history = []) {
  return (Array.isArray(history) ? history : []).map((item) => ({
    passageId: Number(item.passageId),
    title: cleanString(item.title),
    year: cleanString(item.year),
    accuracy: Number(item.accuracy) || 0,
    focusTags: uniqueList((item.focusTags || []).map(cleanString)),
    createdAt: cleanString(item.createdAt)
  }));
}

function normalizeProfileSummary(summary = {}) {
  return {
    completedPassages: Number(summary.completedPassages) || 0,
    submissionCount: Number(summary.submissionCount) || 0,
    avgAccuracy: Number(summary.avgAccuracy) || 0,
    bestAccuracy: Number(summary.bestAccuracy) || 0,
    weakTags: Array.isArray(summary.weakTags)
      ? summary.weakTags.map((item) => ({
          name: cleanString(item.name),
          count: Number(item.count) || 0
        }))
      : []
  };
}

function normalizeResult(result = null) {
  if (!result || !Number(result.passageId)) {
    return null;
  }

  return {
    passageId: Number(result.passageId),
    title: cleanString(result.title),
    year: cleanString(result.year),
    createdAt: cleanString(result.createdAt),
    accuracy: Number(result.accuracy) || 0,
    correctCount: Number(result.correctCount) || 0,
    wrongCount: Number(result.wrongCount) || 0,
    focusTags: uniqueList((result.focusTags || []).map(cleanString)),
    details: Array.isArray(result.details)
      ? result.details.map((item) => ({
          blankNumber: Number(item.blankNumber),
          questionText: cleanString(item.questionText),
          userAnswer: cleanString(item.userAnswer),
          correctAnswer: cleanString(item.correctAnswer),
          grammarTag: cleanString(item.grammarTag),
          difficulty: cleanString(item.difficulty),
          givenWord: cleanString(item.givenWord),
          explanation: cleanString(item.explanation),
          isCorrect: Boolean(item.isCorrect)
        }))
      : [],
    recommendations: Array.isArray(result.recommendations)
      ? result.recommendations.map((item) => ({
          passageId: Number(item.passageId),
          title: cleanString(item.title),
          year: cleanString(item.year),
          blankNumber: Number(item.blankNumber),
          grammarTag: cleanString(item.grammarTag),
          difficulty: cleanString(item.difficulty),
          givenWord: cleanString(item.givenWord)
        }))
      : []
  };
}

function normalizeBackendPassage(detail, summary = {}) {
  const questions = Array.isArray(detail.questions)
    ? detail.questions.map((question) => ({
        id: Number(question.id),
        passageId: Number(question.passageId),
        blankNumber: Number(question.blankNumber),
        questionText: cleanString(question.questionText),
        givenWord: cleanString(question.givenWord),
        grammarTag: cleanString(question.grammarTag) || "未分类",
        difficulty: cleanString(question.difficulty) || "未标注",
        source: cleanString(question.source) || cleanString(detail.source) || cleanString(summary.source),
        year: cleanString(question.year) || cleanString(detail.year) || cleanString(summary.year),
        type: cleanString(question.type) || "语法填空"
      }))
    : [];

  return {
    id: Number(detail.id ?? summary.id),
    title: cleanString(detail.title) || cleanString(summary.title),
    content: cleanString(detail.content),
    source: cleanString(detail.source) || cleanString(summary.source),
    year: cleanString(detail.year) || cleanString(summary.year),
    excerpt: cleanString(summary.excerpt),
    questionCount: Number(detail.questionCount) || Number(summary.questionCount) || questions.length,
    tags: uniqueList(
      (Array.isArray(detail.tags) && detail.tags.length ? detail.tags : summary.tags || []).map(cleanString)
    ),
    questions
  };
}

function buildAnswerPayload(passage, answerMap) {
  if (passage?.questions?.length) {
    return passage.questions.map((question) => ({
      blankNumber: Number(question.blankNumber),
      userAnswer: cleanString(answerMap?.[question.blankNumber])
    }));
  }

  return Object.entries(answerMap || {}).map(([blankNumber, userAnswer]) => ({
    blankNumber: Number(blankNumber),
    userAnswer: cleanString(userAnswer)
  }));
}
