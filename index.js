const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn, execFileSync } = require("child_process");

const APP_NAME = "SkyNix";
const VERSION = "1.0.0";

const WIKI = "https://wiki.skynix.workers.dev";
const YOUTUBE = "https://www.youtube.com/@SenyaMelnik_Games";

const MINECRAFT_IP = "26.87.154.25";
const MINECRAFT_HOST = "play.skynix";

const HOSTS =
    "C:\\Windows\\System32\\drivers\\etc\\hosts";

// ======================================================
// ПРОВЕРКА АДМИНИСТРАТОРА
// ======================================================

function isAdmin() {
    try {
        execFileSync("net", ["session"], {
            stdio: "ignore",
            windowsHide: true
        });

        return true;
    } catch {
        return false;
    }
}

// ======================================================
// ЗАПУСК ОТ ИМЕНИ АДМИНИСТРАТОРА
// ======================================================

function runAsAdmin() {
    const exe = process.execPath;

    const ps = [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `Start-Process -FilePath '${exe.replace(/'/g, "''")}' -Verb RunAs`
    ];

    spawn("powershell.exe", ps, {
        windowsHide: true,
        detached: true
    });

    process.exit(0);
}

if (!isAdmin()) {
    runAsAdmin();
}

// ======================================================
// ВРЕМЕННЫЙ HTA-ФАЙЛ
// ======================================================

const appDir = path.join(
    os.tmpdir(),
    "SkyNixApp"
);

if (!fs.existsSync(appDir)) {
    fs.mkdirSync(appDir, {
        recursive: true
    });
}

const htaFile = path.join(
    appDir,
    "SkyNix.hta"
);

// ======================================================
// HTML / HTA
// ======================================================

const hta = `
<html>
<head>

<title>SkyNix</title>

<HTA:APPLICATION
    ID="SkyNix"
    APPLICATIONNAME="SkyNix"
    BORDER="thin"
    CAPTION="yes"
    SHOWINTASKBAR="yes"
    SINGLEINSTANCE="yes"
    SYSMENU="yes"
    WINDOWSTATE="normal"
    SCROLL="no"
/>

<style>

html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
}

body {
    background: #0b0b16;
    color: white;
    font-family: Arial, sans-serif;
}

.container {
    width: 390px;
    margin: 0 auto;
    padding-top: 35px;
    text-align: center;
}

.logo {
    font-size: 38px;
    font-weight: bold;

    color: #8b6cff;

    margin-bottom: 8px;
}

.subtitle {
    color: #85859c;
    font-size: 14px;
    margin-bottom: 30px;
}

.button {
    width: 350px;
    height: 58px;

    margin: 8px auto;

    display: block;

    background: #20203a;

    border: 1px solid #39395b;
    border-radius: 12px;

    color: white;

    font-size: 16px;
    font-weight: bold;

    cursor: pointer;
}

.button:hover {
    background: #2d2d50;
}

.version {
    margin-top: 25px;

    color: #62627a;

    font-size: 12px;
}

</style>

<script language="javascript">

var shell = new ActiveXObject("WScript.Shell");

function openWiki() {

    shell.Run("${WIKI}");

}

function openYouTube() {

    shell.Run("${YOUTUBE}");

}

function setupMinecraft() {

    var hosts = "${HOSTS}";
    var ip = "${MINECRAFT_IP}";
    var host = "${MINECRAFT_HOST}";

    try {

        var fso =
            new ActiveXObject("Scripting.FileSystemObject");

        var text = "";

        if (fso.FileExists(hosts)) {

            var file =
                fso.OpenTextFile(hosts, 1, false);

            text = file.ReadAll();

            file.Close();

        }

        var lines =
            text.split(/\\r?\\n/);

        var found = false;

        for (var i = 0; i < lines.length; i++) {

            var line =
                lines[i].replace(/^\\s+|\\s+$/g, "");

            if (
                line === ip + " " + host ||
                line === ip + "\\t" + host
            ) {

                found = true;
                break;

            }

        }

        if (!found) {

            var file =
                fso.OpenTextFile(hosts, 8, true);

            file.WriteLine("");
            file.WriteLine(ip + " " + host);

            file.Close();

        }

        shell.Run(
            "cmd.exe /c ipconfig /flushdns",
            0,
            true
        );

        if (found) {

            alert(
                "SkyNix Minecraft уже настроен!\\n\\n" +
                "Адрес: play.skynix\\n" +
                "IP: 26.87.154.25\\n\\n" +
                "Radmin VPN: Sky_Nix"
            );

        } else {

            alert(
                "Готово!\\n\\n" +
                "Добавлено:\\n" +
                "26.87.154.25 play.skynix\\n\\n" +
                "Radmin VPN: Sky_Nix"
            );

        }

    } catch (e) {

        alert(
            "Не удалось изменить файл hosts.\\n\\n" +
            "Ошибка: " + e.message
        );

    }

}

function closeApp() {

    window.close();

}

</script>

</head>

<body>

<div class="container">

    <div class="logo">
        SkyNix
    </div>

    <div class="subtitle">
        Официальное приложение SkyNix
    </div>

    <button
        class="button"
        onclick="openWiki()">

        Wiki SkyNix

    </button>

    <button
        class="button"
        onclick="setupMinecraft()">

        IP SkyNix Minecraft

    </button>

    <button
        class="button"
        onclick="openYouTube()">

        YouTube Senya Melnik

    </button>

    <div class="version">
        Версия ${VERSION}
    </div>

</div>

</body>
</html>
`;

// ======================================================
// СОХРАНЯЕМ HTA
// ======================================================

try {

    fs.writeFileSync(
        htaFile,
        hta,
        "utf8"
    );

} catch (error) {

    console.error(
        "Ошибка создания приложения:",
        error.message
    );

    process.exit(1);
}

// ======================================================
// ЗАПУСК ОКНА
// ======================================================

const app = spawn(
    "mshta.exe",
    [htaFile],
    {
        windowsHide: false,
        detached: false
    }
);

app.on("close", () => {

    try {
        fs.unlinkSync(htaFile);
    } catch {}

    try {
        fs.rmdirSync(appDir);
    } catch {}

    process.exit(0);
});