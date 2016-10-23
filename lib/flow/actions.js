/* global Homey */
var util = require('../util.js')

exports.init = function () {
  Homey.manager('flow').on('action.autoconditioningControl', onAutoconditioningControl)
  Homey.manager('flow').on('action.autoconditioningTemperature', onAutonditioningTemperature)
  Homey.manager('flow').on('action.chargeControl', onChargeControl)
  Homey.manager('flow').on('action.doorLockControl', onDoorLockControl)
  Homey.manager('flow').on('action.flashLights', onFlashLights)
  Homey.manager('flow').on('action.honk', onHonk)
  Homey.manager('flow').on('action.openChargePort', onOpenChargePort)
  Homey.manager('flow').on('action.panoroofControl', onPanoroofControl)
  Homey.manager('flow').on('action.remoteStartDrive', onRemoteStartDrive)
  Homey.manager('flow').on('action.resetValetPin', onResetValetPin)
  Homey.manager('flow').on('action.sayLocation', onSayLocation)
  Homey.manager('flow').on('action.setChargeLimit', onSetChargeLimit)
  Homey.manager('flow').on('action.setChargeMode', onSetChargeMode)
  Homey.manager('flow').on('action.setValetMode', onSetValetMode)
  Homey.manager('flow').on('action.setValetPin', onSetValetModeWithPin)
  Homey.manager('flow').on('action.wakeUp', onWakeUp)
}

function onAutoconditioningControl (callback, args) {
  util.debugLog('Flow action autoconditioning control', args)
  Homey.app.getDriverApi(args.device.homeyDriverName)
  .then(api => api.controlAutoConditioning(args.device.id, args.autoconditioningstate === 'ON'))
  .then(state => { callback(null, state) })
  .catch(callback)
}

function onAutonditioningTemperature (callback, args) {
  util.debugLog('Flow action autoconditioning temperature', args)
  Homey.app.getDriverApi(args.device.homeyDriverName)
  .then(api => api.setAutoConditioningTemperatures(args.device.id, args.temp, args.temp))
  .then(state => { callback(null, state) })
  .catch(callback)
}

function onChargeControl (callback, args) {
  util.debugLog('Flow action charge control', args)
  Homey.app.getDriverApi(args.device.homeyDriverName)
  .then(api => api.controlCharging(args.device.id, args.chargestate === 'ON'))
  .then(state => { callback(null, state) })
  .catch(callback)
}

function onDoorLockControl (callback, args) {
  util.debugLog('Flow action door lock control', args)
  Homey.app.getDriverApi(args.device.homeyDriverName)
  .then(api => api.controlDoorLock(args.device.id, args.lock === 'LOCK'))
  .then(state => { callback(null, state) })
  .catch(callback)
}

function onFlashLights (callback, args) {
  util.debugLog('Flow action flash lights', args)
  Homey.app.getDriverApi(args.device.homeyDriverName)
  .then(api => api.flashLights(args.device.id))
  .then(state => { callback(null, state) })
  .catch(callback)
}

function onHonk (callback, args) {
  util.debugLog('Flow action honk', args)
  Homey.app.getDriverApi(args.device.homeyDriverName)
  .then(api => api.honkHorn(args.device.id))
  .then(state => { callback(null, state) })
  .catch(callback)
}

function onOpenChargePort (callback, args) {
  util.debugLog('Flow action open charge port', args)
  Homey.app.getDriverApi(args.device.homeyDriverName)
  .then(api => api.controlChargePort(args.device.id, true))
  .then(state => { callback(null, state) })
  .catch(callback)
}

function onPanoroofControl (callback, args) {
  util.debugLog('Flow action panoroof control', args)
  Homey.app.getDriverApi(args.device.homeyDriverName)
  .then(api => api.controlPanoRoof(args.device.id, args.panoroofstate))
  .then(state => { callback(null, state) })
  .catch(callback)
}

function onRemoteStartDrive (callback, args) {
  util.debugLog('Flow action remote start drive', args)
  Homey.app.getDriverApi(args.device.homeyDriverName)
  .then(api => api.remoteStart(args.device.id))
  .then(state => { callback(null, state) })
  .catch(callback)
}

function onResetValetPin (callback, args) {
  util.debugLog('Flow action reset valet pin', args)
  Homey.app.getDriverApi(args.device.homeyDriverName)
  .then(api => api.resetValetPin(args.device.id))
  .then(state => { callback(null, state) })
  .catch(callback)
}

function onSayLocation (callback, args, state) {
  util.debugLog('Flow action say location', args, state)
  Homey.manager('drivers').getDriver(args.device.homeyDriverName).getName(args.device, (error, name) => {
    if (error) return callback(null, false)
    Homey.app.getDriverApi(args.device.homeyDriverName)
    .then(api => api.getLocation(args.device.id))
    .then(location => {
      Homey.manager('speech-output').say(util.createAddressSpeech(location.place, location.city, name), {session: state.session})
      callback(null, true)
    }).catch(callback)
  })
}

function onSetChargeLimit (callback, args) {
  util.debugLog('Flow action set charge limit', args)
  Homey.app.getDriverApi(args.device.homeyDriverName)
  .then(api => api.setChargeLimit(args.device.id, args.limit, null))
  .then(state => { callback(null, state) })
  .catch(callback)
}

function onSetChargeMode (callback, args) {
  util.debugLog('Flow action set charge mode', args)
  Homey.app.getDriverApi(args.device.homeyDriverName)
  .then(api => api.setChargeMode(args.device.id, args.chargemode, null))
  .then(state => { callback(null, state) })
  .catch(callback)
}

function onSetValetMode (callback, args) {
  util.debugLog('Flow action set valet mode', args)
  Homey.app.getDriverApi(args.device.homeyDriverName)
  .then(api => api.controlValetMode(args.device.id, args.valetstate === 'ON', null))
  .then(state => { callback(null, state) })
  .catch(callback)
}

function onSetValetModeWithPin (callback, args) {
  util.debugLog('Flow action set valet mode with pin', args)
  Homey.app.getDriverApi(args.device.homeyDriverName)
  .then(api => api.controlValetMode(args.device.id, true, args.pin))
  .then(state => { callback(null, state) })
  .catch(callback)
}

function onWakeUp (callback, args) {
  util.debugLog('Flow action wake up', args)
  Homey.app.getDriverApi(args.device.homeyDriverName)
  .then(api => api.wakeUp(args.device.id))
  .then(state => { callback(null, state) })
  .catch(callback)
}
