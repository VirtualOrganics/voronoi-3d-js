import * as THREE from 'three';

/**
 * Calculates the circumcenter of a tetrahedron defined by four points.
 * The circumcenter is the center of the sphere that passes through all four points.
 *
 * @param {THREE.Vector3} p1 - The first point of the tetrahedron.
 * @param {THREE.Vector3} p2 - The second point of the tetrahedron.
 * @param {THREE.Vector3} p3 - The third point of the tetrahedron.
 * @param {THREE.Vector3} p4 - The fourth point of the tetrahedron.
 * @returns {THREE.Vector3 | null} The circumcenter, or null if the points are coplanar.
 */
export function getTetraCircumcenter(p1, p2, p3, p4) {
    // This implementation uses the formula derived from the intersection of
    // perpendicular bisector planes. It's robust but involves matrix inversion.
    // For more details, see: https://gamedev.stackexchange.com/a/102222
    
    const a = new THREE.Matrix4();
    a.set(
        p1.x, p1.y, p1.z, 1,
        p2.x, p2.y, p2.z, 1,
        p3.x, p3.y, p3.z, 1,
        p4.x, p4.y, p4.z, 1
    );

    const dx = a.clone();
    dx.elements[0] = p1.lengthSq();
    dx.elements[1] = p2.lengthSq();
    dx.elements[2] = p3.lengthSq();
    dx.elements[3] = p4.lengthSq();

    const dy = a.clone();
    dy.elements[4] = p1.lengthSq();
    dy.elements[5] = p2.lengthSq();
    dy.elements[6] = p3.lengthSq();
    dy.elements[7] = p4.lengthSq();

    const dz = a.clone();
    dz.elements[8] = p1.lengthSq();
    dz.elements[9] = p2.lengthSq();
    dz.elements[10] = p3.lengthSq();
    dz.elements[11] = p4.lengthSq();

    const c = a.clone();
    c.elements[12] = p1.lengthSq();
    c.elements[13] = p2.lengthSq();
    c.elements[14] = p3.lengthSq();
    c.elements[15] = p4.lengthSq();

    const detA = a.determinant();

    // If the determinant is near zero, the points are coplanar, and no unique circumsphere exists.
    if (Math.abs(detA) < 1e-10) {
        return null;
    }

    const invDetA = 1.0 / (2.0 * detA);
    
    const centerX = dx.determinant() * invDetA;
    const centerY = -dy.determinant() * invDetA;
    const centerZ = dz.determinant() * invDetA;
    
    return new THREE.Vector3(centerX, centerY, centerZ);
} 