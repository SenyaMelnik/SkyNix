// Донастраивает сгенерированный проект Android:
// ссылка skynix://, разрешение на уведомления, версия, иконки.

const fs = require("fs");
const path = require("path");

const android = path.join(__dirname, "android");
const manifestPath = path.join(android, "app", "src", "main", "AndroidManifest.xml");
const gradlePath = path.join(android, "app", "build.gradle");
const resDir = path.join(android, "app", "src", "main", "res");

const version = process.env.VERSION || "1.0.0";
const versionCode = process.env.VERSION_CODE || "1";

// ---- AndroidManifest.xml ----
let manifest = fs.readFileSync(manifestPath, "utf8");

if (!manifest.includes('android:scheme="skynix"')) {
    const filter =
        "\n            <intent-filter>\n" +
        '                <action android:name="android.intent.action.VIEW" />\n' +
        '                <category android:name="android.intent.category.DEFAULT" />\n' +
        '                <category android:name="android.intent.category.BROWSABLE" />\n' +
        '                <data android:scheme="skynix" />\n' +
        "            </intent-filter>\n        ";

    const index = manifest.indexOf("</activity>");

    if (index === -1) {
        throw new Error("В AndroidManifest.xml не найден </activity>.");
    }

    manifest = manifest.slice(0, index) + filter.trimEnd() + "\n        " + manifest.slice(index);
}

if (!manifest.includes("POST_NOTIFICATIONS")) {
    manifest = manifest.replace(
        /<uses-permission android:name="android.permission.INTERNET"\s*\/>/,
        '$&\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />'
    );
}

fs.writeFileSync(manifestPath, manifest);

// ---- версия ----
let gradle = fs.readFileSync(gradlePath, "utf8");

gradle = gradle
    .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);

fs.writeFileSync(gradlePath, gradle);

// ---- иконки ----
const iconsDir = path.join(__dirname, "android-res");

if (fs.existsSync(iconsDir)) {
    for (const folder of fs.readdirSync(resDir)) {
        if (!folder.startsWith("mipmap")) continue;

        const dir = path.join(resDir, folder);

        for (const file of fs.readdirSync(dir)) {
            if (/^ic_launcher.*\.webp$/.test(file)) {
                fs.rmSync(path.join(dir, file));
            }
        }
    }

    fs.cpSync(iconsDir, resDir, { recursive: true });
}

console.log("Android настроен: версия", version, "код", versionCode);
