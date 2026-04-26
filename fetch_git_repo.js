// .envを読み込めるようにする
import 'dotenv/config'

import fs from "node:fs";
import path from "node:path"

// 情報の取得
const { token, owner, repo, source: user_source } = process.env;

// .gitignoreのパス
const gitignorePath = "./.gitignore";

// ヘッダーの設定
const headers = {
  "Accept": "application/vnd.github+json",
  "Authorization": `Bearer ${token}`,
  "X-GitHub-Api-Version": "2026-03-10"
};

// あるファイルやディレクトリが存在するか判定する関数
function isExistFile(Path) {
  try {
    return fs.existsSync(Path);
  } catch (error) {
    console.error("【エラー】isExistFileでエラーが発生しました。:\n", error)
  }
}

// ファイルを文字列として読み込む関数
function getFileString(Path, encoding = "utf-8") {
  try {
    return fs.readFileSync(Path, { encoding });
  } catch (error) {
    console.error("【エラー】getFileStringでエラーが発生しました。:\n ", error)
  }
}

// パス(入れ子可能)からディレクトリを作成する
function makeDir(...Paths) {
  try {
    // 一つずつパスを保存しながら反復処理
    Paths.reduce((Path, current) => {
      // 追加
      Path += current;

      // 存在していない時には作成
      if (!isExistFile(Path)) fs.mkdirSync(Path);

      return Path;
    }, "");
  } catch (error) {
    console.error("【エラー】makeDirでエラーが発生しました。:\n ", error)
  }
}

{
  // リポジトリからファイルを取得して保存する関数
  const clone = (data = {}, ignore = [], source = "REPO", dir = []) => {
    // sourceの長さ1未満絶対許さないマン
    if (source.length < 1) {
      console.log("【警告】\n出力先のフォルダーにルートは指定できません。\nルートに出力する場合は、一度別のフォルダーに出力してから取り込んだファイルを移動させてください。");
      return;
    }

    // 出力先のディレクトリが含まれていないなら追加する
    if (!dir.includes(source)) dir.unshift(source);

    // 出力先のフォルダーが存在するか確認
    // 出力先は既定でREPOとなる
    if (!isExistFile(source)) {
      // sourceを配列にする
      makeDir(source.split("/"));
    }

    // dirをパス名に変換
    const dirName = dir.join("/");
    // ファイルのパスを文字列にする
    const filePath = path.join(dirName, data.name);

    // 除外リストに載っているか確認
    if (ignore && ignore.includes(filePath)) return;

    // ファイルとディレクトリで処理を分ける
    if (data.type === "file") {
      // ファイルを取得
      fetch(data.download_url, { headers })
        // 文字列化
        .then(response => response.text())
        // 書き込み
        .then(response => {
          // REPOフォルダー内に作成するため、新しいパスを取得
          const Path = path.join(filePath);

          // 上書きか新規作成か
          if (isExistFile(Path)) {
            // リポジトリ上のファイルがローカルと同じ内容なら無視するようにする
            // 【注意】コンフリクトとかは対策していません！
            if (response !== getFileString(Path)) {
              // 上書き
              fs.writeFileSync(Path, response);
            }
          } else {
            // 新規作成
            fs.writeFileSync(Path, response);
          }
        })
        .catch(error => console.error(error));
    } else if (data.type === "dir") {
      // フォルダーを取得
      fetch(data.url, { headers })
        .then(response => response.json())
        // 呼び出し
        .then(response => {
          // ディレクトリ名を結合
          const nextDir = dir.concat([data.name]);

          // フォルダーの作成
          if (!isExistFile(nextDir)) makeDir(nextDir.join("/"));

          // さらにcloneを呼び出し
          response.forEach((data) => clone(data, ignore, source, nextDir));
        });
    }
  }

  // リポジトリのファイル、フォルダーの取得
  fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, { headers })
    .then(response => response.json())
    .then(response => {
      // 自分のgitignoreファイルを参照する
      const ignores = isExistFile(gitignorePath) ?
        fs.readFileSync(gitignorePath, { encoding: "utf-8" }) :
        null;

      // 改行で区切る
      const ignoreFiles = ignores != null ? ignores.split("\r\n") : null;

      // 取得したデータに処理
      response.forEach((data) => clone(data, ignoreFiles, user_source));

      return null;
    })
    .then(() =>
      console.log(`${owner}/${repo}` + (user_source ?`を${user_source}にコピー完了` : "のコピー完了"))
    )
    .catch(error => console.error(error));
}