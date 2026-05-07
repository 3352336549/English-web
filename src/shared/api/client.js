import * as backendApi from "./backend.js";
import * as mockApi from "./mock.js";

const runtimeConfig = window.__GRAMMAR_APP_CONFIG__ || {};
const API_MODE = runtimeConfig.apiMode === "backend" ? "backend" : "mock";
const activeApi = API_MODE === "backend" ? backendApi : mockApi;

export function getApiMode() {
  return API_MODE;
}

export const loadLibrary = (...args) => activeApi.loadLibrary(...args);
export const getLearningSnapshot = (...args) => activeApi.getLearningSnapshot(...args);
export const register = (...args) => activeApi.register(...args);
export const login = (...args) => activeApi.login(...args);
export const logout = (...args) => activeApi.logout(...args);
export const savePracticeState = (...args) => activeApi.savePracticeState(...args);
export const submitPractice = (...args) => activeApi.submitPractice(...args);
export const getAdminSnapshot = (...args) => activeApi.getAdminSnapshot(...args);
export const loginAdmin = (...args) => activeApi.loginAdmin(...args);
export const logoutAdmin = (...args) => activeApi.logoutAdmin(...args);
export const loadAdminWorkspace = (...args) => activeApi.loadAdminWorkspace(...args);
export const saveAdminPassage = (...args) => activeApi.saveAdminPassage(...args);
export const deleteAdminPassage = (...args) => activeApi.deleteAdminPassage(...args);
export const saveAdminQuestion = (...args) => activeApi.saveAdminQuestion(...args);
export const deleteAdminQuestion = (...args) => activeApi.deleteAdminQuestion(...args);
