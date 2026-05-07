import {
  buildAdminRecentSubmissions,
  buildAdminUserRows,
  getPassageAdminMeta
} from "../shared/services/admin-service.js";
import { cleanString, cloneJSON, countBy, uniqueList } from "../shared/utils/index.js";

export const ADMIN_CONSOLE_TABS = {
  overview: "overview",
  content: "content",
  users: "users"
};

export const ADMIN_CONTENT_FILTERS = {
  year: "all",
  status: "all",
  query: ""
};

export function createEmptyPassageDraft(defaultYear = String(new Date().getFullYear())) {
  return {
    id: "",
    title: "",
    content: "",
    source: "",
    year: defaultYear,
    status: "draft",
    featured: false,
    note: ""
  };
}

export function createEmptyQuestionDraft(passageId = "", nextBlankNumber = 1) {
  return {
    id: "",
    passageId: passageId ? Number(passageId) : "",
    blankNumber: nextBlankNumber,
    questionText: "",
    givenWord: "",
    correctAnswer: "",
    grammarTag: "",
    difficulty: "中等",
    explanation: "",
    type: "语法填空"
  };
}

export function ensureRawLibrary(rawLibrary = {}) {
  return {
    passages: Array.isArray(rawLibrary.passages) ? cloneJSON(rawLibrary.passages) : [],
    questions: Array.isArray(rawLibrary.questions) ? cloneJSON(rawLibrary.questions) : []
  };
}

export function buildAdminDashboard(rawLibrary, passageMetaMap, registeredUsers = []) {
  const safeLibrary = ensureRawLibrary(rawLibrary);
  const passageRows = buildAdminContentRows(safeLibrary, passageMetaMap, ADMIN_CONTENT_FILTERS);
  const userRows = buildAdminUserRows(registeredUsers);
  const recentSubmissions = buildAdminRecentSubmissions(registeredUsers);
  const weakTagCounts = countBy(recentSubmissions.flatMap((item) => item.focusTags || []));
  const tagCounts = countBy(
    safeLibrary.questions.map((question) => cleanString(question.grammar_tag) || "未分类")
  );

  return {
    totalPassages: safeLibrary.passages.length,
    totalQuestions: safeLibrary.questions.length,
    publishedCount: passageRows.filter((item) => item.status === "published").length,
    draftCount: passageRows.filter((item) => item.status === "draft").length,
    featuredCount: passageRows.filter((item) => item.featured).length,
    zeroQuestionCount: passageRows.filter((item) => item.questionCount === 0).length,
    registeredUserCount: registeredUsers.length,
    activeUserCount: userRows.filter((item) => item.submissionCount > 0).length,
    submissionCount: recentSubmissions.length,
    avgAccuracy: userRows.length
      ? Math.round(
          userRows.reduce((sum, item) => sum + item.avgAccuracy, 0) /
            Math.max(userRows.filter((item) => item.submissionCount > 0).length, 1)
        )
      : 0,
    topTags: [...tagCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"))
      .slice(0, 8),
    weakTags: [...weakTagCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    featuredPassages: passageRows.filter((item) => item.featured).slice(0, 4),
    recentSubmissions: recentSubmissions.slice(0, 8)
  };
}

export function buildAdminContentRows(rawLibrary, passageMetaMap, filters = ADMIN_CONTENT_FILTERS) {
  const safeLibrary = ensureRawLibrary(rawLibrary);
  const questionsByPassage = buildQuestionsByPassage(safeLibrary.questions);
  const query = cleanString(filters.query).toLowerCase();

  return safeLibrary.passages
    .map((passage) => {
      const passageId = Number(passage.id);
      const relatedQuestions = (questionsByPassage.get(passageId) || []).sort(
        (a, b) => Number(a.blank_number) - Number(b.blank_number)
      );
      const tags = uniqueList(
        relatedQuestions.map((question) => cleanString(question.grammar_tag) || "未分类")
      );
      const meta = getPassageAdminMeta(passageMetaMap, passageId);

      return {
        id: passageId,
        title: cleanString(passage.title) || `未命名篇章 ${passageId}`,
        source: cleanString(passage.source),
        year: cleanString(passage.year),
        content: cleanString(passage.content),
        excerpt: buildExcerpt(passage.content),
        questionCount: relatedQuestions.length,
        tags,
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
        [passage.title, passage.source, passage.excerpt, passage.tags.join(" "), passage.note]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return matchYear && matchStatus && matchQuery;
    })
    .sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.year) - Number(a.year) || a.id - b.id);
}

export function buildAdminContentDetail(rawLibrary, passageMetaMap, passageId) {
  const safeLibrary = ensureRawLibrary(rawLibrary);
  const passage = safeLibrary.passages.find((item) => Number(item.id) === Number(passageId)) || null;
  if (!passage) {
    return null;
  }

  return {
    passage: {
      id: Number(passage.id),
      title: cleanString(passage.title),
      source: cleanString(passage.source),
      year: cleanString(passage.year),
      content: cleanString(passage.content)
    },
    meta: getPassageAdminMeta(passageMetaMap, passageId),
    questions: buildQuestionRows(safeLibrary, passageId)
  };
}

export function buildPassageDraft(rawLibrary, passageMetaMap, passageId) {
  const detail = buildAdminContentDetail(rawLibrary, passageMetaMap, passageId);
  if (!detail) {
    return createEmptyPassageDraft();
  }

  return {
    id: detail.passage.id,
    title: detail.passage.title,
    source: detail.passage.source,
    year: detail.passage.year,
    content: detail.passage.content,
    status: detail.meta.status,
    featured: detail.meta.featured,
    note: detail.meta.note
  };
}

export function buildQuestionDraft(rawLibrary, passageId, questionId) {
  const safeLibrary = ensureRawLibrary(rawLibrary);
  const rows = buildQuestionRows(safeLibrary, passageId);
  const selectedQuestion = rows.find((item) => Number(item.id) === Number(questionId));

  if (!selectedQuestion) {
    return createEmptyQuestionDraft(passageId, getNextBlankNumber(rows));
  }

  return {
    id: selectedQuestion.id,
    passageId: Number(passageId),
    blankNumber: selectedQuestion.blankNumber,
    questionText: selectedQuestion.questionText,
    givenWord: selectedQuestion.givenWord,
    correctAnswer: selectedQuestion.correctAnswer,
    grammarTag: selectedQuestion.grammarTag,
    difficulty: selectedQuestion.difficulty,
    explanation: selectedQuestion.explanation,
    type: selectedQuestion.type
  };
}

export function buildQuestionRows(rawLibrary, passageId) {
  const safeLibrary = ensureRawLibrary(rawLibrary);

  return safeLibrary.questions
    .filter((question) => Number(question.passage_id) === Number(passageId))
    .map((question) => ({
      id: Number(question.id),
      passageId: Number(question.passage_id),
      blankNumber: Number(question.blank_number),
      questionText: cleanString(question.question_text),
      givenWord: cleanString(question.given_word),
      correctAnswer: cleanString(question.correct_answer),
      grammarTag: cleanString(question.grammar_tag) || "未分类",
      difficulty: cleanString(question.difficulty) || "未标注",
      explanation: cleanString(question.explanation),
      type: cleanString(question.type) || "语法填空"
    }))
    .sort((a, b) => a.blankNumber - b.blankNumber);
}

export function savePassageDraft(rawLibrary, draft = {}) {
  const safeLibrary = ensureRawLibrary(rawLibrary);
  const title = cleanString(draft.title);
  const source = cleanString(draft.source);
  const year = cleanString(draft.year);
  const content = cleanString(draft.content);
  const status = cleanString(draft.status) === "published" ? "published" : "draft";
  const passageId = Number(draft.id) || getNextId(safeLibrary.passages);

  if (!title) {
    throw new Error("请先填写篇章标题。");
  }

  if (!source) {
    throw new Error("请先填写篇章来源。");
  }

  if (!year) {
    throw new Error("请先填写篇章年份。");
  }

  if (status === "published" && !content) {
    throw new Error("已发布篇章需要填写完整原文内容。");
  }

  const nextPassage = {
    id: passageId,
    title,
    content,
    source,
    year
  };
  const existingIndex = safeLibrary.passages.findIndex((item) => Number(item.id) === passageId);

  if (existingIndex >= 0) {
    safeLibrary.passages[existingIndex] = nextPassage;
  } else {
    safeLibrary.passages.push(nextPassage);
  }

  safeLibrary.questions = safeLibrary.questions.map((question) =>
    Number(question.passage_id) === passageId
      ? {
          ...question,
          source,
          year
        }
      : question
  );

  if (status === "published" && !safeLibrary.questions.some((question) => Number(question.passage_id) === passageId)) {
    throw new Error("已发布篇章至少要有一道题，建议先保存为草稿后继续补题。");
  }

  return {
    rawLibrary: safeLibrary,
    passageId
  };
}

export function saveQuestionDraft(rawLibrary, draft = {}) {
  const safeLibrary = ensureRawLibrary(rawLibrary);
  const passageId = Number(draft.passageId);
  const blankNumber = Number(draft.blankNumber);
  const questionId = Number(draft.id) || getNextId(safeLibrary.questions);
  const passage = safeLibrary.passages.find((item) => Number(item.id) === passageId);

  if (!passage) {
    throw new Error("请先选中一篇篇章，再保存题目。");
  }

  if (!Number.isInteger(blankNumber) || blankNumber <= 0) {
    throw new Error("题号必须是大于 0 的整数。");
  }

  const questionText = cleanString(draft.questionText);
  const correctAnswer = cleanString(draft.correctAnswer);
  const grammarTag = cleanString(draft.grammarTag);

  if (!questionText) {
    throw new Error("请先填写题干。");
  }

  if (!correctAnswer) {
    throw new Error("请先填写标准答案。");
  }

  if (!grammarTag) {
    throw new Error("请先填写语法标签。");
  }

  const hasDuplicateBlank = safeLibrary.questions.some(
    (question) =>
      Number(question.passage_id) === passageId &&
      Number(question.blank_number) === blankNumber &&
      Number(question.id) !== questionId
  );

  if (hasDuplicateBlank) {
    throw new Error(`第 ${blankNumber} 空已经存在，请换一个题号。`);
  }

  const nextQuestion = {
    id: questionId,
    passage_id: passageId,
    type: cleanString(draft.type) || "语法填空",
    question_text: questionText,
    blank_number: blankNumber,
    given_word: cleanString(draft.givenWord) || null,
    options: null,
    correct_answer: correctAnswer,
    grammar_tag: grammarTag,
    difficulty: cleanString(draft.difficulty) || "中等",
    source: cleanString(passage.source),
    year: cleanString(passage.year),
    explanation: cleanString(draft.explanation) || `考查${grammarTag}。`
  };
  const existingIndex = safeLibrary.questions.findIndex((item) => Number(item.id) === questionId);

  if (existingIndex >= 0) {
    safeLibrary.questions[existingIndex] = nextQuestion;
  } else {
    safeLibrary.questions.push(nextQuestion);
  }

  return {
    rawLibrary: safeLibrary,
    questionId
  };
}

export function deletePassageDraft(rawLibrary, passageId) {
  const safeLibrary = ensureRawLibrary(rawLibrary);

  return {
    rawLibrary: {
      passages: safeLibrary.passages.filter((passage) => Number(passage.id) !== Number(passageId)),
      questions: safeLibrary.questions.filter((question) => Number(question.passage_id) !== Number(passageId))
    }
  };
}

export function deleteQuestionDraft(rawLibrary, questionId) {
  const safeLibrary = ensureRawLibrary(rawLibrary);

  return {
    rawLibrary: {
      passages: safeLibrary.passages,
      questions: safeLibrary.questions.filter((question) => Number(question.id) !== Number(questionId))
    }
  };
}

function buildQuestionsByPassage(questions = []) {
  return questions.reduce((map, question) => {
    const passageId = Number(question.passage_id);
    if (!map.has(passageId)) {
      map.set(passageId, []);
    }

    map.get(passageId).push(question);
    return map;
  }, new Map());
}

function getNextId(items = []) {
  return items.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) + 1;
}

function getNextBlankNumber(questionRows = []) {
  return questionRows.reduce((maxBlank, item) => Math.max(maxBlank, Number(item.blankNumber) || 0), 0) + 1;
}

function buildExcerpt(content) {
  const normalized = cleanString(content).replace(/\s+/g, " ");
  return normalized.length > 120 ? `${normalized.slice(0, 120)}...` : normalized;
}
