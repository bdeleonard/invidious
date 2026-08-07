'use strict';
// Lightweight, progressive-enhancement script for the Popular/Trending
// discovery feeds. No frameworks, no polling storms: a couple of small
// JSON fetches (reusing the existing /api/v1/popular and /api/v1/trending
// endpoints) at most, plus purely client-side personalization based on
// data already sitting in localStorage.
(function () {
    var container = document.querySelector('[data-discovery-feed]');
    if (!container) return;

    var RECENT_CHANNELS_KEY = 'iv_recent_channels';
    var HIDE_WATCHED_KEY = 'iv_hide_watched_discovery';
    var RECENT_CHANNEL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
    var WATCHED_THRESHOLD = 0.9;

    var apiEndpoint = container.getAttribute('data-api-endpoint');
    var newVideosLabel = container.getAttribute('data-new-videos-label') || 'New videos available';
    var refreshLabel = container.getAttribute('data-refresh-label') || 'Refresh';
    var hideWatchedLabel = container.getAttribute('data-hide-watched-label') || 'Hide watched';
    var familiarLabel = container.getAttribute('data-familiar-label') || 'From a channel you watch';

    var cards = Array.from(container.querySelectorAll('[data-video-id]'));
    var initialIds = {};
    cards.forEach(function (card) { initialIds[card.getAttribute('data-video-id')] = true; });

    /* ---------------------------------------------------------------- */
    /* Personalization: highlight cards from recently-watched channels   */
    /* ---------------------------------------------------------------- */
    function highlightFamiliarChannels() {
        var recent = helpers.storage.get(RECENT_CHANNELS_KEY);
        if (!Array.isArray(recent) || recent.length === 0) return;

        var now = Date.now();
        var recentUcids = {};
        recent.forEach(function (entry) {
            if (entry && entry.ucid && (now - entry.ts) <= RECENT_CHANNEL_WINDOW_MS) {
                recentUcids[entry.ucid] = true;
            }
        });

        cards.forEach(function (card) {
            var ucid = card.getAttribute('data-ucid');
            if (!ucid || !recentUcids[ucid]) return;

            card.classList.add('iv-familiar-channel');
            if (!card.querySelector('.iv-familiar-badge')) {
                var badge = document.createElement('span');
                badge.className = 'iv-familiar-badge';
                badge.textContent = familiarLabel;
                card.appendChild(badge);
            }
        });
    }

    /* ---------------------------------------------------------------- */
    /* "Hide watched" toggle, reusing the existing playback-position     */
    /* storage (same data watched_indicator.js already reads)            */
    /* ---------------------------------------------------------------- */
    function markWatchedCards() {
        var positions = helpers.storage.get('save_player_pos') || {};

        cards.forEach(function (card) {
            var id = card.getAttribute('data-video-id');
            var length = parseInt(card.getAttribute('data-length-seconds'), 10);
            var watchedSeconds = positions[id];

            if (!length || !watchedSeconds) return;
            if ((watchedSeconds / length) >= WATCHED_THRESHOLD) {
                cardWrapper(card).classList.add('iv-watched-video');
            }
        });
    }

    function cardWrapper(card) {
        // .thumbnail > .h-box > .pure-u-1 (see components/item.ecr)
        return card.parentElement.parentElement;
    }

    function addHideWatchedToggle() {
        if (!cards.some(function (card) { return cardWrapper(card).classList.contains('iv-watched-video'); })) {
            return;
        }

        var toggleWrap = document.createElement('label');
        toggleWrap.className = 'discovery-hide-watched';

        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = helpers.storage.get(HIDE_WATCHED_KEY) === true;

        toggleWrap.appendChild(checkbox);
        toggleWrap.appendChild(document.createTextNode(' ' + hideWatchedLabel));

        function apply() {
            container.classList.toggle('iv-hide-watched', checkbox.checked);
        }

        checkbox.addEventListener('change', function () {
            helpers.storage.set(HIDE_WATCHED_KEY, checkbox.checked);
            apply();
        });

        apply();
        container.insertBefore(toggleWrap, container.firstChild);
    }

    /* ---------------------------------------------------------------- */
    /* "N new videos available" banner - polled sparingly                */
    /* ---------------------------------------------------------------- */
    function showNewVideosBanner(count) {
        if (container.querySelector('.discovery-banner')) return;

        var banner = document.createElement('div');
        banner.className = 'discovery-banner';

        var text = document.createElement('span');
        text.textContent = count + ' ' + newVideosLabel;

        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'pure-button pure-button-primary';
        button.textContent = refreshLabel;
        button.addEventListener('click', function () { window.location.reload(); });

        banner.appendChild(text);
        banner.appendChild(button);
        container.insertBefore(banner, container.firstChild);
    }

    function checkForNewVideos(attemptsLeft) {
        if (!apiEndpoint || attemptsLeft <= 0) return;
        if (document.visibilityState !== 'visible') {
            scheduleNextCheck(attemptsLeft);
            return;
        }

        helpers.xhr('GET', apiEndpoint, {}, {
            on200: function (response) {
                if (!Array.isArray(response)) return;

                var newCount = 0;
                response.forEach(function (video) {
                    if (video && video.videoId && !initialIds[video.videoId]) newCount++;
                });

                if (newCount > 0) {
                    showNewVideosBanner(newCount);
                    return; // Stop polling once we've told the user
                }

                scheduleNextCheck(attemptsLeft - 1);
            },
            onNon200: function () { scheduleNextCheck(attemptsLeft - 1); },
            onError: function () { scheduleNextCheck(attemptsLeft - 1); },
            onTimeout: function () { scheduleNextCheck(attemptsLeft - 1); }
        });
    }

    function scheduleNextCheck(attemptsLeft) {
        if (attemptsLeft <= 0) return;
        // Poll every 3 minutes, up to a handful of times - never a tight loop.
        setTimeout(function () { checkForNewVideos(attemptsLeft); }, 3 * 60 * 1000);
    }

    highlightFamiliarChannels();
    markWatchedCards();
    addHideWatchedToggle();
    scheduleNextCheck(6);
})();
