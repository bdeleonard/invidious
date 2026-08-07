'use strict';
// navigation.js
// ---------------------------------------------------------------------------
// Lightweight navigation/UX enhancements: theater mode, floating prev/next
// controls on the watch page, a keyboard shortcuts overlay and a subtle
// page-transition indicator for regular server-rendered navigation.
// No SPA routing - normal <a href> navigation is preserved, we only add a
// short, reduced-motion-aware fade + progress bar before following the link.
// ---------------------------------------------------------------------------

(function () {
    var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // -----------------------------------------------------------------
    // Lightweight page-transition indicator (site-wide)
    // -----------------------------------------------------------------
    function initPageTransitions() {
        var bar = document.createElement('div');
        bar.id = 'iv-progress-bar';
        document.body.appendChild(bar);

        document.addEventListener('click', function (e) {
            if (e.defaultPrevented || e.button !== 0) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

            var a = e.target.closest && e.target.closest('a[href]');
            if (!a || a.target === '_blank' || a.hasAttribute('download')) return;

            var href = a.getAttribute('href');
            if (!href || href.charAt(0) === '#') return;

            var url;
            try {
                url = new URL(a.href, location.href);
            } catch (err) {
                return;
            }
            if (url.origin !== location.origin) return;

            e.preventDefault();
            bar.classList.add('iv-active');
            bar.style.width = '75%';

            setTimeout(function () {
                location.href = a.href;
            }, reduceMotion ? 0 : 140);
        });

        addEventListener('pageshow', function () {
            bar.style.width = '0%';
            bar.classList.remove('iv-active');
        });
    }

    // -----------------------------------------------------------------
    // Keyboard shortcuts overlay (watch page only)
    // -----------------------------------------------------------------
    function initShortcutsOverlay() {
        var overlay = document.createElement('div');
        overlay.id = 'iv-shortcuts-overlay';
        overlay.innerHTML =
            '<div class="iv-panel" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">' +
            '<h3>Keyboard shortcuts</h3>' +
            '<dl>' +
            '<dt>space / k</dt><dd>Play / pause</dd>' +
            '<dt>&larr; / &rarr;</dt><dd>Seek 5s</dd>' +
            '<dt>j / l</dt><dd>Seek 10s</dd>' +
            '<dt>n / p</dt><dd>Next / previous video</dd>' +
            '<dt>f</dt><dd>Fullscreen</dd>' +
            '<dt>t</dt><dd>Theater mode</dd>' +
            '<dt>m</dt><dd>Mute</dd>' +
            '<dt>?</dt><dd>Toggle this help</dd>' +
            '</dl></div>';
        document.body.appendChild(overlay);

        function toggle() {
            overlay.classList.toggle('iv-visible');
        }

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) toggle();
        });

        addEventListener('keydown', function (e) {
            if (e.target.tagName.toLowerCase() === 'input') return;
            if (e.key === '?') {
                e.preventDefault();
                toggle();
            } else if (e.key === 'Escape') {
                overlay.classList.remove('iv-visible');
            }
        });
    }

    // -----------------------------------------------------------------
    // Theater mode toggle, persisted across page loads
    // -----------------------------------------------------------------
    function initTheaterMode(playerContainer) {
        if (helpers.storage.get('iv_theater_mode')) {
            document.body.classList.add('iv-theater');
        }

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'iv-theater-toggle';
        btn.title = 'Theater mode (t)';
        btn.setAttribute('aria-label', 'Toggle theater mode');
        btn.innerHTML = '<i class="icon ion-ios-expand"></i>';
        playerContainer.appendChild(btn);

        function refreshIcon() {
            var active = document.body.classList.contains('iv-theater');
            btn.innerHTML = '<i class="icon ' + (active ? 'ion-ios-contract' : 'ion-ios-expand') + '"></i>';
        }

        function toggle() {
            var active = document.body.classList.toggle('iv-theater');
            helpers.storage.set('iv_theater_mode', active);
            refreshIcon();
        }

        btn.addEventListener('click', toggle);
        refreshIcon();

        addEventListener('keydown', function (e) {
            if (e.target.tagName.toLowerCase() === 'input') return;
            if (e.key === 't') {
                e.preventDefault();
                toggle();
            }
        });
    }

    // -----------------------------------------------------------------
    // Floating previous/next buttons, derived from data already on the
    // page (video_data JSON + the playlist sidebar DOM). No new requests,
    // no backend changes.
    // -----------------------------------------------------------------
    function initWatchNav(playerContainer) {
        if (typeof video_data === 'undefined') return;

        var prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'iv-watch-nav iv-prev';
        prevBtn.title = 'Previous video (p)';
        prevBtn.setAttribute('aria-label', 'Previous video');
        prevBtn.innerHTML = '<i class="icon ion-ios-arrow-back"></i>';
        prevBtn.hidden = true;

        var nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'iv-watch-nav iv-next';
        nextBtn.title = 'Next video (n)';
        nextBtn.setAttribute('aria-label', 'Next video');
        nextBtn.innerHTML = '<i class="icon ion-ios-arrow-forward"></i>';
        nextBtn.hidden = true;

        playerContainer.appendChild(prevBtn);
        playerContainer.appendChild(nextBtn);

        function playlistHref(direction) {
            var playlist = document.getElementById('playlist');
            var current = document.getElementById(video_data.id);
            if (!playlist || !current) return null;

            var sibling = direction === 'next' ? current.nextElementSibling : current.previousElementSibling;
            var link = sibling && sibling.querySelector('a[href]');
            return link ? link.getAttribute('href') : null;
        }

        function refresh() {
            var prevHref = playlistHref('prev');
            prevBtn.hidden = !prevHref;
            if (prevHref) prevBtn.onclick = function () { location.assign(prevHref); };

            var nextHref = playlistHref('next');
            if (nextHref) {
                nextBtn.hidden = false;
                nextBtn.onclick = function () { location.assign(nextHref); };
            } else if (video_data.next_video && typeof next_video === 'function') {
                nextBtn.hidden = false;
                nextBtn.onclick = function () { next_video(); };
            } else {
                nextBtn.hidden = true;
            }
        }

        refresh();

        var playlistEl = document.getElementById('playlist');
        if (playlistEl && 'MutationObserver' in window) {
            new MutationObserver(refresh).observe(playlistEl, {childList: true});
        }

        addEventListener('keydown', function (e) {
            if (e.target.tagName.toLowerCase() === 'input') return;
            if (e.key === 'n' && !nextBtn.hidden) {
                e.preventDefault();
                nextBtn.click();
            } else if (e.key === 'p' && !prevBtn.hidden) {
                e.preventDefault();
                prevBtn.click();
            }
        });
    }

    initPageTransitions();

    var playerContainer = document.getElementById('player-container');
    if (playerContainer) {
        playerContainer.style.position = playerContainer.style.position || 'relative';
        initTheaterMode(playerContainer);
        initWatchNav(playerContainer);
        initShortcutsOverlay();
    }
})();
