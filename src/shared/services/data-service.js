import {
  cleanString,
  countBy,
  normalizeAnswer,
  uniqueList
} from "../utils/index.js";

// data-service.js 是“数据处理层”。
// 它不直接碰页面 DOM，而是负责：
// 1. 整理原始题库数据
// 2. 处理筛选
// 3. 判分
// 4. 生成推荐题
// 5. 统计个人中心要展示的数据

// 把原始题库整理成界面可直接消费的统一结构。
// 原始数据里 passages 和 questions 是分开的，
// 这里会重新组装成“每篇文章下面直接带自己的 questions 数组”的形式。
export function normalizeLibrary(rawLibrary) {
  const passages = Array.isArray(rawLibrary.passages) ? rawLibrary.passages : [];
  const questions = Array.isArray(rawLibrary.questions) ? rawLibrary.questions : [];

  // 先把每篇文章整理成 Map，后面就可以用 passageId 快速找到对应文章。
  const passageMap = new Map(
    passages.map((passage) => [
      Number(passage.id),
      {
        id: Number(passage.id),
        title: cleanString(passage.title),
        content: cleanString(passage.content),
        source: cleanString(passage.source),
        year: cleanString(passage.year)
      }
    ])
  );

  const questionMap = new Map();

  questions.forEach((question) => {
    const passageId = Number(question.passage_id);
    const passage = passageMap.get(passageId);
    if (!passage) {
      return;
    }

    // 把题目字段也顺手清洗一遍，并补上默认值。
    // 这样视图层拿到数据时就不需要处处判断空值。
    const normalized = {
      id: Number(question.id),
      passageId,
      blankNumber: Number(question.blank_number),
      questionText: cleanString(question.question_text),
      correctAnswer: cleanString(question.correct_answer),
      grammarTag: cleanString(question.grammar_tag) || "未分类",
      difficulty: cleanString(question.difficulty) || "未标注",
      givenWord:
        cleanString(question.given_word) ||
        inferGivenWord(passage.content, Number(question.blank_number)),
      explanation:
        cleanString(question.explanation) ||
        `本题考查 ${cleanString(question.grammar_tag) || "相关语法"}。`,
      source: cleanString(question.source) || passage.source,
      year: cleanString(question.year) || passage.year,
      type: cleanString(question.type) || "语法填空"
    };

    if (!questionMap.has(passageId)) {
      questionMap.set(passageId, []);
    }

    // questionMap 最终会变成：
    // 文章 id => 这篇文章下所有题目的数组
    questionMap.get(passageId).push(normalized);
  });

  const normalizedPassages = passages
    .map((passage) => {
      const basePassage = passageMap.get(Number(passage.id));
      const relatedQuestions = (questionMap.get(Number(passage.id)) || []).sort(
        (a, b) => a.blankNumber - b.blankNumber
      );

      return {
        ...basePassage,
        questionCount: relatedQuestions.length,
        questions: relatedQuestions,
        // 一篇文章里涉及到哪些语法点，这里先去重后挂到 tags。
        tags: uniqueList(relatedQuestions.map((item) => item.grammarTag)),
        // excerpt 是题库卡片上的摘要，避免列表里把整篇原文都放出来。
        excerpt: buildExcerpt(basePassage.content)
      };
    })
    // 没题目的文章在当前项目里没有意义，直接过滤掉。
    .filter((item) => item.questionCount > 0);

  return composeLibrary(normalizedPassages);
}

// 有些场景拿到的已经是“前端友好格式”的 passage 列表了，
// 比如未来从真实接口拼回来的列表；这时不需要再走 question.json 的字段映射，
// 只需要把列表整理成首页 / 题库页可直接使用的 Library 结构。
export function composeLibrary(passages = []) {
  const normalizedPassages = (Array.isArray(passages) ? passages : [])
    .map((passage) => {
      const questions = Array.isArray(passage.questions)
        ? passage.questions
            .map((question) => ({
              ...question,
              id: Number(question.id),
              passageId: Number(question.passageId),
              blankNumber: Number(question.blankNumber),
              questionText: cleanString(question.questionText),
              correctAnswer: cleanString(question.correctAnswer),
              grammarTag: cleanString(question.grammarTag) || "未分类",
              difficulty: cleanString(question.difficulty) || "未标注",
              givenWord: cleanString(question.givenWord),
              explanation: cleanString(question.explanation),
              source: cleanString(question.source),
              year: cleanString(question.year),
              type: cleanString(question.type) || "语法填空"
            }))
            .sort((a, b) => a.blankNumber - b.blankNumber)
        : [];

      const fallbackTags = questions.map((item) => item.grammarTag);
      const tags = uniqueList((passage.tags?.length ? passage.tags : fallbackTags).map(cleanString));
      const content = cleanString(passage.content);

      return {
        id: Number(passage.id),
        title: cleanString(passage.title),
        content,
        source: cleanString(passage.source),
        year: cleanString(passage.year),
        questionCount: Number(passage.questionCount) || questions.length,
        tags,
        excerpt: cleanString(passage.excerpt) || buildExcerpt(content),
        questions
      };
    })
    .filter((item) => item.questionCount > 0)
    .sort((a, b) => Number(b.year) - Number(a.year) || a.id - b.id);

  const tagCounts = countBy(
    normalizedPassages.flatMap((passage) =>
      passage.questions.length ? passage.questions.map((item) => item.grammarTag) : passage.tags
    )
  );

  return {
    passages: normalizedPassages,
    years: uniqueList(normalizedPassages.map((passage) => passage.year)).sort(
      (a, b) => Number(b) - Number(a)
    ),
    tags: [...tagCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN")),
    totalQuestions: normalizedPassages.reduce((sum, item) => sum + item.questionCount, 0)
  };
}

// 题库筛选逻辑。
// 只有年份、考点、关键词三个条件都满足，文章才会被保留。
export function getFilteredPassages(library, filters) {
  if (!library) {
    return [];
  }

  return library.passages.filter((passage) => {
    const matchYear = filters.year === "all" || passage.year === filters.year;
    const matchTag = filters.tag === "all" || passage.tags.includes(filters.tag);
    const keyword = normalizeAnswer(filters.query);
    const matchQuery =
      !keyword ||
      normalizeAnswer([passage.title, passage.content, passage.source].join(" ")).includes(keyword);

    return matchYear && matchTag && matchQuery;
  });
}

// 按 id 找到某一篇文章。
export function findPassage(library, passageId) {
  return library?.passages.find((item) => Number(item.id) === Number(passageId)) || null;
}

// 取出某篇文章当前对应的答案对象。
// 如果用户之前从没做过这篇，就先创建一个空对象。
export function getAnswersForPassage(practiceState, passageId) {
  if (!practiceState.answersByPassage[passageId]) {
    practiceState.answersByPassage[passageId] = {};
  }

  return practiceState.answersByPassage[passageId];
}

// 统计当前已经填了多少空。
export function countAnswered(answerMap) {
  return Object.values(answerMap || {}).filter((value) => cleanString(value)).length;
}

// 清空某一篇文章的答案。
// 注意：这里只清答案，不会删掉历史提交记录。
export function resetPassageAnswers(practiceState, passageId) {
  practiceState.answersByPassage[passageId] = {};
  return practiceState;
}

// 修改某一篇文章中某一空的答案。
// 这里直接改 practiceState 本身，因为这个项目没有使用不可变状态方案。
export function updatePassageAnswer(practiceState, passageId, blankNumber, value) {
  const answers = getAnswersForPassage(practiceState, passageId);
  answers[blankNumber] = value;
  practiceState.answersByPassage[passageId] = answers;
  return practiceState;
}

// 把一次提交转换成完整的判分结果。
// 返回的 result 会被结果页直接使用，也会写入最近一次结果和历史记录。
export function buildResult(library, passage, answers) {
  const details = passage.questions.map((question) => {
    const userAnswer = cleanString(answers[question.blankNumber]);
    const correctAnswer = cleanString(question.correctAnswer);
    const isCorrect = isAnswerCorrect(userAnswer, correctAnswer);

    // details 数组中的每一项，都会对应结果页右侧的一张解析卡片。
    return {
      blankNumber: question.blankNumber,
      grammarTag: question.grammarTag,
      difficulty: question.difficulty,
      givenWord: question.givenWord,
      explanation: question.explanation,
      questionText: question.questionText,
      userAnswer,
      correctAnswer,
      isCorrect
    };
  });

  const correctCount = details.filter((item) => item.isCorrect).length;
  const wrongCount = details.length - correctCount;
  const accuracy = Math.round((correctCount / details.length) * 100);
  // 错题考点会作为后续复盘重点；如果全对，就回退到本篇主要考点。
  const focusTags = uniqueList(
    details.filter((item) => !item.isCorrect).map((item) => item.grammarTag)
  );

  return {
    passageId: passage.id,
    title: passage.title,
    year: passage.year,
    createdAt: new Date().toISOString(),
    accuracy,
    correctCount,
    wrongCount,
    details,
    focusTags: focusTags.length ? focusTags : passage.tags.slice(0, 3),
    recommendations: buildRecommendations(
      library,
      passage.id,
      focusTags.length ? focusTags : passage.tags
    )
  };
}

// 推荐题只围绕当前最需要补的前几个考点展开，避免推荐过散。
export function buildRecommendations(library, currentPassageId, targetTags) {
  const tagPriority = uniqueList(targetTags).slice(0, 3);

  // 这里推荐的不是“完全相同的一篇文章”，
  // 而是其他文章里与当前薄弱考点相关的空。
  return library.passages
    .filter((passage) => Number(passage.id) !== Number(currentPassageId))
    .flatMap((passage) =>
      passage.questions
        .filter((question) => tagPriority.includes(question.grammarTag))
        .map((question) => ({
          passageId: passage.id,
          title: passage.title,
          year: passage.year,
          blankNumber: question.blankNumber,
          grammarTag: question.grammarTag,
          difficulty: question.difficulty,
          givenWord: question.givenWord
        }))
    )
    .sort((a, b) => tagPriority.indexOf(a.grammarTag) - tagPriority.indexOf(b.grammarTag))
    .slice(0, 6);
}

// 把本次提交写进历史记录，并更新最近一次结果。
// history 里只保留摘要，避免把整份 result.details 一直堆进去。
export function pushHistory(practiceState, result) {
  const summary = {
    passageId: result.passageId,
    title: result.title,
    year: result.year,
    accuracy: result.accuracy,
    focusTags: result.focusTags,
    createdAt: result.createdAt
  };

  practiceState.lastResult = result;
  practiceState.history = [
    summary,
    ...(practiceState.history || []).filter(
      (item) =>
        !(Number(item.passageId) === Number(summary.passageId) && item.createdAt === summary.createdAt)
    )
  ].slice(0, 12);

  return practiceState;
}

// 个人中心的统计全部基于历史提交记录汇总得到。
export function buildProfileSummary(practiceState) {
  const history = practiceState.history || [];
  const accuracyList = history.map((item) => Number(item.accuracy) || 0);
  const avgAccuracy = accuracyList.length
    ? Math.round(accuracyList.reduce((sum, value) => sum + value, 0) / accuracyList.length)
    : 0;
  const weakTagCounts = countBy(history.flatMap((item) => item.focusTags || []));

  return {
    completedPassages: uniqueList(history.map((item) => item.passageId)).length,
    submissionCount: history.length,
    avgAccuracy,
    bestAccuracy: accuracyList.length ? Math.max(...accuracyList) : 0,
    weakTags: [...weakTagCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  };
}

// 根据准确率返回一段更贴近学习场景的提示语。
export function buildResultAdvice(result) {
  if (result.accuracy >= 90) {
    return "这篇整体已经比较稳，可以继续刷同类题，把细节准确率再抬高一点。";
  }

  if (result.accuracy >= 60) {
    return `基础已经有了，接下来重点回看 ${result.focusTags.slice(0, 3).join("、")}。`;
  }

  return `建议先集中复盘 ${result.focusTags.slice(0, 3).join("、")}，再继续下一篇会更轻松。`;
}

// 从整篇原文中截取一小段摘要，供题库页展示。
function buildExcerpt(content) {
  const normalized = cleanString(content).replace(/\s+/g, " ");
  return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized;
}

// 题库里有些提示词没单独给字段，这里尝试从原文空号后面的括号中推断。
function inferGivenWord(content, blankNumber) {
  if (!content) {
    return "";
  }

  const pattern = new RegExp(
    `\\(\\s*${blankNumber}\\s*\\)\\s*(?:_+\\s*)+(?:\\(\\s*([^()]+?)\\s*\\))?`,
    "i"
  );
  const match = content.match(pattern);
  return cleanString(match?.[1]);
}

// 判题时，先把用户答案做归一化，再去和标准答案比。
function isAnswerCorrect(userAnswer, correctAnswer) {
  const normalizedUserAnswer = normalizeAnswer(userAnswer);
  if (!normalizedUserAnswer) {
    return false;
  }

  const acceptedAnswers = splitAcceptedAnswers(correctAnswer);
  return acceptedAnswers.includes(normalizedUserAnswer);
}

// 标准答案允许使用 "/" 分隔多个可接受写法。
function splitAcceptedAnswers(correctAnswer) {
  const raw = cleanString(correctAnswer);
  if (!raw) {
    return [];
  }

  const parts = raw
    .split(/[/／]/)
    .map((item) => normalizeAnswer(item))
    .filter(Boolean);

  return parts.length ? parts : [normalizeAnswer(raw)];
}
