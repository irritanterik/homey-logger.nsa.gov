/* global Homey */
'use strict'

var util = require('./lib/util.js')
var http = require('http.min')
// var socket = require('socket.io-client') // NOT YET

var tokens = {}
var systemPollIntervalObject
var systemPollIntervalActive = 0
var insightsStepCount = 0
var insightsStepsNeeded = 0
var insightLogKeys = []

const systemValues = {
  'loadAvg': {
    type: 'number',
    label: 'Load average',
    decimals: 4,
    systemDataPath: 'systemData.loadavg[0]'
  },
  'freeMem': {
    type: 'number',
    label: 'Free memory',
    units: '%',
    decimals: 4,
    systemDataPath: 'Math.round(systemData.freemem / systemData.totalmem * 10000) / 100'
  },
  'cpuUser': {
    type: 'number',
    label: 'CPU user',
    decimals: 4,
    systemDataPath: 'systemData.cpus[0].times.user'
  },
  'cpuNice': {
    type: 'number',
    label: 'CPU niceness',
    decimals: 4,
    systemDataPath: 'systemData.cpus[0].times.nice'
  },
  'cpuSys': {
    type: 'number',
    label: 'CPU system',
    decimals: 4,
    systemDataPath: 'systemData.cpus[0].times.sys'
  }
}

function calculateIntervals (systemIntervalSetting, insightsIntervalSetting) {
  var systemInterval = [0, 300, 60, 5][systemIntervalSetting]
  var insightsInterval = [0, 3600, 900, 300, 60][insightsIntervalSetting]
  if (insightsInterval > 0 && (systemInterval === 0 || systemInterval > insightsInterval)) systemInterval = insightsInterval
  return [systemInterval * 1000, (insightsInterval === 0) ? 0 : insightsInterval / systemInterval]
}

function callbackInsightsCreateEntry (error, success) {
  if (error) util.errorLog('createEntry', error)
}

function callbackTokenSetValue (error) {
  if (error) util.errorLog('setValue', error)
}

function createInsightLogs () {
  Object.keys(systemValues).forEach(value => {
    Homey.manager('insights').createLog(value, {
      label: { en: systemValues[value].label },
      type: systemValues[value].type,
      units: { en: systemValues[value].units ? systemValues[value].units : '' },
      decimals: systemValues[value].decimals,
      chart: 'stepLine'
    }, function callback (error, success) {
      if (error && error.message !== 'already_exists') util.errorLog('Creating insights log', error.message)
    })
  })
}

function createTokens () {
  Object.keys(systemValues).forEach(key => {
    Homey.manager('flow').registerToken(key, {type: systemValues[key].type, title: key}, (error, token) => {
      if (error) return util.errorLog('registerToken', error)
      tokens[key] = token
    })
  })
}

function doPoll (token) {
  var doInsights = false
  if (insightsStepsNeeded > 0) {
    insightsStepCount++
    if (insightsStepsNeeded === insightsStepCount) {
      insightsStepCount = 0
      doInsights = true
    }
  }
  getSystem(token).then(systemData => {
    var logLine = {}
    Object.keys(systemValues).forEach(key => {
      var value = eval(systemValues[key].systemDataPath)
      logLine[key] = value
      tokens[key].setValue(value, callbackTokenSetValue)
      if (doInsights && insightLogKeys.indexOf(key) !== -1) Homey.manager('insights').createEntry(key, value, new Date(), callbackInsightsCreateEntry)
    })
    util.debugLog('performance', logLine)
  }).catch(reason => {
    util.errorLog('performance poll failed', reason)
  })
}

function getSystem (token) {
  if (!token) return Promise.reject('no_token')
  var options = {
    uri: `http://127.0.0.1/api/manager/system/`,
    headers: {Authorization: `Bearer ${token}`},
    timeout: 3000
  }
  return http.json(options).then(response => { return response.result })
}

function initPolling () {
  util.debugLog('debug', 'Checking on backend performance polling')
  var settings = Homey.manager('settings').get('performance') || {}
  var token = Homey.manager('settings').get('apiToken')
  if (!token || token.length !== 40) return util.errorLog('No token or invalid token entered in settings')
  if (Object.keys(settings).length === 0) return setDefaultSettings()
  var intervals = calculateIntervals(settings.systemInterval, settings.insightsInterval)
  insightLogKeys = Object.keys(settings.insightLogs).filter(key => settings.insightLogs[key])
  if (intervals[0] === systemPollIntervalActive) return util.debugLog('debug', 'Performance polling interval not changed')
  if (systemPollIntervalObject) {
    clearInterval(systemPollIntervalObject)
    systemPollIntervalObject = null
  }
  systemPollIntervalActive = intervals[0]
  if (systemPollIntervalActive === 0) return util.debugLog('debug', 'Performance logging disabled in settings')
  util.debugLog('debug', 'Performance polling initiated with interval ' + systemPollIntervalActive)
  insightsStepsNeeded = intervals[1]
  insightsStepCount = 0
  systemPollIntervalObject = setInterval(() => doPoll(token), systemPollIntervalActive)
  doPoll(token)
}

function initSettings () {
  Homey.manager('settings').on('set', (setting) => {
    switch (setting) {
      case 'settings':
        // front end realtime settings changed
        break
      case 'performance':
        initPolling()
        break
      case 'apiToken':
        initPolling()
        break
    }
  })
}

function setDefaultSettings () {
  util.debugLog('debug', 'Activate default settings for performance logging')
  var settings = {
    systemInterval: 2,
    insightsInterval: 1,
    insightLogs: {
      loadAvg: true,
      freeMem: true,
      cpuNice: false,
      cpuSys: false,
      cpuUser: false
    }
  }
  Homey.manager('settings').set('performance', settings)
}

module.exports = {
  init: function () {
    util.debugLog('debug', 'Logger started')
    createTokens()
    createInsightLogs()
    initPolling()
    initSettings()
  }
}
