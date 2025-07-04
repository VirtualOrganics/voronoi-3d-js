import { delaunay } from '@derschmale/tympanum';
import { getTetraCircumcenter, getTetraBarycenter } from './geometryUtils.js';

/**
 * A class for computing 3D Delaunay tetrahedralization and dual Voronoi diagrams
 * Framework-agnostic - works with plain JavaScript arrays
 * Now supports both circumcenter and barycenter computation modes
 */
export class DelaunayVoronoi {
    /**
     * Creates a new DelaunayVoronoi instance
     * @param {number[][]} points - Array of points in format [[x,y,z], [x,y,z], ...]
     */
    constructor(points) {
        // Validate input
        if (!points || points.length < 4 || !Array.isArray(points[0])) {
            throw new Error("Input must be an array of at least 4 points, e.g., [[x,y,z], ...]");
        }
        
        if (points[0].length !== 3) {
            throw new Error("Each point must have exactly 3 coordinates [x,y,z]");
        }

        // Store input points as plain arrays
        this.points = points;
        
        // Initialize result arrays
        this.tetrahedra = [];
        this.voronoiVertices = [];
        this.voronoiEdges = [];
        this.adjacency = new Map();
    }

    /**
     * Computes the complete Delaunay tetrahedralization and Voronoi diagram
     * @param {object} options - Computation options
     * @param {'circumcenter' | 'barycenter'} [options.voronoiCenterType='circumcenter'] - The type of center to use for Voronoi vertices
     * @returns {DelaunayVoronoi} Returns this instance for method chaining
     */
    compute(options = {}) {
        const { voronoiCenterType = 'circumcenter' } = options;
        
        this._computeDelaunay();
        this._buildAdjacency();
        this._computeVoronoi(voronoiCenterType);
        
        return this; // Allow method chaining
    }

    /**
     * Computes the 3D Delaunay tetrahedralization using Tympanum
     * @private
     */
    _computeDelaunay() {
        const facets = delaunay(this.points);
        
        // Convert facets to tetrahedra (arrays of point indices)
        this.tetrahedra = facets.map(facet => {
            if (!facet.verts) {
                throw new Error('Invalid facet structure from Delaunay computation');
            }
            return facet.verts.map(v => {
                // Try different possible properties for vertex index
                if (v.id !== undefined) return v.id;
                if (v.index !== undefined) return v.index;
                if (v.i !== undefined) return v.i;
                if (typeof v === 'number') return v;
                throw new Error('Cannot find vertex index in facet vertex');
            });
        }).filter(t => t.length === 4); // Ensure we only have tetrahedra
    }

    /**
     * Builds adjacency map from triangular faces to tetrahedra
     * @private
     */
    _buildAdjacency() {
        this.adjacency.clear();
        
        this.tetrahedra.forEach((tetra, tetraIndex) => {
            // Get the 4 triangular faces of the tetrahedron
            const faces = [
                [tetra[0], tetra[1], tetra[2]],
                [tetra[0], tetra[1], tetra[3]],
                [tetra[0], tetra[2], tetra[3]],
                [tetra[1], tetra[2], tetra[3]],
            ];

            for (const face of faces) {
                // Sort indices to create canonical key for the face
                const key = face.sort((a, b) => a - b).join('-');
                
                if (!this.adjacency.has(key)) {
                    this.adjacency.set(key, []);
                }
                this.adjacency.get(key).push(tetraIndex);
            }
        });
    }

    /**
     * Computes Voronoi vertices and edges using the specified center type
     * @param {string} centerType - Either 'circumcenter' or 'barycenter'
     * @private
     */
    _computeVoronoi(centerType) {
        const centerFunction = centerType === 'barycenter' ? getTetraBarycenter : getTetraCircumcenter;

        // 1. Compute Voronoi vertices using the specified center function
        this.voronoiVertices = this.tetrahedra.map(tetra => {
            const p0 = this.points[tetra[0]];
            const p1 = this.points[tetra[1]];
            const p2 = this.points[tetra[2]];
            const p3 = this.points[tetra[3]];
            return centerFunction(p0, p1, p2, p3);
        });

        // Filter out any nulls that might come from degenerate circumcenter calculations
        const validVoronoiVertices = this.voronoiVertices.map((vertex, index) => ({ vertex, index }))
                                                          .filter(item => item.vertex !== null);
        
        const indexMap = new Map(validVoronoiVertices.map((item, newIndex) => [item.index, newIndex]));

        this.voronoiVertices = validVoronoiVertices.map(item => item.vertex);

        // 2. Compute Voronoi edges by connecting centers of adjacent tetrahedra
        this.voronoiEdges = [];
        for (const tetraIndices of this.adjacency.values()) {
            // A Voronoi edge exists if exactly two tetrahedra share a face
            if (tetraIndices.length === 2) {
                const originalIndex1 = tetraIndices[0];
                const originalIndex2 = tetraIndices[1];
                
                if (indexMap.has(originalIndex1) && indexMap.has(originalIndex2)) {
                    const newIndex1 = indexMap.get(originalIndex1);
                    const newIndex2 = indexMap.get(originalIndex2);
                    this.voronoiEdges.push([this.voronoiVertices[newIndex1], this.voronoiVertices[newIndex2]]);
                }
            }
        }
    }

    /**
     * Gets statistics about the computed structures
     * @returns {object} Object containing counts and information
     */
    getStats() {
        return {
            pointCount: this.points.length,
            tetrahedraCount: this.tetrahedra.length,
            voronoiVertexCount: this.voronoiVertices.length,
            voronoiEdgeCount: this.voronoiEdges.length,
            faceCount: this.adjacency.size,
            hasComputed: this.tetrahedra.length > 0
        };
    }

    /**
     * Extracts unique edges from the Delaunay tetrahedralization
     * @returns {Set<string>} Set of edge keys in format "i-j"
     */
    getDelaunayEdges() {
        const uniqueEdges = new Set();
        
        for (const tetra of this.tetrahedra) {
            // All edges of a tetrahedron
            const edges = [
                [tetra[0], tetra[1]],
                [tetra[0], tetra[2]],
                [tetra[0], tetra[3]],
                [tetra[1], tetra[2]],
                [tetra[1], tetra[3]],
                [tetra[2], tetra[3]],
            ];

            for (const edge of edges) {
                // Sort to ensure uniqueness (edge i-j same as j-i)
                const sortedEdge = edge.sort((a, b) => a - b);
                uniqueEdges.add(`${sortedEdge[0]}-${sortedEdge[1]}`);
            }
        }
        
        return uniqueEdges;
    }
}

// Default export for convenience
export default DelaunayVoronoi; 