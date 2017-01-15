/* global $ */

var devices = []
var apps = []
var pause = false
var sockets = {}

function initLogging () {
  playLogging()
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

function clearLogging () {
  $('#logs').find('tr:gt(1)').remove()
}

function getDeviceNameById (searchId) {
  return devices.filter(x => x.id === searchId)[0].name
}

function getAppNameById (searchId) {
  return apps.filter(x => x.id === searchId)[0].name
}

function splitOptionsFromNamespace (namespace, callback) {
  var option
  if (namespace.split(':')[2]) option = namespace.split(':')[2]
  namespace = namespace.split(':').splice(0, 2).join(':')
  callback(namespace, option)
}

function socketConnect (namespace) {
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
  })
}

function socketDisconnect (namespace) {
  splitOptionsFromNamespace(namespace, (namespace, option) => {
    if (sockets[namespace]) {
      if (option && sockets[namespace].options.indexOf(option) !== -1) {
        sockets[namespace].options.splice(sockets[namespace].options.indexOf(option), 1)
        if (sockets[namespace].options.length === 0) return
      }
      if (sockets[namespace].connected) sockets[namespace].disconnect()
    }
  })
}

var heard = {}
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

function formatLogDate (time) {
  return time.toLocaleDateString() + ' ' + time.toLocaleTimeString() + '.' + ('000' + time.getMilliseconds()).slice(-3)
}

function addLogEntry (namespace, event, data, optionalStyle) {
  if (namespace.split(':')[1].capitalizeFirstLetter() === 'Apps' && event.capitalizeFirstLetter() === 'Ready' && data === 'gov.nsa.logger') return window.parent.location.reload()
  if (pause) return
  if (!data) data = ''
  var component = 'Other'
  if (namespace.split(':')[0] === 'manager') component = namespace.split(':')[1].capitalizeFirstLetter() + ' Manager'
  if (namespace.split(':')[0] === 'device') component = 'Device ' + getDeviceNameById(namespace.split(':')[1])
  if (namespace.split(':')[0] === 'app') component = 'App ' + getAppNameById(namespace.split(':')[1])
  var html = '<tr class="logentry ' + namespace
  if (optionalStyle) html += ' ' + optionalStyle
  html += '"><td class="datetime small text-nowrap">' + formatLogDate(new Date()) + '</td>'
  html += '<td class="event small">' + component + '</td>'
  html += '<td class="event small">' + event.capitalizeFirstLetter() + '</td>'
  html += '<td class="data small text-muted">' + (!data ? '' : typeof (data) === 'string' ? data : JSON.stringify(data)) + '</td></tr>'
  $('table#logs tbody tr:first').before(html)
  $('#logs').find('tr:gt(1000)').remove()

  var node
  if ((node = tree.treeview(true).getEnabled().filter(node => node.namespace === namespace)[0])) {
    $('[data-nodeid=' + node.nodeId + ']').css('background-color', '#f0ad4e')
    if (node.parentId) $('[data-nodeid=' + node.parentId + ']').css('background-color', '#f0ad4e')
    setTimeout(function () {
      $('[data-nodeid=' + node.nodeId + ']').css('background-color', 'white')
      if (node.parentId) $('[data-nodeid=' + node.parentId + ']').css('background-color', 'white')
    }, 200)
  }
}

String.prototype.capitalizeFirstLetter = function () {
  return this.charAt(0).toUpperCase() + this.slice(1)
}
