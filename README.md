# SUUMO Property Search LINE Bot

A LINE Bot that scrapes and notifies property information from SUUMO based on specific search criteria.

SUUMO の物件情報を特定の検索条件に基づいてスクレイピングし、通知する LINE ボット。

## Features / 機能

- Scrapes property information from SUUMO / SUUMO から物件情報をスクレイピング
- Responds to LINE messages / LINE メッセージに応答
- Sends property details in a formatted message / フォーマットされたメッセージで物件詳細を送信

## Prerequisites / 前提条件

- Node.js (v14 or higher / v14 以上)
- LINE Messaging API account / LINE Messaging API アカウント
- Vercel account (for deployment / デプロイ用)

## Setup / セットアップ

1. Clone the repository / リポジトリをクローン

```bash
git clone [repository-url]
cd [repository-name]
```

2. Install dependencies / 依存関係をインストール

```bash
npm install
```

3. Set up environment variables / 環境変数を設定
   Create a `.env` file with the following variables / 以下の変数を含む`.env`ファイルを作成:

```
CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
CHANNEL_SECRET=your_line_channel_secret
```

4. Build the project / プロジェクトをビルド

```bash
npm run build
```

5. Deploy to Vercel / Vercel にデプロイ

```bash
vercel
```

## Usage / 使用方法

1. Add the LINE Bot as a friend / LINE ボットを友だち追加
2. Send "物件検索" message / "物件検索"メッセージを送信
3. Receive property information / 物件情報を受信

## Development / 開発

```bash
# Run in development mode / 開発モードで実行
npm run dev

# Build the project / プロジェクトをビルド
npm run build

# Start the production server / 本番サーバーを起動
npm start
```

## License / ライセンス

MIT
