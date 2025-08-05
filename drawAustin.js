var element = document.getElementById('osm-map');
element.style = 'height:600px;';

var map = L.map(element);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

var target = L.latLng('30.266666', '-97.733330');
map.setView(target, 10);

let districtsLayer = null;
let districtsData = null; 
let districtsVisible = false;
let newDistrictsLayer = false; 

let polygonDrawer = null;
let drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

let austinLayer = null;
let initialAustinLayer = null;

// Fix the initial Austin district loading
fetch('gis-data/cities/austin/district-37.geojson')
    .then(response => response.json())
    .then(data => {
        initialAustinLayer = L.geoJSON(data, {
            style: {
                color: '#50607A',
                weight: 2,
                opacity: 0.8,
                fillOpacity: 0.3
            },
            onEachFeature: function (feature, layer) {
                // Add popup text
                layer.bindPopup('Current District 37');
                
                // Or add a permanent label
                const bounds = layer.getBounds();
                const center = bounds.getCenter();
                L.marker(center, {
                    icon: L.divIcon({
                        className: 'district-label',
                        html: '<div style="background: transparent; padding: 2px 5px; border-radius: 3px; font-size: 14px; font-weight: bold; color: #2A2F3E";>Current district</div>',
                        iconSize: [60, 20],
                        iconAnchor: [0, 60]
                    })
                }).addTo(map);
            }
        }).addTo(map);
    })
    .catch(error => console.error('Error loading Austin district GeoJSON:', error));
    //     }).addTo(map);
    // })
    // .catch(error => console.error('Error loading Austin district GeoJSON:', error));


map.on('click', function () {
    if (!polygonDrawer) {
        polygonDrawer = new L.Draw.Polygon(map, {
            shapeOptions: {
                color: '#FFE657',
                weight: 2,
                opacity: 0.8,
                fillOpacity: 0.3,
                
            },
            allowIntersection: false,
            drawError: {
                color: '#e1e100',
                message: '<strong>Error:</strong> shape edges cannot cross!'
            }
        });

        polygonDrawer.enable();
    }
});

map.on(L.Draw.Event.CREATED, function (event) {
    var layer = event.layer;
    drawnItems.addLayer(layer);
    layer.bindPopup('Polygon drawn!');
    
    polygonDrawer = null;
});

map.on(L.Draw.Event.DRAWSTOP, function () {
    polygonDrawer = null;
});

function clearMap() {
    drawnItems.clearLayers();
    
    if (districtsLayer) {
        map.removeLayer(districtsLayer);
        districtsLayer = null;
        districtsVisible = false;
    }
    
    if (austinLayer) {
        map.removeLayer(austinLayer);
        austinLayer = null;
    }
    
    if (initialAustinLayer) {
        map.removeLayer(initialAustinLayer);
        initialAustinLayer = null;
    }
    
    if (polygonDrawer) {
        polygonDrawer.disable();
        polygonDrawer = null;
    }
    
    document.getElementById('results').textContent = '';
}

function calculateOverlapPercentage(drawnPolygon, districtFeature) {
    try {
        const polygon1 = drawnPolygon.geometry ? drawnPolygon : drawnPolygon;
        const polygon2 = districtFeature.geometry ? districtFeature : districtFeature;
        
        const bounds1 = getBounds(polygon1);
        const bounds2 = getBounds(polygon2);
        
        const overlapArea = getOverlapArea(bounds1, bounds2);
        const polygon1Area = getArea(bounds1);
        
        if (polygon1Area === 0) return 0;
        
        return (overlapArea / polygon1Area) * 100;
        
    } catch (error) {
        console.error('Error calculating overlap:', error);
        return 0;
    }
}

function getBounds(polygon) {
    const coords = polygon.geometry ? polygon.geometry.coordinates[0] : polygon.coordinates[0];
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    coords.forEach(coord => {
        const [lng, lat] = coord;
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
    });
    
    return { minLat, maxLat, minLng, maxLng };
}

function getOverlapArea(bounds1, bounds2) {
    const overlapMinLat = Math.max(bounds1.minLat, bounds2.minLat);
    const overlapMaxLat = Math.min(bounds1.maxLat, bounds2.maxLat);
    const overlapMinLng = Math.max(bounds1.minLng, bounds2.minLng);
    const overlapMaxLng = Math.min(bounds1.maxLng, bounds2.maxLng);
    
    if (overlapMinLat >= overlapMaxLat || overlapMinLng >= overlapMaxLng) {
        return 0; 
    }
    
    return (overlapMaxLat - overlapMinLat) * (overlapMaxLng - overlapMinLng);
}

function getArea(bounds) {
    return (bounds.maxLat - bounds.minLat) * (bounds.maxLng - bounds.minLng);
}

function checkUserDrawing() {
    if (drawnItems.getLayers().length === 0) {
        alert('Please draw a polygon first!');
        return;
    }
    if (!districtsData) {
        fetch('gis-data/PLANC2308/PLANC2308.json')
            .then(response => response.json())
            .then(data => {
                districtsData = data;
                showDistrictsAndCheck(); 
            })
    } else {
        showDistrictsAndCheck(); 
    }
}


function showDistrictsAndCheck() {
    if (!districtsVisible) {
        districtsLayer = L.geoJSON(districtsData, {
            style: function (feature) {
                return {
                    color: '#E1372D',
                    weight: 2,
                    opacity: 0.5,
                    fillOpacity: 0
                };
            },
            onEachFeature: function (feature, layer) {
                if (feature.properties && feature.properties.District) {
                    layer.bindPopup(`District ${feature.properties.District}`);
                }
            }
        }).addTo(map);
    
        fetch('gis-data/cities/austin/proposed-37.json')
            .then(response => response.json())
            .then(data => {
                austinLayer = L.geoJSON(data, {
                    style: {
                        color: '#E1372D',
                        weight: 2,
                        opacity: 0.3,
                        fillOpacity: 0.3
                    },
            onEachFeature: function (feature, layer) {
                // Add popup text
                layer.bindPopup('Proposed');
                
                // Or add a permanent label
                const bounds = layer.getBounds();
                const center = bounds.getCenter();
                L.marker(center, {
                    icon: L.divIcon({
                        className: 'district-label',
                        html:
                        '<div style="background: transparent; padding: 2px 5px; border-radius: 3px; font-size: 14px; color: #E1372D; font-weight: bold;">Proposed District</div>',
                        iconSize: [60, 20],
                        iconAnchor: [-10, 60]
                    })
                }).addTo(map);
            }
        }).addTo(map);
    })
            .catch(error => console.error('Error loading proposed Austin district:', error));
        
        districtsVisible = true; 
    }
    
    document.getElementById('results').textContent = `The map's newly proposed GOP seat in Central Texas also triggers the prospect of Austin Democratic Reps. Casar and Lloyd Doggett facing each other in a primary for the area's lone remaining blue district.`;
}


document.getElementById('clearMap').addEventListener('click', clearMap);

document.getElementById('checkAnswer').addEventListener('click', checkUserDrawing);
