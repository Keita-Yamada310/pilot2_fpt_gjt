const jsPsych = initJsPsych({
  show_progress_bar: true,
  auto_update_progress_bar: false,
  message_progress_bar: "課題の進捗"
});

const sessionId = jsPsych.randomization.randomID(12);
const sessionStartMs = performance.now();
const sessionStartIso = new Date().toISOString();
let fptStartMs = null;
let fptEndMs = null;
let gjtStartMs = null;
let gjtEndMs = null;
let currentFptFirstKeyMs = null;

function countEnglishWords(text) {
  const matches = String(text || "").match(/[A-Za-z]+(?:'[A-Za-z]+)?/g);
  return matches ? matches.length : 0;
}

function cleanText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function isLikelyMobile() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.matchMedia("(pointer: coarse)").matches;
}

function deviceType() {
  if (/iPad|Tablet/i.test(navigator.userAgent)) return "tablet";
  if (isLikelyMobile()) return "mobile";
  return "desktop_or_laptop";
}

jsPsych.data.addProperties({
  session_id: sessionId,
  study: STUDY_NAME,
  jspsych_version: "8.2.3",
  session_start_iso: sessionStartIso,
  user_agent: navigator.userAgent,
  device_type: deviceType(),
  viewport_width: window.innerWidth,
  viewport_height: window.innerHeight,
  screen_width: window.screen.width,
  screen_height: window.screen.height,
  device_pixel_ratio: window.devicePixelRatio || 1,
  language: navigator.language || "",
  touch_points: navigator.maxTouchPoints || 0
});

const timeline = [];

// DataPipe ID未設定時は、開始前に担当者向け警告を表示する。
if (!DATAPIPE_EXPERIMENT_ID.trim()) {
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="task-card compact-card">
      <h2 class="status-error">DataPipe Experiment IDが未設定です</h2>
      <p>このまま実施するとOSFには保存されず、最終CSVのみ端末に保存されます。</p>
      <p><strong>本番実施前にconfig.jsを設定してください。</strong></p>
    </div>`,
    choices: ["動作確認として続ける"],
    data: { phase: "datapipe_config_warning" }
  });
}

// タブ移動・画面離脱をjsPsychのinteraction dataに記録。
jsPsych.data.addProperties({ interaction_recording_enabled: true });

// 端末情報を明示的に1行保存。
timeline.push({
  type: jsPsychBrowserCheck,
  inclusion_function: () => true,
  data: { phase: "browser_check" }
});

timeline.push({
  type: jsPsychSurveyHtmlForm,
  preamble: `
    <div class="task-card compact-card">
      <h1>英語課題</h1>
      <p>担当者から指定された参加者番号を入力してください。</p>
    </div>`,
  html: `
    <div class="participant-form">
      <label for="participant_id"><strong>参加者番号</strong></label>
      <input id="participant_id" name="participant_id" type="text" required
             autocomplete="off" autocapitalize="none" spellcheck="false"
             pattern="[A-Za-z0-9_-]{1,30}" maxlength="30">

      <label for="input_device"><strong>英文の入力方法</strong></label>
      <select id="input_device" name="input_device" required>
        <option value="">選択してください</option>
        <option value="physical_keyboard">PC・タブレットの物理キーボード</option>
        <option value="mobile_keyboard">スマートフォンの画面キーボード</option>
        <option value="tablet_keyboard">タブレットの画面キーボード</option>
        <option value="other">その他</option>
      </select>
    </div>`,
  button_label: "次へ",
  data: { phase: "participant_info" },
  on_finish: data => {
    const pid = cleanText(data.response.participant_id);
    jsPsych.data.addProperties({
      participant_id: pid,
      self_reported_input_device: data.response.input_device
    });
  }
});

// スマホSafariではフルスクリーンの挙動が不安定なため、PC系のみ全画面を試す。
const fullscreenConditional = {
  timeline: [{
    type: jsPsychFullscreen,
    fullscreen_mode: true,
    message: `<div class="task-card compact-card"><p>「全画面で開始」を押してください。</p></div>`,
    button_label: "全画面で開始",
    data: { phase: "fullscreen_start" }
  }],
  conditional_function: () => !isLikelyMobile()
};
timeline.push(fullscreenConditional);

// ---------- FPT ----------
timeline.push({
  type: jsPsychInstructions,
  pages: [
    `<div class="task-card instruction-card">
      <h2>課題1：英文作成</h2>
      <p>画面に英語の動詞が1語ずつ表示されます。</p>
      <p>その動詞を使って、最初に思いついた英文を1文書いてください。</p>
      <p>別の英文がすぐに思いつく場合は、2文目を書いても構いません。</p>
      <p><strong>1文目は必須、2文目は任意</strong>です。</p>
    </div>`,
    `<div class="task-card instruction-card">
      <h2>回答上の注意</h2>
      <p>辞書、翻訳サイト、生成AIなどは使用しないでください。</p>
      <p>動詞の形は、文に合うように変えて構いません。</p>
      <p>前の問題には戻れません。${FPT_ITEM_COUNT}問あります。</p>
    </div>`
  ],
  show_clickable_nav: true,
  button_label_previous: "戻る",
  button_label_next: "次へ",
  data: { phase: "fpt_instructions" }
});

const fptPractice = {
  item_id: "FPT-P1",
  verb: "play",
  category: "practice",
  target_pattern: "practice",
  display_number: 0,
  acceptable_alternative: ""
};

function makeFptTrial(isPractice = false) {
  return {
    type: jsPsychSurveyHtmlForm,
    preamble: function() {
      const verb = jsPsych.evaluateTimelineVariable("verb");
      const numberText = isPractice
        ? "練習"
        : `課題1　${jsPsych.evaluateTimelineVariable("display_number")} / ${FPT_ITEM_COUNT}`;
      return `
        <div class="task-card fpt-card">
          <div class="task-progress">${numberText}</div>
          <p class="fpt-prompt">次の動詞を使って英文を書いてください。</p>
          <div class="target-verb" aria-label="target verb ${verb}">${verb}</div>
        </div>`;
    },
    html: `
      <div class="fpt-form">
        <label for="sentence1"><strong>1文目（必須）</strong></label>
        <textarea id="sentence1" name="sentence1" class="fpt-input" required
          rows="2" maxlength="300" autocomplete="off" autocapitalize="none"
          autocorrect="off" spellcheck="false" enterkeyhint="next"></textarea>

        <label for="sentence2"><strong>2文目（任意）</strong></label>
        <textarea id="sentence2" name="sentence2" class="fpt-input" rows="2"
          maxlength="300" autocomplete="off" autocapitalize="none"
          autocorrect="off" spellcheck="false" enterkeyhint="done"></textarea>
      </div>`,
    button_label: isPractice ? "練習を終了" : "次の問題へ",
    data: function() {
      return {
        phase: isPractice ? "fpt_practice" : "fpt",
        item_id: jsPsych.evaluateTimelineVariable("item_id"),
        presentation_order: jsPsych.evaluateTimelineVariable("display_number"),
        target_verb: jsPsych.evaluateTimelineVariable("verb"),
        category: jsPsych.evaluateTimelineVariable("category"),
        target_pattern: jsPsych.evaluateTimelineVariable("target_pattern"),
        acceptable_alternative: (() => {
          try { return jsPsych.evaluateTimelineVariable("acceptable_alternative") || ""; }
          catch (_) { return ""; }
        })()
      };
    },
    on_load: function() {
      currentFptFirstKeyMs = null;
      const first = document.getElementById("sentence1");
      const second = document.getElementById("sentence2");
      const recordFirstKey = () => {
        if (currentFptFirstKeyMs === null) currentFptFirstKeyMs = performance.now();
      };
      [first, second].forEach(el => {
        el.addEventListener("keydown", recordFirstKey, { once: true });
        el.addEventListener("input", recordFirstKey, { once: true });
      });
      if (!isLikelyMobile()) first.focus({ preventScroll: true });
    },
    on_finish: function(data) {
      const response = data.response || {};
      const s1 = cleanText(response.sentence1);
      const s2 = cleanText(response.sentence2);
      data.response_1 = s1;
      data.response_2 = s2;
      data.response_1_word_count = countEnglishWords(s1);
      data.response_2_word_count = countEnglishWords(s2);
      data.response_1_character_count = s1.length;
      data.response_2_character_count = s2.length;
      data.second_response_used = s2.length > 0;
      data.first_key_rt = currentFptFirstKeyMs === null
        ? null
        : Math.round(currentFptFirstKeyMs - (performance.now() - data.rt));
      delete data.response;

      if (!isPractice) {
        const completed = jsPsych.data.get().filter({ phase: "fpt" }).count();
        jsPsych.progressBar.progress = Math.min(completed / (FPT_ITEM_COUNT + GJT_ITEM_COUNT), 1);
      }
    }
  };
}

timeline.push({
  timeline: [makeFptTrial(true)],
  timeline_variables: [fptPractice],
  randomize_order: false
});

timeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: `<div class="task-card compact-card">
    <h2>練習終了</h2><p>ここから英文作成課題${FPT_ITEM_COUNT}問です。</p>
  </div>`,
  choices: ["課題1を始める"],
  data: { phase: "fpt_start" },
  on_finish: () => { fptStartMs = performance.now(); }
});

const orderedFptItems = (RANDOMIZE_FPT_ITEMS ? jsPsych.randomization.shuffle(FPT_ITEMS) : [...FPT_ITEMS])
  .map((item, index) => ({ ...item, display_number: index + 1 }));

timeline.push({
  timeline: [makeFptTrial(false)],
  timeline_variables: orderedFptItems,
  randomize_order: false
});

async function saveToDataPipe(csvText, filename) {
  const response = await fetch("https://pipe.jspsych.org/api/data/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      experimentID: DATAPIPE_EXPERIMENT_ID,
      filename,
      data: csvText
    })
  });
  let result = {};
  try { result = await response.json(); } catch (_) {}
  if (!response.ok || result.error) {
    throw new Error(result.message || `DataPipe returned HTTP ${response.status}`);
  }
  return result;
}

async function saveCheckpoint(taskName) {
  const pid = jsPsych.data.get().values().find(row => row.participant_id)?.participant_id || "unknown";
  const safePid = pid.replace(/[^A-Za-z0-9_-]/g, "_");
  const filename = `${STUDY_NAME}_${safePid}_${sessionId}_${taskName}.csv`;
  const csvText = jsPsych.data.get().csv();
  if (!DATAPIPE_EXPERIMENT_ID.trim()) throw new Error("DataPipe Experiment ID is empty.");
  await saveToDataPipe(csvText, filename);
  return filename;
}

timeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: `<div class="task-card save-message" id="fpt-save-panel">
    <div class="spinner"></div><h2>課題1を保存しています</h2>
    <p>この画面を閉じないでください。</p>
  </div>`,
  choices: [],
  data: { phase: "fpt_checkpoint_save" },
  on_start: () => {
    fptEndMs = performance.now();
    jsPsych.data.addProperties({ fpt_total_rt_ms: Math.round(fptEndMs - fptStartMs) });
  },
  on_load: async function() {
    const panel = document.getElementById("fpt-save-panel");
    try {
      if (SAVE_FPT_CHECKPOINT) await saveCheckpoint("fpt_checkpoint");
      panel.innerHTML = `<h2 class="status-success">課題1を保存しました</h2>
        <p>続いて短い休憩画面に進みます。</p>
        <button id="continue-after-save" class="jspsych-btn">次へ</button>`;
    } catch (error) {
      console.error(error);
      panel.innerHTML = `<h2 class="status-warning">オンライン中間保存を確認できませんでした</h2>
        <p>最終画面でもう一度保存します。課題を続けてください。</p>
        <button id="continue-after-save" class="jspsych-btn">次へ</button>`;
    }
    document.getElementById("continue-after-save").addEventListener("click", () => jsPsych.finishTrial());
  }
});

// 固定時間の休憩を強制せず、参加者が準備できたら開始。
timeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: `<div class="task-card compact-card">
    <h2>休憩</h2>
    <p>少し休憩してください。</p>
    <p>準備ができたら、次の課題に進んでください。</p>
  </div>`,
  choices: ["課題2の説明へ"],
  data: { phase: "break" }
});

// ---------- Binary GJT ----------
timeline.push({
  type: jsPsychInstructions,
  pages: [
    `<div class="task-card instruction-card">
      <h2>課題2：英文判断</h2>
      <p>英文が1文ずつ表示されます。</p>
      <p>英語の文法として「正しい」か「間違い」かを判断してください。</p>
      <p>各文は<strong>10秒以内</strong>に回答してください。</p>
    </div>`,
    `<div class="task-card instruction-card">
      <h2>回答上の注意</h2>
      <p>文の内容ではなく、英語の文法として判断してください。</p>
      <p>迷った場合も、どちらか一方を選んでください。</p>
      <p>最初に練習を2問行い、その後${GJT_ITEM_COUNT}問の本課題に進みます。</p>
    </div>`
  ],
  show_clickable_nav: true,
  button_label_previous: "戻る",
  button_label_next: "次へ",
  data: { phase: "gjt_instructions" }
});

const gjtPracticeItems = [
  { practice_id: "GJT-P1", sentence: "The girl waited for the bus.", presented_status: "grammatical" },
  { practice_id: "GJT-P2", sentence: "The boy enjoyed to play football.", presented_status: "ungrammatical" }
];

function makeGjtTrial(isPractice = false) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
      const sentence = jsPsych.evaluateTimelineVariable("sentence");
      const progress = isPractice
        ? "練習"
        : `課題2　${jsPsych.evaluateTimelineVariable("display_number")} / ${GJT_ITEM_COUNT}`;
      return `<div class="task-card gjt-card">
        <div class="task-progress">${progress}</div>
        <div class="gjt-sentence">${sentence}</div>
        <div class="timeout-note">10秒以内に選んでください。</div>
      </div>`;
    },
    choices: ["正しい", "間違い"],
    button_layout: "flex",
    button_html: (choice, choiceIndex) =>
      `<button class="jspsych-btn gjt-choice ${choiceIndex === 0 ? "choice-correct" : "choice-wrong"}"
        data-choice="${choiceIndex}">${choice}</button>`,
    trial_duration: GJT_TRIAL_DURATION_MS,
    response_ends_trial: true,
    css_classes: ["binary-gjt"],
    data: function() {
      if (isPractice) {
        return {
          phase: "gjt_practice",
          practice_id: jsPsych.evaluateTimelineVariable("practice_id"),
          sentence_text: jsPsych.evaluateTimelineVariable("sentence"),
          presented_status: jsPsych.evaluateTimelineVariable("presented_status")
        };
      }
      return {
        phase: "gjt",
        item_id: jsPsych.evaluateTimelineVariable("item_id"),
        presentation_order: jsPsych.evaluateTimelineVariable("display_number"),
        category: jsPsych.evaluateTimelineVariable("category"),
        target_verb: jsPsych.evaluateTimelineVariable("verb"),
        target_pattern: jsPsych.evaluateTimelineVariable("pattern"),
        sentence_text: jsPsych.evaluateTimelineVariable("sentence"),
        presented_status: jsPsych.evaluateTimelineVariable("presented_status"),
        error_type: jsPsych.evaluateTimelineVariable("error_type")
      };
    },
    on_finish: function(data) {
      data.judgment = data.response === null ? null : (Number(data.response) === 0 ? "grammatical" : "ungrammatical");
      data.timed_out = data.response === null;
      data.correct = data.response === null ? null : data.judgment === data.presented_status;
      if (!isPractice) {
        const fptDone = jsPsych.data.get().filter({ phase: "fpt" }).count();
        const gjtDone = jsPsych.data.get().filter({ phase: "gjt" }).count();
        jsPsych.progressBar.progress = Math.min((fptDone + gjtDone) / (FPT_ITEM_COUNT + GJT_ITEM_COUNT), 1);
      }
    }
  };
}

const gjtPracticeFeedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function() {
    const last = jsPsych.data.get().filter({ phase: "gjt_practice" }).last(1).values()[0] || {};
    if (last.timed_out) {
      return `<div class="task-card compact-card practice-feedback feedback-incorrect">
        <h2>時間切れです</h2>
        <p>この文は<strong>${last.presented_status === "grammatical" ? "正しい" : "間違い"}</strong>文です。</p>
      </div>`;
    }
    if (last.correct) {
      return `<div class="task-card compact-card practice-feedback feedback-correct">
        <h2>正解です</h2>
        <p>この文は<strong>${last.presented_status === "grammatical" ? "正しい" : "間違い"}</strong>文です。</p>
      </div>`;
    }
    return `<div class="task-card compact-card practice-feedback feedback-incorrect">
      <h2>不正解です</h2>
      <p>この文は<strong>${last.presented_status === "grammatical" ? "正しい" : "間違い"}</strong>文です。</p>
    </div>`;
  },
  choices: ["次の練習へ"],
  data: { phase: "gjt_practice_feedback" }
};

timeline.push({
  timeline: [makeGjtTrial(true), gjtPracticeFeedback],
  timeline_variables: gjtPracticeItems,
  randomize_order: false
});

timeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: `<div class="task-card compact-card"><h2>練習終了</h2>
    <p>ここから英文判断課題${GJT_ITEM_COUNT}問です。</p></div>`,
  choices: ["課題2を始める"],
  data: { phase: "gjt_start" },
  on_start: () => { gjtStartMs = performance.now(); }
});

const orderedGjtItems = (RANDOMIZE_GJT_ITEMS ? jsPsych.randomization.shuffle(GJT_ITEMS) : [...GJT_ITEMS])
  .map((item, index) => ({ ...item, display_number: index + 1 }));

timeline.push({
  timeline: [makeGjtTrial(false)],
  timeline_variables: orderedGjtItems,
  randomize_order: false
});

// モバイル以外のみ全画面解除。
timeline.push({
  timeline: [{
    type: jsPsychFullscreen,
    fullscreen_mode: false,
    data: { phase: "fullscreen_end" }
  }],
  conditional_function: () => !isLikelyMobile()
});

// 操作性アンケート。
timeline.push({
  type: jsPsychSurveyHtmlForm,
  preamble: `<div class="task-card compact-card"><h2>最後の質問</h2>
    <p>今回の課題について教えてください。</p>
    <p class="survey-guidance">操作方法、画面の見やすさ、事前説明の分かりやすさ、制限時間などについて、改善した方がよい点があれば自由記述欄に書いてください。</p></div>`,
  html: `<div class="usability-form">
    <label>画面の見やすさ</label>
    <select name="screen_readability" required>
      <option value="">選択</option><option value="1">1 とても見にくい</option>
      <option value="2">2</option><option value="3">3</option><option value="4">4</option>
      <option value="5">5 とても見やすい</option>
    </select>
    <label>ボタンの押しやすさ</label>
    <select name="button_usability" required>
      <option value="">選択</option><option value="1">1 とても押しにくい</option>
      <option value="2">2</option><option value="3">3</option><option value="4">4</option>
      <option value="5">5 とても押しやすい</option>
    </select>
    <label for="comments">改善した方がよい点・気になった点（任意）</label>
    <p class="field-help">例：操作しにくかったところ、見づらかった画面、分かりにくかった説明、回答時間についての意見など</p>
    <textarea id="comments" name="comments" rows="4" maxlength="500" placeholder="改善した方がよい点や気になった点を書いてください。"></textarea>
  </div>`,
  button_label: "送信",
  data: { phase: "usability_survey" },
  on_start: () => {
    gjtEndMs = performance.now();
    jsPsych.data.addProperties({
      gjt_total_rt_ms: Math.round(gjtEndMs - gjtStartMs),
      task_total_rt_ms: Math.round(gjtEndMs - fptStartMs)
    });
  }
});

// 最終保存。
timeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: `<div class="task-card save-message" id="final-save-panel">
    <div class="spinner"></div><h2>回答を保存しています</h2>
    <p>保存完了の表示が出るまで画面を閉じないでください。</p>
  </div>`,
  choices: [],
  data: { phase: "final_save" },
  on_load: async function() {
    const values = jsPsych.data.get().values();
    const participantId = values.find(row => row.participant_id)?.participant_id || "unknown";
    const safePid = participantId.replace(/[^A-Za-z0-9_-]/g, "_");
    const filename = `${STUDY_NAME}_${safePid}_${sessionId}_final.csv`;
    const fptRows = jsPsych.data.get().filter({ phase: "fpt" });
    const gjtRows = jsPsych.data.get().filter({ phase: "gjt" });

    jsPsych.data.addProperties({
      session_end_iso: new Date().toISOString(),
      session_total_rt_ms: Math.round(performance.now() - sessionStartMs),
      completed_fpt_items: fptRows.count(),
      completed_gjt_items: gjtRows.count(),
      gjt_timeout_count: gjtRows.filter({ timed_out: true }).count(),
      interaction_data_json: JSON.stringify(jsPsych.data.getInteractionData().values())
    });

    const panel = document.getElementById("final-save-panel");
    const csvText = jsPsych.data.get().csv();
    try {
      if (!DATAPIPE_EXPERIMENT_ID.trim()) throw new Error("DataPipe Experiment ID is empty.");
      await saveToDataPipe(csvText, filename);
      panel.innerHTML = `<h2 class="status-success">保存が完了しました</h2>
        <div class="summary-box">
          <div><strong>参加者番号：</strong>${participantId}</div>
          <div><strong>FPT：</strong>${fptRows.count()} / ${FPT_ITEM_COUNT}</div>
          <div><strong>GJT：</strong>${gjtRows.count()} / ${GJT_ITEM_COUNT}</div>
          <div><strong>GJT時間切れ：</strong>${gjtRows.filter({ timed_out: true }).count()}</div>
        </div>
        <p>ご協力ありがとうございました。</p>`;
    } catch (error) {
      console.error("Final save failed", error);
      if (ENABLE_LOCAL_CSV_FALLBACK) jsPsych.data.get().localSave("csv", filename);
      panel.innerHTML = `<h2 class="status-error">オンライン保存に失敗しました</h2>
        <p>${ENABLE_LOCAL_CSV_FALLBACK ? "CSVを端末に保存しました。" : "担当者に連絡してください。"}</p>
        <p><strong>この画面を閉じず、担当者に連絡してください。</strong></p>`;
    }
  }
});

window.addEventListener("error", event => {
  console.error("Experiment error:", event.error || event.message);
  const display = document.querySelector("#jspsych-content") || document.body;
  if (display && !document.getElementById("experiment-error-panel")) {
    const panel = document.createElement("div");
    panel.id = "experiment-error-panel";
    panel.className = "task-card status-error";
    panel.innerHTML = `<h2>課題を続行できませんでした</h2>
      <p>担当者にこの画面を見せてください。</p>
      <p class="error-detail">${String(event.message || "Unknown error")}</p>`;
    display.appendChild(panel);
  }
});

jsPsych.run(timeline);
