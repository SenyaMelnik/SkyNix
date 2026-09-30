const {
    app,
    BrowserWindow,
    dialog,
    ipcMain
} = require("electron");

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const HOSTS =
    "C:\\Windows\\System32\\drivers\\etc\\hosts";

const MINECRAFT_IP = "26.87.154.25";
const MINECRAFT_HOST = "play.skynix";

let mainWindow = null;


// ======================================================
// СОЗДАНИЕ ОКНА
// ======================================================

function createWindow() {

    mainWindow = new BrowserWindow({

        width: 480,
        height: 560,

        resizable: false,

        title: "SkyNix",

        backgroundColor: "#0b0b16",

        autoHideMenuBar: true,

        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }

    });

    mainWindow.loadFile(
        path.join(__dirname, "index.html")
    );
}


// ======================================================
// ЗАПУСК АДМИНИСТРАТОРА
// ======================================================

function openMinecraftSetup() {

    const { execFile } =
        require("child_process");

    let file;
    let args;

    // Если запускаем через npm start
    if (!app.isPackaged) {

        file = process.execPath;

        args = [
            path.join(__dirname, "main.js"),
            "--setup-minecraft"
        ];

    }

    // Если это готовый SkyNix.exe
    else {

        file = process.execPath;

        args = [
            "--setup-minecraft"
        ];

    }

    const escapedArgs = args
        .map(arg => `'${arg.replace(/'/g, "''")}'`)
        .join(",");

    const command =
        `Start-Process ` +
        `-FilePath '${file.replace(/'/g, "''")}' ` +
        `-ArgumentList ${escapedArgs} ` +
        `-Verb RunAs`;

    execFile(
        "powershell.exe",
        [
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            command
        ],
        {
            windowsHide: true
        },
        (error) => {

            if (error) {

                dialog.showErrorBox(
                    "SkyNix",
                    "Не удалось запросить права администратора.\n\n" +
                    error.message
                );

            }

        }
    );
}


// ======================================================
// ДОБАВЛЕНИЕ IP
// ======================================================

function addMinecraftIP() {

    try {

        let content =
            fs.readFileSync(
                HOSTS,
                "utf8"
            );

        const lines =
            content.split(/\r?\n/);

        let found = false;

        for (const line of lines) {

            const clean =
                line.trim();

            // Учитываем пробелы и табы
            const parts =
                clean.split(/\s+/);

            if (
                parts.length >= 2 &&
                parts[0] === MINECRAFT_IP &&
                parts[1] === MINECRAFT_HOST
            ) {

                found = true;
                break;

            }

        }


        // Добавляем запись

        if (!found) {

            if (
                content.length > 0 &&
                !content.endsWith("\n")
            ) {

                content += "\r\n";

            }

            content +=
                `${MINECRAFT_IP} ${MINECRAFT_HOST}\r\n`;

            fs.writeFileSync(
                HOSTS,
                content,
                "utf8"
            );

        }


        // Очищаем DNS

        spawn(
            "ipconfig",
            ["/flushdns"],
            {
                windowsHide: true
            }
        );


        // Показываем результат

        dialog.showMessageBoxSync({

            type: "info",

            title: "SkyNix",

            message:
                found
                    ? "IP SkyNix уже настроен!"
                    : "IP SkyNix успешно добавлен!",

            detail:
                "Minecraft: play.skynix\n" +
                "IP: 26.87.154.25\n\n" +
                "Radmin VPN: Sky_Nix"

        });

    }

    catch (error) {

        dialog.showErrorBox(

            "Ошибка SkyNix",

            "Не удалось изменить файл hosts.\n\n" +
            error.message

        );

    }

}


// ======================================================
// IPC
// ======================================================

ipcMain.on(
    "setup-minecraft",
    () => {

        openMinecraftSetup();

    }
);


// ======================================================
// ЗАПУСК
// ======================================================

if (
    process.argv.includes(
        "--setup-minecraft"
    )
) {

    // Админский экземпляр
    // ничего не показывает

    app.whenReady().then(() => {

        addMinecraftIP();

        setTimeout(() => {

            app.quit();

        }, 1000);

    });

}

else {

    // Обычный экземпляр

    app.whenReady().then(() => {

        createWindow();

    });

}


// ======================================================
// ЗАКРЫТИЕ
// ======================================================

app.on(
    "window-all-closed",
    () => {

        app.quit();

    }
);