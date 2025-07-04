function F(r) {
  return r.length;
}
function L(r, e, n) {
  n === void 0 && (n = -1), n === -1 && (n = r.length);
  for (var t = r[0] * e[0], a = 1; a < n; ++a)
    t += r[a] * e[a];
  return t;
}
function N(r) {
  for (var e = r.length, n = r[0] * r[0], t = 1; t < e - 1; ++t)
    n += r[t] * r[t];
  if (n === 0)
    return r;
  n = 1 / Math.sqrt(n);
  for (var t = 0; t < e; ++t)
    r[t] *= n;
  return r;
}
function C(r, e, n, t, a) {
  for (var o = 0, u = 0, s = 0; s < a; ++s)
    if (s !== n) {
      u = 0;
      for (var i = 0; i < a; ++i)
        i !== t && (e[o][u] = r[s][i], ++u);
      ++o;
    }
}
function D(r) {
  for (var e = new ArrayBuffer(r * r * 4), n = [], t = 0; t < r; ++t)
    n[t] = new Float32Array(e, t * r << 2, r);
  return n;
}
function M(r, e) {
  if (e === 1)
    return r[0][0];
  if (e === 2)
    return r[0][0] * r[1][1] - r[0][1] * r[1][0];
  if (e === 3)
    return r[0][0] * r[1][1] * r[2][2] + r[0][1] * r[1][2] * r[2][0] + r[0][2] * r[1][0] * r[2][1] - r[0][2] * r[1][1] * r[2][0] - r[0][1] * r[1][0] * r[2][2] - r[0][0] * r[1][2] * r[2][1];
  for (var n = 1, t = 0, a = D(e - 1), o = 0; o < e; ++o)
    C(r, a, 0, o, e), t += n * r[0][o] * M(a, e - 1), n = -n;
  return t;
}
function $(r, e) {
  var n = r[0].length;
  if (e = e || new Float32Array(n), n === 3) {
    var t = r[0], a = r[1], o = t[0], u = t[1], s = t[2], i = a[0], f = a[1], v = a[2];
    e[0] = u * v - s * f, e[1] = s * i - o * v, e[2] = o * f - u * i;
  } else
    for (var c = n % 2 ? -1 : 1, h = D(n - 1), l = 0; l < n; ++l)
      C(r, h, n - 1, l, n), e[l] = c * M(h, n - 1), c = -c;
  return e;
}
function E(r, e) {
  var n = r.length, t = r[0], a = [];
  e = e || new Float32Array(n + 1);
  for (var o = 1; o < n; ++o) {
    for (var u = r[o], s = [], i = 0; i < n; ++i)
      s[i] = t[i] - u[i];
    a.push(s);
  }
  return $(a, e), e[n] = -L(t, e, n), N(e), e;
}
function z(r) {
  for (var e = r.length, n = 0; n < e; ++n)
    r[n] = -r[n];
  return r;
}
function w(r, e, n) {
  n === void 0 && (n = -1), n === -1 && (n = r.length);
  for (var t = e[n], a = 0; a < n; ++a)
    t += r[a] * e[a];
  return t;
}
var G = (
  /** @class */
  function() {
    function r(e) {
      this.verts = [], this.facet = e;
    }
    return r.prototype.getPlane = function(e, n) {
      return this._plane || (this._plane = E(this.verts.map(function(t) {
        return e[t];
      })), w(n, this._plane) > 0 && z(this._plane)), this._plane;
    }, r;
  }()
), R = (
  /** @class */
  /* @__PURE__ */ function() {
    function r() {
      this.ridges = [], this.verts = [];
    }
    return r;
  }()
);
function H(r, e, n) {
  for (var t = e.verts, a = t.length, o = 0, u = n; o < u.length; o++)
    for (var s = u[o], i = 0, f = s.ridges; i < f.length; i++) {
      var v = f[i];
      if (!v.neighbor) {
        for (var c = !0, h = 0; h < a; ++h)
          c = c && v.verts.indexOf(t[h]) >= 0;
        if (c) {
          e.neighbor = v, v.neighbor = e;
          return;
        }
      }
    }
}
function q(r, e, n, t) {
  var a = r.ridges.map(function(f) {
    return e[f.verts[0]];
  }), o = r.plane = E(a);
  if (t && w(t, o, n) > 0) {
    z(o), r.verts.reverse(), r.ridges.reverse();
    for (var u = 0, s = r.ridges; u < s.length; u++) {
      var i = s[u];
      i.verts.reverse();
    }
  }
}
function T(r, e, n) {
  for (var t = r.verts, a = r.ridges, o = a.length; o < n; ++o) {
    for (var u = new G(r), s = 0; s < n - 1; ++s)
      u.verts[s] = t[(o + s) % n];
    u.opposite = t[(o + n) % n], H(r, u, e), r.ridges.push(u);
  }
}
function J(r, e, n, t, a, o) {
  var u = new R();
  return u.verts = r.verts.concat([e]), u.ridges.push(r), r.facet = u, r.opposite = e, T(u, t, o), q(u, n, o, a), u;
}
function K(r, e, n) {
  var t = e ? e[0] : 0, a = r[t], o = a.length, u = e ? e.length : o + 1;
  if (n)
    for (var s = 0; s < o; ++s)
      n[s] = a[s];
  else
    n = a.slice();
  for (var s = 0; s < o; ++s) {
    for (var i = 1; i < u; ++i) {
      var f = e ? e[i] : i;
      n[s] += r[f][s];
    }
    n[s] /= u;
  }
  return n;
}
function Q(r, e) {
  for (var n = r[0].length, t = n + 1, a = [], o = 0; o <= n; ++o) {
    for (var u = new R(), s = 0; s < n; ++s) {
      var i = (o + s) % t;
      u.verts[s] = e ? e[i] : i;
    }
    T(u, a, n);
    var f = (o + n) % (n + 1), v = r[e ? e[f] : f];
    q(u, r, n, v), a.push(u);
  }
  return a;
}
function U(r) {
  for (var e = r.length, n, t; e !== 0; )
    t = Math.floor(Math.random() * e), e -= 1, n = r[e], r[e] = r[t], r[t] = n;
  return r;
}
function W(r, e) {
  console.assert(e < r.length, "Index out of bounds!");
  var n = r.pop();
  return r.length > 0 && n !== r[e] && (r[e] = n), e;
}
function X(r, e) {
  for (var n = e.slice().sort(function(u, s) {
    return s - u;
  }), t = 0, a = n; t < a.length; t++) {
    var o = a[t];
    W(r, o);
  }
  return r;
}
function P(r, e) {
  var n = r.pop();
  if (n === e)
    return r.length;
  var t = r.indexOf(e);
  if (t === -1)
    throw r.push(n), new Error("Removing component that's not present");
  return r[t] = n, t;
}
var b = 1e-4, k = (
  /** @class */
  /* @__PURE__ */ function() {
    function r() {
      this.outsideSet = [], this.outsideDist = [];
    }
    return r;
  }()
);
function Y(r) {
  var e = r.meta, n = e.outsideSet, t = e.outsideDist, a = n.length;
  if (a === 0)
    return -1;
  for (var o = n[0], u = t[0], s = 1; s < a; ++s)
    t[s] > u && (u = t[s], o = n[s]);
  return o;
}
function I(r, e, n, t) {
  for (var a = n.map(function(m) {
    return [];
  }), o = r.length, u = 0; u < o; ++u)
    for (var s = r[u], i = e[s], f = 0, v = n; f < v.length; f++) {
      var c = v[f], h = w(i, c.plane, t);
      if (h > b) {
        var l = c.meta;
        l.outsideSet.push(s), l.outsideDist.push(h);
        break;
      }
    }
  return a;
}
function B(r, e, n, t, a) {
  n.push(e), e.meta.currentPoint = r;
  for (var o = 0, u = e.ridges; o < u.length; o++) {
    var s = u[o], i = s.neighbor.facet;
    i.meta.currentPoint !== r && (w(r, i.plane, a) > b ? B(r, i, n, t, a) : t.push(s));
  }
}
function Z(r, e, n, t, a) {
  for (var o = [], u = 0, s = n; u < s.length; u++) {
    var i = s[u], f = J(i, e, r, o, t, a);
    f.meta = new k(), o.push(f);
  }
  return o;
}
function j(r, e, n, t) {
  for (var a = n[r], o = n[e], u = 0; u < t; ++u) {
    if (a[u] < o[u])
      return e;
    if (a[u] > o[u])
      return r;
  }
  return e;
}
function _(r, e, n, t) {
  for (var a = n[r], o = n[e], u = 0; u < t; ++u) {
    if (a[u] > o[u])
      return e;
    if (a[u] < o[u])
      return r;
  }
  return e;
}
function A(r, e) {
  for (var n = r.length, t = 0, a = 0, o = 1; o < n; ++o)
    a = j(o, a, r, e), t = _(o, t, r, e);
  for (var u = [t, a], s = [r[t], r[a]], o = 2; o < e + 1; ++o) {
    for (var i = E(s), f = -1 / 0, v = -1, c = 0; c < n; ++c) {
      var h = Math.abs(w(r[c], i, o));
      h > f && (f = h, v = c);
    }
    u.push(v), s.push(r[v]);
  }
  return u;
}
function O(r) {
  var e = r.length;
  if (e !== 0) {
    var n = F(r[0]);
    if (e <= n)
      throw new Error("A convex hull in " + n + " dimensions requires at least " + (n + 1) + " points.");
    for (var t = [], a = 0; a < e; ++a)
      t.push(a);
    for (var o = A(r, n), u = K(r, o), s = Q(r, o), i = 0, f = s; i < f.length; i++) {
      var v = f[i];
      v.meta = new k();
    }
    X(t, o), U(t), I(t, r, s, n);
    for (var c = !1; !c; ) {
      c = !0;
      for (var a = 0; a < s.length; ++a) {
        var h = s[a], l = Y(h);
        if (l !== -1) {
          P(h.meta.outsideSet, l);
          var m = [], y = [];
          B(r[l], h, m, y, n);
          for (var d = Z(r, l, y, u, n), g = 0, S = m; g < S.length; g++) {
            var p = S[g];
            P(s, p) <= a && --a, I(p.meta.outsideSet, r, d, n), p.meta.outsideSet.length > 0 && (c = !1);
          }
          s.push.apply(s, d);
        }
      }
    }
    for (var x = 0, V = s; x < V.length; x++) {
      var v = V[x];
      v.meta = null;
    }
    return s;
  }
}
function rr(r, e) {
  for (var n = e + 1, t = r.length, a = n << 2, o = new ArrayBuffer((t + 1) * a), u = 0, s = 0, i = r[0].slice(), f = r[0].slice(), v = r.map(function(l) {
    for (var m = new Float32Array(o, u, n), y = 0, d = 0; d < e; ++d) {
      var g = l[d];
      m[d] = g, g < i[d] && (i[d] = g), g > f[d] && (f[d] = g), y += g * g;
    }
    return m[e] = y, y > s && (s = y), u += a, m;
  }), c = new Float32Array(o, t * a, n), h = 0; h < e; ++h)
    c[h] = (i[h] + f[h]) * 0.5;
  return c[e] = s, v.push(c), v;
}
function er(r) {
  var e = F(r[0]), n = r.length;
  if (n === e + 1)
    return O(r);
  var t = rr(r, e), a = O(t);
  return a.filter(function(o) {
    if (o.plane[e] >= 0) {
      for (var u = 0, s = o.ridges; u < s.length; u++) {
        var i = s[u];
        i.neighbor && (i.neighbor.neighbor = null);
      }
      return !1;
    }
    return !0;
  });
}
function nr(r, e) {
  const n = r[0] * (r[4] * r[8] - r[5] * r[7]) - r[1] * (r[3] * r[8] - r[5] * r[6]) + r[2] * (r[3] * r[7] - r[4] * r[6]);
  if (Math.abs(n) < 1e-10)
    return null;
  const t = 1 / n, a = [
    (r[4] * r[8] - r[7] * r[5]) * t,
    (r[2] * r[7] - r[1] * r[8]) * t,
    (r[1] * r[5] - r[2] * r[4]) * t,
    (r[5] * r[6] - r[3] * r[8]) * t,
    (r[0] * r[8] - r[2] * r[6]) * t,
    (r[2] * r[3] - r[0] * r[5]) * t,
    (r[3] * r[7] - r[6] * r[4]) * t,
    (r[1] * r[6] - r[0] * r[7]) * t,
    (r[0] * r[4] - r[1] * r[3]) * t
  ];
  return [
    a[0] * e[0] + a[1] * e[1] + a[2] * e[2],
    a[3] * e[0] + a[4] * e[1] + a[5] * e[2],
    a[6] * e[0] + a[7] * e[1] + a[8] * e[2]
  ];
}
function tr(r, e, n, t) {
  const a = [e[0] - r[0], e[1] - r[1], e[2] - r[2]], o = [n[0] - r[0], n[1] - r[1], n[2] - r[2]], u = [t[0] - r[0], t[1] - r[1], t[2] - r[2]], s = [
    a[0],
    a[1],
    a[2],
    o[0],
    o[1],
    o[2],
    u[0],
    u[1],
    u[2]
  ], i = [
    (a[0] ** 2 + a[1] ** 2 + a[2] ** 2) * 0.5,
    (o[0] ** 2 + o[1] ** 2 + o[2] ** 2) * 0.5,
    (u[0] ** 2 + u[1] ** 2 + u[2] ** 2) * 0.5
  ], f = nr(s, i);
  return f === null ? null : [r[0] + f[0], r[1] + f[1], r[2] + f[2]];
}
function or(r, e, n, t) {
  return [
    (r[0] + e[0] + n[0] + t[0]) * 0.25,
    (r[1] + e[1] + n[1] + t[1]) * 0.25,
    (r[2] + e[2] + n[2] + t[2]) * 0.25
  ];
}
class ar {
  /**
   * Creates a new DelaunayVoronoi instance
   * @param {number[][]} points - Array of points in format [[x,y,z], [x,y,z], ...]
   */
  constructor(e) {
    if (!e || e.length < 4 || !Array.isArray(e[0]))
      throw new Error("Input must be an array of at least 4 points, e.g., [[x,y,z], ...]");
    if (e[0].length !== 3)
      throw new Error("Each point must have exactly 3 coordinates [x,y,z]");
    this.points = e, this.tetrahedra = [], this.voronoiVertices = [], this.voronoiEdges = [], this.adjacency = /* @__PURE__ */ new Map();
  }
  /**
   * Computes the complete Delaunay tetrahedralization and Voronoi diagram
   * @param {object} options - Computation options
   * @param {'circumcenter' | 'barycenter'} [options.voronoiCenterType='circumcenter'] - The type of center to use for Voronoi vertices
   * @returns {DelaunayVoronoi} Returns this instance for method chaining
   */
  compute(e = {}) {
    const { voronoiCenterType: n = "circumcenter" } = e;
    return this._computeDelaunay(), this._buildAdjacency(), this._computeVoronoi(n), this;
  }
  /**
   * Computes the 3D Delaunay tetrahedralization using Tympanum
   * @private
   */
  _computeDelaunay() {
    const e = er(this.points);
    this.tetrahedra = e.map((n) => {
      if (!n.verts)
        throw new Error("Invalid facet structure from Delaunay computation");
      return n.verts.map((t) => {
        if (t.id !== void 0) return t.id;
        if (t.index !== void 0) return t.index;
        if (t.i !== void 0) return t.i;
        if (typeof t == "number") return t;
        throw new Error("Cannot find vertex index in facet vertex");
      });
    }).filter((n) => n.length === 4);
  }
  /**
   * Builds adjacency map from triangular faces to tetrahedra
   * @private
   */
  _buildAdjacency() {
    this.adjacency.clear(), this.tetrahedra.forEach((e, n) => {
      const t = [
        [e[0], e[1], e[2]],
        [e[0], e[1], e[3]],
        [e[0], e[2], e[3]],
        [e[1], e[2], e[3]]
      ];
      for (const a of t) {
        const o = a.sort((u, s) => u - s).join("-");
        this.adjacency.has(o) || this.adjacency.set(o, []), this.adjacency.get(o).push(n);
      }
    });
  }
  /**
   * Computes Voronoi vertices and edges using the specified center type
   * @param {string} centerType - Either 'circumcenter' or 'barycenter'
   * @private
   */
  _computeVoronoi(e) {
    const n = e === "barycenter" ? or : tr;
    this.voronoiVertices = this.tetrahedra.map((o) => {
      const u = this.points[o[0]], s = this.points[o[1]], i = this.points[o[2]], f = this.points[o[3]];
      return n(u, s, i, f);
    });
    const t = this.voronoiVertices.map((o, u) => ({ vertex: o, index: u })).filter((o) => o.vertex !== null), a = new Map(t.map((o, u) => [o.index, u]));
    this.voronoiVertices = t.map((o) => o.vertex), this.voronoiEdges = [];
    for (const o of this.adjacency.values())
      if (o.length === 2) {
        const u = o[0], s = o[1];
        if (a.has(u) && a.has(s)) {
          const i = a.get(u), f = a.get(s);
          this.voronoiEdges.push([this.voronoiVertices[i], this.voronoiVertices[f]]);
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
    const e = /* @__PURE__ */ new Set();
    for (const n of this.tetrahedra) {
      const t = [
        [n[0], n[1]],
        [n[0], n[2]],
        [n[0], n[3]],
        [n[1], n[2]],
        [n[1], n[3]],
        [n[2], n[3]]
      ];
      for (const a of t) {
        const o = a.sort((u, s) => u - s);
        e.add(`${o[0]}-${o[1]}`);
      }
    }
    return e;
  }
}
export {
  ar as DelaunayVoronoi,
  ar as default
};
