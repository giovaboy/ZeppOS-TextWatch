import { createWidget, deleteWidget, widget, align, text_style, prop, anim_status, show_level, event, edit_type } from '@zos/ui'
import { getScene, SCENE_AOD, SCENE_WATCHFACE, SCENE_SETTINGS, getPerformance } from '@zos/app'
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
const logger = log.getLogger("textwatch");

const timeSensor = new Time()

// DEBUG: app and system memory from getPerformance (API 4.0; the project targets 3.0, so it can be
// missing on older firmware). A watch face has no side service and no Logs box, so the line goes
// on screen (secondTextWidget) and to the simulator log.
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

// DEBUG: AOD probe. Question: does AOD run a separate JS instance of the watch face (with its own build),
// or the same instance as normal mode? Each instance has its own "load" (the time the module was
// loaded) and counts its own builds; the scene is read both at build and at each update.
//   separate instance → the AOD line says "build aod · now aod", with a different load from the normal one
//   same instance     → the AOD line says "build wf · now aod", with the same load as the normal one
const _hms = () => [timeSensor.getHours(), timeSensor.getMinutes(), timeSensor.getSeconds()].map(n => String(n).padStart(2, '0')).join(':')
const _sceneName = (s) => s === SCENE_AOD ? 'aod' : s === SCENE_WATCHFACE ? 'wf' : s === SCENE_SETTINGS ? 'edit' : String(s)
const _dbgLoadAt = _hms()
let _dbgBuilds = 0
let _dbgBuildAt = ''
let _dbgBuildScene = ''
function _probeLine() {
  let now = '?'
  try { now = _sceneName(getScene()) } catch (_) {}
  return `load ${_dbgLoadAt} · build#${_dbgBuilds} ${_dbgBuildAt} ${_dbgBuildScene} · now ${now}`
}
// DEBUG: how many times the minute tick and the wake overlapped (see _shownMinute)
let _dbgTicksSkipped = 0
let _dbgWakesInAnim = 0
const _dbgText = (tag) => `${tag} ${_probeLine()}\n${_memLine()} · upd ${_hms()}\ntick skip ${_dbgTicksSkipped} · wake in anim ${_dbgWakesInAnim}`
function _dbgUpdate() {
  if (secondTextWidget) secondTextWidget.setProperty(prop.MORE, { text: _dbgText('N') })
  if (aodDebugWidget)   aodDebugWidget.setProperty(prop.MORE, { text: _dbgText('AOD') })
}

// Barlow has no Cyrillic: Russian (lang 4) uses Inter (Latin + Cyrillic subset)
const _isRu = (() => { try { return getLanguage() === 4 } catch (_) { return false } })()
const _isFr = (() => { try { return getLanguage() === 6 } catch (_) { return false } })()

const dateTextSize = px(28);
// Russian: the worst string ("и пятьдесят восемь") overflows the widget at 64px; at 56px the margin is tiny (~6px)
// French: "et cinquante-quatre" slightly overflows at 64px; 60px leaves a margin of ~18px
const minuteTextSize = _isRu ? px(56) : _isFr ? px(60) : px(64);
const hourTextSize = px(64);

const HaH = (hourTextSize * 1.25);
const HbH = HaH;
const MaH = HaH; // fixed box: the smaller ru text stays centred where the overlays and layout expect it
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

const dummyCharsetMinute = _isRu ? ' авдеиклмнопрстцчшыья' : 'acdegimnopqrstuvé';
const dummyCharsetHour = _isRu ? 'авдеилмнопрстцчшыья' : 'acdegimnopqrstuvzé';
const dummyCharsetDate = _isRu ? 'абвгдеиклмнопрстуфцчьюя,0123456789' : 'abcdefgilmnoprstuvzì0123456789';

const hourNormalFont = _isRu ? 'fonts/Inter-Medium.ttf' : 'fonts/Barlow-Medium.ttf';
const minuteNormalFont = _isRu ? 'fonts/Inter-Regular.ttf' : 'fonts/Barlow-Regular.ttf';

// Date and minutes share one TTF (there used to be an identical copy, Barlow-RegularDate.ttf, to work around
// a rendering problem with one file at two sizes, which did not show up in testing in November 2026).
const dateFont = _isRu ? 'fonts/Inter-Regular.ttf' : 'fonts/Barlow-Regular.ttf';

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
let aodDebugWidget = null;

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

// ── AOD widgets (used by the AOD build and, as a fallback, by the normal one) ───
function _createAODBackground() {
  createWidget(widget.FILL_RECT, {
    x: px(0), y: px(0),
    w: px(480), h: px(480),
    color: aodBgColor, show_level: show_level.ONAL_AOD
  });
}
function _createHourAOD() {
  hourAODWidget = createWidget(widget.TEXT, { font: hourAODFont, text: dummyCharsetHour,
    x: HaX, y: HaY, w: HaW, h: HaH, text_size: hourTextSize, color: hourAODColor, show_level: show_level.ONAL_AOD, align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.ELLIPSIS })
  hourAODWidget.setProperty(prop.MORE, { text: `${NumberToText.getHours(timeSensor.getHours())}` });
}
function _createMinuteAOD() {
  minuteAODWidget = createWidget(widget.TEXT, { font: minuteAODFont, text: dummyCharsetMinute,
    show_level: show_level.ONAL_AOD, x: MaX, y: MaY, w: MaW, h: MaH, color: minuteAODColor, text_size: minuteTextSize, align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.ELLIPSIS });
  minuteAODWidget.setProperty(prop.MORE, { text: `${NumberToText.getMinutes(timeSensor.getMinutes())}` });
}
function _updateAOD() {
  hourAODWidget.setProperty(prop.MORE, { text: `${NumberToText.getHours(timeSensor.getHours())}` });
  minuteAODWidget.setProperty(prop.MORE, { text: `${NumberToText.getMinutes(timeSensor.getMinutes())}` });
}

// State of the hour and minute rows in normal mode. The minute tick and the wake can arrive close
// together and in either order, so neither may undo the other's work:
//  - tick after the wake, same minute: the text is already right, so no empty animation;
//  - wake during the animation: the outgoing text isn't put back and the incoming one isn't
//    cleared, or the row stays blank until the animation ends.
let _shownHour = null;
let _shownMinute = null;
let _hourAnimPending = 0;   // animations (0-2) started and not finished yet
let _minuteAnimPending = 0;
let _settleTimer = null;

// DEBUG: three lines above the hours (scene/instance, memory, overlaps), one block per mode, in the same place.
const _dbgOpts = () => ({
  x: px(80), y: px(50), w: px(320), h: px(56), text_size: px(13),
  align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.WRAP,
  color: 0xffffff,
})

// deleteWidget only on widgets that exist: the AOD instance doesn't create the normal-mode ones
function _del(w) { if (w) deleteWidget(w) }


WatchFace({

  // In AOD the system starts a separate instance of the watch face, with its own build (checked on the
  // Cheetah 2 Ultra with the DEBUG probe, 2026-11-02: own load and build, scene aod; the normal instance
  // stays alive meanwhile and is not rebuilt on wake). Every entry into AOD cost ~200 KB to also build
  // the editable background, color pickers, groups and slot widgets, none of them visible in AOD:
  // this creates only what AOD shows.
  aodBuild() {
    _createAODBackground();
    _createHourAOD();
    _createMinuteAOD();

    if ( DEBUG ) {
      aodDebugWidget = createWidget(widget.TEXT, { ..._dbgOpts(), show_level: show_level.ONAL_AOD, text: _dbgText('AOD') });
      logger.log('[aod] build: ' + _probeLine());
      logger.log('[mem] after AOD build: ' + _memLine());
    }

    createWidget(widget.WIDGET_DELEGATE, {
      resume_call: function () {
        if ( DEBUG ) { logger.log('resume_call (aod): ' + _probeLine()); _dbgUpdate() }
        _updateAOD();
      },
    });

    timeSensor.onPerMinute(() => {
      if ( DEBUG ) _dbgUpdate()
      _updateAOD();
    });
  },

  //https://github.com/zepp-health/zeppos-samples/blob/main/application/3.0/3.0-feature/app-service/time_service.js

  textWatchBuild() {

    const screenType = getScene();
    _dbgBuilds++
    _dbgBuildAt = _hms()
    _dbgBuildScene = _sceneName(screenType)

    if (screenType == SCENE_AOD) {
      this.aodBuild();
      return;
    }

    // From here on, normal mode (and the editor). The AOD widgets stay here too as a fallback, should
    // a firmware show AOD from this same instance: they cost little (one rectangle and two texts).
    _createAODBackground();

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

    // Preview lists in the device language (it/en/es/ru/fr, the others fall back to English).
    // Built here and passed straight to createWidget: no reference remains after the build, so the
    // GC frees them (all 15 lists used to stay in memory as module exports).
    const _deviceLang = (() => { try { return getLanguage() } catch(_) { return 2 } })()

    // Hours: 400×80 rectangle, centred horizontally, over the hour text (y=110, h=80)
    const csHour   = _makeColorGroup(COLOR_EDIT_ID.HOUR,   px(40),  px(110), px(400), px(80),  colorOptionalArray('hour',   _deviceLang), 'mask/select_rect.png')
    // Minutes: 400×80 rectangle, centred, over the minute text
    const csMinute = _makeColorGroup(COLOR_EDIT_ID.MINUTE, px(40),  MaY,     px(400), px(80),  colorOptionalArray('minute', _deviceLang), 'mask/select_rect.png', true)
    // Date: 280×35 rectangle, centred (x=100), over the date text
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

    /* HOURS */
    hourTextWidgetA = createWidget(widget.TEXT, { font: hourNormalFont, text: dummyCharsetHour,
      x: HaX, y: HaY, w: HaW, h: HaH, text_size: hourTextSize, color: hourColor, show_level: show_level.ONLY_NORMAL, align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.ELLIPSIS })
    hourTextWidgetB = createWidget(widget.TEXT, { font: hourNormalFont, text: dummyCharsetHour,
      x: HbX, y: HbY, w: HbW, h: HbH, text_size: hourTextSize, color: hourColor, show_level: show_level.ONLY_NORMAL, align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.ELLIPSIS })
    _createHourAOD();

    _shownHour = timeSensor.getHours();
    hourTextWidgetA.setProperty(prop.MORE, { text: `${NumberToText.getHours(_shownHour)}` });
    hourTextWidgetB.setProperty(prop.MORE, { text: '' });

    animIdHourA = hourTextWidgetA.setProperty(prop.ANIM, {
      anim_steps: [anim_step_out],
      anim_fps: animFps,
      anim_auto_start: 0,
      anim_auto_destroy: 0,
      anim_repeat: 0,
      anim_complete_func: () => {
        if ( DEBUG ) logger.log('animation complete animIdHourA');
        _hourAnimPending = Math.max(0, _hourAnimPending - 1);
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
        _hourAnimPending = Math.max(0, _hourAnimPending - 1);
        hourTextWidgetB.setProperty(prop.MORE, {text: '', x: HbX});
      }
    });

    /* MINUTES — create immediately after hours for render priority */
    minuteTextWidgetA = createWidget(widget.TEXT, { font: minuteNormalFont, text: dummyCharsetMinute,
      show_level: show_level.ONLY_NORMAL, x: MaX, y: MaY, w: MaW, h: MaH, color: minuteColor, text_size: minuteTextSize, align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.ELLIPSIS });
    minuteTextWidgetB = createWidget(widget.TEXT, { font: minuteNormalFont, text: dummyCharsetMinute,
      show_level: show_level.ONLY_NORMAL, x: MbX, y: MbY, w: MbW, h: MbH, color: minuteColor, text_size: minuteTextSize, align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.ELLIPSIS });
    _createMinuteAOD();

    _shownMinute = timeSensor.getMinutes();
    minuteTextWidgetA.setProperty(prop.MORE, { text: `${NumberToText.getMinutes(_shownMinute)}` });
    minuteTextWidgetB.setProperty(prop.MORE, { text: '' });

    animIdMinuteA = minuteTextWidgetA.setProperty(prop.ANIM, {
      anim_steps: [anim_step_out],
      anim_fps: animFps,
      anim_auto_start: 0,
      anim_auto_destroy: 0,
      anim_repeat: 0,
      anim_complete_func: () => {
        if ( DEBUG ) logger.log('animation complete animIdMinuteA');
        _minuteAnimPending = Math.max(0, _minuteAnimPending - 1);
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
        _minuteAnimPending = Math.max(0, _minuteAnimPending - 1);
        minuteTextWidgetB.setProperty(prop.MORE, {text: '', x: MbX });
      }
    });

    /* DATE */
    dateTextWidget = createWidget(widget.TEXT,{ font: dateFont, text: dummyCharsetDate,
      x: dateX, y: dateY, w: dateW, h: dateH,
      text_size: dateTextSize, color: dateColor, show_level: show_level.ONLY_NORMAL, align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.ELLIPSIS
    });

    updateDateWidget();

    // tap area: only the date text, extended down to the edge
    createWidget(widget.FILL_RECT, {
      x: dateX, y: dateY, w: dateW, h: px(480) - dateY,
      color: 0x000000, alpha: 0,
      show_level: show_level.ONLY_NORMAL,
    }).addEventListener(event.CLICK_UP, () => {
      launchApp({ appId: SYSTEM_APP_CALENDAR, native: true })
    });

    if ( DEBUG ) {
      secondTextWidget = createWidget(widget.TEXT, { ..._dbgOpts(), show_level: show_level.ONLY_NORMAL, text: _dbgText('N') });
      aodDebugWidget   = createWidget(widget.TEXT, { ..._dbgOpts(), show_level: show_level.ONAL_AOD,    text: _dbgText('AOD') });
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


    // Brings a row to rest: current text in A, in place; B empty and off screen
    function _settleHourRow() {
      _hourAnimPending = 0;
      _shownHour = timeSensor.getHours();
      hourTextWidgetA.setProperty(prop.MORE, {text : `${NumberToText.getHours(_shownHour)}`, x: HaX, color: hourColor });
      hourTextWidgetB.setProperty(prop.MORE, {text : '', x: HbX});
    }
    function _settleMinuteRow() {
      _minuteAnimPending = 0;
      _shownMinute = timeSensor.getMinutes();
      minuteTextWidgetA.setProperty(prop.MORE, {text : `${NumberToText.getMinutes(_shownMinute)}`, x: MaX, color: minuteColor });
      minuteTextWidgetB.setProperty(prop.MORE, {text : '', x: MbX});
    }

    createWidget(widget.WIDGET_DELEGATE, {
      resume_call: function () {
        if ( DEBUG ) {
          if (_hourAnimPending > 0 || _minuteAnimPending > 0) _dbgWakesInAnim++
          logger.log('resume_call: anim pending h' + _hourAnimPending + ' m' + _minuteAnimPending + ' · ' + _probeLine());
          _dbgUpdate()
        }

        if (screenType == SCENE_AOD) {
          hourTextWidgetA.setProperty(prop.MORE, {text : '', x: HaX});
          minuteTextWidgetA.setProperty(prop.MORE, {text : '', x: MaX});
          hourTextWidgetB.setProperty(prop.MORE, {text : '', x: HbX});
          minuteTextWidgetB.setProperty(prop.MORE, {text : '', x: MbX});
          hourAODWidget.setProperty(prop.MORE, {text : `${NumberToText.getHours(timeSensor.getHours())}` });
          minuteAODWidget.setProperty(prop.MORE, {text : `${NumberToText.getMinutes(timeSensor.getMinutes())}` });
        } else {
          _refreshColors()
          // Row at rest: put it in place. Row animating: let it finish, updating only the incoming text;
          // A settles by itself when its animation ends.
          if (_hourAnimPending > 0) {
            _shownHour = timeSensor.getHours();
            hourTextWidgetB.setProperty(prop.MORE, {text : `${NumberToText.getHours(_shownHour)}` });
          } else {
            _settleHourRow();
          }
          if (_minuteAnimPending > 0) {
            _shownMinute = timeSensor.getMinutes();
            minuteTextWidgetB.setProperty(prop.MORE, {text : `${NumberToText.getMinutes(_shownMinute)}` });
          } else {
            _settleMinuteRow();
          }
          // Safety net: if an animation's end never arrives, the row doesn't stay out of place
          if (_hourAnimPending > 0 || _minuteAnimPending > 0) {
            if (_settleTimer) clearTimeout(_settleTimer);
            _settleTimer = setTimeout(() => {
              if (_hourAnimPending > 0) _settleHourRow();
              if (_minuteAnimPending > 0) _settleMinuteRow();
            }, animDuration + 300);
          }
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
      logger.log('[aod] build: ' + _probeLine());
      logger.log('[mem] after build: ' + _memLine());
      logger.log('[mem] modules: ' + _memModules());
      setInterval(() => {
        if (secondTextWidget) secondTextWidget.setProperty(prop.MORE, { text: _dbgText('N') });
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
      if ( DEBUG ) { logger.log('onPerMinute: ' + hour + ':' + min + ' · ' + _probeLine()); _dbgUpdate() }

      if (screenType == SCENE_AOD) {
        hourAODWidget.setProperty(prop.MORE, {text : `${NumberToText.getHours(hour)}` });
        minuteAODWidget.setProperty(prop.MORE, {text : `${NumberToText.getMinutes(min)}` });
      } else {
        // The wake may already have shown this minute: animating it would slide the same text out and back in
        if (DEBUG && min === _shownMinute && hour === _shownHour) { _dbgTicksSkipped++; _dbgUpdate() }

        if (min !== _shownMinute) {
          _shownMinute = min;
          _minuteAnimPending = 2;
          minuteTextWidgetB.setProperty(prop.MORE, {text : `${NumberToText.getMinutes(min)}`, x: MbX });

          minuteTextWidgetA.setProperty(prop.ANIM_STATUS, {
            anim_id: animIdMinuteA,
            anim_status: anim_status.START
          });

          minuteTextWidgetB.setProperty(prop.ANIM_STATUS, {
            anim_id: animIdMinuteB,
            anim_status: anim_status.START
          });
        }

        if (hour !== _shownHour) {
          _shownHour = hour;
          _hourAnimPending = 2;
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
    if (_settleTimer) clearTimeout(_settleTimer);
    _del(dateTextWidget);
    _del(hourTextWidgetA);
    _del(hourTextWidgetB);
    _del(minuteTextWidgetA);
    _del(minuteTextWidgetB);

    _del(hourAODWidget);
    _del(minuteAODWidget);

    _del(editGroup1);
    _del(editGroup2);
    _del(editGroup3);
    _del(editGroup4);
    _del(editGroup5);

    _del(colorGroupHour);
    _del(colorGroupMinute);
    _del(colorGroupDate);

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