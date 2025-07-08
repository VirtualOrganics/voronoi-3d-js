import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { DelaunayMesh } from './DelaunayMesh.js';
// import { DelaunayMesh } from './DelaunayMesh.js';  // Commented out for GPU experiment

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

console.log("🚀 3D Delaunay-Voronoi Visualization Initialized");

// --- Parameters ---
const boundingBoxSize = 5;
let minDistance = 0.8;
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
    showVoronoiVertices: true,
    usePeriodicBoundaries: false
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

// --- Bounding Box for Periodic Boundaries ---
const boundingBoxMin = new THREE.Vector3(-1, -1, -1);
const boundingBoxMax = new THREE.Vector3(1, 1, 1);
const boundingBoxHelper = new THREE.Box3Helper(
    new THREE.Box3(boundingBoxMin, boundingBoxMax),
    new THREE.Color(0x888888)
);
scene.add(boundingBoxHelper);
boundingBoxHelper.visible = false;

// --- Window resize handler ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Animation loop ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// --- Initialization ---
function init() {
    // Set up scene, camera, renderer as usual
    scene.background = new THREE.Color(appearanceSettings.backgroundColor);
    camera.position.set(0, 5, 10);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Add orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Set up GUI
    const gui = new GUI();
    
    // Generation Controls folder
    const generationFolder = gui.addFolder('Generation');
    generationFolder.add({ numPoints: currentNumPoints }, 'numPoints', 8, 200, 1)
        .name('Number of Points')
        .onChange(value => {
            currentNumPoints = value;
            generateVisualization();
        });
    
    // Periodic Boundaries folder (add this BEFORE other folders to make it more visible)
    const periodicFolder = gui.addFolder('Periodic Boundaries');
    periodicFolder.add(appearanceSettings, 'usePeriodicBoundaries')
        .name('Enable Periodic')
        .onChange(() => {
            boundingBoxHelper.visible = appearanceSettings.usePeriodicBoundaries;
            generateVisualization();
        });
    
    // Bounding box controls
    periodicFolder.add(boundingBoxMin, 'x', -5, 0).name('Min X').onChange(updateBoundingBox);
    periodicFolder.add(boundingBoxMin, 'y', -5, 0).name('Min Y').onChange(updateBoundingBox);
    periodicFolder.add(boundingBoxMin, 'z', -5, 0).name('Min Z').onChange(updateBoundingBox);
    periodicFolder.add(boundingBoxMax, 'x', 0, 5).name('Max X').onChange(updateBoundingBox);
    periodicFolder.add(boundingBoxMax, 'y', 0, 5).name('Max Y').onChange(updateBoundingBox);
    periodicFolder.add(boundingBoxMax, 'z', 0, 5).name('Max Z').onChange(updateBoundingBox);
    
    // Visualization folder
    const visualFolder = gui.addFolder('Visualization');
    visualFolder.add(appearanceSettings, 'showPoints').name('Show Points').onChange(updateVisibility);
    visualFolder.add(appearanceSettings, 'showDelaunay').name('Show Delaunay').onChange(updateVisibility);
    visualFolder.add(appearanceSettings, 'showDelaunayFaces').name('Show Delaunay Faces').onChange(updateVisibility);
    visualFolder.add(appearanceSettings, 'showVoronoi').name('Show Voronoi').onChange(updateVisibility);
    visualFolder.add(appearanceSettings, 'showVoronoiFaces').name('Show Voronoi Faces').onChange(updateVisibility);
    visualFolder.add(appearanceSettings, 'showVoronoiVertices').name('Show Voronoi Vertices').onChange(updateVisibility);
    
    // Appearance folder
    const appearanceFolder = gui.addFolder('Appearance');
    appearanceFolder.addColor(appearanceSettings, 'backgroundColor').name('Background').onChange(updateMaterials);
    appearanceFolder.addColor(appearanceSettings, 'pointColor').name('Point Color').onChange(updateMaterials);
    appearanceFolder.add(appearanceSettings, 'pointSize', 0.01, 0.2).name('Point Size').onChange(updateMaterials);
    appearanceFolder.addColor(appearanceSettings, 'delaunayColor').name('Delaunay Color').onChange(updateMaterials);
    appearanceFolder.addColor(appearanceSettings, 'delaunayFaceColor').name('Delaunay Face').onChange(updateMaterials);
    appearanceFolder.add(appearanceSettings, 'delaunayFaceOpacity', 0, 1).name('Delaunay Opacity').onChange(updateMaterials);
    appearanceFolder.addColor(appearanceSettings, 'voronoiColor').name('Voronoi Color').onChange(updateMaterials);
    appearanceFolder.addColor(appearanceSettings, 'voronoiFaceColor').name('Voronoi Face').onChange(updateMaterials);
    appearanceFolder.add(appearanceSettings, 'voronoiFaceOpacity', 0, 1).name('Voronoi Opacity').onChange(updateMaterials);
    appearanceFolder.addColor(appearanceSettings, 'voronoiVertexColor').name('Vertex Color').onChange(updateMaterials);
    appearanceFolder.add(appearanceSettings, 'voronoiVertexSize', 0.01, 0.2).name('Vertex Size').onChange(updateMaterials);
    
    // Open the Periodic Boundaries folder by default
    periodicFolder.open();
    
    // Generate initial visualization
    generateVisualization();
    
    // Start animation loop
    animate();
}

// Function to update bounding box
function updateBoundingBox() {
    boundingBoxHelper.box.set(boundingBoxMin, boundingBoxMax);
    if (appearanceSettings.usePeriodicBoundaries) {
        generateVisualization();
    }
}

// Update the updateDelaunayVoronoi function to handle periodic boundaries
function updateDelaunayVoronoi() {
    // Remove old meshes
    clearVisualization();
    
    // Create new Delaunay mesh with periodic boundary settings
    currentMesh = new DelaunayMesh(generatePoissonPoints(currentNumPoints, boundingBoxSize, minDistance), {
        periodicBoundaries: appearanceSettings.usePeriodicBoundaries,
        boundingBoxMin: boundingBoxMin,
        boundingBoxMax: boundingBoxMax
    });
    
    // Update bounding box visualization
    boundingBoxHelper.visible = appearanceSettings.usePeriodicBoundaries;
    if (appearanceSettings.usePeriodicBoundaries) {
        boundingBoxHelper.box.set(boundingBoxMin, boundingBoxMax);
    }
    
    // Compute Delaunay and Voronoi
    currentMesh.computeDelaunay();
    currentMesh.buildAdjacency();
    currentMesh.computeVoronoi();
    currentMesh.computeVoronoiFaces();
    
    // Create visualization meshes
    generateVisualization();
}

function setupControls() {
    const pointSlider = document.getElementById('pointSlider');
    const pointInput = document.getElementById('pointInput');
    const regenerateBtn = document.getElementById('regenerateBtn');
    const modeButtons = document.querySelectorAll('.mode-btn');
    const periodicBoundariesCheckbox = document.getElementById('periodicBoundaries');
    
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

    // Periodic boundaries control
    periodicBoundariesCheckbox.addEventListener('change', (e) => {
        appearanceSettings.usePeriodicBoundaries = e.target.checked;
        boundingBoxHelper.visible = e.target.checked;
        generateVisualization();
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

// Initialize when DOM is loaded
init();
setupControls(); 