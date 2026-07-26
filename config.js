// DataPipeのExperiment IDを入力してください。
// 誤って旧実験へ保存しないよう、初期値は空欄です。
const DATAPIPE_EXPERIMENT_ID = "";

const STUDY_NAME = "pilot2_fpt_then_binary_gjt";
const FPT_ITEM_COUNT = 29;
const GJT_ITEM_COUNT = 29;
const GJT_TRIAL_DURATION_MS = 10000;
const RANDOMIZE_FPT_ITEMS = true;
const RANDOMIZE_GJT_ITEMS = true;

// true: DataPipe失敗時に参加者端末へCSVを保存
const ENABLE_LOCAL_CSV_FALLBACK = true;

// FPT終了時にも中間ファイルをDataPipeへ保存する。
// 最終ファイルと合わせて参加者1人につき最大2ファイルを使用します。
const SAVE_FPT_CHECKPOINT = true;
