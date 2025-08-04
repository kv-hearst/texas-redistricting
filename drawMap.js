const texasBounds = [
    [25.8371, -106.6456], // Southwest corner
    [36.5007, -93.5080]   // Northeast corner
];

var element = document.getElementById('osm-map');
element.style = 'height:600px;';

var map = L.map(element);

L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

var target = L.latLng('31.169621', '-99.683617');
map.setView(target, 6);
map.fitBounds(texasBounds);

let districtsLayer = null;
let districtsData = null; 
let districtsVisible = false;

let polygonDrawer = null;
let drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Load Texas outline
fetch('gis-data/outline.geojson')
    .then(response => response.json())
    .then(data => {
        L.geoJSON(data, {
            style: {
                color: '#ff7800',
                weight: 2,
                opacity: 0.8,
                fillOpacity: 0.1
            }
        }).addTo(map);
    })
    .catch(error => console.error('Error loading Texas outline GeoJSON:', error));

map.on('click', function () {
    if (!polygonDrawer) {
        polygonDrawer = new L.Draw.Polygon(map, {
            shapeOptions: {
                color: '#97009c',
                weight: 2,
                opacity: 0.8,
                fillOpacity: 0.3
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
        fetch('gis-data/TX-C21_4Dist.geojson')
            .then(response => response.json())
            .then(data => {
                districtsData = data;
                showDistrictsAndCheck(); 
            })
            .catch(error => {
                console.error('Error loading GeoJSON for comparison:', error);
                alert('Error loading district data for comparison');
            });
    } else {
        showDistrictsAndCheck(); 
    }
}

function showDistrictsAndCheck() {
    if (!districtsVisible) {
        districtsLayer = L.geoJSON(districtsData, {
            style: function (feature) {
                return {
                    color: '#3388ff',
                    weight: 2,
                    opacity: 0.8,
                    fillOpacity: 0.2
                };
            },
            onEachFeature: function (feature, layer) {
                if (feature.properties && feature.properties.name) {
                    layer.bindPopup(feature.properties.name);
                }
            }
        }).addTo(map);
        
        districtsVisible = true;
    }
    
    performCheck();
}

function performCheck() {
    let correctMatches = 0;
    let totalDrawn = drawnItems.getLayers().length;
    
    drawnItems.eachLayer(function(drawnLayer) {
        let foundMatch = false;
        let bestMatch = { percentage: 0, district: null };
        
        districtsData.features.forEach(function(districtFeature) {
            let overlapPercentage = calculateOverlapPercentage(drawnLayer.toGeoJSON(), districtFeature);
            
            if (overlapPercentage > bestMatch.percentage) {
                bestMatch = { percentage: overlapPercentage, district: districtFeature };
            }

            if (overlapPercentage > 70) {
                foundMatch = true;
            }
        });
        
        if (foundMatch) {
            correctMatches++;
            drawnLayer.setStyle({
                color: '#00ff00', // Green for correct
                weight: 3
            });
            drawnLayer.bindPopup(`✅ Correct! ${bestMatch.percentage.toFixed(1)}% match with ${bestMatch.district.properties.name || 'District'}`);
        } else {
            drawnLayer.setStyle({
                color: '#ff0000', // Red for incorrect
                weight: 3
            });
            drawnLayer.bindPopup(`❌ Not quite right. Best match: ${bestMatch.percentage.toFixed(1)}% with ${bestMatch.district?.properties?.name || 'Unknown District'}`);
        }
    });
    
    let score = Math.round((correctMatches / totalDrawn) * 100);
    document.getElementById('results').textContent = `Score: ${correctMatches}/${totalDrawn} correct (${score}%)`;
}


// Event listeners
document.getElementById('clearMap').addEventListener('click', clearMap);

document.getElementById('checkAnswer').addEventListener('click', checkUserDrawing);