export function weatherDay (from, to, didok_id) {
  return `
PREFIX  xsd:  <http://www.w3.org/2001/XMLSchema#>
PREFIX  mm:   <http://rdf.meteomatics.com/mm/>
PREFIX  mm-parameters: <http://rdf.meteomatics.com/mm/parameters/>

SELECT  ?station_name ?t_2m ?precip_1h ?fresh_snow_1h ?relative_humidity_2m ?weather_symbol ?date
WHERE
  { BIND("${from}"^^xsd:dateTime AS ?from)
    BIND("${to}"^^xsd:dateTime AS ?to)
    BIND(${didok_id} AS ?didok_id)
    ?station  mm:didok_id           ?didok_id ;
              mm:station_name       ?station_name .
    ?sub      mm:location           ?station ;
              mm:validdate          ?date ;
              mm-parameters:t_2m:C  ?t_2m ;
              mm-parameters:precip_1h:mm  ?precip_1h ;
              mm-parameters:fresh_snow_1h:cm  ?fresh_snow_1h ;
              mm-parameters:relative_humidity_2m:p  ?relative_humidity_2m ;
              mm-parameters:weather_symbol_1h:idx  ?weather_symbol_1h .
    ?weather_symbol_1h <http://www.w3.org/2004/02/skos/core#notation> ?weather_symbol .
    FILTER ( ?date >= ?from )
    FILTER ( ?date < ?to )
  }
ORDER BY ASC(?date)
`
}

export function weatherForecast (from, to, didok_id) {
  return `
#Note: Query does aggregate days by UTC and not properly split the day by Timezone.
PREFIX  mm:   <http://rdf.meteomatics.com/mm/>
PREFIX  xsd:  <http://www.w3.org/2001/XMLSchema#>
PREFIX  mm-parameters: <http://rdf.meteomatics.com/mm/parameters/>

SELECT  ?day (MIN(?t_2m) AS ?t_2m_min) (MAX(?t_2m) AS ?t_2m_max) (MIN(?date) AS ?date_min) (MAX(?date) AS ?date_max) (GROUP_CONCAT(?weather_symbol) AS ?weather_symbols)
WHERE
  { BIND("${from}"^^xsd:dateTime AS ?from)
    BIND("${to}"^^xsd:dateTime AS ?to)
    BIND(${didok_id} AS ?didok_id)
    ?station  mm:didok_id           ?didok_id ;
              mm:station_name       ?station_name .
    ?sub      mm:location           ?station ;
              mm:validdate          ?date ;
              mm-parameters:t_2m:C  ?t_2m ;
              mm-parameters:weather_symbol_1h:idx  ?weather_symbol_1h .
    ?weather_symbol_1h
              <http://www.w3.org/2004/02/skos/core#notation>  ?weather_symbol
    FILTER ( ?date >= ?from )
    FILTER ( ?date < ?to )
  }
GROUP BY (day(?date) AS ?day)
ORDER BY ASC(?date_min)
`
}

export function weatherLabels (locale) {
  return `
PREFIX  mm:   <http://rdf.meteomatics.com/mm/>
PREFIX  xsd:  <http://www.w3.org/2001/XMLSchema#>
PREFIX  dcterms: <http://purl.org/dc/terms/>

SELECT  ?label ?title ?description ?unit
WHERE
  { BIND("${locale}" AS ?locale)
    ?param  a                     mm:Parameter ;
            <http://www.w3.org/2000/01/rdf-schema#label>  ?label ;
            dcterms:title         ?title ;
            mm:unit_symbol        ?unit
    FILTER ( lang(?title) = ?locale )
    OPTIONAL
      { ?param  dcterms:description  ?description
        FILTER ( lang(?description) = ?locale )
      }
  }
`
}

export default {weatherDay, weatherForecast, weatherLabels}
