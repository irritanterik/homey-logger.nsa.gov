/* global $, Homey */

function showPanel (panel) {
  $('.panel').hide()
  $('.panel-button').removeClass('active')
  $('#panel-button-' + panel).addClass('active')
  $('#panel-' + panel).show()
}

function onHomeyReady () {
  showPanel(1)
  initLogging()
  initConfiguration()
  Homey.ready()
  // Homey.alert(navigator.userAgent)
}
