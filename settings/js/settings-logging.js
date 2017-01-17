/* global $ */
var apps = {}
var devices = {}
var heard = {}
var pause = false
var sockets = {}
const allwaysOnNamespaces = ['manager:apps', 'manager:devices', 'app:gov.nsa.logger']

function addLogEntry (namespace, event, data, optionalStyle) {
  var parsed = logNamespaceEventDataParser(namespace, event, data)
  if (pause || parsed.ignore) return
  var html = '<tr class="logentry ' + namespace
  if (optionalStyle) html += ' ' + optionalStyle
  html += '"><td class="datetime small text-nowrap">' + formatLogDate(new Date()) + '</td>'
  html += '<td class="event small">' + parsed.item + '</td>'
  html += '<td class="event small">' + parsed.event + '</td>'
  html += '<td class="data small text-muted">' + parsed.data + '</td></tr>'
  $('table#logs tbody tr:first').before(html)
  $('#logs').find('tr:gt(1000)').remove()

  var node
  if ((node = tree.treeview(true).getUnselected().filter(node => node.namespace === namespace)[0])) {
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

function getAppNameById (searchId) {
  return apps[searchId] ? apps[searchId].name : searchId
}

function handleSocketConnect () { addLogEntry(this.namespace, 'Connected', 'Logger is listening', 'success') }
function handleSocketDisconnect () { addLogEntry(this.namespace, 'Disconnected', 'Logger is no longer listening', 'warning') }
function handleSocketError (error) { addLogEntry(this.namespace, 'Not connected', error, 'danger') }
function handleSocketEvent (packet) {
  if (!heard[this.namespace]) heard[this.namespace] = {}
  if (!heard[this.namespace][packet.data[0]]) heard[this.namespace][packet.data[0]] = 0
  heard[this.namespace][packet.data[0]] ++
  addLogEntry(this.namespace, packet.data[0], packet.data[1])
}
function handleSocketMessage (data) { addLogEntry(this.namespace, 'Message', data, 'danger') }

function logNamespaceEventDataParser (namespace, event, data) {
  var parsed = {
    namespace: namespace,
    type: namespace.split(':')[0].capitalizeFirstLetter(),
    item: namespace.split(':')[1].capitalizeFirstLetter(),
    event: event.capitalizeFirstLetter(),
    data: (!data ? '' : typeof (data) === 'string' ? data : JSON.stringify(data)),
    ignore: sockets[namespace].ignore
  }
  if (parsed.item === 'Devices' || parsed.item === 'Apps') parsed.item += ' manager'
  if (parsed.type === 'Device') parsed.item = getDeviceNameById(namespace.split(':')[1])
  if (parsed.type === 'App') parsed.item = getAppNameById(namespace.split(':')[1])
  if (parsed.type === 'App' && parsed.data === 'Invalid namespace') parsed.data = 'This app does not support realtime logging'

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
    case 'Devices manager:Available':
      parsed.data = getDeviceNameById(data.device_id)
      break
    case 'Flow:Token-value':
      if (data.uri.split(':')[1] === 'device') data.device = getDeviceNameById(data.uri.split(':')[2])
      parsed.data = JSON.stringify(data)
      break
    case 'Insights:Log.entry':
      if (data.uri.split(':')[1] === 'device') data.device = getDeviceNameById(data.uri.split(':')[2])
      parsed.data = JSON.stringify(data)
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
      if (option && sockets[namespace].options.indexOf(option) === -1) sockets[namespace].push(option)
      if (sockets[namespace].disconnected) sockets[namespace].connect()
    } else {
      var socket = window.parent.Homey.realtime(namespace)
      socket.namespace = namespace
      socket.options = option ? [option] : []
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
        if (sockets[namespace].options.length === 0) return
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
