// Live readouts and canvas scaling for the screen site.
(function () {
    var canvas = document.getElementById('canvas');
    function fit() {                                    // inside the monitor the iframe is exactly 1952 x 992; elsewhere scale to fit
        var s = Math.min(window.innerWidth / 1952, window.innerHeight / 992);
        canvas.style.transform = 'translate(' + (window.innerWidth - 1952 * s) / 2 + 'px,' + (window.innerHeight - 992 * s) / 2 + 'px) scale(' + s + ')';
    }
    window.addEventListener('resize', fit); fit();

    var clock = document.getElementById('clock'), uptime = document.getElementById('uptime'), t0 = performance.now();
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    // once a second, on the second: each update repaints, which is costly on phones while the monitor moves in 3D
    function tick() {
        var d = new Date();
        clock.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
        uptime.textContent = Math.round((performance.now() - t0) / 1000);
        setTimeout(tick, 1000 - d.getMilliseconds());
    }
    tick();

    // blueprint labels: each link shows its real size, and an "open" hint while hovered
    var quick = document.querySelector('.quick');
    if (quick) {
        quick.querySelector('.bp-size').textContent = quick.offsetWidth + ' × ' + quick.offsetHeight;
        quick.querySelectorAll('.bp-btn').forEach(function (btn) {
            var dim = btn.querySelector('.dim'), size = btn.offsetWidth + ' × ' + btn.offsetHeight;
            var show = function (on) { dim.textContent = on ? 'OPEN IN NEW TAB ↗' : size; };
            ['mouseenter', 'focus'].forEach(function (e) { btn.addEventListener(e, function () { show(true); }); });
            ['mouseleave', 'blur'].forEach(function (e) { btn.addEventListener(e, function () { show(false); }); });
            show(false);
        });
    }

    // carousel: the stage's slides, one pager dot each; click a dot or use the arrow keys. ?slide=N opens on slide N (1-based).
    var slides = Array.prototype.slice.call(document.querySelectorAll('.stage > .section'));
    var pager = document.querySelector('.pager'), title = document.createElement('div'), current = 0;
    title.className = 'pager-title tiny'; pager.parentNode.appendChild(title);
    var dots = slides.map(function (s, i) {
        var b = document.createElement('button');
        b.type = 'button'; b.setAttribute('aria-label', s.dataset.title || 'Slide ' + (i + 1));
        b.addEventListener('click', function () { show(i); });
        pager.appendChild(b); return b;
    });
    function show(i) {
        current = (i + slides.length) % slides.length;
        slides.forEach(function (s, k) { s.classList.toggle('is-active', k === current); s.setAttribute('aria-hidden', k !== current); });
        dots.forEach(function (d, k) { d.classList.toggle('is-on', k === current); d.setAttribute('aria-current', k === current); });
        title.textContent = (current + 1) + ' / ' + slides.length + ' · ' + (slides[current].dataset.title || '');
    }
    document.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') show(current + 1);
        if (e.key === 'ArrowLeft') show(current - 1);
    });
    show((parseInt(new URLSearchParams(location.search).get('slide'), 10) || 1) - 1);
})();
