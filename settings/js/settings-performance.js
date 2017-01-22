/* global Homey,$ */

var savePerformanceTimeoutObject = null
var sliderSystemInterval
var sliderInsightsInterval

function formatPerformanceSettings (event) {
  // show red part of insights logging active/inactive
  var insightsInterval = sliderInsightsInterval.slider('getValue')
  $('#slider-insights-interval .slider-rangeHighlight').css('background', (insightsInterval === 4) ? '#f70616' : '#f2dede')
}

function handlePerformanceSettingsChange () {
  var systemInterval = sliderSystemInterval.slider('getValue')
  var insightsInterval = sliderInsightsInterval.slider('getValue')

  if (insightsInterval === 4 && systemInterval < 2) systemInterval = 2
  if (insightsInterval === 3 && systemInterval < 1) systemInterval = 1
  if ((insightsInterval === 2 || insightsInterval === 1) && systemInterval === 0) systemInterval = 1
  sliderSystemInterval.slider('setValue', systemInterval)

  formatPerformanceSettings()
  if (savePerformanceTimeoutObject) clearTimeout(savePerformanceTimeoutObject)
  savePerformanceTimeoutObject = setTimeout(savePerformance, 5000)
}

function loadPerformanceSettings () {
  console.log('loadPerformanceSettings')
  Homey.get('performance', (error, settings) => {
    if (error) return console.error(error)
    sliderSystemInterval.slider('setValue', settings.systemInterval)
    sliderInsightsInterval.slider('setValue', settings.insightsInterval)
    $('#checkbox-insights-loadavg').prop('checked', settings.insightLogs.loadAvg)
    $('#checkbox-insights-freemem').prop('checked', settings.insightLogs.freeMem)
    $('#checkbox-insights-cpu-nice').prop('checked', settings.insightLogs.cpuNice)
    $('#checkbox-insights-cpu-sys').prop('checked', settings.insightLogs.cpuSys)
    $('#checkbox-insights-cpu-user').prop('checked', settings.insightLogs.cpuUser)
    formatPerformanceSettings()
  })
}

function loadToken () {
  Homey.get('apiToken', (error, token) => {
    if (token !== null) return $('#apiToken').val(token)
    // try candy
    window.parent.api('GET', '/manager/settings/app/info.matjaz.candy/apiToken', (error, token) => {
      if (!error) {
        $('#apiToken').val(token)
        return saveToken()
      }
      // try homeydash
      window.parent.api('GET', '/manager/settings/app/com.swttt.homeydash/config/', (error, dashsettings) => {
        if (!error) {
          $('#apiToken').val(dashsettings.bearertoken)
          return saveToken()
        }
      })
    })
  })
}

function initPerformance () {
  $('#checkbox-insights-loadavg').on('click', handlePerformanceSettingsChange)
  $('#checkbox-insights-freemem').on('click', handlePerformanceSettingsChange)
  $('#checkbox-insights-cpu-sys').on('click', handlePerformanceSettingsChange)
  $('#checkbox-insights-cpu-nice').on('click', handlePerformanceSettingsChange)
  $('#checkbox-insights-cpu-user').on('click', handlePerformanceSettingsChange)
  $('#apiToken').on('change', saveToken)
  $('#apiToken').on('paste', saveToken)
  sliderSystemInterval = $('#slider-system-interval').slider({
    id: 'slider-system-interval',
    ticks: [0, 1, 2, 3],
    ticks_positions: [0, 33, 66, 100],
    ticks_labels: ['Off', '5 minutes', '1 minute', '5 seconds'],
    ticks_snap_bounds: 20,
    tooltip: 'hide',
    value: 0
  })
  $(sliderSystemInterval).on('change', handlePerformanceSettingsChange)

  sliderInsightsInterval = $('#slider-insights-interval').slider({
    id: 'slider-insights-interval',
    ticks: [0, 1, 2, 3, 4],
    ticks_positions: [0, 25, 50, 75, 100],
    ticks_labels: ['Off', '60', '15', '5', '1'],
    ticks_snap_bounds: 20,
    tooltip: 'hide',
    rangeHighlights: [{start: 3, end: 4}],
    value: 0
  })
  $(sliderInsightsInterval).on('change', handlePerformanceSettingsChange)
  loadToken()
  loadPerformanceSettings()
  // setTimeout(loadPerformanceSettings(), 1000) // slider needs time
}

function savePerformance () {
  console.log('saving performance settings...')
  var settings = {
    systemInterval: sliderSystemInterval.slider('getValue'),
    insightsInterval: sliderInsightsInterval.slider('getValue'),
    insightLogs: {
      loadAvg: $('#checkbox-insights-loadavg').prop('checked'),
      freeMem: $('#checkbox-insights-freemem').prop('checked'),
      cpuNice: $('#checkbox-insights-cpu-nice').prop('checked'),
      cpuSys: $('#checkbox-insights-cpu-sys').prop('checked'),
      cpuUser: $('#checkbox-insights-cpu-user').prop('checked')
    }
  }
  Homey.set('performance', settings, function (error, settings) {
    if (error) return console.error('not saved!', error)
    console.log('performance settings saved')
  })
}

function saveToken() {
  Homey.set('apiToken', $('#apiToken').val())
}

function updatePerformance (data) {
  $('#value-loadavg').html(data.loadAvg)
  $('#value-freemem').html(data.freeMem)
  $('#value-cpu-nice').html(data.cpuNice)
  $('#value-cpu-sys').html(data.cpuSys)
  $('#value-cpu-user').html(data.cpuUser)
  $('#liveLastUpdate').html(formatLogDate(new Date()))
}
