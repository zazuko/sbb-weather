import './app.css'

import moment from 'moment'
import 'moment/locale/de'
import 'moment/locale/fr'
import 'moment/locale/it'
import numeral from 'numeral'
import * as d3 from 'd3'
import {queue} from 'd3-queue'
import {sparql} from 'd3-sparql'
import queryString from 'query-string'

import queries from './queries'

/* global location */
export function render (didok, dateTime, locale, options) {
  options = {} || options
  var endpoint = options.endpoint || '/query'

  var parameters = queryString.parse(location.search)

  locale = locale || parameters.locale || window.navigator.userLanguage || window.navigator.language
  moment.locale(locale)

  dateTime = moment(dateTime || parameters.dateTime)
  var date = moment(dateTime).set({h: 0, m: 0, s: 0, ms: 0}).locale('en')

  didok = parseInt(didok) || parameters.didok || 8504136

  // query labels, use "en" if locale not in the available languages
  var queryLabels = queries.weatherLabels(['en', 'de', 'fr', 'it'].includes(locale.substring(0, 2)) ? locale.substring(0, 2) : 'en')
  var label = {}

  // query day
  var queryDay = queries.weatherDay(date.utc().format(), date.add(1, 'day').utc().format(), didok)

  // query forecast
  var queryForecast = queries.weatherForecast(date.startOf('isoweek').utc().format(), date.startOf('isoweek').add(3 * 7, 'days').utc().format(), didok)

  // widget global settings
  var width = 575
  var height = 820
  var marginTop = 45
  var marginLeft = 25

  var chartWidth = 525

  queue()
  .defer(sparql, endpoint, queryLabels)
  .defer(sparql, endpoint, queryDay)
  .defer(sparql, endpoint, queryForecast)
  .await(function (error, labels, data, data2) {
    if (error) { console.log(error) }
    // create labels
    for (var key of labels) {
      label[key.label] = key
    }

    // get current entry (last entry already in past)
    var current = data[data.map(x => moment(x.date).isSameOrBefore(moment(dateTime)), data).lastIndexOf(true)]
    data.current = current

    // adding svg element to body and apply settings
    var container = d3.select('#diagram').append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', 'translate(' + marginLeft + ',' + marginTop + ')')

    addButtons(data, container, 0)

    setCurrentWeatherInformation(current, container)
    setCurrentWeatherTemperatureGraph(data, container)
    addWeekdays(data2, container)
  })

  function addButtons (data, container, activeIndex) {
    var buttonHeight = 50
    var buttonTop = 190
    var buttonLeft = 2
    var buttonSpace = 5
    var buttonWidth = 170

    function buttonClickEvent (d, i) {
      addButtons(data, container, i)
      switch (i) {
        case 0:
          setCurrentWeatherTemperatureGraph(data, container)
          break
        case 1:
          setCurrentWeatherPrecipitationGraph(data, container)
          break
        case 2:
          setCurrentWeatherHumidityGraph(data, container)
          break
      }
    }

    container.selectAll('g.graph').remove()
    container.selectAll('g#buttons').remove()

    var buttonContainer = container.append('g').attr('id', 'buttons')
//    buttonContainer.style('opacity', 0.0).transition().style('opacity', 1.0)

    // add buttons background and text
    var buttons = buttonContainer.selectAll('g.button')
      .data(['t_2m:C', 'precip_1h:mm', 'relative_humidity_2m:p'])
      .enter()
      .append('g')
      .attr('class', function (d, i) {
        if (i === activeIndex) {
          return 'button active'
        }
        return 'button'
      })
    buttons.append('rect')
      .attr('width', buttonWidth)
      .attr('height', buttonHeight)
      .attr('y', buttonTop)
      .attr('x', function (d, i) {
        return i * (buttonWidth + buttonSpace) + buttonLeft
      })
      .on('click', buttonClickEvent)
      .append('svg:title')
      .text(function (d) {
        return label[d].description
      })
    buttons.append('text')
      .text(function (d) {
        return label[d].title
      })
      .attr('y', buttonTop + buttonHeight / 2 + 4)
      .attr('x', function (d, i) {
        return i * (buttonWidth + buttonSpace) + buttonLeft + buttonWidth / 2
      })
      .on('click', buttonClickEvent)
      .append('svg:title')
      .text(function (d) {
        return label[d].description
      })
  }

  function mapWeatherToIconContent (weatherSymbol) {
    switch (Number(weatherSymbol)) {
      case 0:
        return 'G'
      case 1:
        return 'C'
      case 101:
        return 'h'
      case 2:
      case 3:
        return 'g'
      case 102:
      case 103:
        return 'b'
      case 4:
      case 104:
        return 'a'
      case 5:
      case 105:
        return 'l'
      case 6:
      case 106:
        return 'u'
      case 7:
      case 107:
        return 'o'
      case 8:
        return 'n'
      case 108:
        return 'D'
      case 9:
        return 'z'
      case 109:
        return 'y'
      case 10:
        return 'w'
      case 110:
        return 'v'
      case 11:
      case 111:
        return 'j'
      case 12:
      case 112:
        return 'd'
      case 14:
      case 114:
        return 'e'
      case 15:
      case 115:
        return 'k'
      default:
        return ''
    }
  }

  function setCurrentWeatherPrecipitationGraph (data, container) {
    var chartHeight = 60
    var chartPosition = 300

    var current = data.current

    // only get hours
    data = data.filter(o => moment(o.date).minutes() === 0).slice(1)

    var rectsWidth = Math.floor(chartWidth / data.length)

    // remove current visualization if already available
    container.selectAll('g#precipitationgraph').remove()
    container = container.append('g').attr('id', 'precipitationgraph').attr('class', 'graph')
    container.style('opacity', 0.0).transition().style('opacity', 1.0)

    // linechart scales
    var precipAccessor = function (d) {
      return d.precip_1h
    }

    var xScale = d3.scaleTime().range([0, chartWidth])
      .domain([
        moment(data[0].date),
        moment(moment(data[data.length-1].date))
      ])
    var yScale = d3.scaleLinear().range([0, chartHeight])
      .domain([
        d3.min(data, precipAccessor),
        d3.max(data, precipAccessor)
      ])

    // linechart axis
    var lookUpTable = data.map(function (d) {
      return moment(d.date)
    })
    var xAxisTime = d3.axisBottom()
      .scale(xScale)
      .ticks(d3.timeHour, 3)
      .tickSizeOuter(0)
      .tickFormat(function (d) {
        var index = 0
        for (index = 0; index < data.length; index++) {
          if (moment(d).isSame(lookUpTable[index])) {
            break
          }
        }
        if (index < data.length) {
          return moment(d).format('HH:mm')
        }
        return ''
      })
    var xAxisPrecipitation = d3.axisTop()
      .scale(xScale)
      .ticks(d3.timeHour, 3)
      .tickSizeOuter(0)
      .tickFormat(function (d) {
        var index = 0
        var precipProbability = data[index].precip_1h
        for (index = 0; index < data.length; index++) {
          if (moment(d).isSame(lookUpTable[index])) {
            precipProbability = data[index].precip_1h
            break
          }
        }
        if (index < data.length) {
          return numeral(precipProbability).format('0.0') + 'mm/h'
        }
        return ''
      })

    // chart with rects
    var lines = container.selectAll('line')
      .data(data)
      .enter()

    lines.append('line')
     .attr('class', 'top')
     .attr('x1', 0)
     .attr('y1', 0)
     .attr('x2', rectsWidth)
     .attr('y2', 0)
     .attr('transform', function (d) {
       var x = xScale(moment(d.date)) - (xScale(moment(d.date)) / 18)
       var y = (-yScale(d.precip_1h) + chartHeight + chartPosition)
       return 'translate(' + x + ', ' + y + ')'
     })

    // chart with rects
    var rects = container.selectAll('rect')
      .data(data)
      .enter()

    rects.append('rect')
      .attr('width', rectsWidth)
      .attr('height', function (d) {
        return (yScale(d.precip_1h))
      })
      .attr('class', 'stroke')
      .attr('transform', function (d) {
        var x = xScale(moment(d.date)) - (xScale(moment(d.date)) / 18)
        var y = (-yScale(d.precip_1h) + chartHeight + chartPosition)
        return 'translate(' + x + ', ' + y + ')'
      })

    // draw axis
    container.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + (chartPosition + 10 + chartHeight) + ')')
      .call(xAxisTime)
      .selectAll('text')
      .style('text-anchor', 'start')
    container.append('g')
      .attr('class', 'x axis precipitation')
      .attr('transform', 'translate(0,' + (chartPosition) + ')')
      .call(xAxisPrecipitation)
      .selectAll('text')
      .style('text-anchor', 'start')
    container.append('line')
      .attr('class', 'x axis currentMarker')
      .attr('x1', xScale(moment(current.date)))
      .attr('y1', chartHeight)
      .attr('x2', xScale(moment(current.date)))
      .attr('y2', 0)
      .attr('transform', 'translate(0,' + chartPosition + ')')
  }

  function setCurrentWeatherHumidityGraph (data, container) {
    var chartHeight = 60
    var chartPosition = 300

    // remove current visualization if already available
    container.selectAll('g#humiditygraph').remove()
    container = container.append('g').attr('id', 'humiditygraph').attr('class', 'graph')
    container.style('opacity', 0.0).transition().style('opacity', 1.0)

    // linechart scales
    var humidityAccessor = function (d) {
      return d.relative_humidity_2m
    }

    var xScale = d3.scaleTime().range([0, chartWidth])
      .domain([
        moment(data[0].date),
        moment(data[data.length - 1].date)
      ])
    var yScale = d3.scaleLinear().range([0, chartHeight])
      .domain([
        d3.max(data, humidityAccessor),
        0 // d3.min(data, humidityAccessor)
      ])

    // linechart axis
    var lookUpTable = data.map(function (d) {
      return moment(d.date)
    })

    var xAxisTime = d3.axisBottom()
      .scale(xScale)
      .ticks(d3.timeHour, 3)
      .tickSizeOuter(0)
      .tickFormat(function (d) {
        var index = 0
        for (index = 0; index < data.length; index++) {
          if (moment(d).isSame(lookUpTable[index])) {
            break
          }
        }
        if (index < data.length - 1) {
          return moment(d).format('HH:mm')
        }
        return ''
      })

    var xAxisHumidity = d3.axisTop()
      .scale(xScale)
      .ticks(d3.timeHour, 3)
      .tickSizeOuter(0)
      .tickFormat(function (d) {
        var index = 0
        var humidity = data[index].relative_humidity_2m
        for (index = 0; index < data.length; index++) {
          if (moment(d).isSame(lookUpTable[index])) {
            humidity = data[index].relative_humidity_2m
            break
          }
        }
        if (index < data.length) {
          return numeral(humidity).format('0') + ' %'
        }
        return ''
      })

    // chart with line and background area
    var line = d3.line().curve(d3.curveMonotoneX)
      .x(function (d) {
        return xScale(moment(d.date))
      })
      .y(function (d) {
        return yScale(d.relative_humidity_2m)
      })
    var area = d3.area().curve(d3.curveMonotoneX)
      .x(function (d) {
        return xScale(moment(d.date))
      })
      .y0(chartHeight)
      .y1(function (d) {
        return yScale(d.relative_humidity_2m)
      })

    // draw both
    container.append('path')
      .datum(data)
      .attr('class', 'area')
      .attr('d', area)
      .attr('transform', 'translate(0,' + chartPosition + ')')
    container.append('path')
      .datum(data)
      .attr('class', 'line')
      .attr('d', line)
      .attr('transform', 'translate(0,' + chartPosition + ')')

    // draw axis
    container.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + (chartPosition + 10 + chartHeight) + ')')
      .call(xAxisTime)
      .selectAll('text')
      .style('text-anchor', 'start')
    container.append('g')
      .attr('class', 'x axis humidity')
      .attr('transform', 'translate(0,' + (chartPosition) + ')')
      .call(xAxisHumidity)
      .selectAll('text')
      .style('text-anchor', 'start')
    container.append('line')
      .attr('class', 'x axis currentMarker')
      .attr('x1', xScale(moment(data.current.date)))
      .attr('y1', chartHeight)
      .attr('x2', xScale(moment(data.current.date)))
      .attr('y2', 0)
      .attr('transform', 'translate(0,' + chartPosition + ')')
  }

  function setCurrentWeatherWindGraph (data, container) {
    var chartHeight = 60
    var chartPosition = 300

    // remove current visualization if already available
    container.selectAll('g#windgraph').remove()
    container = container.append('g').attr('id', 'windgraph').attr('class', 'graph')
    container.style('opacity', 0.0).transition().style('opacity', 1.0)

    // linechart scales
    var windAccessor = function (d) {
      return d.windSpeed
    }

    var xScale = d3.scaleTime().range([0, chartWidth])
      .domain([
        moment.tz(data.hourly.data[0].time * 1000, data.timezone),
        moment.tz(data.hourly.data[23].time * 1000, data.timezone)
      ])
    var yScale = d3.scaleLinear().range([0, 3])
      .domain([
        d3.min(data.hourly.data.slice(0, 24), windAccessor),
        d3.max(data.hourly.data.slice(0, 24), windAccessor)
      ])

    // linechart axis
    var lookUpTable = data.hourly.data.slice(0, 24).map(function (d) {
      return moment.tz(d.time * 1000, data.timezone)
    })
    var xAxisTime = d3.axisBottom()
      .scale(xScale)
      .ticks(d3.timeHour, 3)
      .tickSizeOuter(0)
      .tickFormat(function (d) {
        var index = 0
        for (index = 0; index < 24; index++) {
          if (moment(d).isSame(lookUpTable[index])) {
            break
          }
        }
        if (index < 23) {
          return moment.tz(d, data.timezone).format('HH:mm')
        }
        return ''
      })
    var xAxisWind = d3.axisTop()
      .scale(xScale)
      .ticks(d3.timeHour, 3)
      .tickSizeOuter(0)
      .tickFormat(function (d) {
        var index = 0
        var windSpeed = data.hourly.data[index].windSpeed
        for (index = 0; index < 24; index++) {
          if (moment(d).isSame(lookUpTable[index])) {
            windSpeed = data.hourly.data[index].windSpeed
            break
          }
        }
        if (index < 23) {
          return numeral(windSpeed).format('0') + ' km/h'
        }
        return ''
      })

    // chart with arrows
    var arrows = container.selectAll('text.arrow')
      .data(data.hourly.data.slice(0, 24).filter(function (d, i) {
        return ((i + 1) % 3) === 0 && (i < 23)
      }))
      .enter()
    arrows.append('text')
      .attr('class', 'arrow')
      .text('\uf058')
      .attr('style', function (d) {
        var em = 1.0
        em = em + yScale(d.windSpeed)
        return 'font-size: ' + em + 'em'
      })
      .attr('transform', function (d) {
        var x = xScale(moment.tz(d.time * 1000, data.timezone)) + 25
        var y = chartPosition + 40
        return 'translate(' + x + ', ' + y + ') rotate(' + d.windBearing + ')'
      })

    // draw axis
    container.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + (chartPosition + 10 + chartHeight) + ')')
      .call(xAxisTime)
      .selectAll('text')
      .style('text-anchor', 'start')
    container.append('g')
      .attr('class', 'x axis wind')
      .attr('transform', 'translate(0,' + (chartPosition) + ')')
      .call(xAxisWind)
      .selectAll('text')
      .style('text-anchor', 'start')
  }

  function setCurrentWeatherTemperatureGraph (data, container) {
    var chartHeight = 60
    var chartPosition = 300

    // remove current visualization if already available
    container.selectAll('g#temperaturegraph').remove()
    container = container.append('g').attr('id', 'temperaturegraph').attr('class', 'graph')
    container.style('opacity', 0.0).transition().style('opacity', 1.0)

    // linechart scales
    var temperatureAccessor = function (d) {
      return d.t_2m
    }

    var xScale = d3.scaleTime().range([0, chartWidth])
      .domain([
        moment(data[0].date),
        moment(data[data.length - 1].date)
      ])
    var yScale = d3.scaleLinear().range([0, chartHeight])
      .domain([
        d3.max(data, temperatureAccessor),
        d3.min(data, temperatureAccessor) - 3
      ])

    // linechart axis
    var lookUpTable = data.map(function (d) {
      return moment(d.date)
    })

    var xAxisTime = d3.axisBottom()
      .scale(xScale)
      .ticks(d3.timeHour, 3)
      .tickSizeOuter(0)
      .tickFormat(function (d) {
        var index = 0
        for (index = 0; index < data.length; index++) {
          if (moment(d).isSame(lookUpTable[index])) {
            break
          }
        }
        if (index < data.length - 1) {
          return moment(d).format('HH:mm')
        }
        return ''
      })

    var xAxisTemperature = d3.axisTop()
      .scale(xScale)
      .ticks(d3.timeHour, 3)
      .tickSizeOuter(0)
      .tickFormat(function (d) {
        var index = 0
        var temperature = data[index].t_2m
        for (index = 0; index < data.length; index++) {
          if (moment(d).isSame(lookUpTable[index])) {
            temperature = data[index].t_2m
            break
          }
        }
        if (index < data.length) {
          return numeral(temperature).format('0') + '\u00B0'
        }
        return ''
      })

    // chart with line and background area
    var line = d3.line().curve(d3.curveMonotoneX)
      .x(function (d) {
        return xScale(moment(d.date))
      })
      .y(function (d) {
        return yScale(d.t_2m)
      })
    var area = d3.area().curve(d3.curveMonotoneX)
      .x(function (d) {
        return xScale(moment(d.date))
      })
      .y0(chartHeight)
      .y1(function (d) {
        return yScale(d.t_2m)
      })

    // draw both
    container.append('path')
      .datum(data)
      .attr('class', 'area')
      .attr('d', area)
      .attr('transform', 'translate(0,' + chartPosition + ')')
    container.append('path')
      .datum(data)
      .attr('class', 'line')
      .attr('d', line)
      .attr('transform', 'translate(0,' + chartPosition + ')')

    // draw axis
    container.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + (chartPosition + 10 + chartHeight) + ')')
      .call(xAxisTime)
      .selectAll('text')
      .style('text-anchor', 'start')
    container.append('g')
      .attr('class', 'x axis temperature')
      .attr('transform', 'translate(0,' + (chartPosition) + ')')
      .call(xAxisTemperature)
      .selectAll('text')
      .style('text-anchor', 'start')
    container.append('line')
      .attr('class', 'x axis currentMarker')
      .attr('x1', xScale(moment(data.current.date)))
      .attr('y1', chartHeight)
      .attr('x2', xScale(moment(data.current.date)))
      .attr('y2', 0)
      .attr('transform', 'translate(0,' + chartPosition + ')')
  }

  function addWeekdays (data, container) {
    function selectWeatherSymbol (weatherSymbols) {
      var symbols = weatherSymbols.split(' ').map(symbol => Number(symbol))//.filter(symbol => symbol < 100)
      return symbols[Math.floor(symbols.length / 2)]
    }

    // remove current visualization if already available
    container.selectAll('g#weekdays').remove()
    container = container.append('g').attr('id', 'weekdays')
    container.style('opacity', 0.0).transition().style('opacity', 1.0)

    var dayPosition = 420
    var dayPositionRow = 115
    var dayWidth = 75

    // days
    var day = container.selectAll('g')
      .data(data)
      .enter()
      .append('a')
      .attr('xlink:href', function (day) {
        return '?dateTime=' + moment(day.date_min).set({h: 12, m: 0, s: 0, ms: 0}).utc().format() +
               '&didok=' + didok +
                (parameters.locale ? '&locale=' + parameters.locale : '')
      })
      .append('g')

    // highlight
    day.append('rect')
      .attr('class', 'dayRect')
      .attr('x', function (day, index) {
        return (index % 7) * dayWidth
      })
      .attr('y', function (day, index) {
        return dayPosition + Math.floor(index / 7) * dayPositionRow
      })
      .attr('width', dayWidth)
      .attr('height', 100)

    // day name
    day.append('text')
      .text(function (day) {
        return moment(day.date_min).format('dd, D. MMM')
      })
      .attr('class', 'dayName')
      .attr('y', function (day, index) {
        return dayPosition + Math.floor(index / 7) * dayPositionRow + 20
      })
      .attr('x', function (day, index) {
        return (index % 7) * dayWidth + 30
      })

    // day icon
    day.append('text')
      .text(function (day) {
        return mapWeatherToIconContent(selectWeatherSymbol(day.weather_symbols))
      })
      .attr('class', 'dayIcon')
      .attr('y', function (day, index) {
        return dayPosition + Math.floor(index / 7) * dayPositionRow + 80
      })
      .attr('x', function (day, index) {
        return (index % 7) * dayWidth + 30
      })

    // day temperatures
    var dayTemperatures = day.append('text')
      .attr('y', function (day, index) {
        return dayPosition + Math.floor(index / 7) * dayPositionRow + 90
      })
      .attr('class', 'dayTemperatures')
      .attr('x', function (day, index) {
        return (index % 7) * dayWidth + 30
      })
    dayTemperatures.append('tspan')
      .text(function (day) {
        return numeral(day.t_2m_max).format('0') + '\u00B0'
      })
      .attr('class', 'dayTemperatureMax')
    dayTemperatures.append('tspan')
      .text(function (day) {
        return numeral(day.t_2m_min).format('0') + '\u00B0'
      })
      .attr('dx', 10)
      .attr('class', 'dayTemperatureMin')
  }

  function setCurrentWeatherInformation (current, container) {
    var detailPosition = 120
    var row1 = 177
    // remove current visualization if already available
    container.selectAll('g#current').remove()
    container = container.append('g').attr('id', 'current')
//    container.style('opacity', 0.0).transition().style('opacity', 1.0)

    // title
    container.append('text')
      .attr('class', 'title')
      .attr('x', 0)
      .attr('y', 15)
      .text(current.station_name)

    // summary
    var summary = container.append('text')
      .attr('class', 'summary')
      .attr('x', 0)
      .attr('y', 55)
    summary.append('tspan')
      .attr('x', 0)
      .text(moment(current.date).format('LLLL'))

    // detail
    var detail = container.append('text')
      .attr('class', 'detail')
      .attr('x', row1)
      .attr('y', detailPosition)

    detail.append('tspan')
      .attr('x', row1)
      .text(label['precip_1h:mm'].title + ': ' + numeral(current.precip_1h).format('0') + ' ' + label['precip_1h:mm'].unit)
    detail.append('tspan')
      .attr('x', row1)
      .attr('dy', '1.4em')
      .text(label['relative_humidity_2m:p'].title + ': ' + numeral(current.relative_humidity_2m).format('0.0') + label['relative_humidity_2m:p'].unit)
    detail.append('tspan')
      .attr('x', row1)
      .attr('dy', '1.4em')
      .text(label['fresh_snow_1h:cm'].title + ': ' + numeral(current.fresh_snow_1h).format('0') + ' ' + label['fresh_snow_1h:cm'].unit)

/*    var details = detail.selectAll('tspan')
      .data(['precip_1h:mm'])
      .enter()
      .append('tspan')
      .attr('x', 352)
      .attr('dy', '1.4em')
      .text(function (d) {
        return label[d].title + ': ' + numeral(current[d.substr(0,d.indexOf(':'))].relative_humidity_2m).format('0.0') + ' ' + label[d].unit
       })
      .append('svg:title')
      .text(function (d) {
        return label[d].description
      })
*/

    // weather icon
    container.append('text')
      .attr('class', 'icon')
      .attr('x', 0)
      .attr('y', detailPosition + 45)
      .text(mapWeatherToIconContent(current.weather_symbol))

    // degree
    var degree = container.append('text')
      .attr('x', 80)
      .attr('y', detailPosition + 30)
    degree.append('tspan')
      .attr('class', 'degree')
      .text(numeral(current.t_2m).format('0'))
    degree.append('tspan')
      .attr('class', 'unit')
      .attr('dy', '-1.6em')
      .attr('dx', '0.5em')
      .text('C\u00B0')
  }
}
