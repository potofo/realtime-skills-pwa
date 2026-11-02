# Realtime Skills PWA - 最小構成のデモ

Docker コンテナ 1 つ、Node.js バックエンドプロセス 1 つ、GPT-Realtime エージェント 1 つで構成されています。PWA は WebRTC で OpenAI と通信し、SDK の function tool が Node バックエンドを呼び出して、許可リストに登録されたスキルを実行します。これは SDK が任意の Agent Skills を自動実行する仕組みでは**ありません**。`AGENTS.md` と `SKILL.md` は指示として読み込まれ、各スキルは個別に実装されたツールが実行します。

## 起動

```sh
cp .env.example .env
# .env を編集して OPENAI_API_KEY を設定
docker compose up --build -d
```

### wslc（WSL Container CLI）で起動

Windows では、Docker の代わりに `wslc` でビルド・起動することもできます。`wslc` は `docker-compose.yaml` を読み込まないため、同等のオプションを直接指定します（PowerShell）。

```powershell
Copy-Item .env.example .env
# .env を編集して OPENAI_API_KEY（または Azure OpenAI の設定）を設定
wslc build -t realtime-skills-pwa .
wslc run -d --name realtime-skills --env-file .env -p 127.0.0.1:3000:3000 -v "${PWD}\data:/data:ro" realtime-skills-pwa
```

ログの確認・停止・削除:

```powershell
wslc logs realtime-skills
wslc stop realtime-skills
wslc remove realtime-skills
```

`wslc run` には再起動ポリシーのオプションがないため、Compose（`restart: unless-stopped`）と異なりコンテナーは自動で再起動されません。再度起動するには `wslc start realtime-skills` を実行してください。

Compose のポートは 127.0.0.1:3000 にバインドされます。iPhone から使う場合は、アクセス制御を備えた既存の **HTTPS リバースプロキシ** 経由で公開してください。Safari で HTTPS の URL を開き、マイクへのアクセスを許可してから `通話開始` をタップします。PWA として使うには、Safari の共有 > ホーム画面に追加 を選びます。「今何時？」と話しかけてみてください。

## データフォルダー

ホストの `data/` フォルダーは、コンテナー内の `/data`（`DATA_DIR`）に読み取り専用でマウントされます。エージェントは `data-list`・`data-search`・`data-read` スキル（`skills/data-files/SKILL.md`）を使って、そこにある `.md`・`.txt`・`.csv`・`.json` ファイルの一覧取得・検索・読み込みを行えます。「カフェの土曜日の営業時間は？」「サーモスタットのE3エラーの対処法は？」などと聞いてみてください。

`data/` 内のサンプルファイルは、このプロジェクト用に作成した架空のコンテンツで、パブリックドメイン（CC0 1.0）として提供しています。自分のファイルに置き換えて使ってください。イメージには `data/` を含めていないため、ファイルを変更してもリビルドは不要です。データフォルダー外のパスは拒否されます。

## ディレクトリ構成

- `src/main.js`: ブラウザ側の RealtimeAgent / WebRTC と `run_skill` ツール
- `server.js`: 単一の Express バックエンド。エフェメラルトークン、設定、許可リスト方式のスキルハンドラー、静的ファイル配信
- `AGENTS.md`: エージェント全体への指示
- `skills/current-time/SKILL.md`: スキル指示の例
- `architecture.svg`: アーキテクチャ図
- `BASIC_SPEC.md`: 要件
- `BASIC_DESIGN.md`: 設計

## セキュリティ / 制約

**デモ専用です。このままの状態でパブリックなインターネットに公開しないでください。** 認証、レート制限、ユーザーごとのツール認可、必要に応じた CSRF 対策、監査ログを追加してください。ブラウザからのツール呼び出しはセキュリティ境界になりません。`OPENAI_API_KEY` を決してブラウザに公開しないでください。一時的なクライアントシークレットは有効期間が短いものの、それでも保護する必要があります。API とスキルのエンドポイントはリバースプロキシで制限してください。`SKILL.md` から任意のシェルコマンドを実行しないでください。

現在の例では、固定された 1 つの許可リスト登録スキルのみを使用しており、任意のスキルスクリプトを自動で検出・実行するものではありません。デモを最小限に保つため、PWA マニフェストにはインストール用アイコンを意図的に含めていません。きちんとしたインストール体験にするにはアイコンを追加してください。iOS では、バックグラウンドに移行したり画面がロックされたりすると音声が停止することがあります。セッションの有効期限切れや切断の後は再接続してください。この例は、この環境では OpenAI API キーを使ったエンドツーエンドの検証を行っていません。

## 参考

- https://openai.github.io/openai-agents-js/ja/guides/voice-agents/quickstart/
- https://openai.github.io/openai-agents-js/guides/voice-agents/transport/

## モデルについて
幅広い互換性のため、既定のモデルは `gpt-realtime` です。アカウントで新しいモデルが使える場合は、`REALTIME_MODEL` と `src/main.js` 内の対応するモデルを設定してください。このデモは実際の API キーでの検証を行っていません。
