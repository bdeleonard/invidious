'use strict';
// Tiny, isolated script: records the channel of the video being watched into
// localStorage so the Popular/Trending pages can lightly highlight cards
// from channels the visitor already watches - all client-side, no server
// storage, no tracking sent anywhere.
(function () {
    var STORAGE_KEY = 'iv_recent_channels';
    var MAX_ENTRIES = 40;
    var scriptEl = document.currentScript;
    if (!scriptEl) return;

    var ucid = scriptEl.getAttribute('data-ucid');
    if (!ucid) return;

    var entries = helpers.storage.get(STORAGE_KEY) || [];
    if (!Array.isArray(entries)) entries = [];

    // Drop older entries for this channel, then push the freshest one to the front.
    entries = entries.filter(function (entry) { return entry && entry.ucid !== ucid; });
    entries.unshift({ ucid: ucid, ts: Date.now() });

    if (entries.length > MAX_ENTRIES) entries = entries.slice(0, MAX_ENTRIES);

    helpers.storage.set(STORAGE_KEY, entries);
})();
