var http = require('http.min')
var EventEmitter = require('events')
var util = require('util')

const apiEndpoint = 'https://owner-api.teslamotors.com/'
const streamingEndpoint = 'streaming.vn.teslamotors.com/stream/'
const apiConsts = ['\x65\x34\x61\x39\x39\x34\x39\x66\x63\x66\x61\x30\x34\x30\x36\x38\x66\x35\x39\x61\x62\x62\x35\x61\x36\x35\x38\x66\x32\x62\x61\x63\x30\x61\x33\x34\x32\x38\x65\x34\x36\x35\x32\x33\x31\x35\x34\x39\x30\x62\x36\x35\x39\x64\x35\x61\x62\x33\x66\x33\x35\x61\x39\x65', '\x63\x37\x35\x66\x31\x34\x62\x62\x61\x64\x63\x38\x62\x65\x65\x33\x61\x37\x35\x39\x34\x34\x31\x32\x63\x33\x31\x34\x31\x36\x66\x38\x33\x30\x30\x32\x35\x36\x64\x37\x36\x36\x38\x65\x61\x37\x65\x36\x65\x37\x66\x30\x36\x37\x32\x37\x62\x66\x62\x39\x64\x32\x32\x30']

function Tesla (options) {
  var self = this
  EventEmitter.call(self)
  if (options == null) { options = {} }
  self.user = options.user
  self.password = options.password
  self.grant = options.grant || null
  self.cache = 1
  // self.vehicles = []
  // self.intervalMS = options.intervalMS || 10000
  // self.intervalId = null
}
util.inherits(Tesla, EventEmitter)

Tesla.prototype.login = function () {
  var self = this
  return new Promise(function (resolve, reject) {
    login(self.user, self.password, function (error, grant) {
      if (error) return reject(error)
      self.grant = grant
      self.emit('grant', grant)
      resolve(grant)
    })
  })
}

Tesla.prototype.logout = function () {
  return new Promise(function (resolve, reject) {
    resolve()
  })
}

Tesla.prototype.validateGrant = function () {
  var self = this
  return new Promise(function (resolve, reject) {
    // check if token exists and valid based on expiration
    // check if token still works on api
    // if one of above checks fails: aquire new grant
    // if new grant cannot be aquired: failure
    if (grantExpired(self.grant)) {
      self.login().then(resolve).catch(reject)
    } else {
      checkTokenWithRequest(self.grant.access_token, function (valid) {
        if (valid) resolve()
        else self.login().then(resolve).catch(reject)
      })
    }
  })
}

Tesla.prototype.honkHorn = function (vehicleId) {
  var self = this
  return new Promise(function (resolve, reject) {
    checkActiveGrant(self)
    .then(function () {
      postVehicleCommand(self.grant.access_token, vehicleId, 'command/honk_horn', null, function (error, state) {
        if (error) reject(error)
        else resolve(state)
      })
    })
  })
}

Tesla.prototype.flashLights = function (vehicleId) {
  var self = this
  return new Promise(function (resolve, reject) {
    checkActiveGrant(self)
    .then(function () {
      postVehicleCommand(self.grant.access_token, vehicleId, 'command/flash_lights', null, function (error, state) {
        if (error) reject(error)
        else resolve(state)
      })
    })
  })
}

Tesla.prototype.getVehicles = function () {
  var self = this
  return new Promise(function (resolve, reject) {
    checkActiveGrant(self).then(function () {
      getVehicles(self.grant.access_token, function (error, vehicles) {
        if (error) reject(error)
        else resolve(vehicles)
      })
    })
  })
}

Tesla.prototype.getVehicle = function (vehicleId) {
  var self = this
  return new Promise(function (resolve, reject) {
    checkActiveGrant(self).then(function () {
      getVehicle(self.grant.access_token, vehicleId, function (error, vehicle) {
        if (error) reject(error)
        else resolve(vehicle)
      })
    })
  })
}

Tesla.prototype.getChargeState = function (vehicleId) {
  var self = this
  return new Promise(function (resolve, reject) {
    checkActiveGrant(self).then(function () {
      getVehicleCommand(self.grant.access_token, vehicleId, 'data_request/charge_state', function (error, state) {
        if (error) reject(error)
        else resolve(state)
      })
    })
  })
}

Tesla.prototype.getClimateState = function (vehicleId) {
  var self = this
  return new Promise(function (resolve, reject) {
    checkActiveGrant(self).then(function () {
      getVehicleCommand(self.grant.access_token, vehicleId, 'data_request/climate_state', function (error, state) {
        if (error) reject(error)
        else resolve(state)
      })
    })
  })
}

Tesla.prototype.getDriveState = function (vehicleId) {
  var self = this
  return new Promise(function (resolve, reject) {
    checkActiveGrant(self).then(function () {
      getVehicleCommand(self.grant.access_token, vehicleId, 'data_request/drive_state', function (error, state) {
        if (error) reject(error)
        else resolve(state)
      })
    })
  })
}

Tesla.prototype.getGuiSettings = function (vehicleId) {
  var self = this
  return new Promise(function (resolve, reject) {
    checkActiveGrant(self).then(function () {
      getVehicleCommand(self.grant.access_token, vehicleId, 'data_request/gui_settings', function (error, state) {
        if (error) reject(error)
        else resolve(state)
      })
    })
  })
}

Tesla.prototype.getMobileAccess = function (vehicleId) {
  var self = this
  return new Promise(function (resolve, reject) {
    checkActiveGrant(self).then(function () {
      getVehicleCommand(self.grant.access_token, vehicleId, 'mobile_enabled', function (error, state) {
        if (error) reject(error)
        else resolve(state)
      })
    })
  })
}

Tesla.prototype.getVehicleState = function (vehicleId) {
  var self = this
  return new Promise(function (resolve, reject) {
    checkActiveGrant(self).then(function () {
      getVehicleCommand(self.grant.access_token, vehicleId, 'data_request/vehicle_state', function (error, state) {
        if (error) reject(error)
        else resolve(state)
      })
    })
  })
}

Tesla.prototype.setChargeLimit = function (vehicleId, limit) {
  var self = this
  return new Promise(function (resolve, reject) {
    if (isNaN(limit) || limit > 100 || limit < 1 || limit.toFixed() !== limit.toString()) return reject('limit_invalid')

    checkActiveGrant(self).then(function () {
      postVehicleCommand(self.grant.access_token, vehicleId, 'command/set_charge_limit', {percent: limit}, function (error, state) {
        if (error) reject(error)
        else resolve(state)
      })
    })
  })
}

Tesla.prototype.setAutoConditioningTemperatures = function (vehicleId, driver, passenger) {
  var self = this
  return new Promise(function (resolve, reject) {
    var values = {}
    if (driver) values.driver_temp = driver
    if (passenger) values.passenger_temp = passenger
    checkActiveGrant(self).then(function () {
      postVehicleCommand(self.grant.access_token, vehicleId, 'command/set_temps', values, function (error, state) {
        if (error) reject(error)
        else resolve(state)
      })
    })
  })
}

Tesla.prototype.streamStart = function (vehicleId, token) {
  var self = this
  var streamingColumns = ['elevation', 'est_heading', 'est_lat', 'est_lng', 'est_range', 'heading', 'odometer', 'power', 'range', 'shift_state', 'speed', 'soc']

  function again (user, vehicle, streamingColumns) {
    console.log(new Date(), 'start again...')
    streamRequest(user, vehicle, streamingColumns, function (error, result) {
      console.log(new Date(), '...resultaat', error, result)
      setTimeout(again(user, vehicle, streamingColumns), 1000)
    })
  }

  return new Promise(function (resolve, reject) {
    self
    .getVehicle(vehicleId)
    .then(function (vehicle) {
      again(self.user, vehicle, streamingColumns)
      resolve(vehicle) // >>> TODO fix
    })
  })
}

function streamRequest (user, vehicle, columns, callback) {
  var options = {
    uri: 'https://' + user + ':' + vehicle.tokens[0] + '@' + streamingEndpoint + vehicle.vehicle_id + '/?values=' + columns.join(',')
  }
  http.get(options).then(function (result) {
    if (result.response.statusCode !== 200) return callback(result.response.statusCode)
    callback(null, result.data)
  }).catch(function (error) {
    callback(error)
  })
}

Tesla.prototype.controlAutoConditioning = function (vehicleId, state) {
  var self = this
  return new Promise(function (resolve, reject) {
    if (typeof state !== 'boolean') return reject('state_invalid')
    checkActiveGrant(self).then(function () {
      postVehicleCommand(self.grant.access_token, vehicleId, `command/auto_conditioning_${state ? 'start' : 'stop'}`, null, function (error, state) {
        if (error) reject(error)
        else resolve(state)
      })
    })
  })
}

Tesla.prototype.controlPanoRoof = function (vehicleId, roofstate) {
  var self = this
  var panoRoofStateValues = ['open', 'close', 'comfort', 'vent']
  return new Promise(function (resolve, reject) {
    if (panoRoofStateValues.indexOf(roofstate) < 0) return reject('roofstate_invalid')
    checkActiveGrant(self).then(function () {
      postVehicleCommand(self.grant.access_token, vehicleId, 'command/sun_roof_control', {state: roofstate}, function (error, state) {
        if (error) reject(error)
        else resolve(state)
      })
    })
  })
}

Tesla.prototype.controlPanoRoofPercentage = function (vehicleId, limit) {
  var self = this
  return new Promise(function (resolve, reject) {
    if (isNaN(limit) || limit > 100 || limit < 0 || limit.toFixed() !== limit.toString()) return reject('limit_invalid')
    checkActiveGrant(self).then(function () {
      postVehicleCommand(self.grant.access_token, vehicleId, 'command/sun_roof_control', {state: 'move', percent: limit}, function (error, state) {
        if (error) reject(error)
        else resolve(state)
      })
    })
  })
}

// Validates token if token seems invalid
// >>>
function checkActiveGrant (self) {
  return new Promise(function (resolve, reject) {
    if (!grantExpired(self.grant)) return resolve()
    self.login().then(resolve).catch(reject)
  })
}

// Returns false if token is valid, true on invalid
function grantExpired (grant) {
  if (!grant) return true
  if (!grant.access_token) return true
  if (((grant.created_at + grant.expires_in) * 1000) < new Date().getTime()) return true
  return false
}

// login function returns sessionId
function login (user, password, callback) {
  if (!user) return callback('no_username')
  if (!password) return callback('no_password')

  var options = {
    uri: `${apiEndpoint}oauth/token`,
    json: true,
    form: {
      grant_type: 'password',
      client_id: apiConsts[0],
      client_secret: apiConsts[1],
      email: user,
      password: password
    }
  }
  http.post(options).then(function (result) {
    if (result.data.response) return callback(result.data.response)
    if (!result.data.access_token) return callback('no_token')
    callback(null, result.data)
  }).catch(callback)
} // end function login

function checkTokenWithRequest (token, callback) {
  if (!token) return callback('no_token')
  var options = {
    uri: `${apiEndpoint}api/1/vehicles`,
    headers: {Authorization: `Bearer ${token}`}
  }
  http.get(options).then(function (result) {
    if (!result.response) return callback(false)
    if (result.response.statusCode !== 200) return callback(false)
    callback(true)
  }).catch(function () { callback(false) })
} // end function checkTokenWithRequest

function getVehicle (token, vehicleId, callback) {
  if (!token) return callback('no_token')
  if (!vehicleId) return callback('no_vehicleId')
  var options = {
    uri: `${apiEndpoint}api/1/vehicles/${vehicleId}`,
    headers: {Authorization: `Bearer ${token}`}
  }
  http.json(options).then(function (result) {
    if (!result.response) return callback('error')
    callback(null, result.response)
  }).catch(callback)
} // end function getVehicle

function getVehicles (token, callback) {
  if (!token) return callback('no_token')
  var options = {
    uri: `${apiEndpoint}api/1/vehicles`,
    headers: {Authorization: `Bearer ${token}`}
  }
  http.json(options).then(function (result) {
    if (!result.response) return callback('error')
    callback(null, result.response)
  }).catch(callback)
} // end function getVehicles

function getVehicleCommand (token, vehicleId, command, callback) {
  if (!token) return callback('no_token')
  if (!vehicleId) return callback('no_vehicleId')
  if (!command) return callback('no_command')
  var options = {
    uri: `${apiEndpoint}api/1/vehicles/${vehicleId}/${command}`,
    headers: {Authorization: `Bearer ${token}`}
  }
  http.json(options).then(function (result) {
    if (!result.response) return callback('error')
    callback(null, result.response)
  }).catch(callback)
} // end function getVehicleCommand

function postVehicleCommand (token, vehicleId, command, body, callback) {
  if (!token) return callback('no_token')
  if (!vehicleId) return callback('no_vehicleId')
  if (!command) return callback('no_command')
  var options = {
    uri: `${apiEndpoint}api/1/vehicles/${vehicleId}/${command}`,
    headers: {Authorization: `Bearer ${token}`},
    form: body || null,
    json: true
  }
  http.post(options).then(function (result) {
    if (!result.response) return callback('error')
    if (result.response.statusCode !== 200) return callback(result.response)
    callback(null, result.data.response)
  }).catch(callback)
} // end function postVehicleCommand

exports = module.exports = Tesla
