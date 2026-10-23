const {
    app,
    BrowserWindow,
    dialog,
    ipcMain,
    shell,
    Tray,
    Menu,
    nativeImage,
    Notification
} = require("electron");

const {
    autoUpdater
} = require("electron-updater");

const log = require("electron-log");

const fs = require("fs");
const path = require("path");

const {
    spawn
} = require("child_process");

// ============================================================
// SKY NIX
// main.js
// Version 1.3.1
// ============================================================

// CONFIG
const APP_VERSION = "1.3.1";
const WORKER_URL = "https://discord.skynix.workers.dev";
const TELEGRAM_WORKER_URL = "https://skynix-moderation.skynix.workers.dev";
const DISCORD_LOGIN_URL = "https://discord.skynix.workers.dev/api/discord/login";
const WIKI_URL = "https://wiki.skynix.workers.dev";
const YOUTUBE_URL = "https://www.youtube.com/@SenyaMelnik_Games";
const APPLICATION_URL = "https://forms.gle/gtYFhD5UeHycSRAb8";
const APPLICATION_BOT_URL = "https://t.me/Applications_SkyNix_BOT";
const MINECRAFT_IP = "26.87.154.25";
const MINECRAFT_HOST = "play.skynix";

// HOSTS
const HOSTS = path.join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "drivers",
    "etc",
    "hosts"
);

// VARIABLES
let mainWindow = null;
let tray = null;
let isQuitting = false;
let startedAtWindowsLogin = false;
let USER_DATA = null;
let DISCORD_SESSION_FILE = null;
let discordSession = null;
let discordLogoutRequested = false;
let wikiWindow = null;
let updateDownloaded = false;
let updatePromptShown = false;

// ============================================================
// SINGLE INSTANCE
// ============================================================

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
    app.quit();
}

// ============================================================
// DETECT WINDOWS AUTOSTART
// ============================================================

function isWindowsAutostart() {
    if (process.platform !== "win32") {
        return false;
    }

    const args = process.argv.map(
        argument => String(argument).toLowerCase()
    );

    return args.includes("--autostart");
}

// ============================================================
// PROTOCOL URL FROM COMMAND LINE
// ============================================================

function getProtocolUrlFromArgs(argv) {
    if (!Array.isArray(argv)) return null;

    for (const argument of argv) {
        if (
            typeof argument === "string" &&
            argument.startsWith("skynix://")
        ) {
            return argument;
        }
    }

    return null;
}

// ============================================================
// DISCORD CALLBACK
// ============================================================

function handleDiscordCallback(callbackUrl) {
    if (typeof callbackUrl !== "string") return;

    if (!callbackUrl.startsWith("skynix://")) return;

    try {
        const parsed = new URL(callbackUrl);

        const encodedSession =
            parsed.searchParams.get("session");

        if (!encodedSession) {
            log.error(
                "Discord callback: session отсутствует."
            );

            return;
        }

        if (discordLogoutRequested) {
            log.info(
                "Discord callback проигнорирован после logout."
            );

            return;
        }

        const session = JSON.parse(
            Buffer
                .from(encodedSession, "base64")
                .toString("utf8")
        );

        discordSession = session;

        saveDiscordSession(session);

        if (mainWindow) {
            mainWindow.webContents.send(
                "discord-session",
                encodedSession
            );
        }
    }
    catch (error) {
        log.error(
            "Ошибка Discord callback:",
            error
        );

        if (mainWindow) {
            dialog.showErrorBox(
                "Discord",
                "Не удалось обработать авторизацию Discord.\n\n" +
                error.message
            );
        }
    }
}

// ============================================================
// PROTOCOL REGISTRATION
// ============================================================

function registerProtocol() {
    try {
        if (process.platform !== "win32") return;

        if (!app.isPackaged) {
            app.setAsDefaultProtocolClient(
                "skynix",
                process.execPath,
                [path.resolve(process.argv[1])]
            );
        }
        else {
            app.setAsDefaultProtocolClient(
                "skynix"
            );
        }

        log.info(
            "SkyNix protocol registered."
        );
    }
    catch (error) {
        log.error(
            "Ошибка регистрации skynix://",
            error
        );
    }
}

// ============================================================
// USER DATA
// ============================================================

function initializeUserData() {
    USER_DATA = app.getPath(
        "userData"
    );

    DISCORD_SESSION_FILE = path.join(
        USER_DATA,
        "discord-session.json"
    );
}

// ============================================================
// WINDOWS AUTOSTART
// ============================================================

function setupWindowsAutostart() {
    if (process.platform !== "win32") {
        return;
    }

    try {
        app.setLoginItemSettings({
            openAtLogin: true,
            openAsHidden: true,
            args: [
                "--autostart"
            ]
        });

        const loginSettings =
            app.getLoginItemSettings();

        startedAtWindowsLogin =
            Boolean(
                isWindowsAutostart()
            );

        log.info(
            "Windows autostart:",
            loginSettings.openAtLogin
        );

        log.info(
            "SkyNix started by Windows autostart:",
            startedAtWindowsLogin
        );
    }
    catch (error) {
        log.error(
            "Ошибка настройки автозапуска Windows:",
            error
        );
    }
}

// ============================================================
// TRAY
// ============================================================

function createTray() {
    if (tray) return;

    try {
        let trayIcon;

        const iconPath = path.join(
            __dirname,
            "assets",
            "icon.ico"
        );

        if (fs.existsSync(iconPath)) {
            trayIcon =
                nativeImage.createFromPath(
                    iconPath
                );
        }
        else if (
            process.platform === "win32" &&
            app.isPackaged
        ) {
            trayIcon =
                nativeImage.createFromPath(
                    process.execPath
                );
        }

        if (
            !trayIcon ||
            trayIcon.isEmpty()
        ) {
            trayIcon =
                nativeImage.createEmpty();
        }

        tray =
            new Tray(trayIcon);

        tray.setToolTip(
            "SkyNix"
        );

        const contextMenu =
            Menu.buildFromTemplate([
                {
                    label: "Открыть SkyNix",
                    click: () => {
                        showMainWindow();
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Выйти из SkyNix",
                    click: () => {
                        isQuitting = true;
                        app.quit();
                    }
                }
            ]);

        tray.setContextMenu(
            contextMenu
        );

        tray.on(
            "click",
            () => {
                showMainWindow();
            }
        );

        tray.on(
            "double-click",
            () => {
                showMainWindow();
            }
        );

        log.info(
            "SkyNix tray создан."
        );
    }
    catch (error) {
        log.error(
            "Ошибка создания SkyNix tray:",
            error
        );
    }
}

// ============================================================
// SHOW MAIN WINDOW
// ============================================================

function showMainWindow() {
    if (!mainWindow) {
        createWindow();

        return;
    }

    if (
        mainWindow.isMinimized()
    ) {
        mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
}

// ============================================================
// LOAD DISCORD SESSION
// ============================================================

function loadDiscordSession() {
    if (!DISCORD_SESSION_FILE) {
        return null;
    }

    try {
        if (
            !fs.existsSync(
                DISCORD_SESSION_FILE
            )
        ) {
            return null;
        }

        const content =
            fs.readFileSync(
                DISCORD_SESSION_FILE,
                "utf8"
            );

        if (!content.trim()) {
            return null;
        }

        return JSON.parse(
            content
        );
    }
    catch (error) {
        log.error(
            "Ошибка загрузки Discord:",
            error
        );

        return null;
    }
}

// ============================================================
// SAVE DISCORD SESSION
// ============================================================

function saveDiscordSession(session) {
    if (!DISCORD_SESSION_FILE) {
        return;
    }

    try {
        fs.writeFileSync(
            DISCORD_SESSION_FILE,
            JSON.stringify(
                session,
                null,
                2
            ),
            "utf8"
        );
    }
    catch (error) {
        log.error(
            "Ошибка сохранения Discord:",
            error
        );
    }
}

// ============================================================
// DELETE DISCORD SESSION
// ============================================================

function deleteDiscordSession() {
    if (!DISCORD_SESSION_FILE) {
        return;
    }

    try {
        if (
            fs.existsSync(
                DISCORD_SESSION_FILE
            )
        ) {
            fs.unlinkSync(
                DISCORD_SESSION_FILE
            );
        }
    }
    catch (error) {
        log.error(
            "Ошибка удаления Discord:",
            error
        );
    }
}

// ============================================================
// TELEGRAM REQUEST
// ============================================================

async function telegramRequest(
    endpoint,
    options = {}
) {
    // Вместо общего секрета — вход через Discord (проверяется на сервере)
    if (!discordSession) {
        throw new Error(
            "Не выполнен вход через Discord."
        );
    }

    const headers = {
        ...(options.headers || {}),
        "X-Discord-Session":
            getEncodedDiscordSession(),
        "Content-Type":
            "application/json"
    };

    const response =
        await fetch(
            TELEGRAM_WORKER_URL +
            endpoint,
            {
                ...options,
                headers
            }
        );

    const text =
        await response.text();

    let data;

    try {
        data =
            JSON.parse(text);
    }
    catch {
        throw new Error(
            "Telegram Worker вернул некорректный ответ:\n" +
            text
        );
    }

    if (
        !response.ok ||
        data.ok === false
    ) {
        throw new Error(
            data.error ||
            "Ошибка Telegram Worker."
        );
    }

    return data;
}

// ============================================================
// GET TELEGRAM MEMBERS
// ============================================================

async function getTelegramMembers() {
    const data =
        await telegramRequest(
            "/api/members",
            {
                method: "GET"
            }
        );

    if (
        !Array.isArray(
            data.members
        )
    ) {
        throw new Error(
            "Telegram Worker не вернул список участников."
        );
    }

    return data.members;
}

// ============================================================
// IPC - TELEGRAM GET MEMBERS
// ============================================================

ipcMain.handle(
    "telegram-get-members",
    async () => {
        try {
            return await getTelegramMembers();
        }
        catch (error) {
            log.error(
                "Telegram get members error:",
                error
            );

            throw new Error(
                error.message
            );
        }
    }
);

// ============================================================
// TELEGRAM MODERATION
// ============================================================

async function telegramModeration(data) {
    if (
        !data ||
        typeof data !== "object"
    ) {
        throw new Error(
            "Некорректные данные модерации Telegram."
        );
    }

    const action =
        String(
            data.action || ""
        ).trim();

    if (!action) {
        throw new Error(
            "Не указано действие модерации Telegram."
        );
    }

    let telegramUserId =
        data.telegram_user_id ??
        data.telegramUserId ??
        data.user_id ??
        data.id;

    if (
        telegramUserId &&
        typeof telegramUserId === "object"
    ) {
        telegramUserId =
            telegramUserId.id ??
            telegramUserId.user_id ??
            telegramUserId.telegram_user_id ??
            null;
    }

    const userId =
        Number(
            telegramUserId
        );

    if (
        !Number.isFinite(userId) ||
        userId <= 0
    ) {
        throw new Error(
            "Не выбран пользователь Telegram."
        );
    }

    const reason =
        String(
            data.reason || ""
        ).trim();

    if (!reason) {
        throw new Error(
            "Укажите причину."
        );
    }

    const body = {
        action,
        telegram_user_id:
            userId,
        reason,
        moderator:
            data.moderator ||
            "SkyNix"
    };

    if (action === "mute") {
        let durationMs =
            data.duration_ms ??
            data.duration ??
            null;

        if (
            typeof durationMs === "string"
        ) {
            durationMs =
                durationMs.trim();
        }

        if (
            typeof durationMs === "string" &&
            /^(\d+)\s*(s|m|h|d)$/i.test(
                durationMs
            )
        ) {
            const match =
                durationMs.match(
                    /^(\d+)\s*(s|m|h|d)$/i
                );

            const value =
                Number(
                    match[1]
                );

            const unit =
                match[2].toLowerCase();

            if (unit === "s") {
                durationMs =
                    value * 1000;
            }
            else if (unit === "m") {
                durationMs =
                    value *
                    60 *
                    1000;
            }
            else if (unit === "h") {
                durationMs =
                    value *
                    60 *
                    60 *
                    1000;
            }
            else if (unit === "d") {
                durationMs =
                    value *
                    24 *
                    60 *
                    60 *
                    1000;
            }
        }
        else {
            durationMs =
                Number(
                    durationMs
                );
        }

        if (
            !Number.isFinite(
                durationMs
            ) ||
            durationMs <= 0
        ) {
            throw new Error(
                "Укажите конкретное время мута."
            );
        }

        const MAX_MUTE_MS =
            28 *
            24 *
            60 *
            60 *
            1000;

        if (
            durationMs >
            MAX_MUTE_MS
        ) {
            throw new Error(
                "Максимальное время мута — 28 дней."
            );
        }

        body.duration_ms =
            Math.floor(
                durationMs
            );
    }

    console.log(
        "Telegram moderation:",
        {
            action,
            telegramUserId:
                userId,
            duration_ms:
                body.duration_ms,
            reason
        }
    );

    return await telegramRequest(
        "/api/moderation",
        {
            method: "POST",
            body:
                JSON.stringify(
                    body
                )
        }
    );
}

// ============================================================
// IPC - TELEGRAM MODERATION
// ============================================================

ipcMain.handle(
    "telegram-moderation",
    async (
        event,
        data
    ) => {
        try {
            return await telegramModeration(
                data
            );
        }
        catch (error) {
            log.error(
                "Telegram moderation error:",
                error
            );

            throw new Error(
                error.message
            );
        }
    }
);

// ============================================================
// IPC - DISCORD MODERATION
// ============================================================

ipcMain.handle(
    "discord-moderation",
    async (
        event,
        data
    ) => {
        try {
            const {
                action,
                userId,
                duration,
                reason
            } = data || {};

            console.log(
                "Discord moderation:",
                {
                    action,
                    userId,
                    duration,
                    reason
                }
            );

            if (!discordSession) {
                throw new Error(
                    "Discord не авторизован."
                );
            }

            if (!userId) {
                throw new Error(
                    "Не выбран пользователь Discord."
                );
            }

            if (!action) {
                throw new Error(
                    "Не указано действие."
                );
            }

            if (
                !reason ||
                !String(reason).trim()
            ) {
                throw new Error(
                    "Не указана причина."
                );
            }

            let discordDuration =
                null;

            if (action === "mute") {
                if (
                    duration === undefined ||
                    duration === null ||
                    duration === "" ||
                    Number(duration) <= 0
                ) {
                    throw new Error(
                        "Укажите конкретное время мута."
                    );
                }

                const durationMs =
                    Number(
                        duration
                    );

                if (
                    !Number.isFinite(
                        durationMs
                    ) ||
                    durationMs <= 0
                ) {
                    throw new Error(
                        "Неверное время мута."
                    );
                }

                const second =
                    1000;

                const minute =
                    60 *
                    second;

                const hour =
                    60 *
                    minute;

                const day =
                    24 *
                    hour;

                if (
                    durationMs %
                    day === 0
                ) {
                    discordDuration =
                        `${durationMs / day}d`;
                }
                else if (
                    durationMs %
                    hour === 0
                ) {
                    discordDuration =
                        `${durationMs / hour}h`;
                }
                else if (
                    durationMs %
                    minute === 0
                ) {
                    discordDuration =
                        `${durationMs / minute}m`;
                }
                else if (
                    durationMs %
                    second === 0
                ) {
                    discordDuration =
                        `${durationMs / second}s`;
                }
                else {
                    throw new Error(
                        "Неверное время мута."
                    );
                }
            }

            const encodedSession =
                Buffer
                    .from(
                        JSON.stringify(
                            discordSession
                        ),
                        "utf8"
                    )
                    .toString(
                        "base64"
                    );

            const body = {
                action:
                    action,
                targetId:
                    String(
                        userId
                    ),
                reason:
                    String(
                        reason
                    ).trim()
            };

            if (
                action === "mute"
            ) {
                body.duration =
                    discordDuration;
            }

            const response =
                await fetch(
                    `${WORKER_URL}/api/discord/moderation`,
                    {
                        method:
                            "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                            "Authorization":
                                `Bearer ${encodedSession}`
                        },
                        body:
                            JSON.stringify(
                                body
                            )
                    }
                );

            const text =
                await response.text();

            let result;

            try {
                result =
                    JSON.parse(
                        text
                    );
            }
            catch {
                result = {
                    success:
                        false,
                    error:
                        text ||
                        "Worker вернул некорректный ответ."
                };
            }

            if (
                !response.ok ||
                result.success === false
            ) {
                throw new Error(
                    result.error ||
                    `Discord Worker вернул ошибку ${response.status}.`
                );
            }

            console.log(
                "Discord moderation success:",
                result
            );

            return result;
        }
        catch (error) {
            log.error(
                "Discord moderation error:",
                error
            );

            throw new Error(
                error.message ||
                "Не удалось выполнить действие Discord."
            );
        }
    }
);

// ============================================================
// OPEN EXTERNAL
// ============================================================

ipcMain.handle(
    "open-external",
    async (
        event,
        url
    ) => {
        if (
            typeof url !== "string"
        ) {
            return false;
        }

        await shell.openExternal(
            url
        );

        return true;
    }
);

// ============================================================
// CREATE WINDOW
// ============================================================

function createWindow() {
    if (mainWindow) {
        return;
    }

    mainWindow =
        new BrowserWindow({
            width: 600,
            height: 850,

            icon: path.join(
                __dirname,
                "assets",
                "icon.ico"
            ),

            minWidth: 600,
            minHeight: 850,
            resizable: true,
            backgroundColor: "#090914",

            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                sandbox: false
            },

            show: false
        });

    mainWindow.loadFile(
        path.join(
            __dirname,
            "index.html"
        )
    );

    mainWindow.once(
        "ready-to-show",
        () => {
            /*
             * ВАЖНО:
             * Если SkyNix запущен Windows —
             * окно НЕ показываем.
             *
             * При обычном запуске —
             * показываем.
             */
            if (
                !startedAtWindowsLogin
            ) {
                mainWindow.show();
            }

            if (discordSession) {
                sendDiscordSession(
                    discordSession
                );
            }
        }
    );

    mainWindow.on(
        "close",
        event => {
            if (!isQuitting) {
                event.preventDefault();

                mainWindow.hide();
            }
        }
    );

    mainWindow.on(
        "closed",
        () => {
            mainWindow = null;
        }
    );
}

// ============================================================
// SEND DISCORD SESSION
// ============================================================

function sendDiscordSession(
    session
) {
    if (
        !mainWindow ||
        !session
    ) {
        return;
    }

    try {
        const encoded =
            Buffer
                .from(
                    JSON.stringify(
                        session
                    ),
                    "utf8"
                )
                .toString(
                    "base64"
                );

        mainWindow.webContents.send(
            "discord-session",
            encoded
        );
    }
    catch (error) {
        log.error(
            "Ошибка отправки Discord:",
            error
        );
    }
}

// ============================================================
// SECOND INSTANCE
// ============================================================

app.on(
    "second-instance",
    (
        event,
        commandLine
    ) => {
        showMainWindow();

        const callback =
            getProtocolUrlFromArgs(
                commandLine
            );

        if (callback) {
            handleDiscordCallback(
                callback
            );
        }
    }
);

// ============================================================
// OPEN URL
// ============================================================

app.on(
    "open-url",
    (
        event,
        url
    ) => {
        event.preventDefault();

        handleDiscordCallback(
            url
        );
    }
);

// ============================================================
// MINECRAFT SETUP
// ============================================================

function minecraftSetup() {
    return new Promise(
        (
            resolve,
            reject
        ) => {
            const tempScript =
                path.join(
                    app.getPath("temp"),
                    "SkyNixMinecraftSetup.ps1"
                );

            const tempResult =
                path.join(
                    app.getPath("temp"),
                    "SkyNixMinecraftResult.txt"
                );

            try {
                if (
                    fs.existsSync(
                        tempScript
                    )
                ) {
                    fs.unlinkSync(
                        tempScript
                    );
                }

                if (
                    fs.existsSync(
                        tempResult
                    )
                ) {
                    fs.unlinkSync(
                        tempResult
                    );
                }
            }
            catch (error) {
                log.error(
                    "Ошибка удаления временных файлов:",
                    error
                );
            }

            const psLines = [];

            psLines.push(
                "$hosts = '" +
                HOSTS.replace(
                    /'/g,
                    "''"
                ) +
                "'"
            );

            psLines.push(
                "$ip = '" +
                MINECRAFT_IP.replace(
                    /'/g,
                    "''"
                ) +
                "'"
            );

            psLines.push(
                "$hostName = '" +
                MINECRAFT_HOST.replace(
                    /'/g,
                    "''"
                ) +
                "'"
            );

            psLines.push(
                "$result = '" +
                tempResult.replace(
                    /'/g,
                    "''"
                ) +
                "'"
            );

            psLines.push("");

            psLines.push(
                "try {"
            );

            psLines.push(
                "$content = Get-Content -Path $hosts -ErrorAction SilentlyContinue"
            );

            psLines.push("");

            psLines.push(
                "if ($null -eq $content) {"
            );

            psLines.push(
                "    $content = @()"
            );

            psLines.push(
                "}"
            );

            psLines.push("");

            psLines.push(
                "$newContent = @()"
            );

            psLines.push("");

            psLines.push(
                "foreach ($line in $content) {"
            );

            psLines.push(
                "    if ($line -notmatch (\"\\s\" + [regex]::Escape($hostName) + \"\\s*$\")) {"
            );

            psLines.push(
                "        $newContent += $line"
            );

            psLines.push(
                "    }"
            );

            psLines.push(
                "}"
            );

            psLines.push("");

            psLines.push(
                "$newContent += ($ip + \" \" + $hostName)"
            );

            psLines.push("");

            psLines.push(
                "Set-Content -Path $hosts -Value $newContent -Encoding ASCII"
            );

            psLines.push("");

            psLines.push(
                "\"OK\" | Set-Content -Path $result -Encoding UTF8"
            );

            psLines.push("");

            psLines.push(
                "}"
            );

            psLines.push(
                "catch {"
            );

            psLines.push(
                "(\"ERROR:\" + $_.Exception.Message) | Set-Content -Path $result -Encoding UTF8"
            );

            psLines.push(
                "}"
            );

            const psScript =
                psLines.join(
                    "\r\n"
                );

            try {
                fs.writeFileSync(
                    tempScript,
                    psScript,
                    "utf8"
                );
            }
            catch (error) {
                reject(error);

                return;
            }

            const command =
                "Start-Process powershell.exe " +
                "-Verb RunAs " +
                "-Wait " +
                "-ArgumentList " +
                "'-NoProfile','-ExecutionPolicy','Bypass','-File','" +
                tempScript.replace(
                    /'/g,
                    "''"
                ) +
                "'";

            const child =
                spawn(
                    "powershell.exe",
                    [
                        "-NoProfile",
                        "-ExecutionPolicy",
                        "Bypass",
                        "-Command",
                        command
                    ],
                    {
                        windowsHide: false
                    }
                );

            let stderr = "";

            child.stderr.on(
                "data",
                data => {
                    stderr +=
                        data.toString();
                }
            );

            child.on(
                "error",
                error => {
                    reject(error);
                }
            );

            child.on(
                "close",
                () => {
                    let attempts = 0;

                    const checkResult =
                        setInterval(
                            () => {
                                attempts++;

                                if (
                                    fs.existsSync(
                                        tempResult
                                    )
                                ) {
                                    clearInterval(
                                        checkResult
                                    );

                                    let result =
                                        "";

                                    try {
                                        result =
                                            fs.readFileSync(
                                                tempResult,
                                                "utf8"
                                            ).trim();
                                    }
                                    catch (error) {
                                        reject(
                                            error
                                        );

                                        return;
                                    }

                                    try {
                                        fs.unlinkSync(
                                            tempScript
                                        );
                                    }
                                    catch {}

                                    try {
                                        fs.unlinkSync(
                                            tempResult
                                        );
                                    }
                                    catch {}

                                    if (
                                        result ===
                                        "OK"
                                    ) {
                                        resolve(
                                            true
                                        );

                                        return;
                                    }

                                    if (
                                        result.startsWith(
                                            "ERROR:"
                                        )
                                    ) {
                                        reject(
                                            new Error(
                                                result.substring(
                                                    6
                                                )
                                            )
                                        );

                                        return;
                                    }

                                    reject(
                                        new Error(
                                            "Не удалось настроить IP Minecraft."
                                        )
                                    );

                                    return;
                                }

                                if (
                                    attempts >=
                                    40
                                ) {
                                    clearInterval(
                                        checkResult
                                    );

                                    try {
                                        fs.unlinkSync(
                                            tempScript
                                        );
                                    }
                                    catch {}

                                    reject(
                                        new Error(
                                            "Окно UAC не было подтверждено или операция была отменена."
                                        )
                                    );
                                }
                            },
                            500
                        );
                }
            );
        }
    );
}

// ============================================================
// IPC - MINECRAFT
// ============================================================

ipcMain.handle(
    "minecraft-setup",
    async () => {
        const hostsPath =
            "C:\\Windows\\System32\\drivers\\etc\\hosts";

        const minecraftLine =
            "26.87.154.25 play.skynix";

        try {
            await new Promise(
                (
                    resolve,
                    reject
                ) => {
                    const psCommand =
                        "$path = '" +
                        hostsPath +
                        "'; " +
                        "$line = '" +
                        minecraftLine +
                        "'; " +
                        "$content = Get-Content -LiteralPath $path -Raw; " +
                        "if ($content -notmatch '(?m)^\\s*26\\.87\\.154\\.25\\s+play\\.skynix\\s*$') { " +
                        "if (-not $content.EndsWith([Environment]::NewLine)) { " +
                        "$content += [Environment]::NewLine; " +
                        "} " +
                        "$content += $line + [Environment]::NewLine; " +
                        "[System.IO.File]::WriteAllText($path, $content); " +
                        "}";

                    const encodedCommand =
                        Buffer
                            .from(
                                psCommand,
                                "utf16le"
                            )
                            .toString(
                                "base64"
                            );

                    const child =
                        spawn(
                            "powershell.exe",
                            [
                                "-NoProfile",
                                "-ExecutionPolicy",
                                "Bypass",
                                "-Command",
                                "Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand','" +
                                encodedCommand +
                                "'"
                            ],
                            {
                                windowsHide: true
                            }
                        );

                    let stderr = "";

                    child.stderr.on(
                        "data",
                        data => {
                            stderr +=
                                data.toString();
                        }
                    );

                    child.on(
                        "error",
                        error => {
                            reject(
                                error
                            );
                        }
                    );

                    child.on(
                        "close",
                        code => {
                            if (
                                code !== 0
                            ) {
                                reject(
                                    new Error(
                                        stderr ||
                                        "Не удалось получить права администратора."
                                    )
                                );

                                return;
                            }

                            resolve();
                        }
                    );
                }
            );

            return {
                success:
                    true,
                message:
                    "IP play.skynix добавлен."
            };
        }
        catch (error) {
            log.error(
                "Minecraft hosts error:",
                error
            );

            throw new Error(
                error.message ||
                "Не удалось добавить IP в hosts."
            );
        }
    }
);

// ============================================================
// WIKI WINDOW (окно внутри приложения)
// ============================================================

function isWikiUrl(url) {
    try {
        return new URL(url).origin === new URL(WIKI_URL).origin;
    }
    catch (error) {
        return false;
    }
}

function openWikiWindow() {
    if (
        wikiWindow &&
        !wikiWindow.isDestroyed()
    ) {
        if (wikiWindow.isMinimized()) {
            wikiWindow.restore();
        }

        wikiWindow.show();
        wikiWindow.focus();

        return;
    }

    wikiWindow = new BrowserWindow({
        width: 1100,
        height: 800,
        minWidth: 600,
        minHeight: 500,
        title: "Wiki SkyNix",
        icon: path.join(
            __dirname,
            "assets",
            "icon.ico"
        ),
        backgroundColor: "#090914",
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        }
    });

    wikiWindow.setMenuBarVisibility(false);

    // Ссылки на другие сайты открываем в браузере,
    // а ссылки внутри wiki остаются в этом окне.
    wikiWindow.webContents.setWindowOpenHandler(
        ({ url }) => {
            if (isWikiUrl(url)) {
                wikiWindow.loadURL(url);
            }
            else if (/^https?:\/\//i.test(url)) {
                shell.openExternal(url);
            }

            return {
                action: "deny"
            };
        }
    );

    wikiWindow.webContents.on(
        "will-navigate",
        (event, url) => {
            if (
                !isWikiUrl(url) &&
                !url.startsWith("data:")
            ) {
                event.preventDefault();

                if (/^https?:\/\//i.test(url)) {
                    shell.openExternal(url);
                }
            }
        }
    );

    wikiWindow.webContents.on(
        "did-fail-load",
        (
            event,
            errorCode,
            errorDescription,
            validatedURL,
            isMainFrame
        ) => {
            // -3 = загрузка отменена (например, переход по ссылке)
            if (!isMainFrame || errorCode === -3) return;

            log.error(
                "Wiki не загрузилась:",
                errorDescription
            );

            const html =
                "<body style='background:#090914;color:#fff;" +
                "font-family:sans-serif;display:flex;" +
                "align-items:center;justify-content:center;" +
                "height:100vh;margin:0;text-align:center'>" +
                "<div><h2>Не удалось загрузить Wiki</h2>" +
                "<p>Проверьте подключение к интернету и " +
                "откройте Wiki ещё раз.</p></div></body>";

            wikiWindow.loadURL(
                "data:text/html;charset=utf-8," +
                encodeURIComponent(html)
            );
        }
    );

    wikiWindow.loadURL(WIKI_URL);

    wikiWindow.on(
        "closed",
        () => {
            wikiWindow = null;
        }
    );
}

ipcMain.handle(
    "open-wiki",
    () => {
        openWikiWindow();

        return true;
    }
);

// ============================================================
// IPC - APP VERSION
// ============================================================

ipcMain.handle(
    "app-version",
    () => {
        return APP_VERSION;
    }
);

// ============================================================
// IPC - DISCORD LOGIN
// ============================================================

ipcMain.handle(
    "discord-login",
    async () => {
        discordLogoutRequested =
            false;

        await shell.openExternal(
            DISCORD_LOGIN_URL
        );

        return true;
    }
);

// ============================================================
// IPC - DISCORD SESSION
// ============================================================

ipcMain.handle(
    "discord-session",
    () => {
        if (!discordSession) {
            return null;
        }

        return discordSession;
    }
);

// ============================================================
// IPC - DISCORD LOGOUT
// ============================================================

ipcMain.handle(
    "discord-logout",
    () => {
        discordLogoutRequested =
            true;

        discordSession =
            null;

        deleteDiscordSession();

        if (mainWindow) {
            mainWindow.webContents.send(
                "discord-logout"
            );
        }

        return true;
    }
);

// ============================================================
// AUTO UPDATER
// ============================================================

function installUpdateNow() {
    // Окно SkyNix при закрытии лишь прячется в трей.
    // Без этого флага закрытие блокируется и установка не стартует.
    isQuitting = true;

    setImmediate(
        () => {
            try {
                autoUpdater.quitAndInstall(
                    true,
                    true
                );
            }
            catch (error) {
                log.error(
                    "Ошибка установки обновления:",
                    error
                );
            }
        }
    );
}

async function promptInstallUpdate(version) {
    if (updatePromptShown) return;

    updatePromptShown = true;

    try {
        const options = {
            type: "info",
            title: "SkyNix — обновление",
            message: "Обновление SkyNix " + version + " скачано.",
            detail:
                "Перезапустить приложение и установить его сейчас?\n" +
                "Если выбрать «Позже», обновление установится " +
                "при следующем выходе из SkyNix.",
            buttons: [
                "Перезапустить и установить",
                "Позже"
            ],
            defaultId: 0,
            cancelId: 1,
            noLink: true
        };

        const result =
            mainWindow && mainWindow.isVisible()
                ? await dialog.showMessageBox(mainWindow, options)
                : await dialog.showMessageBox(options);

        if (result.response === 0) {
            installUpdateNow();
        }
        else {
            log.info(
                "Установка обновления отложена."
            );
        }
    }
    catch (error) {
        log.error(
            "Ошибка окна обновления:",
            error
        );
    }
}

function checkForUpdatesSafe() {
    if (updateDownloaded) return;

    try {
        const result =
            autoUpdater.checkForUpdates();

        if (
            result &&
            typeof result.catch === "function"
        ) {
            result.catch(
                error => {
                    log.error(
                        "Ошибка проверки обновлений:",
                        error
                    );
                }
            );
        }
    }
    catch (error) {
        log.error(
            error
        );
    }
}

function setupAutoUpdater() {
    try {
        autoUpdater.logger =
            log;

        autoUpdater.autoDownload =
            true;

        autoUpdater.autoInstallOnAppQuit =
            true;

        let lastLoggedPercent = -10;

        autoUpdater.on(
            "checking-for-update",
            () => {
                log.info(
                    "Проверка обновлений..."
                );
            }
        );

        autoUpdater.on(
            "update-available",
            info => {
                log.info(
                    "Доступно обновление, скачиваю:",
                    info.version
                );
            }
        );

        autoUpdater.on(
            "update-not-available",
            () => {
                log.info(
                    "Обновлений нет."
                );
            }
        );

        autoUpdater.on(
            "download-progress",
            progress => {
                if (
                    progress.percent - lastLoggedPercent >= 10
                ) {
                    lastLoggedPercent =
                        progress.percent;

                    log.info(
                        "Скачивание обновления: " +
                        Math.round(progress.percent) +
                        "%"
                    );
                }
            }
        );

        autoUpdater.on(
            "error",
            error => {
                log.error(
                    "Ошибка автообновления:",
                    error
                );
            }
        );

        autoUpdater.on(
            "update-downloaded",
            info => {
                log.info(
                    "Обновление скачано:",
                    info.version
                );

                updateDownloaded =
                    true;

                promptInstallUpdate(
                    info.version
                );
            }
        );

        if (!app.isPackaged) {
            log.info(
                "Автообновление отключено в режиме разработки."
            );

            return;
        }

        setTimeout(
            checkForUpdatesSafe,
            5000
        );

        // Приложение живёт в трее, поэтому проверяем
        // обновления и во время работы (каждые 30 минут).
        setInterval(
            checkForUpdatesSafe,
            30 * 60 * 1000
        );
    }
    catch (error) {
        log.error(
            "AutoUpdater error:",
            error
        );
    }
}

// ============================================================
// MODERATION NOTICES (уведомления о муте / бане и т.д.)
// ============================================================

const NOTICE_POLL_MS = 120 * 1000;

const NOTICE_TITLES = {
    mute: "Вы были замучены",
    unmute: "С вас снят мут",
    ban: "Вы были забанены",
    unban: "Вы были разбанены"
};

const NOTICE_ACTIONS = {
    mute: "Мут",
    unmute: "Размут",
    ban: "Бан",
    unban: "Разбан"
};

const shownNoticeIds = new Set();
let noticePollingStarted = false;
let noticeErrorLogged = false;

function pluralRu(n, forms) {
    const n10 = n % 10;
    const n100 = n % 100;

    if (n10 === 1 && n100 !== 11) return forms[0];

    if (
        n10 >= 2 &&
        n10 <= 4 &&
        (n100 < 12 || n100 > 14)
    ) {
        return forms[1];
    }

    return forms[2];
}

function formatNoticeDuration(raw) {
    const match =
        String(raw || "").match(/^(\d+)(s|m|h|d)$/i);

    if (!match) return null;

    const value = Number(match[1]);

    const words = {
        s: ["секунда", "секунды", "секунд"],
        m: ["минута", "минуты", "минут"],
        h: ["час", "часа", "часов"],
        d: ["день", "дня", "дней"]
    };

    return (
        value +
        " " +
        pluralRu(
            value,
            words[match[2].toLowerCase()]
        )
    );
}

function buildNoticeView(notice) {
    const action = String(notice.action || "");

    const rows = [
        [
            "Кем",
            notice.moderator || "Модератор"
        ],
        [
            "Что именно",
            NOTICE_ACTIONS[action] || action
        ]
    ];

    if (action === "mute") {
        const duration =
            formatNoticeDuration(notice.duration);

        if (duration) {
            rows.push(["Срок", duration]);
        }
    }
    else if (action === "ban") {
        rows.push(["Срок", "Без срока"]);
    }

    rows.push([
        "Причина",
        notice.reason || "Не указана"
    ]);

    return {
        title:
            NOTICE_TITLES[action] ||
            "Действие модерации",
        rows
    };
}

function showNativeNotice(view) {
    try {
        if (!Notification.isSupported()) return;

        const options = {
            title: "SkyNix — " + view.title,
            body: view.rows
                .map(row => row[0] + ": " + row[1])
                .join("\n")
        };

        const iconPath = path.join(
            __dirname,
            "assets",
            "icon.ico"
        );

        if (fs.existsSync(iconPath)) {
            options.icon = iconPath;
        }

        const toast = new Notification(options);

        toast.on(
            "click",
            () => {
                showMainWindow();
            }
        );

        toast.show();
    }
    catch (error) {
        log.error(
            "Ошибка системного уведомления:",
            error
        );
    }
}

function deliverModerationNotice(notice) {
    if (
        !notice ||
        !notice.id
    ) {
        return;
    }

    const id = String(notice.id);

    const view = buildNoticeView(notice);

    if (!shownNoticeIds.has(id)) {
        shownNoticeIds.add(id);

        showNativeNotice(view);
    }

    // Окно в приложении показывает сообщение до тех пор,
    // пока пользователь не нажмёт «Понятно».
    if (
        mainWindow &&
        !mainWindow.isDestroyed() &&
        !mainWindow.webContents.isLoading()
    ) {
        mainWindow.webContents.send(
            "moderation-notice",
            {
                id,
                view
            }
        );
    }
}

function getEncodedDiscordSession() {
    if (!discordSession) return null;

    return Buffer
        .from(
            JSON.stringify(
                discordSession
            ),
            "utf8"
        )
        .toString("base64");
}

async function pollModerationNotices() {
    if (
        !discordSession ||
        discordLogoutRequested
    ) {
        return;
    }

    try {
        const response = await fetch(
            `${WORKER_URL}/api/discord/notifications`,
            {
                headers: {
                    "Authorization":
                        `Bearer ${getEncodedDiscordSession()}`
                },
                signal: AbortSignal.timeout(15000)
            }
        );

        if (!response.ok) return;

        const data = await response.json();

        if (
            !data ||
            !Array.isArray(data.notifications)
        ) {
            return;
        }

        for (const notice of data.notifications) {
            deliverModerationNotice(notice);
        }
    }
    catch (error) {
        if (!noticeErrorLogged) {
            noticeErrorLogged = true;

            log.warn(
                "Проверка уведомлений модерации не удалась:",
                error && error.message
            );
        }
    }
}

ipcMain.handle(
    "moderation-notice-ack",
    async (
        event,
        ids
    ) => {
        if (
            !Array.isArray(ids) ||
            !discordSession
        ) {
            return false;
        }

        const clean =
            ids
                .map(String)
                .filter(id => /^[\w-]+$/.test(id))
                .slice(0, 50);

        if (!clean.length) return false;

        try {
            const response = await fetch(
                `${WORKER_URL}/api/discord/notifications/ack`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                        "Authorization":
                            `Bearer ${getEncodedDiscordSession()}`
                    },
                    body: JSON.stringify({
                        ids: clean
                    }),
                    signal: AbortSignal.timeout(15000)
                }
            );

            return response.ok;
        }
        catch (error) {
            log.warn(
                "Не удалось подтвердить уведомление:",
                error && error.message
            );

            return false;
        }
    }
);

function setupModerationNotices() {
    if (noticePollingStarted) return;

    noticePollingStarted = true;

    setTimeout(
        pollModerationNotices,
        8000
    );

    setInterval(
        pollModerationNotices,
        NOTICE_POLL_MS
    );
}

// ============================================================
// PROFILE (профиль, история наказаний, привязка Telegram)
// ============================================================

function requireDiscordSession() {
    if (!discordSession) {
        throw new Error(
            "Не выполнен вход через Discord."
        );
    }
}

ipcMain.handle(
    "profile-get",
    async () => {
        requireDiscordSession();

        const response = await fetch(
            `${WORKER_URL}/api/discord/profile`,
            {
                headers: {
                    "Authorization":
                        `Bearer ${getEncodedDiscordSession()}`
                },
                signal: AbortSignal.timeout(20000)
            }
        );

        let data = null;

        try {
            data = await response.json();
        }
        catch {
            data = null;
        }

        if (
            !response.ok ||
            !data ||
            !data.success
        ) {
            throw new Error(
                (data && data.error) ||
                "Не удалось загрузить профиль."
            );
        }

        return data.profile;
    }
);

function telegramProfileRequest(
    endpoint,
    method
) {
    requireDiscordSession();

    return telegramRequest(
        endpoint,
        {
            method,
            headers: {
                "X-Discord-Session":
                    getEncodedDiscordSession()
            }
        }
    );
}

ipcMain.handle(
    "profile-telegram-status",
    () => telegramProfileRequest(
        "/api/profile/telegram",
        "GET"
    )
);

ipcMain.handle(
    "profile-telegram-link-code",
    () => telegramProfileRequest(
        "/api/profile/link-code",
        "POST"
    )
);

ipcMain.handle(
    "profile-telegram-unlink",
    () => telegramProfileRequest(
        "/api/profile/unlink",
        "POST"
    )
);

// Редактор предупреждений (Архонт, Правая рука Создателя, Заместитель)
ipcMain.handle(
    "warnings-get",
    () => telegramProfileRequest(
        "/api/profile/warnings",
        "GET"
    )
);

ipcMain.handle(
    "warnings-save",
    (
        event,
        sections
    ) => {
        requireDiscordSession();

        return telegramRequest(
            "/api/profile/warnings",
            {
                method: "POST",
                headers: {
                    "X-Discord-Session":
                        getEncodedDiscordSession()
                },
                body: JSON.stringify({
                    sections
                })
            }
        );
    }
);

// ============================================================
// APP READY
// ============================================================

app.whenReady()
    .then(
        () => {
            // Проверяем автозапуск ДО создания окна
            startedAtWindowsLogin =
                isWindowsAutostart();

            log.info(
                "SkyNix app.whenReady запущен."
            );

            log.info(
                "SkyNix autostart:",
                startedAtWindowsLogin
            );

            initializeUserData();

            // Нужен для системных уведомлений Windows
            // (совпадает с appId из package.json).
            if (process.platform === "win32") {
                app.setAppUserModelId(
                    "work.skynix.app"
                );
            }

            setupWindowsAutostart();

            discordSession =
                loadDiscordSession();

            registerProtocol();

            // Сначала создаём трей
            createTray();

            // Окно создаётся скрытым.
            // При автозапуске оно останется скрытым.
            createWindow();

            setupAutoUpdater();

            setupModerationNotices();

            const initialProtocolUrl =
                getProtocolUrlFromArgs(
                    process.argv
                );

            /*
             * ВАЖНО:
             * Если приложение было запущено
             * Windows, НЕ открываем окно.
             *
             * Если был настоящий skynix:// callback,
             * тогда окно открываем.
             */
            if (
                initialProtocolUrl
            ) {
                showMainWindow();

                handleDiscordCallback(
                    initialProtocolUrl
                );
            }

            app.on(
                "activate",
                () => {
                    if (
                        BrowserWindow
                            .getAllWindows()
                            .length === 0
                    ) {
                        createWindow();
                    }
                    else {
                        showMainWindow();
                    }
                }
            );
        }
    )
    .catch(
        error => {
            log.error(
                "Ошибка запуска SkyNix:",
                error
            );

            dialog.showErrorBox(
                "SkyNix",
                "Ошибка запуска приложения:\n\n" +
                error.message
            );
        }
    );

// ============================================================
// WINDOWS CLOSE
// ============================================================

app.on(
    "window-all-closed",
    () => {
        if (
            process.platform ===
            "darwin"
        ) {
            app.quit();
        }
    }
);

// ============================================================
// BEFORE QUIT
// ============================================================

app.on(
    "before-quit",
    () => {
        isQuitting = true;
    }
);

// ============================================================
// ERROR HANDLERS
// ============================================================

process.on(
    "uncaughtException",
    error => {
        log.error(
            "UNCAUGHT EXCEPTION:",
            error
        );
    }
);

process.on(
    "unhandledRejection",
    error => {
        log.error(
            "UNHANDLED REJECTION:",
            error
        );
    }
);