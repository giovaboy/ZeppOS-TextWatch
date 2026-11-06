import { getLanguage } from '@zos/settings'

// ─── Language detection (at load time) ────────────────────────────────────────
// getLanguage() returns a numeric code — see https://docs.zepp.com/docs/reference/related-resources/language-list/
// 2=en, 3=es, 4=ru, 6=fr, 10=it  (default: English)
const _lang = (() => { try { return getLanguage() } catch (_) { return 2 } })()

// ─── Italian data ─────────────────────────────────────────────────────────────

const IT_MAP = {
  mezzanotte: 'mezzanotte',
  mezzogiorno: 'mezzogiorno',
  una:    'una',
  e:      'e ',
  quarto: 'e un quarto',
  0:  'in punto',
  1:  'uno',    2:  'due',      3:  'tre',       4:  'quattro',
  5:  'cinque', 6:  'sei',      7:  'sette',      8:  'otto',
  9:  'nove',   10: 'dieci',    11: 'undici',     12: 'dodici',
  13: 'tredici',14: 'quattordici', 15: 'quindici', 16: 'sedici',
  17: 'diciassette', 18: 'diciotto', 19: 'diciannove',
  20: 'venti',  21: 'ventuno',  22: 'ventidue',   23: 'ventitré',
  24: 'ventiquattro', 25: 'venticinque',
  28: 'ventotto',
  30: 'trenta', 31: 'trentuno', 38: 'trentotto',
  40: 'quaranta', 41: 'quarantuno', 48: 'quarantotto',
  50: 'cinquanta', 51: 'cinquantuno', 58: 'cinquantotto',
  45: 'e tre quarti',
}
const IT_DAYS = {
  1: 'lunedì',   2: 'martedì', 3: 'mercoledì', 4: 'giovedì',
  5: 'venerdì',  6: 'sabato',  7: 'domenica',
}
const IT_MONTHS = {
  1: 'gennaio',  2: 'febbraio', 3: 'marzo',    4: 'aprile',
  5: 'maggio',   6: 'giugno',   7: 'luglio',   8: 'agosto',
  9: 'settembre',10: 'ottobre', 11: 'novembre',12: 'dicembre',
}
// Phonetic elisions: x1 "trentuno", x8 "ventotto"; everything below 26 is looked up directly.
// Compounds in -tre take an accent: "trentatré", "cinquantatré" ("tre" alone doesn't).
function _itNumToWords(n) {
  const mod = n % 10
  if (n < 26 || mod === 1 || mod === 8) return IT_MAP[n]
  const decine = IT_MAP[Math.floor(n / 10) * 10]
  if (mod === 3) return decine + 'tré'
  return mod ? decine + IT_MAP[mod] : decine
}

// ─── English data ─────────────────────────────────────────────────────────────

const EN_ONES = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
]
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty']
const EN_DAYS = {
  1: 'monday',   2: 'tuesday',  3: 'wednesday', 4: 'thursday',
  5: 'friday',   6: 'saturday', 7: 'sunday',
}
const EN_MONTHS = {
  1: 'january',  2: 'february', 3: 'march',    4: 'april',
  5: 'may',      6: 'june',     7: 'july',      8: 'august',
  9: 'september',10: 'october', 11: 'november',12: 'december',
}
function _enNumToWords(n) {
  if (n < 20) return EN_ONES[n]
  const tens = EN_TENS[Math.floor(n / 10)]
  const ones = EN_ONES[n % 10]
  return ones ? tens + '-' + ones : tens
}

// ─── Spanish data ─────────────────────────────────────────────────────────────

// 16-29 are compounds written as one word; 30+ use "y"
const ES_MAP = {
  1:  'uno',   2:  'dos',    3:  'tres',      4:  'cuatro',   5:  'cinco',
  6:  'seis',  7:  'siete',  8:  'ocho',      9:  'nueve',    10: 'diez',
  11: 'once',  12: 'doce',   13: 'trece',     14: 'catorce',  15: 'quince',
  16: 'dieciséis',  17: 'diecisiete', 18: 'dieciocho', 19: 'diecinueve',
  20: 'veinte', 21: 'veintiuno', 22: 'veintidós', 23: 'veintitrés',
  24: 'veinticuatro', 25: 'veinticinco', 26: 'veintiséis',
  27: 'veintisiete', 28: 'veintiocho', 29: 'veintinueve',
  30: 'treinta', 40: 'cuarenta', 50: 'cincuenta',
}
const ES_DAYS = {
  1: 'lunes',   2: 'martes', 3: 'miércoles', 4: 'jueves',
  5: 'viernes', 6: 'sábado', 7: 'domingo',
}
const ES_MONTHS = {
  1: 'enero',    2: 'febrero',   3: 'marzo',      4: 'abril',
  5: 'mayo',     6: 'junio',     7: 'julio',       8: 'agosto',
  9: 'septiembre', 10: 'octubre', 11: 'noviembre', 12: 'diciembre',
}
function _esNumToWords(n) {
  if (n <= 29) return ES_MAP[n]
  const tens = ES_MAP[Math.floor(n / 10) * 10]
  const ones = n % 10
  return ones ? tens + ' y ' + ES_MAP[ones] : tens
}

// ─── French data ──────────────────────────────────────────────────────────────

const FR_ONES = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
]
const FR_TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante']
const FR_DAYS = {
  1: 'lundi',    2: 'mardi',  3: 'mercredi', 4: 'jeudi',
  5: 'vendredi', 6: 'samedi', 7: 'dimanche',
}
const FR_MONTHS = {
  1: 'janvier',  2: 'février',  3: 'mars',      4: 'avril',
  5: 'mai',      6: 'juin',     7: 'juillet',   8: 'août',
  9: 'septembre',10: 'octobre', 11: 'novembre', 12: 'décembre',
}
// x1 doesn't join with a hyphen ("vingt et un", not "vingt-un")
function _frNumToWords(n) {
  if (n < 20) return FR_ONES[n]
  const tens = FR_TENS[Math.floor(n / 10)]
  const ones = n % 10
  if (ones === 0) return tens
  if (ones === 1) return tens + ' et un'
  return tens + '-' + FR_ONES[ones]
}

// ─── Russian data ─────────────────────────────────────────────────────────────

const RU_ONES = [
  '', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять',
  'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать',
  'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать',
]
const RU_TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят']
const RU_HOURS = [
  'полночь', 'час', 'два', 'три', 'четыре', 'пять', 'шесть',
  'семь', 'восемь', 'девять', 'десять', 'одиннадцать', 'полдень',
]
const RU_DAYS = {
  1: 'понедельник', 2: 'вторник',  3: 'среда',    4: 'четверг',
  5: 'пятница',     6: 'суббота',  7: 'воскресенье',
}
// Months in the genitive case (used in dates: "19 мая")
const RU_MONTHS = {
  1: 'января',   2: 'февраля',  3: 'марта',     4: 'апреля',
  5: 'мая',      6: 'июня',     7: 'июля',       8: 'августа',
  9: 'сентября', 10: 'октября', 11: 'ноября',   12: 'декабря',
}
function _ruNumToWords(n) {
  if (n < 20) return RU_ONES[n]
  const tens = RU_TENS[Math.floor(n / 10)]
  const ones = RU_ONES[n % 10]
  return ones ? tens + ' ' + ones : tens
}

// ─── Public API ───────────────────────────────────────────────────────────────

export default class NumberToText {

  static getHours(h) {
    const h12 = h > 12 ? h - 12 : h
    switch (_lang) {
      case 10: // Italian
        if (h === 0)             return IT_MAP.mezzanotte
        if (h === 12)            return IT_MAP.mezzogiorno
        if (h === 1 || h === 13) return IT_MAP.una
        return IT_MAP[h]
      case 3:  // Spanish
        if (h === 0)             return 'medianoche'
        if (h === 12)            return 'mediodía'
        if (h === 1 || h === 13) return 'una'
        return ES_MAP[h12]
      case 4:  // Russian
        return RU_HOURS[h12]
      case 6:  // French
        if (h === 0)             return 'minuit'
        if (h === 12)            return 'midi'
        if (h === 1 || h === 13) return 'une'
        return FR_ONES[h12]
      default: // English
        if (h === 0)  return 'midnight'
        if (h === 12) return 'noon'
        return _enNumToWords(h12)
    }
  }

  static getMinutes(m) {
    switch (_lang) {
      case 10: // Italian
        if (m === 0)  return IT_MAP[0]
        if (m === 15) return IT_MAP.quarto
        if (m === 45) return IT_MAP[45]
        return IT_MAP.e + _itNumToWords(m)
      case 3:  // Spanish
        if (m === 0)  return 'en punto'
        if (m === 15) return 'y cuarto'
        if (m === 30) return 'y media'
        if (m === 45) return 'y tres cuartos'
        return 'y ' + _esNumToWords(m)
      case 4:  // Russian
        if (m === 0)  return 'ровно'
        if (m === 15) return 'и четверть'
        if (m === 30) return 'и полчаса'
        if (m === 45) return 'и три четверти'
        return 'и ' + _ruNumToWords(m)
      case 6:  // French
        if (m === 0)  return 'précises'
        if (m === 15) return 'et quart'
        if (m === 30) return 'et demie'
        if (m === 45) return 'et trois quarts'
        return 'et ' + _frNumToWords(m)
      default: // English
        if (m === 0)  return "o'clock"
        if (m === 15) return 'fifteen'
        if (m === 30) return 'thirty'
        if (m === 45) return 'forty-five'
        return _enNumToWords(m)
    }
  }

  static getDate(dayOfWeek, date, month) {
    switch (_lang) {
      case 10: return `${IT_DAYS[dayOfWeek]} ${date} ${IT_MONTHS[month]}`
      case 3:  return `${ES_DAYS[dayOfWeek]}, ${date} de ${ES_MONTHS[month]}`
      case 4:  return `${RU_DAYS[dayOfWeek]}, ${date} ${RU_MONTHS[month]}`
      case 6:  return `${FR_DAYS[dayOfWeek]} ${date} ${FR_MONTHS[month]}`
      default: return `${EN_DAYS[dayOfWeek]}, ${EN_MONTHS[month]} ${date}`
    }
  }
}
