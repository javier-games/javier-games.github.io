// GitHub slide: contribution calendar + per-repo ridgeline, drawn from data/github.json,
// which scripts/fetch-github.mjs snapshots at build time.
(function () {
    var NS = 'http://www.w3.org/2000/svg';
    var MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var fmt = function (n) { return n.toLocaleString('en-US'); };
    var day = function (iso) { var d = new Date(iso + 'T00:00:00'); return MONTHS[d.getMonth()].charAt(0) + MONTHS[d.getMonth()].slice(1).toLowerCase() + ' ' + d.getDate(); };
    function ago(iso) {
        var s = (Date.now() - new Date(iso)) / 1000;
        if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm';
        if (s < 86400) return Math.round(s / 3600) + 'h';
        if (s < 86400 * 60) return Math.round(s / 86400) + 'd';
        if (s < 86400 * 365) return Math.round(s / 86400 / 30) + 'mo';
        return Math.round(s / 86400 / 365) + 'y';
    }
    function el(tag, attrs, parent) {
        var e = document.createElementNS(NS, tag);
        for (var k in attrs) e.setAttribute(k, attrs[k]);
        if (parent) parent.appendChild(e);
        return e;
    }

    function stats(days) {
        var best = days[0], cur = 0, longest = 0, run = 0;
        days.forEach(function (d) {
            if (d.count > best.count) best = d;
            run = d.count > 0 ? run + 1 : 0; longest = Math.max(longest, run);
        });
        // current streak: counted back from today (today itself may still be empty)
        for (var i = days.length - 1; i >= 0; i--) {
            if (days[i].count > 0) cur++;
            else if (i < days.length - 1) break;
        }
        return { best: best, current: cur, longest: longest };
    }

    // contribution calendar as a dot grid: one column per week (Sunday first), dot size by level
    function heat(parent, days, o) {
        var cols = Math.ceil(days.length / 7), c = o.cell;
        var svg = el('svg', { class: 'heat', width: cols * c, height: 7 * c, viewBox: '0 0 ' + cols * c + ' ' + 7 * c }, null);
        svg.style.left = o.x + 'px'; svg.style.top = o.y + 'px';
        var radii = o.radii || [1.4, 3.4, 5.2, 7, 8.6];
        var g = el('g', o.filter ? { filter: o.filter } : {}, svg), lastMonth = -1, lastLabel = -9, pos = {};
        days.forEach(function (d, i) {
            var col = Math.floor(i / 7), row = i % 7, cx = col * c + c / 2, cy = row * c + c / 2;
            pos[d.d] = [cx, cy];
            var dot = o.link ? el('a', { href: o.link(d), target: '_blank', rel: 'noopener', class: 'day' }, g) : g;
            if (o.link) {
                el('title', {}, dot).textContent = day(d.d) + ' · ' + d.count + (d.count === 1 ? ' contribution' : ' contributions');
                el('rect', { x: cx - c / 2, y: cy - c / 2, width: c, height: c, fill: 'transparent' }, dot);   // the whole cell is the hit area
            }
            el('circle', { cx: cx, cy: cy, r: radii[d.level], class: d.level ? 'dot' : 'dot is-empty' }, dot);
            var m = new Date(d.d + 'T00:00:00').getMonth();
            if (row === 0 && m !== lastMonth) { lastMonth = m; if (col - lastLabel >= 3) { lastLabel = col; el('text', { x: cx - 4, y: -10, class: 'lbl' }, svg).textContent = MONTHS[m]; } }
        });
        var today = days[days.length - 1], t = pos[today.d];
        el('circle', { cx: t[0], cy: t[1], r: c / 2 - 1, fill: 'none', stroke: 'var(--orange)', 'stroke-width': 2 }, svg);
        ['MON', 'WED', 'FRI'].forEach(function (n, k) { el('text', { x: -38, y: (1 + 2 * k) * c + c / 2 + 4, class: 'lbl' }, svg).textContent = n; });
        parent.appendChild(svg);
        return { svg: svg, pos: pos, w: cols * c, h: 7 * c };
    }


    var head = function (title, data) {
        return '<div class="gh-head"><span><b>' + title + '</b><a href="' + esc(data.user.url) + '" target="_blank" rel="noopener">github.com/' + esc(data.user.login) + '</a></span>' +
            '<span class="ghost">SNAPSHOT ' + data.generated.slice(0, 10) + ' · ' + data.contributions.days.length + ' D · ' + data.log.length + ' EV</span></div>';
    };

    // ridgeline ("sound graph"): one line per active repo over the same days as the calendar, stacked back to front
    // so each line hides the ones behind it. Height = that day's commits, smoothed; quieter repos get lower peaks.
    function ridges(parent, act, n, o) {
        var svg = el('svg', { class: 'heat ridges', width: o.w, height: o.h, viewBox: '0 0 ' + o.w + ' ' + o.h }, null);
        svg.style.left = o.x + 'px'; svg.style.top = o.y + 'px';
        var rows = act.slice(0, o.rows), maxTotal = rows[0].total, gap = (o.h - o.amp - 8) / Math.max(1, rows.length - 1);
        var px = function (i) { return ((i + 0.5) / 7) * o.cell; };     // same x as the calendar column of that day
        var K = [0.05, 0.12, 0.2, 0.26, 0.2, 0.12, 0.05];                 // small gaussian, keeps daily spikes readable
        // occlusion without painting: each line is masked by the areas under the lines in front of it,
        // so the paper and its shading show through untouched
        var defs = el('defs', {}, svg), uid = 'rg' + Math.random().toString(36).slice(2, 7), shapes = [];
        rows.forEach(function (r, k) {
            var sm = r.series.map(function (_, i) { var v = 0; K.forEach(function (w, t) { v += w * (r.series[i + t - 3] || 0); }); return v; });
            var peak = Math.max.apply(null, sm) || 1, amp = o.amp * (0.35 + 0.65 * Math.sqrt(r.total / maxTotal)), base = o.amp + k * gap;
            var pts = sm.map(function (v, i) { return [px(i), base - Math.sqrt(v / peak) * amp]; });
            var line = 'M-12 ' + base + ' L' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L') + ' L' + (o.w + 12) + ' ' + base;
            shapes.push({ r: r, base: base, line: line, area: line + ' L' + (o.w + 12) + ' ' + (o.h + 40) + ' L-12 ' + (o.h + 40) + 'Z' });
        });
        shapes.forEach(function (s, k) {
            var m = el('mask', { id: uid + k, maskUnits: 'userSpaceOnUse', x: -40, y: -40, width: o.w + 80, height: o.h + 120 }, defs);
            el('rect', { x: -40, y: -40, width: o.w + 80, height: o.h + 120, fill: '#fff' }, m);
            shapes.slice(k + 1).forEach(function (f) { el('path', { d: f.area, fill: '#000' }, m); });
            // public repos open their page; private ones open the profile, so their names never leak
            var href = s.r.private ? o.profile : o.profile + '/' + encodeURIComponent(s.r.name);
            var g = el('g', { mask: 'url(#' + uid + k + ')' }, svg);
            var line = el('a', { href: href, target: '_blank', rel: 'noopener', class: 'ridge' }, g);
            el('title', {}, line).textContent = (s.r.private ? 'Private repository · open profile' : s.r.name) + ' · ' + s.r.total + ' commits';
            el('path', { d: s.line, class: 'ridge-hit' }, line);                    // wide invisible stroke: easy to hover
            el('path', { d: s.line, class: 'ridge-line' }, line);
            // name above its line at the left (drawn unmasked, with a paper halo); commit total at the right
            var tag = el('a', { href: href, target: '_blank', rel: 'noopener', class: 'ridge' }, svg);
            el('text', { x: 0, y: s.base - 6, class: s.r.private ? 'rlbl is-private' : 'rlbl' }, tag).textContent = s.r.name;
            el('text', { x: o.w + 18, y: s.base + 4, class: 'lbl' }, tag).textContent = s.r.total;
            [line, tag].forEach(function (a) {
                a.addEventListener('mouseenter', function () { line.classList.add('is-hot'); tag.classList.add('is-hot'); });
                a.addEventListener('mouseleave', function () { line.classList.remove('is-hot'); tag.classList.remove('is-hot'); });
            });
        });
        // today: the same orange mark as the calendar's ring, dropped through every line
        var tx = px(n - 1);
        el('line', { x1: tx, y1: 0, x2: tx, y2: o.h, stroke: 'var(--orange)', 'stroke-width': 1.5, 'stroke-dasharray': '3 4' }, svg);
        parent.appendChild(svg);
    }

    // A — SYS.LOG: the year as a dotted measuring grid, then each active repo's year as a ridgeline
    function slideA(root, data, st) {
        var days = data.contributions.days;
        root.innerHTML = head('SYS.LOG // GITHUB', data);
        var profile = data.user.url;
        heat(root, days, { x: 146, y: 272, cell: 21.5, link: function (d) { return profile + '?tab=overview&from=' + d.d + '&to=' + d.d; } });
        var act = data.activity || [];
        root.insertAdjacentHTML('beforeend',
            '<div class="gh-stat" style="top:452px"><b>' + fmt(data.contributions.total) + '</b> contributions in the last year<span> · ' +
            (st.current > 1 ? st.current + '-day streak · ' : 'longest streak ' + st.longest + ' days · ') + 'busiest ' + day(st.best.d) +
            ' · ' + act.length + ' active repos</span></div>');
        if (act.length) ridges(root, act, days.length, { profile: profile, x: 146, y: 510, w: Math.ceil(days.length / 7) * 21.5, h: 330, cell: 21.5, amp: 70, rows: 9 });
    }

    fetch('data/github.json').then(function (r) { return r.json(); }).then(function (data) {
        var st = stats(data.contributions.days);
        slideA(document.querySelector('.gh-a'), data, st);
    }).catch(function (e) { console.warn('github slides:', e); });
})();
