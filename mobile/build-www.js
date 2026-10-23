// Собирает папку www для Android из ОБЩЕГО index.html (из корня репозитория).
// Никакого отдельного кода интерфейса для телефона нет:
// при обновлении index.html обновляются и ПК, и телефон.

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const www = path.join(__dirname, "www");

let html = fs.readFileSync(path.join(root, "index.html"), "utf8");

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });

// 1) viewport для телефона
if (!/name=["']viewport["']/.test(html)) {
    html = html.replace(
        /<head>/i,
        '<head>\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
    );
}

// 2) мост «платформы» подключаем ДО основного скрипта
const firstScript = html.search(/<script>/i);

if (firstScript === -1) {
    throw new Error("В index.html не найден основной <script>.");
}

const inject =
    "<style>html,body{overscroll-behavior:none;-webkit-tap-highlight-color:transparent}" +
    "body{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}</style>\n" +
    "<script>window.SKYNIX_MOBILE = true;</script>\n" +
    '<script src="mobile-bridge.js"></script>\n';

html = html.slice(0, firstScript) + inject + html.slice(firstScript);

fs.writeFileSync(path.join(www, "index.html"), html);

fs.copyFileSync(
    path.join(__dirname, "src", "mobile-bridge.js"),
    path.join(www, "mobile-bridge.js")
);

// Иконки интерфейса, если они лежат рядом с index.html
const assets = path.join(root, "assets");

if (fs.existsSync(assets)) {
    fs.cpSync(assets, path.join(www, "assets"), { recursive: true });
}

console.log("www готова:", fs.readdirSync(www).join(", "));
