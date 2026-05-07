import { buildProfileSummary, composeLibrary } from "./data-service.js";
import { cleanString, countBy, uniqueList } from "../utils/index.js";

export const ADMIN_TABS = {
  overview: "overview",
  content: "content",
  users: "users"
};

export const ADMIN_DEFAULT_FILTERS = {
  year: "all",
  status: "all",
  query: ""
};

export function createEmptyAdminEditor() {
  return {
    passageId: null,
    status: "published",
    featured: false,
    note: ""
  };
}

export function getPassageAdminMeta(passageMetaMap, passageId) {
  const raw = passageMetaMap?.[passageId] || {};

  return {
    status: raw.status === "draft" ? "draft" : "published",
    featured: Boolean(raw.featured),
    note: cleanString(raw.note),
    updatedAt: cleanString(raw.updatedAt)
  };
}

export function buildPublishedLibrary(library, passageMetaMap) {
  if (!library) {
    return null;
  }

  return composeLibrary(
    library.passages.filter((passage) => getPassageAdminMeta(passageMetaMap, passage.id).status !== "draft")
  );
}

export function buildFeaturedPassages(library, passageMetaMap, limit = 3) {
  const publishedLibrary = buildPublishedLibrary(library, passageMetaMap);
  const passages = publishedLibrary?.passages || [];

  return [...passages]
    .sort((a, b) => {
      const aMeta = getPassageAdminMeta(passageMetaMap, a.id);
      const bMeta = getPassageAdminMeta(passageMetaMap, b.id);

      return Number(bMeta.featured) - Number(aMeta.featured) || Number(b.year) - Number(a.year) || a.id - b.id;
    })
    .slice(0, limit);
}

export function buildAdminOverview(library, passageMetaMap, registeredUsers = []) {
  const allPassages = library?.passages || [];
  const publishedLibrary = buildPublishedLibrary(library, passageMetaMap);
  const publishedPassages = publishedLibrary?.passages || [];
  const passageRows = buildAdminPassageRows(library, passageMetaMap, ADMIN_DEFAULT_FILTERS);
  const userRows = buildAdminUserRows(registeredUsers);
  const recentSubmissions = buildAdminRecentSubmissions(registeredUsers);
  const weakTagCounts = countBy(recentSubmissions.flatMap((item) => item.focusTags || []));

  return {
    totalPassages: allPassages.length,
    totalQuestions: library?.totalQuestions || 0,
    publishedCount: passageRows.filter((item) => item.status === "published").length,
    draftCount: passageRows.filter((item) => item.status === "draft").length,
    featuredCount: passageRows.filter((item) => item.featured).length,
    registeredUserCount: registeredUsers.length,
    activeUserCount: userRows.filter((item) => item.submissionCount > 0).length,
    submissionCount: recentSubmissions.length,
    avgAccuracy: userRows.length
      ? Math.round(
          userRows.reduce((sum, item) => sum + item.avgAccuracy, 0) / Math.max(userRows.filter((item) => item.submissionCount > 0).length, 1)
        )
      : 0,
    topTags: library?.tags?.slice(0, 8) || [],
    weakTags: [...weakTagCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    featuredPassages: buildFeaturedPassages(library, passageMetaMap, 4),
    recentSubmissions: recentSubmissions.slice(0, 8),
    publishedPassages
  };
}

export function buildAdminPassageRows(library, passageMetaMap, filters = ADMIN_DEFAULT_FILTERS) {
  const query = cleanString(filters.query).toLowerCase();

  return (library?.passages || [])
    .map((passage) => {
      const meta = getPassageAdminMeta(passageMetaMap, passage.id);

      return {
        id: passage.id,
        title: passage.title,
        year: passage.year,
        source: passage.source,
        excerpt: passage.excerpt,
        questionCount: passage.questionCount,
        tags: passage.tags,
        status: meta.status,
        featured: meta.featured,
        note: meta.note,
        updatedAt: meta.updatedAt
      };
    })
    .filter((passage) => {
      const matchYear = filters.year === "all" || passage.year === filters.year;
      const matchStatus = filters.status === "all" || passage.status === filters.status;
      const matchQuery =
        !query ||
        [passage.title, passage.source, passage.excerpt, passage.tags.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return matchYear && matchStatus && matchQuery;
    })
    .sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.year) - Number(a.year) || a.id - b.id);
}

export function buildAdminPassageDetail(library, passageMetaMap, passageId) {
  const passage = (library?.passages || []).find((item) => Number(item.id) === Number(passageId)) || null;
  if (!passage) {
    return null;
  }

  return {
    passage,
    meta: getPassageAdminMeta(passageMetaMap, passage.id),
    tagSummary: uniqueList(passage.questions.map((item) => item.grammarTag)).slice(0, 10)
  };
}

export function buildAdminUserRows(registeredUsers = []) {
  return [...registeredUsers]
    .map((user) => {
      const summary = buildProfileSummary(user.practice || {});
      const latestResult = user.practice?.lastResult || null;

      return {
        id: user.id,
        username: user.username,
        nickname: user.nickname || user.username,
        grade: user.grade || "未填写",
        createdAt: user.createdAt,
        completedPassages: summary.completedPassages,
        submissionCount: summary.submissionCount,
        avgAccuracy: summary.avgAccuracy,
        bestAccuracy: summary.bestAccuracy,
        weakTags: summary.weakTags,
        latestTitle: latestResult?.title || "",
        latestAccuracy: latestResult?.accuracy || 0,
        latestAt: latestResult?.createdAt || ""
      };
    })
    .sort((a, b) => Number(Boolean(b.latestAt)) - Number(Boolean(a.latestAt)) || cleanString(b.latestAt).localeCompare(cleanString(a.latestAt)));
}

export function buildAdminRecentSubmissions(registeredUsers = []) {
  return registeredUsers
    .flatMap((user) =>
      (user.practice?.history || []).map((item) => ({
        ...item,
        userId: user.id,
        username: user.username,
        nickname: user.nickname || user.username,
        grade: user.grade || "未填写"
      }))
    )
    .sort((a, b) => cleanString(b.createdAt).localeCompare(cleanString(a.createdAt)));
}
