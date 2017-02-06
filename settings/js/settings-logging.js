/* global tree, Homey, $ */
var apps = {}
var devices = {}
var insights = {}
var heard = {}
var pause = false
var sockets = {}
const allwaysOnNamespaces = ['manager:apps', 'manager:devices', 'app:gov.nsa.logger']

function addLogEntry (namespace, event, data, options) {
  if (!options) options = {}
  var parsed = logNamespaceEventDataParser(namespace, event, data, options)
  if (pause || parsed.ignore) return
  var html = '<tr class="logentry ' + namespace
  if (options.style) html += ' ' + options.style
  html += '"><td class="event small text-nowrap">' + formatLogDate(parsed.datetime) + '</td>'
  html += '<td class="event small">' + parsed.item + '</td>'
  html += '<td class="event small">' + parsed.event + '</td>'
  html += '<td class="data small text-muted">' + parsed.data + '</td></tr>'
  $('table#logs tbody tr:first').before(html)
  $('#logs').find('tr:gt(1000)').remove()

  var node
  if (node = tree.treeview(true).getUnselected().filter(node =>
    (node.namespace === namespace || node.namespace === [namespace, event].join(':')))[0]) {
    $('[data-nodeid=' + node.nodeId + ']').css('background-color', '#f0ad4e')
    if (node.parentId) $('[data-nodeid=' + node.parentId + ']').css('background-color', '#f0ad4e')
    setTimeout(function () {
      $('[data-nodeid=' + node.nodeId + ']').css('background-color', 'white')
      if (node.parentId) $('[data-nodeid=' + node.parentId + ']').css('background-color', 'white')
    }, 200)
  }
}

function initLogging () {
  playLogging()
  allwaysOnNamespaces.forEach(namespace => socketConnect(namespace, true))
}

function checkNamespaceAdded (namespace) {
  setTimeout(buildSettingsTree, 5000)
}

function checkNamespaceRemoved (namespace) {
  socketDisconnect(namespace)
  buildSettingsTree()
}

function clearLogging () {
  $('#logs').find('tr:gt(1)').remove()
}

function formatLogDate (time) {
  return time.toLocaleDateString() + ' ' + time.toLocaleTimeString() + '.' + ('000' + time.getMilliseconds()).slice(-3)
}

function getDeviceNameById (searchId) {
  return devices[searchId] ? devices[searchId].name : searchId
}

function getDeviceNameByZwaveNodeId (nodeId) {
  var result = null
  Object.keys(devices).forEach(deviceId => {
    if (devices[deviceId].zwNodeId === nodeId) result = devices[deviceId].name
  })
  return result
}

function getAppNameById (searchId) {
  return apps[searchId] ? apps[searchId].name : searchId
}

function handleSocketConnect () { addLogEntry(this.namespace, 'Connected', 'Logger is listening', {style: 'success'}) }
function handleSocketDisconnect () { addLogEntry(this.namespace, 'Disconnected', 'Logger is no longer listening', {style: 'warning'}) }
function handleSocketError (error) { addLogEntry(this.namespace, 'Not connected', error, {style: 'danger'}) }
function handleSocketEvent (packet) {
  if (!heard[this.namespace]) heard[this.namespace] = {}
  if (!heard[this.namespace][packet.data[0]]) heard[this.namespace][packet.data[0]] = 0
  heard[this.namespace][packet.data[0]] ++
  addLogEntry(this.namespace, packet.data[0], packet.data[1])
}
function handleSocketMessage (data) { addLogEntry(this.namespace, 'Message', data, {style: 'danger'}) }

function logNamespaceEventDataParser (namespace, event, data, options) {
  var parsed = {
    namespace: namespace,
    type: namespace.split(':')[0].capitalizeFirstLetter(),
    item: namespace.split(':')[1].capitalizeFirstLetter(),
    event: event.capitalizeFirstLetter(),
    data: (!data ? '' : typeof (data) === 'string' ? data : JSON.stringify(data)),
    datetime: options.datetime || new Date(),
    ignore: sockets[namespace].ignore || false
  }
  if (sockets[namespace].options &&
    sockets[namespace].options.length > 0 &&
    sockets[namespace].options.indexOf(event.toLowerCase()) === -1) {
    parsed.ignore = true
  }
  if (parsed.type === 'App') parsed.item = getAppNameById(namespace.split(':')[1])
  if (parsed.type === 'App' && parsed.data === 'Invalid namespace') parsed.data = 'This app does not support realtime logging'
  if (parsed.type === 'Device') parsed.item = getDeviceNameById(namespace.split(':')[1])
  if (parsed.item === 'Devices' || parsed.item === 'Apps') parsed.item += ' manager'
  if (parsed.item === 'Devices manager') parsed.data = getDeviceNameById(data.device_id)

  switch (parsed.item + ':' + parsed.event) {
    case 'Apps manager:Ready':
      if (data === 'gov.nsa.logger') return window.parent.location.reload()
      checkNamespaceAdded('app:' + data)
      break
    case 'Apps manager:Disable':
      checkNamespaceRemoved('app:' + data)
      break
    case 'Apps manager:Uninstall':
      checkNamespaceRemoved('app:' + data)
      break
    case 'Devices manager:Add':
      checkNamespaceAdded('device:' + data)
      break
    case 'Devices manager:Delete':
      checkNamespaceRemoved('device:' + data)
      break
    case 'Devices manager:Offline':
      checkNamespaceRemoved('device:' + data)
      break
    case 'Devices manager:Online':
      checkNamespaceAdded('device:' + data)
      break
    case 'Flow:Token-value':
      if (data.uri.split(':')[1] === 'device') data.device = getDeviceNameById(data.uri.split(':')[2])
      parsed.data = JSON.stringify(data)
      break
    case 'Homey Logger:Performance':
      updatePerformance(data)
      break
    case 'Insights:Log.entry':
      if (data.uri.split(':')[1] === 'device') data.device = getDeviceNameById(data.uri.split(':')[2])
      parsed.data = JSON.stringify(data)
      break
    case 'Zwave:Log':
      if (typeof (data) !== 'string') {
        data.forEach(logLine => {
          addLogEntry(namespace, event, logLine.log, {datetime: new Date(logLine.date)})
        })
        parsed.ignore = true
      } else {
        // find device
        var match = data.match(/Node\[(.*?)\]/)
        var deviceName = (match) ? getDeviceNameByZwaveNodeId(match[1]) : null
        if (deviceName) {
          parsed.data = match[0] + ` (${deviceName})` + data.replace(match[0], '')
        } else {
          parsed.data = data
        }
      }
      break
  }
  return parsed
}

function pauseLogging () {
  $('#pauseLogging').attr('disabled', 'disabled')
  $('#playLogging').removeAttr('disabled')
  pause = true
}

function playLogging () {
  $('#playLogging').attr('disabled', 'disabled')
  $('#pauseLogging').removeAttr('disabled')
  pause = false
}

function popoutLogging () {
  var url = window.location.origin + '/app/gov.nsa.logger/settings/popout.html'
  BootstrapDialog.show({
    title: 'Pop out',
    message: `Homey does not allow pop-outs. Please copy this url and open it in a new browser tab manualy: <a href="${url}" target="_blank">${url}</a>`,
    cssClass: 'popout-dialog',
    buttons: [{
      label: 'Close',
      cssClass: 'btn-primary',
      action: function (dialog) {
        dialog.close()
      }
    }]
  })
}

function socketConnect (namespace, ignore) {
  splitOptionsFromNamespace(namespace, (namespace, option) => {
    if (sockets[namespace]) {
      if (option && sockets[namespace].options.indexOf(option) === -1) sockets[namespace].options.push(option.toLowerCase())
      if (sockets[namespace].disconnected) sockets[namespace].connect()
    } else {
      var socket = window.parent.Homey.realtime(namespace)
      socket.namespace = namespace
      socket.options = option ? [option.toLowerCase()] : []
      socket.on('connect', handleSocketConnect)
      socket.on('disconnect', handleSocketDisconnect)
      socket.on('error', handleSocketError)
      socket.on('message', handleSocketMessage)
      socket.onevent = handleSocketEvent
      sockets[namespace] = socket
    }
    sockets[namespace].ignore = !!ignore
  })
}

function socketDisconnect (namespace) {
  splitOptionsFromNamespace(namespace, (namespace, option) => {
    if (sockets[namespace]) {
      if (option && sockets[namespace].options.indexOf(option) !== -1) {
        sockets[namespace].options.splice(sockets[namespace].options.indexOf(option), 1)
        if (sockets[namespace].options.length > 0) return
      }
      if (allwaysOnNamespaces.indexOf(namespace) === -1 && sockets[namespace].connected) {
        sockets[namespace].disconnect()
      } else {
        sockets[namespace].ignore = true
      }
    }
  })
}

function splitOptionsFromNamespace (namespace, callback) {
  var option
  if (namespace.split(':')[2]) option = namespace.split(':')[2]
  namespace = namespace.split(':').splice(0, 2).join(':')
  callback(namespace, option)
}

String.prototype.capitalizeFirstLetter = function () {
  return this.charAt(0).toUpperCase() + this.slice(1)
}
