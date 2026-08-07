'use strict';
// ui-enhancements.js
// ---------------------------------------------------------------------------
// Site-wide, lightweight visual/interaction polish. Pure vanilla JS, no
// dependencies. Safe to load on every page - all logic feature-detects and
// no-ops gracefully when elements aren't present.
// ---------------------------------------------------------------------------

(function () {
    var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // -----------------------------------------------------------------
    // Skeleton loading for thumbnails
    // -----------------------------------------------------------------
    document.querySelectorAll('img.thumbnail').forEach(function (img) {
        if (img.complete) return;

        var box = img.closest('div.thumbnail');
        img.classList.add('iv-loading');
        if (box) box.classList.add('iv-loading');

        function clear() {
            img.classList.remove('iv-loading');
            if (box) box.classList.remove('iv-loading');
        }

        img.addEventListener('load', clear, {once: true});
        img.addEventListener('error', clear, {once: true});
    });

    // -----------------------------------------------------------------
    // Sticky navbar elevation once the page has scrolled
    // -----------------------------------------------------------------
    var ticking = false;
    function updateScrollState() {
        document.body.classList.toggle('iv-scrolled', window.scrollY > 4);
        ticking = false;
    }
    addEventListener('scroll', function () {
        if (!ticking) {
            requestAnimationFrame(updateScrollState);
            ticking = true;
        }
    }, {passive: true});
    updateScrollState();

    // -----------------------------------------------------------------
    // Reveal-on-scroll for card thumbnails (subtle fade/slide-in)
    // -----------------------------------------------------------------
    if (!reduceMotion && 'IntersectionObserver' in window) {
        var cards = document.querySelectorAll('div.thumbnail');
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('iv-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {rootMargin: '120px 0px'});

        cards.forEach(function (card) {
            card.classList.add('iv-reveal');
            observer.observe(card);
        });
    }
})();
