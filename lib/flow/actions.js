/* global Homey */
var Util = require('../util.js')

exports.init = function () {
  Homey.manager('flow').on('action.autoconditioning_control', onAutoconditioningControl)
  Homey.manager('flow').on('action.autoconditioning_temperature', onAutonditioningTemperature)
  Homey.manager('flow').on('action.flash_lights', onFlashLights)
  Homey.manager('flow').on('action.honk', onHonk)
  Homey.manager('flow').on('action.panoroof_control', onPanoroofControl)
  Homey.manager('flow').on('action.reset_valet_pin', onResetValetPin)
  Homey.manager('flow').on('action.set_valet_mode', onSetValetMode)
  Homey.manager('flow').on('action.set_valet_mode_pin', onSetValetModeWithPin)
  Homey.manager('flow').on('action.wake_up', onWakeUp)
}

function onAutoconditioningControl (callback, args) {
  Util.debugLog('Flow action autoconditioning control', args)
  Homey.manager('drivers').getDriver(args.device.homeyDriverName).getApi()
  .controlAutoConditioning(args.device.id, args.autoconditioningstate === 'ON')
  .then((state) => { callback(null, state) })
  .catch(callback)
}

function onAutonditioningTemperature (callback, args) {
  Util.debugLog('Flow action autoconditioning temperature', args)
  Homey.manager('drivers').getDriver(args.device.homeyDriverName).getApi()
  .setAutoConditioningTemperatures(args.device.id, args.temp, args.temp)
  .then((state) => { callback(null, state) })
  .catch(callback)
}

function onFlashLights (callback, args) {
  Util.debugLog('Flow action flash lights', args)
  Homey.manager('drivers').getDriver(args.device.homeyDriverName).getApi()
  .flashLights(args.device.id)
  .then((state) => { callback(null, state) })
  .catch(callback)
}

function onHonk (callback, args) {
  Util.debugLog('Flow action honk', args)
  Homey.manager('drivers').getDriver(args.device.homeyDriverName).getApi()
  .honkHorn(args.device.id)
  .then((state) => { callback(null, state) })
  .catch(callback)
}

function onPanoroofControl (callback, args) {
  Util.debugLog('Flow action panoroof control', args)
  Homey.manager('drivers').getDriver(args.device.homeyDriverName).getApi()
  .controlPanoRoof(args.device.id, args.panoroofstate)
  .then((state) => { callback(null, state) })
  .catch(callback)
}

function onResetValetPin (callback, args) {
  Util.debugLog('Flow action reset valet pin', args)
  Homey.manager('drivers').getDriver(args.device.homeyDriverName).getApi()
  .resetValetPin(args.device.id)
  .then((state) => { callback(null, state) })
  .catch(callback)
}

function onSetValetMode (callback, args) {
  Util.debugLog('Flow action set valet mode', args)
  Homey.manager('drivers').getDriver(args.device.homeyDriverName).getApi()
  .controlValetMode(args.device.id, args.valetstate === 'ON', null)
  .then((state) => { callback(null, state) })
  .catch(callback)
}

function onSetValetModeWithPin (callback, args) {
  Util.debugLog('Flow action set valet mode with pin', args)
  Homey.manager('drivers').getDriver(args.device.homeyDriverName).getApi()
  .controlValetMode(args.device.id, true, args.pin)
  .then((state) => { callback(null, state) })
  .catch(callback)
}

function onWakeUp (callback, args) {
  Util.debugLog('Flow action wake up', args)
  Homey.manager('drivers').getDriver(args.device.homeyDriverName).getApi()
  .wakeUp(args.device.id)
  .then((state) => { callback(null, state) })
  .catch(callback)
}
