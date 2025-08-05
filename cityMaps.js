// City configuration data
const cityConfig = {
    dallas: {
        mapId: 'dallas-map',
        coordinates: [32.7767, -96.7970],
        zoom: 10,
        district: '32',
        currentDistrictFile: 'gis-data/cities/dallas/district-32.geojson',
        proposedDistrictFile: 'gis-data/cities/dallas/proposed-32.json',
        resultsElementId: 'results_dallas',
        checkButtonId: 'checkAnswer_dallas',
        clearButtonId: 'clearMap_dallas',
        resultsText: `Also targeted are Democratic U.S. Reps. Julie Johnson of Farmers Branch — whose Dallas-anchored district would be reshaped to favor Republicans and Marc Veasey of Fort Worth, whose nearby district would remain solidly blue but drop all of Fort Worth — Veasey's hometown and political base.`
    },
    austin: {
        mapId: 'austin-map',
        coordinates: [30.266666, -97.733330],
        zoom: 10,
        district: '37',
        currentDistrictFile: 'gis-data/cities/austin/district-37.geojson',
        proposedDistrictFile: 'gis-data/cities/austin/proposed-37.json',
        resultsElementId: 'results_austin',
        checkButtonId: 'checkAnswer_austin',
        clearButtonId: 'clearMap_austin',
        resultsText: `The map's newly proposed GOP seat in Central Texas also triggers the prospect of Austin Democratic Reps. Casar and Lloyd Doggett facing each other in a primary for the area's lone remaining blue district.`
    },
    houston: {
        mapId: 'houston-map',
        coordinates: [29.7604, -95.3698],
        zoom: 10,
        district: '9',
        currentDistrictFile: 'gis-data/cities/houston/district-9.geojson',
        proposedDistrictFile: 'gis-data/cities/houston/proposed-9.json',
        resultsElementId: 'results_houston',
        checkButtonId: 'checkAnswer_houston',
        clearButtonId: 'clearMap_houston',
        resultsText: `Houston's District 9 redistricting proposal aims to reshape the political landscape in Harris County.`
    },
    sanantonio: {
        mapId: 'sanantonio-map',
        coordinates: [29.4241, -98.4936],
        zoom: 8,
        district: '35',
        currentDistrictFile: 'gis-data/cities/san-antonio/district-35.geojson',
        proposedDistrictFile: 'gis-data/cities/san-antonio/proposed-35.json',
        resultsElementId: 'results_sanantonio',
        checkButtonId: 'checkAnswer_sanantonio',
        clearButtonId: 'clearMap_sanantonio',
        resultsText: `San Antonio's District 35 faces significant boundary changes under the proposed redistricting plan.`
    },
    southtexas: {
        mapId: 'southtexas-map',
        coordinates: [27.7694, -98.2300],
        zoom: 7,
        district: '28',
        currentDistrictFile: 'gis-data/cities/san-antonio/district-28.geojson',
        proposedDistrictFile: 'gis-data/cities/san-antonio/proposed-28.json',
        resultsElementId: 'results_southtexas',
        checkButtonId: 'checkAnswer_southtexas',
        clearButtonId: 'clearMap_southtexas',
        resultsText: `The proposed changes to South Texas' District 28 aim to better reflect the region's demographics and political landscape.`
    }
};

// City map instances storage
const cityMaps = {};

// Reusable map creation function
function createCityMap(cityKey) {
    const config = cityConfig[cityKey];
    if (!config) {
        console.error(`City configuration not found for: ${cityKey}`);
        return null;
    }

    const element = document.getElementById(config.mapId);
    if (!element) {
        console.error(`Map element not found: ${config.mapId}`);
        return null;
    }

    // Initialize map
    element.style.height = '600px';
    const map = L.map(element);

    // Add tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // Set initial view
    const target = L.latLng(config.coordinates[0], config.coordinates[1]);
    map.setView(target, config.zoom);

    // Create city map instance
    const cityMapInstance = {
        map: map,
        config: config,
        districtsLayer: null,
        districtsData: null,
        districtsVisible: false,
        polygonDrawer: null,
        proposedLayer: null,
        initialLayer: null,
        drawnItems: new L.FeatureGroup(),
        initialMarkers: [], // Track initial district markers
        proposedMarkers: [] // Track proposed district markers
    };

    // Add drawn items layer
    map.addLayer(cityMapInstance.drawnItems);

    // Load initial district
    loadInitialDistrict(cityMapInstance);

    // Set up event listeners
    setupMapEventListeners(cityMapInstance);

    // Store instance
    cityMaps[cityKey] = cityMapInstance;

    return cityMapInstance;
}

// Load initial district for a city
function loadInitialDistrict(cityMapInstance) {
    const { config, map } = cityMapInstance;
    
    fetch(config.currentDistrictFile)
        .then(response => response.json())
        .then(data => {
            cityMapInstance.initialLayer = L.geoJSON(data, {
                style: {
                    color: '#50607A',
                    weight: 2,
                    opacity: 0.8,
                    fillOpacity: 0.3
                },
                onEachFeature: function (feature, layer) {
                    layer.bindPopup(`Current District ${config.district}`);
                }
            }).addTo(map);
            
            // Add label marker after the layer is added (one per layer, not per feature)
            const bounds = cityMapInstance.initialLayer.getBounds();
            const center = bounds.getCenter();
            const initialMarker = L.marker(center, {
                icon: L.divIcon({
                    className: 'district-label current-district',
                    html: `<div style="background: rgba(255,255,255,0.9); padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; color: #2A2F3E; border: 1px solid #50607A; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">Current District ${config.district}</div>`,
                    iconSize: [120, 30],
                    iconAnchor: [60, 15]
                }),
                zIndexOffset: 1000
            }).addTo(map);
            
            // Track the marker for cleanup
            cityMapInstance.initialMarkers.push(initialMarker);
        })
        .catch(error => console.error(`Error loading ${config.mapId} district GeoJSON:`, error));
}

// Set up map event listeners
function setupMapEventListeners(cityMapInstance) {
    const { map } = cityMapInstance;

    // Map click handler for polygon drawing
    map.on('click', function () {
        if (!cityMapInstance.polygonDrawer) {
            cityMapInstance.polygonDrawer = new L.Draw.Polygon(map, {
                shapeOptions: {
                    color: '#FFE657',
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
            cityMapInstance.polygonDrawer.enable();
        }
    });

    // Handle polygon creation
    map.on(L.Draw.Event.CREATED, function (event) {
        const layer = event.layer;
        cityMapInstance.drawnItems.addLayer(layer);
        layer.bindPopup('Polygon drawn!');
        cityMapInstance.polygonDrawer = null;
    });

    // Handle draw stop
    map.on(L.Draw.Event.DRAWSTOP, function () {
        cityMapInstance.polygonDrawer = null;
    });
}

// Clear map function
function clearCityMap(cityKey) {
    const cityMapInstance = cityMaps[cityKey];
    if (!cityMapInstance) return;

    const { map, drawnItems, config } = cityMapInstance;

    drawnItems.clearLayers();
    
    if (cityMapInstance.districtsLayer) {
        map.removeLayer(cityMapInstance.districtsLayer);
        cityMapInstance.districtsLayer = null;
        cityMapInstance.districtsVisible = false;
    }
    
    if (cityMapInstance.proposedLayer) {
        map.removeLayer(cityMapInstance.proposedLayer);
        cityMapInstance.proposedLayer = null;
    }
    
    // Remove proposed district markers
    if (cityMapInstance.proposedMarkers) {
        cityMapInstance.proposedMarkers.forEach(marker => {
            map.removeLayer(marker);
        });
        cityMapInstance.proposedMarkers = [];
    }
    
    // Remove initial district markers
    if (cityMapInstance.initialMarkers) {
        cityMapInstance.initialMarkers.forEach(marker => {
            map.removeLayer(marker);
        });
        cityMapInstance.initialMarkers = [];
    }
    
    if (cityMapInstance.initialLayer) {
        map.removeLayer(cityMapInstance.initialLayer);
        cityMapInstance.initialLayer = null;
        // Reload the initial district
        loadInitialDistrict(cityMapInstance);
    }
    
    if (cityMapInstance.polygonDrawer) {
        cityMapInstance.polygonDrawer.disable();
        cityMapInstance.polygonDrawer = null;
    }
    
    const resultsElement = document.getElementById(config.resultsElementId);
    if (resultsElement) {
        resultsElement.textContent = '';
    }
}

// Check user drawing function
function checkCityUserDrawing(cityKey) {
    const cityMapInstance = cityMaps[cityKey];
    if (!cityMapInstance) return;

    if (cityMapInstance.drawnItems.getLayers().length === 0) {
        alert('Please draw a polygon first!');
        return;
    }
    
    if (!cityMapInstance.districtsData) {
        fetch('gis-data/PLANC2308/PLANC2308.json')
            .then(response => response.json())
            .then(data => {
                cityMapInstance.districtsData = data;
                showDistrictsAndCheck(cityMapInstance); 
            })
            .catch(error => console.error('Error loading districts data:', error));
    } else {
        showDistrictsAndCheck(cityMapInstance); 
    }
}

// Show districts and check function
function showDistrictsAndCheck(cityMapInstance) {
    const { map, config } = cityMapInstance;

    if (!cityMapInstance.districtsVisible) {
        // Add districts layer
        cityMapInstance.districtsLayer = L.geoJSON(cityMapInstance.districtsData, {
            style: {
                color: '#E1372D',
                weight: 2,
                opacity: 0.5,
                fillOpacity: 0
            },
            onEachFeature: function (feature, layer) {
                if (feature.properties && feature.properties.District) {
                    layer.bindPopup(`District ${feature.properties.District}`);
                }
            }
        }).addTo(map);
    
        // Add proposed district
        fetch(config.proposedDistrictFile)
            .then(response => response.json())
            .then(data => {
                cityMapInstance.proposedLayer = L.geoJSON(data, {
                    style: {
                        color: '#E1372D',
                        weight: 2,
                        opacity: 0.3,
                        fillOpacity: 0.3
                    },
                    onEachFeature: function (feature, layer) {
                        layer.bindPopup(`Proposed District ${config.district}`);
                    }
                }).addTo(map);
                
                // Add label marker after the layer is added (one per layer, not per feature)
                const bounds = cityMapInstance.proposedLayer.getBounds();
                const center = bounds.getCenter();
                const proposedMarker = L.marker(center, {
                    icon: L.divIcon({
                        className: 'district-label proposed-district',
                        html: `<div style="background: rgba(255,255,255,0.9); padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; color: #E1372D; border: 1px solid #E1372D; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">Proposed District ${config.district}</div>`,
                        iconSize: [140, 30],
                        iconAnchor: [70, 15]
                    }),
                    zIndexOffset: 1001
                }).addTo(map);
                
                // Track the marker for cleanup
                cityMapInstance.proposedMarkers.push(proposedMarker);
            })
            .catch(error => console.error(`Error loading proposed ${config.mapId} district:`, error));
        
        cityMapInstance.districtsVisible = true; 
    }
    
    const resultsElement = document.getElementById(config.resultsElementId);
    if (resultsElement) {
        resultsElement.textContent = config.resultsText;
    }
}

// Utility functions (same as before)
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

function calculateOverlapPercentage(drawnPolygon, districtFeature) {
    try {
        const bounds1 = getBounds(drawnPolygon);
        const bounds2 = getBounds(districtFeature);
        
        const overlapArea = getOverlapArea(bounds1, bounds2);
        const polygon1Area = getArea(bounds1);
        
        if (polygon1Area === 0) return 0;
        
        return (overlapArea / polygon1Area) * 100;
        
    } catch (error) {
        console.error('Error calculating overlap:', error);
        return 0;
    }
}

// Initialize maps and set up event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add CSS for district labels
    const style = document.createElement('style');
    style.textContent = `
        .district-label {
            pointer-events: none;
            user-select: none;
        }
        .district-label div {
            white-space: nowrap;
            text-align: center;
            line-height: 1.2;
        }
        .current-district div {
            animation: fadeIn 0.5s ease-in;
        }
        .proposed-district div {
            animation: slideIn 0.5s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideIn {
            from { transform: translateY(-10px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    // Initialize maps for cities that have elements on the page
    Object.keys(cityConfig).forEach(cityKey => {
        const config = cityConfig[cityKey];
        const element = document.getElementById(config.mapId);
        if (element) {
            createCityMap(cityKey);
            
            // Set up button event listeners
            const checkButton = document.getElementById(config.checkButtonId);
            if (checkButton) {
                checkButton.addEventListener('click', () => checkCityUserDrawing(cityKey));
            }
            
            const clearButton = document.getElementById(config.clearButtonId);
            if (clearButton) {
                clearButton.addEventListener('click', () => clearCityMap(cityKey));
            }
        }
    });
});


// // City configuration data
// const cityConfig = {
//     dallas: {
//         mapId: 'dallas-map',
//         coordinates: [32.7767, -96.7970],
//         zoom: 10,
//         district: '32',
//         currentDistrictFile: 'gis-data/cities/dallas/district-32.geojson',
//         proposedDistrictFile: 'gis-data/cities/dallas/proposed-32.json',
//         resultsElementId: 'results_dallas',
//         checkButtonId: 'checkAnswer_dallas',
//         clearButtonId: 'clearMap_dallas',
//         resultsText: `Also targeted are Democratic U.S. Reps. Julie Johnson of Farmers Branch — whose Dallas-anchored district would be reshaped to favor Republicans and Marc Veasey of Fort Worth, whose nearby district would remain solidly blue but drop all of Fort Worth — Veasey's hometown and political base.`
//     },
//     austin: {
//         mapId: 'austin-map',
//         coordinates: [30.266666, -97.733330],
//         zoom: 10,
//         district: '37',
//         currentDistrictFile: 'gis-data/cities/austin/district-37.geojson',
//         proposedDistrictFile: 'gis-data/cities/austin/proposed-37.json',
//         resultsElementId: 'results_austin',
//         checkButtonId: 'checkAnswer_austin',
//         clearButtonId: 'clearMap_austin',
//         resultsText: `The map's newly proposed GOP seat in Central Texas also triggers the prospect of Austin Democratic Reps. Casar and Lloyd Doggett facing each other in a primary for the area's lone remaining blue district.`
//     },
//     houston: {
//         mapId: 'houston-map',
//         coordinates: [29.7604, -95.3698],
//         zoom: 10,
//         district: '9',
//         currentDistrictFile: 'gis-data/cities/houston/district-9.geojson',
//         proposedDistrictFile: 'gis-data/cities/houston/proposed-9.json',
//         resultsElementId: 'results_houston',
//         checkButtonId: 'checkAnswer_houston',
//         clearButtonId: 'clearMap_houston',
//         resultsText: `Houston's District 9 redistricting proposal aims to reshape the political landscape in Harris County.`
//     },
//     sanantonio: {
//         mapId: 'sanantonio-map',
//         coordinates: [29.4241, -98.4936],
//         zoom: 8,
//         district: '35',
//         currentDistrictFile: 'gis-data/cities/san-antonio/district-35.geojson',
//         proposedDistrictFile: 'gis-data/cities/san-antonio/proposed-35.json',
//         resultsElementId: 'results_sanantonio',
//         checkButtonId: 'checkAnswer_sanantonio',
//         clearButtonId: 'clearMap_sanantonio',
//         resultsText: `San Antonio's District 35 faces significant boundary changes under the proposed redistricting plan.`
//     },
//     southtexas: {
//         mapId: 'southtexas-map',
//         coordinates: [27.7694, -98.2300],
//         zoom: 7,
//         district: '28',
//         currentDistrictFile: 'gis-data/cities/san-antonio/district-28.geojson',
//         proposedDistrictFile: 'gis-data/cities/san-antonio/proposed-28.json',
//         resultsElementId: 'results_southtexas',
//         checkButtonId: 'checkAnswer_southtexas',
//         clearButtonId: 'clearMap_southtexas',
//         resultsText: `The proposed changes to South Texas' District 28 aim to better reflect the region's demographics and political landscape.`
//     }

// };

// // City map instances storage
// const cityMaps = {};

// // Reusable map creation function
// function createCityMap(cityKey) {
//     const config = cityConfig[cityKey];
//     if (!config) {
//         console.error(`City configuration not found for: ${cityKey}`);
//         return null;
//     }

//     const element = document.getElementById(config.mapId);
//     if (!element) {
//         console.error(`Map element not found: ${config.mapId}`);
//         return null;
//     }

//     // Initialize map
//     element.style.height = '600px';
//     const map = L.map(element);

//     // Add tile layer
//     L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
//         attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
//         subdomains: 'abcd',
//         maxZoom: 20
//     }).addTo(map);

//     // Set initial view
//     const target = L.latLng(config.coordinates[0], config.coordinates[1]);
//     map.setView(target, config.zoom);

//     // Create city map instance
//     const cityMapInstance = {
//         map: map,
//         config: config,
//         districtsLayer: null,
//         districtsData: null,
//         districtsVisible: false,
//         polygonDrawer: null,
//         proposedLayer: null,
//         initialLayer: null,
//         drawnItems: new L.FeatureGroup()
//     };

//     // Add drawn items layer
//     map.addLayer(cityMapInstance.drawnItems);

//     // Load initial district
//     loadInitialDistrict(cityMapInstance);

//     // Set up event listeners
//     setupMapEventListeners(cityMapInstance);

//     // Store instance
//     cityMaps[cityKey] = cityMapInstance;

//     return cityMapInstance;
// }

// // Load initial district for a city
// function loadInitialDistrict(cityMapInstance) {
//     const { config, map } = cityMapInstance;
    
//     fetch(config.currentDistrictFile)
//         .then(response => response.json())
//         .then(data => {
//             cityMapInstance.initialLayer = L.geoJSON(data, {
//                 style: {
//                     color: '#50607A',
//                     weight: 2,
//                     opacity: 0.8,
//                     fillOpacity: 0.3
//                 },
//                 onEachFeature: function (feature, layer) {
//                     layer.bindPopup(`Current District ${config.district}`);
                    
//                     const bounds = layer.getBounds();
//                     const center = bounds.getCenter();
//                     L.marker(center, {
//                         icon: L.divIcon({
//                             className: 'district-label',
//                             html: '<div style="background: transparent; padding: 2px 5px; border-radius: 3px; font-size: 14px; font-weight: bold; color: #2A2F3E;">Current district</div>',
//                             iconSize: [60, 20],
//                             iconAnchor: [0, 60]
//                         })
//                     }).addTo(map);
//                 }
//             }).addTo(map);
//         })
//         .catch(error => console.error(`Error loading ${config.mapId} district GeoJSON:`, error));
// }

// // Set up map event listeners
// function setupMapEventListeners(cityMapInstance) {
//     const { map } = cityMapInstance;

//     // Map click handler for polygon drawing
//     map.on('click', function () {
//         if (!cityMapInstance.polygonDrawer) {
//             cityMapInstance.polygonDrawer = new L.Draw.Polygon(map, {
//                 shapeOptions: {
//                     color: '#FFE657',
//                     weight: 2,
//                     opacity: 0.8,
//                     fillOpacity: 0.3
//                 },
//                 allowIntersection: false,
//                 drawError: {
//                     color: '#e1e100',
//                     message: '<strong>Error:</strong> shape edges cannot cross!'
//                 }
//             });
//             cityMapInstance.polygonDrawer.enable();
//         }
//     });

//     // Handle polygon creation
//     map.on(L.Draw.Event.CREATED, function (event) {
//         const layer = event.layer;
//         cityMapInstance.drawnItems.addLayer(layer);
//         layer.bindPopup('Polygon drawn!');
//         cityMapInstance.polygonDrawer = null;
//     });

//     // Handle draw stop
//     map.on(L.Draw.Event.DRAWSTOP, function () {
//         cityMapInstance.polygonDrawer = null;
//     });
// }

// // Clear map function
// function clearCityMap(cityKey) {
//     const cityMapInstance = cityMaps[cityKey];
//     if (!cityMapInstance) return;

//     const { map, drawnItems, config } = cityMapInstance;

//     drawnItems.clearLayers();
    
//     if (cityMapInstance.districtsLayer) {
//         map.removeLayer(cityMapInstance.districtsLayer);
//         cityMapInstance.districtsLayer = null;
//         cityMapInstance.districtsVisible = false;
//     }
    
//     if (cityMapInstance.proposedLayer) {
//         map.removeLayer(cityMapInstance.proposedLayer);
//         cityMapInstance.proposedLayer = null;
//     }
    
//     if (cityMapInstance.initialLayer) {
//         map.removeLayer(cityMapInstance.initialLayer);
//         cityMapInstance.initialLayer = null;
//         // Reload the initial district
//         loadInitialDistrict(cityMapInstance);
//     }
    
//     if (cityMapInstance.polygonDrawer) {
//         cityMapInstance.polygonDrawer.disable();
//         cityMapInstance.polygonDrawer = null;
//     }
    
//     const resultsElement = document.getElementById(config.resultsElementId);
//     if (resultsElement) {
//         resultsElement.textContent = '';
//     }
// }

// // Check user drawing function
// function checkCityUserDrawing(cityKey) {
//     const cityMapInstance = cityMaps[cityKey];
//     if (!cityMapInstance) return;

//     if (cityMapInstance.drawnItems.getLayers().length === 0) {
//         alert('Please draw a polygon first!');
//         return;
//     }
    
//     if (!cityMapInstance.districtsData) {
//         fetch('gis-data/PLANC2308/PLANC2308.json')
//             .then(response => response.json())
//             .then(data => {
//                 cityMapInstance.districtsData = data;
//                 showDistrictsAndCheck(cityMapInstance); 
//             })
//             .catch(error => console.error('Error loading districts data:', error));
//     } else {
//         showDistrictsAndCheck(cityMapInstance); 
//     }
// }

// // Show districts and check function
// function showDistrictsAndCheck(cityMapInstance) {
//     const { map, config } = cityMapInstance;

//     if (!cityMapInstance.districtsVisible) {
//         // Add districts layer
//         cityMapInstance.districtsLayer = L.geoJSON(cityMapInstance.districtsData, {
//             style: {
//                 color: '#E1372D',
//                 weight: 2,
//                 opacity: 0.5,
//                 fillOpacity: 0
//             },
//             onEachFeature: function (feature, layer) {
//                 if (feature.properties && feature.properties.District) {
//                     layer.bindPopup(`District ${feature.properties.District}`);
//                 }
//             }
//         }).addTo(map);
    
//         // Add proposed district
//         fetch(config.proposedDistrictFile)
//             .then(response => response.json())
//             .then(data => {
//                 cityMapInstance.proposedLayer = L.geoJSON(data, {
//                     style: {
//                         color: '#E1372D',
//                         weight: 2,
//                         opacity: 0.3,
//                         fillOpacity: 0.3
//                     },
//                     onEachFeature: function (feature, layer) {
//                         layer.bindPopup('Proposed');
                        
//                         const bounds = layer.getBounds();
//                         const center = bounds.getCenter();
//                         L.marker(center, {
//                             icon: L.divIcon({
//                                 className: 'district-label',
//                                 html: '<div style="background: transparent; padding: 2px 5px; border-radius: 3px; font-size: 14px; color: #E1372D; font-weight: bold;">Proposed District</div>',
//                                 iconSize: [60, 20],
//                                 iconAnchor: [-10, 60]
//                             })
//                         }).addTo(map);
//                     }
//                 }).addTo(map);
//             })
//             .catch(error => console.error(`Error loading proposed ${config.mapId} district:`, error));
        
//         cityMapInstance.districtsVisible = true; 
//     }
    
//     const resultsElement = document.getElementById(config.resultsElementId);
//     if (resultsElement) {
//         resultsElement.textContent = config.resultsText;
//     }
// }

// // Utility functions (same as before)
// function getBounds(polygon) {
//     const coords = polygon.geometry ? polygon.geometry.coordinates[0] : polygon.coordinates[0];
//     let minLat = Infinity, maxLat = -Infinity;
//     let minLng = Infinity, maxLng = -Infinity;
    
//     coords.forEach(coord => {
//         const [lng, lat] = coord;
//         minLat = Math.min(minLat, lat);
//         maxLat = Math.max(maxLat, lat);
//         minLng = Math.min(minLng, lng);
//         maxLng = Math.max(maxLng, lng);
//     });
    
//     return { minLat, maxLat, minLng, maxLng };
// }

// function getOverlapArea(bounds1, bounds2) {
//     const overlapMinLat = Math.max(bounds1.minLat, bounds2.minLat);
//     const overlapMaxLat = Math.min(bounds1.maxLat, bounds2.maxLat);
//     const overlapMinLng = Math.max(bounds1.minLng, bounds2.minLng);
//     const overlapMaxLng = Math.min(bounds1.maxLng, bounds2.maxLng);
    
//     if (overlapMinLat >= overlapMaxLat || overlapMinLng >= overlapMaxLng) {
//         return 0; 
//     }
    
//     return (overlapMaxLat - overlapMinLat) * (overlapMaxLng - overlapMinLng);
// }

// function getArea(bounds) {
//     return (bounds.maxLat - bounds.minLat) * (bounds.maxLng - bounds.minLng);
// }

// function calculateOverlapPercentage(drawnPolygon, districtFeature) {
//     try {
//         const bounds1 = getBounds(drawnPolygon);
//         const bounds2 = getBounds(districtFeature);
        
//         const overlapArea = getOverlapArea(bounds1, bounds2);
//         const polygon1Area = getArea(bounds1);
        
//         if (polygon1Area === 0) return 0;
        
//         return (overlapArea / polygon1Area) * 100;
        
//     } catch (error) {
//         console.error('Error calculating overlap:', error);
//         return 0;
//     }
// }

// // Initialize maps and set up event listeners when DOM is loaded
// document.addEventListener('DOMContentLoaded', function() {
//     // Initialize maps for cities that have elements on the page
//     Object.keys(cityConfig).forEach(cityKey => {
//         const config = cityConfig[cityKey];
//         const element = document.getElementById(config.mapId);
//         if (element) {
//             createCityMap(cityKey);
            
//             // Set up button event listeners
//             const checkButton = document.getElementById(config.checkButtonId);
//             if (checkButton) {
//                 checkButton.addEventListener('click', () => checkCityUserDrawing(cityKey));
//             }
            
//             const clearButton = document.getElementById(config.clearButtonId);
//             if (clearButton) {
//                 clearButton.addEventListener('click', () => clearCityMap(cityKey));
//             }
//         }
//     });
// });