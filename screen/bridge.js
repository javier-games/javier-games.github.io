// Forwards pointer and key events to the 3D site around the monitor (see the 'message' listener in
// src/Application/World/MonitorScreen.ts), so the camera and sounds react while the visitor uses the screen.
(function () {
    if (window.parent === window) return;               // opened on its own, not inside the monitor
    var post = function (data) { window.parent.postMessage(data, '*'); };
    document.addEventListener('mousemove', function (e) { post({ type: 'mousemove', clientX: e.clientX, clientY: e.clientY }); });
    document.addEventListener('mousedown', function () { post({ type: 'mousedown' }); });
    document.addEventListener('mouseup', function () { post({ type: 'mouseup' }); });
    document.addEventListener('keydown', function (e) { post({ type: 'keydown', key: e.key }); });
    document.addEventListener('keyup', function (e) { post({ type: 'keyup', key: e.key }); });
})();
