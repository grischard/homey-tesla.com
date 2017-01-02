/* global Homey */
var Util = require('../util.js')

exports.init = function () {
  Homey.manager('speech-input').on('speech', onSpeechInput)
}

function onSpeechInput (speech, callback) {
  Util.debugLog('Evaluating speech trigger', speech)
  var settings = Homey.manager('settings').get('teslaAccount')
  if (!settings || !settings.speech) { return callback(true, null) }
  if (!speech.devices) return callback(true, null)

  speech.devices.forEach((device) => {
    Homey.manager('drivers').getDriver(device.data.homeyDriverName).getName(device.data, (error, name) => {
      if (error) return callback(null, false)
      Homey.app.getDriverApi(device.data.homeyDriverName)
      .then(api => api.getLocation(device.data.id))
      .then(location => {
        var result = Util.createAddressSpeech(location.place, location.city, name)
        Util.debugLog('Speech result', result)
        speech.say(result)
        callback(null, true)
      }).catch(callback)
    })
  })
}
