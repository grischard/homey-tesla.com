/* global Homey */
var Util = require('../util.js')
var Geofences = require('../geofences.js')

exports.init = function () {
  Homey.manager('flow').on('condition.autoConditioningState', onConditionAutoConditioningState)
  Homey.manager('flow').on('condition.driverTempSettingValue', onConditionDriverTempSettingValue)
  Homey.manager('flow').on('condition.magicApiConditions', onConditionMagicApiConditions)
  Homey.manager('flow').on('condition.magicApiConditions.apiValue.autocomplete', onConditionMagicApiConditionsApiValueAutocomplete)
  Homey.manager('flow').on('condition.magicApiConditions.conditionType.autocomplete', onConditionMagicApiConditionsConditionTypeAutocomplete)
  Homey.manager('flow').on('condition.panoroofState', onConditionPanoroofState)
  Homey.manager('flow').on('condition.vehicleGeofence', onConditionVehicleGeofence)
  Homey.manager('flow').on('condition.vehicleGeofence.geofence.autocomplete', onConditionVehicleGeofenceGeofenceAutocomplete)
  Homey.manager('flow').on('condition.vehicleMoving', onConditionVehicleMoving)
}

function onConditionAutoConditioningState (callback, args) {
  Util.debugLog('Flow condition auto conditioning state', args)
  Homey.app.getDriverApi(args.device.homeyDriverName)
  .then(api => api.getClimateState(args.device.id))
  .then(state => { callback(null, state.is_auto_conditioning_on || false) })
  .catch(callback)
}

function onConditionDriverTempSettingValue (callback, args) {
  Util.debugLog('Flow condition driver temp setting value', args)
  Homey.app.getDriverApi(args.device.homeyDriverName)
  .then(api => api.getClimateState(args.device.id))
  .then(state => { callback(null, state.driver_temp_setting > args.temperature) })
  .catch(callback)
}

function onConditionMagicApiConditions (callback, args) {
  Util.debugLog('Flow condition magic api conditions', args)
  console.log('---------------------------------------------------------')
  if (!args.apiValue) return callback('missing_apiValue')
  if (!args.conditionType) return callback('missing_conditionType')
  if (!args.conditionValue) return callback('missing_conditionValue')

  var apiMethod = args.apiValue.id.split('.')[0]
  var apiValue = args.apiValue.id.split('.')[1]
  var conditionValue = args.conditionValue.toLowerCase()

  if (ApiOptionsDefinitions[args.apiValue.id].type !== args.conditionType.id.split('.')[0]) {
    return callback('inconsistent_value_condition')
  }
  switch (args.conditionType.id) {
    case 'boolean.equals':
      console.log('check type boolean', typeof conditionValue, conditionValue === 'false' || conditionValue === 'true')
      if (conditionValue !== 'false' && conditionValue !== 'true') return callback('condition_value_not_true_or_false')
      break
    case 'number.equals':
    case 'number.above':
    case 'number.below':
      console.log('check type number', typeof conditionValue, !isNaN(conditionValue))
      if (isNaN(conditionValue)) return callback('condition_value_invalid_number')
      break
  }

  Homey.app.getDriverApi(args.device.homeyDriverName)
  .then(api => api[apiMethod](args.device.id))
  .then((response) => {
    Util.debugLog('Magic api condition returned value:', response[apiValue])
    var isNull = response[apiValue] === null
    switch (args.conditionType.id) {
      case 'boolean.equals':
        return callback(null, (!isNull && response[apiValue].toString() === conditionValue))
      case 'boolean.known':
      case 'string.known':
      case 'number.known':
        return callback(null, !isNull)
      case 'string.equals':
        return callback(null, (!isNull && response[apiValue].toLowerCase() === conditionValue))
      case 'string.contains':
        return callback(null, (!isNull && response[apiValue].toLowerCase().includes(conditionValue)))
      case 'string.above':
        return callback(null, (!isNull && response[apiValue].toLowerCase() > conditionValue))
      case 'string.below':
        return callback(null, (!isNull && response[apiValue].toLowerCase() < conditionValue))
      case 'number.equals':
        return callback(null, (!isNull && response[apiValue] == conditionValue))   // eslint-disable-line
      case 'number.above':
        return callback(null, (!isNull && response[apiValue] > conditionValue))
      case 'number.below':
        return callback(null, (!isNull && response[apiValue] < conditionValue))
    }
    callback('unknown_conditionType')
  })
  .catch(callback)
}

function onConditionMagicApiConditionsApiValueAutocomplete (callback, args) {
  var list = []
  Object.keys(ApiOptionsDefinitions).forEach(function (id) {
    if (ApiOptionsDefinitions[id].ignore) return
    var itemName = id.split('.')[1].replace(/_{1,}/g, ' ').replace(/(\s{1,}|\b)(\w)/g, (m, space, letter) => space + letter.toUpperCase())
    list.push({id: id, name: itemName})
  })
  callback(null,
    list
    .filter((item) => item.name.toLowerCase().includes(args.query.toLowerCase()))
    .sort((a, b) => (a.name > b.name ? 1 : -1))
  )
}

function onConditionMagicApiConditionsConditionTypeAutocomplete (callback, args) {
  if (args.args.apiValue === '') return callback('no_field_selected')
  callback(null,
    ApiConditionList
    .filter((item) => item.id.includes(ApiOptionsDefinitions[args.args.apiValue.id].type + '.'))
    .sort((a, b) => (a.name > b.name ? 1 : -1))
  )
}

function onConditionPanoroofState (callback, args) {
  Util.debugLog('Flow condition panoroof state', args)
  Homey.app.getDriverApi(args.device.homeyDriverName)
  .then(api => api.getVehicleState(args.device.id))
  .then(state => {
    if (state.sun_roof_installed === 0) return callback('no panaroof installed')
    callback(null, state.sun_roof_percent_open > 0)
  })
  .catch(callback)
}

function onConditionVehicleGeofence (callback, args) {
  // TODO implement this
  Util.debugLog('Flow condition vehicle geofence', args)
  // checkGeofencesForTracker(args.device.id, true)
  // callback(null, trackers[args.device.id].geofences.indexOf(args.geofence.geofenceId) !== -1)
  callback(null, Homey.manager('drivers').getDriver(args.device.homeyDriverName).getVehicles()[args.device.id].geofences.indexOf(args.geofence.geofenceId) !== -1)
}

function onConditionVehicleGeofenceGeofenceAutocomplete (callback, args) {
  callback(null, Geofences.geofencesFilteredList(args.query))
}

function onConditionVehicleMoving (callback, args) {
  Util.debugLog('Flow condition vehicle moving', args)
  Homey.app.getDriverApi(args.device.homeyDriverName)
  .then(api => api.getDriveState(args.device.id))
  .then(state => { callback(null, state.speed > 0) })
  .catch(callback)
}

const ApiConditionList = [
  {id: 'boolean.equals', name: 'Equals (boolean)'},
  {id: 'boolean.known', name: 'Is known'},
  {id: 'string.equals', name: 'Equals (string)'},
  {id: 'string.contains', name: 'Contains'},
  {id: 'string.above', name: 'Above (alphabetic)'},
  {id: 'string.below', name: 'Below (alphabetic)'},
  {id: 'string.known', name: 'Is known'},
  {id: 'number.equals', name: 'Equals (number)'},
  {id: 'number.above', name: 'Above (number)'},
  {id: 'number.below', name: 'Below (number)'},
  {id: 'number.known', name: 'Is known'}
]

const ApiOptionsDefinitions = {
  'getVehicle.id': {ignore: true, type: 'number', units: null},
  'getVehicle.vehicle_id': {ignore: true, type: 'number', units: null},
  'getVehicle.vin': {ignore: false, type: 'string', units: null},
  'getVehicle.display_name': {ignore: false, type: 'string', units: null},
  'getVehicle.option_codes': {ignore: false, type: 'string', units: null},
  'getVehicle.color': {ignore: false, type: 'string', units: null},
  'getVehicle.tokens': {ignore: true, type: 'object', units: null},
  'getVehicle.state': {ignore: false, type: 'string', units: null},
  'getVehicle.in_service': {ignore: false, type: 'boolean', units: null},
  'getVehicle.id_s': {ignore: true, type: 'string', units: null},
  'getVehicle.remote_start_enabled': {ignore: false, type: 'boolean', units: null},
  'getVehicle.calendar_enabled': {ignore: false, type: 'boolean', units: null},
  'getVehicle.notifications_enabled': {ignore: false, type: 'boolean', units: null},
  'getVehicle.backseat_token': {ignore: true, type: 'object', units: null},
  'getVehicle.backseat_token_updated_at': {ignore: true, type: 'object', units: null},
  'getGuiSettings.gui_distance_units': {ignore: false, type: 'string', units: null},
  'getGuiSettings.gui_temperature_units': {ignore: false, type: 'string', units: null},
  'getGuiSettings.gui_charge_rate_units': {ignore: false, type: 'string', units: null},
  'getGuiSettings.gui_24_hour_time': {ignore: false, type: 'boolean', units: null},
  'getGuiSettings.gui_range_display': {ignore: false, type: 'string', units: null},
  'getClimateState.inside_temp': {ignore: false, type: 'number', units: 'celcius'},
  'getClimateState.outside_temp': {ignore: false, type: 'number', units: 'celcius'},
  'getClimateState.driver_temp_setting': {ignore: false, type: 'number', units: 'celcius'},
  'getClimateState.passenger_temp_setting': {ignore: false, type: 'number', units: 'celcius'},
  'getClimateState.left_temp_direction': {ignore: false, type: 'number', units: null},
  'getClimateState.right_temp_direction': {ignore: false, type: 'number', units: null},
  'getClimateState.is_auto_conditioning_on': {ignore: false, type: 'boolean', units: null},
  'getClimateState.is_front_defroster_on': {ignore: false, type: 'boolean', units: null},
  'getClimateState.is_rear_defroster_on': {ignore: false, type: 'boolean', units: null},
  'getClimateState.fan_status': {ignore: false, type: 'number', units: null},
  'getClimateState.is_climate_on': {ignore: false, type: 'boolean', units: null},
  'getClimateState.min_avail_temp': {ignore: false, type: 'number', units: 'celcius'},
  'getClimateState.max_avail_temp': {ignore: false, type: 'number', units: 'celcius'},
  'getClimateState.seat_heater_left': {ignore: false, type: 'number', units: null},
  'getClimateState.seat_heater_right': {ignore: false, type: 'number', units: null},
  'getClimateState.seat_heater_rear_left': {ignore: false, type: 'number', units: null},
  'getClimateState.seat_heater_rear_right': {ignore: false, type: 'number', units: null},
  'getClimateState.seat_heater_rear_center': {ignore: false, type: 'number', units: null},
  'getClimateState.seat_heater_rear_right_back': {ignore: false, type: 'number', units: null},
  'getClimateState.seat_heater_rear_left_back': {ignore: false, type: 'number', units: null},
  'getClimateState.smart_preconditioning': {ignore: false, type: 'boolean', units: null},
  'getChargeState.charging_state': {ignore: false, type: 'string', units: null},
  'getChargeState.battery_current': {ignore: false, type: 'number', units: 'amp'},
  'getChargeState.battery_level': {ignore: false, type: 'number', units: 'percentage'},
  'getChargeState.battery_range': {ignore: false, type: 'number', units: 'miles'},
  'getChargeState.charge_current_request': {ignore: false, type: 'number', units: 'amp'},
  'getChargeState.charge_to_max_range': {ignore: false, type: 'boolean', units: null},
  'getChargeState.battery_heater_on': {ignore: false, type: 'boolean', units: null},
  'getChargeState.not_enough_power_to_heat': {ignore: false, type: 'boolean', units: null},
  'getChargeState.charge_current_request_max': {ignore: false, type: 'number', units: 'amp'},
  'getChargeState.fast_charger_present': {ignore: false, type: 'boolean', units: null},
  'getChargeState.fast_charger_type': {ignore: false, type: 'string', units: null},
  'getChargeState.charge_energy_added': {ignore: false, type: 'number', units: 'kw'},
  'getChargeState.charge_limit_soc': {ignore: false, type: 'number', units: 'percentage'},
  'getChargeState.charge_limit_soc_max': {ignore: false, type: 'number', units: 'percentage'},
  'getChargeState.charge_limit_soc_min': {ignore: false, type: 'number', units: 'percentage'},
  'getChargeState.charge_limit_soc_std': {ignore: false, type: 'number', units: 'percentage'},
  'getChargeState.charge_miles_added_ideal': {ignore: false, type: 'number', units: 'miles'},
  'getChargeState.charge_miles_added_rated': {ignore: false, type: 'number', units: 'miles'},
  'getChargeState.charge_rate': {ignore: false, type: 'number', units: null},
  'getChargeState.charger_actual_current': {ignore: false, type: 'number', units: null},
  'getChargeState.charger_phases': {ignore: false, type: 'number', units: null},
  'getChargeState.charger_pilot_current': {ignore: false, type: 'number', units: null},
  'getChargeState.charger_power': {ignore: false, type: 'number', units: 'amp'},
  'getChargeState.charger_voltage': {ignore: false, type: 'number', units: 'volt'},
  'getChargeState.est_battery_range': {ignore: false, type: 'number', units: 'miles'},
  'getChargeState.trip_charging': {ignore: false, type: 'boolean', units: null},
  'getChargeState.ideal_battery_range': {ignore: false, type: 'number', units: 'miles'},
  'getChargeState.charge_port_door_open': {ignore: false, type: 'boolean', units: null},
  'getChargeState.motorized_charge_port': {ignore: false, type: 'boolean', units: null},
  'getChargeState.managed_charging_start_time': {ignore: false, type: 'number', units: null},
  'getChargeState.scheduled_charging_pending': {ignore: false, type: 'boolean', units: null},
  'getChargeState.user_charge_enable_request': {ignore: false, type: 'string', units: null},
  'getChargeState.charge_enable_request': {ignore: false, type: 'boolean', units: null},
  'getChargeState.eu_vehicle': {ignore: false, type: 'boolean', units: null},
  'getChargeState.max_range_charge_counter': {ignore: false, type: 'number', units: null},
  'getChargeState.charge_port_latch': {ignore: false, type: 'string', units: null},
  'getChargeState.scheduled_charging_start_time': {ignore: false, type: 'number', units: null},
  'getChargeState.time_to_full_charge': {ignore: false, type: 'number', units: null},
  'getChargeState.managed_charging_active': {ignore: false, type: 'boolean', units: null},
  'getChargeState.managed_charging_user_canceled': {ignore: false, type: 'boolean', units: null},
  'getChargeState.usable_battery_level': {ignore: false, type: 'number', units: 'percentage'},
  'getDriveState.shift_state': {ignore: false, type: 'string', units: null},
  'getDriveState.speed': {ignore: false, type: 'number', units: 'miles'},
  'getDriveState.latitude': {ignore: true, type: 'number', units: null},
  'getDriveState.longitude': {ignore: true, type: 'number', units: null},
  'getDriveState.heading': {ignore: true, type: 'number', units: null},
  'getDriveState.gps_as_of': {ignore: true, type: 'number', units: null},
  'getVehicleState.api_version': {ignore: false, type: 'number', units: null},
  'getVehicleState.autopark_state': {ignore: false, type: 'string', units: null},
  'getVehicleState.autopark_state_v2': {ignore: false, type: 'string', units: null},
  'getVehicleState.autopark_style': {ignore: false, type: 'string', units: null},
  'getVehicleState.calendar_supported': {ignore: false, type: 'boolean', units: null},
  'getVehicleState.car_type': {ignore: false, type: 'string', units: null},
  'getVehicleState.car_version': {ignore: false, type: 'string', units: null},
  'getVehicleState.center_display_state': {ignore: false, type: 'number', units: null},
  'getVehicleState.dark_rims': {ignore: false, type: 'boolean', units: null},
  'getVehicleState.df': {ignore: false, type: 'number', units: null},
  'getVehicleState.dr': {ignore: false, type: 'number', units: null},
  'getVehicleState.exterior_color': {ignore: false, type: 'string', units: null},
  'getVehicleState.ft': {ignore: false, type: 'number', units: null},
  'getVehicleState.has_spoiler': {ignore: false, type: 'boolean', units: null},
  'getVehicleState.homelink_nearby': {ignore: false, type: 'boolean', units: null},
  'getVehicleState.last_autopark_error': {ignore: false, type: 'string', units: null},
  'getVehicleState.locked': {ignore: false, type: 'boolean', units: null},
  'getVehicleState.notifications_supported': {ignore: false, type: 'boolean', units: null},
  'getVehicleState.odometer': {ignore: false, type: 'number', units: 'miles'},
  'getVehicleState.parsed_calendar_supported': {ignore: false, type: 'boolean', units: null},
  'getVehicleState.perf_config': {ignore: false, type: 'string', units: null},
  'getVehicleState.pf': {ignore: false, type: 'number', units: null},
  'getVehicleState.pr': {ignore: false, type: 'number', units: null},
  'getVehicleState.rear_seat_heaters': {ignore: false, type: 'number', units: null},
  'getVehicleState.rear_seat_type': {ignore: false, type: 'number', units: null},
  'getVehicleState.remote_start': {ignore: false, type: 'boolean', units: null},
  'getVehicleState.remote_start_supported': {ignore: false, type: 'boolean', units: null},
  'getVehicleState.rhd': {ignore: false, type: 'boolean', units: null},
  'getVehicleState.roof_color': {ignore: false, type: 'string', units: null},
  'getVehicleState.rt': {ignore: false, type: 'number', units: null},
  'getVehicleState.seat_type': {ignore: false, type: 'number', units: null},
  'getVehicleState.spoiler_type': {ignore: false, type: 'string', units: null},
  'getVehicleState.sun_roof_installed': {ignore: false, type: 'number', units: null},
  'getVehicleState.sun_roof_percent_open': {ignore: false, type: 'number', units: null},
  'getVehicleState.sun_roof_state': {ignore: false, type: 'string', units: null},
  'getVehicleState.third_row_seats': {ignore: false, type: 'string', units: null},
  'getVehicleState.valet_mode': {ignore: false, type: 'boolean', units: null},
  'getVehicleState.valet_pin_needed': {ignore: false, type: 'boolean', units: null},
  'getVehicleState.vehicle_name': {ignore: false, type: 'string', units: null},
  'getVehicleState.wheel_type': {ignore: false, type: 'string', units: null}
}
