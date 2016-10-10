/* global Homey */
var Util = require('../util.js')

exports.init = function () {
  Homey.manager('flow').on('condition.auto_conditioning_state', onConditionAutoConditioningState)
  Homey.manager('flow').on('condition.driver_temp_setting_value', onConditionDriverTempSettingValue)
  Homey.manager('flow').on('condition.panoroof_state', onConditionPanoroofState)
  Homey.manager('flow').on('condition.vehicle_moving', onConditionVehicleMoving)
}

function onConditionAutoConditioningState (callback, args) {
  Util.debugLog('Flow condition auto_conditioning_state', args)
  Homey.manager('drivers').getDriver(args.device.homeyDriverName).getApi()
  .getClimateState(args.device.id)
  .then((state) => { callback(null, state.is_auto_conditioning_on || false) })
  .catch(callback)
}

function onConditionDriverTempSettingValue (callback, args) {
  Util.debugLog('Flow condition driver_temp_setting_value', args)
  Homey.manager('drivers').getDriver(args.device.homeyDriverName).getApi()
  .getClimateState(args.device.id)
  .then((state) => { callback(null, state.driver_temp_setting > args.temperature) })
  .catch(callback)
}

function onConditionPanoroofState (callback, args) {
  Util.debugLog('Flow condition panoroof_state', args)
  Homey.manager('drivers').getDriver(args.device.homeyDriverName).getApi()
  .getVehicleState(args.device.id)
  .then((state) => {
    if (state.sun_roof_installed === 0) return callback('no panaroof installed')
    callback(null, state.sun_roof_percent_open > 0)
  })
  .catch(callback)
}

function onConditionVehicleMoving (callback, args) {
  Util.debugLog('Flow condition vehicle_moving', args)
  Homey.manager('drivers').getDriver(args.device.homeyDriverName).getApi()
  .getDriveState(args.device.id)
  .then((state) => { callback(null, state.speed > 0) })
  .catch(callback)
}
