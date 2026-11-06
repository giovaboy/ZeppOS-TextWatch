import { createWidget, widget, align, show_level, data_type, edit_type, prop } from '@zos/ui'
import { Sleep, Stand, BodyTemperature, Pai, Weather, Time } from '@zos/sensor'
import { px } from '@zos/utils'

// ─── Sensor cache (module-level, shared across all slots) ─────────────────────
const _sc = {}
function _sen(key, Cls) {
  if (!(key in _sc)) { try { _sc[key] = new Cls() } catch(_) { _sc[key] = null } }
  return _sc[key]
}

// Returns a function () → formatted string for a given widget def
function _makeReader(def) {
  return () => {
    try {
      const dt = def.dt
      if (dt === data_type.STAND) {
        const s = _sen('stand', Stand)
        const v = s?.getCurrent?.(), g = s?.getTarget?.()
        return (v != null && g != null) ? `${v}/${g}` : '--'
      }
      if (dt === data_type.SLEEP) {
        const info = _sen('sleep', Sleep)?.getInfo?.()
        const mins = info?.totalTime
        return mins > 0 ? `${Math.floor(mins/60)}.${String(mins%60).padStart(2,'0')}` : '--'
      }
      if (def.bodyTemp) {
        const cur = _sen('bodyT', BodyTemperature)?.getCurrent?.()
        const v = cur?.value
        return (v != null && v > 0) ? (v / 100).toFixed(1) + '°' : '--'
      }
    } catch (_) {}
    return '--'
  }
}

// ─── Path constants ───────────────────────────────────────────────────────────
const numPath     = 'numbers_28/' // only p.png is still used (IMG_POINTER)
const iconBg      = 'iconbg/'
const XicPath     = 'xicon/'
const previewPath = 'preview/'
const heartPath   = 'heart/'
const UVIPath     = 'UVI/'

// ─── Image arrays ─────────────────────────────────────────────────────────────
const weatherArray = Array.from({ length: 29 }, (_, i) => `weather/${i}.png`)
const moonArray    = Array.from({ length: 29 }, (_, i) => `moon/${i + 1}.png`)
const heartArray   = Array.from({ length: 6 },  (_, i) => `${heartPath}${i + 1}.png`)
const uviArray     = Array.from({ length: 5 },  (_, i) => `${UVIPath}${i + 1}.png`)
const windDirArray = Array.from({ length: 8 },  (_, i) => `wind/wind_${i}.png`)

// ─── Slot geometry ────────────────────────────────────────────────────────────
const SLOT_X = { 110: 50, 111: 146, 112: 242, 113: 194, 114: 338 }
const SLOT_Y = { 110: 290, 111: 290, 112: 290, 113:   5, 114: 290 }

// ─── Widget text color (set before drawWidget based on background brightness) ──
let _wTC = 0xffffff
export function setWidgetTextColor(color) { _wTC = color }

// Custom type for blank/empty slot
export const BLANK_TYPE = 0x186b0

// ─── Widget definitions ───────────────────────────────────────────────────────
// r:        renderer
// dt:       data_type for TEXT_FONT / ARC_PROGRESS / IMG_POINTER / IMG_LEVEL
// jumpType: data_type for IMG_CLICK (opens the system app)
// icon:     file stem in xicon/
// bg:       file stem in iconbg/
// color:    arc color ('arc' renderer only)
// unit:     true → unit_type:1 on TEXT_FONT (adds the unit symbol)
// padding:  true → padding on TEXT_FONT (alarm only)
const WIDGET_DEFS = {
  // ── arc + number + icon ────────────────────────────────────────────────────
  [edit_type.STEP]:               { r:'arc',      dt: data_type.STEP,               icon:'step',      bg:'step',      color:0x06a5ff, jumpType: data_type.STEP,               sysText:true },
  [edit_type.CAL]:                { r:'arc',      dt: data_type.CAL,                icon:'kcal',      bg:'cal',       color:0xdf4f26, jumpType: data_type.CAL,                sysText:true },
  [edit_type.PAI]:                { r:'arc',      dt: data_type.PAI_WEEKLY,         icon:'Pai',       bg:'pai',       color:0xd612c0, jumpType: data_type.PAI_WEEKLY,         sysText:true },
  [edit_type.BATTERY]:            { r:'arc',      dt: data_type.BATTERY,            icon:'bat',       bg:'bat',       color:0x06c18a, jumpType: data_type.BATTERY,            sysText:true, unit:true },
  [edit_type.BIO_CHARGE]:         { r:'pointer',  dt: data_type.BIO_CHARGE,         icon:'bio_charge', bg:'bio_charge',                jumpType: data_type.BIO_CHARGE,                         invalid:true },
  [edit_type.STAND]:              { r:'arc',      dt: data_type.STAND,              icon:'stand',     bg:'step',      color:0x06a5ff, jumpType: data_type.STAND,              sysText:true },
  [edit_type.RECOVERY_TIME]:      { r:'arc',      dt: data_type.RECOVERY_TIME,      icon:'recovery',  bg:'recovery',  color:0x06a5ff, jumpType: data_type.RECOVERY_TIME,      sysText:true },
  [edit_type.VO2MAX]:             { r:'pointer',  dt: data_type.VO2MAX,             icon:'vo2',       bg:'vo2',                       jumpType: data_type.VO2MAX,             invalid:true },
  // ── background + number + icon ────────────────────────────────────────────
  [edit_type.DISTANCE]:           { r:'numeric',  dt: data_type.DISTANCE,           icon:'dis',       bg:'dis',                       jumpType: data_type.DISTANCE,           sysText:true },
  [edit_type.SLEEP]:              { r:'numeric',  dt: data_type.SLEEP,              icon:'sleep',     bg:'sleep',                     jumpType: data_type.SLEEP,              dot:'point', invalid:true },
  [edit_type.STRESS]:             { r:'numeric',  dt: data_type.STRESS,             icon:'pressure',  bg:'kpa',                       jumpType: data_type.STRESS,             sysText:true },
  [edit_type.FAT_BURN]:           { r:'numeric',  dt: data_type.FAT_BURN,           icon:'sport',     bg:'sport',                     jumpType: data_type.FAT_BURNING,        sysText:true },
  [edit_type.HUMIDITY]:           { r:'numeric',  dt: data_type.HUMIDITY,           icon:'humidity',  bg:'kpa',                       jumpType: data_type.HUMIDITY,           sysText:true, unit:true },
  [edit_type.ALTIMETER]:          { r:'numeric',  dt: data_type.ALTIMETER,          icon:'Kpa',       bg:'kpa',                       jumpType: data_type.ALTIMETER,          sysText:true },
  [edit_type.ALTITUDE]:           { r:'numeric',  dt: data_type.ALTITUDE,           icon:'altitude',  bg:'kpa',                       jumpType: data_type.ALTITUDE,           sysText:true },
  [edit_type.STOP_WATCH]:         { r:'numeric',  dt: data_type.STOP_WATCH,         icon:'stopwatch', bg:'dis',                       jumpType: data_type.STOP_WATCH,         sysText:true },
  [edit_type.ALARM_CLOCK]:        { r:'numeric',  dt: data_type.ALARM_CLOCK,        icon:'alarm',     bg:'dis',                       jumpType: data_type.ALARM_CLOCK,        sysText:true, padding:true },
  [edit_type.COUNT_DOWN]:         { r:'numeric',  dt: data_type.COUNT_DOWN,         icon:'stopwatch', bg:'dis',                       jumpType: data_type.COUNT_DOWN,         sysText:true },
  [edit_type.TRAINING_LOAD]:      { r:'numeric',  dt: data_type.TRAINING_LOAD,      icon:'recovery',  bg:'recovery',                  jumpType: data_type.TRAINING_LOAD,      sysText:true },
  // ── rotating pointer ──────────────────────────────────────────────────────
  [edit_type.SPO2]:               { r:'pointer',  dt: data_type.SPO2,               icon:'spo2',      bg:'spo2',                      jumpType: data_type.SPO2,               unit:'percent', invalid:true },
  [edit_type.WIND]:               { r:'wind',                                        icon:'wind',      bg:'wind',                      jumpType: data_type.WIND,               invalid:true },
  [edit_type.TEMPERATURE]:        { r:'pointerT', dt: data_type.WEATHER_CURRENT,    icon:'T',         bg:'t',                         jumpType: data_type.BODY_TEMP,          bodyTemp:true },
  // ── special ───────────────────────────────────────────────────────────────
  [edit_type.HEART]:              { r:'heart',    dt: data_type.HEART,              icon:'heart',                                     jumpType: data_type.HEART,              sysText:true },
  [edit_type.UVI]:                { r:'uvi',      dt: data_type.UVI,                icon:'UVI',                                       jumpType: data_type.UVI,                invalid:true },
  [edit_type.MOON]:               { r:'moon',     dt: data_type.MOON,                                                                 jumpType: data_type.MOON_CURRENT },
  [edit_type.WEATHER]:            { r:'weather',  dt: data_type.WEATHER_CURRENT,                      bg:'weather',                   jumpType: data_type.WEATHER,            unit:'degree', neg:true, invalid:'w' },
  // ── newer ones ────────────────────────────────────────────────────────────
  [edit_type.PAI_WEEKLY]:         { r:'paiWeekly',                                                                                    jumpType: data_type.PAI_WEEKLY },
  [edit_type.SUN]:                { r:'sun',                                                                                          jumpType: data_type.SUN_CURRENT },
}

// ─── Optional widget list (edit menu) ─────────────────────────────────────────
export const widgetOptionalArray = [
  { type: BLANK_TYPE,           preview: 'bg/color/prev_blank.png',     title_en: 'Empty',     title_sc: 'Vuoto',      title_tc: 'Vuoto'      },
  { type: edit_type.BIO_CHARGE,    preview: previewPath + 'bio_charge.png',     title_en: 'BioCharge',    title_sc: 'BioCarica',  title_tc: 'BioCarica'  },
  { type: edit_type.STOP_WATCH,    preview: previewPath + 'stopwatch.png',     title_en: 'Stopwatch',    title_sc: 'Cronometro', title_tc: 'Cronometro' },
  { type: edit_type.COUNT_DOWN,    preview: previewPath + 'countdown.png',     title_en: 'Countdown',    title_sc: 'Countdown',  title_tc: 'Countdown'  },
  { type: edit_type.ALARM_CLOCK,   preview: previewPath + 'alarm.png',         title_en: 'Alarm',        title_sc: 'Sveglia',    title_tc: 'Sveglia'    },
  { type: edit_type.STEP,          preview: previewPath + 'step.png'     },
  { type: edit_type.CAL,           preview: previewPath + 'kcal.png'     },
  { type: edit_type.BATTERY,       preview: previewPath + 'bat.png'      },
  { type: edit_type.HEART,         preview: previewPath + 'heart.png'    },
  { type: edit_type.UVI,           preview: previewPath + 'UVI.png'      },
  { type: edit_type.PAI,           preview: previewPath + 'Pai.png'      },
  { type: edit_type.DISTANCE,      preview: previewPath + 'dis.png'      },
  { type: edit_type.STAND,         preview: previewPath + 'stand.png'    },
  { type: edit_type.SPO2,          preview: previewPath + 'spo2.png'     },
  { type: edit_type.STRESS,        preview: previewPath + 'pressure.png' },
  { type: edit_type.SLEEP,         preview: previewPath + 'sleep.png'    },
  { type: edit_type.HUMIDITY,      preview: previewPath + 'humidity.png' },
  { type: edit_type.WIND,          preview: previewPath + 'wind.png'     },
  { type: edit_type.WEATHER,       preview: previewPath + 'weather.png'  },
  { type: edit_type.TEMPERATURE,   preview: previewPath + 'T.png'        },
  { type: edit_type.FAT_BURN,      preview: previewPath + 'sport.png'    },
  { type: edit_type.VO2MAX,        preview: previewPath + 'vo2.png'      },
  { type: edit_type.RECOVERY_TIME, preview: previewPath + 'recovery.png' },
  { type: edit_type.TRAINING_LOAD, preview: previewPath + 'training_load.png' },
  { type: edit_type.ALTIMETER,     preview: previewPath + 'Kpa.png'      },
  { type: edit_type.ALTITUDE,      preview: previewPath + 'Kpa.png'      },
  { type: edit_type.MOON,          preview: previewPath + 'moon.png'     },
  { type: edit_type.PAI_WEEKLY,    preview: previewPath + 'Pai.png'      },
  { type: edit_type.SUN,           preview: previewPath + 'sun.png'      },
]

// ─── Renderer ─────────────────────────────────────────────────────────────────
export default class EditTypesUtil {

  static drawWidget(editType, slotId, overrideX = null) {
    const slotBaseX = overrideX !== null ? overrideX : SLOT_X[slotId]
    const slotBaseY = SLOT_Y[slotId]
    if (slotBaseX === undefined || slotBaseY === undefined) return
    const def = WIDGET_DEFS[editType]
    if (!def) return

    // Slot geometry
    const sx  = px(slotBaseX)
    const sy  = px(slotBaseY)
    const bgx = sx + px(4)
    const bgy = sy + px(4)
    const bgw = px(92)
    const numX  = sx
    const numY  = sy + px(32)
    const numH  = px(20)
    const iconX = sx + px(30)
    const iconY = sy + px(56)
    const cx = sx + px(46)
    const cy = sy + px(46)

    const iconPath = def.icon ? XicPath + def.icon + '.png' : null
    const bgImg    = def.bg   ? iconBg  + def.bg  + '.png' : null

    // Native navigation through IMG_CLICK — always created last (z-order above everything)
    function addJump() {
      createWidget(widget.IMG_CLICK, {
        x: bgx, y: bgy, w: bgw, h: bgw,
        type: def.jumpType,
        show_level: show_level.ONLY_NORMAL,
      })
    }

    function drawBg() {
      createWidget(widget.IMG, {
        x: bgx, y: bgy, w: bgw, h: bgw, src: bgImg,
        show_level: show_level.ONLY_NORMAL,
      })
    }

    // Number (TEXT) + icon — manual renderers (pointerT, sleep)
    function drawIconText(getValue) {
      const tw = createWidget(widget.TEXT, {
        x: numX, y: numY, w: bgw, h: numH,
        text: getValue(), text_size: px(26), color: _wTC,
        align_h: align.CENTER_H, align_v: align.CENTER_V,
        show_level: show_level.ONLY_NORMAL,
      })
      if (iconPath) {
        createWidget(widget.IMG, {
          x: iconX, y: iconY, src: iconPath,
          show_level: show_level.ONLY_NORMAL,
        })
      }
      createWidget(widget.WIDGET_DELEGATE, {
        resume_call: () => tw.setProperty(prop.MORE, { text: getValue() })
      })
    }

    switch (def.r) {

      case 'arc':
        drawBg()
        createWidget(widget.ARC_PROGRESS, {
          x: 0, y: 0, w: bgw, h: bgw,
          center_x: cx, center_y: cy,
          radius: px(35), start_angle: -139, end_angle: 139,
          line_width: px(8), color: def.color, type: def.dt,
          show_level: show_level.ONLY_NORMAL,
        })
        if (def.sysText) {
          createWidget(widget.TEXT_FONT, {
            x: numX, y: numY, w: bgw, h: numH,
            type: def.dt, unit_type: def.unit ? 1 : 0,
            text_size: px(26), color: _wTC,
            align_h: align.CENTER_H, align_v: align.CENTER_V,
            show_level: show_level.ONLY_NORMAL,
          })
          if (iconPath) {
            createWidget(widget.IMG, {
              x: iconX, y: iconY, src: iconPath,
              show_level: show_level.ONLY_NORMAL,
            })
          }
        } else {
          drawIconText(_makeReader(def))
        }
        addJump()
        break

      case 'numeric': {
        drawBg()
        if (def.sysText) {
          createWidget(widget.TEXT_FONT, {
            x: numX, y: numY - px(6), w: bgw, h: numH,
            type: def.dt, padding: def.padding || false, unit_type: def.unit ? 1 : 0,
            text_size: px(26), color: _wTC,
            align_h: align.CENTER_H, align_v: align.CENTER_V,
            show_level: show_level.ONLY_NORMAL,
          })
        } else {
          const getVal = _makeReader(def)
          const tw = createWidget(widget.TEXT, {
            x: numX, y: numY - px(6), w: bgw, h: numH,
            text: getVal(), text_size: px(26), color: _wTC,
            align_h: align.CENTER_H, align_v: align.CENTER_V,
            show_level: show_level.ONLY_NORMAL,
          })
          createWidget(widget.WIDGET_DELEGATE, {
            resume_call: () => tw.setProperty(prop.MORE, { text: getVal() })
          })
        }
        createWidget(widget.IMG, {
          x: iconX, y: iconY - px(5), src: iconPath,
          show_level: show_level.ONLY_NORMAL,
        })
        addJump()
        break
      }

      case 'pointer':
        drawBg()
        createWidget(widget.IMG_POINTER, {
          src: numPath + 'p.png',
          center_x: cx, center_y: cy,
          x: px(6), y: px(40),
          type: def.dt, start_angle: -135, end_angle: 135,
          show_level: show_level.ONLY_NORMAL,
        })
        createWidget(widget.TEXT_FONT, {
          x: numX, y: numY, w: bgw, h: numH,
          type: def.dt, unit_type: def.unit ? 1 : 0,
          text_size: px(26), color: _wTC,
          align_h: align.CENTER_H, align_v: align.CENTER_V,
          show_level: show_level.ONLY_NORMAL,
        })
        if (iconPath) {
          createWidget(widget.IMG, {
            x: iconX, y: iconY, src: iconPath,
            show_level: show_level.ONLY_NORMAL,
          })
        }
        addJump()
        break

      case 'pointerT':
        drawBg()
        createWidget(widget.IMG_POINTER, {
          src: numPath + 'p.png',
          center_x: cx, center_y: cy,
          x: px(6), y: px(40),
          type: def.dt, start_angle: -135, end_angle: 135,
          show_level: show_level.ONLY_NORMAL,
        })
        drawIconText(_makeReader(def))
        addJump()
        break

      case 'wind': {
        drawBg()
        createWidget(widget.IMG_LEVEL, {
          x: cx - px(44), y: cy - px(44), w: px(88), h: px(88),
          image_array: windDirArray, image_length: windDirArray.length,
          type: data_type.WIND_DIRECTION,
          show_level: show_level.ONLY_NORMAL,
        })
        createWidget(widget.TEXT_FONT, {
          x: numX, y: numY, w: bgw, h: numH,
          type: data_type.WIND,
          text_size: px(26), color: _wTC,
          align_h: align.CENTER_H, align_v: align.CENTER_V,
          show_level: show_level.ONLY_NORMAL,
        })
        if (iconPath) {
          createWidget(widget.IMG, {
            x: iconX, y: iconY, src: iconPath,
            show_level: show_level.ONLY_NORMAL,
          })
        }
        addJump()
        break
      }

      case 'heart':
        createWidget(widget.IMG, {
          x: bgx, y: bgy, alpha: 255, src: heartPath + 'heart0.png',
          show_level: show_level.ONLY_NORMAL,
        })
        createWidget(widget.IMG_LEVEL, {
          x: bgx, y: bgy, image_array: heartArray, image_length: heartArray.length,
          type: def.dt, show_level: show_level.ONLY_NORMAL,
        })
        createWidget(widget.TEXT_FONT, {
          x: numX, y: numY, w: bgw, h: numH,
          type: def.dt, text_size: px(26), color: _wTC,
          align_h: align.CENTER_H, align_v: align.CENTER_V,
          show_level: show_level.ONLY_NORMAL,
        })
        if (iconPath) {
          createWidget(widget.IMG, {
            x: iconX, y: iconY, src: iconPath,
            show_level: show_level.ONLY_NORMAL,
          })
        }
        addJump()
        break

      case 'uvi':
        createWidget(widget.IMG, {
          x: bgx, y: bgy, alpha: 255, src: UVIPath + 'uvi0.png',
          show_level: show_level.ONLY_NORMAL,
        })
        createWidget(widget.IMG_LEVEL, {
          x: bgx, y: bgy, image_array: uviArray, image_length: uviArray.length,
          type: def.dt, show_level: show_level.ONLY_NORMAL,
        })
        createWidget(widget.TEXT_FONT, {
          x: numX, y: numY, w: bgw, h: numH,
          type: def.dt, text_size: px(26), color: _wTC,
          align_h: align.CENTER_H, align_v: align.CENTER_V,
          show_level: show_level.ONLY_NORMAL,
        })
        if (iconPath) {
          createWidget(widget.IMG, {
            x: iconX, y: iconY, src: iconPath,
            show_level: show_level.ONLY_NORMAL,
          })
        }
        addJump()
        break

      case 'moon':
        createWidget(widget.IMG_LEVEL, {
          x: bgx, y: bgy, image_array: moonArray, image_length: moonArray.length,
          type: def.dt, show_level: show_level.ONLY_NORMAL,
        })
        addJump()
        break

      case 'weather': {
        drawBg()
        createWidget(widget.TEXT_FONT, {
          x: numX, y: numY - px(6), w: bgw, h: numH,
          type: data_type.WEATHER_CURRENT, unit_type: 1,
          text_size: px(26), color: _wTC,
          align_h: align.CENTER_H, align_v: align.CENTER_V,
          show_level: show_level.ONLY_NORMAL,
        })
        createWidget(widget.IMG_LEVEL, {
          x: iconX, y: iconY - px(5),
          image_array: weatherArray, image_length: weatherArray.length,
          type: data_type.WEATHER, show_level: show_level.ONLY_NORMAL,
        })
        addJump()
        break
      }

      case 'paiWeekly': {
        const BAR_W   = px(8)
        const BAR_H   = px(28)
        const BAR_GAP = px(2)
        const barXCoords = Array.from({ length: 7 },
          (_, i) => Math.round(cx - 3.5 * BAR_W - 3 * BAR_GAP + i * (BAR_W + BAR_GAP))
        )
        const barBaseY = cy - Math.round(BAR_H / 2)

        createWidget(widget.IMG, {
          x: iconX, y: iconY, src: XicPath + 'Pai.png',
          show_level: show_level.ONLY_NORMAL,
        })

        // background bars
        barXCoords.forEach(bx => createWidget(widget.FILL_RECT, {
          x: bx, y: barBaseY, w: BAR_W, h: BAR_H,
          radius: Math.round(BAR_W / 2), color: 0x4a1048,
          show_level: show_level.ONLY_NORMAL,
        }))

        // active bars — start empty, updated right away and on resume
        const paiSensor = _sen('pai', Pai)

        const barWidgets = barXCoords.map(bx => createWidget(widget.FILL_RECT, {
          x: bx, y: barBaseY + BAR_H - 1, w: BAR_W, h: 1,
          radius: Math.round(BAR_W / 2), color: 0xd612c0,
          show_level: show_level.ONLY_NORMAL,
        }))

        // PAI total text — created after the bars to stay on top (z-order)
        const paiTextW = createWidget(widget.TEXT, {
          x: sx, y: sy + px(4), w: bgw, h: px(30),
          text: '--', text_size: px(26), color: _wTC,
          align_h: align.CENTER_H, align_v: align.CENTER_V,
          show_level: show_level.ONLY_NORMAL,
        })

        function _updatePaiBars() {
          if (!paiSensor) return
          const total = paiSensor.getTotal()
          const week = [...(paiSensor.getLastWeek() || [])].reverse()
          const maxVal = 75
          barWidgets.forEach((bar, i) => {
            const height = Math.round(((week[i] || 0) / maxVal) * BAR_H)
            bar.setProperty(prop.MORE, {
              x: barXCoords[i], y: barBaseY + BAR_H - height,
              w: BAR_W, h: height,
              radius: Math.round(BAR_W / 2), color: 0xd612c0,
            })
          })
          paiTextW.setProperty(prop.MORE, { text: total != null ? String(total) : '--' })
        }

        _updatePaiBars()
        createWidget(widget.WIDGET_DELEGATE, { resume_call: () => _updatePaiBars() })
        addJump()
        break
      }

      case 'sun': {
        const ARC_RADIUS = px(35)
        const ARC_LINE_W = px(8)
        const DOT_OVER   = px(1)
        const dotArea    = px(92) + 2 * DOT_OVER

        createWidget(widget.ARC_PROGRESS, {
          center_x: cx, center_y: cy,
          radius: ARC_RADIUS, start_angle: 0, end_angle: 360,
          color: 0x333344, line_width: ARC_LINE_W,
          level: 100, corner_flag: 0, show_level: show_level.ONLY_NORMAL,
        })

        const dayArc = createWidget(widget.ARC_PROGRESS, {
          center_x: cx, center_y: cy,
          radius: ARC_RADIUS, start_angle: 0, end_angle: 0,
          color: 0xffaa00, line_width: ARC_LINE_W,
          level: 100, corner_flag: 0, show_level: show_level.ONLY_NORMAL,
        })

        const DOT_CX = Math.round(dotArea / 2)
        const DOT_CY = Math.round(dotArea / 2)
        const dotWidget = createWidget(widget.IMG, {
          x: sx - DOT_OVER, y: sy - DOT_OVER,
          w: dotArea, h: dotArea,
          pos_x: DOT_CX - px(6),
          pos_y: DOT_CY - ARC_RADIUS - px(4),
          center_x: DOT_CX,
          center_y: DOT_CY,
          angle: 0, src: numPath + 'p.png',
          show_level: show_level.ONLY_NORMAL,
        })

        const sunIconW = createWidget(widget.IMG, {
          x: cx - px(16), y: cy - px(24),
          src: 'xicon/sunrise.png', show_level: show_level.ONLY_NORMAL,
        })

        const sunTextW = createWidget(widget.TEXT, {
          x: sx, y: cy + px(8), w: bgw, h: px(22),
          text: '--:--', text_size: px(20), color: _wTC,
          align_h: align.CENTER_H, align_v: align.CENTER_V,
          show_level: show_level.ONLY_NORMAL,
        })

        const sunWeather = new Weather()
        const sunTime    = new Time()

        // getForecast() returns the whole forecast (every day, weather and tide data) just to read
        // today's sunrise and sunset: read it at most once per clock hour, keeping only those two times.
        // The hour key also covers the change of day; a failed read leaves the key unset, so the next
        // resume tries again. Dot and next-event text are recomputed from the cache on every resume.
        let _sunCache = null
        let _sunCacheKey = null

        function _getTideDay() {
          const key = `${sunTime.getMonth()}-${sunTime.getDate()}-${sunTime.getHours()}`
          if (key === _sunCacheKey) return _sunCache
          try {
            const td = sunWeather.getForecast().tideData
            if (!td || !td.count) return _sunCache
            const day = td.data[0] || {}
            if (!day.sunrise || !day.sunset) return _sunCache
            _sunCache = {
              sunrise: { hour: day.sunrise.hour, minute: day.sunrise.minute },
              sunset:  { hour: day.sunset.hour,  minute: day.sunset.minute },
            }
            _sunCacheKey = key
          } catch (e) {}
          return _sunCache
        }

        function _updateSun() {
          const day = _getTideDay()
          if (!day) return
          const riseMins  = day.sunrise.hour * 60 + day.sunrise.minute
          const setMins   = day.sunset.hour  * 60 + day.sunset.minute
          const dayDur    = setMins >= riseMins ? setMins - riseMins : (24 * 60 - riseMins + setMins)
          const halfAngle = (360 * dayDur / (24 * 60)) / 2
          dayArc.setProperty(prop.MORE, {
            center_x: cx, center_y: cy,
            radius: ARC_RADIUS, start_angle: -halfAngle, end_angle: halfAngle,
            color: 0xffaa00, line_width: ARC_LINE_W,
            level: 100, corner_flag: 0, show_level: show_level.ONLY_NORMAL,
          })
          const noon     = (riseMins + dayDur / 2) % (24 * 60)
          const midnight = (noon + 12 * 60) % (24 * 60)
          const nowMins  = sunTime.getHours() * 60 + sunTime.getMinutes()
          let diff = nowMins - midnight
          if (diff < 0) diff += 24 * 60
          dotWidget.setProperty(prop.MORE, { angle: diff / (24 * 60) * 360 - 180 })
          const isDay  = nowMins >= riseMins && nowMins <= setMins
          const evType = isDay ? 'sunset' : 'sunrise'
          const obj    = isDay ? day.sunset : day.sunrise
          const hh = obj.hour.toString().padStart(2, '0')
          const mm = obj.minute.toString().padStart(2, '0')
          sunTextW.setProperty(prop.MORE, { text: `${hh}:${mm}` })
          sunIconW.setProperty(prop.MORE, { src: `xicon/${evType}.png` })
        }

        _updateSun()
        createWidget(widget.WIDGET_DELEGATE, { resume_call: () => _updateSun() })
        addJump()
        break
      }
    }
  }
}
