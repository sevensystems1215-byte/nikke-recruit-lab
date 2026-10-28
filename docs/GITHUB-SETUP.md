# GitHubで使い始める手順

この手順は、GitHubを初めて使う方に向けたものです。Gitやコマンドの操作は前提にしていません。必要なファイルの登録や設定は、GitHubのWeb画面で一緒に進めます。

## 先に知っておくこと

- **リポジトリ**は、この計算機のコードを置く場所です。
- **GitHub Pages**は、そのコードから計算機を使えるWebサイトを配信する機能です。
- 今回の標準案は、GitHub Freeの公開リポジトリと公開GitHub Pagesです。サイトとコードは一般公開されます。
- 実際の所持データ、バックアップのJSON・CSV、データ入りURLをリポジトリへ登録する必要はありません。
- 所持データはブラウザ内とセーブしたURLで扱います。スマホとPCへ自動同期するサーバーは使いません。

公開前に、完成した計算機と公開するファイルを確認します。本人限定での配信を希望する場合は、その段階で配信方法を変更します。

## 1. GitHubのアカウントを用意する

1. [GitHub](https://github.com/)を開きます。
2. アカウントがある場合は「Sign in」でログインします。なければ「Sign up」で登録します。
3. GitHubから届く確認メールなど、本人確認の案内を完了します。
4. ここまでできたら、その旨を伝えてください。

ログインや本人確認はご自身の画面で行います。パスワードを会話に書く必要はありません。

## 2. コード置き場を作る

Web画面で作る場合の設定は以下です。

| 設定 | 入れる内容 |
| --- | --- |
| Owner | ご自身のGitHubアカウント |
| Repository name | `nikke-recruit-lab`（別の未使用名でも可） |
| Visibility | `Public` |
| 最初のファイル | 準備した一式を登録するため、空のリポジトリから始める |

作成されたリポジトリのURLを共有すると、以後の導入先を確認できます。リポジトリ名を変えても、この計算機はそのフォルダの下で動く作りです。

## 3. 準備したファイルを登録する

公開用の一式を、リポジトリの一番上に登録します。コードの登録先には、次の配置が必要です。

| ファイル・フォルダ | 役割 |
| --- | --- |
| `dist/` | 公開する計算機と画像 |
| `tests/`、`package.json` | 公開前の動作確認 |
| `.github/workflows/pages.yml` | 確認が成功したら計算機を配信する設定 |
| `README.md`、`docs/` | 操作方法・導入手順 |

ZIPファイルそのものをGitHubへ置くだけではサイトになりません。展開した中身を、上記の配置で登録します。

Web画面の場合は、リポジトリの「Add file」→「Upload files」で登録できます。一度にアップロードできるのは100ファイルまでなので、124体の画像を含む一式は分けて登録します。`.github`は隠しフォルダとして表示されることがあります。見えない場合は「Add file」→「Create new file」でファイル名に `.github/workflows/pages.yml` と入力し、用意した設定を貼り付ける方法で案内します。認証用ファイルや、現在の所持データのバックアップはアップロードしません。

この計算機の更新用ブランチ名は `main` です。最初のファイル登録直後は、Pages設定がまだで公開処理が失敗することがあります。次の設定後に実行し直します。

## 4. Pagesを有効にする

1. リポジトリ上部の「Settings」を開きます。
2. 左側の「Pages」を開きます。
3. 「Build and deployment」の「Source」で **GitHub Actions** を選びます。
4. すでに `pages.yml` が入っているため、GitHubが勧める別のテンプレートを追加する必要はありません。

設定できない場合は、ログイン中のアカウントがそのリポジトリの所有者かを確認します。設定項目の名前は英語表示が基準です。

## 5. 初回の公開を実行する

1. リポジトリ上部の「Actions」を開きます。
2. 左側の **Publish GitHub Pages** を選びます。
3. 「Run workflow」を押し、ブランチが `main` になっていることを確認します。
4. もう一度「Run workflow」を押して開始します。
5. 実行の詳細を開き、「Run tests」から「Deploy website」まで緑のチェックで終わることを確認します。

テストが失敗すると、その実行では新しいサイトを公開しません。赤いチェックになったら、失敗したステップ名と表示された内容を教えてください。個人の所持データは送る必要はありません。

成功後は、実行結果の `github-pages` に表示されるURL、または「Settings」→「Pages」のサイトURLから開きます。通常は `https://アカウント名.github.io/リポジトリ名/` という形です。これはURLの形式を示す例なので、実際に表示されたURLを使ってください。

## 6. 今の所持データを移す

1. 現在使っている計算機を、データが入っているブラウザで開きます。
2. 「データ・設定」→「JSONを書き出す」を押します。
3. ダウンロードしたJSONはバックアップとして手元に残します。
4. 新しいGitHub Pagesの計算機を開きます。
5. 「データ・設定」→「読み込む」から、そのJSONを選びます。
6. 所持数・凸・ウィッシュ・チケット・モールドが移ったことを確認します。
7. 「セーブ」を押し、新サイトのデータ入りURLを開いた状態にします。

古いサイトと新しいサイトはURLが違うため、ブラウザ内の保存内容が自動で移るわけではありません。旧サイトは、移行を確認できるまで残します。

## 7. スマホとPCでタブ共有を試す

1. PCの計算機で「セーブ」を押します。
2. 保存後のタブを、ブラウザの「お使いのデバイスに送信」などでスマホへ送ります。
3. スマホで受信したタブを開きます。
4. スマホ側にすでに別データがある場合は、確認画面で取り込む内容を選びます。
5. 所持数、凸、ウィッシュ、チケット、モールドがPCと一致するか確認します。
6. スマホでテスト用の変更をし、「セーブ」後のタブをPCへ送って、逆方向も確認します。

使うブラウザによって共有の操作は違います。PCとスマホの種類・ブラウザを教えてもらい、その組み合わせで案内します。URL末尾の保存情報がそのまま渡るところまで、実際の端末で確認します。タブ共有を使わない場合は「URLをコピー」で渡せます。

## 8. 以後の更新

通常は `main` にコードの更新を反映すると、「Publish GitHub Pages」が自動で動き、テスト成功後に `dist/` が再公開されます。日常の所持入力でGitHubを操作する必要はありません。

キャラや排出率を更新したい場合は、追加・変更したい内容を伝えてください。ゲーム内の提供割合・対象を確認し、データ基準日と出典を残してコードを更新します。ゲームからの自動更新は行いません。

## 9. 以前の版へ戻したいとき

まず「JSONを書き出す」で現在の入力をバックアップします。コードを以前の正常版へ戻す操作はこちらで支援します。戻したい版が不明なら、最後に正常に使えた日時と症状を教えてください。

直近の正常な公開処理が残っている場合は、「Actions」からその実行を開き、「Re-run all jobs」で同じ版を再公開する方法もあります。GitHubでは通常、最初の実行から30日以内の実行を再実行できます。この方法は `main` のコード自体を戻す操作ではないため、一時復旧後のコード修正も合わせて行います。

画面が古いままなら、まず通常の再読み込みを試します。所持データの入ったブラウザの保存領域を消す操作は、バックアップと復元方法を確認してから行います。

## 設定の根拠と確認日

2026年10月28日にGitHubの公式ドキュメントと公式Actionsのリリースを確認しました。採用した版は `checkout v7.0.1`、`setup-node v7.1.0`、`configure-pages v6.0.0`、`upload-pages-artifact v5.0.0`、`deploy-pages v5.0.1` です。テスト用Node.jsは24系です。依存パッケージがないため、パッケージのインストール処理は追加していません。

- [GitHub Pagesの公開元を設定する](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [カスタムワークフローと必要な権限](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Web画面でファイルを追加する](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
- [ワークフローを再実行する](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)
- [actions/checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1)
- [actions/setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0)
- [actions/configure-pages v6.0.0](https://github.com/actions/configure-pages/releases/tag/v6.0.0)
- [actions/upload-pages-artifact v5.0.0](https://github.com/actions/upload-pages-artifact/releases/tag/v5.0.0)
- [actions/deploy-pages v5.0.1](https://github.com/actions/deploy-pages/releases/tag/v5.0.1)
