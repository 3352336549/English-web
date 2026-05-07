import {
  buildAdminDashboard,
  deletePassageDraft,
  deleteQuestionDraft,
  ensureRawLibrary,
  savePassageDraft,
  saveQuestionDraft
} from "../../admin/content-service.js";
import { buildAdminUserRows } from "../services/admin-service.js";
import {
  buildResult,
  findPassage,
  getAnswersForPassage,
  normalizeLibrary,
  pushHistory
} from "../services/data-service.js";
import {
  getAdminPassageMeta,
  getAdminSession,
  getManagedLibrary,
  getRegisteredUsersForAdmin,
  getScopedLearningState,
  loginAdmin as loginAdminWithStorage,
  loginUser,
  logoutAdmin as logoutAdminWithStorage,
  logoutUser,
  registerUser,
  removeAdminPassageMeta,
  saveAdminPassageMeta as saveAdminPassageMetaToStorage,
  saveManagedLibrary,
  saveScopedLearningState
} from "../services/storage.js";

let libraryPromise = null;

export async function loadLibrary() {
  if (!libraryPromise) {
    libraryPromise = fetch("/question.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`题库加载失败，状态码 ${response.status}`);
        }

        return response.json();
      })
      .then((rawLibrary) => normalizeLibrary(getManagedLibrary(rawLibrary)));
  }

  return libraryPromise;
}

export async function getLearningSnapshot() {
  return getScopedLearningState();
}

export async function register(formData) {
  const result = registerUser(formData);
  if (!result.ok) {
    return result;
  }

  return {
    ...result,
    ...getScopedLearningState()
  };
}

export async function login(formData) {
  const result = loginUser(formData);
  if (!result.ok) {
    return result;
  }

  return {
    ...result,
    ...getScopedLearningState()
  };
}

export async function logout() {
  logoutUser();
  return getScopedLearningState();
}

export async function savePracticeState(currentUser, practiceState) {
  const latestUser = saveScopedLearningState(currentUser, practiceState);
  return {
    currentUser: latestUser || currentUser || null,
    practiceState
  };
}

export async function submitPractice({ library, passageId, practiceState, currentUser }) {
  const passage = findPassage(library, passageId);
  if (!passage) {
    return {
      ok: false,
      message: "没有找到这篇练习。"
    };
  }

  const answers = getAnswersForPassage(practiceState, passageId);
  const result = buildResult(library, passage, answers);
  pushHistory(practiceState, result);

  const savedSnapshot = await savePracticeState(currentUser, practiceState);
  return {
    ok: true,
    result,
    ...savedSnapshot
  };
}

export async function getAdminSnapshot() {
  return {
    adminSession: getAdminSession(),
    adminPassageMeta: getAdminPassageMeta(),
    registeredUsers: getRegisteredUsersForAdmin()
  };
}

export async function loginAdmin(formData) {
  const result = loginAdminWithStorage(formData);
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    adminSession: getAdminSession()
  };
}

export async function logoutAdmin() {
  logoutAdminWithStorage();
  return await getAdminSnapshot();
}

export async function loadAdminWorkspace() {
  const rawLibrary = ensureRawLibrary(getManagedLibrary(await loadRawLibrary()));
  const passageMeta = getAdminPassageMeta();
  const registeredUsers = getRegisteredUsersForAdmin();

  return {
    rawLibrary,
    passageMeta,
    dashboard: buildAdminDashboard(rawLibrary, passageMeta, registeredUsers),
    userRows: buildAdminUserRows(registeredUsers)
  };
}

export async function saveAdminPassage(draft) {
  const currentLibrary = ensureRawLibrary(getManagedLibrary(await loadRawLibrary()));
  const result = savePassageDraft(currentLibrary, draft);

  saveManagedLibrary(result.rawLibrary);
  saveAdminPassageMetaToStorage(result.passageId, {
    status: draft.status,
    featured: Boolean(draft.featured),
    note: draft.note
  });

  return {
    ok: true,
    passageId: result.passageId
  };
}

export async function deleteAdminPassage(passageId) {
  const currentLibrary = ensureRawLibrary(getManagedLibrary(await loadRawLibrary()));
  const result = deletePassageDraft(currentLibrary, passageId);

  saveManagedLibrary(result.rawLibrary);
  removeAdminPassageMeta(passageId);

  return { ok: true };
}

export async function saveAdminQuestion(draft) {
  const currentLibrary = ensureRawLibrary(getManagedLibrary(await loadRawLibrary()));
  const result = saveQuestionDraft(currentLibrary, draft);

  saveManagedLibrary(result.rawLibrary);

  return {
    ok: true,
    questionId: result.questionId
  };
}

export async function deleteAdminQuestion(questionId) {
  const currentLibrary = ensureRawLibrary(getManagedLibrary(await loadRawLibrary()));
  const result = deleteQuestionDraft(currentLibrary, questionId);

  saveManagedLibrary(result.rawLibrary);

  return { ok: true };
}

async function loadRawLibrary() {
  const response = await fetch("/question.json");
  if (!response.ok) {
    throw new Error(`题库加载失败，状态码 ${response.status}`);
  }

  return response.json();
}
