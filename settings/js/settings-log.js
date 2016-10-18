/* global $, Homey */

function initLogging () {
  firstLoadLog()
  Homey.on('teslaLog', function (data) {
    addLogEntry(data.datetime, data.message, data.data)
  })
}

function clearTeslaLog () {
  Homey.set('teslaLog', [{datetime: new Date(), message: 'Log cleared', data: null}], function (error, result) {
    if (error) return console.error(error)
    firstLoadLog()
  })
}

function copyTeslaLog () {
  Homey.get('teslaLog', function (error, value) {
    if (error) return Homey.alert(error)
    window.prompt('Copy this', JSON.stringify(value))
  })
}

function testTeslaApi () {
  Homey.api('GET', '/testApi')
}

function firstLoadLog () {
  $('tr.logentry').remove()
  Homey.get('teslaLog', function (error, value) {
    if (error) return console.error(error)
    if (value != null) {
      $.each(value, function (index, obj) {
        addLogEntry(value[index].datetime, value[index].message, value[index].data)
      })
    }
  })
}

function addLogEntry (datetime, message, data) {
  var html = '<tr class="logentry"><td class="datetime">' +
  datetime + '</td><td class="entry"><strong>' + message + '</strong>'
  if (data == null) {
    html += '</td></tr>'
  } else {
    html += '<br><code>' + JSON.stringify(data, ' ') + '</code></td></tr>'
  }
  $('table#logs tr:first').after(html)
}
