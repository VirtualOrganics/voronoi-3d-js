/**
 * Solves a 3x3 linear system Ax = b for x.
 * A is given as a 9-element array (row-major).
 * b is given as a 3-element array.
 * Returns x as a 3-element array, or null if the matrix is singular.
 */
function solveLinearSystem(A, b) {
    const detA = A[0] * (A[4] * A[8] - A[5] * A[7]) -
                 A[1] * (A[3] * A[8] - A[5] * A[6]) +
                 A[2] * (A[3] * A[7] - A[4] * A[6]);

    if (Math.abs(detA) < 1e-10) {
        return null; // Matrix is singular
    }

    // Inverse of A
    const invDetA = 1 / detA;
    const invA = [
        (A[4] * A[8] - A[7] * A[5]) * invDetA,
        (A[2] * A[7] - A[1] * A[8]) * invDetA,
        (A[1] * A[5] - A[2] * A[4]) * invDetA,
        (A[5] * A[6] - A[3] * A[8]) * invDetA,
        (A[0] * A[8] - A[2] * A[6]) * invDetA,
        (A[2] * A[3] - A[0] * A[5]) * invDetA,
        (A[3] * A[7] - A[6] * A[4]) * invDetA,
        (A[1] * A[6] - A[0] * A[7]) * invDetA,
        (A[0] * A[4] - A[1] * A[3]) * invDetA,
    ];

    // x = A_inv * b
    const x = [
        invA[0] * b[0] + invA[1] * b[1] + invA[2] * b[2],
        invA[3] * b[0] + invA[4] * b[1] + invA[5] * b[2],
        invA[6] * b[0] + invA[7] * b[1] + invA[8] * b[2],
    ];

    return x;
}

/**
 * Calculates the circumcenter of a tetrahedron defined by four points.
 * Points are expected as arrays [x, y, z].
 * This is the framework-agnostic version.
 */
export function getTetraCircumcenter(p0, p1, p2, p3) {
    const a = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const b = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const c = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]];

    const A = [
        a[0], a[1], a[2],
        b[0], b[1], b[2],
        c[0], c[1], c[2],
    ];

    const bVec = [
        (a[0]**2 + a[1]**2 + a[2]**2) * 0.5,
        (b[0]**2 + b[1]**2 + b[2]**2) * 0.5,
        (c[0]**2 + c[1]**2 + c[2]**2) * 0.5,
    ];

    const xVec = solveLinearSystem(A, bVec);

    if (xVec === null) {
        return null;
    }

    return [p0[0] + xVec[0], p0[1] + xVec[1], p0[2] + xVec[2]];
}

/**
 * Calculates the barycenter (centroid) of a tetrahedron.
 * Points are expected as arrays [x, y, z].
 */
export function getTetraBarycenter(p0, p1, p2, p3) {
    return [
        (p0[0] + p1[0] + p2[0] + p3[0]) * 0.25,
        (p0[1] + p1[1] + p2[1] + p3[1]) * 0.25,
        (p0[2] + p1[2] + p2[2] + p3[2]) * 0.25,
    ];
} 