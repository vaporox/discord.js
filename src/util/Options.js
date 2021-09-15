'use strict';

const { DefaultRestOptions } = require('@discordjs/rest');

/**
 * @typedef {Function} CacheFactory
 * @param {Function} manager The manager class the cache is being requested from.
 * @param {Function} holds The class that the cache will hold.
 * @returns {Collection} A Collection used to store the cache of the manager.
 */

/**
 * WebSocket options (these are left as snake_case to match the API)
 * @typedef {Object} WebsocketOptions
 * @property {number} [large_threshold=50] Number of members in a guild after which offline users will no longer be
 * sent in the initial guild member list, must be between 50 and 250
 */

/**
 * @external RESTOptions
 * @see {@link https://www.npmjs.com/package/@discordjs/rest}
 */

/**
 * Options for a client.
 * @typedef {Object} ClientOptions
 * @property {number|number[]|string} [shards] The shard's id to run, or an array of shard ids. If not specified,
 * the client will spawn {@link ClientOptions#shardCount} shards. If set to `auto`, it will fetch the
 * recommended amount of shards from Discord and spawn that amount
 * @property {number} [shardCount=1] The total amount of shards used by all processes of this bot
 * (e.g. recommended shard count, shard count of the ShardingManager)
 * @property {CacheFactory} [makeCache] Function to create a cache.
 * You can use your own function, or the {@link Options} class to customize the Collection used for the cache.
 * <warn>Overriding the cache used in `GuildManager`, `ChannelManager`, `GuildChannelManager`, `RoleManager`,
 * and `PermissionOverwriteManager` is unsupported and **will** break functionality</warn>
 * @property {number} [messageCacheLifetime=0] DEPRECATED: Use `makeCache` with a `LimitedCollection` instead.
 * How long a message should stay in the cache until it is considered sweepable (in seconds, 0 for forever)
 * @property {number} [messageSweepInterval=0] DEPRECATED: Use `makeCache` with a `LimitedCollection` instead.
 * How frequently to remove messages from the cache that are older than the message cache lifetime
 * (in seconds, 0 for never)
 * @property {MessageMentionOptions} [allowedMentions] Default value for {@link MessageOptions#allowedMentions}
 * @property {PartialType[]} [partials] Structures allowed to be partial. This means events can be emitted even when
 * they're missing all the data for a particular structure. See the "Partial Structures" topic on the
 * [guide](https://discordjs.guide/popular-topics/partials.html) for some
 * important usage information, as partials require you to put checks in place when handling data.
 * @property {number} [restWsBridgeTimeout=5000] Maximum time permitted between REST responses and their
 * corresponding websocket events
 * @property {boolean} [failIfNotExists=true] Default value for {@link ReplyMessageOptions#failIfNotExists}
 * @property {PresenceData} [presence={}] Presence data to use upon login
 * @property {IntentsResolvable} intents Intents to enable for this connection
 * @property {WebsocketOptions} [ws] Options for the WebSocket
 * @property {RESTOptions} [rest] Options for the REST manager
 */

/**
 * Contains various utilities for client options.
 */
class Options extends null {
  /**
   * The default client options.
   * @returns {ClientOptions}
   */
  static createDefault() {
    return {
      shardCount: 1,
      makeCache: this.cacheWithLimits(this.defaultMakeCacheSettings),
      messageCacheLifetime: 0,
      messageSweepInterval: 0,
      partials: [],
      restWsBridgeTimeout: 5_000,
      failIfNotExists: true,
      presence: {},
      ws: {
        large_threshold: 50,
        compress: false,
        properties: {
          $os: process.platform,
          $browser: 'discord.js',
          $device: 'discord.js',
        },
        version: 9,
      },
      rest: DefaultRestOptions,
    };
  }

  /**
   * Create a cache factory using predefined settings to sweep or limit.
   * @param {Object<string, LimitedCollectionOptions|number>} [settings={}] Settings passed to the relevant constructor.
   * If no setting is provided for a manager, it uses Collection.
   * If a number is provided for a manager, it uses that number as the max size for a LimitedCollection.
   * If LimitedCollectionOptions are provided for a manager, it uses those settings to form a LimitedCollection.
   * @returns {CacheFactory}
   * @example
   * // Store up to 200 messages per channel and discard archived threads if they were archived more than 4 hours ago.
   * // Note archived threads will remain in the guild and client caches with these settings
   * Options.cacheWithLimits({
   *    MessageManager: 200,
   *    ThreadManager: {
   *      sweepInterval: 3600,
   *      sweepFilter: LimitedCollection.filterByLifetime({
   *        getComparisonTimestamp: e => e.archiveTimestamp,
   *        excludeFromSweep: e => !e.archived,
   *      }),
   *    },
   *  });
   * @example
   * // Sweep messages every 5 minutes, removing messages that have not been edited or created in the last 30 minutes
   * Options.cacheWithLimits({
   *   // Keep default thread sweeping behavior
   *   ...Options.defaultMakeCacheSettings,
   *   // Override MessageManager
   *   MessageManager: {
   *     sweepInterval: 300,
   *     sweepFilter: LimitedCollection.filterByLifetime({
   *       lifetime: 1800,
   *       getComparisonTimestamp: e => e.editedTimestamp ?? e.createdTimestamp,
   *     })
   *   }
   * });
   */
  static cacheWithLimits(settings = {}) {
    const { Collection } = require('@discordjs/collection');
    const LimitedCollection = require('./LimitedCollection');

    return manager => {
      const setting = settings[manager.name];
      /* eslint-disable-next-line eqeqeq */
      if (setting == null) {
        return new Collection();
      }
      if (typeof setting === 'number') {
        if (setting === Infinity) {
          return new Collection();
        }
        return new LimitedCollection({ maxSize: setting });
      }
      /* eslint-disable eqeqeq */
      const noSweeping =
        setting.sweepFilter == null ||
        setting.sweepInterval == null ||
        setting.sweepInterval <= 0 ||
        setting.sweepInterval === Infinity;
      const noLimit = setting.maxSize == null || setting.maxSize === Infinity;
      /* eslint-enable eqeqeq */
      if (noSweeping && noLimit) {
        return new Collection();
      }
      return new LimitedCollection(setting);
    };
  }

  /**
   * Create a cache factory that always caches everything.
   * @returns {CacheFactory}
   */
  static cacheEverything() {
    const { Collection } = require('@discordjs/collection');
    return () => new Collection();
  }

  /**
   * The default settings passed to {@link Options.cacheWithLimits}.
   * The caches that this changes are:
   * * `MessageManager` - Limit to 200 messages
   * * `ChannelManager` - Sweep archived threads
   * * `GuildChannelManager` - Sweep archived threads
   * * `ThreadManager` - Sweep archived threads
   * <info>If you want to keep default behavior and add on top of it you can use this object and add on to it, e.g.
   * `makeCache: Options.cacheWithLimits({ ...Options.defaultMakeCacheSettings, ReactionManager: 0 })`</info>
   * @type {Object<string, LimitedCollectionOptions|number>}
   */
  static get defaultMakeCacheSettings() {
    return {
      MessageManager: 200,
      ChannelManager: {
        sweepInterval: 3600,
        sweepFilter: require('./Util').archivedThreadSweepFilter(),
      },
      GuildChannelManager: {
        sweepInterval: 3600,
        sweepFilter: require('./Util').archivedThreadSweepFilter(),
      },
      ThreadManager: {
        sweepInterval: 3600,
        sweepFilter: require('./Util').archivedThreadSweepFilter(),
      },
    };
  }
}

module.exports = Options;
