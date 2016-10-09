/* global Homey */
var Util = require('../util.js')

exports.init = function () {
  Homey.manager('flow').on('action.autoconditioning_control', onAutoconditioningControl)
  Homey.manager('flow').on('action.autoconditioning_temperature', onAutonditioningTemperature)
  Homey.manager('flow').on('action.flash_lights', onFlashLights)
  Homey.manager('flow').on('action.honk', onHonk)
  Homey.manager('flow').on('action.panoroof_control', onPanoroofControl)
}

function onAutoconditioningControl (callback, args) {
  Util.debugLog('Flow action autoconditioning control', args)
  Homey.manager('drivers').getDriver('models').getApi()
  .controlAutoConditioning(args.device.id, args.autoconditioningstate === 'ON')
  .then((state) => { callback(null, state) })
  .catch(callback)
}

function onAutonditioningTemperature (callback, args) {
  Util.debugLog('Flow action autoconditioning temperature', args)
  Homey.manager('drivers').getDriver('models').getApi()
  .setAutoConditioningTemperatures(args.device.id, args.temp, args.temp)
  .then((state) => { callback(null, state) })
  .catch(callback)
}

function onFlashLights (callback, args) {
  Util.debugLog('Flow action flash lights', args)
  Homey.manager('drivers').getDriver('models').getApi()
  .flashLights(args.device.id)
  .then((state) => { callback(null, state) })
  .catch(callback)
}

function onHonk (callback, args) {
  Util.debugLog('Flow action honk', args)
  Homey.manager('drivers').getDriver('models').getApi()
  .honkHorn(args.device.id)
  .then((state) => { callback(null, state) })
  .catch(callback)
}

function onPanoroofControl (callback, args) {
  Util.debugLog('Flow action panoroof control', args)
  Homey.manager('drivers').getDriver('models').getApi()
  .controlPanoRoof(args.device.id, args.panoroofstate)
  .then((state) => { callback(null, state) })
  .catch(callback)
}
