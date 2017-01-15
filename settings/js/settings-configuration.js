/* global sockets, Homey, $, __ */

var tree

function initConfiguration () {
  function adjustNodeBasedOnChildren (node) {
    var parent = tree.treeview('getNode', node)

    if (parent !== tree) {
      var checked = parent.nodes.filter(child => child.state.checked).length
      if ((parent.nodes.length === checked) !== parent.state.checked) {
        tree.treeview(parent.state.checked ? 'uncheckNode' : 'checkNode', [parent.nodeId, { silent: true }])
      }
    }
  }

  function onNodeCheckToggle (node, checked) {
    var toggleSockets = null
    if (node.namespace) toggleSockets = [node.namespace]
    if (node.text === 'Devices') {
      toggleSockets = Object.keys(sockets).filter(namespace => namespace.split(':')[0] === 'device')
    }
    if (node.text === 'Apps') {
      toggleSockets = Object.keys(sockets).filter(namespace => namespace.split(':')[0] === 'app')
    }
    if (toggleSockets) toggleSockets.forEach(namespace => { checked ? socketConnect(namespace) : socketDisconnect(namespace) })
    if (node.nodes) node.nodes.forEach(child => { tree.treeview(checked ? 'checkNode' : 'uncheckNode', child.nodeId) })
    if (node.parentId) adjustNodeBasedOnChildren(node.parentId)
    saveConfigurationDelayer()
  }

  buildSettingsTree(structure => {
    tree = $('#treeview-checkable').treeview({
      data: structure,
      showIcon: false,
      showCheckbox: true,
      highlightSelected: false,
      levels: 1,
      onNodeChecked: function (event, node) { onNodeCheckToggle(node, true) },
      onNodeUnchecked: function (event, node) { onNodeCheckToggle(node, false) }
    })
    loadSettings()
  })

  // Check/uncheck all
  $('#input-check-node').on('keyup', function (e) {
    tree.treeview('search', [ $('#input-check-node').val(), { ignoreCase: true, exactMatch: false } ])
  })
  $('#btn-check-all').on('click', function (e) {
    tree.treeview('checkAll', { silent: false })
  })
  $('#btn-uncheck-all').on('click', function (e) {
    tree.treeview('uncheckAll', { silent: false })
  })
}

function loadSettings () {
  Homey.get('settings', function (error, settings) {
    if (error) return console.error(error)
    if (settings === null) return tree.treeview('checkAll', { silent: false })
    if (!settings.loggingpage) return tree.treeview('checkAll', { silent: false })
    settings.loggingpage.tree.forEach(namespace => {
      var node
      if ((node = tree.treeview(true).getEnabled().filter(node => node.namespace === namespace)[0])) {
        tree.treeview('checkNode', node.nodeId)
      }
    })
  })
}

var saveDelayerTimeoutObject = null
function saveConfigurationDelayer () {
  if (saveDelayerTimeoutObject) clearTimeout(saveDelayerTimeoutObject)
  saveDelayerTimeoutObject = setTimeout(saveConfiguration, 1500)
}

function saveConfiguration () {
  console.log('saving...')
  var settings = {
    loggingpage: {
      tree: tree.treeview('getChecked').filter(x => (!x.type && x.namespace)).map(x => x.namespace),
      allDevices: tree.treeview('getChecked').filter(x => (x.type === 'group' && x.text === 'Devices')).length > 0,
      allApps: tree.treeview('getChecked').filter(x => (x.type === 'group' && x.text === 'Apps')).length > 0
    }
  }
  Homey.set('settings', settings, function (error, settings) {
    if (error) return console.error('not saved!', error)
    console.log('saved')
  })
}

function buildAppTree (ready) {
  var structureApps = {text: 'Apps', type: 'group', nodes: []}
  window.parent.api('GET', '/manager/apps/app', (error, result) => {
    if (error) return ready(error)
    Object.keys(result).forEach(app => {
      apps.push({id: app, name: result[app].name.en, enabled: result[app].enabled})
      structureApps.nodes.push({
        text: result[app].name.en,
        namespace: 'app:' + app
      })
    })
    structureApps.nodes = structureApps.nodes.sort((a, b) => (a.text > b.text ? 1 : -1))
    return ready(null, structureApps)
  })
}

function formatDeviceLabel (device) {
  var name_t = device.name.replace(/\ /g, '').toLowerCase()
  var app_t = device.driver.owner_name ? device.driver.owner_name.replace(/\ /g, '').toLowerCase() : ''
  var driver_t = device.driver.metadata ? device.driver.metadata.name.en.replace(/\ /g, '').toLowerCase() : ''
  var label = device.name
  var details = ''
  if (app_t !== '' && app_t !== name_t) details = device.driver.owner_name
  if (driver_t !== '' && driver_t !== app_t) details += ' ' + device.driver.metadata.name.en
  if (details !== '') label += ' (' + (details.trim()) + ')'
  return label
}

function buildDeviceTree (ready) {
  var structureDevices = {text: 'Devices', type: 'group', nodes: []}
  window.parent.api('GET', '/manager/devices/device', (error, result) => {
    if (error) return ready(error)
    Object.keys(result).forEach(device => {
      devices.push({id: device, name: result[device].name, enabled: result[device].enabled})
      structureDevices.nodes.push({
        text: formatDeviceLabel(result[device]),
        namespace: 'device:' + device
      })
    })
    structureDevices.nodes = structureDevices.nodes.sort((a, b) => (a.text > b.text ? 1 : -1))
    return ready(null, structureDevices)
  })
}

function buildSettingsTree (ready) {
  var structure = managersTree
  buildAppTree(function (error, appTree) {
    if (error) return console.log('Something went wrong building the app tree')
    structure.push(appTree)
    buildDeviceTree(function (error, deviceTree) {
      if (error) return console.log('Something went wrong building the device tree')
      structure.push(deviceTree)
      ready(structure.sort((a, b) => (a.text > b.text ? 1 : -1)))
    })
  })
}

const managersTree = [{
  text: 'App manager',
  namespace: 'manager:apps'
}, {
  text: 'Device manager',
  namespace: 'manager:devices'
}, {
  text: 'Flow',
  namespace: 'manager:flow'
}, {
  text: 'Geolocation',
  namespace: 'manager:geolocation'
}, {
  text: 'Insights',
  namespace: 'manager:insights'
}, {
  text: 'Ledring',
  namespace: 'manager:ledring'
}, {
  text: 'Notifications',
  namespace: 'manager:notifications'
}, {
  text: 'Presence',
  namespace: 'manager:presence'
}, {
  text: 'Speech',
  type: 'group',
  nodes: [{
    text: 'Input',
    namespace: 'manager:speech-input'
  }, {
    text: 'Output',
    namespace: 'manager:speech-output'
  }]
}, {
  text: 'Wireless',
  type: 'group',
  nodes: [{
    text: 'Z-wave',
    namespace: 'manager:zwave'
  }]
}]
