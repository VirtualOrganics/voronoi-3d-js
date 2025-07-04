import { delaunay } from '@derschmale/tympanum';  // For 3D triangulation
import Delaunator from 'delaunator';                  // For 2D triangulation
import * as THREE from 'three';
import { getTetraCircumcenter, verifyCircumcenter, getTetraBarycenter, sortVerticesCyclically, getTriangleCircumcenter, getTriangleBarycenter } from './geometryUtils.js';

export class DelaunayMesh {
    /**
     * @param {Array<[number, number, number]>} points - An array of 3D points.
     */
    constructor(points) {
        // Ensure points are THREE.Vector3 for consistency in calculations
        this.points = points.map(p => new THREE.Vector3(p[0], p[1], p[2] || 0)); 
        this.originalPoints = points;
        
        this.tetrahedra = [];
        this.triangles = []; // Kept for future 2D/3D compatibility if needed
        this.voronoiVertices = [];
        this.voronoiEdges = [];
        this.voronoiFaces = [];
        this.adjacency = new Map();
    }

    /**
     * Computes the Delaunay triangulation based on the dimension.
     */
    computeDelaunay() {
        this._computeDelaunay3D();
    }

    /**
     * Computes 3D Delaunay tetrahedralization using Tympanum.
     */
    _computeDelaunay3D() {
        console.log("🎯 Using Tympanum for 3D tetrahedralization...");
        
        // Prepare points for Tympanum (expects array format: [[x,y,z], [x,y,z], ...])
        const pointsArray = this.originalPoints;
        
        // Compute the Delaunay tetrahedralization using Tympanum
        const result = delaunay(pointsArray);
        
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
            
            // Debug: examine the vertex structure (only for first facet)
            if (index === 0) {
                console.log('First vertex structure confirmed:', Object.keys(facet.verts[0]));
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
        }).filter(t => t !== null && t.length === 4); // Tetrahedra have 4 vertices
        
        if (this.tetrahedra.length === 0) {
            console.error(`❌ 3D Delaunay triangulation failed! No tetrahedra generated.`);
            console.log(`   This often happens when points are coplanar.`);
            console.log(`   Point Z-coordinates:`, this.points.slice(0, 10).map(p => p.z.toFixed(3)));
            return;
        }
        
        console.log(`✅ 3D Delaunay computation complete. Found ${this.tetrahedra.length} tetrahedra.`);
        
        // Validate tetrahedra indices
        const maxIndex = Math.max(...this.tetrahedra.flat());
        if (maxIndex >= this.points.length) {
            console.error(`ERROR: Tetrahedra contain invalid indices. Max index: ${maxIndex}, Points: ${this.points.length}`);
        }
        
        console.log('First 5 tetrahedra:', this.tetrahedra.slice(0, 5));
    }

    /**
     * Extracts all unique edges from the triangles (2D) or tetrahedra (3D).
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
     * Builds a map from each edge (2D) or triangular face (3D) to the triangles/tetrahedra that share it.
     * This is crucial for finding adjacent triangles/tetrahedra.
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
        this._computeVoronoi3D();
    }

    /**
     * Computes 3D Voronoi diagram (circumcenters of tetrahedra).
     */
    _computeVoronoi3D() {
        console.log("🎯 Computing 3D Voronoi diagram using tetrahedron circumcenters...");
        
        let failedVerifications = 0;
        
        // 1. Compute Voronoi vertices (circumcenters of each tetra)
        this.voronoiVertices = this.tetrahedra.map((tetra, tetraIndex) => {
            const p0 = this.points[tetra[0]];
            const p1 = this.points[tetra[1]];
            const p2 = this.points[tetra[2]];
            const p3 = this.points[tetra[3]];
            
            const center = getTetraCircumcenter(p0, p1, p2, p3);

            // --- VERIFICATION STEP ---
            if (!verifyCircumcenter(center, p0, p1, p2, p3, tetraIndex)) {
                failedVerifications++;
                return null; // Return null for failed centers
            }
            
            return center;
        });

        if (failedVerifications > 0) {
            console.error(`🔴 Found ${failedVerifications} tetrahedra that failed circumcenter verification.`);
        } else {
            console.log("✅ All 3D circumcenters passed verification.");
        }
        console.log(`✅ Computed ${this.voronoiVertices.filter(v=>v).length} valid 3D Voronoi vertices.`);

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
                    this.voronoiEdges.push([v1, v2]);
                }
            }
        }
        console.log(`✅ Computed ${this.voronoiEdges.length} 3D Voronoi edges.`);
    }

    /**
     * Computes Voronoi-like structure using barycenters instead of circumcenters.
     * Barycenters always lie inside triangles/tetrahedra, creating a clean, bounded visualization.
     * Perfect for physics simulations and clean cellular structures.
     */
    computeVoronoiBarycenters() {
        this._computeVoronoiBarycenters3D();
    }

    /**
     * Computes 3D barycenter-based Voronoi structure.
     */
    _computeVoronoiBarycenters3D() {
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
     * For 3D: Each Delaunay edge is dual to a Voronoi face whose vertices are the circumcenters
     * of all tetrahedra that share that edge.
     * For 2D: Not implemented yet (complex for 2D Voronoi polygons).
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
            // Only process internal edges that form closed loops (3+ tetrahedra)
            if (tetraIndices.length < 3) continue;

            // 1. Collect the Voronoi vertices (circumcenters) for this face
            const faceVertices = tetraIndices
                .map(tetraIndex => this.voronoiVertices[tetraIndex])
                .filter(v => v); // Filter out any null vertices

            if (faceVertices.length < 3) continue;

            // 2. Define the sorting axis (the Delaunay edge direction)
            const [p_idx, q_idx] = edgeKey.split('-').map(Number);
            const p = new THREE.Vector3().copy(this.points[p_idx]);
            const q = new THREE.Vector3().copy(this.points[q_idx]);
            const axis = new THREE.Vector3().subVectors(q, p);

            // Convert array format vertices to THREE.Vector3 for sorting
            const faceVerticesVec3 = faceVertices.map(v => 
                v instanceof THREE.Vector3 ? v : new THREE.Vector3().copy(v)
            );

            // 3. Sort vertices cyclically around the Delaunay edge
            const sortedVertices = sortVerticesCyclically(faceVerticesVec3, axis);
            
            // Store as array of Vector3 objects for easier Three.js integration
            this.voronoiFaces.push(sortedVertices);
            processedEdges++;
        }

        console.log(`✅ Computed ${this.voronoiFaces.length} mathematically correct 3D Voronoi faces.`);
        console.log("🎉 True 3D Voronoi face computation complete!");
    }
} 