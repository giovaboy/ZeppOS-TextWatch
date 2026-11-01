import { createWidget, deleteWidget, widget, align, text_style, prop, anim_status, show_level, event, edit_type } from '@zos/ui'
import { getScene, SCENE_AOD, getPerformance } from '@zos/app'
import { px, log } from '@zos/utils'
import { Time } from '@zos/sensor'
import { launchApp, SYSTEM_APP_CALENDAR } from '@zos/router'
import NumberToText from './numberToText.js'
import { backgrounds } from './backgrounds.js'
import EditTypesUtil, { widgetOptionalArray, BLANK_TYPE, setWidgetTextColor } from './editTypesUtil.js'
import { getLanguage } from '@zos/settings'
import { colorOptionalArray, getColorFromType, COLOR_EDIT_ID, COLOR } from './colorSelector.js'

try {
  (() => {

    /*            column A              column B
    *           _|________|_
    *          |            |
    *         |              |
    * HOUR   |   ##########   |  <-- ############### +1
    *       |                  |
    * MIN    |   ##########   |  <-- ############### +1
    *         |              |
    *          |____________|
    *            |        |
    */

const DEBUG = false;
const logger = log.getLogger("textwatch-italiano");

const timeSensor = new Time()

// DEBUG: memoria dell'app e del sistema, da getPerformance (API 4.0; il progetto punta a 3.0, quindi
// su firmware più vecchi la funzione può mancare). Una watch face non ha side service né Logs box:
// la riga va a schermo (secondTextWidget) e nel log del simulatore.
const APP_ID = 1043121
function _memLine() {
  try {
    if (typeof getPerformance !== 'function') return 'mem n/a (API < 4.0)'
    const m = getPerformance('memory').memory
    const apps = m.app || []
    const a = apps.find(x => x.appid === APP_ID) || apps[0]
    const kb = (b) => Math.round(b / 1024)
    const app = a ? `app ${kb(a.used)}/${kb(a.peak)} KB` : 'app ?'
    return `${app} · sys ${kb(m.system.used)}/${kb(m.system.total)} KB`
  } catch (e) {
    return e === null ? 'mem: out of memory' : 'mem err: ' + e
  }
}
function _memModules() {
  try {
    const m = getPerformance('memory').memory
    const a = (m.app || []).find(x => x.appid === APP_ID) || (m.app || [])[0]
    return (a && a.modules || []).map(mod => `${mod.file} ${Math.round(mod.used / 1024)}/${Math.round(mod.peak / 1024)} KB`).join(' | ')
  } catch (_) { return '' }
}

// Barlow non copre il cirillico: per il russo (lang 4) si usa Inter (subset latino+cirillico)
const _isRu = (() => { try { return getLanguage() === 4 } catch (_) { return false } })()
const _isFr = (() => { try { return getLanguage() === 6 } catch (_) { return false } })()

const dateTextSize = px(28);
// In russo la stringa peggiore ("и пятьдесят восемь") a 64px sfora il widget; a 56px il margine è minimo (~6px)
// In francese "et cinquante-quatre" sfora leggermente a 64px; 60px lascia ~18px di margine
const minuteTextSize = _isRu ? px(56) : _isFr ? px(60) : px(64);
const hourTextSize = px(64);

const HaH = (hourTextSize * 1.25);
const HbH = HaH;
const MaH = HaH; // box fisso: il testo ru più piccolo resta centrato dove si aspettano overlay e layout
const MbH = MaH;

//balance = 480*480
const HaX = px(-30);
const MaX = HaX;

const HbX = px(540);
const MbX = HbX;

//hours Y
const HaY = px(110);
const HbY = HaY;
//minutes Y
const MaY = px(240)-((HaH)/2)-px(10);//px(196);
const MbY = MaY;

const HaW = px(540);
const HbW = HaW;
const MaW = HaW;
const MbW = HaW;

const dateX = px(0);
const dateY = px(400);
const dateH = (dateTextSize * 1.25);// (font size * 1.25);
const dateW = px(480);

const editableWidgetsIds = [110,111,112,113,114];
const editableWidgetsHW = px(92);

const animDuration = 1000;
const animFps = 25;

const DEFAULT_TEXT_COLOR = 0xffffff;

const aodBgColor = 0x000000;
const hourAODColor   = 0xffffff;
const minuteAODColor = 0xffffff;

let dateColor;
let hourColor;
let minuteColor;

const dummyCharsetMinute = _isRu ? ' авдеиклмнопрстцчшыья' : 'acdegimnopqrstuv';
const dummyCharsetHour = _isRu ? 'авдеилмнопрстцчшыья' : 'acdegimnopqrstuvz';
const dummyCharsetDate = _isRu ? 'абвгдеиклмнопрстуфцчьюя,0123456789' : 'abcdefgilmnoprstuvzì0123456789';

const hourNormalFont = _isRu ? 'fonts/Inter-Medium.ttf' : 'fonts/Barlow-Medium.ttf';
const minuteNormalFont = _isRu ? 'fonts/Inter-Regular.ttf' : 'fonts/Barlow-Regular.ttf';

const dateFont = _isRu ? 'fonts/Inter-Regular.ttf' : 'fonts/Barlow-RegularDate.ttf';

const hourAODFont = _isRu ? 'fonts/Inter-Light.ttf' : 'fonts/Barlow-Light.ttf';
const minuteAODFont = _isRu ? 'fonts/Inter-Thin.ttf' : 'fonts/Barlow-Thin.ttf';

const anim_step_in = {
  anim_prop: prop.X,
  anim_from: HbX,
  anim_to: HaX,
  anim_rate: 'easeinout',
  anim_duration: animDuration
}

const anim_step_out = {
  anim_prop: prop.X,
  anim_from: HaX,
  anim_to: px(-570),// - (W - start x);
  anim_rate: 'easeinout',
  anim_duration: animDuration
}

let secondTextWidget = null;

let dateTextWidget = null;
let hourTextWidgetA = null;
let hourTextWidgetB = null;
let minuteTextWidgetA = null;
let minuteTextWidgetB = null;

let hourAODWidget = null;
let minuteAODWidget = null;

let animIdHourA = null;
let animIdHourB = null;
let animIdMinuteA = null;
let animIdMinuteB = null;

let editGroup1 = null;
let editGroup2 = null;
let editGroup3 = null;
let editGroup4 = null;
let editGroup5 = null;

let colorGroupHour   = null;
let colorGroupMinute = null;
let colorGroupDate   = null;

let editBgWidget = null;


WatchFace({
  //https://github.com/zepp-health/zeppos-samples/blob/main/application/3.0/3.0-feature/app-service/time_service.js

  textWatchBuild() {

    createWidget(widget.FILL_RECT, {
      x: px(0), y: px(0),
      w: px(480), h: px(480),
      color: aodBgColor, show_level: show_level.ONAL_AOD
    });

    editBgWidget = createWidget(widget.WATCHFACE_EDIT_BG, {
      edit_id: 101,
      x: px(0), y: px(0), show_level: show_level.ONLY_NORMAL | show_level.ONLY_EDIT,
      bg_config: backgrounds,
      count: backgrounds.length,
      default_id: 0,
      fg: 'mask/fg_x.png',
      tips_x: px(178), tips_y: px(20),
      tips_bg: 'mask/tips.png'
    });

    const _lightBgIds = new Set(backgrounds.filter(b => b.light).map(b => b.id))
    const _currentBgId = () => { try { return editBgWidget.getProperty(prop.CURRENT_BG_ID) ?? 0 } catch(_) { return 0 } }
    const _applyWidgetTextColor = () => setWidgetTextColor(_lightBgIds.has(_currentBgId()) ? 0x1a1a1a : 0xffffff)
    _applyWidgetTextColor()

    // ── Color zone selectors ──────────────────────────────────────────────────
    function _makeColorGroup(editId, x, y, w, h, optArray, selectImg, tipsBelow = false) {
      const grp = createWidget(widget.WATCHFACE_EDIT_GROUP, {
        edit_id: editId,
        x, y, w, h,
        select_image:    selectImg,
        un_select_image: selectImg,
        default_type: COLOR.WHITE,
        optional_types: optArray,
        count: optArray.length,
        tips_BG:    'mask/tips.png',
        tips_x:     Math.round((w - px(124)) / 2),
        tips_y:     tipsBelow ? h + px(8) : -px(40),
        tips_width: px(124)
      })
      return { grp }
    }

    // Liste preview nella lingua del dispositivo (it/en/es/ru/fr, le altre ricadono sull'inglese).
    // Costruite qui e passate direttamente a createWidget: nessun riferimento resta dopo il build,
    // così il GC le libera (prima tutte le 15 liste restavano in memoria come export del modulo).
    const _deviceLang = (() => { try { return getLanguage() } catch(_) { return 2 } })()

    // Ore: rettangolo 400×80, centrato orizzontalmente, sovrapposto al testo ore (y=110, h=80)
    const csHour   = _makeColorGroup(COLOR_EDIT_ID.HOUR,   px(40),  px(110), px(400), px(80),  colorOptionalArray('hour',   _deviceLang), 'mask/select_rect.png')
    // Minuti: rettangolo 400×80, centrato, sovrapposto al testo minuti
    const csMinute = _makeColorGroup(COLOR_EDIT_ID.MINUTE, px(40),  MaY,     px(400), px(80),  colorOptionalArray('minute', _deviceLang), 'mask/select_rect.png', true)
    // Data: rettangolo 280×35, centrato (x=100), sovrapposto al testo data
    const csDate   = _makeColorGroup(COLOR_EDIT_ID.DATE,   px(100), dateY,   px(280), dateH,   colorOptionalArray('date',   _deviceLang), 'mask/select_date.png', true)

    colorGroupHour   = csHour.grp
    colorGroupMinute = csMinute.grp
    colorGroupDate   = csDate.grp

    function _colorForZone(groupWidget) {
      const sel = groupWidget.getProperty(prop.CURRENT_TYPE)
      return getColorFromType(sel) ?? DEFAULT_TEXT_COLOR
    }

    function _refreshColors() {
      hourColor   = _colorForZone(colorGroupHour)
      minuteColor = _colorForZone(colorGroupMinute)
      dateColor   = _colorForZone(colorGroupDate)
    }

    _refreshColors()
    // ─────────────────────────────────────────────────────────────────────────

    let screenType = getScene();

    /* HOURS */
    hourTextWidgetA = createWidget(widget.TEXT, { font: hourNormalFont, text: dummyCharsetHour,
      x: HaX, y: HaY, w: HaW, h: HaH, text_size: hourTextSize, color: hourColor, show_level: show_level.ONLY_NORMAL, align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.ELLIPSIS })
    hourTextWidgetB = createWidget(widget.TEXT, { font: hourNormalFont, text: dummyCharsetHour,
      x: HbX, y: HbY, w: HbW, h: HbH, text_size: hourTextSize, color: hourColor, show_level: show_level.ONLY_NORMAL, align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.ELLIPSIS })
    hourAODWidget = createWidget(widget.TEXT, { font: hourAODFont, text: dummyCharsetHour,
      x: HaX, y: HaY, w: HaW, h: HaH, text_size: hourTextSize, color: hourAODColor, show_level: show_level.ONAL_AOD, align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.ELLIPSIS })

    hourAODWidget.setProperty(prop.MORE, { text: `${NumberToText.getHours(timeSensor.getHours())}` });
    hourTextWidgetA.setProperty(prop.MORE, { text: `${NumberToText.getHours(timeSensor.getHours())}` });
    hourTextWidgetB.setProperty(prop.MORE, { text: '' });

    animIdHourA = hourTextWidgetA.setProperty(prop.ANIM, {
      anim_steps: [anim_step_out],
      anim_fps: animFps,
      anim_auto_start: 0,
      anim_auto_destroy: 0,
      anim_repeat: 0,
      anim_complete_func: () => {
        if ( DEBUG ) logger.log('animation complete animIdHourA');
        hourTextWidgetA.setProperty(prop.MORE, {text : `${NumberToText.getHours(timeSensor.getHours())}`, x: HaX });
      }
    });

    animIdHourB = hourTextWidgetB.setProperty(prop.ANIM, {
      anim_steps: [anim_step_in],
      anim_fps: animFps,
      anim_auto_start: 0,
      anim_auto_destroy: 0,
      anim_repeat: 0,
      anim_complete_func: () => {
        if ( DEBUG ) logger.log('animation complete animIdHourB');
        hourTextWidgetB.setProperty(prop.MORE, {text: '', x: HbX});
      }
    });

    /* MINUTES — create immediately after hours for render priority */
    minuteTextWidgetA = createWidget(widget.TEXT, { font: minuteNormalFont, text: dummyCharsetMinute,
      show_level: show_level.ONLY_NORMAL, x: MaX, y: MaY, w: MaW, h: MaH, color: minuteColor, text_size: minuteTextSize, align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.ELLIPSIS });
    minuteTextWidgetB = createWidget(widget.TEXT, { font: minuteNormalFont, text: dummyCharsetMinute,
      show_level: show_level.ONLY_NORMAL, x: MbX, y: MbY, w: MbW, h: MbH, color: minuteColor, text_size: minuteTextSize, align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.ELLIPSIS });
    minuteAODWidget = createWidget(widget.TEXT, { font: minuteAODFont, text: dummyCharsetMinute,
      show_level: show_level.ONAL_AOD, x: MaX, y: MaY, w: MaW, h: MaH, color: minuteAODColor, text_size: minuteTextSize, align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.ELLIPSIS });

    minuteAODWidget.setProperty(prop.MORE, { text: `${NumberToText.getMinutes(timeSensor.getMinutes())}` });
    minuteTextWidgetA.setProperty(prop.MORE, { text: `${NumberToText.getMinutes(timeSensor.getMinutes())}` });
    minuteTextWidgetB.setProperty(prop.MORE, { text: '' });

    animIdMinuteA = minuteTextWidgetA.setProperty(prop.ANIM, {
      anim_steps: [anim_step_out],
      anim_fps: animFps,
      anim_auto_start: 0,
      anim_auto_destroy: 0,
      anim_repeat: 0,
      anim_complete_func: () => {
        if ( DEBUG ) logger.log('animation complete animIdMinuteA');
        minuteTextWidgetA.setProperty(prop.MORE, {text : `${NumberToText.getMinutes(timeSensor.getMinutes())}`, x: MaX });
      }
    });

    animIdMinuteB = minuteTextWidgetB.setProperty(prop.ANIM, {
      anim_steps: [anim_step_in],
      anim_fps: animFps,
      anim_auto_start: 0,
      anim_auto_destroy: 0,
      anim_repeat: 0,
      anim_complete_func: () => {
        if ( DEBUG ) logger.log('animation complete animIdMinuteB');
        minuteTextWidgetB.setProperty(prop.MORE, {text: '', x: MbX });
      }
    });

    /* DATE */
    dateTextWidget = createWidget(widget.TEXT,{ font: dateFont, text: dummyCharsetDate,
      x: dateX, y: dateY, w: dateW, h: dateH,
      text_size: dateTextSize, color: dateColor, show_level: show_level.ONLY_NORMAL, align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.ELLIPSIS
    });

    updateDateWidget();

    // area click: solo il testo data estesa al bordo
    createWidget(widget.FILL_RECT, {
      x: dateX, y: dateY, w: dateW, h: px(480) - dateY,
      color: 0x000000, alpha: 0,
      show_level: show_level.ONLY_NORMAL,
    }).addEventListener(event.CLICK_UP, () => {
      launchApp({ appId: SYSTEM_APP_CALENDAR, native: true })
    });

    if ( DEBUG ) {
      secondTextWidget = createWidget(widget.TEXT, {
        x: px(60), y: px(100), w: px(360), h: px(16), text_size: px(14),
        align_h: align.CENTER_H, align_v: align.CENTER_V,
        color: 0xffffff,
        show_level: show_level.ONLY_NORMAL,
        text: `${timeSensor.getSeconds()}s · ${_memLine()}`
      });
    };

    /* 1 - HEART EDITABLE GROUP */
    editGroup1 = createWidget(widget.WATCHFACE_EDIT_GROUP, {
      edit_id: editableWidgetsIds[0],
      x: px(50), y: px(290),
      w: editableWidgetsHW, h: editableWidgetsHW,
      select_image: 'mask/select.png',
      un_select_image:  'mask/select.png',
      default_type: edit_type.HEART,
      optional_types: widgetOptionalArray,
      count: widgetOptionalArray.length,
      tips_BG: 'mask/tips.png',
      tips_x: - px((124-92)/2),
      tips_y: - px(36+4),
      tips_width: px(124),
      //tips_margin: 10 // optional, default value: 0
      select_list: {
        title_font_size : 34 ,
        title_align_h: align.CENTER_H ,
        list_item_vspace: 8,
        list_tips_text_font_size: 32,
        list_tips_text_align_h : align.LEFT,
      }
    })
    let item1 = editGroup1.getProperty(prop.CURRENT_TYPE);

    /* 2 - STEP EDITABLE GROUP */
    editGroup2 = createWidget(widget.WATCHFACE_EDIT_GROUP, {
      edit_id: editableWidgetsIds[1],
      x: px(146), y: px(290),
      w: editableWidgetsHW, h: editableWidgetsHW,
      select_image: 'mask/select.png',
      un_select_image:  'mask/select.png',
      default_type: edit_type.STEP,
      optional_types: widgetOptionalArray,
      count: widgetOptionalArray.length,
      tips_BG: 'mask/tips.png',
      tips_x: - px((124-92)/2),
      tips_y: - px(36+4),
      tips_width: px(124),
      //tips_margin: 10 // optional, default value: 0
      select_list: {
        title_font_size: 34 ,
        title_align_h: align.CENTER_H ,
        list_item_vspace: 8,
        list_tips_text_font_size: 32,
        list_tips_text_align_h : align.LEFT,
      }
    })
    let item2 = editGroup2.getProperty(prop.CURRENT_TYPE);

    /* 3 - DISTANCE EDITABLE GROUP */
    editGroup3 = createWidget(widget.WATCHFACE_EDIT_GROUP, {
      edit_id: editableWidgetsIds[2],
      x: px(242), y: px(290),
      w: editableWidgetsHW, h: editableWidgetsHW,
      select_image: 'mask/select.png',
      un_select_image:  'mask/select.png',
      default_type: edit_type.DISTANCE,
      optional_types: widgetOptionalArray,
      count: widgetOptionalArray.length,
      tips_BG: 'mask/tips.png',
      tips_x: - px((124-92)/2),
      tips_y: - px(36+4),
      tips_width: px(124),
      //tips_margin: 10 // optional, default value: 0
      select_list: {
        title_font_size :34 ,
        title_align_h: align.CENTER_H ,
        list_item_vspace: 8,
        list_tips_text_font_size: 32,
        list_tips_text_align_h : align.LEFT,
      }
    })
    let item3 = editGroup3.getProperty(prop.CURRENT_TYPE);

    /* 4 - 4TH BOTTOM ROW EDITABLE GROUP */
    editGroup5 = createWidget(widget.WATCHFACE_EDIT_GROUP, {
      edit_id: editableWidgetsIds[4],
      x: px(338), y: px(290),
      w: editableWidgetsHW, h: editableWidgetsHW,
      select_image: 'mask/select.png',
      un_select_image:  'mask/select.png',
      default_type: BLANK_TYPE,
      optional_types: widgetOptionalArray,
      count: widgetOptionalArray.length,
      tips_BG: 'mask/tips.png',
      tips_x: - px((124-92)/2),
      tips_y: - px(36+4),
      tips_width: px(124),
      select_list: {
        title_font_size: 34,
        title_align_h: align.CENTER_H,
        list_item_vspace: 8,
        list_tips_text_font_size: 32,
        list_tips_text_align_h: align.LEFT,
      }
    })
    let item5 = editGroup5.getProperty(prop.CURRENT_TYPE);

    // Dynamic equidistant positioning for non-empty bottom slots
    const _bottomX = (count) => ({
      1: [194],
      2: [114, 274],
      3: [42, 194, 346],
      4: [50, 146, 242, 338],
    })[count] ?? []
    const bottomSlots = [
      { type: item1, id: editableWidgetsIds[0] },
      { type: item2, id: editableWidgetsIds[1] },
      { type: item3, id: editableWidgetsIds[2] },
      { type: item5, id: editableWidgetsIds[4] },
    ].filter(s => s.type !== BLANK_TYPE)
    const xPositions = _bottomX(bottomSlots.length)
    bottomSlots.forEach((s, i) => {
      try { EditTypesUtil.drawWidget(s.type, s.id, xPositions[i]) } catch(e) { logger.log('widget bottom error: ' + e) }
    })

    /* 5 - TOP CENTER EDITABLE GROUP */
    editGroup4 = createWidget(widget.WATCHFACE_EDIT_GROUP, {
      edit_id: editableWidgetsIds[3],
      x: px(194), y: px(5),
      w: editableWidgetsHW, h: editableWidgetsHW,
      select_image: 'mask/select.png',
      un_select_image: 'mask/select.png',
      default_type: BLANK_TYPE,
      optional_types: widgetOptionalArray,
      count: widgetOptionalArray.length,
      tips_BG: 'mask/tips.png',
      tips_x: -px((124-92)/2),
      tips_y: px(92+4),
      tips_width: px(124),
      select_list: {
        title_font_size: 34,
        title_align_h: align.CENTER_H,
        list_item_vspace: 8,
        list_tips_text_font_size: 32,
        list_tips_text_align_h: align.LEFT,
      }
    })
    let item4 = editGroup4.getProperty(prop.CURRENT_TYPE);
    try { EditTypesUtil.drawWidget(item4, editableWidgetsIds[3]) } catch(e) { logger.log('widget 4 error: ' + e) }

    createWidget(widget.WATCHFACE_EDIT_MASK, {
      x: 0, y: 0, w: px(480), h: px(480),
      src: 'mask/mask0.png',
      show_level: show_level.ONLY_EDIT
    })


    createWidget(widget.WIDGET_DELEGATE, {
      resume_call: function () {
        if ( DEBUG ) logger.log('resume_call');

        if (screenType == SCENE_AOD) {
          hourTextWidgetA.setProperty(prop.MORE, {text : '', x: HaX});
          minuteTextWidgetA.setProperty(prop.MORE, {text : '', x: MaX});
          hourTextWidgetB.setProperty(prop.MORE, {text : '', x: HbX});
          minuteTextWidgetB.setProperty(prop.MORE, {text : '', x: MbX});
          hourAODWidget.setProperty(prop.MORE, {text : `${NumberToText.getHours(timeSensor.getHours())}` });
          minuteAODWidget.setProperty(prop.MORE, {text : `${NumberToText.getMinutes(timeSensor.getMinutes())}` });
        } else {
          _refreshColors()
          if ( DEBUG ) { secondTextWidget.setProperty(prop.MORE, {text : `${timeSensor.getSeconds()}s · ${_memLine()}` }) }
          hourTextWidgetA.setProperty(prop.MORE, {text : `${NumberToText.getHours(timeSensor.getHours())}`, x: HaX, color: hourColor });
          minuteTextWidgetA.setProperty(prop.MORE, {text : `${NumberToText.getMinutes(timeSensor.getMinutes())}`, x: MaX, color: minuteColor });
          hourTextWidgetB.setProperty(prop.MORE, {text : '', x: HbX});
          minuteTextWidgetB.setProperty(prop.MORE, {text : '', x: MbX});
          hourAODWidget.setProperty(prop.MORE, {text : ''});
          minuteAODWidget.setProperty(prop.MORE, {text : ''});
          updateDateWidget();
        }
      },
      pause_call: function () {
        if ( DEBUG ) logger.log('ui pause');
      },
    });

    if ( DEBUG ) {
      logger.log('[mem] after build: ' + _memLine());
      logger.log('[mem] modules: ' + _memModules());
      setInterval(() => {
        secondTextWidget.setProperty(prop.MORE, {text : `${timeSensor.getSeconds()}s · ${_memLine()}` });
      }, 1000);
    };

    /* SENSOR EVENTS */
    timeSensor.onPerDay(() => {
      if ( DEBUG ) logger.log('onPerDay: ' + timeSensor.getDay() + '-' + timeSensor.getMonth())
      updateDateWidget();
    });

    timeSensor.onPerMinute(() => {
      let hour = timeSensor.getHours();
      let min = timeSensor.getMinutes();
      if ( DEBUG ) logger.log('onPerMinute: ' + hour + ':' + min);

      if (screenType == SCENE_AOD) {
        hourAODWidget.setProperty(prop.MORE, {text : `${NumberToText.getHours(hour)}` });
        minuteAODWidget.setProperty(prop.MORE, {text : `${NumberToText.getMinutes(min)}` });
      } else {
        minuteTextWidgetB.setProperty(prop.MORE, {text : `${NumberToText.getMinutes(min)}`, x: MbX });

        minuteTextWidgetA.setProperty(prop.ANIM_STATUS, {
          anim_id: animIdMinuteA,
          anim_status: anim_status.START
        });

        minuteTextWidgetB.setProperty(prop.ANIM_STATUS, {
          anim_id: animIdMinuteB,
          anim_status: anim_status.START
        });

        if (min == 0) {
          hourTextWidgetB.setProperty(prop.MORE, {text : `${NumberToText.getHours(hour)}`, x: HbX });

          hourTextWidgetA.setProperty(prop.ANIM_STATUS, {
            anim_id: animIdHourA,
            anim_status: anim_status.START
          });

          hourTextWidgetB.setProperty(prop.ANIM_STATUS, {
            anim_id: animIdHourB,
            anim_status: anim_status.START
          });

        }
      }
    })

    function updateDateWidget(){
      dateTextWidget.setProperty(prop.MORE, {
        text: NumberToText.getDate(timeSensor.getDay(), timeSensor.getDate(), timeSensor.getMonth()),
        color: dateColor
      });
    }

  },

  onInit() {
    if ( DEBUG ) logger.log('onInit invoke');
  },

  build() {
    if ( DEBUG ) logger.log('onBuild invoke');
    this.textWatchBuild();
  },

  onDestroy() {
    if ( DEBUG ) logger.log('onDestroy invoke');
    deleteWidget(dateTextWidget);
    deleteWidget(hourTextWidgetA);
    deleteWidget(hourTextWidgetB);
    deleteWidget(minuteTextWidgetA);
    deleteWidget(minuteTextWidgetB);

    deleteWidget(hourAODWidget);
    deleteWidget(minuteAODWidget);

    deleteWidget(editGroup1);
    deleteWidget(editGroup2);
    deleteWidget(editGroup3);
    deleteWidget(editGroup4);
    deleteWidget(editGroup5);

    deleteWidget(colorGroupHour);
    deleteWidget(colorGroupMinute);
    deleteWidget(colorGroupDate);

    editBgWidget = null;
    dateTextWidget = null;
    hourTextWidgetA = null;
    hourTextWidgetB = null;
    minuteTextWidgetA = null;
    minuteTextWidgetB = null;

    hourAODWidget = null;
    minuteAODWidget = null;

    editGroup1 = null;
    editGroup2 = null;
    editGroup3 = null;
    editGroup4 = null;
    editGroup5 = null;

    colorGroupHour   = null;
    colorGroupMinute = null;
    colorGroupDate   = null;
    editBgWidget     = null;

  },
})

})()
} catch (e) {
  console.log(e);
}
