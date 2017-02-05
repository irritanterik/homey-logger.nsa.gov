/* global $, Homey */

function showPanel (panel) {
  $('.panel').hide()
  $('.panel-button').removeClass('active')
  $('#panel-button-' + panel).addClass('active')
  $('#panel-' + panel).show()

  if (panel === 3) {
    initPerformance()
    // slider label issue https://github.com/seiyria/bootstrap-slider/issues/673
  }
}

function onHomeyReady () {
  initLogging()
  initConfiguration()
  showPanel(1)
  Homey.ready()
}
