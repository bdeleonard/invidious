# Lightweight ranking/shuffling helpers for the Popular/Trending discovery
# feeds. Pure in-memory math on top of data we already fetch - no extra
# DB queries and no extra calls to YouTube.
module Invidious::Discovery
  extend self

  # Half-life (in hours) used for the freshness decay below. A video loses
  # half its "freshness" weight every `FRESHNESS_HALFLIFE_HOURS` hours.
  FRESHNESS_HALFLIFE_HOURS = 30.0

  # Returns a relevance score for a video, mixing freshness with (log-scaled)
  # view count so that popular *and* recent videos both surface, without
  # simply sorting by views.
  def score(video, now : Time = Time.utc) : Float64
    age_hours = Math.max((now - video.published).total_hours, 0.0)
    freshness = Math.pow(0.5, age_hours / FRESHNESS_HALFLIFE_HOURS)

    views = video.responds_to?(:views) ? (video.views || 0_i64) : 0_i64
    popularity = Math.log(views.to_f + 2.0)

    (freshness * 2.0) + (popularity * 0.35)
  end

  # Weighted random sample (without replacement) using the Efraimidis-Spirakis
  # algorithm: each item gets a key `rand ** (1 / weight)`, and we keep the
  # `count` items with the highest keys. This is O(n log n) on a small
  # in-memory pool (a few hundred items at most), so it's effectively free,
  # and it makes repeated visits feel different without ignoring relevance.
  def weighted_sample(videos : Array(T), count : Int32, now : Time = Time.utc) : Array(T) forall T
    return videos.first(count) if videos.size <= count

    keyed = videos.map do |video|
      weight = Math.max(score(video, now), 0.001)
      key = Math.pow(Random.rand.to_f, 1.0 / weight)
      {key, video}
    end

    keyed.sort_by! { |key, _| -key }
    keyed.first(count).map { |_, video| video }
  end

  # Videos published within the given time span, most recent first.
  def recent(videos : Array(T), within : Time::Span, limit : Int32, now : Time = Time.utc) : Array(T) forall T
    videos
      .select { |video| (now - video.published) <= within }
      .sort_by { |video| -video.published.to_unix }
      .first(limit)
  end

  # Distinct channels represented in the pool, ordered by their best-scoring
  # video, for a lightweight "Popular channels" chip list.
  def top_channels(videos : Array(T), limit : Int32, now : Time = Time.utc) : Array(T) forall T
    best_per_channel = {} of String => T

    videos.each do |video|
      existing = best_per_channel[video.ucid]?
      if existing.nil? || score(video, now) > score(existing, now)
        best_per_channel[video.ucid] = video
      end
    end

    best_per_channel.values.sort_by { |video| -score(video, now) }.first(limit)
  end
end
