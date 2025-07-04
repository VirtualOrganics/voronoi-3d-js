import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DelaunayMesh } from './DelaunayMesh.js';

// --- Basic Three.js Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111); // Dark grey background
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#bg'),
    antialias: true, // Smoother lines
});
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.set(0, 5, 10); // Move camera back and up

// --- ADD ORBIT CONTROLS ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Makes movement feel smoother
// --- END ORBIT CONTROLS ---

console.log("🚀 3D Delaunay/Voronoi Engine Initialized");

// --- State Variables ---
let currentNumPoints = 50;
let currentMode = 'barycenter';
let currentMesh = null;
let visualizationObjects = {
    points: [],
    delaunayLines: null,
    delaunayFaces: null,
    voronoiVertices: [],
    voronoiLines: null,
    voronoiFaces: []
};

// --- Appearance Settings ---
let appearanceSettings = {
    backgroundColor: '#111111',
    pointSize: 0.075,
    pointColor: '#ff0000',
    delaunayColor: '#aaaaaa',
    delaunayFaceColor: '#ff6600',
    delaunayFaceOpacity: 0.3,
    voronoiColor: '#00ffff',
    voronoiFaceColor: '#66ff00',
    voronoiFaceOpacity: 0.2,
    voronoiVertexColor: '#ffff00',
    voronoiVertexSize: 0.05,
    showPoints: true,
    showDelaunay: true,
    showDelaunayFaces: true,
    showVoronoi: true,
    showVoronoiFaces: true,
    showVoronoiVertices: true
};

// --- Materials (will be updated by controls) ---
let pointsMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
let delaunayMaterial = new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.5 });
let delaunayFaceMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xff6600, 
    transparent: true, 
    opacity: 0.3,
    side: THREE.DoubleSide 
});
let voronoiMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff });
let voronoiFaceMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x66ff00, 
    transparent: true, 
    opacity: 0.2,
    side: THREE.DoubleSide 
});
let voronoiVertexMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });

// --- Geometries (reused for performance) ---
let pointsGeometry = new THREE.SphereGeometry(0.075, 16, 16);
let voronoiVertexGeometry = new THREE.SphereGeometry(0.05, 8, 8);

// --- Parameters ---
const boundingBoxSize = 5;
let minDistance = 0.8;

// --- Simple Poisson disk sampling for better point distribution ---
function generatePoissonPoints(numPoints, boxSize, minDist) {
    const points = [];
    const maxAttempts = 30; // Max attempts per point
    
    // 3D point generation
    points.push([
        (Math.random() - 0.5) * boxSize,
        (Math.random() - 0.5) * boxSize,
        (Math.random() - 0.5) * boxSize
    ]);
    
    while (points.length < numPoints) {
        let placed = false;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const candidate = [
                (Math.random() - 0.5) * boxSize,
                (Math.random() - 0.5) * boxSize,
                (Math.random() - 0.5) * boxSize
            ];
            
            // Check distance to all existing points (3D distance)
            let validPoint = true;
            for (const existing of points) {
                const dx = candidate[0] - existing[0];
                const dy = candidate[1] - existing[1];
                const dz = candidate[2] - existing[2];
                const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                
                if (dist < minDist) {
                    validPoint = false;
                    break;
                }
            }
            
            if (validPoint) {
                points.push(candidate);
                placed = true;
                break;
            }
        }
        
        // If we can't place a point, reduce minDistance slightly
        if (!placed) {
            minDist *= 0.95;
        }
    }
    
    return points;
}

// --- Clear existing visualization ---
function clearVisualization() {
    // Remove points
    visualizationObjects.points.forEach(point => scene.remove(point));
    visualizationObjects.points = [];
    
    // Remove Delaunay lines
    if (visualizationObjects.delaunayLines) {
        scene.remove(visualizationObjects.delaunayLines);
        visualizationObjects.delaunayLines = null;
    }
    
    // Remove Delaunay faces
    if (visualizationObjects.delaunayFaces) {
        scene.remove(visualizationObjects.delaunayFaces);
        visualizationObjects.delaunayFaces = null;
    }
    
    // Remove Voronoi vertices
    visualizationObjects.voronoiVertices.forEach(vertex => scene.remove(vertex));
    visualizationObjects.voronoiVertices = [];
    
    // Remove Voronoi lines
    if (visualizationObjects.voronoiLines) {
        scene.remove(visualizationObjects.voronoiLines);
        visualizationObjects.voronoiLines = null;
    }
    
    // Remove Voronoi faces
    if (visualizationObjects.voronoiFaces) {
        visualizationObjects.voronoiFaces.forEach(faceMesh => scene.remove(faceMesh));
        visualizationObjects.voronoiFaces = [];
    }
}

// --- Update materials with current settings ---
function updateMaterials() {
    pointsMaterial.color.setHex(parseInt(appearanceSettings.pointColor.replace('#', ''), 16));
    delaunayMaterial.color.setHex(parseInt(appearanceSettings.delaunayColor.replace('#', ''), 16));
    delaunayFaceMaterial.color.setHex(parseInt(appearanceSettings.delaunayFaceColor.replace('#', ''), 16));
    delaunayFaceMaterial.opacity = appearanceSettings.delaunayFaceOpacity;
    voronoiMaterial.color.setHex(parseInt(appearanceSettings.voronoiColor.replace('#', ''), 16));
    voronoiFaceMaterial.color.setHex(parseInt(appearanceSettings.voronoiFaceColor.replace('#', ''), 16));
    voronoiFaceMaterial.opacity = appearanceSettings.voronoiFaceOpacity;
    voronoiVertexMaterial.color.setHex(parseInt(appearanceSettings.voronoiVertexColor.replace('#', ''), 16));
    
    // Update geometries if sizes changed
    const newPointSize = appearanceSettings.pointSize;
    const newVoronoiVertexSize = appearanceSettings.voronoiVertexSize;
    
    if (pointsGeometry.parameters.radius !== newPointSize) {
        pointsGeometry.dispose();
        pointsGeometry = new THREE.SphereGeometry(newPointSize, 16, 16);
    }
    
    if (voronoiVertexGeometry.parameters.radius !== newVoronoiVertexSize) {
        voronoiVertexGeometry.dispose();
        voronoiVertexGeometry = new THREE.SphereGeometry(newVoronoiVertexSize, 8, 8);
    }
    
    // Update background
    scene.background.setHex(parseInt(appearanceSettings.backgroundColor.replace('#', ''), 16));
}

// --- Update visibility ---
function updateVisibility() {
    // Update points visibility
    visualizationObjects.points.forEach(point => {
        point.visible = appearanceSettings.showPoints;
    });
    
    // Update Delaunay visibility
    if (visualizationObjects.delaunayLines) {
        visualizationObjects.delaunayLines.visible = appearanceSettings.showDelaunay;
    }
    
    // Update Delaunay faces visibility
    if (visualizationObjects.delaunayFaces) {
        visualizationObjects.delaunayFaces.visible = appearanceSettings.showDelaunayFaces;
    }
    
    // Update Voronoi vertices visibility
    visualizationObjects.voronoiVertices.forEach(vertex => {
        vertex.visible = appearanceSettings.showVoronoiVertices;
    });
    
    // Update Voronoi lines visibility
    if (visualizationObjects.voronoiLines) {
        visualizationObjects.voronoiLines.visible = appearanceSettings.showVoronoi;
    }
    
    // Update Voronoi faces visibility
    if (visualizationObjects.voronoiFaces) {
        visualizationObjects.voronoiFaces.forEach(faceMesh => {
            faceMesh.visible = appearanceSettings.showVoronoiFaces;
        });
    }
}

// --- Generate and visualize mesh ---
function generateVisualization() {
    console.log(`🎯 Generating ${currentNumPoints} points in 3D ${currentMode} mode...`);
    
    // Clear existing visualization
    clearVisualization();
    
    // Reset minDistance for new generation
    minDistance = 0.8;
    
    // Generate points
    const pointsArray = generatePoissonPoints(currentNumPoints, boundingBoxSize, minDistance);
    
    console.log(`✅ Generated ${pointsArray.length} 3D Poisson-distributed points.`);

    // Compute mesh with explicit dimension
    currentMesh = new DelaunayMesh(pointsArray);
    currentMesh.computeDelaunay();
    
    // Check if triangulation succeeded
    const hasValidStructure = currentMesh.tetrahedra.length > 0;
        
    if (!hasValidStructure) {
        console.error(`❌ Cannot proceed with visualization - no valid tetrahedra generated.`);
        return;
    }
    
    currentMesh.buildAdjacency();
    
    // Choose computation method based on mode
    if (currentMode === 'barycenter') {
        currentMesh.computeVoronoiBarycenters();
    } else {
        currentMesh.computeVoronoi();
    }

    // Update materials before creating objects
    updateMaterials();

    // Visualize points
    console.log(`🔍 Visualizing ${currentMesh.points.length} points in 3D mode...`);
    
    for (const point of currentMesh.points) {
        const pointMesh = new THREE.Mesh(pointsGeometry, pointsMaterial);
        pointMesh.position.copy(point);
        scene.add(pointMesh);
        visualizationObjects.points.push(pointMesh);
    }
    
    if (currentMesh.dimension === 2) {
        console.log(`🔍 First 3 point positions:`, 
            currentMesh.points.slice(0, 3).map(p => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`));
    }

    // Visualize Delaunay edges
    const delaunayEdges = currentMesh.getUniqueEdges();
    const delaunayLines = [];

    for (const edgeString of delaunayEdges) {
        const [i, j] = edgeString.split('-').map(Number);
        const p1 = currentMesh.points[i];
        const p2 = currentMesh.points[j];
        
        if (p1 && p2) {
    delaunayLines.push(p1, p2);
        }
}

const delaunayGeometry = new THREE.BufferGeometry().setFromPoints(delaunayLines);
    visualizationObjects.delaunayLines = new THREE.LineSegments(delaunayGeometry, delaunayMaterial);
    scene.add(visualizationObjects.delaunayLines);

    // Visualize Delaunay Faces (Tetrahedral faces for 3D)
    const delaunayFaces = [];
    const delaunayIndices = [];
    let vertexIndex = 0;

    // For 3D: render all faces of all tetrahedra
    for (const tetra of currentMesh.tetrahedra) {
        const p0 = currentMesh.points[tetra[0]];
        const p1 = currentMesh.points[tetra[1]];
        const p2 = currentMesh.points[tetra[2]];
        const p3 = currentMesh.points[tetra[3]];
        
        // Add vertices for the 4 triangular faces of the tetrahedron
        delaunayFaces.push(p0, p1, p2); // Face 1
        delaunayIndices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
        vertexIndex += 3;
        
        delaunayFaces.push(p0, p1, p3); // Face 2
        delaunayIndices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
        vertexIndex += 3;
        
        delaunayFaces.push(p0, p2, p3); // Face 3
        delaunayIndices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
        vertexIndex += 3;
        
        delaunayFaces.push(p1, p2, p3); // Face 4
        delaunayIndices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
        vertexIndex += 3;
    }
    console.log(`🔍 Rendered ${currentMesh.tetrahedra.length * 4} tetrahedral faces for 3D mode.`);

    const delaunayFaceGeometry = new THREE.BufferGeometry().setFromPoints(delaunayFaces);
    delaunayFaceGeometry.setIndex(delaunayIndices);
    delaunayFaceGeometry.computeVertexNormals();
    visualizationObjects.delaunayFaces = new THREE.Mesh(delaunayFaceGeometry, delaunayFaceMaterial);
    scene.add(visualizationObjects.delaunayFaces);

    // Visualize Voronoi/Barycenter vertices
    for (const v of currentMesh.voronoiVertices) {
    if (v) {
        const vertexMesh = new THREE.Mesh(voronoiVertexGeometry, voronoiVertexMaterial);
        vertexMesh.position.copy(v);
        scene.add(vertexMesh);
            visualizationObjects.voronoiVertices.push(vertexMesh);
    }
}

    // Visualize Voronoi/Barycenter edges
const voronoiLines = [];
    
    for (const edge of currentMesh.voronoiEdges) {
    voronoiLines.push(edge[0], edge[1]);
}
    
const voronoiGeometry = new THREE.BufferGeometry().setFromPoints(voronoiLines);
    visualizationObjects.voronoiLines = new THREE.LineSegments(voronoiGeometry, voronoiMaterial);
    scene.add(visualizationObjects.voronoiLines);

    // Compute and Visualize Mathematically Correct Voronoi Faces (3D only for now)
    const voronoiFaceMeshes = [];
    
    currentMesh.computeVoronoiFaces();

    console.log(`🔍 Rendering ${currentMesh.voronoiFaces.length} Voronoi faces...`);
    
    for (let faceIndex = 0; faceIndex < currentMesh.voronoiFaces.length; faceIndex++) {
        const face = currentMesh.voronoiFaces[faceIndex];
        if (face.length < 3) continue;

        // Calculate face centroid for triangle fan triangulation
        const centroid = new THREE.Vector3();
        face.forEach(vertex => centroid.add(vertex));
        centroid.divideScalar(face.length);
        
        // Create triangle fan from centroid to each edge
        for (let i = 0; i < face.length; i++) {
            const v1 = face[i];
            const v2 = face[(i + 1) % face.length];
            
            // Skip degenerate triangles
            const area = new THREE.Vector3().subVectors(v1, centroid)
                .cross(new THREE.Vector3().subVectors(v2, centroid)).length();
            if (area < 1e-10) continue;
            
            // Create triangle: centroid -> v1 -> v2
            const triangleGeometry = new THREE.BufferGeometry();
            triangleGeometry.setFromPoints([centroid, v1, v2]);
            triangleGeometry.computeVertexNormals();
            
            const triangleMesh = new THREE.Mesh(triangleGeometry, voronoiFaceMaterial);
            scene.add(triangleMesh);
            voronoiFaceMeshes.push(triangleMesh);
        }
    }
    
    // Store all Voronoi face meshes for visibility control
    visualizationObjects.voronoiFaces = voronoiFaceMeshes;

    // Apply visibility settings
    updateVisibility();
    
    // Auto-position camera
    positionCameraFor3D();
    
    // Update stats
    updateStats();
    
    console.log(`🎉 ${currentMode} 3D visualization complete!`);
}

// --- Update visualization without regenerating points ---
function updateVisualization() {
    if (!currentMesh) return;
    
    // Update materials
    updateMaterials();
    
    // Update all existing objects with new materials and geometries
    visualizationObjects.points.forEach(point => {
        point.material = pointsMaterial;
        point.geometry = pointsGeometry;
    });
    
    if (visualizationObjects.delaunayLines) {
        visualizationObjects.delaunayLines.material = delaunayMaterial;
    }
    
    if (visualizationObjects.delaunayFaces) {
        visualizationObjects.delaunayFaces.material = delaunayFaceMaterial;
    }
    
    visualizationObjects.voronoiVertices.forEach(vertex => {
        vertex.material = voronoiVertexMaterial;
        vertex.geometry = voronoiVertexGeometry;
    });
    
    if (visualizationObjects.voronoiLines) {
        visualizationObjects.voronoiLines.material = voronoiMaterial;
    }
    
    if (visualizationObjects.voronoiFaces) {
        visualizationObjects.voronoiFaces.forEach(faceMesh => {
            faceMesh.material = voronoiFaceMaterial;
        });
    }
    
    // Apply visibility
    updateVisibility();
}

// --- Update statistics display ---
function updateStats() {
    if (!currentMesh) return;
    
    const statsContent = document.getElementById('statsContent');
    const stats = [
        `📏 Dimension: 3D`,
        `📍 Points: ${currentMesh.points.length}`,
        `🔺 Tetrahedra: ${currentMesh.tetrahedra.length}`,
        `💎 ${currentMode === 'barycenter' ? 'Barycenters' : 'Circumcenters'}: ${currentMesh.voronoiVertices.length}`,
        `🔗 Cellular Edges: ${currentMesh.voronoiEdges.length}`,
        `📐 Delaunay Edges: ${currentMesh.getUniqueEdges().size}`,
        `📊 Voronoi Faces: ${currentMesh.voronoiFaces ? currentMesh.voronoiFaces.length : 0}`,
        `📊 Adjacency: ${currentMesh.adjacency.size}`
    ];
    
    statsContent.innerHTML = stats.join('<br>');
}

// --- Control Panel Event Listeners ---
function setupControls() {
    const pointSlider = document.getElementById('pointSlider');
    const pointInput = document.getElementById('pointInput');
    const regenerateBtn = document.getElementById('regenerateBtn');
    const modeButtons = document.querySelectorAll('.mode-btn');
    
    // Panel hide/show
    const controlPanel = document.getElementById('controlPanel');
    const hideBtn = document.getElementById('hideBtn');
    const showBtn = document.getElementById('showBtn');
    
    hideBtn.addEventListener('click', () => {
        controlPanel.classList.add('hidden');
        showBtn.style.display = 'block';
    });
    
    showBtn.addEventListener('click', () => {
        controlPanel.classList.remove('hidden');
        showBtn.style.display = 'none';
    });

    // Point count controls
    pointSlider.addEventListener('input', (e) => {
        currentNumPoints = parseInt(e.target.value);
        pointInput.value = currentNumPoints;
    });
    
    pointInput.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        if (value >= 8 && value <= 1000) {
            currentNumPoints = value;
            pointSlider.value = Math.min(value, 200); // Slider max is 200
        }
    });

    // Regenerate button
    regenerateBtn.addEventListener('click', () => {
        generateVisualization();
    });

    // Mode toggle buttons
    modeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newMode = e.target.dataset.mode;
            
            if (newMode && newMode !== currentMode) {
                currentMode = newMode;
                
                // Update button states for mode buttons
                document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Regenerate with new mode
                generateVisualization();
            }
        });
    });
    
    // Visibility checkboxes
    const showPoints = document.getElementById('showPoints');
    const showDelaunay = document.getElementById('showDelaunay');
    const showDelaunayFaces = document.getElementById('showDelaunayFaces');
    const showVoronoi = document.getElementById('showVoronoi');
    const showVoronoiFaces = document.getElementById('showVoronoiFaces');
    const showVoronoiVertices = document.getElementById('showVoronoiVertices');
    
    showPoints.addEventListener('change', (e) => {
        appearanceSettings.showPoints = e.target.checked;
        updateVisibility();
    });
    
    showDelaunay.addEventListener('change', (e) => {
        appearanceSettings.showDelaunay = e.target.checked;
        updateVisibility();
    });
    
    showDelaunayFaces.addEventListener('change', (e) => {
        appearanceSettings.showDelaunayFaces = e.target.checked;
        updateVisibility();
    });
    
    showVoronoi.addEventListener('change', (e) => {
        appearanceSettings.showVoronoi = e.target.checked;
        updateVisibility();
    });
    
    showVoronoiFaces.addEventListener('change', (e) => {
        appearanceSettings.showVoronoiFaces = e.target.checked;
        updateVisibility();
    });
    
    showVoronoiVertices.addEventListener('change', (e) => {
        appearanceSettings.showVoronoiVertices = e.target.checked;
        updateVisibility();
    });
    
    // Appearance controls
    const bgColor = document.getElementById('bgColor');
    const pointSize = document.getElementById('pointSize');
    const pointSizeValue = document.getElementById('pointSizeValue');
    const pointColor = document.getElementById('pointColor');
    const delaunayColor = document.getElementById('delaunayColor');
    const voronoiColor = document.getElementById('voronoiColor');
    const voronoiVertexColor = document.getElementById('voronoiVertexColor');
    const voronoiVertexSize = document.getElementById('voronoiVertexSize');
    const voronoiVertexSizeValue = document.getElementById('voronoiVertexSizeValue');
    
    bgColor.addEventListener('input', (e) => {
        appearanceSettings.backgroundColor = e.target.value;
        updateVisualization();
    });
    
    pointSize.addEventListener('input', (e) => {
        appearanceSettings.pointSize = parseFloat(e.target.value);
        pointSizeValue.textContent = e.target.value;
        updateVisualization();
    });
    
    pointColor.addEventListener('input', (e) => {
        appearanceSettings.pointColor = e.target.value;
        updateVisualization();
    });
    
    delaunayColor.addEventListener('input', (e) => {
        appearanceSettings.delaunayColor = e.target.value;
        updateVisualization();
    });
    
    voronoiColor.addEventListener('input', (e) => {
        appearanceSettings.voronoiColor = e.target.value;
        updateVisualization();
    });
    
    voronoiVertexColor.addEventListener('input', (e) => {
        appearanceSettings.voronoiVertexColor = e.target.value;
        updateVisualization();
    });
    
    voronoiVertexSize.addEventListener('input', (e) => {
        appearanceSettings.voronoiVertexSize = parseFloat(e.target.value);
        voronoiVertexSizeValue.textContent = e.target.value;
        updateVisualization();
    });
    
    // Face appearance controls
    const delaunayFaceColor = document.getElementById('delaunayFaceColor');
    const delaunayFaceOpacity = document.getElementById('delaunayFaceOpacity');
    const delaunayFaceOpacityValue = document.getElementById('delaunayFaceOpacityValue');
    const voronoiFaceColor = document.getElementById('voronoiFaceColor');
    const voronoiFaceOpacity = document.getElementById('voronoiFaceOpacity');
    const voronoiFaceOpacityValue = document.getElementById('voronoiFaceOpacityValue');
    
    delaunayFaceColor.addEventListener('input', (e) => {
        appearanceSettings.delaunayFaceColor = e.target.value;
        updateVisualization();
    });
    
    delaunayFaceOpacity.addEventListener('input', (e) => {
        appearanceSettings.delaunayFaceOpacity = parseFloat(e.target.value);
        delaunayFaceOpacityValue.textContent = e.target.value;
        updateVisualization();
    });
    
    voronoiFaceColor.addEventListener('input', (e) => {
        appearanceSettings.voronoiFaceColor = e.target.value;
        updateVisualization();
    });
    
    voronoiFaceOpacity.addEventListener('input', (e) => {
        appearanceSettings.voronoiFaceOpacity = parseFloat(e.target.value);
        voronoiFaceOpacityValue.textContent = e.target.value;
        updateVisualization();
    });
}

// --- Camera positioning for 3D mode ---
function positionCameraFor3D() {
    console.log("📹 Positioning camera for 3D view...");
    
    // Position camera at a good 3D viewing angle
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    
    // Update controls target
    controls.target.set(0, 0, 0);
    controls.update();
    
    console.log("✅ Camera positioned for 3D mode");
}

// --- Window resize handler ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onWindowResize);

// --- Animation loop ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// --- Initialize ---
function init() {
    setupControls();
    generateVisualization();
animate(); 
}

// Start the application
init(); 