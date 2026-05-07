export function cleanString(value) {
  return String(value ?? "").trim();
}

// 因为很多页面都是通过 innerHTML 拼出来的，
// 所以一定要把用户输入或外部文本中的特殊字符转义掉，
// 否则浏览器可能把它们当成真正的 HTML 标签来解析。
export function escapeHTML(value) {
  return cleanString(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 判题和搜索都先做轻量归一化，避免大小写和多空格带来的干扰。
export function normalizeAnswer(value) {
  return cleanString(value).toLowerCase().replace(/\s+/g, " ");
}

export function uniqueList(items) {
  return [...new Set((items || []).filter(Boolean))];
}

// countBy 会统计每个值出现的次数。
// 例如 ["介词", "从句", "介词"] 会得到：
// Map { "介词" => 2, "从句" => 1 }
export function countBy(items) {
  return (items || []).reduce((map, item) => {
    map.set(item, (map.get(item) || 0) + 1);
    return map;
  }, new Map());
}

export function formatTime(isoTime) {
  if (!isoTime) {
    return "刚刚";
  }

  try {
    return new Date(isoTime).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return isoTime;
  }
}

// 路由全部走 hash，格式统一约定为 "#view/id"。
// 例如：
// #home -> 首页
// #bank -> 题库页
// #practice/3 -> 第 3 篇练习
export function parseRoute(hashValue = window.location.hash) {
  const rawHash = hashValue.replace(/^#/, "") || "home";
  const [view, id] = rawHash.split("/");

  return {
    view: view || "home",
    passageId: id ? Number(id) : null
  };
}

// 统一包一层 JSON 读写，避免 localStorage 异常直接打断页面。
// 如果 JSON 解析失败或浏览器限制了读取，就退回到默认值。
export function loadJSON(key, fallbackValue) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

export function saveJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

// 当前数据结构够简单，深拷贝直接用 JSON 即可。
// 它的作用是：避免拿到原对象后直接改，影响到原始数据。
export function cloneJSON(value) {
  return JSON.parse(JSON.stringify(value));
}

// 统一生成 hash 地址，避免项目里到处手写字符串。
export function buildHash(view, passageId = null) {
  return passageId ? `#${view}/${passageId}` : `#${view}`;
}
