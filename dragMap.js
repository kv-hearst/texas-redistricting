// Configuration dictionary for each city
const cityConfig = {
    austin: {
        mapId: 'austin-map',
        coordinates: [30.266666, -97.733330],
        zoom: 10,
        district: '37',
        currentDistrictFile: './assets/district-37.geojson',
        proposedDistrictFile: './assets/proposed-37.json',
        imageFile: './assets/proposed-37.png',
        resultsElementId: 'results_austin',
        checkButtonId: 'checkAnswer_austin',
        clearButtonId: 'clearMap_austin',
        resultsText: `Under the Texas GOP proposed redistricting plan, Austin's District 37 triggers the prospect of two Democratic representatives facing each other in a primary for the area's lone remaining blue district.`
    },
    houston: {
        mapId: 'houston-map',
        coordinates: [29.7604, -95.3698],
        zoom: 11,
        district: '9',
        currentDistrictFile: './assets/district-9.geojson',
        proposedDistrictFile: './assets/proposed-9.json',
        imageFile: './assets/proposed-9.png',
        resultsElementId: 'results_houston',
        checkButtonId: 'checkAnswer_houston',
        clearButtonId: 'clearMap_houston',
        resultsText: `Under the Texas GOP proposed redistricting plan, Houston's District 9 will shift to the eastern parts of Houston, where no current member of Congress lives.`
    },
    sanantonio: {
        mapId: 'sanantonio-map',
        coordinates: [29.4241, -98.4936],
        zoom: 7,
        district: '35',
        currentDistrictFile: './assets/district-35.geojson',
        proposedDistrictFile: './assets/proposed-35.json',
        imageFile: './assets/proposed-35.png',
        resultsElementId: 'results_sanantonio',
        checkButtonId: 'checkAnswer_sanantonio',
        clearButtonId: 'clearMap_sanantonio',
        resultsText: `Under the Texas GOP proposed redistricting plan, San Antonio's District 35 will become a majority-Latino district.`
    }
};

// Generic District Map Implementation for Multiple Cities
class DistrictMapManager {
    constructor(cityKey, config) {
        this.cityKey = cityKey;
        this.config = config;
        this.map = null;
        this.droppedLayers = [];
        this.targetDistrict = null;
        this.currentDistrictLayer = null;
        this.districtGeoJSON = null;
        
        // Bind methods to preserve 'this' context
        this.handleDragStart = this.handleDragStart.bind(this);
        this.handleDragEnd = this.handleDragEnd.bind(this);
        this.handleDragOver = this.handleDragOver.bind(this);
        this.handleDragEnter = this.handleDragEnter.bind(this);
        this.handleDragLeave = this.handleDragLeave.bind(this);
        this.handleDrop = this.handleDrop.bind(this);
        this.checkResults = this.checkResults.bind(this);
        this.clearMap = this.clearMap.bind(this);
    }

    // Load GeoJSON file with fallback
    async loadGeoJSONFile(filePath, description) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to load ${description}: ${response.statusText}`);
            }
            const data = await response.json();
            console.log(`${this.cityKey}: ${description} loaded successfully`);
            return data;
        } catch (error) {
            console.warn(`${this.cityKey}: Could not load ${description}, using sample data`);
            return this.createSampleData();
        }
    }

    // Create sample fallback data
    createSampleData() {
        const [lat, lng] = this.config.coordinates;
        const offset = 0.05;
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {
                        "name": `District ${this.config.district}`,
                        "id": this.config.district,
                        "city": this.cityKey
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [lng - offset, lat + offset],
                            [lng + offset, lat + offset],
                            [lng + offset, lat - offset],
                            [lng - offset, lat - offset],
                            [lng - offset, lat + offset]
                        ]]
                    }
                }
            ]
        };
    }

    // Initialize the map
    async initializeMap() {
        console.log(`${this.cityKey}: Initializing map...`);
        
        // Check if Leaflet is available
        if (typeof L === 'undefined') {
            console.error(`${this.cityKey}: Leaflet is not loaded!`);
            this.showError('Map library failed to load. Please refresh the page.');
            return;
        }

        try {
            this.map = L.map(this.config.mapId).setView(this.config.coordinates, this.config.zoom);
            console.log(`${this.cityKey}: Map created successfully`);

            // Add base tile layer
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(this.map);

            // Load current district boundaries if available
            await this.loadCurrentDistrict();

            // Load proposed district data
            await this.loadProposedDistrict();

            // Create target district (hidden initially)
            if (this.districtGeoJSON) {
                this.targetDistrict = L.geoJSON(this.districtGeoJSON, {
                    style: {
                        color: '#28a745',
                        weight: 3,
                        opacity: 0,
                        fillOpacity: 0,
                        fillColor: '#28a745'
                    }
                }).addTo(this.map);

                // Fit map to show the district area
                const bounds = this.targetDistrict.getBounds();
                if (bounds.isValid()) {
                    this.map.fitBounds(bounds, { padding: [50, 50] });
                }
            }

            // Set up drag and drop
            this.setupDragAndDrop();
            
            // Set up button listeners
            this.setupButtonListeners();
            
            console.log(`${this.cityKey}: Map initialization complete`);

        } catch (error) {
            console.error(`${this.cityKey}: Error initializing map:`, error);
            this.showError('Failed to initialize the map. Please refresh the page.');
        }
    }

    // Load current district boundaries
    async loadCurrentDistrict() {
        try {
            const currentDistrictData = await this.loadGeoJSONFile(
                this.config.currentDistrictFile,
                'current district boundaries'
            );
            
            this.currentDistrictLayer = L.geoJSON(currentDistrictData, {
                style: {
                    color: '#ff7800',
                    weight: 2,
                    opacity: 0.8,
                    fillColor: '#ffcc00',
                    fillOpacity: 0.1
                }
            }).addTo(this.map);
            
            console.log(`${this.cityKey}: Current district layer added successfully`);
        } catch (error) {
            console.error(`${this.cityKey}: Error loading current district:`, error);
        }
    }

    // Load proposed district data
    async loadProposedDistrict() {
        try {
            this.districtGeoJSON = await this.loadGeoJSONFile(
                this.config.proposedDistrictFile,
                'proposed district boundaries'
            );
            console.log(`${this.cityKey}: Proposed district data loaded successfully`);
        } catch (error) {
            console.error(`${this.cityKey}: Error loading proposed district:`, error);
        }
    }

    // Set up drag and drop functionality
    setupDragAndDrop() {
        const mapContainer = document.getElementById(this.config.mapId);
        const districtImage = mapContainer?.parentElement?.querySelector('.district-image');

        if (!districtImage) {
            console.error(`${this.cityKey}: District image not found`);
            return;
        }

        if (!mapContainer) {
            console.error(`${this.cityKey}: Map container not found`);
            return;
        }

        // Make image draggable
        districtImage.draggable = true;

        // Add drag event listeners to the image
        districtImage.addEventListener('dragstart', this.handleDragStart);
        districtImage.addEventListener('dragend', this.handleDragEnd);

        // Add drop event listeners to the map
        mapContainer.addEventListener('dragover', this.handleDragOver);
        mapContainer.addEventListener('dragenter', this.handleDragEnter);
        mapContainer.addEventListener('dragleave', this.handleDragLeave);
        mapContainer.addEventListener('drop', this.handleDrop);

        console.log(`${this.cityKey}: Drag and drop setup complete`);
    }

    // Drag event handlers
    handleDragStart(e) {
        console.log(`${this.cityKey}: Drag started`);
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', `district-shape-${this.cityKey}`);
    }

    handleDragEnd(e) {
        console.log(`${this.cityKey}: Drag ended`);
        e.target.classList.remove('dragging');
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    handleDragEnter(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    }

    handleDragLeave(e) {
        if (e.target === e.currentTarget) {
            e.currentTarget.classList.remove('drag-over');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        console.log(`${this.cityKey}: Drop detected`);

        // Get drop coordinates
        const mapContainer = document.getElementById(this.config.mapId);
        const rect = mapContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Convert to map coordinates
        const latLng = this.map.containerPointToLatLng([x, y]);
        console.log(`${this.cityKey}: Drop coordinates:`, latLng);

        // Add district to map
        this.addDistrictToMap(latLng);
    }

    // Add district to map at specific coordinates
    addDistrictToMap(centerLatLng) {
        if (!this.districtGeoJSON) {
            console.error(`${this.cityKey}: No district data available`);
            return;
        }

        console.log(`${this.cityKey}: Adding district to map at:`, centerLatLng);

        // Create a copy of the district data
        const districtCopy = JSON.parse(JSON.stringify(this.districtGeoJSON));

        // Calculate offset to position at drop point
        const tempLayer = L.geoJSON(districtCopy);
        const bounds = tempLayer.getBounds();
        const currentCenter = bounds.getCenter();
        const offsetLat = centerLatLng.lat - currentCenter.lat;
        const offsetLng = centerLatLng.lng - currentCenter.lng;

        // Apply offset to coordinates
        const offsetCoordinates = (coords) => {
            if (typeof coords[0] === 'number') {
                return [coords[0] + offsetLng, coords[1] + offsetLat];
            } else {
                return coords.map(offsetCoordinates);
            }
        };

        districtCopy.features.forEach(feature => {
            if (feature.geometry && feature.geometry.coordinates) {
                feature.geometry.coordinates = offsetCoordinates(feature.geometry.coordinates);
            }
        });

        // Create the visual layer
        const districtLayer = L.geoJSON(districtCopy, {
            style: {
                color: '#007bff',
                weight: 3,
                opacity: 0.8,
                fillColor: '#007bff',
                fillOpacity: 0.3
            },
            onEachFeature: (feature, layer) => {
                const districtName = feature.properties.name || `District ${this.config.district}`;
                layer.bindPopup(`
                    <div style="text-align: center;">
                        <strong>${districtName}</strong><br>
                        <small>Double-click to remove</small>
                    </div>
                `);

                // Remove on double-click
                layer.on('dblclick', () => {
                    this.removeDistrictLayer(districtLayer);
                });
            }
        }).addTo(this.map);

        // Track the layer
        this.droppedLayers.push(districtLayer);
        
        // Make the layer draggable for adjustments
        this.makeLayerDraggable(districtLayer);
        
        // Update results text
        this.updateResultsText(`${this.droppedLayers.length} district shape(s) placed. Click "Check Results" to see how you did!`, '#495057');
        
        // Show notification
        // this.showNotification('✅ District shape placed! Double-click to remove.');

        console.log(`${this.cityKey}: District layer added successfully`);
    }

    // Make a district layer draggable for adjustments - FIXED VERSION
    makeLayerDraggable(layer) {
        let isDragging = false;
        let dragStartLatLng = null;
        let originalStyle = null;
        let currentLayer = layer; // Keep reference to current layer

        const startDrag = (e) => {
            // Prevent default to avoid map panning
            e.originalEvent.preventDefault();
            e.originalEvent.stopPropagation();
            
            isDragging = true;
            dragStartLatLng = e.latlng;
            
            // Store original style and apply dragging style
            originalStyle = {
                color: currentLayer.options.color || '#007bff',
                weight: currentLayer.options.weight || 3,
                opacity: currentLayer.options.opacity || 0.8,
                fillColor: currentLayer.options.fillColor || '#007bff',
                fillOpacity: currentLayer.options.fillOpacity || 0.3,
                dashArray: currentLayer.options.dashArray || null
            };
            
            currentLayer.setStyle({
                ...originalStyle,
                opacity: 0.7,
                fillOpacity: 0.4,
                weight: 4,
                dashArray: '5, 5'
            });
            
            // Change cursor
            this.map.getContainer().style.cursor = 'grabbing';
            
            // Disable map dragging
            this.map.dragging.disable();
            
            console.log(`${this.cityKey}: Started dragging district layer`);
        };

        const drag = (e) => {
            if (!isDragging || !dragStartLatLng) return;
            
            // Calculate offset
            const offsetLat = e.latlng.lat - dragStartLatLng.lat;
            const offsetLng = e.latlng.lng - dragStartLatLng.lng;
            
            // Get current layer data
            const layerData = currentLayer.toGeoJSON();
            
            // Apply offset to all coordinates
            const offsetCoordinates = (coords) => {
                if (Array.isArray(coords) && coords.length > 0) {
                    if (typeof coords[0] === 'number') {
                        return [coords[0] + offsetLng, coords[1] + offsetLat];
                    } else {
                        return coords.map(offsetCoordinates);
                    }
                }
                return coords;
            };
            
            layerData.features.forEach(feature => {
                if (feature.geometry && feature.geometry.coordinates) {
                    feature.geometry.coordinates = offsetCoordinates(feature.geometry.coordinates);
                }
            });
            
            // Remove old layer
            this.map.removeLayer(currentLayer);
            
            // Create new layer with updated position
            const newLayer = L.geoJSON(layerData, {
                style: {
                    color: originalStyle.color,
                    weight: 4,
                    opacity: 0.7,
                    fillColor: originalStyle.fillColor,
                    fillOpacity: 0.4,
                    dashArray: '5, 5'
                },
                onEachFeature: (feature, layerInstance) => {
                    const districtName = feature.properties.name || `District ${this.config.district}`;
                    layerInstance.bindPopup(`
                        <div style="text-align: center;">
                            <strong>${districtName}</strong><br>
                            <small>Double-click to remove</small><br>
                            <small>Drag to adjust position</small>
                        </div>
                    `);

                    // Remove on double-click
                    layerInstance.on('dblclick', (e) => {
                        e.originalEvent.stopPropagation();
                        this.removeDistrictLayer(newLayer);
                    });
                }
            }).addTo(this.map);
            
            // Replace in droppedLayers array
            const layerIndex = this.droppedLayers.indexOf(currentLayer);
            if (layerIndex > -1) {
                this.droppedLayers[layerIndex] = newLayer;
            }
            
            // Update current layer reference
            currentLayer = newLayer;
            
            // Re-attach event listeners to new layer
            currentLayer.off('mousedown'); // Remove any existing listeners
            currentLayer.on('mousedown', startDrag);
            
            // Update drag start position for smooth dragging
            dragStartLatLng = e.latlng;
        };

        const endDrag = () => {
            if (!isDragging) return;
            
            isDragging = false;
            dragStartLatLng = null;
            
            // Restore original style
            if (originalStyle && currentLayer) {
                currentLayer.setStyle({
                    color: originalStyle.color,
                    weight: originalStyle.weight,
                    opacity: originalStyle.opacity,
                    fillColor: originalStyle.fillColor,
                    fillOpacity: originalStyle.fillOpacity,
                    dashArray: originalStyle.dashArray
                });
            }
            
            // Restore cursor and map dragging
            this.map.getContainer().style.cursor = '';
            this.map.dragging.enable();
            
            // Show adjustment notification
            // this.showNotification('✅ District position adjusted!');
            
            console.log(`${this.cityKey}: Finished dragging district layer`);
        };

        // Attach initial event listeners
        currentLayer.on('mousedown', startDrag);
        
        // Attach map-level event listeners (these don't need to be re-attached)
        this.map.on('mousemove', drag);
        this.map.on('mouseup', endDrag);
        
        // Also handle mouse leave to end dragging if cursor leaves map
        this.map.on('mouseout', endDrag);
    }

    // Remove a district layer
    removeDistrictLayer(layer) {
        console.log(`${this.cityKey}: Removing district layer`);
        this.map.removeLayer(layer);
        this.droppedLayers = this.droppedLayers.filter(l => l !== layer);
        
        // Update results text
        if (this.droppedLayers.length === 0) {
            this.updateResultsText('Drag the district shape onto the map to get started!', '#495057');
        } else {
            this.updateResultsText(`${this.droppedLayers.length} district shape(s) placed. Click "Check Results" to see how you did!`, '#495057');
        }
    }

    // Set up button event listeners
    setupButtonListeners() {
        const checkButton = document.getElementById(this.config.checkButtonId);
        const clearButton = document.getElementById(this.config.clearButtonId);

        if (checkButton) {
            checkButton.addEventListener('click', this.checkResults);
        }

        if (clearButton) {
            clearButton.addEventListener('click', this.clearMap);
        }
    }

    // Check results against target
    checkResults() {
        console.log(`${this.cityKey}: Checking results...`);

        if (this.droppedLayers.length === 0) {
            this.updateResultsText('❌ No district shapes placed. Try dragging the district image onto the map!', '#dc3545');
            return;
        }

        if (!this.targetDistrict) {
            this.updateResultsText('❌ Target district data not available for comparison.', '#dc3545');
            return;
        }

        // Find closest placement
        let bestMatch = null;
        let minDistance = Infinity;

        this.droppedLayers.forEach(layer => {
            const droppedBounds = layer.getBounds();
            const droppedCenter = droppedBounds.getCenter();
            const targetCenter = this.targetDistrict.getBounds().getCenter();
            const distance = droppedCenter.distanceTo(targetCenter);
            
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = layer;
            }
        });

        // Show correct answer briefly
        this.targetDistrict.setStyle({
            opacity: 0.8,
            fillOpacity: 0.3
        });

        setTimeout(() => {
            this.targetDistrict.setStyle({
                opacity: 0,
                fillOpacity: 0
            });
        }, 4000);

        const distanceMiles = (minDistance / 1000) * 0.621371; // Convert meters to miles
        
        if (distanceMiles < 1.24) { // ~2km converted to miles
            this.updateResultsText(`
            
            ✅ <strong style="color: #28a745;">Excellent! Your district placement is very accurate!</strong>
            <br><small style="color: #28a745;">Distance from correct center: ${Math.round(distanceMiles * 100) / 100} miles</small>
            <br><br><span style="color: black;">${this.config.resultsText}</span>
            `);
        } else if (distanceMiles < 3.11) { // ~5km converted to miles
            this.updateResultsText(`
                ⚠️ <strong style="color: #ffc107;">Good effort! Your placement is close to the target area.</strong>
                <br><small style="color: #ffc107;">Distance from correct center: ${Math.round(distanceMiles * 100) / 100} miles</small>
                <br><br><span style="color: black;">${this.config.resultsText}</span>
            
                `);
        } else {
            this.updateResultsText(`
                ❌ <strong style="color: #dc3545;">Keep trying! Your district needs to be repositioned.</strong> 
                <br><small style="color: #dc3545;">Distance from correct center: ${Math.round(distanceMiles * 100) / 100} miles</small>
                <br><br><span style="color: black;">${this.config.resultsText}</span>
            
                `);
        }
    }

    // Clear map
    clearMap() {
        console.log(`${this.cityKey}: Clearing map...`);
        
        // Remove all dropped layers
        this.droppedLayers.forEach(layer => {
            this.map.removeLayer(layer);
        });
        this.droppedLayers = [];

        // Reset results
        this.updateResultsText('Drag the district shape onto the map to get started!', '#495057');

        // this.showNotification('🔄 Map cleared! Try placing the district again.');
    }

    // Update results text
    updateResultsText(text, color = '#495057') {
        const resultsElement = document.getElementById(this.config.resultsElementId);
        if (resultsElement) {
            resultsElement.innerHTML = text;
            resultsElement.style.color = color;
        }
    }

    // Show notification
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            z-index: 10000;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            font-weight: 500;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Show error
    showError(message) {
        this.updateResultsText(`❌ ${message}`, '#dc3545');
    }
}

// Global map managers storage
window.mapManagers = {};

// Initialize map for a specific city
function initializeCityMap(cityKey, config) {
    if (!config) {
        console.error(`Configuration not found for city: ${cityKey}`);
        return null;
    }

    console.log(`Initializing map for ${cityKey}...`);
    
    const manager = new DistrictMapManager(cityKey, config);
    window.mapManagers[cityKey] = manager;
    
    // Initialize the map
    manager.initializeMap().catch(error => {
        console.error(`Failed to initialize ${cityKey} map:`, error);
    });
    
    return manager;
}

// Initialize all maps based on which containers are present on the page
function initializeAllMaps() {
    console.log('Initializing all available maps...');
    
    Object.keys(cityConfig).forEach(cityKey => {
        const config = cityConfig[cityKey];
        const mapContainer = document.getElementById(config.mapId);
        
        if (mapContainer) {
            console.log(`Found container for ${cityKey}, initializing...`);
            initializeCityMap(cityKey, config);
        } else {
            console.log(`No container found for ${cityKey}, skipping...`);
        }
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing maps...');
    
    // Check if cityConfig is available
    if (typeof cityConfig === 'undefined') {
        console.error('cityConfig not found! Make sure it is defined before this script.');
        return;
    }
    
    // Initialize all maps
    initializeAllMaps();
});

// Export for global access
window.DistrictMapManager = DistrictMapManager;
window.initializeCityMap = initializeCityMap;
window.initializeAllMaps = initializeAllMaps;
