// itch.io slides: the five games as images (four layout options to compare) over text lists of the other collections,
// drawn from data/itch.json,
// which scripts/fetch-itch.mjs snapshots together with the covers in img/itch/.
(function () {
    var INK = '#23302e', PAPER = '#e4ebe8';
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var SHORT = { 'Games': 'GAMES', 'Assets and Tools': 'TOOLS', 'Game Jams': 'JAMS', 'Tests, Studies and Experiments': 'STUDIES' };

    // halftone print of a cover ("F1"): one ink plate, the dark parts printed as dots, after stretching each cover's
    // own levels (2nd..98th percentile) so dark and bright covers both use the full range
    var lum = function (r, g, b) { return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
    var TONE = { cut: 0.08, gamma: 1 };
    function plate(ctx, data, W, H, cell, angle, color, value) {
        var a = angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), cx = W / 2, cy = H / 2, n = Math.ceil(Math.hypot(W, H) / cell / 2) + 1;
        ctx.fillStyle = color; ctx.beginPath();
        for (var i = -n; i <= n; i++) for (var j = -n; j <= n; j++) {
            var u = i * cell, v = j * cell, x = cx + u * ca - v * sa, y = cy + u * sa + v * ca;
            if (x < -cell || y < -cell || x > W + cell || y > H + cell) continue;
            var k = ((Math.min(H - 1, Math.max(0, y | 0)) * W) + Math.min(W - 1, Math.max(0, x | 0))) * 4;
            var t = Math.min(1, Math.max(0, value(data[k], data[k + 1], data[k + 2])));
            if (t < 0.02) continue;
            var r = cell * 0.62 * Math.sqrt(t);
            ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2);
        }
        ctx.fill();
    }
    // screen: 'dot' (round dots on a 45° grid) or 'line' (horizontal lines that thicken with darkness)
    function halftone(img, w, h, cell, screen) {
        var S = 2, W = w * S, H = h * S, c = document.createElement('canvas');
        c.width = W; c.height = H; c.style.width = w + 'px'; c.style.height = h + 'px';
        var src = document.createElement('canvas'); src.width = W; src.height = H;
        var sx = src.getContext('2d'); sx.filter = 'blur(' + (cell * S * 0.2).toFixed(1) + 'px)';
        // cover-fit the image into the box
        var k = Math.max(W / img.naturalWidth, H / img.naturalHeight), iw = img.naturalWidth * k, ih = img.naturalHeight * k;
        sx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
        var d = sx.getImageData(0, 0, W, H).data, x = c.getContext('2d');
        var ls = []; for (var q = 0; q < d.length; q += 32) ls.push(lum(d[q], d[q + 1], d[q + 2]));
        ls.sort(function (p, q) { return p - q; });
        var lo = ls[(ls.length * 0.02) | 0], hi = Math.max(lo + 0.05, ls[(ls.length * 0.98) | 0]);
        x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
        var tone = function (r, g, b) {
            var l = 1 - Math.min(1, Math.max(0, (lum(r, g, b) - lo) / (hi - lo)));
            return Math.pow(Math.max(0, (l - TONE.cut) / (1 - TONE.cut)), TONE.gamma);
        };
        if (screen === 'line') {
            var cs = cell * S; x.fillStyle = INK;
            for (var yy = cs / 2; yy < H; yy += cs) for (var xx = 0; xx < W; xx += 2) {
                var q = ((yy | 0) * W + xx) * 4, t = tone(d[q], d[q + 1], d[q + 2]);
                if (t > 0.02) x.fillRect(xx, yy - cs * 0.48 * t, 2, cs * 0.96 * t);
            }
        } else plate(x, d, W, H, cell * S, 45, INK, tone);
        return c;
    }
    // a framed cover: halftone by default, the real colour cover fades in on hover
    function cover(p, w, h, cell, imgs, screen) {
        var f = document.createElement('span'); f.className = 'cover'; f.style.width = w + 'px'; f.style.height = h + 'px';
        var img = imgs[p.id];
        if (img) {
            f.appendChild(halftone(img, w, h, cell, screen));
            var col = img.cloneNode(); col.className = 'cover-colour'; col.alt = ''; f.appendChild(col);
        }
        return f;
    }
    var meta = function (p) { return [p.year, p.genre, p.platforms.join(' · ')].filter(Boolean).join(' · '); };
    var head = function (title, data) {
        return '<div class="gh-head"><span><b>' + title + '</b><a href="' + esc(data.url) + '" target="_blank" rel="noopener">' + esc(data.url.replace('https://', '')) + '</a></span>' +
            '<span class="ghost">SNAPSHOT ' + data.generated.slice(0, 10) + ' · ' + data.projects.length + ' PROJECTS</span></div>';
    };

    var games = function (data) { return data.projects.filter(function (p) { return p.sections[0] === 'Games'; }); };
    var link = function (p, cls) { var a = document.createElement('a'); a.className = cls; a.href = p.url; a.target = '_blank'; a.rel = 'noopener'; return a; };
    var caption = function (p, i) { return '<span class="it-n ghost">0' + (i + 1) + '</span><b>' + esc(p.title) + '</b><span class="it-meta">' + esc(meta(p)) + '</span>'; };

    // the other collections (tools, jams, studies) under the games, as a numbered index
    function groups(data) {
        return data.sections.filter(function (s) { return s !== 'Games'; }).map(function (s) {
            // every member of the collection, even if it is also one of the featured games
            return { name: s, short: SHORT[s] || s, items: data.projects.filter(function (p) { return p.sections.indexOf(s) >= 0; }) };
        }).filter(function (g) { return g.items.length; });
    }

    // INDEX — a numbered catalogue in two columns (tools | the rest), collection as an orange tag, like the SYS.LOG readouts
    function listIndex(box, gs) {
        box.className = 'it-index-table'; var n = 0, cols = [document.createElement('div'), document.createElement('div')];
        cols.forEach(function (c) { box.appendChild(c); });
        gs.forEach(function (g, gi) {
            g.items.forEach(function (p, k) {
                var a = link(p, 'it-ix' + (k === 0 ? ' is-first' : ''));
                a.innerHTML = '<span class="ghost">' + String(++n).padStart(2, '0') + '</span><span class="it-ix-tag">' + (k === 0 ? esc(g.short.toUpperCase()) : '') + '</span>' +
                    '<b>' + esc(p.title) + '</b><span class="it-ix-text">' + esc(p.text) + '</span><span class="it-ix-go">↗</span>';
                cols[gi === 0 ? 0 : 1].appendChild(a);
            });
        });
    }
    function lists(root, data) {
        var box = document.createElement('div');
        listIndex(box, groups(data));
        root.appendChild(box);
    }

    // spray edges for the cover prints, done once on a canvas when the card is made (a live SVG filter here had to be
    // re-run on every repaint, which was too heavy on phones while the monitor moves in 3D). The inside stays intact;
    // the rounded rectangle's edge is broken up with grain and a slow wobble, with speckled overspray just outside.
    var GRAIN = null, SPRAY_M = 16, RADIUS = 12;
    function loadGrain() {
        return new Promise(function (res) {
            var i = new Image();
            i.onload = function () { var c = document.createElement('canvas'); c.width = i.width; c.height = i.height; var x = c.getContext('2d'); x.drawImage(i, 0, 0);
                GRAIN = { w: i.width, h: i.height, d: x.getImageData(0, 0, i.width, i.height).data }; res(); };
            i.onerror = res; i.src = 'img/grain.png';
        });
    }
    // draws src (a canvas or image, cover-fitted) into a canvas SPRAY_M px larger on every side, with sprayed edges
    function sprayed(src, w, h, seed, tone) {
        var S = 2, m = SPRAY_M * S, W = w * S, H = h * S, CW = W + 2 * m, CH = H + 2 * m;
        var c = document.createElement('canvas'); c.width = CW; c.height = CH; c.style.width = (w + 2 * SPRAY_M) + 'px'; c.style.height = (h + 2 * SPRAY_M) + 'px';
        var x = c.getContext('2d');
        var sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height, k = Math.max(W / sw, H / sh);
        if (tone) x.filter = tone;
        x.drawImage(src, m + (W - sw * k) / 2, m + (H - sh * k) / 2, sw * k, sh * k);
        x.filter = 'none';
        var img = x.getImageData(0, 0, CW, CH), d = img.data, hx = W / 2, hy = H / 2, r = RADIUS * S, ink = [35, 48, 46];
        var ph = [seed * 1.7, seed * 2.3, seed * 0.9];
        var G = function (gx, gy) { return GRAIN ? GRAIN.d[(((gy % GRAIN.h) * GRAIN.w) + (gx % GRAIN.w)) * 4] / 255 - 0.5 : 0; };
        for (var y = 0; y < CH; y++) for (var xx = 0; xx < CW; xx++) {
            // signed distance to the rounded rectangle, positive inside (canvas px, 2 per CSS px)
            var px = Math.abs(xx - m - hx) - (hx - r), py = Math.abs(y - m - hy) - (hy - r);
            var dist = -(Math.hypot(Math.max(px, 0), Math.max(py, 0)) + Math.min(Math.max(px, py), 0) - r);
            if (dist > 40) continue;                                                 // well inside: untouched
            var g = G(xx, y), g2 = G(xx + 97, y + 151);
            var wob = 8 * Math.sin(xx * 0.019 + ph[0]) * Math.sin(y * 0.015 + ph[1]) + 4 * Math.sin((xx + y) * 0.041 + ph[2]);
            var e = dist + wob + g * 110, q = (y * CW + xx) * 4;                    // edge eaten unevenly by the grain
            if (e > 14) continue;
            var a = Math.max(0, Math.min(1, e / 14));
            if (a > 0) { d[q + 3] = d[q + 3] * a; continue; }
            // overspray: ink specks outside the edge, denser near it and thinning out over ~28 css px
            var t = Math.max(0, 1 + dist / 56);
            if (t > 0 && g2 > 0.42 - 0.34 * t) { d[q] = ink[0]; d[q + 1] = ink[1]; d[q + 2] = ink[2]; d[q + 3] = 230 * t; }
            else d[q + 3] = 0;
        }
        x.putImageData(img, 0, 0);
        return c;
    }

    // GRID — the contact sheet: five sprayed prints with captions
    function layoutGrid(root, data, imgs) {
        var row = document.createElement('div'); row.className = 'it-cards';
        games(data).forEach(function (p, i) {
            var a = link(p, 'it-card'), c = document.createElement('span'), img = imgs[p.id];
            c.className = 'cover is-sprayed'; c.style.width = '200px'; c.style.height = '160px';
            if (img) {
                c.appendChild(sprayed(halftone(img, 200, 160, 2), 200, 160, i + 1));
                var col = sprayed(img, 200, 160, i + 1, 'saturate(0.75)'); col.className = 'cover-colour'; c.appendChild(col);
            }
            a.appendChild(c);
            a.insertAdjacentHTML('beforeend', caption(p, i)); row.appendChild(a);
        });
        root.appendChild(row);
    }
    var LAYOUTS = { grid: layoutGrid };
    function slide(root, data, imgs) {
        root.innerHTML = head('PROJECTS // ITCH.IO', data);
        LAYOUTS[root.dataset.layout](root, data, imgs);
        lists(root, data);
    }

    fetch('data/itch.json').then(function (r) { return r.json(); }).then(function (data) {
        var imgs = {};
        return Promise.all([loadGrain()].concat(data.projects.filter(function (p) { return p.cover; }).map(function (p) {
            return new Promise(function (res) { var i = new Image(); i.onload = function () { imgs[p.id] = i; res(); }; i.onerror = res; i.src = p.cover; });
        }))).then(function () {
            document.querySelectorAll('.it[data-layout]').forEach(function (root) { slide(root, data, imgs); });
        });
    }).catch(function (e) { console.warn('itch slides:', e); });
})();
