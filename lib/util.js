/* global Homey */
exports.debugLog = function (message, data) {
  var logLine = {datetime: new Date(), message: message}
  if (data) logLine.data = data

  Homey.manager('api').realtime('logger', logLine)
  Homey.log(this.epochToTimeFormatter(), message, data || '')
}

exports.epochToTimeFormatter = function (epoch) {
  if (epoch == null) epoch = new Date().getTime()
  return (new Date(epoch)).toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, '$1')
}
