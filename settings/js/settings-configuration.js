/* global Homey, $, __ */

var categories = {}

function initConfiguration () {
  clearBusy()
  clearError()
  clearSuccess()
  $('#template').hide()
  loadSettings()
}

function loadSettings () {
  Homey.get('settings', function (error, currentSettings) {
    if (error) return console.error(error)
    if (currentSettings != null) {
      // $('#apiAuthorization').prop('checked', currentHttpSettings['apiAuthorization'])
    } else {
      // $('#apiAuthorization').prop('checked', true)
    }
  })
}

function optionsChanged () {
  categories = {
    appsManager: $('#appsManager').prop('checked'),
    apps: $('#apps').prop('checked'),
    deviceManager: $('#deviceManager').prop('checked'),
    devices: $('#devices').prop('checked'),
    flow: $('#flow').prop('checked'),
    geolocation: $('#geolocation').prop('checked'),
    insights: $('#insights').prop('checked'),
    ledring: $('#ledring').prop('checked'),
    notifications: $('#notifications').prop('checked'),
    presence: $('#presence').prop('checked'),
    speechInput: $('#speechInput').prop('checked'),
    speechOutput: $('#speechOutput').prop('checked'),
    zwave: $('#zwave').prop('checked')
  }

  $.each(categories, function (category) {
    if (categories[category]) {
      $('.' + category).show()
    } else {
      $('.' + category).hide()
    }
  })
}

function saveConfiguration () {
  var newSettings = {}
  Homey.set('settings', newSettings, function (error, settings) {
    if (error) { return showError(__('settings.configuration.messages.errorSaving')) }
    showSuccess(__('settings.configuration.messages.successSaving'), 3000)
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
