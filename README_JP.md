# パイロット2：FPT → Binary GJT

## 仕様

- 実施順：FPT → 休憩 → GJT
- FPT：練習1＋本番29項目
  - 1文目必須
  - 2文目任意
  - 項目ごとのRT
  - 最初のキー入力までのRT
  - FPT本番全体の所要時間
  - 文字数・語数・2文目使用の有無
- GJT：練習2＋本番29項目
  - Binary「間違い／正しい」
  - 10秒制限
  - RT・正誤・timeout
- 端末情報、画面サイズ、入力方法、タブ移動等を保存
- PC・スマートフォン対応
- FPT終了時の中間保存＋全課題終了時の最終保存

## 重要：最初に変更する箇所

### 1. DataPipe Experiment ID

`config.js`を開き、次を設定してください。

```javascript
const DATAPIPE_EXPERIMENT_ID = "新しいDataPipe Experiment ID";
```

初期値は意図的に空欄です。空欄のままではOSFへ保存されず、最終画面でCSVが端末にダウンロードされます。

### 2. 刺激項目

`stimuli.js`の`FPT_ITEMS`と`GJT_ITEMS`を、確定したパイロット2項目に置き換えてください。
現在の項目は、最新版候補を反映した29項目です。v-obj-obl[to]はtakeとsend、v-obj-objはgive・show・tellです。

## GitHub Pagesへの設置

フォルダ内の以下をrepositoryのルートへアップロードします。

- index.html
- config.js
- stimuli.js
- experiment.js
- style.css
- .nojekyll

GitHubの `Settings` → `Pages` で `Deploy from a branch`、`main`、`/(root)`を選びます。

## DataPipeのsession limit

参加者1人につき、通常は次の2ファイルを保存します。

1. FPT終了時のcheckpoint
2. 全課題終了時のfinal

20名なら最低40セッション相当が必要です。再試行を考慮し、60以上を推奨します。
FPT checkpointを不要にする場合は、`config.js`で次を変更します。

```javascript
const SAVE_FPT_CHECKPOINT = false;
```

## スマートフォン対応

- GJTの2ボタンは常に横並び
- 文は画面幅に応じて自動縮小・折り返し
- ボタンと入力欄に`touch-action: manipulation`
- 入力欄は16px以上にしてiPhoneの自動拡大を抑制
- モバイルではフルスクリーンを要求しない
- PCではフルスクリーンを使用

## 保存される主要変数

### FPT

- participant_id
- session_id
- item_id
- presentation_order
- target_verb
- category
- target_pattern
- response_1
- response_2
- second_response_used
- response_1_word_count
- response_2_word_count
- response_1_character_count
- response_2_character_count
- rt（項目全体）
- first_key_rt
- fpt_total_rt_ms

### GJT

- item_id
- presentation_order
- target_verb
- target_pattern
- sentence_text
- presented_status
- judgment
- correct
- rt
- timed_out
- gjt_total_rt_ms

### 端末・操作

- device_type
- viewport_width / viewport_height
- screen_width / screen_height
- self_reported_input_device
- user_agent
- interaction_data_json

## 本番前チェック

1. PC、iPhone、Androidの各1台以上で開く。
2. スマホ縦画面でGJT文全体が見える。
3. ダブルタップで意図せず拡大しない。
4. FPTで1文目を空欄にすると進めない。
5. 2文目を空欄のまま進める。
6. GJTが10秒でtimeoutになる。
7. FPT checkpointとfinalがOSFに保存される。
8. final CSVにFPT29行・GJT29行が含まれる。
9. 同じ参加者番号で再実施してもsession_idによりファイル名が重複しない。

## 注意点

FPTのRTには思考時間と入力時間が混在します。スマートフォンと物理キーボードでは入力速度が異なるため、RTを学習者間で比較する際は端末・入力方法を必ず確認してください。
