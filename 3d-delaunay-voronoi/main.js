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

console.log("3D Delaunay/Voronoi Engine Initialized");

// --- Generate Sample Data ---
const NUM_POINTS = 50;
const pointsArray = []; // Keep original array for Delaunay library
const boundingBoxSize = 5;

for (let i = 0; i < NUM_POINTS; i++) {
    const x = (Math.random() - 0.5) * boundingBoxSize;
    const y = (Math.random() - 0.5) * boundingBoxSize;
    const z = (Math.random() - 0.5) * boundingBoxSize;
    pointsArray.push([x, y, z]);
}
console.log(`Generated ${pointsArray.length} random points.`);

// --- Compute the Delaunay & Voronoi Structures ---
const delaunayMesh = new DelaunayMesh(pointsArray); // Pass the array
delaunayMesh.computeDelaunay();
delaunayMesh.buildAdjacency(); // New step
delaunayMesh.computeVoronoi(); // New step

// --- Visualization ---

// 1. Visualize the original input points (Delaunay vertices)
const pointsMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red
const pointsGeometry = new THREE.SphereGeometry(0.075, 16, 16); // Small sphere

for (const point of delaunayMesh.points) { // Already Vector3
    const pointMesh = new THREE.Mesh(pointsGeometry, pointsMaterial);
    pointMesh.position.copy(point); // Use copy()
    scene.add(pointMesh);
}
console.log("Visualized input points.");

// 2. Visualize the Delaunay edges
const delaunayEdges = delaunayMesh.getUniqueEdges();
const delaunayLines = [];

const linesMaterial = new THREE.LineBasicMaterial({
    color: 0xaaaaaa, // Grey
    transparent: true,
    opacity: 0.5
});

for (const edgeString of delaunayEdges) {
    const [i, j] = edgeString.split('-').map(Number);
    const p1 = delaunayMesh.points[i];
    const p2 = delaunayMesh.points[j];
    
    // Debug: check if points exist and are valid
    if (!p1 || !p2) {
        console.error(`Invalid edge: ${edgeString}, p1=${p1}, p2=${p2}`);
        continue;
    }
    
    // Points are now Vector3 objects, so we can use them directly
    delaunayLines.push(p1, p2);
}

const delaunayGeometry = new THREE.BufferGeometry().setFromPoints(delaunayLines);
const delaunayLineSegments = new THREE.LineSegments(delaunayGeometry, linesMaterial);
scene.add(delaunayLineSegments);

console.log(`Visualized ${delaunayEdges.size} unique Delaunay edges.`);

// 3. --- VORONOI VISUALIZATION ---

// Visualize Voronoi Vertices (tiny yellow spheres)
const voronoiVertexMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // Yellow
const voronoiVertexGeometry = new THREE.SphereGeometry(0.05, 8, 8);
for (const v of delaunayMesh.voronoiVertices) {
    if (v) {
        const vertexMesh = new THREE.Mesh(voronoiVertexGeometry, voronoiVertexMaterial);
        vertexMesh.position.copy(v);
        scene.add(vertexMesh);
    }
}
console.log("Visualized Voronoi vertices.");

// Visualize Voronoi Edges (bright blue lines)
const voronoiLines = [];
const voronoiMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff }); // Cyan/Blue
for (const edge of delaunayMesh.voronoiEdges) {
    voronoiLines.push(edge[0], edge[1]);
}
const voronoiGeometry = new THREE.BufferGeometry().setFromPoints(voronoiLines);
const voronoiLineSegments = new THREE.LineSegments(voronoiGeometry, voronoiMaterial);
scene.add(voronoiLineSegments);
console.log("Visualized Voronoi edges.");

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    controls.update(); // Update controls each frame
    
    renderer.render(scene, camera);
}

animate(); 