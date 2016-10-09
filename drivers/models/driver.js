/* global Homey */
'use strict'

// var Location = require('../../lib/location.js')
var Tesla = require('../../lib/tesla.js')
var teslaApi = null
var Util = require('../../lib/util.js')
var Inside = require('point-in-polygon')
var retryTrackingTimeoutId = null
var tracking = null
var trackers = {}
var trackerTimeoutObjects = {}
var geofences = {}
var debugSetting = true
var debugLog = []

function TeslaDebugLog (message, data) {
  if (!debugSetting) return
  if (!debugLog) debugLog = []
  if (!data) data = null

  // Push new event, remove items over 100 and save new array
  Homey.manager('api').realtime('teslaLog', {datetime: new Date(), message: message, data: data})
  debugLog.push({datetime: new Date(), message: message, data: data})
  if (debugLog.length > 100) debugLog.splice(0, 1)
  if (data == null) {
    Homey.log(Util.epochToTimeFormatter(), message)
  } else {
    Homey.log(Util.epochToTimeFormatter(), message, data)
  }
  Homey.manager('settings').set('teslaLog', debugLog)
} // function TeslaDebugLog

function checkGeofences (notrigger) {
  if (!trackers) return
  Object.keys(trackers).forEach(function (trackerId) {
    checkGeofencesForVehicle(trackerId, notrigger)
  })
}

function checkGeofencesForVehicle (trackerId, notrigger) {
  if (!geofences) return
  Object.keys(geofences).forEach(function (geofenceId) {
    var trackerInGeofence = false
    var trackerWasInGeofence = trackers[trackerId].geofences.indexOf(geofenceId) !== -1
    if (geofences[geofenceId].type === 'CIRCLE') {
      var distance = Util.calculateDistance(
        trackers[trackerId].location.lat,
        trackers[trackerId].location.lng,
        geofences[geofenceId].circle.center.lat,
        geofences[geofenceId].circle.center.lng,
        'M'
      )
      trackerInGeofence = distance < geofences[geofenceId].circle.radius
    } else {
      var trackerPositionShort = [trackers[trackerId].location.lat, trackers[trackerId].location.lng]
      var geofencePathShort = []
      if (geofences[geofenceId].type === 'POLYGON') {
        geofences[geofenceId].polygon.path.forEach(function (point) {
          geofencePathShort.push([point.lat, point.lng])
        })
      } else {
        geofences[geofenceId].rectangle.path.forEach(function (point) {
          geofencePathShort.push([point.lat, point.lng])
        })
      }
      trackerInGeofence = Inside(trackerPositionShort, geofencePathShort)
    }
    if ((trackerInGeofence) && (!trackerWasInGeofence)) {
      trackers[trackerId].geofences.push(geofenceId)
      if (!notrigger) {
        Homey.manager('flow').triggerDevice(
          'vehicle_geofence_entered',
          null, // notokens
          {geofence: geofenceId},
          {id: trackerId},
          function (err, result) {
            TeslaDebugLog('flow trigger vehicle_geofence_entered ', {id: trackerId, geofenceId: geofenceId, error: err, result: result})
          }
        )
      }
    }
    if ((!trackerInGeofence) && (trackerWasInGeofence)) {
      trackers[trackerId].geofences.splice(trackers[trackerId].geofences.indexOf(geofenceId), 1)
      if (!notrigger) {
        Homey.manager('flow').triggerDevice(
          'vehicle_geofence_left',
          null, // notokens
          {geofence: geofenceId},
          {id: trackerId},
          function (err, result) {
            TeslaDebugLog('flow trigger vehicle_geofence_left ', {id: trackerId, geofenceId: geofenceId, error: err, result: result})
          }
        )
      }
    }
  })
}

function stopMoving (trackerId) {
  TeslaDebugLog('stopMoving called', {trackerId: trackerId, moving: trackers[trackerId].moving})
  trackerTimeoutObjects[trackerId] = null
  if (!trackers[trackerId].moving) return
  if (!trackers[trackerId].route) return

  // create route object for persistancy
  var route = trackers[trackerId].route
  route.end = trackers[trackerId].location
  route.end.time = trackers[trackerId].timeLastUpdate
  route.trackerId = trackerId

  // only save route if distance > 1000m
  if ((trackers[trackerId].route.distance || 0) > 1000) {
    // TODO: Read setting if route analysis is allowed
    var allRoutes = Homey.manager('settings').get('teslaRoutes') || []
    allRoutes.push(route)
    Homey.manager('settings').set('teslaRoutes', allRoutes)
  }
  // update tracker
  delete trackers[trackerId].route
  trackers[trackerId].moving = false
  Homey.manager('api').realtime('teslaLocation', trackers[trackerId])

  // handle flows
  var tracker_tokens = {
    start_location: Util.createAddressSpeech(route.start.place, route.start.city),
    stop_location: Util.createAddressSpeech(route.end.place, route.end.city),
    distance: Math.ceil(route.distance) || 0
  }

  Homey.manager('flow').triggerDevice(
    'vehicle_stopt_moving',
    tracker_tokens,
    null,
    {id: trackerId},
    function (err, result) {
      TeslaDebugLog('flow trigger vehicle_stopt_moving ', {id: trackerId, error: err, result: result})
    }
  )
}

function updateVehicle (trackerId, callback) {
  TeslaDebugLog('######### TESLA TRACKING ## updateVehicle #########################')
  var settings = Homey.manager('settings').get('teslaAccount')
  var grant = Homey.manager('settings').get('teslaGrant')
  if (!settings) return callback('no_settings')
  if (!trackerId) return callback('no_device')

  var singleTrack = new Tesla({
    user: settings.user,
    password: settings.password,
    grant: grant
  })
  singleTrack.getVehicleAddress(trackerId)
    .then(function (address) {
      trackers[trackerId].location = address
      callback(null, trackerId)
    })
    .catch(function (error) {
      TeslaDebugLog('event: error', error)
      return callback(error)
    })
}

function initiateTracking () {
  if (retryTrackingTimeoutId) clearTimeout(retryTrackingTimeoutId)
  debugLog = Homey.manager('settings').get('teslaLog')
  debugSetting = true
  retryTrackingTimeoutId = null

  TeslaDebugLog('######### TESLA TRACKING ## initiateTracking #########################')
  // if (teslaApi) teslaApi.stopTracking()
  teslaApi = null

  geofences = Homey.manager('settings').get('geofences')
  var settings = Homey.manager('settings').get('teslaAccount')
  var grant = Homey.manager('settings').get('teslaGrant')
  if (!settings) return TeslaDebugLog('  no settings!')
  if (!settings.debug) debugSetting = false

  teslaApi = new Tesla({
    user: settings.user,
    password: settings.password,
    grant: grant,
    intervalMS: 10000 // TODO: read from app setting
  })

  if (!Object.keys(trackers).length) return TeslaDebugLog('  no devices to track!')
  teslaApi.on('error', function (error) {
    TeslaDebugLog('event: error', error)
  })
  teslaApi.on('grant', function (newgrant) {
    Homey.manager('settings').set('teslaLog', debugLog)
  })

  if (!settings.polling) return TeslaDebugLog('  polling disabled in settings')

  Object.keys(trackers).forEach(function (trackerId) {
    trackers[trackerId].timeLastTrigger = 0
    // clear route tracking if tracker is not moving or never initiated before
    if (trackers[trackerId].moving !== true) {
      trackers[trackerId].moving = null // picked on location event
      if (trackerTimeoutObjects[trackerId]) {
        clearTimeout(trackerTimeoutObjects[trackerId])
        trackerTimeoutObjects[trackerId] = null
        delete trackers[trackerId].route
      }
    }
  })

  teslaApi.on('tracking_terminated', function (reason) {
    if (tracking) {
      TeslaDebugLog('event: tracking_terminated, will retry in 10 minutes.', reason)
      tracking = null
      if (!retryTrackingTimeoutId) {
        retryTrackingTimeoutId = setTimeout(initiateTracking, 10 * 60 * 1000)
      }
    }
  })
  teslaApi.on('message', function (trackerId, data) {
    TeslaDebugLog('event: message', {id: trackerId, distance: data.distance})
  })
  teslaApi.on('location', function (trackerId, data) {
    var previousLocation = trackers[trackerId].location
    var place = data.address.place
    var city = data.address.city
    var wasMoving = trackers[trackerId].moving

    trackers[trackerId].location = {
      place: place,
      city: city,
      lat: data.y,
      lng: data.x
    }
    trackers[trackerId].timeLastUpdate = data.t * 1000

    var timeConstraint = (trackers[trackerId].timeLastUpdate - trackers[trackerId].timeLastTrigger) < (trackers[trackerId].settings.retriggerRestrictTime * 1000)
    var distanceConstraint = data.distance < trackers[trackerId].settings.retriggerRestrictDistance

    // ignore initial location on (re)initiation
    if (wasMoving == null) {
      trackers[trackerId].moving = false
      checkGeofencesForVehicle(trackerId, true)
      TeslaDebugLog('initial location for vehicle', {id: trackerId, place: place, city: city})
      return
    }

    // handle flows
    TeslaDebugLog('event: location', {id: trackerId, place: place, city: city, distance: data.distance, wasMoving: wasMoving, timeConstraint: timeConstraint, distanceConstraint: distanceConstraint})
    checkGeofencesForVehicle(trackerId)
    if (wasMoving) {
      // next if part is temp fix. Should be removed when bug final fixed
      if (!trackers[trackerId].route) {
        TeslaDebugLog('vehicle was moving, but without route object', {id: trackerId, tracker: trackers[trackerId]})
        trackers[trackerId].route = {
          distance: data.distance,
          start: previousLocation
        }
      } else {
        trackers[trackerId].route.distance += data.distance
      }
    }

    if (!wasMoving && !distanceConstraint) {
      trackers[trackerId].moving = true
      trackers[trackerId].route = {
        distance: data.distance,
        start: previousLocation
      }
      trackers[trackerId].route.start.time = data.t * 1000
      Homey.manager('flow').triggerDevice(
        'vehicle_start_moving',
        {
          address: Util.createAddressSpeech(previousLocation.place, previousLocation.city),
          distance: Math.ceil(data.distance) || 0
        },
        null,
        {id: trackerId},
        function (err, result) {
          TeslaDebugLog('flow trigger vehicle_start_moving ', {id: trackerId, error: err, result: result})
        }
      )
    }

    if (!timeConstraint && !distanceConstraint) {
      trackers[trackerId].timeLastTrigger = data.t * 1000
      Homey.manager('flow').triggerDevice(
        'vehicle_moved',
        {
          address: Util.createAddressSpeech(place, city),
          distance: Math.ceil(data.distance) || 0
        },
        null,
        {id: trackerId},
        function (err, result) {
          TeslaDebugLog('flow trigger vehicle_moved ', {id: trackerId, error: err, result: result})
        }
      )
    }

    // postpone stopmoving trigger
    if (trackers[trackerId].moving) {
      if (trackerTimeoutObjects[trackerId]) clearTimeout(trackerTimeoutObjects[trackerId])
      trackerTimeoutObjects[trackerId] = setTimeout(
        stopMoving,
        trackers[trackerId].settings.stoppedMovingTimeout * 1000,
        trackerId
      )
    }

    Homey.manager('api').realtime('teslaLocation', trackers[trackerId])
  })
  teslaApi.startTracking(Object.keys(trackers))
} // function initiateTracking

var self = {
  init: function (devices_data, callback) {
    // initial load of trackers object
    devices_data.forEach(function (device_data) {
      Homey.manager('drivers').getDriver('models').getName(device_data, function (err, name) {
        console.log('device name: ', name, device_data)
        if (err) return
        trackers[device_data.id] = {
          trackerId: device_data.id,
          name: name,
          location: {},
          geofences: []
        }
        trackerTimeoutObjects[device_data.id] = null
        module.exports.getSettings(device_data, function (err, settings) {
          if (err) TeslaDebugLog('Error on loading device settings', {device_data: device_data, error: err})
          var trackersettings = {
            retriggerRestrictTime: settings.retriggerRestrictTime || 1,
            retriggerRestrictDistance: settings.retriggerRestrictDistance || 1,
            stoppedMovingTimeout: settings.stoppedMovingTimeout || 120
          }
          trackers[device_data.id].settings = trackersettings
        })
      })
    })

    function geofencesFilteredList (value) {
      var result = []
      if (!geofences) return result
      Object.keys(geofences).forEach(function (geofenceId) {
        if (geofences[geofenceId].name.toUpperCase().indexOf(value.toUpperCase()) > -1) {
          result.push({name: geofences[geofenceId].name, geofenceId: geofenceId})
        }
      })
      return result
    }

    // Homey.manager('flow').on('condition.vehicle_geofence.geofence.autocomplete', function (callback, value) {
    //   callback(null, geofencesFilteredList(value.query))
    // })
    // Homey.manager('flow').on('trigger.vehicle_geofence_entered.geofence.autocomplete', function (callback, value) {
    //   callback(null, geofencesFilteredList(value.query))
    // })
    // Homey.manager('flow').on('trigger.vehicle_geofence_left.geofence.autocomplete', function (callback, value) {
    //   callback(null, geofencesFilteredList(value.query))
    // })

    // Conditions
    Homey.manager('flow').on('condition.auto_conditioning_state', function (callback, args) {
      TeslaDebugLog('Flow condition auto_conditioning_state', args)
      teslaApi.getClimateState(args.device.id).then(function (state) {
        callback(null, state.is_auto_conditioning_on || false)
      }).catch(callback)
    })
    Homey.manager('flow').on('condition.driver_temp_setting_value', function (callback, args) {
      TeslaDebugLog('Flow condition driver_temp_setting_value', args)
      teslaApi.getClimateState(args.device.id).then(function (state) {
        callback(null, state.driver_temp_setting > args.temperature)
      }).catch(callback)
    })
    Homey.manager('flow').on('condition.panoroof_state', function (callback, args) {
      TeslaDebugLog('Flow condition panoroof_state', args)
      teslaApi.getVehicleState(args.device.id).then(function (state) {
        if (state.sun_roof_installed === 0) return callback('no panaroof installed')
        callback(null, state.sun_roof_percent_open > 0)
      }).catch(callback)
    })
    Homey.manager('flow').on('condition.vehicle_moving', function (callback, args) {
      TeslaDebugLog('Flow condition vehicle_moving', args)
      teslaApi.getDriveState(args.device.id).then(function (state) {
        callback(null, state.speed > 0)
      }).catch(callback)
    })
    // Actions
    Homey.manager('flow').on('action.autoconditioning_control', function (callback, args) {
      TeslaDebugLog('Flow action autoconditioning control', args)
      teslaApi.controlAutoConditioning(args.device.id, args.autoconditioningstate).then(function (state) {
        callback(null, state)
      }).catch(callback)
    })
    Homey.manager('flow').on('action.autoconditioning_temperature', function (callback, args) {
      TeslaDebugLog('Flow action autoconditioning temperature', args)
      teslaApi.setAutoConditioningTemperatures(args.device.id, args.temp, args.temp).then(function (state) {
        callback(null, state)
      }).catch(callback)
    })
    Homey.manager('flow').on('action.flash_lights', function (callback, args) {
      TeslaDebugLog('Flow action flash lights', args)
      teslaApi.flashLights(args.device.id).then(function (state) {
        callback(null, state)
      }).catch(callback)
    })
    Homey.manager('flow').on('action.honk', function (callback, args) {
      TeslaDebugLog('Flow action honk', args)
      teslaApi.honkHorn(args.device.id).then(function (state) {
        callback(null, state)
      }).catch(callback)
    })
    Homey.manager('flow').on('action.panoroof_control', function (callback, args) {
      TeslaDebugLog('Flow action panoroof control', args)
      teslaApi.controlPanoRoof(args.device.id, args.panoroofstate).then(function (state) {
        callback(null, state)
      }).catch(callback)
    })


    // Homey.manager('flow').on('condition.vehicle_geofence', function (callback, args) {
    //   TeslaDebugLog('Flow condition vehicle_geofence', args)
    //   checkGeofencesForVehicle(args.device.id, true)
    //   callback(null, trackers[args.device.id].geofences.indexOf(args.geofence.geofenceId) !== -1)
    // })
    // Homey.manager('flow').on('action.get_position', function (callback, args) {
    //   TeslaDebugLog('Flow action get_position', args)
    //   // TODO: force position update for tracker if polling is disabled
    //   // TODO: do *all* the update and trigger magic here
    // })
    // Homey.manager('flow').on('trigger.vehicle_geofence_entered', function (callback, args, state) {
    //   TeslaDebugLog('flow trigger vehicle_geofence_entered evaluation', {card: args.geofence.geofenceId.toString(), state: state.geofence.toString()})
    //   if (args.geofence.geofenceId.toString() === state.geofence.toString()) {
    //     callback(null, true)
    //   } else {
    //     callback(null, false)
    //   }
    // })
    // Homey.manager('flow').on('trigger.vehicle_geofence_left', function (callback, args, state) {
    //   TeslaDebugLog('flow trigger vehicle_geofence_left evaluation', {card: args.geofence.geofenceId.toString(), state: state.geofence.toString()})
    //   if (args.geofence.geofenceId.toString() === state.geofence.toString()) {
    //     callback(null, true)
    //   } else {
    //     callback(null, false)
    //   }
    // })
    // Homey.manager('flow').on('action.say_address', function (callback, args, state) {
    //   TeslaDebugLog('Flow action say_address', args)
    //   var trackerId = args.device.id
    //
    //   function ready (err, trackerId) {
    //     if (err) return callback(err)
    //     var result = Util.createAddressSpeech(trackers[trackerId].location.place, trackers[trackerId].location.city, trackers[trackerId].name)
    //     TeslaDebugLog('result for speech', result)
    //     Homey.manager('speech-output').say(result, {session: state.session})
    //     callback(null, true)
    //   }
    //
    //   // polling is disabled
    //   if (tracking == null) {
    //     updateVehicle(trackerId, ready)
    //   } else {
    //     ready(null, trackerId)
    //   }
    // })

    Homey.manager('speech-input').on('speech', function (speech, callback) {
      var settings = Homey.manager('settings').get('teslaAccount')
      if (!settings.speech) { return callback(true, null) }

      function ready (err, trackerId) {
        if (err) return
        speech.say(Util.createAddressSpeech(trackers[trackerId].location.place, trackers[trackerId].location.city, trackers[trackerId].name))
      }

      if (speech.devices) {
        speech.devices.forEach(function (device) {
          if (tracking == null) {
            updateVehicle(device.id, ready)
          } else {
            ready(null, device.id)
          }
        })
        callback(null, true)
      } else {
        callback(true, null)
      }
    })

    Homey.manager('settings').on('set', function (setting) {
      if (setting === 'teslaAccount') {
        initiateTracking()
      }
      if (setting === 'teslaGrant') {
        TeslaDebugLog('new grant registered', Homey.manager('settings').get(setting))
        // do nothing
      }
      if (setting === 'geofences') {
        geofences = Homey.manager('settings').get(setting)
        checkGeofences()
      }
    })

    // delay initiation becouse getting settings per device take time
    setTimeout(initiateTracking, 5000)
    callback()
  },
  renamed: function (device, name, callback) {
    TeslaDebugLog('rename vehicle', [device, name])
    trackers[device.id].name = name
    callback()
  },
  deleted: function (device) {
    TeslaDebugLog('delete vehicle', device)
    delete trackers[device.id]
    initiateTracking()
  },
  pair: function (socket) {
    var settings = Homey.manager('settings').get('teslaAccount')
    var grant = Homey.manager('settings').get('teslaGrant')
    var teslaPair = new Tesla({
      user: settings.user,
      password: settings.password,
      grant: grant
    })

    socket.on('start', function (data, callback) {
      if (!settings) return callback('errorNoSettings')
      teslaApi.validateGrant()
        .then(function () {
          callback(null)
        })
        .catch(function (error) {
          callback('errorInvalidSettings')
        })
    })
    socket.on('list_devices', function (data, callback) {
      var devices = []
      teslaApi.getVehicles().then(function (vehicles) {
        if (!vehicles) return callback('errorNoVehiclesFound')
        vehicles.forEach((vehicle) => {
          devices.push({
            name: vehicle.display_name,
            data: {id: vehicle.id},
            icon: 'icon.svg'
          })
        })
        callback(null, devices)
      })
    })
    socket.on('add_device', function (device, callback) {
      teslaPair = null
      TeslaDebugLog('pairing: vehicle added', device)
      trackers[device.data.id] = {
        trackerId: device.data.id,
        name: device.name,
        location: {},
        geofences: [],
        settings: {
          retriggerRestrictTime: 1,
          retriggerRestrictDistance: 1,
          stoppedMovingTimeout: 120
        }
      }
      trackerTimeoutObjects[device.data.id] = null
      initiateTracking()
      callback(null)
    })
  },
  settings: function (device_data, newSettingsObj, oldSettingsObj, changedKeysArr, callback) {
    TeslaDebugLog('settings changed', {device_data: device_data, newSettingsObj: newSettingsObj, changedKeysArr: changedKeysArr})

    // TODO: translate errors
    if (newSettingsObj.retriggerRestrictTime < 0) { return callback('Negative value') }
    if (newSettingsObj.retriggerRestrictDistance < 0) { return callback('Negative value') }
    if (newSettingsObj.stoppedMovingTimeout < 30) { return callback('Timout cannot be smaller than 30 seconds') }
    try {
      changedKeysArr.forEach(function (key) {
        trackers[device_data.id].settings[key] = newSettingsObj[key]
      })
      callback(null, true)
    } catch (error) {
      callback(error)
    }
  },
  capabilities: {
    location: {
      get: function (device_data, callback) {
        TeslaDebugLog('capabilities > location > get', device_data)
        if (!teslaApi) return callback('not_initiated')
        teslaApi.getDriveState(devices_data.id)
        .then(function (state) {
          var location = {
            lng: state.longitude, // trackers[device_data.id].location.lng
            lat: state.latitude // trackers[device_data.id].location.lat
          }
          callback(null, JSON.stringify(location))
        })
        .catch(callback)
      }
    },
    moving: {
      get: function (device_data, callback) {
        TeslaDebugLog('capabilities > moving > get', device_data)
        if (!teslaApi) return callback('not_initiated')
        teslaApi.getDriveState(devices_data.id)
        .then(function (state) {
          callback(null, state.speed != null)
        })
        .catch(callback)
        callback(null, trackers[device_data.id].moving)
      }
    }
  },
  getVehicles: function (callback) {
    callback(trackers)
  }
}

module.exports = self
