/* 中英文、本地、可解释的 Task 草稿规则解析器。 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.App = root.App || {};
  root.App.taskDraftParser = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  var LABELS = {
    taskName: ["task name", "task", "任务名称", "任务", "事项", "待办", "行动项", "todo", "action item"],
    ddl: ["ddl", "deadline", "due date", "due", "截止日期", "截止", "最晚完成", "最晚"],
    groupName: ["group", "分组", "工作组"],
    flowName: ["flow", "workflow", "流程"],
    urgency: ["urgency", "priority", "紧急程度", "优先级"],
    recurrence: ["recurrence", "repeat", "周期生成", "周期", "重复"],
    recurrenceStart: ["recurrence start", "repeat start", "周期开始日期", "周期开始", "开始日期"],
    recurrenceEnd: ["recurrence end", "repeat end", "周期结束日期", "周期结束", "结束日期"],
    reportTo: ["report to", "reports to", "汇报对象", "汇报给"],
    managedObject: ["managed person", "managee", "管理对象", "管理人员"],
    deliverable: ["deliverable", "output", "result", "交付物", "输出", "成果"]
  };
  var FIELD_KEYS = Object.keys(LABELS);
  var BULLET = /^\s*(?:(?:[-*•▪◦]\s*(?:\[[ xX]?\]\s*)?)|(?:\d{1,3}(?:[.)、:]\s*|\s+))|(?:[一二三四五六七八九十]+(?:[、.):]\s*|\s+)))/;
  var TASK_LABEL_START = /^\s*(?:task(?:\s+name)?|todo|action\s+item|任务(?:名称)?|事项|待办|行动项)\s*[:：-]\s*/i;
  var RULE_EXAMPLES = {
    zh: [
      "Task：完成上线检查；DDL：2026-08-20；紧急程度：高；汇报对象：Lucy；交付物：上线确认单",
      "任务：准备周报\n分组：组内运营\n周期：每周\n周期开始：2026-08-17\n周期结束：2026-12-31",
      "下周二，完成徽章考题 kickoff（独立换行识别为一个 Task，并预填下周二 DDL）",
      "每周三完成服务周报（识别为每周重复，DDL 预填为下周三）",
      "每月15日完成月度复核（识别为每月重复，DDL 预填为下个月15日）"
    ],
    en: [
      "Task: Complete release checks; DDL: 2026-08-20; Urgency: High; Report To: Lucy; Deliverable: Release approval",
      "Action item: Prepare weekly report\nGroup: Team Operations\nRecurrence: Weekly\nRecurrence Start: 2026-08-17\nRecurrence End: 2026-12-31",
      "Every Wednesday prepare the service report (Weekly; DDL defaults to next Wednesday)",
      "Monthly on the 15th complete the review (Monthly; DDL defaults to the 15th of next month)"
    ],
    fuzzy: [
      "明天完成上线检查 / finish release checks next Friday（未列入精确前缀规则的相对日期只建议）",
      "分组：服务研伐 / Group: Servce Development（若接近既有名称，只显示建议）"
    ]
  };

  function clean(value, limit) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/\r\n/g, "\n")
      .trim()
      .slice(0, limit || 500);
  }

  function normalized(value) {
    return clean(value, 500)
      .toLocaleLowerCase()
      .replace(/[\s\u3000_\-—–·•:：,，.。/\\()（）\[\]【】]+/g, "");
  }

  function two(value) {
    return String(value).padStart(2, "0");
  }

  function isoDate(year, month, day) {
    var date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return "";
    }
    return year + "-" + two(month) + "-" + two(day);
  }

  function startOfWeek(date) {
    var result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var day = result.getDay();
    result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
    return result;
  }

  function dateIso(date) {
    return isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  function inferredYear(value) {
    var text = String(value || "");
    return text.length === 2 ? 2000 + Number(text) : Number(text);
  }

  function monthlyOccurrence(reference, day, lastDay) {
    for (var offset = 1; offset <= 12; offset += 1) {
      var first = new Date(reference.getFullYear(), reference.getMonth() + offset, 1);
      if (lastDay) {
        return new Date(first.getFullYear(), first.getMonth() + 1, 0);
      }
      var candidate = new Date(first.getFullYear(), first.getMonth(), day);
      if (candidate.getMonth() === first.getMonth()) return candidate;
    }
    return null;
  }

  function parseNaturalRecurrenceSchedule(value, referenceDate) {
    var text = clean(value, 30000);
    var reference = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
      ? new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
      : new Date();
    var chineseWeekly = text.match(/每(?:个)?(?:周|星期|礼拜)(?:的)?(?:周|星期|礼拜)?\s*([一二三四五六日天])/);
    var englishWeekly = text.match(/\b(?:(?:every|each)\s+|weekly\s+(?:on\s+)?)(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    var weekdayIndex = -1;
    var source = "";
    if (chineseWeekly) {
      weekdayIndex = { 一: 0, 二: 1, 三: 2, 四: 3, 五: 4, 六: 5, 日: 6, 天: 6 }[chineseWeekly[1]];
      source = chineseWeekly[0];
    } else if (englishWeekly) {
      weekdayIndex = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].indexOf(
        englishWeekly[1].toLocaleLowerCase()
      );
      source = englishWeekly[0];
    }
    if (weekdayIndex >= 0) {
      var nextWeek = startOfWeek(reference);
      nextWeek.setDate(nextWeek.getDate() + 7 + weekdayIndex);
      return {
        cadence: "weekly",
        ddl: dateIso(nextWeek),
        confidence: "high",
        source: source
      };
    }

    var chineseLastDay = text.match(/每(?:个)?月(?:的)?\s*(?:最后一天|月底)/);
    var englishLastDay = text.match(/\b(?:the\s+)?last\s+day\s+of\s+(?:every|each)\s+month\b|\bmonthly\s+on\s+the\s+last\s+day\b/i);
    if (chineseLastDay || englishLastDay) {
      var lastOccurrence = monthlyOccurrence(reference, 1, true);
      return {
        cadence: "monthly",
        ddl: dateIso(lastOccurrence),
        confidence: "high",
        source: (chineseLastDay || englishLastDay)[0]
      };
    }

    var chineseMonthly = text.match(/每(?:个)?月(?:的)?\s*(\d{1,2})\s*(?:日|号)/);
    var englishMonthly = text.match(/\b(?:every\s+month|monthly)(?:\s+on)?(?:\s+(?:the|day))?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
    var englishMonthlyReversed = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:day\s+)?of\s+(?:every|each)\s+month\b/i);
    var monthlyMatch = chineseMonthly || englishMonthly || englishMonthlyReversed;
    if (monthlyMatch) {
      var day = Number(monthlyMatch[1]);
      var occurrence = day >= 1 && day <= 31 ? monthlyOccurrence(reference, day, false) : null;
      if (occurrence) {
        return {
          cadence: "monthly",
          ddl: dateIso(occurrence),
          confidence: "high",
          source: monthlyMatch[0]
        };
      }
    }
    return { cadence: "none", ddl: "", confidence: "none", source: "" };
  }

  function parseFlexibleDate(value, referenceDate) {
    var text = clean(value, 100).toLocaleLowerCase();
    if (!text) return { value: "", confidence: "none", source: "" };
    var reference = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
      ? new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
      : new Date();
    var exact = text
      .replace(/[年/.]/g, "-")
      .replace(/月/g, "-")
      .replace(/[日号]/g, "")
      .match(/\b(\d{4}|\d{2})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})\b/);
    if (exact) {
      return {
        value: isoDate(inferredYear(exact[1]), Number(exact[2]), Number(exact[3])),
        confidence: "high",
        source: exact[0]
      };
    }
    var chinese = text.match(/(?:^|\D)(\d{1,2})\s*月\s*(\d{1,2})(?:\s*日)?/);
    if (chinese) {
      var year = reference.getFullYear();
      var result = isoDate(year, Number(chinese[1]), Number(chinese[2]));
      if (result && result < dateIso(reference)) result = isoDate(year + 1, Number(chinese[1]), Number(chinese[2]));
      return { value: result, confidence: result ? "high" : "none", source: chinese[0].trim() };
    }
    var slash = text.match(/(?:^|\D)(\d{1,2})\s*[./-]\s*(\d{1,2})(?:\D|$)/);
    if (slash) {
      var slashYear = reference.getFullYear();
      var slashResult = isoDate(slashYear, Number(slash[1]), Number(slash[2]));
      if (slashResult && slashResult < dateIso(reference)) {
        slashResult = isoDate(slashYear + 1, Number(slash[1]), Number(slash[2]));
      }
      return { value: slashResult, confidence: slashResult ? "high" : "none", source: slash[0].trim() };
    }
    var offset = null;
    if (/\bday after tomorrow\b|后天/.test(text)) offset = 2;
    else if (/\btomorrow\b|明天/.test(text)) offset = 1;
    else if (/\btoday\b|今天/.test(text)) offset = 0;
    if (offset !== null) {
      var relative = new Date(reference);
      relative.setDate(relative.getDate() + offset);
      return { value: dateIso(relative), confidence: "medium", source: offset === 0 ? "today" : offset === 1 ? "tomorrow" : "day after tomorrow" };
    }
    var weekdayMap = {
      monday: 0, mon: 0, "周一": 0, "星期一": 0,
      tuesday: 1, tue: 1, tues: 1, "周二": 1, "星期二": 1,
      wednesday: 2, wed: 2, "周三": 2, "星期三": 2,
      thursday: 3, thu: 3, thur: 3, thurs: 3, "周四": 3, "星期四": 3,
      friday: 4, fri: 4, "周五": 4, "星期五": 4,
      saturday: 5, sat: 5, "周六": 5, "星期六": 5,
      sunday: 6, sun: 6, "周日": 6, "周天": 6, "星期日": 6, "星期天": 6
    };
    var chineseWeekday = text.match(
      /(下下周|下下星期|下下礼拜|下周|下星期|下礼拜|本周|本星期|本礼拜|这周|这星期|这礼拜|周|星期|礼拜)\s*([一二三四五六日天])/
    );
    if (chineseWeekday) {
      var chineseWeekdayIndex = { 一: 0, 二: 1, 三: 2, 四: 3, 五: 4, 六: 5, 日: 6, 天: 6 }[chineseWeekday[2]];
      var chineseWeekOffset = /^下下/.test(chineseWeekday[1])
        ? 2
        : /^下/.test(chineseWeekday[1])
          ? 1
          : 0;
      var chineseWeekTarget = startOfWeek(reference);
      chineseWeekTarget.setDate(
        chineseWeekTarget.getDate() + chineseWeekOffset * 7 + chineseWeekdayIndex
      );
      return {
        value: dateIso(chineseWeekTarget),
        confidence: "high",
        source: chineseWeekday[0]
      };
    }
    var weekdayName = Object.keys(weekdayMap).find(function (name) {
      return text.includes(name);
    });
    if (weekdayName) {
      var weekStart = startOfWeek(reference);
      var explicitNext = /next\s+(?:week\s+)?|下周/.test(text);
      var explicitThis = /this\s+week|本周|这周/.test(text);
      var target = new Date(weekStart);
      target.setDate(target.getDate() + weekdayMap[weekdayName] + (explicitNext ? 7 : 0));
      if (!explicitNext && !explicitThis && target < reference) target.setDate(target.getDate() + 7);
      return { value: dateIso(target), confidence: "medium", source: weekdayName };
    }
    return { value: "", confidence: "none", source: "" };
  }

  function stripLeadingDatePrefix(value) {
    return clean(value, 500)
      .replace(
        /^\s*(?:(?:(?:下下周|下下星期|下下礼拜|下周|下星期|下礼拜|本周|本星期|本礼拜|这周|这星期|这礼拜|周|星期|礼拜)\s*[一二三四五六日天])|(?:(?:\d{4}|\d{2})\s*(?:年|[./-])\s*\d{1,2}\s*(?:月|[./-])\s*\d{1,2}\s*(?:日|号)?)|(?:\d{1,2}\s*(?:月\s*\d{1,2}\s*(?:日|号)?|[./-]\s*\d{1,2})))\s*/,
        ""
      )
      .replace(/^[,，、:：;；—–-]+\s*/, "")
      .trim();
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function labeledValue(text, labels) {
    var aliases = labels
      .slice()
      .sort(function (left, right) { return right.length - left.length; })
      .map(escapeRegExp)
      .join("|");
    var expression = new RegExp(
      "(?:^|\\n|[;；])\\s*(?:[-*•▪◦]\\s*)?(?:" + aliases + ")\\s*[:：=]\\s*([^\\n;；]+)",
      "i"
    );
    var match = String(text || "").match(expression);
    return match ? clean(match[1], 500) : "";
  }

  function fieldLine(line) {
    return FIELD_KEYS.some(function (key) {
      return LABELS[key].some(function (label) {
        return new RegExp("^\\s*" + escapeRegExp(label) + "\\s*[:：=]", "i").test(line);
      });
    });
  }

  function editDistance(left, right) {
    var a = normalized(left);
    var b = normalized(right);
    if (!a) return b.length;
    if (!b) return a.length;
    var previous = Array.from({ length: b.length + 1 }, function (_item, index) { return index; });
    for (var i = 1; i <= a.length; i += 1) {
      var current = [i];
      for (var j = 1; j <= b.length; j += 1) {
        current[j] = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      previous = current;
    }
    return previous[b.length];
  }

  function matchKnown(rawValue, items, fullText, options) {
    var source = Array.isArray(items) ? items : [];
    var valueKey = normalized(rawValue);
    var textKey = normalized(fullText);
    var nameOf = (options && options.nameOf) || function (item) { return item && item.name; };
    var exact = source.find(function (item) {
      var key = normalized(nameOf(item));
      return key && (valueKey ? key === valueKey : textKey.includes(key));
    });
    if (exact) return { item: exact, confidence: "high", suggestion: "" };
    if (!valueKey) return { item: null, confidence: "none", suggestion: "" };
    var contained = source.find(function (item) {
      var key = normalized(nameOf(item));
      return key && (valueKey.includes(key) || key.includes(valueKey)) && Math.min(key.length, valueKey.length) >= 3;
    });
    if (contained) {
      return {
        item: null,
        confidence: "medium",
        suggestion: clean(nameOf(contained), 160)
      };
    }
    var ranked = source
      .map(function (item) {
        return { item: item, distance: editDistance(valueKey, nameOf(item)), name: clean(nameOf(item), 160) };
      })
      .sort(function (left, right) { return left.distance - right.distance; });
    var nearest = ranked[0];
    var threshold = valueKey.length >= 7 ? 2 : valueKey.length >= 3 ? 1 : 0;
    return nearest && nearest.distance <= threshold
      ? { item: null, confidence: "low", suggestion: nearest.name }
      : { item: null, confidence: "none", suggestion: "" };
  }

  function splitCandidates(value) {
    var text = clean(value, 30000);
    if (!text) return [""];
    var lines = text.split("\n");
    var startIndexes = [];
    lines.forEach(function (line, index) {
      var withoutBullet = line.replace(BULLET, "");
      if (
        TASK_LABEL_START.test(withoutBullet) ||
        (BULLET.test(line) && !fieldLine(withoutBullet))
      ) {
        startIndexes.push(index);
      }
    });
    if (startIndexes.length >= 2) {
      return startIndexes
        .map(function (start, index) {
          var end = index + 1 < startIndexes.length ? startIndexes[index + 1] : lines.length;
          return lines
            .slice(start, end)
            .map(function (line, lineIndex) {
              return lineIndex === 0 ? line.replace(BULLET, "") : line;
            })
            .join("\n")
            .trim();
        })
        .filter(Boolean);
    }
    var lineGroups = [];
    var currentLines = [];
    var leadingFieldLines = [];
    lines.forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed) return;
      var withoutBullet = trimmed.replace(BULLET, "");
      if (fieldLine(withoutBullet)) {
        if (currentLines.length) currentLines.push(trimmed);
        else leadingFieldLines.push(trimmed);
        return;
      }
      if (currentLines.length) lineGroups.push(currentLines.join("\n"));
      currentLines = leadingFieldLines.concat(withoutBullet);
      leadingFieldLines = [];
    });
    if (currentLines.length) lineGroups.push(currentLines.join("\n"));
    if (lineGroups.length >= 2) return lineGroups;
    var paragraphs = text.split(/\n\s*\n+/).map(function (part) { return part.trim(); }).filter(Boolean);
    var likelyTasks = paragraphs.filter(function (part) {
      return TASK_LABEL_START.test(part) || /(?:ddl|deadline|due|截止|交付物|deliverable)\s*[:：=]/i.test(part);
    });
    return paragraphs.length > 1 && likelyTasks.length >= 2 ? paragraphs : [text];
  }

  function firstTaskName(text) {
    var explicit = labeledValue(text, LABELS.taskName);
    if (explicit) return explicit.slice(0, 160);
    var lines = String(text || "")
      .split("\n")
      .map(function (line) { return line.replace(BULLET, "").trim(); })
      .filter(Boolean);
    var line = lines.find(function (item) { return !fieldLine(item); }) || "";
    line = line.replace(TASK_LABEL_START, "");
    line = stripLeadingDatePrefix(line);
    line = line
      .replace(/^每(?:个)?(?:周|星期|礼拜)(?:的)?(?:周|星期|礼拜)?\s*[一二三四五六日天]\s*/, "")
      .replace(/^每(?:个)?月(?:的)?\s*(?:(?:\d{1,2})\s*(?:日|号)|最后一天|月底)\s*/, "")
      .replace(/^\s*(?:(?:every|each)\s+|weekly\s+(?:on\s+)?)(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b\s*/i, "")
      .replace(/^\s*(?:every\s+month|monthly)(?:\s+on)?(?:\s+(?:the|day))?\s+\d{1,2}(?:st|nd|rd|th)?\b\s*/i, "")
      .replace(/^\s*(?:the\s+)?last\s+day\s+of\s+(?:every|each)\s+month\b\s*/i, "");
    var fieldMarker = line.search(/\s+(?:ddl|deadline|due|截止|紧急程度|urgency|priority|分组|group|flow|交付物|deliverable)\s*[:：=]/i);
    if (fieldMarker > 0) line = line.slice(0, fieldMarker);
    return clean(line.replace(/[;；|]+$/, ""), 160);
  }

  function parseUrgency(text) {
    var labeled = labeledValue(text, LABELS.urgency).toLocaleLowerCase();
    var source = labeled || String(text || "").toLocaleLowerCase();
    if (/^(低|low)$/.test(labeled) || /不紧急|低优|有空|not\s+urgent|low\s+priority|\blow\b/.test(source)) return { value: "low", confidence: labeled ? "high" : "medium" };
    if (/^(高|high)$/.test(labeled) || /非常紧急|紧急|高优|马上|尽快|立即|urgent|asap|high\s+priority|\bhigh\b/.test(source)) return { value: "high", confidence: labeled ? "high" : "medium" };
    if (/^(中|medium)$/.test(labeled) || /中优|一般|正常|medium|normal/.test(source)) return { value: "medium", confidence: labeled ? "high" : "medium" };
    return { value: "", confidence: "none" };
  }

  function parseRecurrence(text) {
    var labeled = labeledValue(text, LABELS.recurrence).toLocaleLowerCase();
    var source = labeled || String(text || "").toLocaleLowerCase();
    if (/每周|每星期|weekly|every\s+week/.test(source)) return { value: "weekly", confidence: labeled ? "high" : "medium" };
    if (/每月|monthly|every\s+month/.test(source)) return { value: "monthly", confidence: labeled ? "high" : "medium" };
    if (/不重复|does\s+not\s+repeat|no\s+recurrence|\bnone\b/.test(source)) return { value: "none", confidence: "high" };
    return { value: "none", confidence: "none" };
  }

  function extractPerson(text, labels, knownValues) {
    var raw = labeledValue(text, labels);
    if (!raw && labels === LABELS.reportTo) {
      var reportMatch = String(text || "").match(/(?:向|给)\s*([A-Za-z][A-Za-z .'-]{1,50}|[\u4e00-\u9fff]{2,8})\s*汇报|report\s+to\s+([A-Za-z][A-Za-z .'-]{1,50})/i);
      raw = reportMatch ? clean(reportMatch[1] || reportMatch[2], 120) : "";
    }
    var items = (Array.isArray(knownValues) ? knownValues : []).map(function (name) { return { name: name }; });
    var match = matchKnown(raw, items, raw);
    return {
      value: match.item ? match.item.name : match.suggestion ? "" : clean(raw, 120),
      confidence: match.item ? match.confidence : raw && !match.suggestion ? "high" : match.suggestion ? "low" : "none",
      suggestion: match.suggestion
    };
  }

  function parseSingle(value, context) {
    var sourceText = clean(value, 30000);
    var source = context || {};
    var naturalSchedule = parseNaturalRecurrenceSchedule(sourceText, source.referenceDate);
    var groupRaw = labeledValue(sourceText, LABELS.groupName);
    var groupMatch = matchKnown(groupRaw, source.groups || [], sourceText);
    var group = groupMatch.item || null;
    var flows = (source.flows || []).filter(function (flow) {
      return !group || flow.groupId === group.id;
    });
    var flowRaw = labeledValue(sourceText, LABELS.flowName);
    var flowMatch = matchKnown(flowRaw, flows, sourceText);
    var flow = flowMatch.item || null;
    if (!group && flow) {
      group = (source.groups || []).find(function (item) { return item.id === flow.groupId; }) || null;
      if (group) groupMatch = { item: group, confidence: "medium", suggestion: "" };
    }
    var explicitDdlText = labeledValue(sourceText, LABELS.ddl);
    var ddl = explicitDdlText
      ? parseFlexibleDate(explicitDdlText, source.referenceDate)
      : naturalSchedule.ddl
        ? { value: naturalSchedule.ddl, confidence: "high", source: naturalSchedule.source }
        : parseFlexibleDate(sourceText, source.referenceDate);
    var recurrence = naturalSchedule.confidence === "high"
      ? { value: naturalSchedule.cadence, confidence: "high" }
      : parseRecurrence(sourceText);
    var recurrenceStart = parseFlexibleDate(
      labeledValue(sourceText, LABELS.recurrenceStart),
      source.referenceDate
    );
    var recurrenceEnd = parseFlexibleDate(
      labeledValue(sourceText, LABELS.recurrenceEnd),
      source.referenceDate
    );
    var urgency = parseUrgency(sourceText);
    var reportTo = extractPerson(sourceText, LABELS.reportTo, source.reportToValues);
    var managedObject = extractPerson(sourceText, LABELS.managedObject, source.managedObjectValues);
    var deliverable = labeledValue(sourceText, LABELS.deliverable);
    var candidate = {
      sourceText: sourceText,
      taskName: firstTaskName(sourceText),
      groupId: group ? group.id : "",
      groupName: group ? group.name : groupRaw,
      flowId: flow ? flow.id : "",
      flowName: flow ? flow.name : flowRaw,
      ddl: ddl.confidence === "high" ? ddl.value : "",
      recurrenceCadence: recurrence.confidence === "high" ? recurrence.value : "none",
      recurrenceStart:
        recurrenceStart.value ||
        (naturalSchedule.ddl && ddl.confidence === "high" ? ddl.value : ""),
      recurrenceEnd: recurrenceEnd.value,
      urgency: urgency.confidence === "high" ? urgency.value : "",
      reportTo: reportTo.value,
      managedObject: managedObject.value,
      deliverable: clean(deliverable, 500),
      suggestions: [],
      recognizedFields: []
    };
    [
      ["taskName", candidate.taskName],
      ["group", candidate.groupId],
      ["flow", candidate.flowId],
      ["ddl", candidate.ddl],
      ["recurrence", recurrence.confidence !== "none" && recurrence.value !== "none"],
      ["urgency", candidate.urgency],
      ["reportTo", candidate.reportTo],
      ["managedObject", candidate.managedObject],
      ["deliverable", candidate.deliverable]
    ].forEach(function (field) {
      if (field[1]) candidate.recognizedFields.push(field[0]);
    });
    if (groupMatch.suggestion) candidate.suggestions.push({ field: "group", value: groupMatch.suggestion });
    if (flowMatch.suggestion) candidate.suggestions.push({ field: "flow", value: flowMatch.suggestion });
    if (reportTo.suggestion) candidate.suggestions.push({ field: "reportTo", value: reportTo.suggestion });
    if (managedObject.suggestion) candidate.suggestions.push({ field: "managedObject", value: managedObject.suggestion });
    if (ddl.confidence === "medium" && ddl.source) {
      candidate.suggestions.push({ field: "ddlCalculated", value: ddl.value, source: ddl.source });
    }
    if (urgency.confidence === "medium" && urgency.value) {
      candidate.suggestions.push({ field: "urgency", value: urgency.value });
    }
    if (recurrence.confidence === "medium" && recurrence.value !== "none") {
      candidate.suggestions.push({ field: "recurrence", value: recurrence.value });
    }
    return candidate;
  }

  function parse(value, context) {
    return splitCandidates(value).map(function (part) {
      return parseSingle(part, context);
    });
  }

  return {
    LABELS: LABELS,
    RULE_EXAMPLES: RULE_EXAMPLES,
    normalized: normalized,
    editDistance: editDistance,
    parseFlexibleDate: parseFlexibleDate,
    parseNaturalRecurrenceSchedule: parseNaturalRecurrenceSchedule,
    splitCandidates: splitCandidates,
    parseSingle: parseSingle,
    parse: parse
  };
});
