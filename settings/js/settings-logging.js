/* global Homey, $, __ */

var devices = []
var apps = []

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
  listenOn('manager:devices', 'devices')
  listenApps()
  listenDevices()
  // listenManagerDevices()
}

function getDeviceNameById (searchId) {
  var result = null
  devices.forEach(function (device, index) {
    if (device.id === searchId) {
      result = device.name
    }
  })
  return result
}

function listenManagerDevices () {
  var socket = window.parent.Homey.realtime('manager:devices')
  socket.on('disconnect', function () {
    console.log('Got disconnect!')
  })
  socket.onevent = function (packet) { // Override incoming socket events
    console.log('***', 'realtime/manager/devices/', packet.data[0], packet.data[1].device_id, packet.data[1].message, packet)
    addLogEntry(getDeviceNameById(packet.data[1].device_id), packet.data[0], 'deviceManager', 'danger')
  }
}

var devicesockets = []
function listenDevices () {
  // get all devices and handels all events on /realtime/device/device_id/
  $.getJSON(window.location.origin + '/api/manager/devices/device/', function (data) {
    addLogEntry('Start device listener', 'Will listen to realtime events of ' + Object.keys(data.result).length + ' devices', 'devices')
    $.each(data.result, function (index, resultDevice) {
      var device = {
        id: resultDevice.id,
        name: resultDevice.name
      }
      devices.push(device)
      var deviceSocket = window.parent.io.connect(window.location.origin + '/realtime/device/' + device.id + '/')
      var _onevent = deviceSocket.onevent
      deviceSocket.onevent = function (packet) { // Override incoming socket events
        console.log(packet)
        var args = packet.data || []
        addLogEntry(device.name, args, 'devices')
        _onevent.call(deviceSocket, packet)
      }
      devicesockets.push(deviceSocket)
    })
  })
}

function listenApps () {
  // get all apps and handels all events on /realtime/app/app_id/
  $.getJSON(window.location.origin + '/api/manager/apps/app', function (data) {
    addLogEntry('Start app listener', 'Will listen to realtime events of ' + Object.keys(data.result).length + ' apps', 'apps')
    $.each(data.result, function (index, resultApp) {
      var app = {
        id: resultApp.id,
        name: resultApp.name.en
      }
      apps.push(app)
      var appSocket = window.parent.io.connect(window.location.origin + '/realtime/app/' + app.id + '/')
      var _onevent = appSocket.onevent
      appSocket.onevent = function (packet) { // Override incoming socket events
        var args = packet.data || []
        console.log('*** realtime/app', 'onevent', args, packet, app)
        addLogEntry(app.name, args, 'apps')
        _onevent.call(appSocket, packet)
      }
    })
  })
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
  $('#logs').find('tr:gt(1000)').remove()

  // if (setting[category]) {
  //   $('.' + category).show()
  // } else {
  //   $('.' + category).hide()
  // }
}

String.prototype.capitalizeFirstLetter = function () {
  return this.charAt(0).toUpperCase() + this.slice(1)
}
