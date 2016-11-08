/* global Homey */
var Util = require('../util.js')
var Geofences = require('../geofences.js')

exports.init = function () {
  Homey.manager('flow').on('trigger.vehicleGeofenceEntered', onTriggerVehicleGeofence)
  Homey.manager('flow').on('trigger.vehicleGeofenceEntered.geofence.autocomplete', onTriggerVehicleGeofenceGeofenceAutocomplete)
  Homey.manager('flow').on('trigger.vehicleGeofenceLeft', onTriggerVehicleGeofence)
  Homey.manager('flow').on('trigger.vehicleGeofenceLeft.geofence.autocomplete', onTriggerVehicleGeofenceGeofenceAutocomplete)
}

function onTriggerVehicleGeofenceGeofenceAutocomplete (callback, args) {
  callback(null, Geofences.geofencesFilteredList(args.query))
}

function onTriggerVehicleGeofence (callback, args, state) {
  Util.debugLog('flow trigger vehicle geofence evaluation', {card: args.geofence.geofenceId.toString(), state: state.geofence.toString()})
  callback(null, args.geofence.geofenceId.toString() === state.geofence.toString())
}
