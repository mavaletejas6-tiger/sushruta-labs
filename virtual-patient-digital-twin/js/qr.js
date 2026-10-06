/*
 * qr.js - self-contained QR Code generator (no external library, works offline).
 *
 * Implements QR Model 2, byte mode, error-correction level L, versions 1-10,
 * with Reed-Solomon ECC, mask selection and format/version information.
 * Used to encode only a short verification URL (verification.html?id=CERT-…),
 * never full medical records.
 */
window.QR = (function () {
  'use strict';

  /* ------------------------------------------------------ GF(256) tables */
  var EXP = new Uint8Array(512);
  var LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function gmul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  function rsGenerator(degree) {
    var poly = [1];
    for (var i = 0; i < degree; i++) {
      var next = new Array(poly.length + 1).fill(0);
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gmul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }
  function rsEncode(data, ecLen) {
    var gen = rsGenerator(ecLen);
    var res = new Array(ecLen).fill(0);
    for (var i = 0; i < data.length; i++) {
      var factor = data[i] ^ res[0];
      res.shift();
      res.push(0);
      if (factor !== 0) {
        for (var j = 0; j < gen.length - 1; j++) res[j] ^= gmul(gen[j + 1], factor);
      }
    }
    return res;
  }

  /* -------------------------------------------------- version parameters */
  // [ecCodewordsPerBlock, blocksG1, dataCodewordsG1, blocksG2, dataCodewordsG2] for level L
  var ECC_L = [
    null,
    [7, 1, 19, 0, 0], [10, 1, 34, 0, 0], [15, 1, 55, 0, 0], [20, 1, 80, 0, 0],
    [26, 1, 108, 0, 0], [18, 2, 68, 0, 0], [20, 2, 78, 0, 0], [24, 2, 97, 0, 0],
    [30, 2, 116, 0, 0], [18, 2, 68, 2, 69]
  ];
  var ALIGN = [
    null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
    [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]
  ];

  function dataCapacityBytes(version) {
    var e = ECC_L[version];
    var totalData = e[1] * e[2] + e[3] * e[4];
    var lenBits = version >= 10 ? 16 : 8;
    return Math.floor((totalData * 8 - 4 - lenBits) / 8);
  }

  function utf8Bytes(str) {
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var c2 = str.charCodeAt(++i);
        var cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
      } else { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
    }
    return out;
  }

  /* ------------------------------------------------------- bit buffer */
  function BitBuf() { this.bits = []; }
  BitBuf.prototype.put = function (value, length) {
    for (var i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  };
  BitBuf.prototype.toBytes = function () {
    var bytes = [];
    for (var i = 0; i < this.bits.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | (this.bits[i + j] || 0);
      bytes.push(b);
    }
    return bytes;
  };

  /* --------------------------------------------------- matrix scaffolding */
  function newGrid(size, fill) {
    var g = [];
    for (var y = 0; y < size; y++) {
      g.push(new Array(size).fill(fill));
    }
    return g;
  }

  function Encoder(text) {
    this.bytes = utf8Bytes(text);
    this.version = 0;
    for (var v = 1; v <= 10; v++) {
      if (this.bytes.length <= dataCapacityBytes(v)) { this.version = v; break; }
    }
    if (!this.version) throw new Error('Data too long for QR versions 1-10 (level L)');
    this.size = this.version * 4 + 17;
    this.modules = newGrid(this.size, false);
    this.isFunction = newGrid(this.size, false);
  }

  Encoder.prototype.setFn = function (x, y, dark) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    this.modules[y][x] = !!dark;
    this.isFunction[y][x] = true;
  };

  Encoder.prototype.drawFunctionPatterns = function () {
    var size = this.size, i, j;
    // timing
    for (i = 0; i < size; i++) {
      this.setFn(6, i, i % 2 === 0);
      this.setFn(i, 6, i % 2 === 0);
    }
    // finders + separators
    var centers = [[3, 3], [size - 4, 3], [3, size - 4]];
    for (i = 0; i < centers.length; i++) {
      var cx = centers[i][0], cy = centers[i][1];
      for (var dy = -4; dy <= 4; dy++) {
        for (var dx = -4; dx <= 4; dx++) {
          var dist = Math.max(Math.abs(dx), Math.abs(dy));
          this.setFn(cx + dx, cy + dy, dist !== 2 && dist !== 4);
        }
      }
    }
    // alignment patterns
    var ap = ALIGN[this.version];
    for (i = 0; i < ap.length; i++) {
      for (j = 0; j < ap.length; j++) {
        var skip =
          (i === 0 && j === 0) ||
          (i === 0 && j === ap.length - 1) ||
          (i === ap.length - 1 && j === 0);
        if (skip) continue;
        var ax = ap[i], ay = ap[j];
        for (var ddy = -2; ddy <= 2; ddy++) {
          for (var ddx = -2; ddx <= 2; ddx++) {
            var d = Math.max(Math.abs(ddx), Math.abs(ddy));
            this.setFn(ax + ddx, ay + ddy, d !== 1);
          }
        }
      }
    }
    // reserve format info (drawn later) + dark module
    this.drawFormatBits(0);
    // version info
    if (this.version >= 7) {
      var verBits = this.bchVersion(this.version);
      for (i = 0; i < 18; i++) {
        var bit = ((verBits >>> i) & 1) === 1;
        var a = size - 11 + (i % 3), b = Math.floor(i / 3);
        this.setFn(a, b, bit);
        this.setFn(b, a, bit);
      }
    }
  };

  Encoder.prototype.bchFormat = function (data) {
    var rem = data << 10;
    for (var i = 14; i >= 10; i--) {
      if (((rem >>> i) & 1) === 1) rem ^= 0x537 << (i - 10);
    }
    return ((data << 10) | (rem & 0x3ff)) ^ 0x5412;
  };
  Encoder.prototype.bchVersion = function (ver) {
    var rem = ver << 12;
    for (var i = 17; i >= 12; i--) {
      if (((rem >>> i) & 1) === 1) rem ^= 0x1f25 << (i - 12);
    }
    return (ver << 12) | (rem & 0xfff);
  };

  Encoder.prototype.drawFormatBits = function (mask) {
    // error-correction level L = 0b01
    var data = (0x01 << 3) | mask;
    var bits = this.bchFormat(data);
    var size = this.size;
    var getBit = function (i) { return ((bits >>> i) & 1) === 1; };
    var i;
    for (i = 0; i <= 5; i++) this.setFn(8, i, getBit(i));
    this.setFn(8, 7, getBit(6));
    this.setFn(8, 8, getBit(7));
    this.setFn(7, 8, getBit(8));
    for (i = 9; i < 15; i++) this.setFn(14 - i, 8, getBit(i));
    for (i = 0; i < 8; i++) this.setFn(size - 1 - i, 8, getBit(i));
    for (i = 8; i < 15; i++) this.setFn(8, size - 15 + i, getBit(i));
    this.setFn(8, size - 8, true); // dark module
  };

  Encoder.prototype.buildCodewords = function () {
    var e = ECC_L[this.version];
    var ecLen = e[0], b1 = e[1], d1 = e[2], b2 = e[3], d2 = e[4];
    var totalData = b1 * d1 + b2 * d2;

    var bb = new BitBuf();
    bb.put(0x4, 4);                                  // byte mode
    bb.put(this.bytes.length, this.version >= 10 ? 16 : 8);
    for (var i = 0; i < this.bytes.length; i++) bb.put(this.bytes[i], 8);
    // terminator
    var capBits = totalData * 8;
    var term = Math.min(4, capBits - bb.bits.length);
    bb.put(0, term);
    // byte align
    while (bb.bits.length % 8 !== 0) bb.bits.push(0);
    var dataCw = bb.toBytes();
    var pads = [0xec, 0x11], p = 0;
    while (dataCw.length < totalData) dataCw.push(pads[p++ % 2]);

    // split into blocks
    var blocks = [], ecBlocks = [], offset = 0, k;
    for (k = 0; k < b1; k++) { blocks.push(dataCw.slice(offset, offset + d1)); offset += d1; }
    for (k = 0; k < b2; k++) { blocks.push(dataCw.slice(offset, offset + d2)); offset += d2; }
    for (k = 0; k < blocks.length; k++) ecBlocks.push(rsEncode(blocks[k], ecLen));

    // interleave
    var out = [];
    var maxData = Math.max(d1, d2);
    for (i = 0; i < maxData; i++) {
      for (k = 0; k < blocks.length; k++) {
        if (i < blocks[k].length) out.push(blocks[k][i]);
      }
    }
    for (i = 0; i < ecLen; i++) {
      for (k = 0; k < ecBlocks.length; k++) out.push(ecBlocks[k][i]);
    }
    return out;
  };

  Encoder.prototype.drawCodewords = function (data) {
    var size = this.size, i = 0, totalBits = data.length * 8;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var x = right - j;
          var upward = ((right + 1) & 2) === 0;
          var y = upward ? size - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < totalBits) {
            this.modules[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
            i++;
          }
        }
      }
    }
  };

  Encoder.prototype.maskFn = function (m, x, y) {
    switch (m) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return (x * y) % 2 + (x * y) % 3 === 0;
      case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
      case 7: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
      default: return false;
    }
  };
  Encoder.prototype.applyMask = function (m) {
    for (var y = 0; y < this.size; y++) {
      for (var x = 0; x < this.size; x++) {
        if (!this.isFunction[y][x] && this.maskFn(m, x, y)) this.modules[y][x] = !this.modules[y][x];
      }
    }
  };

  Encoder.prototype.penalty = function () {
    var size = this.size, m = this.modules, p = 0, x, y, i;
    // rule 1: runs
    for (y = 0; y < size; y++) {
      var runC = 1;
      for (x = 1; x < size; x++) {
        if (m[y][x] === m[y][x - 1]) { runC++; if (runC === 5) p += 3; else if (runC > 5) p += 1; }
        else runC = 1;
      }
    }
    for (x = 0; x < size; x++) {
      var runR = 1;
      for (y = 1; y < size; y++) {
        if (m[y][x] === m[y - 1][x]) { runR++; if (runR === 5) p += 3; else if (runR > 5) p += 1; }
        else runR = 1;
      }
    }
    // rule 2: 2x2 blocks
    for (y = 0; y < size - 1; y++) {
      for (x = 0; x < size - 1; x++) {
        var c = m[y][x];
        if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
      }
    }
    // rule 3: finder-like patterns
    var pat1 = [true, false, true, true, true, false, true, false, false, false, false];
    var pat2 = pat1.slice().reverse();
    function match(line, start, pat) {
      for (var k = 0; k < pat.length; k++) if (line[start + k] !== pat[k]) return false;
      return true;
    }
    for (y = 0; y < size; y++) {
      var row = m[y];
      for (x = 0; x + 11 <= size; x++) {
        if (match(row, x, pat1)) p += 40;
        if (match(row, x, pat2)) p += 40;
      }
    }
    for (x = 0; x < size; x++) {
      var col = [];
      for (y = 0; y < size; y++) col.push(m[y][x]);
      for (y = 0; y + 11 <= size; y++) {
        if (match(col, y, pat1)) p += 40;
        if (match(col, y, pat2)) p += 40;
      }
    }
    // rule 4: dark proportion
    var dark = 0;
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (m[y][x]) dark++;
    var total = size * size;
    var ratio = Math.abs(dark * 100 / total - 50);
    p += Math.floor(ratio / 5) * 10;
    return p;
  };

  Encoder.prototype.encode = function () {
    this.drawFunctionPatterns();
    this.drawCodewords(this.buildCodewords());
    var best = 0, bestScore = Infinity;
    for (var m = 0; m < 8; m++) {
      this.applyMask(m);
      this.drawFormatBits(m);
      var s = this.penalty();
      if (s < bestScore) { bestScore = s; best = m; }
      this.applyMask(m); // undo
    }
    this.applyMask(best);
    this.drawFormatBits(best);
    return { size: this.size, modules: this.modules, version: this.version, mask: best };
  };

  /* ------------------------------------------------------------- rendering */
  function draw(canvas, text, opts) {
    opts = opts || {};
    var mtx = new Encoder(text).encode();
    var quiet = opts.quiet === undefined ? 4 : opts.quiet;
    var scale = opts.scale || Math.max(4, Math.floor((canvas.width || 256) / (mtx.size + quiet * 2)));
    var px = (mtx.size + quiet * 2) * scale;
    canvas.width = px;
    canvas.height = px;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = '#000000';
    for (var y = 0; y < mtx.size; y++) {
      for (var x = 0; x < mtx.size; x++) {
        if (mtx.modules[y][x]) {
          ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
        }
      }
    }
    return mtx;
  }

  function generate(text) { return new Encoder(text).encode(); }

  function matrixToString(mtx) {
    var lines = [];
    for (var y = 0; y < mtx.size; y++) {
      var row = '';
      for (var x = 0; x < mtx.size; x++) row += mtx.modules[y][x] ? '1' : '0';
      lines.push(row);
    }
    return lines.join('\n');
  }

  return { generate: generate, draw: draw, matrixToString: matrixToString, Encoder: Encoder };
})();
