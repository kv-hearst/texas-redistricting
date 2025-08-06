// Austin District 37 Drag & Drop Map Implementation

// Initialize the Austin map
let austinMap;
let droppedLayers = [];
let targetDistrict = null; // This will contain the correct District 37 boundaries
let district37GeoJSON = null; // Changed from const to let

// Load GeoJSON data
async function loadDistrictData() {
    try {
        const response = await fetch('/gis-data/cities/austin/proposed-37.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        district37GeoJSON = await response.json();
        console.log('District 37 GeoJSON loaded successfully');
        return district37GeoJSON;
    } catch (error) {
        console.error('Error loading District 37 GeoJSON:', error);


// Initialize the map when the page loads
async function initAustinMap() {
    // Create the map centered on Austin
    austinMap = L.map('austin-map').setView([30.2672, -97.7431], 11);
    
    // Add base tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(austinMap);
    
    // Load the district data first
    await loadDistrictData();
    
    // Now create the target district layer with the loaded data
    if (district37GeoJSON) {
        targetDistrict = L.geoJSON(district37GeoJSON, {
            style: {
                color: '#28a745',
                weight: 3,
                opacity: 0,
                fillOpacity: 0
            }
        }).addTo(austinMap);
        
        // Fit map to district bounds for better initial view
        const bounds = targetDistrict.getBounds();
        if (bounds.isValid()) {
            austinMap.fitBounds(bounds, { padding: [20, 20] });
        }
    }
    
    // Set up drag and drop functionality
    setupDragAndDrop();
    
    // Set up button event listeners
    setupButtonListeners();
}

function setupDragAndDrop() {
    const districtImage = document.querySelector('.image-container img');
    const mapContainer = document.getElementById('austin-map');
    
    if (!districtImage) {
        console.error('District image not found');
        return;
    }
    
    // Make the image draggable
    districtImage.draggable = true;
    districtImage.style.cursor = 'grab';
    
    // Add drag event listeners to the image
    districtImage.addEventListener('dragstart', handleDragStart);
    districtImage.addEventListener('dragend', handleDragEnd);
    
    // Add drop event listeners to the map
    mapContainer.addEventListener('dragover', handleDragOver);
    mapContainer.addEventListener('dragenter', handleDragEnter);
    mapContainer.addEventListener('dragleave', handleDragLeave);
    mapContainer.addEventListener('drop', handleDrop);
    
    // Visual feedback styles
    const style = document.createElement('style');
    style.textContent = `
        .drag-over {
            border: 3px dashed #007bff !important;
            background: rgba(0, 123, 255, 0.1) !important;
        }
        
        .dragging {
            opacity: 0.5;
            transform: rotate(5deg);
            cursor: grabbing !important;
        }
        
        .district-layer {
            cursor: grab;
        }
        
        .district-layer:hover {
            filter: brightness(1.1);
        }
    `;
    document.head.appendChild(style);
}

function handleDragStart(e) {
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', 'district-shape');
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    if (e.target === e.currentTarget) {
        e.currentTarget.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    // Get the drop coordinates relative to the map
    const mapContainer = document.getElementById('austin-map');
    const rect = mapContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert to map coordinates
    const latLng = austinMap.containerPointToLatLng([x, y]);
    
    // Create and add the district shape at the drop location
    addDistrictToMap(latLng);
    
    // Provide visual feedback
    showDropFeedback();
}

function addDistrictToMap(centerLatLng) {
    if (!district37GeoJSON) {
        console.error('District GeoJSON not loaded');
        return;
    }
    
    // Create a copy of the district GeoJSON and position it at the drop location
    const districtCopy = JSON.parse(JSON.stringify(district37GeoJSON));
    
    // Calculate offset to center the shape at the drop point
    const tempLayer = L.geoJSON(districtCopy);
    const bounds = tempLayer.getBounds();
    const currentCenter = bounds.getCenter();
    const offsetLat = centerLatLng.lat - currentCenter.lat;
    const offsetLng = centerLatLng.lng - currentCenter.lng;
    
    // Function to recursively apply offset to coordinates
    function offsetCoordinates(coords) {
        if (typeof coords[0] === 'number') {
            // This is a coordinate pair [lng, lat]
            return [coords[0] + offsetLng, coords[1] + offsetLat];
        } else {
            // This is an array of coordinates, recurse
            return coords.map(offsetCoordinates);
        }
    }
    
    // Apply offset to all features
    districtCopy.features.forEach(feature => {
        if (feature.geometry && feature.geometry.coordinates) {
            feature.geometry.coordinates = offsetCoordinates(feature.geometry.coordinates);
        }
    });
    
    // Create the layer with styling
    const districtLayer = L.geoJSON(districtCopy, {
        style: {
            color: '#007bff',
            weight: 3,
            opacity: 0.8,
            fillColor: '#007bff',
            fillOpacity: 0.3
        },
        onEachFeature: function(feature, layer) {
            // Add popup
            const districtName = feature.properties.name || feature.properties.id || 'District';
            layer.bindPopup(`
                <div>
                    <strong>${districtName}</strong><br>
                    <small>Double-click to remove</small>
                </div>
            `);
            
            // Double-click to remove
            layer.on('dblclick', function() {
                removeDistrictLayer(districtLayer);
            });
        }
    }).addTo(austinMap);
    
    // Add to tracking array
    droppedLayers.push(districtLayer);
    
    console.log('District layer added successfully');
}

function removeDistrictLayer(layer) {
    austinMap.removeLayer(layer);
    droppedLayers = droppedLayers.filter(l => l !== layer);
    console.log('District layer removed');
}

function showDropFeedback() {
    // Visual feedback when shape is dropped
    const notification = document.createElement('div');
    notification.innerHTML = '✅ District shape added! Double-click to remove.';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
    
    // Add animations if not already present
    if (!document.querySelector('#drop-animations')) {
        const animationStyle = document.createElement('style');
        animationStyle.id = 'drop-animations';
        animationStyle.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
            }
            @keyframes slideOut {
                from { transform: translateX(0); }
                to { transform: translateX(100%); }
            }
        `;
        document.head.appendChild(animationStyle);
    }
}

function setupButtonListeners() {
    // Check Results button
    const checkButton = document.getElementById('checkAnswer_austin');
    const clearButton = document.getElementById('clearMap_austin');
    
    if (checkButton) {
        checkButton.addEventListener('click', function() {
            checkResults();
        });
    }
    
    if (clearButton) {
        clearButton.addEventListener('click', function() {
            clearMap();
        });
    }
}

function checkResults() {
    const resultsElement = document.getElementById('results_austin');
    
    if (!resultsElement) {
        console.error('Results element not found');
        return;
    }
    
    if (droppedLayers.length === 0) {
        resultsElement.innerHTML = '❌ No district shapes placed. Try dragging the district image onto the map!';
        resultsElement.style.color = '#dc3545';
        return;
    }
    
    if (!targetDistrict) {
        resultsElement.innerHTML = '❌ Target district data not available for comparison.';
        resultsElement.style.color = '#dc3545';
        return;
    }
    
    // Simple proximity check (in a real implementation, you'd do proper geometric analysis)
    let bestMatch = null;
    let minDistance = Infinity;
    
    droppedLayers.forEach(layer => {
        const droppedBounds = layer.getBounds();
        const droppedCenter = droppedBounds.getCenter();
        const targetCenter = targetDistrict.getBounds().getCenter();
        
        const distance = droppedCenter.distanceTo(targetCenter);
        if (distance < minDistance) {
            minDistance = distance;
            bestMatch = layer;
        }
    });
    
    // Show the correct answer temporarily
    targetDistrict.setStyle({
        opacity: 0.7,
        fillOpacity: 0.2
    });
    
    setTimeout(() => {
        targetDistrict.setStyle({
            opacity: 0,
            fillOpacity: 0
        });
    }, 3000);
    
    // Analyze results
    if (minDistance < 5000) { // Within 5km
        resultsElement.innerHTML = `
            ✅ <strong>Great job!</strong> Your district placement is very close to the actual District 37 boundaries.
            <br><small>Distance from correct position: ${Math.round(minDistance)}m</small>
        `;
        resultsElement.style.color = '#28a745';
    } else if (minDistance < 10000) { // Within 10km
        resultsElement.innerHTML = `
            ⚠️ <strong>Close!</strong> Your district placement is near the correct area but needs some adjustment.
            <br><small>Distance from correct position: ${Math.round(minDistance)}m</small>
        `;
        resultsElement.style.color = '#ffc107';
    } else {
        resultsElement.innerHTML = `
            ❌ <strong>Not quite right.</strong> Try repositioning your district closer to the correct area.
            <br><small>The correct boundaries were shown briefly in green.</small>
        `;
        resultsElement.style.color = '#dc3545';
    }
}

function clearMap() {
    // Remove all dropped layers
    droppedLayers.forEach(layer => {
        austinMap.removeLayer(layer);
    });
    droppedLayers = [];
    
    // Clear results
    const resultsElement = document.getElementById('results_austin');
    if (resultsElement) {
        resultsElement.innerHTML = '';
    }
    
    // Reset image if it was hidden
    const districtImage = document.querySelector('.image-container img');
    if (districtImage) {
        districtImage.style.display = 'block';
        districtImage.style.opacity = '1';
    }
    
    console.log('Map cleared');
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Austin map...');
    initAustinMap();
});

// Export functions for global access if needed
window.austinMapFunctions = {
    initAustinMap,
    clearMap,
    checkResults,
    loadDistrictData
};
        return null;
    }
}