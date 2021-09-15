'use strict';

const EventEmitter = require('events');
const { REST, RESTEvents } = require('@discordjs/rest');
const { Events } = require('../util/Constants');
const Options = require('../util/Options');
const Util = require('../util/Util');

/**
 * The base class for all clients.
 * @extends {EventEmitter}
 */
class BaseClient extends EventEmitter {
  constructor(options = {}) {
    super();

    /**
     * The options the client was instantiated with
     * @type {ClientOptions}
     */
    this.options = Util.mergeDefault(Options.createDefault(), options);

    /**
     * @external REST
     * @see {@link https://www.npmjs.com/package/@discordjs/rest}
     */

    /**
     * @external RateLimitData
     * @see {@link https://www.npmjs.com/package/@discordjs/rest}
     */

    /**
     * Emitted when the client hits a rate limit while making a request
     * @event Client#rateLimit
     * @param {RateLimitData} rateLimitData Object containing the rate limit info
     */

    /**
     * The REST manager of the client
     * @type {REST}
     */
    this.rest = new REST(this.options.rest)
      .on(RESTEvents.Debug, data => this.emit(Events.DEBUG, data))
      .on(RESTEvents.RateLimited, data => this.emit(Events.RATE_LIMIT, data));
  }

  /**
   * Increments max listeners by one, if they are not zero.
   * @private
   */
  incrementMaxListeners() {
    const maxListeners = this.getMaxListeners();
    if (maxListeners !== 0) {
      this.setMaxListeners(maxListeners + 1);
    }
  }

  /**
   * Decrements max listeners by one, if they are not zero.
   * @private
   */
  decrementMaxListeners() {
    const maxListeners = this.getMaxListeners();
    if (maxListeners !== 0) {
      this.setMaxListeners(maxListeners - 1);
    }
  }

  toJSON(...props) {
    return Util.flatten(this, { domain: false }, ...props);
  }
}

module.exports = BaseClient;
