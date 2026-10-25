<!DOCTYPE html>
<html lang="ru">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<title>SkyNix</title>

<style>

* {
    box-sizing: border-box;
}

html,
body {

    margin: 0;
    padding: 0;

    min-height: 100%;

    background: #0b0b16;

    color: #ffffff;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

}

body {
    overflow-y: auto;
}

button,
select,
input,
textarea {
    font: inherit;
}

button {
    border: 0;
    cursor: pointer;
}

.app {

    width: 100%;

    min-height: 760px;

    padding: 18px;

    background:

        radial-gradient(
            circle at top right,
            rgba(
                110,
                76,
                255,
                .16
            ),
            transparent 35%
        ),

        radial-gradient(
            circle at top left,
            rgba(
                40,
                125,
                255,
                .12
            ),
            transparent 30%
        ),

        #0b0b16;

}

.header {

    display: flex;

    align-items: center;

    justify-content: space-between;

    margin-bottom: 14px;

}

.brand {

    display: flex;

    align-items: center;

    gap: 10px;

}

.logo {

    width: 40px;

    height: 40px;

    display: flex;

    align-items: center;

    justify-content: center;

    border-radius: 12px;

    font-weight: 800;

    background:
        linear-gradient(
            135deg,
            #2786ff,
            #7a42ff
        );

}

.brand-title {

    font-size: 20px;

    font-weight: 800;

}

.brand-subtitle {

    margin-top: 2px;

    color: #9b9bad;

    font-size: 12px;

}

.version {

    color: #a7a7ba;

    font-size: 12px;

}

.card {

    padding: 14px;

    margin-bottom: 12px;

    border: 1px solid #24243a;

    border-radius: 16px;

    background:
        rgba(
            18,
            18,
            31,
            .96
        );

}

.account {

    display: flex;

    align-items: center;

    justify-content: space-between;

    gap: 10px;

}

.account-left {
    min-width: 0;
}

.account-name {

    overflow: hidden;

    white-space: nowrap;

    text-overflow: ellipsis;

    font-size: 15px;

    font-weight: 700;

}

.account-role {

    margin-top: 4px;

    color: #9c9cb2;

    font-size: 12px;

}

.status-dot {

    width: 9px;

    height: 9px;

    display: inline-block;

    margin-right: 6px;

    border-radius: 50%;

    background: #6c6c7c;

}

.status-dot.ok {

    background: #40d66a;

    box-shadow:
        0 0 8px
        rgba(
            64,
            214,
            106,
            .45
        );

}

.actions {

    display: grid;

    grid-template-columns: 1fr 1fr;

    gap: 9px;

}

.btn {

    width: 100%;

    min-height: 42px;

    padding: 8px 11px;

    border: 1px solid #2a2a42;

    border-radius: 11px;

    color: white;

    background: #171727;

}

.btn:hover {
    background: #20203a;
}

.btn.primary {

    background:
        linear-gradient(
            135deg,
            #2f81ff,
            #6b43ff
        );

    border-color: transparent;

}

.btn.danger {

    background: #2b1822;

    border-color: #4a2236;

}

.btn.success {

    background: #14261b;

    border-color: #24462e;

}

.btn.warning {

    background: #2a2314;

    border-color: #4a3c1e;

}

.section-title {

    margin-bottom: 10px;

    color: #d9d9e7;

    font-size: 13px;

    font-weight: 800;

}

.moderation {

    display: grid;

    gap: 10px;

}

label {

    display: block;

    margin-bottom: 5px;

    color: #a8a8b9;

    font-size: 11px;

}

select,
input,
textarea {

    width: 100%;

    padding: 10px 11px;

    outline: none;

    color: white;

    background: #10101c;

    border: 1px solid #2b2b43;

    border-radius: 10px;

}

textarea {

    min-height: 74px;

    resize: vertical;

}

.row {

    display: grid;

    grid-template-columns: 1fr 1fr;

    gap: 8px;

}

.status {

    min-height: 18px;

    color: #9a9ab0;

    font-size: 11px;

    line-height: 1.45;

}

.status.error {
    color: #ff7e9f;
}

.status.ok {
    color: #64dc8b;
}

.hint {

    color: #85859a;

    font-size: 11px;

    line-height: 1.45;

}

.hidden {
    display: none !important;
}

.footer {

    padding: 5px;

    text-align: center;

    color: #6f6f82;

    font-size: 10px;

}

</style>

</head>

<body>

<div class="app">

    <div class="header">

        <div class="brand">

            <div class="logo">
                S
            </div>

            <div>

                <div class="brand-title">
                    SkyNix
                </div>

                <div class="brand-subtitle">
                    Панель команды
                </div>

            </div>

        </div>

        <div class="version">
            v1.2.0
        </div>

    </div>


    <!-- ================================================= -->
    <!-- DISCORD -->
    <!-- ================================================= -->

    <div class="card">

        <div class="account">

            <div class="account-left">

                <div class="account-name">

                    <span
                        id="statusDot"
                        class="status-dot"
                    ></span>

                    <span id="accountName">
                        Discord не подключён
                    </span>

                </div>

                <div
                    id="accountRole"
                    class="account-role"
                >
                    Войди через Discord
                </div>

            </div>

            <button
                id="loginBtn"
                class="btn primary"
                style="
                    width:auto;
                    padding:0 15px;
                "
            >
                Войти
            </button>

            <button
                id="logoutBtn"
                class="btn hidden"
                style="
                    width:auto;
                    padding:0 15px;
                "
            >
                Выйти
            </button>

        </div>

    </div>


    <!-- ================================================= -->
    <!-- НЕ В КОМАНДЕ -->
    <!-- ================================================= -->

    <div
        id="notTeamActions"
        class="card"
    >

        <div class="section-title">
            SkyNix
        </div>

        <div class="actions">

            <button
                class="btn"
                onclick="
                    openExternal(
                        'https://wiki.skynix.workers.dev'
                    )
                "
            >
                WIKI SkyNix
            </button>

            <button
                class="btn"
                onclick="
                    openExternal(
                        'https://forms.gle/gtYFhD5UeHycSRAb8'
                    )
                "
            >
                Подать заявку
            </button>

            <button
                class="btn"
                onclick="
                    openExternal(
                        'https://t.me/Applications_SkyNix_BOT'
                    )
                "
            >
                Проверка заявки
            </button>

            <button
                class="btn"
                onclick="
                    openExternal(
                        'https://www.youtube.com/@SenyaMelnik_Games'
                    )
                "
            >
                YouTube
            </button>

        </div>

    </div>


    <!-- ================================================= -->
    <!-- КОМАНДА -->
    <!-- ================================================= -->

    <div
        id="teamActions"
        class="card hidden"
    >

        <div class="section-title">
            SkyNix
        </div>

        <div class="actions">

            <button
                class="btn"
                onclick="
                    openExternal(
                        'https://wiki.skynix.workers.dev'
                    )
                "
            >
                WIKI SkyNix
            </button>

            <button
                class="btn"
                onclick="
                    openMinecraft()
                "
            >
                IP SkyNix Minecraft
            </button>

            <button
                class="btn"
                onclick="
                    openExternal(
                        'https://www.youtube.com/@SenyaMelnik_Games'
                    )
                "
            >
                YouTube
            </button>

        </div>

    </div>


    <!-- ================================================= -->
    <!-- МОДЕРАЦИЯ -->
    <!-- ================================================= -->

    <div
        id="moderatorActions"
        class="card hidden"
    >

        <div class="section-title">
            Модерация
        </div>

        <div class="actions">

            <button
                id="muteBtn"
                class="btn warning"
            >
                МУТ участника
            </button>

            <button
                id="unmuteBtn"
                class="btn success"
            >
                РАЗМУТ участника
            </button>

            <button
                id="banBtn"
                class="btn danger hidden"
            >
                БАН участника
            </button>

            <button
                id="unbanBtn"
                class="btn success hidden"
            >
                РАЗБАН участника
            </button>

        </div>

    </div>


    <!-- ================================================= -->
    <!-- ФОРМА -->
    <!-- ================================================= -->

    <div
        id="moderationCard"
        class="card hidden"
    >

        <div class="section-title">
            Модерация участника
        </div>

        <div class="moderation">

            <div>

                <label>
                    Discord пользователь
                </label>

                <select
                    id="discordUser"
                >

                    <option value="">
                        Выберите пользователя Discord
                    </option>

                </select>

            </div>

            <div>

                <label>
                    Telegram пользователь
                </label>

                <select
                    id="telegramUser"
                >

                    <option value="">
                        Выберите пользователя Telegram
                    </option>

                </select>

            </div>

            <div class="row">

                <div>

                    <label>
                        Время
                    </label>

                    <input
                        id="durationValue"
                        type="number"
                        min="1"
                        max="40320"
                        value="10"
                    >

                </div>

                <div>

                    <label>
                        Единица
                    </label>

                    <select
                        id="durationUnit"
                    >

                        <option value="s">
                            Секунды
                        </option>

                        <option value="m">
                            Минуты
                        </option>

                        <option value="h">
                            Часы
                        </option>

                        <option value="d">
                            Дни
                        </option>

                    </select>

                </div>

            </div>

            <div>

                <label>
                    Причина
                </label>

                <textarea
                    id="reason"
                    placeholder="Причина наказания..."
                ></textarea>

            </div>

            <div class="actions">

                <button
                    id="doMute"
                    class="btn warning"
                >
                    МУТ
                </button>

                <button
                    id="doUnmute"
                    class="btn success"
                >
                    РАЗМУТ
                </button>

                <button
                    id="doBan"
                    class="btn danger"
                >
                    БАН
                </button>

                <button
                    id="doUnban"
                    class="btn success"
                >
                    РАЗБАН
                </button>

            </div>

            <div
                id="moderationStatus"
                class="status"
            ></div>

            <div class="hint">
                Можно отдельно выбрать Discord и Telegram пользователя.
            </div>

        </div>

    </div>


    <div class="footer">
        SkyNix 1.2.0
    </div>

</div>


<script>

const {
    ipcRenderer,
    shell
} = require("electron");


// ======================================================
// ROLE
// ======================================================

const MUTE_ROLES = [

    "И.С.Модератор",
    "Мл.Модератор",
    "Модератор",
    "Гл.Модератор",
    "Заместитель",
    "Правая рука Создателя",
    "Архонт"

];


const BAN_ROLES = [

    "Модератор",
    "Гл.Модератор",
    "Заместитель",
    "Правая рука Создателя",
    "Архонт"

];


// ======================================================
// HELPERS
// ======================================================

function $(id) {

    return document.getElementById(
        id
    );

}


function openExternal(
    url
) {

    shell.openExternal(
        url
    );

}


function openMinecraft() {

    ipcRenderer.send(
        "setup-minecraft"
    );

}


// ======================================================
// ACCOUNT
// ======================================================

function updateAccount(
    data
) {

    const user =
        data?.user ||
        {};

    const role =
        data?.role ||
        data?.roleName ||
        "Участник SkyNix";

    $("accountName")
        .textContent =

            user.global_name ||

            user.username ||

            "Discord";


    $("accountRole")
        .textContent =
            role;


    $("statusDot")
        .classList
        .add(
            "ok"
        );


    $("loginBtn")
        .classList
        .add(
            "hidden"
        );


    $("logoutBtn")
        .classList
        .remove(
            "hidden"
        );


    const isTeam =

        data?.isTeamMember === true ||

        data?.status === "member" ||

        data?.status === "recruit" ||

        Boolean(
            data?.role
        );


    const isModerator =

        data?.isModerator === true ||

        MUTE_ROLES.includes(
            role
        );


    const canBan =
        BAN_ROLES.includes(
            role
        );


    $("notTeamActions")
        .classList
        .toggle(
            "hidden",
            isTeam
        );


    $("teamActions")
        .classList
        .toggle(
            "hidden",
            !isTeam
        );


    $("moderatorActions")
        .classList
        .toggle(
            "hidden",
            !isModerator
        );


    $("banBtn")
        .classList
        .toggle(
            "hidden",
            !canBan
        );


    $("unbanBtn")
        .classList
        .toggle(
            "hidden",
            !canBan
        );

}


function resetUI() {

    $("accountName")
        .textContent =
            "Discord не подключён";


    $("accountRole")
        .textContent =
            "Войди через Discord";


    $("statusDot")
        .classList
        .remove(
            "ok"
        );


    $("loginBtn")
        .classList
        .remove(
            "hidden"
        );


    $("logoutBtn")
        .classList
        .add(
            "hidden"
        );


    $("notTeamActions")
        .classList
        .remove(
            "hidden"
        );


    $("teamActions")
        .classList
        .add(
            "hidden"
        );


    $("moderatorActions")
        .classList
        .add(
            "hidden"
        );


    $("moderationCard")
        .classList
        .add(
            "hidden"
        );

}


// ======================================================
// DISCORD PROFILE
// ======================================================

async function refreshProfile() {

    try {

        const result =
            await ipcRenderer.invoke(
                "discord-get-me"
            );


        if (
            result?.ok
        ) {

            updateAccount(
                result
            );

        } else {

            resetUI();

        }

    } catch (error) {

        console.error(
            error
        );

        resetUI();

    }

}


// ======================================================
// MEMBER HELPERS
// ======================================================

function memberId(
    member
) {

    return String(

        member?.id ||

        member?.user_id ||

        member?.userId ||

        member?.user?.id ||

        ""

    );

}


function memberName(
    member
) {

    return (

        member?.displayName ||

        member?.first_name ||

        member?.global_name ||

        member?.globalName ||

        member?.name ||

        member?.user?.global_name ||

        member?.user?.username ||

        member?.username ||

        memberId(
            member
        )

    );

}


function memberUsername(
    member
) {

    return (

        member?.username ||

        member?.user?.username ||

        ""

    );

}


// ======================================================
// SELECT
// ======================================================

function fillSelect(
    select,
    members,
    placeholder
) {

    select.innerHTML =
        "";


    const first =
        document.createElement(
            "option"
        );


    first.value =
        "";


    first.textContent =
        members.length
            ? placeholder
            : "Пользователей нет";


    select.appendChild(
        first
    );


    members
        .slice()
        .sort(
            (
                a,
                b
            ) =>

                memberName(a)
                    .localeCompare(
                        memberName(b),
                        "ru"
                    )

        )
        .forEach(
            member => {

                const id =
                    memberId(
                        member
                    );


                if (!id) {

                    return;

                }


                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    id;


                const username =
                    memberUsername(
                        member
                    );


                option.textContent =

                    username

                        ? `${memberName(member)} (@${username})`

                        : memberName(
                            member
                        );


                select.appendChild(
                    option
                );

            }
        );

}


// ======================================================
// ЗАГРУЗКА ОБОИХ СПИСКОВ
// ======================================================

async function loadMembers() {

    $("discordUser")
        .innerHTML =
            "<option>Загрузка Discord...</option>";


    $("telegramUser")
        .innerHTML =
            "<option>Загрузка Telegram...</option>";


    const [

        discord,

        telegram

    ] =

        await Promise.all(

            [

                ipcRenderer.invoke(
                    "discord-get-members"
                ),

                ipcRenderer.invoke(
                    "telegram-get-members"
                )

            ]

        );


    // DISCORD
    if (
        discord?.ok
    ) {

        fillSelect(

            $("discordUser"),

            discord.members ||
                [],

            "Выберите пользователя Discord"

        );

    } else {

        $("discordUser")
            .innerHTML =

                `<option>Ошибка Discord</option>`;

    }


    // TELEGRAM
    if (
        telegram?.ok
    ) {

        fillSelect(

            $("telegramUser"),

            telegram.members ||
                [],

            "Выберите пользователя Telegram"

        );

    } else {

        $("telegramUser")
            .innerHTML =

                `<option>Ошибка Telegram</option>`;

    }

}


// ======================================================
// OPEN MODERATION
// ======================================================

function openModeration() {

    $("moderationCard")
        .classList
        .remove(
            "hidden"
        );


    loadMembers()
        .catch(
            error => {

                $("moderationStatus")
                    .textContent =
                        error.message;

            }
        );

}


// ======================================================
// DURATION
// ======================================================

function getDurationSeconds() {

    const value =
        Number(
            $("durationValue")
                .value
        );


    const unit =
        $("durationUnit")
            .value;


    if (
        !Number.isFinite(
            value
        ) ||
        value <= 0
    ) {

        throw new Error(
            "Укажите корректное время."
        );

    }


    let seconds =
        value;


    if (
        unit === "m"
    ) {

        seconds =
            value *
            60;

    }


    if (
        unit === "h"
    ) {

        seconds =
            value *
            60 *
            60;

    }


    if (
        unit === "d"
    ) {

        seconds =
            value *
            24 *
            60 *
            60;

    }


    if (
        seconds >
        28 *
        24 *
        60 *
        60
    ) {

        throw new Error(
            "Максимальный срок — 28 дней."
        );

    }


    return seconds;

}


// ======================================================
// MODERATION
// ======================================================

async function moderate(
    action
) {

    const discordUserId =
        $("discordUser")
            .value ||
        null;


    const telegramUserId =
        $("telegramUser")
            .value ||
        null;


    const reason =
        $("reason")
            .value
            .trim();


    if (
        !discordUserId &&
        !telegramUserId
    ) {

        $("moderationStatus")
            .textContent =
                "Выберите пользователя.";

        $("moderationStatus")
            .className =
                "status error";

        return;

    }


    if (!reason) {

        $("moderationStatus")
            .textContent =
                "Введите причину.";

        $("moderationStatus")
            .className =
                "status error";

        return;

    }


    let durationSeconds =
        0;


    if (
        action === "mute" ||
        action === "ban"
    ) {

        try {

            durationSeconds =
                getDurationSeconds();

        } catch (error) {

            $("moderationStatus")
                .textContent =
                    error.message;

            $("moderationStatus")
                .className =
                "status error";

            return;

        }

    }


    $("moderationStatus")
        .textContent =
            "Выполняем действие...";

    $("moderationStatus")
        .className =
            "status";


    const results =
        [];


    // ==================================================
    // DISCORD
    // ==================================================

    if (
        discordUserId
    ) {

        const discordResult =
            await ipcRenderer.invoke(

                "discord-moderation",

                {

                    action:
                        action,

                    discord_user_id:
                        discordUserId,

                    duration_seconds:
                        durationSeconds,

                    reason:
                        reason

                }

            );


        results.push(
            {
                service:
                    "Discord",

                result:
                    discordResult
            }
        );

    }


    // ==================================================
    // TELEGRAM
    // ==================================================

    if (
        telegramUserId
    ) {

        const telegramResult =
            await ipcRenderer.invoke(

                "telegram-moderation",

                {

                    action:
                        action,

                    telegram_user_id:
                        telegramUserId,

                    duration_seconds:
                        durationSeconds,

                    reason:
                        reason

                }

            );


        results.push(
            {
                service:
                    "Telegram",

                result:
                    telegramResult

            }
        );

    }


    const errors =
        results
            .filter(
                item =>
                    !item.result?.ok
            );


    if (
        errors.length
    ) {

        const text =
            errors
                .map(
                    item =>

                        `${item.service}: ${
                            item.result?.error ||
                            "ошибка"
                        }`

                )
                .join(
                    " | "
                );


        $("moderationStatus")
            .textContent =
                text;


        $("moderationStatus")
            .className =
                "status error";


        return;

    }


    $("moderationStatus")
        .textContent =
            "Действие выполнено.";

    $("moderationStatus")
        .className =
            "status ok";


    await loadMembers();

}


// ======================================================
// BUTTONS
// ======================================================

$("loginBtn")
    .addEventListener(
        "click",
        () => {

            ipcRenderer.send(
                "discord-login"
            );

        }
    );


$("logoutBtn")
    .addEventListener(
        "click",
        () => {

            ipcRenderer.send(
                "discord-logout"
            );

        }
    );


$("muteBtn")
    .addEventListener(
        "click",
        openModeration
    );


$("unmuteBtn")
    .addEventListener(
        "click",
        openModeration
    );


$("banBtn")
    .addEventListener(
        "click",
        openModeration
    );


$("unbanBtn")
    .addEventListener(
        "click",
        openModeration
    );


$("doMute")
    .addEventListener(
        "click",
        () =>
            moderate(
                "mute"
            )
    );


$("doUnmute")
    .addEventListener(
        "click",
        () =>
            moderate(
                "unmute"
            )
    );


$("doBan")
    .addEventListener(
        "click",
        () =>
            moderate(
                "ban"
            )
    );


$("doUnban")
    .addEventListener(
        "click",
        () =>
            moderate(
                "unban"
            )
    );


// ======================================================
// DISCORD SESSION
// ======================================================

ipcRenderer.on(
    "discord-session",
    async () => {

        await refreshProfile();

    }
);


// ======================================================
// LOGOUT
// ======================================================

ipcRenderer.on(
    "discord-logged-out",
    () => {

        resetUI();

    }
);


// ======================================================
// START
// ======================================================

window.addEventListener(
    "DOMContentLoaded",
    async () => {

        await refreshProfile();

    }
);

</script>

</body>

</html>