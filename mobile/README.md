# SkyNix для Android

Общий интерфейс — это `index.html` из корня репозитория (тот же, что на ПК).
В этой папке только «обёртка» для телефона: `src/mobile-bridge.js` отвечает на те же
каналы, что и `main.js` на ПК. Изменили `index.html` — обновились и ПК, и телефон.

## Что лежит в репозитории
```
index.html, main.js, package.json, assets/   ← приложение для ПК (как сейчас)
mobile/                                       ← эта папка
.github/workflows/android.yml                 ← сборка APK
```

## Один раз: ключ подписи APK
Без одного и того же ключа телефон не обновит приложение, поэтому ключ нужно сохранить навсегда.

1. В PowerShell (нужен JDK; он есть в Android Studio или https://adoptium.net):
   `keytool -genkeypair -v -keystore skynix.jks -alias skynix -keyalg RSA -keysize 2048 -validity 10000`
   Запомните пароли. Файл `skynix.jks` сохраните в надёжном месте и НЕ загружайте в репозиторий.
2. Превратите ключ в текст:
   `[Convert]::ToBase64String([IO.File]::ReadAllBytes("skynix.jks")) | Set-Clipboard`
3. На GitHub: Settings → Secrets and variables → Actions → New repository secret. Создайте 4 секрета:
   - `ANDROID_KEYSTORE_BASE64` — вставьте скопированный текст
   - `ANDROID_KEYSTORE_PASSWORD` — пароль хранилища
   - `ANDROID_KEY_ALIAS` — `skynix`
   - `ANDROID_KEY_PASSWORD` — пароль ключа

## Как выпускать версию
1. Поднимите версию в `package.json` и закоммитьте изменения в репозиторий.
2. Выпустите релиз для ПК как обычно (`npm run release`) и нажмите Publish release.
3. При публикации релиза автоматически запустится «Android APK» (вкладка Actions).
   Через 5–10 минут в этот же релиз добавится `SkyNix-Android-X.Y.Z.apk`.
   Запустить вручную: Actions → Android APK → Run workflow → укажите тег (например `v1.3.1`).

## Установка и обновления на телефоне
- Скачайте APK из релиза и откройте его. Разрешите установку из неизвестных источников.
- Приложение само проверяет GitHub. Появился релиз с APK новее — оно предложит скачать файл,
  вы открываете его и подтверждаете установку. Бесшумное обновление без Play Market на Android невозможно.

## Отличия от версии для ПК
- Нет кнопки «IP SkyNix Minecraft» и настройки hosts.
- Уведомления о модерации приходят, пока приложение открыто (проверка раз в 2 минуты).
