// ======================================================
// SkyNix Mobile Bridge
// ------------------------------------------------------
// На ПК интерфейс общается с main.js через ipcRenderer.
// На телефоне main.js нет, поэтому этот файл отвечает на
// ТЕ ЖЕ каналы сам: ходит к воркерам и открывает ссылки.
// Сам index.html — общий для ПК и телефона.
// ======================================================

(function () {

    "use strict";

    const WORKER_URL = "https://discord.skynix.workers.dev";
    const TELEGRAM_WORKER_URL = "https://skynix-moderation.skynix.workers.dev";
    const WIKI_URL = "https://wiki.skynix.workers.dev";
    const GITHUB_REPO = "SenyaMelnik/SkyNix";

    const SESSION_KEY = "skynix_discord_session";   // тот же ключ, что в index.html
    const NOTICE_POLL_MS = 120 * 1000;
    const UPDATE_CHECK_MS = 6 * 60 * 60 * 1000;

    const handlers = {};
    const shownNoticeIds = new Set();

    let logoutRequested = false;
    let appVersion = null;


    // ---------------- платформа ----------------

    function plugins() {

        return (
            window.Capacitor &&
            window.Capacitor.Plugins
        ) || {};

    }

    function emit(channel, payload) {

        for (const listener of (handlers[channel] || [])) {

            try {
                listener({}, payload);
            }
            catch (error) {
                console.error("Bridge listener:", error);
            }

        }

    }

    async function openUrl(url) {

        try {

            const { Browser } = plugins();

            if (Browser && /^https?:/i.test(url)) {
                await Browser.open({ url });
                return;
            }

        }
        catch (error) {
            console.error("Browser.open:", error);
        }

        window.open(url, "_system");

    }


    // ---------------- сессия ----------------

    function getSession() {

        try {

            return JSON.parse(
                localStorage.getItem(SESSION_KEY) || "null"
            );

        }
        catch {

            return null;

        }

    }

    function toBase64(text) {

        const bytes = new TextEncoder().encode(text);

        let binary = "";

        for (const byte of bytes) {
            binary += String.fromCharCode(byte);
        }

        return btoa(binary);

    }

    function fromBase64(value) {

        const binary = atob(value);

        const bytes = Uint8Array.from(
            binary,
            char => char.charCodeAt(0)
        );

        return new TextDecoder("utf-8").decode(bytes);

    }

    function encodedSession() {

        const session = getSession();

        if (!session) {
            throw new Error("Не выполнен вход через Discord.");
        }

        return toBase64(JSON.stringify(session));

    }


    // ---------------- запросы к воркерам ----------------

    async function readJson(response) {

        try {
            return await response.json();
        }
        catch {
            return null;
        }

    }

    async function discordRequest(endpoint, options) {

        const response = await fetch(
            WORKER_URL + endpoint,
            {
                ...options,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + encodedSession()
                }
            }
        );

        const data = await readJson(response);

        if (!response.ok || !data || data.success === false) {

            throw new Error(
                (data && data.error) ||
                "Ошибка запроса (" + response.status + ")."
            );

        }

        return data;

    }

    async function telegramRequest(endpoint, options) {

        const response = await fetch(
            TELEGRAM_WORKER_URL + endpoint,
            {
                ...options,
                headers: {
                    "Content-Type": "application/json",
                    "X-Discord-Session": encodedSession()
                }
            }
        );

        const data = await readJson(response);

        if (!response.ok || !data || data.ok === false) {

            throw new Error(
                (data && data.error) ||
                "Ошибка запроса (" + response.status + ")."
            );

        }

        return data;

    }


    // ---------------- вход через Discord ----------------

    function handleDeepLink(url) {

        try {

            if (!url || !/^skynix:/i.test(url)) return;

            if (logoutRequested) return;

            const session =
                new URL(url).searchParams.get("session");

            if (!session) return;

            // Проверяем, что это корректная сессия
            const parsed = JSON.parse(fromBase64(session));

            if (!parsed || !parsed.userId) return;

            emit("discord-session", session);

            const { Browser } = plugins();

            if (Browser && Browser.close) {
                Browser.close().catch(() => {});
            }

        }
        catch (error) {

            console.error("Deep link:", error);

        }

    }


    // ---------------- модерация ----------------

    function discordDuration(durationMs) {

        const second = 1000;
        const minute = 60 * second;
        const hour = 60 * minute;
        const day = 24 * hour;

        if (durationMs % day === 0) return (durationMs / day) + "d";
        if (durationMs % hour === 0) return (durationMs / hour) + "h";
        if (durationMs % minute === 0) return (durationMs / minute) + "m";

        return Math.round(durationMs / second) + "s";

    }

    async function discordModeration(data) {

        const { action, userId, duration, reason } = data || {};

        if (!getSession()) {
            throw new Error("Discord не авторизован.");
        }

        if (!userId) {
            throw new Error("Не выбран пользователь Discord.");
        }

        if (!action) {
            throw new Error("Не указано действие.");
        }

        if (!reason || !String(reason).trim()) {
            throw new Error("Не указана причина.");
        }

        let value = null;

        if (action === "mute") {

            const ms = Number(duration);

            if (
                duration === undefined ||
                duration === null ||
                duration === "" ||
                !Number.isFinite(ms) ||
                ms <= 0
            ) {
                throw new Error("Укажите конкретное время мута.");
            }

            value = discordDuration(ms);

        }

        return discordRequest(
            "/api/discord/moderation",
            {
                method: "POST",
                body: JSON.stringify({
                    action,
                    targetId: String(userId),
                    duration: value,
                    reason: String(reason).trim()
                })
            }
        );

    }

    function parseDurationMs(value) {

        if (typeof value === "number") return value;

        const match =
            String(value || "").trim().match(/^(\d+)\s*(s|m|h|d)$/i);

        if (!match) return Number(value);

        const amount = Number(match[1]);

        const unit = match[2].toLowerCase();

        const multiplier = {
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000
        }[unit];

        return amount * multiplier;

    }

    async function telegramModeration(data) {

        if (!data || typeof data !== "object") {
            throw new Error("Некорректные данные модерации Telegram.");
        }

        const action = String(data.action || "").trim();

        if (!action) {
            throw new Error("Не указано действие модерации Telegram.");
        }

        let telegramUserId =
            data.telegram_user_id ??
            data.telegramUserId ??
            data.user_id ??
            data.id;

        if (telegramUserId && typeof telegramUserId === "object") {

            telegramUserId =
                telegramUserId.id ??
                telegramUserId.user_id ??
                telegramUserId.telegram_user_id ??
                null;

        }

        const userId = Number(telegramUserId);

        if (!Number.isFinite(userId) || userId <= 0) {
            throw new Error("Не выбран пользователь Telegram.");
        }

        const reason = String(data.reason || "").trim();

        if (!reason) {
            throw new Error("Укажите причину.");
        }

        const body = {
            action,
            telegram_user_id: userId,
            reason,
            moderator: data.moderator || "SkyNix"
        };

        if (action === "mute") {

            const ms = parseDurationMs(
                data.duration_ms ?? data.duration ?? null
            );

            if (!Number.isFinite(ms) || ms <= 0) {
                throw new Error("Укажите конкретное время мута.");
            }

            body.duration_ms = ms;

        }

        return telegramRequest(
            "/api/moderation",
            {
                method: "POST",
                body: JSON.stringify(body)
            }
        );

    }


    // ---------------- уведомления о модерации ----------------

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

    function pluralRu(n, forms) {

        const n10 = n % 10;
        const n100 = n % 100;

        if (n10 === 1 && n100 !== 11) return forms[0];

        if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) {
            return forms[1];
        }

        return forms[2];

    }

    function formatNoticeDuration(raw) {

        const match = String(raw || "").match(/^(\d+)(s|m|h|d)$/i);

        if (!match) return null;

        const value = Number(match[1]);

        const words = {
            s: ["секунда", "секунды", "секунд"],
            m: ["минута", "минуты", "минут"],
            h: ["час", "часа", "часов"],
            d: ["день", "дня", "дней"]
        };

        return value + " " + pluralRu(value, words[match[2].toLowerCase()]);

    }

    function buildNoticeView(notice) {

        const action = String(notice.action || "");

        const rows = [
            ["Кем", notice.moderator || "Модератор"],
            ["Что именно", NOTICE_ACTIONS[action] || action]
        ];

        if (action === "mute") {

            const duration = formatNoticeDuration(notice.duration);

            if (duration) rows.push(["Срок", duration]);

        }
        else if (action === "ban") {

            rows.push(["Срок", "Без срока"]);

        }

        rows.push(["Причина", notice.reason || "Не указана"]);

        return {
            title: NOTICE_TITLES[action] || "Действие модерации",
            rows
        };

    }

    async function showLocalNotification(view) {

        try {

            const { LocalNotifications } = plugins();

            if (!LocalNotifications) return;

            await LocalNotifications.schedule({
                notifications: [
                    {
                        id: Math.floor(Math.random() * 2147483000),
                        title: "SkyNix — " + view.title,
                        body: view.body !== undefined
                            ? view.body
                            : view.rows
                                .map(row => row[0] + ": " + row[1])
                                .join("\n")
                    }
                ]
            });

        }
        catch (error) {

            console.error("LocalNotifications:", error);

        }

    }

    // ---------------- новости (уведомления и обновление окна) ----------------

    const NEWS_POLL_MS = 2 * 60 * 1000;
    const NEWS_SEEN_KEY = "skynix_news_seen";
    let lastNewsSig = null;

    async function pollNews() {

        if (!getSession() || logoutRequested) return;

        try {

            const data = await commands["news-get"]();

            const items = data.items || [];

            let seen = null;

            try {
                seen = JSON.parse(localStorage.getItem(NEWS_SEEN_KEY) || "null");
            } catch {
                seen = null;
            }

            const seenIds = new Set(seen && Array.isArray(seen.ids) ? seen.ids : []);

            // Первый запуск: старые (старше 10 минут) только запоминаем
            {

                const freshAfter = Date.now() - (seen ? 24 * 3600 * 1000 : 10 * 60 * 1000);

                for (const item of items.slice().reverse()) {

                    if (seenIds.has(item.id) || (item.at || 0) <= freshAfter) continue;

                    showLocalNotification({
                        title: item.platform === "telegram"
                            ? "Новости · группа Telegram" + (item.group ? " (" + item.group + ")" : "")
                            : "Новости · группа Discord",
                        body: String(item.text || "").slice(0, 220)
                    });

                }

            }

            try {
                localStorage.setItem(
                    NEWS_SEEN_KEY,
                    JSON.stringify({ ids: [...new Set([...items.map(i => i.id), ...seenIds])].slice(0, 200) })
                );
            } catch {}

            const sig = JSON.stringify(items.map(i => [i.id, i.text]));

            if (sig !== lastNewsSig) {
                lastNewsSig = sig;
                emit("news-changed", items);
            }

        }
        catch (error) {

            // нет сети — попробуем позже

        }

    }

    async function pollNotices() {

        if (!getSession() || logoutRequested) return;

        if (
            typeof document !== "undefined" &&
            document.visibilityState === "hidden"
        ) {
            return;
        }

        try {

            const data = await discordRequest(
                "/api/discord/notifications",
                { method: "GET" }
            );

            for (const notice of (data.notifications || [])) {

                if (!notice || !notice.id) continue;

                const id = String(notice.id);

                const view = buildNoticeView(notice);

                if (!shownNoticeIds.has(id)) {

                    shownNoticeIds.add(id);

                    showLocalNotification(view);

                }

                emit("moderation-notice", { id, view });

            }

        }
        catch (error) {

            // Нет сети или сессия устарела — попробуем позже

        }

    }


    // ---------------- обновление приложения (GitHub) ----------------

    function isNewer(remote, local) {

        const a = String(remote).replace(/^v/, "").split(".").map(Number);
        const b = String(local).replace(/^v/, "").split(".").map(Number);

        for (let i = 0; i < 3; i++) {

            const x = a[i] || 0;
            const y = b[i] || 0;

            if (x > y) return true;
            if (x < y) return false;

        }

        return false;

    }

    function showUpdateDialog(version, apkUrl) {

        if (typeof document === "undefined") return;

        const overlay = document.createElement("div");

        overlay.style.cssText =
            "position:fixed;inset:0;background:rgba(0,0,0,.7);" +
            "display:flex;align-items:center;justify-content:center;" +
            "z-index:2147483647;padding:16px;";

        const card = document.createElement("div");

        card.style.cssText =
            "width:100%;max-width:380px;background:#12102b;color:#fff;" +
            "border:1px solid #7c5cff;border-radius:16px;padding:22px;" +
            "font-family:sans-serif;";

        const title = document.createElement("div");

        title.style.cssText = "font-size:20px;font-weight:700;margin-bottom:10px;";
        title.textContent = "Доступно обновление " + version;

        const text = document.createElement("div");

        text.style.cssText = "color:#a9a3d6;font-size:14px;line-height:1.4;";
        text.textContent =
            "Нажмите «Скачать», дождитесь загрузки файла и откройте его " +
            "для установки. Данные приложения сохранятся.";

        const row = document.createElement("div");

        row.style.cssText = "display:flex;gap:10px;margin-top:16px;";

        function button(label, background, onClick) {

            const node = document.createElement("button");

            node.textContent = label;

            node.style.cssText =
                "flex:1;padding:12px;border:none;border-radius:12px;" +
                "font-size:15px;font-weight:600;color:#fff;" +
                "background:" + background + ";";

            node.onclick = onClick;

            return node;

        }

        row.appendChild(
            button("Скачать", "#6d4aff", () => {
                openUrl(apkUrl);
                overlay.remove();
            })
        );

        row.appendChild(
            button("Позже", "#3a3763", () => overlay.remove())
        );

        card.appendChild(title);
        card.appendChild(text);
        card.appendChild(row);

        overlay.appendChild(card);

        document.body.appendChild(overlay);

    }

    async function checkForUpdate() {

        try {

            if (!appVersion) return;

            const response = await fetch(
                "https://api.github.com/repos/" + GITHUB_REPO + "/releases/latest",
                {
                    headers: {
                        "Accept": "application/vnd.github+json"
                    }
                }
            );

            if (!response.ok) return;

            const release = await response.json();

            const apk = (release.assets || []).find(
                asset => /\.apk$/i.test(asset.name)
            );

            if (
                !apk ||
                !isNewer(release.tag_name, appVersion)
            ) {
                return;
            }

            showUpdateDialog(
                String(release.tag_name).replace(/^v/, ""),
                apk.browser_download_url
            );

        }
        catch (error) {

            // Нет сети — проверим в следующий раз

        }

    }


    // ---------------- каналы (как в main.js) ----------------

    const commands = {

        "discord-login": async () => {

            logoutRequested = false;

            await openUrl(WORKER_URL + "/api/discord/login");

            return true;

        },

        "discord-logout": async () => {

            logoutRequested = true;

            try {
                localStorage.removeItem(SESSION_KEY);
            }
            catch {
                // Игнорируем
            }

            emit("discord-logout");

            return true;

        },

        "discord-session": async () => getSession(),

        "app-version": async () => appVersion,

        "open-wiki": async () => {

            await openUrl(WIKI_URL);

            return true;

        },

        "minecraft-nick-get": async () =>
            (await discordRequest("/api/discord/minecraft-nick", { method: "GET" })).nick,

        "minecraft-nick-set": async nick =>
            (
                await discordRequest(
                    "/api/discord/minecraft-nick",
                    {
                        method: "POST",
                        body: JSON.stringify({ nick: String(nick || "") })
                    }
                )
            ).nick,

        "open-application": async url => {

            await openUrl(String(url || ""));

            return true;

        },

        "discord-moderation": data => discordModeration(data),

        "telegram-get-members": async () => {

            const data = await telegramRequest(
                "/api/members",
                { method: "GET" }
            );

            if (!Array.isArray(data.members)) {
                throw new Error("Telegram Worker не вернул список участников.");
            }

            return data.members;

        },

        "telegram-moderation": data => telegramModeration(data),

        "profile-get": async () => {

            const data = await discordRequest(
                "/api/discord/profile",
                { method: "GET" }
            );

            return data.profile;

        },

        "modlog-get": async () => {

            const [discord, telegram] = await Promise.allSettled([
                discordRequest("/api/discord/modlog", { method: "GET" }),
                telegramRequest("/api/profile/modlog", { method: "GET" })
            ]);

            const items = [];
            const errors = [];

            if (discord.status === "fulfilled") items.push(...(discord.value.items || []));
            else errors.push("Discord: " + (discord.reason && discord.reason.message || "ошибка"));

            if (telegram.status === "fulfilled") items.push(...(telegram.value.items || []));
            else errors.push("Telegram: " + (telegram.reason && telegram.reason.message || "ошибка"));

            items.sort((x, y) => (y.at || 0) - (x.at || 0));

            return { items, errors };

        },

        "application-replies-get": async () => {

            try {
                const data = await telegramRequest("/api/profile/application-replies", { method: "GET" });
                return { items: data.items || [] };
            }
            catch (error) {
                return { items: [], error: String(error && error.message || error) };
            }

        },

        "news-get": async () => {

            const [discord, telegram] = await Promise.allSettled([
                discordRequest("/api/discord/news", { method: "GET" }),
                telegramRequest("/api/profile/news", { method: "GET" })
            ]);

            const items = [];

            if (discord.status === "fulfilled") items.push(...(discord.value.items || []));
            if (telegram.status === "fulfilled") items.push(...(telegram.value.items || []));

            items.sort((x, y) => (y.at || 0) - (x.at || 0));

            return { items: items.slice(0, 40) };

        },

        "settings-set": async () => ({}),

        "profile-telegram-status": () =>
            telegramRequest("/api/profile/telegram", { method: "GET" }),

        "profile-telegram-link-code": () =>
            telegramRequest("/api/profile/link-code", { method: "POST" }),

        "profile-telegram-unlink": () =>
            telegramRequest("/api/profile/unlink", { method: "POST" }),

        "warnings-get": () =>
            telegramRequest("/api/profile/warnings", { method: "GET" }),

        "warnings-save": sections =>
            telegramRequest(
                "/api/profile/warnings",
                {
                    method: "POST",
                    body: JSON.stringify({ sections })
                }
            ),

        "members-list": async () =>
            (await discordRequest("/api/discord/members", { method: "GET" })).members,

        "member-history": async userId => {

            const id = String(userId || "");

            if (!/^\d{5,25}$/.test(id)) throw new Error("Некорректный ID.");

            return discordRequest(
                "/api/discord/user-history?userId=" + id,
                { method: "GET" }
            );

        },

        "member-warnings": async discordId => {

            const id = String(discordId || "");

            if (!/^\d{5,25}$/.test(id)) throw new Error("Некорректный ID.");

            return telegramRequest(
                "/api/profile/user-warnings?discordId=" + id,
                { method: "GET" }
            );

        },

        "telegram-get-banned": async () => {

            const data = await telegramRequest("/api/banned", { method: "GET" });

            if (!Array.isArray(data.members)) {
                throw new Error("Telegram Worker не вернул чёрный список.");
            }

            return data.members;

        },

        "telegram-resolve": async query =>
            (
                await telegramRequest(
                    "/api/resolve?q=" + encodeURIComponent(String(query || "").trim()),
                    { method: "GET" }
                )
            ).id,

        "moderation-notice-ack": async ids => {

            if (!Array.isArray(ids) || !getSession()) return false;

            const clean =
                ids
                    .map(String)
                    .filter(id => /^[\w-]+$/.test(id))
                    .slice(0, 50);

            if (!clean.length) return false;

            try {

                await discordRequest(
                    "/api/discord/notifications/ack",
                    {
                        method: "POST",
                        body: JSON.stringify({ ids: clean })
                    }
                );

                return true;

            }
            catch {

                return false;

            }

        },

        "minecraft-setup": async () => {

            throw new Error("Эта функция доступна только на компьютере.");

        }

    };

    const ipcRenderer = {

        invoke(channel, ...args) {

            const command = commands[channel];

            if (!command) {

                return Promise.reject(
                    new Error("Недоступно в мобильной версии: " + channel)
                );

            }

            try {
                return Promise.resolve(command(...args));
            }
            catch (error) {
                return Promise.reject(error);
            }

        },

        on(channel, listener) {

            (handlers[channel] = handlers[channel] || []).push(listener);

            return ipcRenderer;

        },

        removeListener(channel, listener) {

            handlers[channel] =
                (handlers[channel] || []).filter(item => item !== listener);

            return ipcRenderer;

        }

    };

    const shell = {

        openExternal(url) {
            return openUrl(url);
        }

    };

    window.SkyNixMobile = {
        ipcRenderer,
        shell
    };


    // ---------------- запуск ----------------

    async function init() {

        const { App } = plugins();

        try {

            if (App) {

                const info = await App.getInfo();

                appVersion = info.version;

                App.addListener(
                    "appUrlOpen",
                    event => handleDeepLink(event && event.url)
                );

                const launch = await App.getLaunchUrl();

                if (launch && launch.url) {
                    handleDeepLink(launch.url);
                }

            }

        }
        catch (error) {

            console.error("Bridge init:", error);

        }

        try {

            const { LocalNotifications } = plugins();

            if (LocalNotifications) {
                LocalNotifications.requestPermissions().catch(() => {});
            }

        }
        catch {
            // Игнорируем
        }

        setTimeout(pollNotices, 8000);
        setInterval(pollNotices, NOTICE_POLL_MS);
        setTimeout(pollNews, 15000);
        setInterval(pollNews, NEWS_POLL_MS);

        setTimeout(checkForUpdate, 6000);
        setInterval(checkForUpdate, UPDATE_CHECK_MS);

    }

    // Для тестов
    window.SkyNixMobile._internals = {
        handleDeepLink,
        isNewer,
        buildNoticeView,
        pollNotices,
        setVersion: value => { appVersion = value; }
    };

    init();

})();
