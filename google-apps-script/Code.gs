/**
 * Приёмник ответов для приглашения «Юбилей 45».
 *
 * Каждый ответ гостя:
 *   1) добавляется строкой в лист «Ответы» этой Google Таблицы;
 *   2) дописывается строкой в файл «ответы_гостей.txt» в той же папке Google Диска.
 *
 * Установка — см. README.md, раздел «Подключение Google Таблицы».
 */

var SHEET_NAME = 'Ответы';
var TXT_NAME = 'ответы_гостей.txt';

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var p = (e && e.parameter) || {};
    var first = clean_(p.firstName);
    var last = clean_(p.lastName);
    if (!first || !last) return json_({ ok: false, error: 'empty name' });

    var attending = p.attending === 'yes' ? 'ДА, придёт' : 'НЕТ, не сможет';
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss');

    // 1) Google Таблица
    var sheet = getSheet_();
    sheet.appendRow([now, first, last, attending]);
    var row = sheet.getLastRow();
    sheet.getRange(row, 4).setFontColor(p.attending === 'yes' ? '#1e7b34' : '#b3261e').setFontWeight('bold');

    // 2) txt-файл на Google Диске
    appendTxt_(now + '  |  ' + first + ' ' + last + '  |  ' + attending + '\n');

    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

// Открыв адрес веб-приложения в браузере, можно проверить, что всё работает.
function doGet() {
  var sheet = getSheet_();
  var rows = Math.max(0, sheet.getLastRow() - 1);
  return ContentService
    .createTextOutput('Приёмник ответов работает. Ответов получено: ' + rows)
    .setMimeType(ContentService.MimeType.TEXT);
}

// Запустите эту функцию один раз из редактора, чтобы выдать разрешения и создать лист и txt-файл.
function setup() {
  getSheet_();
  getTxtFile_();
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME, 0);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Когда ответил', 'Имя', 'Фамилия', 'Придёт?']);
    sheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#f3e6d3');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 150);
    sheet.setColumnWidth(3, 170);
    sheet.setColumnWidth(4, 150);
  }
  return sheet;
}

function getTxtFile_() {
  var ssFile = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
  var parents = ssFile.getParents();
  var folder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var files = folder.getFilesByName(TXT_NAME);
  if (files.hasNext()) return files.next();
  var header =
    'ОТВЕТЫ ГОСТЕЙ — Юбилей Алексея Сергеевича, 45 лет\n' +
    '24.11.2026, 17:00, баня, ул. Катаева, 116\n' +
    '==================================================\n\n';
  return folder.createFile(TXT_NAME, header, MimeType.PLAIN_TEXT);
}

function appendTxt_(line) {
  var file = getTxtFile_();
  file.setContent(file.getBlob().getDataAsString('UTF-8') + line);
}

function clean_(v) {
  var s = String(v || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  // защита от формул в таблице
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
