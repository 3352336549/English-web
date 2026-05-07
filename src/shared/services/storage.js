import { cleanString, cloneJSON, loadJSON, saveJSON } from "../utils/index.js";

// storage.js 专门负责“把数据保存到浏览器本地”。
// 因为这个项目没有后端，所以注册信息、登录状态、练习记录都放在 localStorage。
export const STORAGE_KEYS = {
  users: "sh-grammar-users",
  sessionUserId: "sh-grammar-session-user-id",
  guestAnswers: "sh-grammar-guest-answers",
  guestHistory: "sh-grammar-guest-history",
  guestLastResult: "sh-grammar-guest-last-result",
  backendStudentSession: "sh-grammar-backend-student-session",
  adminSession: "sh-grammar-admin-session",
  adminPassageMeta: "sh-grammar-admin-passage-meta",
  managedLibrary: "sh-grammar-managed-library"
};

const DEFAULT_ADMIN_ACCOUNT = {
  id: "admin-local",
  username: "admin",
  password: "admin123",
  name: "内容管理员",
  role: "content_manager"
};

// 登录用户和游客共用同一份练习状态结构，便于界面复用。
// 这样视图层就不用关心“现在到底是游客还是登录用户”，
// 只要拿到 practiceState 就能正常渲染。
export function createEmptyPracticeState() {
  return {
    answersByPassage: {},
    history: [],
    lastResult: null
  };
}

// 读取所有已经注册的用户。
function getUsers() {
  return loadJSON(STORAGE_KEYS.users, []);
}

function saveUsers(users) {
  saveJSON(STORAGE_KEYS.users, users);
}

export function getRegisteredUsersForAdmin() {
  return cloneJSON(
    getUsers().map((item) => ({
      id: item.id,
      username: item.username,
      nickname: item.nickname,
      grade: item.grade,
      createdAt: item.createdAt,
      practice: item.practice || createEmptyPracticeState()
    }))
  );
}

// 当前登录态只保存用户 id，而不直接保存整份用户对象。
// 这样可以减少重复数据。
function getSessionUserId() {
  return loadJSON(STORAGE_KEYS.sessionUserId, null);
}

function setSessionUserId(userId) {
  saveJSON(STORAGE_KEYS.sessionUserId, userId);
}

// 通过 session 里保存的用户 id，找到当前用户完整资料。
export function getCurrentUser() {
  const userId = getSessionUserId();
  if (!userId) {
    return null;
  }

  const user = getUsers().find((item) => item.id === userId);
  return user ? cloneJSON(user) : null;
}

// 统一读取“当前访问者”应该看到的学习状态。
// 当前访问者有两种可能：
// 1. 已登录用户：读用户自己的 practice
// 2. 游客：读游客缓存
export function getScopedLearningState() {
  const currentUser = getCurrentUser();

  // 登录后读用户私有记录；未登录时退回到游客缓存。
  if (currentUser) {
    return {
      currentUser,
      practiceState: cloneJSON(currentUser.practice || createEmptyPracticeState())
    };
  }

  return getGuestLearningState();
}

export function getGuestLearningState() {
  return {
    currentUser: null,
    practiceState: {
      answersByPassage: loadJSON(STORAGE_KEYS.guestAnswers, {}),
      history: loadJSON(STORAGE_KEYS.guestHistory, []),
      lastResult: loadJSON(STORAGE_KEYS.guestLastResult, null)
    }
  };
}

// 保存当前访问者的学习状态。
// 如果已经登录，就写回对应用户；
// 如果没登录，就写到游客专用的几个 key。
export function saveScopedLearningState(currentUser, practiceState) {
  if (currentUser?.id) {
    const users = getUsers();
    const nextUsers = users.map((item) =>
      item.id === currentUser.id
        ? {
            ...item,
            practice: cloneJSON(practiceState)
          }
        : item
    );

    saveUsers(nextUsers);
    setSessionUserId(currentUser.id);
    return getCurrentUser();
  }

  // 游客记录拆开存，避免没有账号时整块用户对象的概念。
  saveGuestPracticeState(practiceState);
  return null;
}

export function saveGuestPracticeState(practiceState) {
  saveJSON(STORAGE_KEYS.guestAnswers, practiceState.answersByPassage || {});
  saveJSON(STORAGE_KEYS.guestHistory, practiceState.history || []);
  saveJSON(STORAGE_KEYS.guestLastResult, practiceState.lastResult || null);
  return getGuestLearningState();
}

// 这里是纯前端演示注册，账号信息保存在 localStorage 中。
// 所以这不是安全的真实生产方案，只适合本地练习项目。
export function registerUser(formData) {
  const username = cleanString(formData.username).toLowerCase();
  const password = cleanString(formData.password);
  const confirmPassword = cleanString(formData.confirmPassword);
  const nickname = cleanString(formData.nickname) || username;
  const grade = cleanString(formData.grade) || "高三";

  if (!username) {
    return { ok: false, message: "请输入用户名。" };
  }

  if (password.length < 6) {
    return { ok: false, message: "密码至少 6 位。" };
  }

  if (password !== confirmPassword) {
    return { ok: false, message: "两次输入的密码不一致。" };
  }

  const users = getUsers();
  if (users.some((item) => item.username === username)) {
    return { ok: false, message: "这个用户名已经被注册了。" };
  }

  const newUser = {
    id: `user-${Date.now()}`,
    username,
    password,
    nickname,
    grade,
    createdAt: new Date().toISOString(),
    practice: createEmptyPracticeState()
  };

  saveUsers([newUser, ...users]);
  setSessionUserId(newUser.id);

  return {
    ok: true,
    message: "注册成功，已经为你自动登录。",
    user: getCurrentUser()
  };
}

// 登录本质上就是：
// 1. 去本地 users 里找用户名和密码匹配的用户
// 2. 找到后把该用户 id 记到 sessionUserId
export function loginUser(formData) {
  const username = cleanString(formData.username).toLowerCase();
  const password = cleanString(formData.password);
  const user = getUsers().find(
    (item) => item.username === username && item.password === password
  );

  if (!user) {
    return { ok: false, message: "用户名或密码不正确。" };
  }

  setSessionUserId(user.id);
  return {
    ok: true,
    message: "登录成功。",
    user: getCurrentUser()
  };
}

// 退出登录不会删除练习记录，只是清掉“当前是谁登录”的标记。
export function logoutUser() {
  saveJSON(STORAGE_KEYS.sessionUserId, null);
}

export function getBackendStudentSession() {
  return loadJSON(STORAGE_KEYS.backendStudentSession, null);
}

export function saveBackendStudentSession(session) {
  saveJSON(STORAGE_KEYS.backendStudentSession, session || null);
  return getBackendStudentSession();
}

export function getAdminSession() {
  return loadJSON(STORAGE_KEYS.adminSession, null);
}

export function saveAdminSession(session) {
  saveJSON(STORAGE_KEYS.adminSession, session || null);
  return getAdminSession();
}

export function loginAdmin(formData) {
  const username = cleanString(formData.username).toLowerCase();
  const password = cleanString(formData.password);

  if (
    username !== DEFAULT_ADMIN_ACCOUNT.username ||
    password !== DEFAULT_ADMIN_ACCOUNT.password
  ) {
    return {
      ok: false,
      message: "管理员账号或密码不正确。"
    };
  }

  const session = {
    id: DEFAULT_ADMIN_ACCOUNT.id,
    username: DEFAULT_ADMIN_ACCOUNT.username,
    name: DEFAULT_ADMIN_ACCOUNT.name,
    role: DEFAULT_ADMIN_ACCOUNT.role,
    loggedAt: new Date().toISOString()
  };

  saveJSON(STORAGE_KEYS.adminSession, session);
  return {
    ok: true,
    adminSession: getAdminSession()
  };
}

export function logoutAdmin() {
  saveAdminSession(null);
}

export function getAdminPassageMeta() {
  return loadJSON(STORAGE_KEYS.adminPassageMeta, {});
}

export function saveAdminPassageMeta(passageId, formData = {}) {
  const nextMetaMap = getAdminPassageMeta();

  nextMetaMap[passageId] = {
    status: cleanString(formData.status) === "draft" ? "draft" : "published",
    featured: Boolean(formData.featured),
    note: cleanString(formData.note),
    updatedAt: new Date().toISOString()
  };

  saveJSON(STORAGE_KEYS.adminPassageMeta, nextMetaMap);
  return cloneJSON(nextMetaMap);
}

export function removeAdminPassageMeta(passageId) {
  const nextMetaMap = getAdminPassageMeta();
  delete nextMetaMap[passageId];
  saveJSON(STORAGE_KEYS.adminPassageMeta, nextMetaMap);
  return cloneJSON(nextMetaMap);
}

export function getManagedLibrary(baseRawLibrary = { passages: [], questions: [] }) {
  const storedLibrary = loadJSON(STORAGE_KEYS.managedLibrary, null);
  const fallbackLibrary = cloneJSON(baseRawLibrary || { passages: [], questions: [] });

  if (!storedLibrary) {
    return fallbackLibrary;
  }

  return {
    passages: Array.isArray(storedLibrary.passages) ? cloneJSON(storedLibrary.passages) : fallbackLibrary.passages,
    questions: Array.isArray(storedLibrary.questions) ? cloneJSON(storedLibrary.questions) : fallbackLibrary.questions
  };
}

export function saveManagedLibrary(rawLibrary = { passages: [], questions: [] }) {
  const nextLibrary = {
    passages: Array.isArray(rawLibrary.passages) ? cloneJSON(rawLibrary.passages) : [],
    questions: Array.isArray(rawLibrary.questions) ? cloneJSON(rawLibrary.questions) : []
  };

  saveJSON(STORAGE_KEYS.managedLibrary, nextLibrary);
  return cloneJSON(nextLibrary);
}

export function resetManagedLibrary() {
  try {
    window.localStorage.removeItem(STORAGE_KEYS.managedLibrary);
  } catch {
    return;
  }
}
