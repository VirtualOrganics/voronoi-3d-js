import * as THREE from 'three';

/**
 * Calculates the circumcenter of a tetrahedron defined by four points.
 * This implementation solves the linear system derived from the intersection
 * of three perpendicular bisector planes. It is more direct and less
 * prone to matrix format errors than the determinant method.
 *
 * @param {THREE.Vector3} p0, p1, p2, p3 - The four vertices of the tetrahedron.
 * @returns {THREE.Vector3 | null} The circumcenter, or null if the points are coplanar.
 */
export function getTetraCircumcenter(p0, p1, p2, p3) {
    // Create vectors from p0 to other points
    const a = new THREE.Vector3().subVectors(p1, p0);
    const b = new THREE.Vector3().subVectors(p2, p0);
    const c = new THREE.Vector3().subVectors(p3, p0);

    // Create the matrix A for the linear system
    const A = new THREE.Matrix3().set(
        a.x, a.y, a.z,
        b.x, b.y, b.z,
        c.x, c.y, c.z
    );

    // The determinant of A tells us if the points are coplanar
    const detA = A.determinant();
    if (Math.abs(detA) < 1e-10) {
        return null; // Points are coplanar, no unique circumsphere
    }

    // Create the vector b for the linear system
    const bVec = new THREE.Vector3(
        a.lengthSq() * 0.5,
        b.lengthSq() * 0.5,
        c.lengthSq() * 0.5
    );

    // Solve Ax = x for x, where x is the vector from p0 to the circumcenter
    const xVec = bVec.clone().applyMatrix3(A.invert());

    // The circumcenter is p0 + x
    const circumcenter = new THREE.Vector3().addVectors(p0, xVec);

    return circumcenter;
}

/**
 * Verifies if a point is the correct circumcenter for a given tetrahedron.
 * @param {THREE.Vector3} center - The calculated circumcenter.
 * @param {THREE.Vector3} p0, p1, p2, p3 - The four vertices of the tetrahedron.
 * @param {number} tetraIndex - The index of the tetrahedron for logging.
 * @param {number} tolerance - The allowed difference in distances.
 * @returns {boolean} True if verification passes.
 */
export function verifyCircumcenter(center, p0, p1, p2, p3, tetraIndex, tolerance = 1e-5) {
    if (!center) return false;
    
    const distSq0 = center.distanceToSquared(p0);
    const distSq1 = center.distanceToSquared(p1);
    const distSq2 = center.distanceToSquared(p2);
    const distSq3 = center.distanceToSquared(p3);

    const maxDiff = Math.max(
        Math.abs(distSq0 - distSq1),
        Math.abs(distSq0 - distSq2),
        Math.abs(distSq0 - distSq3)
    );

    if (maxDiff > tolerance) {
        console.warn(
            `🔴 Circumcenter verification FAILED for tetra ${tetraIndex}. Max distance diff: ${maxDiff}`,
            { center, p0, p1, p2, p3 }
        );
        return false;
    }
    return true;
}

/**
 * Calculates the barycenter (centroid) of a tetrahedron.
 * The barycenter is the average position of the four vertices.
 * It always lies inside the tetrahedron, making it perfect for bounded visualizations.
 *
 * @param {THREE.Vector3} p0, p1, p2, p3 - The four vertices of the tetrahedron.
 * @returns {THREE.Vector3} The barycenter (geometric center).
 */
export function getTetraBarycenter(p0, p1, p2, p3) {
    const barycenter = new THREE.Vector3();
    
    // Simple average of the four vertices
    barycenter.x = (p0.x + p1.x + p2.x + p3.x) * 0.25;
    barycenter.y = (p0.y + p1.y + p2.y + p3.y) * 0.25;
    barycenter.z = (p0.z + p1.z + p2.z + p3.z) * 0.25;
    
    return barycenter;
}

/**
 * Sorts a list of 3D points cyclically around a given axis vector.
 * This is the key function for correctly ordering Voronoi face vertices.
 * Projects vertices onto a plane perpendicular to the axis and sorts by angle.
 * 
 * @param {THREE.Vector3[]} vertices - The array of vertices to sort.
 * @param {THREE.Vector3} axis - The axis to sort around.
 * @returns {THREE.Vector3[]} The sorted array of vertices.
 */
export function sortVerticesCyclically(vertices, axis) {
    if (vertices.length < 3) return vertices;

    // 1. Find the geometric center of the vertices
    const center = new THREE.Vector3();
    vertices.forEach(v => center.add(v));
    center.divideScalar(vertices.length);

    // 2. Define a coordinate system based on the axis
    const u = new THREE.Vector3().subVectors(vertices[0], center).normalize();
    const v = new THREE.Vector3().crossVectors(axis, u).normalize();
    
    // 3. Project vertices onto the 2D plane defined by u and v, and get their angles
    const verticesWithAngles = vertices.map(vertex => {
        const r = new THREE.Vector3().subVectors(vertex, center);
        const angle = Math.atan2(r.dot(v), r.dot(u));
        return { vertex, angle };
    });
    
    // 4. Sort by angle
    verticesWithAngles.sort((a, b) => a.angle - b.angle);
    
    return verticesWithAngles.map(item => item.vertex);
}

/**
 * Calculates the circumcenter of a 2D triangle.
 * This is much simpler than the 3D tetrahedron case.
 * 
 * @param {Array} p1, p2, p3 - The three vertices of the triangle as [x, y] arrays.
 * @returns {Array | null} The circumcenter as [x, y], or null if points are collinear.
 */
export function getTriangleCircumcenter(p1, p2, p3) {
    // Calculate the determinant to check for collinearity
    const D = 2 * (p1[0] * (p2[1] - p3[1]) + p2[0] * (p3[1] - p1[1]) + p3[0] * (p1[1] - p2[1]));
    
    if (Math.abs(D) < 1e-10) {
        return null; // Points are collinear
    }

    // Calculate squared magnitudes
    const p1sq = p1[0] * p1[0] + p1[1] * p1[1];
    const p2sq = p2[0] * p2[0] + p2[1] * p2[1];
    const p3sq = p3[0] * p3[0] + p3[1] * p3[1];

    // Calculate circumcenter coordinates
    const Ux = (1 / D) * (p1sq * (p2[1] - p3[1]) + p2sq * (p3[1] - p1[1]) + p3sq * (p1[1] - p2[1]));
    const Uy = (1 / D) * (p1sq * (p3[0] - p2[0]) + p2sq * (p1[0] - p3[0]) + p3sq * (p2[0] - p1[0]));

    return [Ux, Uy];
}

/**
 * Calculates the barycenter (centroid) of a 2D triangle.
 * Simple average of the three vertices.
 * 
 * @param {Array} p1, p2, p3 - The three vertices of the triangle as [x, y] arrays.
 * @returns {Array} The barycenter as [x, y].
 */
export function getTriangleBarycenter(p1, p2, p3) {
    return [
        (p1[0] + p2[0] + p3[0]) / 3,
        (p1[1] + p2[1] + p3[1]) / 3
    ];
} 