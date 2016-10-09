/* global $, Homey, __ */

function initAccount () {
  clearBusy()
  clearError()
  clearSuccess()

  Homey.get('teslaAccount', function (error, currentTeslaAccount) {
    if (error) return console.error(error)
    if (currentTeslaAccount != null) {
      $('#teslaUsername').val(currentTeslaAccount['user'])
      $('#teslaPassword').val(currentTeslaAccount['password'])
      $('#teslaSpeech').prop('checked', currentTeslaAccount['speech'])
      $('#teslaPolling').prop('checked', currentTeslaAccount['polling'])
      $('#teslaDebug').prop('checked', currentTeslaAccount['debug'])
    }
  })
}

function clearTeslaAccount () {
  Homey.confirm(__('settings.account.messages.confirmClearAccount'), 'warning', function (error, result) {
    if (error) return console.error(error)
    if (result) {
      showBusy(__('settings.account.messages.busyClearing'))
      Homey.set('teslaAccount', null, function (error, result) {
        if (error) return console.error(error)
        $('#teslaUsername').val('')
        $('#teslaPassword').val('')
        $('#teslaSpeech').prop('checked', true)
        $('#teslaPolling').prop('checked', true)
        $('#teslaDebug').prop('checked', false)
        showSuccess(__('settings.account.messages.successClearing'), 3000)
      })
    }
  })
}

function saveTeslaAccount () {
  var currentTeslaAccount = {
    user: $('#teslaUsername').val(),
    password: $('#teslaPassword').val(),
    speech: $('#teslaSpeech').prop('checked'),
    polling: $('#teslaPolling').prop('checked'),
    debug: $('#teslaDebug').prop('checked')
  }
  showBusy(__('settings.account.messages.busyValidation'))
  $('#saveTeslaAccount').prop('disabled', true)
  Homey.api('GET', '/validate/account?' + $.param(currentTeslaAccount), function (error, result) {
    if (error) {
      $('#saveTeslaAccount').prop('disabled', false)
      return showError(__('settings.account.messages.errorValidation.' + error))
    }
    showBusy(__('settings.account.messages.busySaving'))
    setTimeout(function () {
      Homey.set('teslaAccount', currentTeslaAccount, function (error, settings) {
        $('#saveTeslaAccount').prop('disabled', false)
        if (error) { return showError(__('settings.account.messages.errorSaving')) }
        showSuccess(__('settings.account.messages.successSaving'), 3000)
      })
    }, 2000)
  })
}

function clearBusy () { $('#busy').hide() }
function showBusy (message, showTime) {
  clearError()
  clearSuccess()
  $('#busy span').html(message)
  $('#busy').show()
  if (showTime) $('#busy').delay(showTime).fadeOut()
}

function clearError () { $('#error').hide() }
function showError (message, showTime) {
  clearBusy()
  clearSuccess()
  $('#error span').html(message)
  $('#error').show()
  if (showTime) $('#error').delay(showTime).fadeOut()
}

function clearSuccess () { $('#success').hide() }
function showSuccess (message, showTime) {
  clearBusy()
  clearError()
  $('#success span').html(message)
  $('#success').show()
  if (showTime) $('#success').delay(showTime).fadeOut()
}
