/* global sockets, Homey, $, __ */

var tree
var darkSockets = []

function initConfiguration () {
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
  $('#checkbox-new-apps').on('click', function (e) {
    saveConfiguration()
  })
  $('#checkbox-new-devices').on('click', function (e) {
    saveConfiguration()
  })
  buildSettingsTree()
}

function adjustNodeBasedOnChildren (node) {
  var parent = tree.treeview('getNode', node)
  if (parent !== tree) {
    var checked = parent.nodes.filter(child => child.state.checked).length
    if ((parent.nodes.length === checked) !== parent.state.checked) {
      tree.treeview(parent.state.checked ? 'uncheckNode' : 'checkNode', [parent.nodeId, { silent: true }])
    }
    if (parent.parentId) adjustNodeBasedOnChildren(parent.parentId)
  }
}

function onNodeCheckToggle (node, checked) {
  if (node.namespace) checked ? socketConnect(node.namespace) : socketDisconnect(node.namespace)
  if (node.nodes) node.nodes.forEach(child => { tree.treeview(checked ? 'checkNode' : 'uncheckNode', [child.nodeId, { silent: false }]) })
  if (node.parentId) adjustNodeBasedOnChildren(node.parentId)
  saveConfigurationDelayer()
}

function buildSettingsTree () {
  buildSettingsTreeStructure(structure => {
    var firstTime = !tree
    var existingNodes = firstTime ? [] : tree.treeview(true).getUnselected().map(node => ({hash: node.namespace || node.type + ':' + node.text, parentId: node.parentId, state: node.state, tags: node.tags}))
    tree = $('#treeview-checkable').treeview({
      data: structure,
      highlightSelected: false,
      levels: 1,
      showCheckbox: true,
      showIcon: false,
      showTags: true,
      onNodeChecked: function (event, node) { onNodeCheckToggle(node, true) },
      onNodeUnchecked: function (event, node) { onNodeCheckToggle(node, false) }
    })
    if (firstTime) {
      loadSettings()
    } else {
      var listenNew = {
        app: $('#checkbox-new-apps').prop('checked'),
        device: $('#checkbox-new-devices').prop('checked')
      }
      var newNodes = tree.treeview(true).getUnselected()
      // loop all nodes in new structure
      newNodes.forEach(node => {
        var nodeHash = node.namespace || node.type + ':' + node.text
        var existing = existingNodes.filter(i => i.hash === nodeHash)[0]
        if (existing) {
          if (existing.state.checked) tree.treeview('checkNode', [node.nodeId, { silent: (existing.tags.length <= node.tags.length) }])
          if (existing.state.expanded) tree.treeview('expandNode', [node.nodeId, { silent: true }])
        } else {
          if (listenNew[node.namespace.split(':')[0]]) tree.treeview('checkNode', [node.nodeId, { silent: false }])
          if (node.parentId) adjustNodeBasedOnChildren(node.parentId)
        }
      })
      // Find removed nodes and update parent
      existingNodes.forEach(oldNode => {
        if (oldNode.parentId &&
          newNodes.filter(i => (i.namespace || i.type + ':' + i.text) === oldNode.hash).length === 0) {
          adjustNodeBasedOnChildren(oldNode.parentId)
        }
      })
    }
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
    $('#checkbox-new-apps').prop('checked', (settings.loggingpage.newApps !== undefined) ? settings.loggingpage.newApps : true)
    $('#checkbox-new-devices').prop('checked', (settings.loggingpage.newDevices !== undefined) ? settings.loggingpage.newDevices : true)
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
      newApps: $('#checkbox-new-apps').prop('checked'),
      newDevices: $('#checkbox-new-devices').prop('checked')
    }
  }
  Homey.set('settings', settings, function (error, settings) {
    if (error) return console.error('not saved!', error)
    console.log('saved')
  })
}

function buildAppTree (ready) {
  var structureApps = {text: 'Apps', type: 'group', nodes: [], tags: []}
  window.parent.api('GET', '/manager/apps/app', (error, result) => {
    if (error) return ready(error)
    apps = {}
    Object.keys(result).forEach(app => {
      apps[app] = {id: app, name: result[app].name.en, enabled: result[app].enabled}
      structureApps.nodes.push({
        text: result[app].name.en,
        namespace: 'app:' + app,
        tags: (result[app].enabled) ? [] : ['disabled']
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
  var structureDevices = {text: 'Devices', type: 'group', nodes: [], tags: []}
  window.parent.api('GET', '/manager/devices/device', (error, result) => {
    if (error) return ready(error)
    devices = {}
    Object.keys(result).forEach(device => {
      devices[device] = {id: device, name: result[device].name, online: result[device].online}
      structureDevices.nodes.push({
        text: formatDeviceLabel(result[device]),
        namespace: 'device:' + device,
        tags: (result[device].online ? [] : ['offline'])
      })
    })
    structureDevices.nodes = structureDevices.nodes.sort((a, b) => (a.text > b.text ? 1 : -1))
    return ready(null, structureDevices)
  })
}

function buildSettingsTreeStructure (ready) {
  var structure = []
  managersTree.forEach(i => { i.tags = []; structure.push(i) })
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
