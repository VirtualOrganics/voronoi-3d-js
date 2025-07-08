import { delaunay } from '@derschmale/tympanum';  // For 3D triangulation
import * as THREE from 'three';
import { getTetraCircumcenter, verifyCircumcenter, getTetraBarycenter, sortVerticesCyclically, getTriangleCircumcenter, getTriangleBarycenter } from './geometryUtils.js';

export class DelaunayMesh {
    /**
     * @param {Array<[number, number, number]>} points - An array of 3D points.
     * @param {Object} options - Configuration options
     * @param {boolean} options.periodicBoundaries - Whether to use periodic boundary conditions
     * @param {THREE.Vector3} options.boundingBoxMin - Minimum corner of bounding box for periodic boundaries
     * @param {THREE.Vector3} options.boundingBoxMax - Maximum corner of bounding box for periodic boundaries
     */
    constructor(points, options = {}) {
        // Ensure points are THREE.Vector3 for consistency in calculations
        this.points = points.map(p => new THREE.Vector3(p[0], p[1], p[2])); 
        this.originalPoints = points;
        
        // Periodic boundary settings
        this.periodicBoundaries = options.periodicBoundaries || false;
        this.boundingBoxMin = options.boundingBoxMin || new THREE.Vector3(-1, -1, -1);
        this.boundingBoxMax = options.boundingBoxMax || new THREE.Vector3(1, 1, 1);
        this.boundingBoxSize = new THREE.Vector3().subVectors(this.boundingBoxMax, this.boundingBoxMin);
        
        this.tetrahedra = [];
        this.voronoiVertices = [];
        this.voronoiEdges = [];
        this.voronoiFaces = [];
        this.adjacency = new Map();
    }

    /**
     * Wraps a point to the periodic domain
     * @param {THREE.Vector3} point - Point to wrap
     * @returns {THREE.Vector3} Wrapped point
     */
    wrapPoint(point) {
        if (!this.periodicBoundaries) return point.clone();
        
        const wrapped = point.clone();
        for (let i = 0; i < 3; i++) {
            while (wrapped.getComponent(i) < this.boundingBoxMin.getComponent(i)) {
                wrapped.setComponent(i, wrapped.getComponent(i) + this.boundingBoxSize.getComponent(i));
            }
            while (wrapped.getComponent(i) >= this.boundingBoxMax.getComponent(i)) {
                wrapped.setComponent(i, wrapped.getComponent(i) - this.boundingBoxSize.getComponent(i));
            }
        }
        return wrapped;
    }

    /**
     * Gets the minimum image distance between two points considering periodic boundaries
     * @param {THREE.Vector3} p1 - First point
     * @param {THREE.Vector3} p2 - Second point
     * @returns {THREE.Vector3} Minimum image vector from p1 to p2
     */
    getMinimumImageVector(p1, p2) {
        if (!this.periodicBoundaries) return new THREE.Vector3().subVectors(p2, p1);
        
        const delta = new THREE.Vector3().subVectors(p2, p1);
        for (let i = 0; i < 3; i++) {
            while (delta.getComponent(i) > this.boundingBoxSize.getComponent(i) * 0.5) {
                delta.setComponent(i, delta.getComponent(i) - this.boundingBoxSize.getComponent(i));
            }
            while (delta.getComponent(i) <= -this.boundingBoxSize.getComponent(i) * 0.5) {
                delta.setComponent(i, delta.getComponent(i) + this.boundingBoxSize.getComponent(i));
            }
        }
        return delta;
    }

    /**
     * Computes the 3D Delaunay tetrahedralization.
     */
    computeDelaunay() {
        console.log("🎯 Using Tympanum for 3D tetrahedralization...");
        
        let pointsToProcess = this.originalPoints;
        
        // If using periodic boundaries, add ghost points
        if (this.periodicBoundaries) {
            console.log("Adding ghost points for periodic boundaries...");
            pointsToProcess = this.addGhostPoints(this.originalPoints);
        }
        
        // Compute the Delaunay tetrahedralization using Tympanum
        const result = delaunay(pointsToProcess);
        
        // Check if result is valid
        if (!result || !Array.isArray(result)) {
            console.error('ERROR: delaunay() returned invalid result');
            return;
        }
        
        // Convert facets to tetrahedra (index arrays)
        this.tetrahedra = result.map((facet, index) => {
            if (!facet.verts) {
                console.error('Facet has no verts:', facet);
                return null;
            }
            
            return facet.verts.map(v => {
                // Try different possible properties for the vertex index
                if (v.id !== undefined) return v.id;
                if (v.index !== undefined) return v.index;
                if (v.i !== undefined) return v.i;
                if (typeof v === 'number') return v;
                
                console.error('Cannot find vertex index in:', v);
                return null;
            }).filter(id => id !== null);
        }).filter(t => t !== null && t.length === 4);
        
        if (this.tetrahedra.length === 0) {
            console.error(`❌ 3D Delaunay triangulation failed! No tetrahedra generated.`);
            console.log(`   This often happens when points are coplanar.`);
            console.log(`   Point Z-coordinates:`, this.points.slice(0, 10).map(p => p.z.toFixed(3)));
            return;
        }
        
        // If using periodic boundaries, filter out tetrahedra with ghost points
        if (this.periodicBoundaries) {
            const numOriginalPoints = this.originalPoints.length;
            this.tetrahedra = this.tetrahedra.filter(tetra => 
                tetra.every(idx => idx < numOriginalPoints)
            );
        }
        
        console.log(`✅ 3D Delaunay computation complete. Found ${this.tetrahedra.length} tetrahedra.`);
        
        // Validate tetrahedra indices
        const maxIndex = Math.max(...this.tetrahedra.flat());
        if (maxIndex >= this.points.length) {
            console.error(`ERROR: Tetrahedra contain invalid indices. Max index: ${maxIndex}, Points: ${this.points.length}`);
        }
    }

    /**
     * Adds ghost points for periodic boundary conditions
     * @param {Array} originalPoints - Original input points
     * @returns {Array} Extended array including ghost points
     * @private
     */
    addGhostPoints(originalPoints) {
        const ghostPoints = [];
        const offsets = [
            [-1, -1, -1], [-1, -1, 0], [-1, -1, 1],
            [-1, 0, -1],  [-1, 0, 0],  [-1, 0, 1],
            [-1, 1, -1],  [-1, 1, 0],  [-1, 1, 1],
            [0, -1, -1],  [0, -1, 0],  [0, -1, 1],
            [0, 0, -1],                [0, 0, 1],
            [0, 1, -1],   [0, 1, 0],   [0, 1, 1],
            [1, -1, -1],  [1, -1, 0],  [1, -1, 1],
            [1, 0, -1],   [1, 0, 0],   [1, 0, 1],
            [1, 1, -1],   [1, 1, 0],   [1, 1, 1]
        ];

        // Add ghost points in neighboring periodic cells
        for (const point of originalPoints) {
            for (const offset of offsets) {
                const ghostPoint = [
                    point[0] + offset[0] * this.boundingBoxSize.x,
                    point[1] + offset[1] * this.boundingBoxSize.y,
                    point[2] + offset[2] * this.boundingBoxSize.z
                ];
                ghostPoints.push(ghostPoint);
            }
        }

        return [...originalPoints, ...ghostPoints];
    }

    /**
     * Extracts all unique edges from the tetrahedra.
     * An edge is a pair of point indices [i, j].
     * @returns {Set<string>} A set of unique edges, stored as sorted strings 'i-j'.
     */
    getUniqueEdges() {
        const uniqueEdges = new Set();
        
        for (const tetra of this.tetrahedra) {
            // Edges of a tetrahedron
            const edges = [
                [tetra[0], tetra[1]],
                [tetra[0], tetra[2]],
                [tetra[0], tetra[3]],
                [tetra[1], tetra[2]],
                [tetra[1], tetra[3]],
                [tetra[2], tetra[3]],
            ];

            for (const edge of edges) {
                // Sort indices to ensure uniqueness (e.g., edge 1-5 is the same as 5-1)
                const sortedEdge = edge.sort((a, b) => a - b);
                uniqueEdges.add(`${sortedEdge[0]}-${sortedEdge[1]}`);
            }
        }
        
        return uniqueEdges;
    }

    /**
     * Builds a map from each triangular face to the tetrahedra that share it.
     * This is crucial for finding adjacent tetrahedra.
     */
    buildAdjacency() {
        this.adjacency.clear();

        this.tetrahedra.forEach((tetra, tetraIndex) => {
            // Get the 4 faces of the tetrahedron
            const faces = [
                [tetra[0], tetra[1], tetra[2]],
                [tetra[0], tetra[1], tetra[3]],
                [tetra[0], tetra[2], tetra[3]],
                [tetra[1], tetra[2], tetra[3]],
            ];

            for (const face of faces) {
                // Sort the indices to create a canonical key for the face
                const key = face.sort((a, b) => a - b).join('-');

                if (!this.adjacency.has(key)) {
                    this.adjacency.set(key, []);
                }
                this.adjacency.get(key).push(tetraIndex);
            }
        });
        console.log(`Built 3D adjacency map. Found ${this.adjacency.size} unique faces.`);
    }

    /**
     * Computes the Voronoi vertices (circumcenters) and edges.
     * Must be called after computeDelaunay() and buildAdjacency().
     */
    computeVoronoi() {
        // 1. Compute Voronoi vertices (circumcenters of each tetra)
        this.voronoiVertices = this.tetrahedra.map(tetra => {
            const p1 = this.points[tetra[0]];
            const p2 = this.points[tetra[1]];
            const p3 = this.points[tetra[2]];
            const p4 = this.points[tetra[3]];

            // If using periodic boundaries, use minimum image vectors
            if (this.periodicBoundaries) {
                // Use p1 as reference and get minimum image vectors to other points
                const v2 = new THREE.Vector3().addVectors(p1, this.getMinimumImageVector(p1, p2));
                const v3 = new THREE.Vector3().addVectors(p1, this.getMinimumImageVector(p1, p3));
                const v4 = new THREE.Vector3().addVectors(p1, this.getMinimumImageVector(p1, p4));
                const center = getTetraCircumcenter(p1, v2, v3, v4);
                return this.wrapPoint(center);
            } else {
                return getTetraCircumcenter(p1, p2, p3, p4);
            }
        }).filter(v => v !== null); // Filter out any nulls from coplanar points

        console.log(`Computed ${this.voronoiVertices.length} Voronoi vertices.`);

        // 2. Compute Voronoi edges by connecting circumcenters of adjacent tetras
        this.voronoiEdges = [];
        for (const [faceKey, tetraIndices] of this.adjacency.entries()) {
            // A Voronoi edge exists if two tetrahedra share a face (it's an internal face)
            if (tetraIndices.length === 2) {
                const t1_index = tetraIndices[0];
                const t2_index = tetraIndices[1];
                
                const v1 = this.voronoiVertices[t1_index];
                const v2 = this.voronoiVertices[t2_index];

                // Ensure both vertices were computed successfully
                if (v1 && v2) {
                    if (this.periodicBoundaries) {
                        // Use minimum image convention for edge vector
                        const v2_wrapped = new THREE.Vector3().addVectors(
                            v1, 
                            this.getMinimumImageVector(v1, v2)
                        );
                        this.voronoiEdges.push([v1, v2_wrapped]);
                    } else {
                        this.voronoiEdges.push([v1, v2]);
                    }
                }
            }
        }
        console.log(`Computed ${this.voronoiEdges.length} Voronoi edges.`);
    }

    /**
     * Computes Voronoi-like structure using barycenters instead of circumcenters.
     * Barycenters always lie inside tetrahedra, creating a clean, bounded visualization.
     * Perfect for physics simulations and clean cellular structures.
     */
    computeVoronoiBarycenters() {
        console.log("🎯 Computing 3D Voronoi structure using tetrahedron barycenters...");
        
        // 1. Compute barycenter vertices (geometric centers of each tetra)
        this.voronoiVertices = this.tetrahedra.map((tetra, tetraIndex) => {
            const p0 = this.points[tetra[0]];
            const p1 = this.points[tetra[1]];
            const p2 = this.points[tetra[2]];
            const p3 = this.points[tetra[3]];
            
            return getTetraBarycenter(p0, p1, p2, p3);
        });

        console.log(`✅ Computed ${this.voronoiVertices.length} 3D barycenter vertices (all bounded within mesh).`);

        // 2. Compute edges by connecting barycenters of adjacent tetras (same logic as before)
        this.voronoiEdges = [];
        for (const [faceKey, tetraIndices] of this.adjacency.entries()) {
            // A Voronoi edge exists if two tetrahedra share a face (it's an internal face)
            if (tetraIndices.length === 2) {
                const t1_index = tetraIndices[0];
                const t2_index = tetraIndices[1];
                
                const v1 = this.voronoiVertices[t1_index];
                const v2 = this.voronoiVertices[t2_index];

                // Barycenters are always valid (never null)
                if (v1 && v2) {
                    this.voronoiEdges.push([v1, v2]);
                }
            }
        }
        console.log(`✅ Computed ${this.voronoiEdges.length} 3D barycenter-based Voronoi edges.`);
        console.log("🎉 3D barycenter-based cellular structure complete!");
    }

    /**
     * Computes mathematically correct Voronoi faces using the Delaunay-Voronoi duality.
     * Each Delaunay edge is dual to a Voronoi face whose vertices are the circumcenters
     * of all tetrahedra that share that edge.
     */
    computeVoronoiFaces() {
        console.log("🎯 Computing 3D mathematically correct Voronoi faces...");
        this.voronoiFaces = [];

        // Step A: Build the Edge -> Tetrahedra mapping
        const edgeToTetraMap = new Map();
        this.tetrahedra.forEach((tetra, tetraIndex) => {
            // Generate the 6 edges of each tetrahedron
            const edges = [
                [tetra[0], tetra[1]], [tetra[0], tetra[2]], [tetra[0], tetra[3]],
                [tetra[1], tetra[2]], [tetra[1], tetra[3]], [tetra[2], tetra[3]]
            ];
            edges.forEach(edge => {
                // Create canonical key (sorted indices)
                const key = edge.sort((a, b) => a - b).join('-');
                if (!edgeToTetraMap.has(key)) {
                    edgeToTetraMap.set(key, []);
                }
                edgeToTetraMap.get(key).push(tetraIndex);
            });
        });

        // Step B: Iterate through Delaunay edges to build Voronoi faces
        let processedEdges = 0;
        for (const [edgeKey, tetraIndices] of edgeToTetraMap.entries()) {
            processedEdges++;
            if (processedEdges % 100 === 0) {
                console.log(`Processing edge ${processedEdges}/${edgeToTetraMap.size}...`);
            }

            // Get the vertices of the Voronoi face (circumcenters of tetrahedra)
            const faceVertices = tetraIndices.map(idx => this.voronoiVertices[idx])
                .filter(v => v !== null);

            if (faceVertices.length >= 3) {
                // Get the edge vector to use as sorting axis
                const [v1, v2] = edgeKey.split('-').map(i => this.points[parseInt(i)]);
                let edgeVector;
                
                if (this.periodicBoundaries) {
                    edgeVector = this.getMinimumImageVector(v1, v2);
                } else {
                    edgeVector = new THREE.Vector3().subVectors(v2, v1);
                }

                // Sort vertices cyclically around the edge
                const sortedVertices = sortVerticesCyclically(faceVertices, edgeVector);

                // For periodic boundaries, ensure face vertices use minimum image convention
                if (this.periodicBoundaries) {
                    const refVertex = sortedVertices[0];
                    for (let i = 1; i < sortedVertices.length; i++) {
                        sortedVertices[i] = new THREE.Vector3().addVectors(
                            refVertex,
                            this.getMinimumImageVector(refVertex, sortedVertices[i])
                        );
                    }
                }

                this.voronoiFaces.push(sortedVertices);
            }
        }

        console.log(`✅ Computed ${this.voronoiFaces.length} Voronoi faces.`);
    }
} 