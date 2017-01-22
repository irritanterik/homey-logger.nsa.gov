/* global Homey */
exports.debugLog = function (event, details) {
  Homey.manager('api').realtime(event, details)
  Homey.log(this.epochToTimeFormatter(), event, details || '')
}

exports.errorLog = function (message, data) {
  var logLine = {}
  if (message) logLine.message = message
  if (data) logLine.data = data
  Homey.manager('api').realtime('error', logLine)
  Homey.error(this.epochToTimeFormatter(), 'error', message, data || '')
}

exports.epochToTimeFormatter = function (epoch) {
  return (new Date(epoch || new Date().getTime())).toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, '$1')
}
