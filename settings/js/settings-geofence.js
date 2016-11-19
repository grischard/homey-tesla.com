/* global $, Homey, __, google */

var map
var drawingManager
var newGeofenceName
var vehicles = {}
var vehicleMarkers = []
var geofences = {}
var geofenceOverlays = []
var homeyMarkers = []
var routes = []
var startMarkers = []
var endMarkers = []
var routeMarkers = []
var activeGeofenceId

function initGeofences () {
  createMap()
  loadHomeyLocation()
  loadGeofences()
  loadVehicles()
  subscribeVehicleUpdates()
  checkRoutes()
}

function checkRoutes () {
  Homey.get('teslaRoutes', function (error, result) {
    if (error) return console.error(error)
    if (!result) {
      $('#showRouteStartPoints').prop('disabled', true)
      $('#showRouteEndPoints').prop('disabled', true)
      $('#showRoutes').prop('disabled', true)
      showRouteStartPointsChange()
      showRouteEndPointsChange()
      showRoutesChange()
      return console.warn('No routes to load!')
    }
    routes = result
    $('#showRouteStartPoints').prop('disabled', false)
    $('#showRouteEndPoints').prop('disabled', false)
    $('#showRoutes').prop('disabled', false)
    $.each(routes, function (index, route) {
      console.log('routestart to display:', index, route.start)
      var startLocation = new google.maps.LatLng(route.start.lat, route.start.lng)
      var endLocation = new google.maps.LatLng(route.end.lat, route.end.lng)
      var startInfowindow = new google.maps.InfoWindow({
        content: '' + route.start.toString()
      })
      var endInfowindow = new google.maps.InfoWindow({
        content: '' + route.end.toString()
      })
      var startMarker = new google.maps.Marker({
        position: startLocation,
        map: null,
        draggable: false,
        icon: {
          path: 'M -5,0 0,-5 5,0 0,5 z',
          strokeColor: '#F00',
          fillColor: '#F00',
          fillOpacity: 1
        }
      })
      var routeMarker = new google.maps.Polyline({
        path: [startLocation, endLocation],
        icons: [{
          icon: {path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW},
          offset: '100%'
        }]
      })
      routeMarker.time = route.start.time
      var endMarker = new google.maps.Marker({
        position: endLocation,
        map: null,
        draggable: false,
        icon: {
          path: 'M -2,-2 2,2 M 2,-2 -2,2',
          strokeColor: '#292',
          strokeWeight: 4
        }
      })
      endMarker.time = route.start.time
      google.maps.event.addListener(startMarker, 'click', function () {
        startInfowindow.open(map, startMarker)
      })
      google.maps.event.addListener(endMarker, 'click', function () {
        endInfowindow.open(map, endMarker)
      })
      startMarkers.push(startMarker)
      endMarkers.push(endMarker)
      routeMarkers.push(routeMarker)
    })
  })
}

function showRouteStartPointsChange () {
  startMarkers.forEach(function (marker) {
    marker.setMap(($('#showRouteStartPoints').prop('checked') ? map : null))
  })
  // centerMap(startMarkers.concat(homeyMarkers))
}

function showRouteEndPointsChange () {
  endMarkers.forEach(function (marker) {
    marker.setMap(($('#showRouteEndPoints').prop('checked') ? map : null))
  })
  // centerMap(endMarkers.concat(homeyMarkers))
}

function showRoutesChange () {
  routeMarkers.forEach(function (marker) {
    marker.setMap(($('#showRoutes').prop('checked') ? map : null))
  })
}

function createMap () {
  var mapOptions = {
    zoom: 17,
    maxZoom: 20,
    mapTypeId: google.maps.MapTypeId.HYBRID,
    streetViewControl: false
  }
  map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions)

  google.maps.event.addListener(map, 'click', function () {
    deselectGeofences()
  })

  drawingManager = new google.maps.drawing.DrawingManager({
    drawingMode: null,
    drawingControl: false,
    drawingControlOptions: {
      position: google.maps.ControlPosition.TOP_CENTER,
      drawingModes: [
        google.maps.drawing.OverlayType.CIRCLE,
        google.maps.drawing.OverlayType.POLYGON,
        google.maps.drawing.OverlayType.RECTANGLE
      ]
    },
    polygonOptions: {
      disableDoubleClickZoom: true,
      editable: false,
      draggable: false,
      strokeColor: '#00FF00',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#00FF00',
      fillOpacity: 0.25
    },
    circleOptions: {
      disableDoubleClickZoom: true,
      editable: false,
      draggable: false,
      strokeColor: '#FF0000',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#FF0000',
      fillOpacity: 0.25
    },
    rectangleOptions: {
      disableDoubleClickZoom: true,
      editable: false,
      draggable: false,
      strokeColor: '#0000FF',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#0000FF',
      fillOpacity: 0.25
    }
  })
  google.maps.event.addListener(drawingManager, 'rectanglecomplete', function (rectangle) {
    drawingManager.setOptions({
      drawingMode: null,
      drawingControl: false
    })
    var newGeofenceId = new Date().getTime()
    rectangle.geofenceId = newGeofenceId
    geofenceOverlays.push(rectangle)
    var newGeofence = {
      version: 0,
      name: newGeofenceName,
      source: 'USER',
      type: 'RECTANGLE',
      rectangle: {},
      active: true,
      isHome: false
    }

    if (!geofences) geofences = {}
    geofences[newGeofenceId] = newGeofence
    activeGeofenceId = newGeofenceId
    saveGeofence(newGeofenceId)
    loadGeofences()
  })
  google.maps.event.addListener(drawingManager, 'circlecomplete', function (circle) {
    drawingManager.setOptions({
      drawingMode: null,
      drawingControl: false
    })
    // drawingManager.setMap(null)

    var newGeofenceId = new Date().getTime()
    console.log('circlecomplete', newGeofenceId)
    circle.geofenceId = newGeofenceId
    geofenceOverlays.push(circle)

    var newGeofence = {
      version: 0,
      name: newGeofenceName,
      source: 'USER',
      type: 'CIRCLE',
      circle: {},
      active: true,
      isHome: false
    }
    if (!geofences) geofences = {}
    geofences[newGeofenceId] = newGeofence
    activeGeofenceId = newGeofenceId
    saveGeofence(newGeofenceId)
    loadGeofences()
  })
  google.maps.event.addListener(drawingManager, 'polygoncomplete', function (polygon) {
    drawingManager.setOptions({
      drawingMode: null,
      drawingControl: false
    })
    var newGeofenceId = new Date().getTime()
    console.log('polygoncomplete', newGeofenceId)
    polygon.geofenceId = newGeofenceId
    geofenceOverlays.push(polygon)

    var newGeofence = {
      version: 0,
      name: newGeofenceName,
      source: 'USER',
      type: 'POLYGON',
      polygon: {},
      active: true,
      isHome: false
    }
    if (!geofences) geofences = {}
    geofences[newGeofenceId] = newGeofence
    activeGeofenceId = newGeofenceId
    saveGeofence(newGeofenceId)
    loadGeofences()
  })
  drawingManager.setMap(map)

  google.maps.Polygon.prototype.getBounds = function () {
    var bounds = new google.maps.LatLngBounds()
    this.getPath().forEach(function (element, index) { bounds.extend(element) })
    return bounds
  }
}

function getGeofenceOverlaysIndexById (geofenceId) {
  var geofenceIndex = null
  geofenceOverlays.forEach(function (geofence, index) {
    if (geofenceOverlays[index].geofenceId == geofenceId) { // eslint-disable-line
      geofenceIndex = index
    }
  })
  return geofenceIndex
}

function showGeofences () {
  google.maps.event.trigger(map, 'resize')
  centerMap(vehicleMarkers.concat(homeyMarkers))
}

function loadHomeyLocation () {
  Homey.api('GET', '/geofence/self', function (error, result) {
    if (error) return console.error(error)
    var icon = {
      url: 'images/homey.webp',
      scaledSize: new google.maps.Size(30, 30),
      anchor: new google.maps.Point(15, 15)
    }
    var marker = new google.maps.Marker({
      map: map,
      icon: icon,
      position: new google.maps.LatLng(result.latitude, result.longitude),
      draggable: false
    })
    homeyMarkers.push(marker)
  })
}

function loadGeofences () {
  Homey.get('geofences', function (error, result) {
    if (error) return console.error(error)
    if (geofenceOverlays) {
      for (var i = 0; i < geofenceOverlays.length; i++) {
        geofenceOverlays[i].setMap(null)
      }
      geofenceOverlays.length = 0
    }
    if (!result) return console.warn('No geofences to load!')
    geofences = result
    $('#geofences').find('option').remove()
    $.each(geofences, function (geofenceId, geofence) {
      $('#geofences').append('<option value=' + geofenceId + '>' + geofence.name + ' (' +
      __('settings.geofences.geofencesourcetype.' + geofence.source.toUpperCase()) + ')</option>')
      if (geofence.type === 'CIRCLE') {
        var circle = new google.maps.Circle({
          geofenceId: geofenceId,
          disableDoubleClickZoom: true,
          editable: false,
          draggable: false,
          map: map,
          center: new google.maps.LatLng(geofence.circle.center.lat, geofence.circle.center.lng),
          strokeColor: '#FF0000',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#FF0000',
          fillOpacity: 0.25,
          radius: geofence.circle.radius
        })
        geofenceOverlays.push(circle)
        google.maps.event.addListener(circle, 'radius_changed', function () {
          saveGeofence(circle.geofenceId)
        })
        google.maps.event.addListener(circle, 'center_changed', function () {
          saveGeofence(circle.geofenceId)
        })
        google.maps.event.addListener(circle, 'click', function () {
          selectGeofence(circle.geofenceId)
        })
        google.maps.event.addListener(circle, 'dblclick', function (event) {
          selectGeofence(circle.geofenceId)
          renameGeofence(circle.geofenceId)
          event.stop()
        })
      } // end if circle
      if (geofence.type === 'POLYGON') {
        var polygon = new google.maps.Polygon({
          geofenceId: geofenceId,
          isDragging: false,
          disableDoubleClickZoom: true,
          editable: false,
          draggable: false,
          map: map,
          paths: geofence.polygon.path,
          strokeColor: '#00FF00',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#00FF00',
          fillOpacity: 0.25
        })
        geofenceOverlays.push(polygon)
        // TODO: Add events on edit and drag
        google.maps.event.addListener(polygon, 'rightclick', function (mev) {
          console.log('rightclick')
          if (mev.vertex != null && polygon.getPath().getLength() > 3) {
            this.getPath().removeAt(mev.vertex)
          }
          saveGeofence(polygon.geofenceId)
        })
        google.maps.event.addListener(polygon.getPath(), 'set_at', function () {
          console.log('set_at')
          if (!polygon.isDragging) saveGeofence(polygon.geofenceId)
        })
        google.maps.event.addListener(polygon.getPath(), 'insert_at', function () {
          console.log('insert_at')
          saveGeofence(polygon.geofenceId)
        })
        google.maps.event.addListener(polygon.getPath(), 'remove_at', function () {
          console.log('remove_at')
          saveGeofence(polygon.geofenceId)
        })
        google.maps.event.addListener(polygon, 'dragstart', function () {
          console.log('dragstart')
          polygon.isDragging = true
        })
        google.maps.event.addListener(polygon, 'dragend', function () {
          console.log('dragend')
          polygon.isDragging = false
          saveGeofence(polygon.geofenceId)
        })
        google.maps.event.addListener(polygon, 'click', function () {
          selectGeofence(polygon.geofenceId)
        })
        google.maps.event.addListener(polygon, 'dblclick', function (event) {
          selectGeofence(polygon.geofenceId)
          renameGeofence(polygon.geofenceId)
          event.stop()
        })
      } // end if polygon
      if (geofence.type === 'RECTANGLE') {
        var rectangle = new google.maps.Rectangle({
          geofenceId: geofenceId,
          isDragging: false,
          disableDoubleClickZoom: true,
          editable: false,
          draggable: false,
          map: map,
          bounds: {
            north: geofence.rectangle.path[0].lat,
            south: geofence.rectangle.path[2].lat,
            east: geofence.rectangle.path[0].lng,
            west: geofence.rectangle.path[2].lng
          },
          strokeColor: '#0000FF',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#0000FF',
          fillOpacity: 0.25
        })
        geofenceOverlays.push(rectangle)
        google.maps.event.addListener(rectangle, 'bounds_changed', function () {
          console.log('bounds_changed')
          if (!rectangle.isDragging) saveGeofence(rectangle.geofenceId)
        })
        google.maps.event.addListener(rectangle, 'dragstart', function () {
          console.log('dragstart')
          rectangle.isDragging = true
        })
        google.maps.event.addListener(rectangle, 'dragend', function () {
          console.log('dragend')
          rectangle.isDragging = false
          saveGeofence(rectangle.geofenceId)
        })
        google.maps.event.addListener(rectangle, 'click', function () {
          selectGeofence(rectangle.geofenceId)
        })
        google.maps.event.addListener(rectangle, 'dblclick', function (event) {
          selectGeofence(rectangle.geofenceId)
          renameGeofence(rectangle.geofenceId)
          event.stop()
        })
      } // end if rectangle
    })
    if (geofences) {
      if (!activeGeofenceId) {
        $('#geofences').val(geofenceOverlays[0].geofenceId)
      } else {
        $('#geofences').val(activeGeofenceId)
      }
    }
  })
}

function geofenceNameExists (checkName) {
  var result = false
  $.each(geofences, function (index, geofence) {
    if (geofence.name.toString().toUpperCase() === checkName.toString().toUpperCase()) {
      result = index
      return
    }
  })
  return result
}

function renameGeofence (geofenceId) {
  var newName = window.prompt(__('settings.geofences.labelNameGeofence'), geofences[geofenceId].name)
  if (!newName) return
  var renameCheck = geofenceNameExists(newName)
  if (renameCheck && renameCheck !== geofenceId) {
    window.alert(__('settings.geofences.errorGeofenceNameUnique'))
    return renameGeofence(geofenceId)
  }
  geofences[geofenceId].name = newName
  var listText = geofences[geofenceId].name + ' (' + __('settings.geofences.geofencesourcetype.' + geofences[geofenceId].source.toUpperCase()) + ')'
  $('#geofences option:selected').text(listText)
  saveGeofence(geofenceId)
}

function deselectGeofences () {
  $.each(geofenceOverlays, function (index) {
    geofenceOverlays[index].setEditable(false)
    geofenceOverlays[index].setDraggable(false)
  })
  activeGeofenceId = null
}

function selectGeofence (geofenceId) {
  deselectGeofences(activeGeofenceId)
  activeGeofenceId = geofenceId
  $('#geofences').val(activeGeofenceId)
  var index = getGeofenceOverlaysIndexById(activeGeofenceId)
  geofenceOverlays[index].setEditable(true)
  if (geofences[geofenceId].type === 'POLYGON' ||
      geofences[geofenceId].type === 'RECTANGLE') {
    geofenceOverlays[index].setDraggable(true)
  }
}

function saveGeofence (geofenceId) {
  if (geofenceId) {
    var index = getGeofenceOverlaysIndexById(geofenceId)
    var path = []
    if (geofences[geofenceId].type === 'CIRCLE') {
      geofences[geofenceId].circle.center = {
        lat: geofenceOverlays[index].getCenter().lat(),
        lng: geofenceOverlays[index].getCenter().lng()
      }
      geofences[geofenceId].circle.radius = geofenceOverlays[index].getRadius()
    }
    if (geofences[geofenceId].type === 'POLYGON') {
      geofenceOverlays[index].getPath().getArray().forEach(function (point) {
        path.push({lat: point.lat(), lng: point.lng()})
      })
      geofences[geofenceId].polygon.path = path
    }
    if (geofences[geofenceId].type === 'RECTANGLE') {
      path.push({lat: geofenceOverlays[index].getBounds().getNorthEast().lat(), lng: geofenceOverlays[index].getBounds().getNorthEast().lng()})
      path.push({lat: geofenceOverlays[index].getBounds().getNorthEast().lat(), lng: geofenceOverlays[index].getBounds().getSouthWest().lng()})
      path.push({lat: geofenceOverlays[index].getBounds().getSouthWest().lat(), lng: geofenceOverlays[index].getBounds().getSouthWest().lng()})
      path.push({lat: geofenceOverlays[index].getBounds().getSouthWest().lat(), lng: geofenceOverlays[index].getBounds().getNorthEast().lng()})
      geofences[geofenceId].rectangle.path = path
    }
  }
  Homey.set('geofences', geofences)
}

function centerMap (markersCollection) {
  var latlngbounds = new google.maps.LatLngBounds()
  for (var i = 0; i < markersCollection.length; i++) {
    latlngbounds.extend(markersCollection[i].position)
  }
  map.setCenter(latlngbounds.getCenter())
  map.fitBounds(latlngbounds)
}

function deleteGeofence () {
  deselectGeofences()
  delete geofences[$('#geofences').val()]
  if ($.isEmptyObject(geofences)) geofences = null
  saveGeofence()
  loadGeofences()
}

function addGeofence () {
  newGeofenceName = window.prompt(__('settings.geofences.labelNameGeofence'), __('settings.geofences.newGeofenceName'))
  if (!newGeofenceName) return
  if (geofenceNameExists(newGeofenceName)) {
    window.alert(__('settings.geofences.errorGeofenceNameUnique'))
    return addGeofence()
  }
  drawingManager.setOptions({
    drawingMode: null,
    drawingControl: true
  })
}

function changeGeofenceList () {
  deselectGeofences()
  var geofenceId = $('#geofences').val()
  var index = getGeofenceOverlaysIndexById(geofenceId)
  map.setCenter(geofenceOverlays[index].getBounds().getCenter())
}

function editGeofence () {
  if ($('#geofences').val()) selectGeofence($('#geofences').val())
}

function showVehiclesChange () {
  if ($('#showVehicles').prop('checked')) {
    showVehicles()
  } else {
    hideVehicles()
  }
}

function showVehicles () {
  vehicleMarkers.forEach(function (marker) {
    marker.setMap(map)
    if (vehicles[marker.vehicleId].moving) {
      marker.setAnimation(google.maps.Animation.BOUNCE)
    }
  })
  centerMap(vehicleMarkers.concat(homeyMarkers))
}

function hideVehicles () {
  vehicleMarkers.forEach(function (marker) {
    marker.setMap(null)
  })
}

function loadVehicles () {
  vehicleMarkers = []
  Homey.api('GET', '/vehicles', function (error, result) {
    if (error) return console.error(error)
    vehicles = result
    $.each(vehicles, function (vehicleId) {
      if (vehicles[vehicleId].location.lat) {
        var vehicleLocation = new google.maps.LatLng(vehicles[vehicleId].location.lat, vehicles[vehicleId].location.lng)
        var vehicleMarker = new google.maps.Marker({
          position: vehicleLocation,
          map: null,
          draggable: false
        })
        vehicleMarker.vehicleId = vehicles[vehicleId].trackerId
        vehicleMarker.infowindow = new google.maps.InfoWindow({
          content: vehicleInfoWindow(vehicleId, vehicles[vehicleId].location)
        })
        google.maps.event.addListener(vehicleMarker, 'click', function () {
          vehicleMarker.infowindow.open(map, vehicleMarker)
        })
        vehicleMarkers.push(vehicleMarker)
      }
    })
    showVehicles()
  })
}

function vehicleInfoWindow (vehicleId, location) {
  return `<strong>${vehicles[vehicleId].name}</strong><br>${location.city} - ${location.place}`
}

function subscribeVehicleUpdates () {
  Homey.on('teslaLocation', function (data) {
    console.log('Vehicle: new location ', data)
    $.each(vehicleMarkers, function (index) {
      if (vehicleMarkers[index].vehicleId === data.trackerId) {
        vehicleMarkers[index].setPosition(new google.maps.LatLng(data.location.lat, data.location.lng))
        vehicleMarkers[index].infowindow.setContent(vehicleInfoWindow(index, data.location))
        if (data.moving) {
          vehicleMarkers[index].setAnimation(google.maps.Animation.BOUNCE)
        } else {
          if (vehicleMarkers[index].getAnimation() !== null) {
            vehicleMarkers[index].setAnimation(null)
          }
        }
      }
    })
  })
}
