/* global $, Homey */

function showPanel (panel) {
  $('.panel').hide()
  $('.panel-button').removeClass('active')
  $('#panel-button-' + panel).addClass('active')
  $('#panel-' + panel).show()
}

function onHomeyReady () {
  initLogging()
  initConfiguration()
  showPanel(1)
  Homey.ready()
}
