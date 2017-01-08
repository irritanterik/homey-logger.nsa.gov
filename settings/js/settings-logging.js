/* global Homey, $, __ */

function initLogging () {
  listenToAll()
}

function listenToAll () {
  listenOn('manager:apps', 'appsManager')
  listenOn('manager:flow', 'flow')
  listenOn('manager:geolocation', 'geolocation')
  listenOn('manager:insights', 'insights')
  listenOn('manager:ledring', 'ledring')
  listenOn('manager:speech-output', 'speechOutput')
  listenOn('manager:speech-input', 'speechInput')
  listenOn('manager:zwave', 'zwave')
  listenOn('manager:notifications', 'notifications')
  listenOn('manager:presence', 'presence')
// listenApps()
// listenDevices()
// listenManagerDevices()
}

function listenOn (namespace, category) {
  var socket = window.parent.Homey.realtime(namespace)
  socket.onevent = function (packet) { // Override incoming socket events to catch everything
    console.log(namespace, packet.data[0], packet.data[1])
    addLogEntry(category + ': ' + packet.data[0], packet.data[1], category)
    // if (category === 'appsManager' && packet.data[0] === 'ready') {
      // addLogEntry('Start app listener for app', packet.data[1], 'apps')
    // }
  }
}

function addLogEntry (event, data, category, optionalStyle) {
  if (!data) data = ''
  var html = '<tr class="logentry ' + category
  if (optionalStyle) html += ' ' + optionalStyle
  html += '"><td class="datetime small text-nowrap">' + new Date().toISOString() + '</td>'
  html += '<td class="event small">' + event.capitalizeFirstLetter() + '</td>'
  html += '<td class="data small text-muted">' + (!data ? '' : JSON.stringify(data)) + '</td></tr>'
  $('table#logs tbody tr:first').before(html)

  // if (setting[category]) {
  //   $('.' + category).show()
  // } else {
  //   $('.' + category).hide()
  // }
}

String.prototype.capitalizeFirstLetter = function () {
  return this.charAt(0).toUpperCase() + this.slice(1)
}
