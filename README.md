# task

にちじょうタスク管理アプリ — Railway + Turso (LibSQL) で動くフルスタック構成。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| サーバー | Node.js + [Hono](https://hono.dev/) |
| DB | [Turso](https://turso.tech/) (LibSQL / SQLite互換) |
| ホスティング | [Railway](https://railway.app/) |
| フロントエンド | バニラJS + HTML (public/index.html) |

## ディレクトリ構成

```
task/
├── public/
│   └── index.html      # フロントエンド
├── src/
│   ├── db.js           # Turso接続
│   ├── migrate.js      # テーブル作成
│   └── server.js       # APIサーバー (Hono)
├── .env.example
├── package.json
├── railway.toml
└── README.md
```

## セットアップ

### 1. Turso でDBを作る

```bash
# Turso CLIをインストール
brew install tursodatabase/tap/turso

# ログイン
turso auth login

# DB作成
turso db create task-app

# 接続URLとトークンを取得
turso db show task-app --url
turso db tokens create task-app
```

### 2. 環境変数を設定

```bash
cp .env.example .env
# TURSO_URL と TURSO_AUTH_TOKEN を埋める
```

### 3. マイグレーション実行

```bash
npm install
npm run migrate
```

### 4. ローカル起動

```bash
npm run dev
# → http://localhost:3000
```

## Railway へのデプロイ

1. GitHubにpush (`git push origin main`)
2. Railway で「New Project」→「Deploy from GitHub repo」→ `KasanoVon/task` を選択
3. 環境変数を Railway のダッシュボードで設定:
   - `TURSO_URL`
   - `TURSO_AUTH_TOKEN`
4. デプロイ完了後、生成されたURLにアクセス

## API エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/tasks | 全タスク取得 |
| POST | /api/tasks | タスク追加 |
| PATCH | /api/tasks/:id | タスク更新 |
| DELETE | /api/tasks/:id | タスク削除 |
| PATCH | /api/tasks/reorder | 並べ替え |
| GET | /api/logs?date= | 日次ログ取得 |
| POST | /api/logs | ログ記録 |
| GET | /api/streaks?days= | ストリーク取得 |

## タスクの type

| type | 説明 |
|---|---|
| `normal` | 通常タスク（期限なし） |
| `timed` | 期限ありタスク（日付・開始・終了時刻）|
| `repeat` | 定期タスク（毎N時間/日/週/月）|
