const {
    app,
    BrowserWindow,
    dialog,
    ipcMain,
    shell,
    Tray,
    Menu,
    nativeImage,
    Notification,
    clipboard,
    screen
} = require("electron");

const {
    autoUpdater
} = require("electron-updater");

const log = require("electron-log");

const fs = require("fs");
const path = require("path");
const net = require("net");

const {
    spawn
} = require("child_process");

// ============================================================
// SKY NIX
// main.js
// Version 2.2.0
// ============================================================

// CONFIG
const APP_VERSION = "2.2.0";
const WORKER_URL = "https://discord.skynix.workers.dev";
const TELEGRAM_WORKER_URL = "https://skynix-moderation.skynix.workers.dev";
const DISCORD_LOGIN_URL = "https://discord.skynix.workers.dev/api/discord/login";
const WIKI_URL = "https://wiki.skynix.workers.dev";
const YOUTUBE_URL = "https://www.youtube.com/@SenyaMelnik_Games";
const APPLICATION_URL = "https://forms.gle/gtYFhD5UeHycSRAb8";
const APPLICATION_BOT_URL = "https://t.me/Applications_SkyNix_BOT";
const MINECRAFT_IP = "26.87.154.25";
const MINECRAFT_HOST = "play.skynix";

// Адрес туннеля playit.gg — приложение узнаёт его IP при настройке
const MINECRAFT_TUNNEL_HOST = "vivo-rewrite.tun.ply.gg";

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
let buildTrayMenu = null;
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
// SETTINGS (автозапуск, сворачивание в трей)
// ============================================================

function settingsPath() {
    return path.join(app.getPath("userData"), "settings.json");
}

const EN_TEXT = {
    "Открыть SkyNix": "Open SkyNix",
    "Выйти из SkyNix": "Quit SkyNix",
    "Вы были замучены": "You were muted",
    "С вас снят мут": "Your mute was lifted",
    "Вы были забанены": "You were banned",
    "Вы были разбанены": "You were unbanned",
    "Мут": "Mute",
    "Размут": "Unmute",
    "Бан": "Ban",
    "Разбан": "Unban",
    "Кем": "By",
    "Что именно": "Action",
    "Срок": "Duration",
    "Без срока": "Permanent",
    "Причина": "Reason",
    "Не указана": "Not specified",
    "Модератор": "Moderator",
    "Действие модерации": "Moderation action",
    "Новости · группа Telegram": "News · Telegram group",
    "Новости · группа Discord": "News · Discord group",
    "SkyNix Новобранцы": "SkyNix Recruits"
};

function currentLang() {
    try {
        return readSettings().lang === "en" ? "en" : "ru";
    } catch {
        return "ru";
    }
}

function L(text) {
    return currentLang() === "en" && EN_TEXT[text] ? EN_TEXT[text] : text;
}

function readSettings() {
    const defaults = { autostart: true, closeToTray: true, lang: "ru" };
    try {
        const raw = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
        return {
            autostart: raw.autostart !== false,
            closeToTray: raw.closeToTray !== false,
            lang: raw.lang === "en" ? "en" : "ru"
        };
    } catch {
        return defaults;
    }
}

function writeSettings(value) {
    try {
        fs.writeFileSync(settingsPath(), JSON.stringify(value));
    } catch (error) {
        log.warn("Не удалось сохранить настройки:", error && error.message);
    }
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
            openAtLogin: readSettings().autostart,
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

        buildTrayMenu = () => {
        const contextMenu =
            Menu.buildFromTemplate([
                {
                    label: L("Открыть SkyNix"),
                    click: () => {
                        showMainWindow();
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: L("Выйти из SkyNix"),
                    click: () => {
                        isQuitting = true;
                        app.quit();
                    }
                }
            ]);

        tray.setContextMenu(
            contextMenu
        );
        };
        buildTrayMenu();

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
            const tgResult = await telegramModeration(
                data
            );

            bumpDataVersion();

            return tgResult;
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
            width: 1180,
            height: 780,

            icon: path.join(
                __dirname,
                "assets",
                "icon.ico"
            ),

            minWidth: 900,
            minHeight: 640,
            resizable: true,
            backgroundColor: "#090914",
            autoHideMenuBar: true,

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

    // Увеличение интерфейса только при развёрнутом окне.
    function applyWindowState() {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        const max = mainWindow.isMaximized() || mainWindow.isFullScreen();
        let factor = 1;
        if (max) {
            const w = screen.getDisplayMatching(mainWindow.getBounds()).size.width;
            factor = w >= 2200 ? 1.3 : w >= 1700 ? 1.15 : 1;
        }
        try { mainWindow.webContents.setZoomFactor(factor); } catch {}
        mainWindow.webContents.send("window-state", { max });
    }

    ["maximize", "unmaximize", "enter-full-screen", "leave-full-screen"].forEach(name => {
        mainWindow.on(name, applyWindowState);
    });
    mainWindow.webContents.on("did-finish-load", applyWindowState);

    // Защита главного окна: только локальный index.html, всё остальное в браузер.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https:\/\//i.test(url)) shell.openExternal(url);
        return { action: "deny" };
    });

    mainWindow.webContents.on("will-navigate", (event, url) => {
        if (!url.startsWith("file://")) {
            event.preventDefault();
            if (/^https:\/\//i.test(url)) shell.openExternal(url);
        }
    });

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
            if (!isQuitting && readSettings().closeToTray) {
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

        let minecraftLine = "";

        try {
            const plan = await planMinecraft();

            clipboard.writeText(MINECRAFT_TUNNEL_HOST);

            if (!plan.ip) {
                return {
                    success: true,
                    hostsUpdated: false,
                    address: MINECRAFT_TUNNEL_HOST,
                    message: plan.note
                };
            }

            minecraftLine = plan.ip + " play.skynix";

            await new Promise(
                (
                    resolve,
                    reject
                ) => {
                    const ipOnly = minecraftLine.split(" ")[0];

                const psCommand =
                    "$path = '" + hostsPath + "'; " +
                    "$ip = '" + ipOnly + "'; " +
                    "$lines = @(Get-Content -LiteralPath $path); " +
                    "$has = @($lines | Where-Object { $_ -match ('^\\s*' + [regex]::Escape($ip) + '\\s+play\\.skynix\\s*$') }); " +
                    "if ($has.Count -eq 0) { " +
                    "$kept = @($lines | Where-Object { $_ -notmatch '^\\s*\\S+\\s+play\\.skynix\\s*$' }); " +
                    "$kept += ($ip + ' play.skynix'); " +
                    "[System.IO.File]::WriteAllLines($path, [string[]]$kept); " +
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

            // На случай, если play.skynix не откроется — адрес туннеля в буфере
            clipboard.writeText(MINECRAFT_TUNNEL_HOST);

            return {
                success:
                    true,
                hostsUpdated:
                    true,

                proxy:
                    Boolean(plan.proxy),

                local:
                    Boolean(plan.local),

                address:
                    MINECRAFT_TUNNEL_HOST,

                message:
                    plan.note ||
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
            L("Кем"),
            notice.moderator || L("Модератор")
        ],
        [
            L("Что именно"),
            L(NOTICE_ACTIONS[action] || action)
        ]
    ];

    if (action === "mute") {
        const duration =
            formatNoticeDuration(notice.duration);

        if (duration) {
            rows.push([L("Срок"), currentLang() === "en" ? duration.replace(/^(\d+) (секунд\S*)$/, "$1 s").replace(/^(\d+) (минут\S*)$/, "$1 min").replace(/^(\d+) (час\S*)$/, "$1 h").replace(/^(\d+) (д\S+)$/, "$1 d") : duration]);
        }
    }
    else if (action === "ban") {
        rows.push([L("Срок"), L("Без срока")]);
    }

    rows.push([
        L("Причина"),
        notice.reason || L("Не указана")
    ]);

    return {
        title:
            L(NOTICE_TITLES[action] ||
            "Действие модерации"),
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

let lastDataVersion = null;

function notifyDataChanged() {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isLoading()) {
        mainWindow.webContents.send("data-changed");
    }
}

async function bumpDataVersion() {
    if (!discordSession) return;
    try {
        await fetch(`${WORKER_URL}/api/discord/bump`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${getEncodedDiscordSession()}` },
            signal: AbortSignal.timeout(10000)
        });
    } catch {}
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

        // Данные в приложении обновляем только если на сервере что-то менялось
        if (typeof data.ver === "string") {
            if (lastDataVersion !== null && data.ver !== lastDataVersion) {
                notifyDataChanged();
            }
            lastDataVersion = data.ver;
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

    setTimeout(pollNews, 15000);

    setInterval(pollNews, NEWS_POLL_MS);

    setTimeout(pollShoots, 20000);

    setInterval(pollShoots, NEWS_POLL_MS);
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
        ).then(result => {
            bumpDataVersion();
            return result;
        });
    }
);

// Профили участников и списки Telegram (Мл.Модератор и выше)
async function discordApiGet(endpoint) {
    requireDiscordSession();

    const response = await fetch(
        `${WORKER_URL}${endpoint}`,
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
        data.success === false
    ) {
        throw new Error(
            (data && data.error) ||
            "Ошибка запроса."
        );
    }

    return data;
}

ipcMain.handle(
    "members-list",
    async () => (
        await discordApiGet("/api/discord/members")
    ).members
);

ipcMain.handle(
    "member-history",
    async (event, userId) => {
        const id = String(userId || "");

        if (!/^\d{5,25}$/.test(id)) {
            throw new Error("Некорректный ID.");
        }

        return discordApiGet(
            `/api/discord/user-history?userId=${id}`
        );
    }
);

ipcMain.handle(
    "member-warnings",
    (event, discordId) => {
        const id = String(discordId || "");

        if (!/^\d{5,25}$/.test(id)) {
            throw new Error("Некорректный ID.");
        }

        return telegramProfileRequest(
            `/api/profile/user-warnings?discordId=${id}`,
            "GET"
        );
    }
);

ipcMain.handle(
    "telegram-get-banned",
    async () => {
        const data = await telegramRequest(
            "/api/banned",
            { method: "GET" }
        );

        if (!Array.isArray(data.members)) {
            throw new Error("Telegram Worker не вернул чёрный список.");
        }

        return data.members;
    }
);

ipcMain.handle(
    "telegram-resolve",
    async (event, query) => (
        await telegramRequest(
            `/api/resolve?q=${encodeURIComponent(String(query || "").trim())}`,
            { method: "GET" }
        )
    ).id
);

// ============================================================
// APPLICATION WINDOW (форма заявки внутри приложения)
// ============================================================

let applicationWindow = null;

const APPLICATION_HOSTS = [
    "forms.gle",
    "docs.google.com",
    "accounts.google.com"
];

function isApplicationUrl(url) {
    try {
        const parsed = new URL(url);

        return (
            parsed.protocol === "https:" &&
            APPLICATION_HOSTS.includes(parsed.hostname)
        );
    }
    catch {
        return false;
    }
}

function openApplicationWindow(url) {
    if (!isApplicationUrl(url)) {
        throw new Error("Недопустимый адрес формы.");
    }

    if (
        applicationWindow &&
        !applicationWindow.isDestroyed()
    ) {
        if (applicationWindow.isMinimized()) {
            applicationWindow.restore();
        }

        applicationWindow.show();
        applicationWindow.focus();

        return;
    }

    applicationWindow = new BrowserWindow({
        width: 900,
        height: 800,
        minWidth: 600,
        minHeight: 500,
        title: "Заявка в команду SkyNix",
        icon: path.join(
            __dirname,
            "assets",
            "icon.ico"
        ),
        backgroundColor: "#ffffff",
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        }
    });

    applicationWindow.setMenuBarVisibility(false);

    // Ссылки вне формы открываем в браузере
    applicationWindow.webContents.setWindowOpenHandler(
        ({ url: target }) => {
            if (isApplicationUrl(target)) {
                applicationWindow.loadURL(target);
            }
            else if (/^https?:\/\//i.test(target)) {
                shell.openExternal(target);
            }

            return {
                action: "deny"
            };
        }
    );

    applicationWindow.webContents.on(
        "will-navigate",
        (event, target) => {
            if (
                !isApplicationUrl(target) &&
                !target.startsWith("data:")
            ) {
                event.preventDefault();

                if (/^https?:\/\//i.test(target)) {
                    shell.openExternal(target);
                }
            }
        }
    );

    applicationWindow.webContents.on(
        "did-fail-load",
        (
            event,
            errorCode,
            errorDescription,
            validatedURL,
            isMainFrame
        ) => {
            if (!isMainFrame || errorCode === -3) return;

            log.error(
                "Форма заявки не загрузилась:",
                errorDescription
            );

            const html =
                "<body style='background:#090914;color:#fff;" +
                "font-family:sans-serif;display:flex;" +
                "align-items:center;justify-content:center;" +
                "height:100vh;margin:0;text-align:center'>" +
                "<div><h2>Не удалось загрузить форму</h2>" +
                "<p>Проверьте подключение к интернету и " +
                "откройте форму ещё раз.</p></div></body>";

            applicationWindow.loadURL(
                "data:text/html;charset=utf-8," +
                encodeURIComponent(html)
            );
        }
    );

    applicationWindow.loadURL(url);

    applicationWindow.on(
        "closed",
        () => {
            applicationWindow = null;
        }
    );
}

ipcMain.handle(
    "open-application",
    (event, url) => {
        openApplicationWindow(String(url || ""));

        return true;
    }
);

// ============================================================
// MINECRAFT: IP туннеля и ник игрока
// ============================================================

// ------------------------------------------------------------
// Короткий адрес play.skynix без платных функций playit:
// приложение слушает 127.0.0.1:25565 и перенаправляет подключения
// на туннель (порт берётся из SRV-записи), а в hosts
// прописывается play.skynix -> 127.0.0.1.
// ------------------------------------------------------------

const MINECRAFT_LOCAL_PORT = 25565;

let minecraftProxy = null;

let tunnelTargetCache = { at: 0, value: null };

async function getTunnelTarget() {
    if (
        tunnelTargetCache.value &&
        Date.now() - tunnelTargetCache.at < 60 * 1000
    ) {
        return tunnelTargetCache.value;
    }

    let value = {
        host: MINECRAFT_TUNNEL_HOST,
        port: 25565
    };

    try {
        const records =
            await require("dns").promises.resolveSrv(
                "_minecraft._tcp." + MINECRAFT_TUNNEL_HOST
            );

        if (records && records.length) {
            value = {
                host: records[0].name,
                port: Number(records[0].port)
            };
        }
    }
    catch (error) {
        // Нет SRV — используем обычный адрес и порт 25565
    }

    tunnelTargetCache = {
        at: Date.now(),
        value
    };

    return value;
}

function startMinecraftProxy() {
    if (minecraftProxy) {
        return Promise.resolve({ ok: true });
    }

    return new Promise(resolve => {
        const server = net.createServer(client => {
            getTunnelTarget()
                .then(target => {
                    const upstream =
                        net.createConnection({
                            host: target.host,
                            port: target.port
                        });

                    const close = () => {
                        client.destroy();
                        upstream.destroy();
                    };

                    client.on("error", close);
                    upstream.on("error", close);
                    client.on("close", close);
                    upstream.on("close", close);

                    client.pipe(upstream);
                    upstream.pipe(client);
                })
                .catch(() => client.destroy());
        });

        let started = false;

        server.on("error", error => {
            if (!started) {
                resolve({
                    ok: false,
                    reason:
                        (
                            error.code === "EADDRINUSE" ||
                            error.code === "EACCES"
                        )
                            ? "busy"
                            : "error",
                    code: error.code
                });

                return;
            }

            log.warn(
                "Minecraft proxy error:",
                error && error.message
            );

            minecraftProxy = null;
        });

        server.listen(
            MINECRAFT_LOCAL_PORT,
            "127.0.0.1",
            () => {
                started = true;
                minecraftProxy = server;

                resolve({ ok: true });
            }
        );
    });
}

function minecraftProxyFlagPath() {
    return path.join(
        app.getPath("userData"),
        "minecraft-proxy.json"
    );
}

function saveMinecraftProxyFlag(enabled) {
    try {
        fs.writeFileSync(
            minecraftProxyFlagPath(),
            JSON.stringify({ enabled })
        );
    }
    catch (error) {
        log.warn("Minecraft flag:", error && error.message);
    }
}

// После первой настройки переход запускается вместе с приложением
function startMinecraftProxyIfEnabled() {
    try {
        const flag = JSON.parse(
            fs.readFileSync(minecraftProxyFlagPath(), "utf8")
        );

        if (flag && flag.enabled) {
            startMinecraftProxy();
        }
    }
    catch (error) {
        // Настройка ещё не выполнялась
    }
}

async function planMinecraft() {
    const started = await startMinecraftProxy();

    if (started.ok) {
        saveMinecraftProxyFlag(true);

        return {
            ip: "127.0.0.1",
            proxy: true
        };
    }

    // Порт 25565 уже занят: на компьютере с сервером это нормально —
    // play.skynix -> 127.0.0.1 ведёт прямо на локальный сервер.
    if (started.reason === "busy") {
        return {
            ip: "127.0.0.1",
            proxy: false,
            local: true,
            note:
                "На этом компьютере порт 25565 занят (скорее всего, здесь запущен сервер SkyNix). " +
                "play.skynix теперь ведёт на локальный сервер."
        };
    }

    return {
        ip: null,
        note:
            "Не удалось запустить локальный переход (код ошибки: " +
            (started.code || "неизвестно") +
            "). Заходите по адресу туннеля."
    };
}

async function discordApiPost(endpoint, body) {
    requireDiscordSession();

    const response = await fetch(
        `${WORKER_URL}${endpoint}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization":
                    `Bearer ${getEncodedDiscordSession()}`
            },
            body: JSON.stringify(body),
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
        data.success === false
    ) {
        throw new Error(
            (data && data.error) ||
            "Ошибка запроса."
        );
    }

    return data;
}

ipcMain.handle(
    "minecraft-nick-get",
    async () => (
        await discordApiGet("/api/discord/minecraft-nick")
    ).nick
);

ipcMain.handle(
    "minecraft-nick-set",
    async (event, nick) => (
        await discordApiPost(
            "/api/discord/minecraft-nick",
            { nick: String(nick || "") }
        )
    ).nick
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

            startMinecraftProxyIfEnabled();

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

// ---------------- Статус Minecraft-сервера (Server List Ping) ----------------

function mcVarInt(n) {
    const out = [];
    do {
        let b = n & 0x7f;
        n >>>= 7;
        if (n) b |= 0x80;
        out.push(b);
    } while (n);
    return Buffer.from(out);
}

function mcString(s) {
    const b = Buffer.from(s, "utf8");
    return Buffer.concat([mcVarInt(b.length), b]);
}

function mcMotdText(d) {
    if (!d) return "";
    if (typeof d === "string") return d.replace(/§./g, "");
    let t = (d.text || "").replace(/§./g, "");
    if (Array.isArray(d.extra)) t += d.extra.map(mcMotdText).join("");
    return t;
}

function pingMinecraftOnce(host, port) {
    return new Promise(resolve => {
        const started = Date.now();
        let finished = false;
        let buf = Buffer.alloc(0);

        const done = value => {
            if (finished) return;
            finished = true;
            try { socket.destroy(); } catch {}
            resolve(value);
        };

        const socket = net.connect({ host, port });
        socket.setTimeout(4500, () => done({ error: "timeout" }));
        socket.on("error", err => done({ error: (err && err.code) || "error" }));

        socket.on("connect", () => {
            const hs = Buffer.concat([
                mcVarInt(0x00),
                mcVarInt(765),
                mcString(host),
                Buffer.from([(port >> 8) & 0xff, port & 0xff]),
                mcVarInt(1)
            ]);
            socket.write(Buffer.concat([mcVarInt(hs.length), hs]));
            socket.write(Buffer.from([0x01, 0x00]));
        });

        socket.on("data", chunk => {
            buf = Buffer.concat([buf, chunk]);
            try {
                let pos = 0;
                const readVar = () => {
                    let num = 0, shift = 0, b;
                    do {
                        if (pos >= buf.length) throw new Error("more");
                        b = buf[pos++];
                        num |= (b & 0x7f) << shift;
                        shift += 7;
                    } while (b & 0x80);
                    return num;
                };
                const total = readVar();
                if (buf.length - pos < total) return;
                readVar();
                const jsonLen = readVar();
                if (buf.length - pos < jsonLen) return;
                const data = JSON.parse(buf.slice(pos, pos + jsonLen).toString("utf8"));
                done({
                    online: true,
                    ping: Date.now() - started,
                    version: data.version && data.version.name || "",
                    players: {
                        online: data.players && data.players.online || 0,
                        max: data.players && data.players.max || 0,
                        sample: (data.players && data.players.sample || []).map(p => p.name).slice(0, 12)
                    },
                    motd: mcMotdText(data.description).trim()
                });
            } catch (error) {
                // ждём остаток пакета
            }
        });
    });
}

let minecraftStatusCache = { at: 0, value: null };

ipcMain.handle("minecraft-status", async () => {
    if (minecraftStatusCache.value && Date.now() - minecraftStatusCache.at < 15 * 1000) {
        return minecraftStatusCache.value;
    }

    let value = { online: false, error: "unknown" };

    try {
        const target = await getTunnelTarget();
        const tried = [target.host + ":" + target.port];
        let result = await pingMinecraftOnce(target.host, target.port);

        // Запасной путь: сервер на этом же компьютере
        if (!result || !result.online) {
            const local = await pingMinecraftOnce("127.0.0.1", 25565);
            tried.push("127.0.0.1:25565");
            if (local && local.online) result = local;
        }

        value = result && result.online
            ? result
            : { online: false, error: (result && result.error) || "unknown", tried };
    } catch (error) {
        value = { online: false, error: String(error && error.message || error) };
    }

    minecraftStatusCache = { at: Date.now(), value };
    return value;
});
ipcMain.handle("settings-get", () => readSettings());

ipcMain.handle("settings-set", (event, patch) => {
    const next = Object.assign(readSettings(), {
        autostart: patch && typeof patch.autostart === "boolean" ? patch.autostart : undefined,
        closeToTray: patch && typeof patch.closeToTray === "boolean" ? patch.closeToTray : undefined,
        lang: patch && (patch.lang === "en" || patch.lang === "ru") ? patch.lang : undefined
    });
    const current = readSettings();
    const merged = {
        autostart: next.autostart === undefined ? current.autostart : next.autostart,
        closeToTray: next.closeToTray === undefined ? current.closeToTray : next.closeToTray,
        lang: next.lang === undefined ? current.lang : next.lang
    };
    writeSettings(merged);
    if (merged.lang !== current.lang && tray && buildTrayMenu) {
        try { buildTrayMenu(); } catch {}
    }
    if (process.platform === "win32") {
        try {
            app.setLoginItemSettings({
                openAtLogin: merged.autostart,
                openAsHidden: true,
                args: ["--autostart"]
            });
        } catch {}
    }
    return merged;
});

// Журнал действий модераторов (Discord + Telegram) и ответы по заявкам
ipcMain.handle("modlog-get", async () => {
    requireDiscordSession();

    const [discord, telegram] = await Promise.allSettled([
        discordApiGet("/api/discord/modlog"),
        telegramProfileRequest("/api/profile/modlog", "GET")
    ]);

    const items = [];
    const errors = [];

    if (discord.status === "fulfilled") {
        items.push(...(discord.value.items || []));
    } else {
        errors.push("Discord: " + (discord.reason && discord.reason.message || "ошибка"));
    }

    if (telegram.status === "fulfilled") {
        items.push(...(telegram.value.items || []));
    } else {
        errors.push("Telegram: " + (telegram.reason && telegram.reason.message || "ошибка"));
    }

    items.sort((a, b) => (b.at || 0) - (a.at || 0));

    return { items, errors };
});

async function fetchNewsItems() {
    requireDiscordSession();

    const [discord, telegram] = await Promise.allSettled([
        discordApiGet("/api/discord/news"),
        telegramProfileRequest("/api/profile/news", "GET")
    ]);

    const items = [];

    if (discord.status === "fulfilled") items.push(...(discord.value.items || []));
    if (telegram.status === "fulfilled") items.push(...(telegram.value.items || []));

    items.sort((x, y) => (y.at || 0) - (x.at || 0));

    return items.slice(0, 40);
}

ipcMain.handle("news-get", async () => ({ items: await fetchNewsItems() }));

// ---- Съёмки и «Написать в новости» ----
function tgPost(endpoint, payload) {
    requireDiscordSession();

    return telegramRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(payload || {})
    });
}

ipcMain.handle("shoot-people", () => telegramProfileRequest("/api/profile/shoot-people", "GET"));
ipcMain.handle("shoots-get", () => telegramProfileRequest("/api/profile/shoots", "GET"));
ipcMain.handle("shoot-submit", (event, data) => tgPost("/api/profile/shoot-submit", data));
ipcMain.handle("shoot-decide", (event, data) => tgPost("/api/profile/shoot-decide", data));
ipcMain.handle("shoot-publish", (event, data) => tgPost("/api/profile/shoot-publish", data));

ipcMain.handle("news-post", async (event, data) => {
    requireDiscordSession();

    const text = String((data && data.text) || "").trim();
    const targets = Array.isArray(data && data.targets) ? data.targets : [];

    if (!text) throw new Error("Напишите текст сообщения.");
    if (!targets.length) throw new Error("Выберите, куда отправить.");

    const tgTargets = targets.filter(x => x === "main" || x === "recruits");
    const report = [];

    if (targets.includes("discord")) {
        try {
            await discordApiPost("/api/discord/news-post", { text });
            report.push({ target: "discord", ok: true });
        } catch (error) {
            report.push({ target: "discord", ok: false, error: String(error && error.message || error) });
        }
    }

    if (tgTargets.length) {
        try {
            const res = await tgPost("/api/profile/news-post", { text, targets: tgTargets });
            for (const r of res.results || []) report.push(r);
        } catch (error) {
            for (const target of tgTargets) {
                report.push({ target, ok: false, error: String(error && error.message || error) });
            }
        }
    }

    return { ok: report.some(r => r.ok), results: report };
});

// Пуши о съёмках: Архону — новая заявка; автору — одобрено/отклонено
function shootsSeenPath() {
    return path.join(USER_DATA, "shoots-seen.json");
}

function showShootToast(title, body) {
    try {
        if (!Notification.isSupported()) return;

        const options = { title: "SkyNix — " + L(title), body: String(body || "").slice(0, 220) };
        const iconPath = path.join(__dirname, "assets", "icon.ico");
        if (fs.existsSync(iconPath)) options.icon = iconPath;

        const toast = new Notification(options);

        toast.on("click", () => {
            showMainWindow();
            try {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send("open-notifications");
                }
            } catch {}
        });

        toast.show();
    } catch {}
}

let lastShootSig = null;

async function pollShoots() {
    if (!discordSession || discordLogoutRequested) return;

    try {
        const data = await telegramProfileRequest("/api/profile/shoots", "GET");

        let seen = null;

        try {
            seen = JSON.parse(fs.readFileSync(shootsSeenPath(), "utf8"));
        } catch {
            seen = null;
        }

        const known = new Set(seen && Array.isArray(seen.keys) ? seen.keys : []);
        const fresh = Date.now() - (seen ? 24 * 60 * 60 * 1000 : 10 * 60 * 1000);
        const keys = [];

        for (const r of data.pending || []) {
            const key = "p:" + r.id;
            keys.push(key);
            if (!known.has(key) && (r.at || 0) > fresh) {
                showShootToast("Заявка на съёмки", r.by + ": " + r.title);
            }
        }

        for (const r of data.reports || []) {
            const key = "r:" + r.id;
            keys.push(key);
            if (!known.has(key) && (r.at || 0) > fresh) {
                showShootToast("Опрос закрыт", r.missing.length ? ("Не ответили: " + r.missing.length + " — " + r.title) : (r.title + ": проголосовали все"));
            }
        }

        for (const r of data.mine || []) {
            if (r.status === "pending") continue;
            const key = "m:" + r.id + ":" + r.status;
            keys.push(key);
            if (!known.has(key) && (r.decidedAt || r.at || 0) > fresh) {
                showShootToast(
                    r.status === "sent" ? "Съёмки одобрены" : "Съёмки отклонены",
                    r.status === "sent" ? r.title : (L("Причина: ") + r.reason)
                );
            }
        }

        try {
            fs.writeFileSync(shootsSeenPath(), JSON.stringify({ keys: [...new Set([...keys, ...known])].slice(0, 200) }));
        } catch {}

        const sig = JSON.stringify([(data.pending || []).map(r => r.id), (data.mine || []).map(r => [r.id, r.status])]);

        if (sig !== lastShootSig) {
            lastShootSig = sig;
            if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isLoading()) {
                mainWindow.webContents.send("shoots-changed", data);
            }
        }
    } catch {
        // не участник или воркер недоступен — тихо
    }
}

// ---- Новости: уведомления приложения и обновление окна ----
const NEWS_POLL_MS = 2 * 60 * 1000;
let lastNewsSig = null;

function newsSeenPath() {
    return path.join(USER_DATA, "news-seen.json");
}

function readNewsSeen() {
    try {
        const raw = JSON.parse(fs.readFileSync(newsSeenPath(), "utf8"));
        return Array.isArray(raw.ids) ? raw : null;
    } catch {
        return null;
    }
}

function showNewsToast(item) {
    try {
        if (!Notification.isSupported()) return;

        const title = item.platform === "telegram"
            ? L("Новости · группа Telegram")
            : L("Новости · группа Discord");

        const options = {
            title: "SkyNix — " + title + (item.platform === "telegram" && item.group ? " (" + L(item.group) + ")" : ""),
            body: String(item.text || "").slice(0, 220)
        };

        const iconPath = path.join(__dirname, "assets", "icon.ico");
        if (fs.existsSync(iconPath)) options.icon = iconPath;

        const toast = new Notification(options);

        toast.on("click", () => {
            showMainWindow();
            try {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send("open-notifications");
                }
            } catch {}
        });

        toast.show();
    } catch (error) {
        log.warn("Не удалось показать уведомление о новости:", error && error.message);
    }
}

async function pollNews() {
    if (!discordSession || discordLogoutRequested) return;

    try {
        const items = await fetchNewsItems();

        const seen = readNewsSeen();
        const seenIds = new Set(seen ? seen.ids : []);

        // Первый запуск: старые новости (старше 10 минут) только запоминаем,
        // свежие показываем. Дальше показываем всё, чего ещё не было (не старше суток).
        const freshAfter = Date.now() - (seen ? 24 * 60 * 60 * 1000 : 10 * 60 * 1000);

        for (const item of items.slice().reverse()) {
            if (!seenIds.has(item.id) && (item.at || 0) > freshAfter) {
                log.info("Новость: показываю уведомление", item.id);
                showNewsToast(item);
            }
        }

        const ids = [...new Set([...items.map(i => i.id), ...seenIds])].slice(0, 200);

        try {
            fs.writeFileSync(newsSeenPath(), JSON.stringify({ ids }));
        } catch {}

        const sig = JSON.stringify(items.map(i => [i.id, i.text]));

        if (sig !== lastNewsSig) {
            lastNewsSig = sig;

            if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isLoading()) {
                mainWindow.webContents.send("news-changed", items);
            }
        }
    } catch (error) {
        log.warn("Проверка новостей не удалась:", error && error.message);
    }
}

ipcMain.handle("application-replies-get", async () => {
    try {
        const data = await telegramProfileRequest("/api/profile/application-replies", "GET");
        return { items: data.items || [] };
    } catch (error) {
        return { items: [], error: String(error && error.message || error) };
    }
});
