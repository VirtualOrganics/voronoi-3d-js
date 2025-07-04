import { delaunay } from '@derschmale/tympanum';
import * as THREE from 'three';
import { getTetraCircumcenter, verifyCircumcenter, getTetraBarycenter } from './geometryUtils.js';

export class DelaunayMesh {
    constructor(points) {
        // Keep original arrays for Tympanum library
        this.pointsArray = points;
        // Also store as Vector3 for math operations
        this.points = points.map(p => new THREE.Vector3(...p));
        
        // This will store the result: array of tetrahedra
        // Each tetrahedron is an array of 4 point indices, e.g., [[0, 5, 12, 3], ...]
        this.tetrahedra = [];
        
        // Voronoi diagram data
        this.voronoiVertices = []; // Will store circumcenters
        this.voronoiEdges = [];    // Will store connections between circumcenters
        this.adjacency = new Map(); // Map from face to tetrahedra
    }

    /**
     * Computes the 3D Delaunay tetrahedralization using Tympanum.
     */
    computeDelaunay() {
        console.log(`Starting Delaunay computation for ${this.points.length} points...`);
        
        // Compute the Delaunay triangulation using Tympanum (needs array format)
        const result = delaunay(this.pointsArray);
        
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
        }).filter(t => t !== null && t.length === 4);
        
        console.log(`Delaunay computation complete. Found ${this.tetrahedra.length} tetrahedra.`);
        
        // Validate tetrahedra indices
        const maxIndex = Math.max(...this.tetrahedra.flat());
        if (maxIndex >= this.points.length) {
            console.error(`ERROR: Tetrahedra contain invalid indices. Max index: ${maxIndex}, Points: ${this.points.length}`);
        }
        
        console.log('First 5 tetrahedra:', this.tetrahedra.slice(0, 5));
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
     * Builds a map from each triangular face to the one or two tetrahedra that share it.
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
        console.log(`Built adjacency map. Found ${this.adjacency.size} unique faces.`);
    }

    /**
     * Computes the Voronoi vertices (circumcenters) and edges.
     * Must be called after computeDelaunay() and buildAdjacency().
     */
    computeVoronoi() {
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
            console.log("✅ All circumcenters passed verification.");
        }
        console.log(`Computed ${this.voronoiVertices.filter(v=>v).length} valid Voronoi vertices.`);

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
        console.log(`Computed ${this.voronoiEdges.length} Voronoi edges.`);
    }

    /**
     * Computes Voronoi-like structure using barycenters instead of circumcenters.
     * Barycenters always lie inside tetrahedra, creating a clean, bounded visualization.
     * Perfect for physics simulations and clean cellular structures.
     */
    computeVoronoiBarycenters() {
        console.log("🎯 Computing Voronoi structure using barycenters (centroids)...");
        
        // 1. Compute barycenter vertices (geometric centers of each tetra)
        this.voronoiVertices = this.tetrahedra.map((tetra, tetraIndex) => {
            const p0 = this.points[tetra[0]];
            const p1 = this.points[tetra[1]];
            const p2 = this.points[tetra[2]];
            const p3 = this.points[tetra[3]];
            
            return getTetraBarycenter(p0, p1, p2, p3);
        });

        console.log(`✅ Computed ${this.voronoiVertices.length} barycenter vertices (all bounded within mesh).`);

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
        console.log(`✅ Computed ${this.voronoiEdges.length} barycenter-based Voronoi edges.`);
        console.log("🎉 Barycenter-based cellular structure complete!");
    }
} 