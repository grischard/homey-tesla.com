/* global Homey */
'use strict'

var Tesla = require('../../lib/tesla.js')
var FlowConditions = require('../../lib/flow/conditions.js')
var FlowActions = require('../../lib/flow/actions.js')
var Util = require('../../lib/util.js')
var Inside = require('point-in-polygon')
var teslaApi = null
var retryTrackingTimeoutId = null
var tracking = null
var trackers = {}
var trackerTimeoutObjects = {}
var geofences = {}

function checkGeofences (notrigger) {
  if (!trackers) return
  Object.keys(trackers).forEach((trackerId) => {
    checkGeofencesForVehicle(trackerId, notrigger)
  })
}

function checkGeofencesForVehicle (trackerId, notrigger) {
  if (!geofences) return
  Object.keys(geofences).forEach((geofenceId) => {
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
        geofences[geofenceId].polygon.path.forEach((point) => {
          geofencePathShort.push([point.lat, point.lng])
        })
      } else {
        geofences[geofenceId].rectangle.path.forEach((point) => {
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
            Util.debugLog('flow trigger vehicle_geofence_entered ', {id: trackerId, geofenceId: geofenceId, error: err, result: result})
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
            Util.debugLog('flow trigger vehicle_geofence_left ', {id: trackerId, geofenceId: geofenceId, error: err, result: result})
          }
        )
      }
    }
  })
}

function stopMoving (trackerId) {
  Util.debugLog('stopMoving called', {trackerId: trackerId, moving: trackers[trackerId].moving})
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
      Util.debugLog('flow trigger vehicle_stopt_moving ', {id: trackerId, error: err, result: result})
    }
  )
}

function updateVehicle (trackerId, callback) {
  Util.debugLog('######### TESLA TRACKING ## updateVehicle #########################')
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
    .then((address) => {
      trackers[trackerId].location = address
      callback(null, trackerId)
    })
    .catch((error) => {
      Util.debugLog('event: error', error)
      return callback(error)
    })
}

function initiateTracking () {
  if (retryTrackingTimeoutId) clearTimeout(retryTrackingTimeoutId)
  retryTrackingTimeoutId = null

  Util.debugLog('######### TESLA TRACKING ## initiateTracking #########################')
  // if (teslaApi) teslaApi.stopTracking()
  teslaApi = null
  geofences = Homey.manager('settings').get('geofences')
  var settings = Homey.manager('settings').get('teslaAccount')
  var grant = Homey.manager('settings').get('teslaGrant')
  if (!settings) return Util.debugLog('  no settings!')

  teslaApi = new Tesla({
    user: settings.user,
    password: settings.password,
    grant: grant,
    intervalMS: 10000 // TODO: read from app setting
  })

  if (!Object.keys(trackers).length) return Util.debugLog('  no devices to track!')
  teslaApi.on('error', (error) => { Util.debugLog('event: error', error) })
  teslaApi.on('grant', (newgrant) => { Homey.manager('settings').set('teslaGrant', newgrant) })

  // >> temp code
  Object.keys(trackers).forEach((trackerId) => {
    teslaApi.getDriveState(trackerId).then((state) => {
      trackers[trackerId].location = {
        place: 'straat',
        city: 'plaats',
        lat: state.latitude,
        lng: state.longitude
      }
    })
  })

  if (!settings.polling) return Util.debugLog('  polling disabled in settings')

  Object.keys(trackers).forEach((trackerId) => {
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

  teslaApi.on('tracking_terminated', (reason) => {
    if (tracking) {
      Util.debugLog('event: tracking_terminated, will retry in 10 minutes.', reason)
      tracking = null
      if (!retryTrackingTimeoutId) {
        retryTrackingTimeoutId = setTimeout(initiateTracking, 10 * 60 * 1000)
      }
    }
  })
  teslaApi.on('message', (trackerId, data) => {
    Util.debugLog('event: message', {id: trackerId, distance: data.distance})
  })
  teslaApi.on('location', (trackerId, data) => {
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
      Util.debugLog('initial location for vehicle', {id: trackerId, place: place, city: city})
      return
    }

    // handle flows
    Util.debugLog('event: location', {id: trackerId, place: place, city: city, distance: data.distance, wasMoving: wasMoving, timeConstraint: timeConstraint, distanceConstraint: distanceConstraint})
    checkGeofencesForVehicle(trackerId)
    if (wasMoving) {
      // next if part is temp fix. Should be removed when bug final fixed
      if (!trackers[trackerId].route) {
        Util.debugLog('vehicle was moving, but without route object', {id: trackerId, tracker: trackers[trackerId]})
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
        (err, result) => {
          Util.debugLog('flow trigger vehicle_start_moving ', {id: trackerId, error: err, result: result})
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
        (err, result) => {
          Util.debugLog('flow trigger vehicle_moved ', {id: trackerId, error: err, result: result})
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
    devices_data.forEach((device_data) => {
      Homey.manager('drivers').getDriver('models').getName(device_data, (err, name) => {
        console.log('device name: ', name, device_data)
        if (err) return
        trackers[device_data.id] = {
          trackerId: device_data.id,
          name: name,
          location: {},
          geofences: []
        }
        trackerTimeoutObjects[device_data.id] = null
        module.exports.getSettings(device_data, (err, settings) => {
          if (err) Util.debugLog('Error on loading device settings', {device_data: device_data, error: err})
          var trackersettings = {
            retriggerRestrictTime: settings.retriggerRestrictTime || 1,
            retriggerRestrictDistance: settings.retriggerRestrictDistance || 1,
            stoppedMovingTimeout: settings.stoppedMovingTimeout || 120
          }
          trackers[device_data.id].settings = trackersettings
        })
      })
    })

    // Init flows
    FlowConditions.init()
    FlowActions.init()

    Homey.manager('speech-input').on('speech', (speech, callback) => {
      var settings = Homey.manager('settings').get('teslaAccount')
      if (!settings.speech) { return callback(true, null) }

      function ready (err, trackerId) {
        if (err) return
        speech.say(Util.createAddressSpeech(trackers[trackerId].location.place, trackers[trackerId].location.city, trackers[trackerId].name))
      }

      if (speech.devices) {
        speech.devices.forEach((device) => {
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

    Homey.manager('settings').on('set', (setting) => {
      switch (setting) {
        case 'teslaAccount':
          initiateTracking()
          break
        case 'teslaGrant':
          Util.debugLog('new grant registered', Homey.manager('settings').get(setting))
          break
        case 'geofences':
          geofences = Homey.manager('settings').get(setting)
          checkGeofences()
          break
      }
    })

    // delay initiation becouse getting settings per device take time
    setTimeout(initiateTracking, 3000)
    callback()
  },
  renamed: function (device, name, callback) {
    Util.debugLog('rename vehicle', [device, name])
    trackers[device.id].name = name
    callback()
  },
  deleted: function (device) {
    Util.debugLog('delete vehicle', device)
    delete trackers[device.id]
    initiateTracking()
  },
  pair: function (socket) {
    socket.on('start', (data, callback) => {
      var settings = Homey.manager('settings').get('teslaAccount')
      if (!settings) return callback('errorNoSettings')
      teslaApi.validateGrant()
      .then(callback(null))
      .catch((reason) => { callback('errorInvalidSettings') })
    })
    socket.on('list_devices', (data, callback) => {
      var devices = []
      teslaApi.getVehicles().then((vehicles) => {
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
    socket.on('add_device', (device, callback) => {
      Util.debugLog('pairing: vehicle added', device)
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
    Util.debugLog('settings changed', {device_data: device_data, newSettingsObj: newSettingsObj, changedKeysArr: changedKeysArr})

    // TODO: translate errors
    if (newSettingsObj.retriggerRestrictTime < 0) { return callback('Negative value') }
    if (newSettingsObj.retriggerRestrictDistance < 0) { return callback('Negative value') }
    if (newSettingsObj.stoppedMovingTimeout < 30) { return callback('Timout cannot be smaller than 30 seconds') }
    try {
      changedKeysArr.forEach((key) => {
        trackers[device_data.id].settings[key] = newSettingsObj[key]
      })
      callback(null, true)
    } catch (e) {
      callback(e)
    }
  },
  capabilities: {
    location: {
      get: function (device_data, callback) {
        Util.debugLog('capabilities > location > get', device_data)
        if (!teslaApi) return callback('not_initiated')
        teslaApi.getDriveState(device_data.id)
        .then((state) => {
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
        Util.debugLog('capabilities > moving > get', device_data)
        if (!teslaApi) return callback('not_initiated')
        teslaApi.getDriveState(device_data.id)
        .then((state) => { callback(null, state.speed != null) })
        .catch(callback)
        // callback(null, trackers[device_data.id].moving)
      }
    }
  },
  getVehicles: () => { return trackers },
  getApi: () => { return teslaApi }
}

module.exports = self
