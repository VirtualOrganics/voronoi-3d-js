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