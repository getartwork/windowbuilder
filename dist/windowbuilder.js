;(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.Windowbuilder = factory();
  }
}(this, function() {
(function(window, undefined) {
    'use strict';

    if (!window) return; // Server side

    var $ = window.$;
    var _baron = baron; // Stored baron value for noConflict usage
    var pos = ['left', 'top', 'right', 'bottom', 'width', 'height'];
    // Global store for all baron instances (to be able to dispose them on html-nodes)
    var instances = [];
    var origin = {
        v: { // Vertical
            x: 'Y', pos: pos[1], oppos: pos[3], crossPos: pos[0], crossOpPos: pos[2],
            size: pos[5],
            crossSize: pos[4], crossMinSize: 'min-' + pos[4], crossMaxSize: 'max-' + pos[4],
            client: 'clientHeight', crossClient: 'clientWidth',
            scrollEdge: 'scrollLeft',
            offset: 'offsetHeight', crossOffset: 'offsetWidth', offsetPos: 'offsetTop',
            scroll: 'scrollTop', scrollSize: 'scrollHeight'
        },
        h: { // Horizontal
            x: 'X', pos: pos[0], oppos: pos[2], crossPos: pos[1], crossOpPos: pos[3],
            size: pos[4],
            crossSize: pos[5], crossMinSize: 'min-' + pos[5], crossMaxSize: 'max-' + pos[5],
            client: 'clientWidth', crossClient: 'clientHeight',
            scrollEdge: 'scrollTop',
            offset: 'offsetWidth', crossOffset: 'offsetHeight', offsetPos: 'offsetLeft',
            scroll: 'scrollLeft', scrollSize: 'scrollWidth'
        }
    };

    // Some ugly vars
    var opera12maxScrollbarSize = 17;
    // I hate you https://github.com/Diokuz/baron/issues/110
    var macmsxffScrollbarSize = 15;
    var macosxffRe = /[\s\S]*Macintosh[\s\S]*\) Gecko[\s\S]*/;
    var isMacFF = macosxffRe.test(window.navigator.userAgent);

    // removeIf(production)
    var log = function() {
        baron.fn.log.apply(this, arguments);
    };
    var liveBarons = 0;
    var shownErrors = {
        liveTooMany: false,
        allTooMany: false
    };
    // endRemoveIf(production)

    // window.baron and jQuery.fn.baron points to this function
    function baron(params) {
        var jQueryMode;
        var roots;
        var withParams = !!params;
        var defaultParams = {
            $: window.jQuery,
            direction: 'v',
            barOnCls: '_scrollbar',
            resizeDebounce: 0,
            event: function(elem, event, func, mode) {
                params.$(elem)[mode || 'on'](event, func);
            },
            cssGuru: false,
            impact: 'scroller',
            position: 'static'
        };

        params = params || {};

        // Extending default params by user-defined params
        for (var key in defaultParams) {
            if (params[key] === undefined) {
                params[key] = defaultParams[key];
            }
        };

        // removeIf(production)
        if (!params.$) {
            log('error', [
                'no jQuery nor params.$ detected',
                'https://github.com/Diokuz/baron/blob/master/docs/logs/no-jquery-detected.md'
            ].join(', '), params);
        }
        if (params.position == 'absolute' && params.impact == 'clipper') {
            log('error', [
                'Simultaneous use of `absolute` position and `clipper` impact values detected.',
                'Those values cannot be used together.',
                'See more https://github.com/Diokuz/baron/issues/138'
            ].join(' '), params);
        }
        // endRemoveIf(production)

        // this - something or jQuery instance
        jQueryMode = params.$ && this instanceof params.$;

        if (params._chain) {
            roots = params.root;
        } else if (jQueryMode) {
            params.root = roots = this;
        } else if (params.$) {
            roots = params.$(params.root || params.scroller);
        } else {
            roots = []; // noop mode, like jQuery when no matched html-nodes found
        }

        var instance = new baron.fn.constructor(roots, params, withParams);

        if (instance.autoUpdate) {
            instance.autoUpdate();
        }

        return instance;
    }

    function arrayEach(obj, iterator) {
        var i = 0;

        if (obj.length === undefined || obj === window) obj = [obj];

        while (obj[i]) {
            iterator.call(this, obj[i], i);
            i++;
        }
    }

    // shortcut for getTime
    function getTime() {
        return new Date().getTime();
    }

    // removeIf(production)
    baron._instances = instances;
    // endRemoveIf(production)

    baron.fn = {
        constructor: function(roots, totalParams, withParams) {
            var params = clone(totalParams);

            // Intrinsic params.event is not the same as totalParams.event
            params.event = function(elems, e, func, mode) {
                arrayEach(elems, function(elem) {
                    totalParams.event(elem, e, func, mode);
                });
            };

            this.length = 0;

            arrayEach.call(this, roots, function(root, i) {
                var attr = manageAttr(root, params.direction);
                var id = +attr; // Could be NaN

                // baron() can return existing instances,
                // @TODO update params on-the-fly
                // https://github.com/Diokuz/baron/issues/124
                if (id == id && attr !== null && instances[id]) {
                    // removeIf(production)
                    if (withParams) {
                        log('error', [
                            'repeated initialization for html-node detected',
                            'https://github.com/Diokuz/baron/blob/master/docs/logs/repeated.md'
                        ].join(', '), totalParams.root);
                    }
                    // endRemoveIf(production)

                    this[i] = instances[id];
                } else {
                    var perInstanceParams = clone(params);

                    // root and scroller can be different nodes
                    if (params.root && params.scroller) {
                        perInstanceParams.scroller = params.$(params.scroller, root);
                        if (!perInstanceParams.scroller.length) {
                            // removeIf(production)
                            console.log('Scroller not found!', root, params.scroller);
                            // endRemoveIf(production)
                            return;
                        }
                    } else {
                        perInstanceParams.scroller = root;
                    }

                    perInstanceParams.root = root;
                    this[i] = init(perInstanceParams);
                }

                this.length = i + 1;
            });

            this.params = params;
        },

        dispose: function() {
            var params = this.params;

            arrayEach(this, function(instance, index) {
                instance.dispose(params);
                instances[index] = null;
            });

            this.params = null;
        },

        update: function() {
            var args = arguments;

            arrayEach(this, function(instance, index) {
                // instance cannot be null, because it is stored by user
                instance.update.apply(instance, args);
            });
        },

        // Restriction: only the same scroller can be used
        baron: function(params) {
            params.root = [];
            if (this.params.root) {
                params.scroller = this.params.scroller;
            }

            arrayEach.call(this, this, function(elem) {
                params.root.push(elem.root);
            });
            params.direction = (this.params.direction == 'v') ? 'h' : 'v';
            params._chain = true;

            return baron(params);
        }
    };

    function manageEvents(item, eventManager, mode) {
        // Creating new functions for one baron item only one time
        item._eventHandlers = item._eventHandlers || [
            {
                // onScroll:
                element: item.scroller,

                handler: function(e) {
                    item.scroll(e);
                },

                type: 'scroll'
            }, {
                // css transitions & animations
                element: item.root,

                handler: function() {
                    item.update();
                },

                type: 'transitionend animationend'
            }, {
                // onKeyup (textarea):
                element: item.scroller,

                handler: function() {
                    item.update();
                },

                type: 'keyup'
            }, {
                // onMouseDown:
                element: item.bar,

                handler: function(e) {
                    e.preventDefault(); // Text selection disabling in Opera
                    item.selection(); // Disable text selection in ie8
                    item.drag.now = 1; // Save private byte
                    if (item.draggingCls) {
                        $(item.root).addClass(item.draggingCls);
                    }
                },

                type: 'touchstart mousedown'
            }, {
                // onMouseUp:
                element: document,

                handler: function() {
                    item.selection(1); // Enable text selection
                    item.drag.now = 0;
                    if (item.draggingCls) {
                        $(item.root).removeClass(item.draggingCls);
                    }
                },

                type: 'mouseup blur touchend'
            }, {
                // onCoordinateReset:
                element: document,

                handler: function(e) {
                    if (e.button != 2) { // Not RM
                        item._pos0(e);
                    }
                },

                type: 'touchstart mousedown'
            }, {
                // onMouseMove:
                element: document,

                handler: function(e) {
                    if (item.drag.now) {
                        item.drag(e);
                    }
                },

                type: 'mousemove touchmove'
            }, {
                // @TODO make one global listener
                // onResize:
                element: window,

                handler: function() {
                    item.update();
                },

                type: 'resize'
            }, {
                // @todo remove
                // sizeChange:
                element: item.root,

                handler: function() {
                    item.update();
                },

                type: 'sizeChange'
            }, {
                // Clipper onScroll bug https://github.com/Diokuz/baron/issues/116
                element: item.clipper,

                handler: function() {
                    item.clipperOnScroll();
                },

                type: 'scroll'
            }
        ];

        arrayEach(item._eventHandlers, function(event) {
            if (event.element) {
                eventManager(event.element, event.type, event.handler, mode);
            }
        });

        // if (item.scroller) {
        //     event(item.scroller, 'scroll', item._eventHandlers.onScroll, mode);
        // }
        // if (item.bar) {
        //     event(item.bar, 'touchstart mousedown', item._eventHandlers.onMouseDown, mode);
        // }
        // event(document, 'mouseup blur touchend', item._eventHandlers.onMouseUp, mode);
        // event(document, 'touchstart mousedown', item._eventHandlers.onCoordinateReset, mode);
        // event(document, 'mousemove touchmove', item._eventHandlers.onMouseMove, mode);
        // event(window, 'resize', item._eventHandlers.onResize, mode);
        // if (item.root) {
        //     event(item.root, 'sizeChange', item._eventHandlers.onResize, mode);
        //     // Custon event for alternate baron update mechanism
        // }
    }

    // set, remove or read baron-specific id-attribute
    // @returns {String|null} - id node value, or null, if there is no attr
    function manageAttr(node, direction, mode, id) {
        var attrName = 'data-baron-' + direction + '-id';

        if (mode == 'on') {
            node.setAttribute(attrName, id);
        } else if (mode == 'off') {
            node.removeAttribute(attrName);
        } else {
            return node.getAttribute(attrName);
        }
    }

    function init(params) {
        // __proto__ of returning object is baron.prototype
        var out = new item.prototype.constructor(params);

        manageEvents(out, params.event, 'on');

        manageAttr(out.root, params.direction, 'on', instances.length);
        instances.push(out);

        // removeIf(production)
        liveBarons++;
        if (liveBarons > 100 && !shownErrors.liveTooMany) {
            log('warn', [
                'You have too many live baron instances on page (' + liveBarons + ')!',
                'Are you forget to dispose some of them?',
                'All baron instances can be found in baron._instances:'
            ].join(' '), instances);
            shownErrors.liveTooMany = true;
        }
        if (instances.length > 1000 && !shownErrors.allTooMany) {
            log('warn', [
                'You have too many inited baron instances on page (' + instances.length + ')!',
                'Some of them are disposed, and thats good news.',
                'but baron.init was call too many times, and thats is bad news.',
                'All baron instances can be found in baron._instances:'
            ].join(' '), instances);
            shownErrors.allTooMany = true;
        }
        // endRemoveIf(production)

        out.update();

        return out;
    }

    function clone(input) {
        var output = {};

        input = input || {};

        for (var key in input) {
            if (input.hasOwnProperty(key)) {
                output[key] = input[key];
            }
        }

        return output;
    }

    function validate(input) {
        var output = clone(input);

        output.event = function(elems, e, func, mode) {
            arrayEach(elems, function(elem) {
                input.event(elem, e, func, mode);
            });
        };

        return output;
    }

    function fire(eventName) {
        /* jshint validthis:true */
        if (this.events && this.events[eventName]) {
            for (var i = 0 ; i < this.events[eventName].length ; i++) {
                var args = Array.prototype.slice.call( arguments, 1 );

                this.events[eventName][i].apply(this, args);
            }
        }
    }

    var item = {};

    item.prototype = {
        // underscore.js realization
        // used in autoUpdate plugin
        _debounce: function(func, wait) {
            var self = this,
                timeout,
                // args, // right now there is no need for arguments
                // context, // and for context
                timestamp;
                // result; // and for result

            var later = function() {
                if (self._disposed) {
                    clearTimeout(timeout);
                    timeout = self = null;
                    return;
                }

                var last = getTime() - timestamp;

                if (last < wait && last >= 0) {
                    timeout = setTimeout(later, wait - last);
                } else {
                    timeout = null;
                    // result = func.apply(context, args);
                    func();
                    // context = args = null;
                }
            };

            return function() {
                // context = this;
                // args = arguments;
                timestamp = getTime();

                if (!timeout) {
                    timeout = setTimeout(later, wait);
                }

                // return result;
            };
        },

        constructor: function(params) {
            var $,
                barPos,
                scrollerPos0,
                track,
                resizePauseTimer,
                scrollingTimer,
                scrollLastFire,
                resizeLastFire,
                oldBarSize;

            resizeLastFire = scrollLastFire = getTime();

            $ = this.$ = params.$;
            this.event = params.event;
            this.events = {};

            function getNode(sel, context) {
                return $(sel, context)[0]; // Can be undefined
            }

            // DOM elements
            this.root = params.root; // Always html node, not just selector
            this.scroller = getNode(params.scroller);
            this.bar = getNode(params.bar, this.root);
            track = this.track = getNode(params.track, this.root);
            if (!this.track && this.bar) {
                track = this.bar.parentNode;
            }
            this.clipper = this.scroller.parentNode;

            // Parameters
            this.direction = params.direction;
            this.rtl = params.rtl;
            this.origin = origin[this.direction];
            this.barOnCls = params.barOnCls;
            this.scrollingCls = params.scrollingCls;
            this.draggingCls = params.draggingCls;
            this.impact = params.impact;
            this.position = params.position;
            this.rtl = params.rtl;
            this.barTopLimit = 0;
            this.resizeDebounce = params.resizeDebounce;

            // Updating height or width of bar
            function setBarSize(size) {
                /* jshint validthis:true */
                var barMinSize = this.barMinSize || 20;

                if (size > 0 && size < barMinSize) {
                    size = barMinSize;
                }

                if (this.bar) {
                    $(this.bar).css(this.origin.size, parseInt(size, 10) + 'px');
                }
            }

            // Updating top or left bar position
            function posBar(pos) {
                /* jshint validthis:true */
                if (this.bar) {
                    var was = $(this.bar).css(this.origin.pos),
                        will = +pos + 'px';

                    if (will && will != was) {
                        $(this.bar).css(this.origin.pos, will);
                    }
                }
            }

            // Free path for bar
            function k() {
                /* jshint validthis:true */
                return track[this.origin.client] - this.barTopLimit - this.bar[this.origin.offset];
            }

            // Relative content top position to bar top position
            function relToPos(r) {
                /* jshint validthis:true */
                return r * k.call(this) + this.barTopLimit;
            }

            // Bar position to relative content position
            function posToRel(t) {
                /* jshint validthis:true */
                return (t - this.barTopLimit) / k.call(this);
            }

            // Cursor position in main direction in px // Now with iOs support
            this.cursor = function(e) {
                return e['client' + this.origin.x] ||
                    (((e.originalEvent || e).touches || {})[0] || {})['page' + this.origin.x];
            };

            // Text selection pos preventing
            function dontPosSelect() {
                return false;
            }

            this.pos = function(x) { // Absolute scroller position in px
                var ie = 'page' + this.origin.x + 'Offset',
                    key = (this.scroller[ie]) ? ie : this.origin.scroll;

                if (x !== undefined) this.scroller[key] = x;

                return this.scroller[key];
            };

            this.rpos = function(r) { // Relative scroller position (0..1)
                var free = this.scroller[this.origin.scrollSize] - this.scroller[this.origin.client],
                    x;

                if (r) {
                    x = this.pos(r * free);
                } else {
                    x = this.pos();
                }

                return x / (free || 1);
            };

            // Switch on the bar by adding user-defined CSS classname to scroller
            this.barOn = function(dispose) {
                if (this.barOnCls) {
                    if (dispose ||
                        this.scroller[this.origin.client] >= this.scroller[this.origin.scrollSize])
                    {
                        if ($(this.root).hasClass(this.barOnCls)) {
                            $(this.root).removeClass(this.barOnCls);
                        }
                    } else {
                        if (!$(this.root).hasClass(this.barOnCls)) {
                            $(this.root).addClass(this.barOnCls);
                        }
                    }
                }
            };

            this._pos0 = function(e) {
                scrollerPos0 = this.cursor(e) - barPos;
            };

            this.drag = function(e) {
                var rel = posToRel.call(this, this.cursor(e) - scrollerPos0);
                var k = (this.scroller[this.origin.scrollSize] - this.scroller[this.origin.client]);
                this.scroller[this.origin.scroll] = rel * k;
            };

            // Text selection preventing on drag
            this.selection = function(enable) {
                this.event(document, 'selectpos selectstart', dontPosSelect, enable ? 'off' : 'on');
            };

            // onResize & DOM modified handler
            // also fires on init
            // Note: max/min-size didnt sets if size did not really changed (for example, on init in Chrome)
            this.resize = function() {
                var self = this;
                var minPeriod = (self.resizeDebounce === undefined) ? 300 : self.resizeDebounce;
                var delay = 0;

                if (getTime() - resizeLastFire < minPeriod) {
                    clearTimeout(resizePauseTimer);
                    delay = minPeriod;
                }

                function upd() {
                    var offset = self.scroller[self.origin.crossOffset];
                    var client = self.scroller[self.origin.crossClient];
                    var padding = 0;

                    // https://github.com/Diokuz/baron/issues/110
                    if (isMacFF) {
                        padding = macmsxffScrollbarSize;

                    // Opera 12 bug https://github.com/Diokuz/baron/issues/105
                    } else if (client > 0 && offset === 0) {
                        // Only Opera 12 in some rare nested flexbox cases goes here
                        // Sorry guys for magic,
                        // but I dont want to create temporary html-nodes set
                        // just for measuring scrollbar size in Opera 12.
                        // 17px for Windows XP-8.1, 15px for Mac (really rare).
                        offset = client + opera12maxScrollbarSize;
                    }

                    if (offset) { // if there is no size, css should not be set
                        self.barOn();

                        if (self.impact == 'scroller') { // scroller
                            var delta = offset - client + padding;

                            // `static` position works only for `scroller` impact
                            if (self.position == 'static') { // static
                                var was = self.$(self.scroller).css(self.origin.crossSize);
                                var will = self.clipper[self.origin.crossClient] + delta + 'px';

                                if (was != will) {
                                    self._setCrossSizes(self.scroller, will);
                                }
                            } else { // absolute
                                var css = {};
                                var key = self.rtl ? 'Left' : 'Right';

                                if (self.direction == 'h') {
                                    key = 'Bottom';
                                }

                                css['padding' + key] = delta + 'px';
                                self.$(self.scroller).css(css);
                            }
                        } else { // clipper
                            var was = $(self.clipper).css(self.origin.crossSize);
                            var will = client + 'px';

                            if (was != will) {
                                self._setCrossSizes(self.clipper, will);
                            }
                        }
                    } else {
                        // do nothing (display: none, or something)
                    }

                    Array.prototype.unshift.call(arguments, 'resize');
                    fire.apply(self, arguments);

                    resizeLastFire = getTime();
                }

                if (delay) {
                    resizePauseTimer = setTimeout(upd, delay);
                } else {
                    upd();
                }
            };

            this.updatePositions = function() {
                var newBarSize,
                    self = this;

                if (self.bar) {
                    newBarSize = (track[self.origin.client] - self.barTopLimit) *
                        self.scroller[self.origin.client] / self.scroller[self.origin.scrollSize];

                    // Positioning bar
                    if (parseInt(oldBarSize, 10) != parseInt(newBarSize, 10)) {
                        setBarSize.call(self, newBarSize);
                        oldBarSize = newBarSize;
                    }

                    barPos = relToPos.call(self, self.rpos());

                    posBar.call(self, barPos);
                }

                Array.prototype.unshift.call( arguments, 'scroll' );
                fire.apply(self, arguments);

                scrollLastFire = getTime();
            };

            // onScroll handler
            this.scroll = function() {
                var self = this;

                self.updatePositions();

                if (self.scrollingCls) {
                    if (!scrollingTimer) {
                        self.$(self.root).addClass(self.scrollingCls);
                    }
                    clearTimeout(scrollingTimer);
                    scrollingTimer = setTimeout(function() {
                        self.$(self.root).removeClass(self.scrollingCls);
                        scrollingTimer = undefined;
                    }, 300);
                }
            };

            // https://github.com/Diokuz/baron/issues/116
            this.clipperOnScroll = function() {
                // WTF is this line? https://github.com/Diokuz/baron/issues/134
                // if (this.direction == 'h') return;

                // assign `initial scroll position` to `clipper.scrollLeft` (0 for ltr, ~20 for rtl)
                if (!this.rtl) {
                    this.clipper[this.origin.scrollEdge] = 0;
                } else {
                    this.clipper[this.origin.scrollEdge] = this.clipper[this.origin.scrollSize];
                }
            };

            // Flexbox `align-items: stretch` (default) requires to set min-width for vertical
            // and max-height for horizontal scroll. Just set them all.
            // http://www.w3.org/TR/css-flexbox-1/#valdef-align-items-stretch
            this._setCrossSizes = function(node, size) {
                var css = {};

                css[this.origin.crossSize] = size;
                css[this.origin.crossMinSize] = size;
                css[this.origin.crossMaxSize] = size;

                this.$(node).css(css);
            };

            // Set common css rules
            this._dumbCss = function(on) {
                if (params.cssGuru) return;

                var overflow = on ? 'hidden' : null;
                var msOverflowStyle = on ? 'none' : null;

                this.$(this.clipper).css({
                    overflow: overflow,
                    msOverflowStyle: msOverflowStyle,
                    position: this.position == 'static' ? '' : 'relative'
                });

                var scroll = on ? 'scroll' : null;
                var axis = this.direction == 'v' ? 'y' : 'x';
                var scrollerCss = {};

                scrollerCss['overflow-' + axis] = scroll;
                scrollerCss['box-sizing'] = 'border-box';
                scrollerCss.margin = '0';
                scrollerCss.border = '0';

                if (this.position == 'absolute') {
                    scrollerCss.position = 'absolute';
                    scrollerCss.top = '0';

                    if (this.direction == 'h') {
                        scrollerCss.left = scrollerCss.right = '0';
                    } else {
                        scrollerCss.bottom = '0';
                        scrollerCss.right = this.rtl ? '0' : '';
                        scrollerCss.left = this.rtl ? '' : '0';
                    }
                }

                this.$(this.scroller).css(scrollerCss);
            };

            // onInit actions
            this._dumbCss(true);

            if (isMacFF) {
                var padding = 'paddingRight';
                var css = {};
                // getComputedStyle is ie9+, but we here only in f ff
                var paddingWas = window.getComputedStyle(this.scroller)[[padding]];
                var delta = this.scroller[this.origin.crossOffset] -
                            this.scroller[this.origin.crossClient];

                if (params.direction == 'h') {
                    padding = 'paddingBottom';
                } else if (params.rtl) {
                    padding = 'paddingLeft';
                }

                var numWas = parseInt(paddingWas, 10);
                if (numWas != numWas) numWas = 0;
                css[padding] = (macmsxffScrollbarSize + numWas) + 'px';
                $(this.scroller).css(css);
            }

            return this;
        },

        // fires on any update and on init
        update: function(params) {
            // removeIf(production)
            if (this._disposed) {
                log('error', [
                    'Update on disposed baron instance detected.',
                    'You should clear your stored baron value for this instance:',
                    this
                ].join(' '), params);
            }
            // endRemoveIf(production)
            fire.call(this, 'upd', params); // Update all plugins' params

            this.resize(1);
            this.updatePositions();

            return this;
        },

        // One instance
        dispose: function(params) {
            // removeIf(production)
            if (this._disposed) {
                log('error', [
                    'Already disposed:',
                    this
                ].join(' '), params);
            }
            // endRemoveIf(production)

            manageEvents(this, this.event, 'off');
            manageAttr(this.root, params.direction, 'off');
            if (params.direction == 'v') {
                this._setCrossSizes(this.scroller, '');
            } else {
                this._setCrossSizes(this.clipper, '');
            }
            this._dumbCss(false);
            this.barOn(true);
            fire.call(this, 'dispose');
            this._disposed = true;
        },

        on: function(eventName, func, arg) {
            var names = eventName.split(' ');

            for (var i = 0 ; i < names.length ; i++) {
                if (names[i] == 'init') {
                    func.call(this, arg);
                } else {
                    this.events[names[i]] = this.events[names[i]] || [];

                    this.events[names[i]].push(function(userArg) {
                        func.call(this, userArg || arg);
                    });
                }
            }
        }
    };

    baron.fn.constructor.prototype = baron.fn;
    item.prototype.constructor.prototype = item.prototype;

    // Use when you need "baron" global var for another purposes
    baron.noConflict = function() {
        window.baron = _baron; // Restoring original value of "baron" global var

        return baron;
    };

    baron.version = '2.2.2';

    if ($ && $.fn) { // Adding baron to jQuery as plugin
        $.fn.baron = baron;
    }

    window.baron = baron; // Use noConflict method if you need window.baron var for another purposes
    if (typeof module != 'undefined') {
        module.exports = baron.noConflict();
    }
})(window);

/* Fixable elements plugin for baron 0.6+ */
(function(window, undefined) {
    // By now window.baron points to real baron
    var scopedBaron = window.baron;
    // removeIf(production)
    var log = function() {
        scopedBaron.fn.log.apply(this, arguments);
    };
    // endRemoveIf(production)

    var fix = function(userParams) {
        var elements, viewPortSize,
            params = { // Default params
                outside: '',
                inside: '',
                before: '',
                after: '',
                past: '',
                future: '',
                radius: 0,
                minView: 0
            },
            topFixHeights = [], // inline style for element
            topRealHeights = [], // ? something related to negative margins for fixable elements
            headerTops = [], // offset positions when not fixed
            scroller = this.scroller,
            eventManager = this.event,
            $ = this.$,
            self = this;

        // removeIf(production)
        if (this.position != 'static') {
            log('error', [
                'Fix plugin cannot work properly in non-static baron position.',
                'See more https://github.com/Diokuz/baron/issues/135'
            ].join(' '), this.params);
        }
        // endRemoveIf(production)

        // i - number of fixing element, pos - fix-position in px, flag - 1: top, 2: bottom
        // Invocation only in case when fix-state changed
        function fixElement(i, pos, flag) {
            var ori = flag == 1 ? 'pos' : 'oppos';

            if (viewPortSize < (params.minView || 0)) { // No headers fixing when no enought space for viewport
                pos = undefined;
            }

            // Removing all fixing stuff - we can do this because fixElement triggers only when fixState really changed
            this.$(elements[i]).css(this.origin.pos, '').css(this.origin.oppos, '').removeClass(params.outside);

            // Fixing if needed
            if (pos !== undefined) {
                pos += 'px';
                this.$(elements[i]).css(this.origin[ori], pos).addClass(params.outside);
            }
        }

        function bubbleWheel(e) {
            try {
                i = document.createEvent('WheelEvent'); // i - for extra byte
                // evt.initWebKitWheelEvent(deltaX, deltaY, window, screenX, screenY, clientX, clientY, ctrlKey, altKey, shiftKey, metaKey);
                i.initWebKitWheelEvent(e.originalEvent.wheelDeltaX, e.originalEvent.wheelDeltaY);
                scroller.dispatchEvent(i);
                e.preventDefault();
            } catch (e) {}
        }

        function init(_params) {
            var pos;

            for (var key in _params) {
                params[key] = _params[key];
            }

            elements = this.$(params.elements, this.scroller);

            if (elements) {
                viewPortSize = this.scroller[this.origin.client];
                for (var i = 0 ; i < elements.length ; i++) {
                    // Variable header heights
                    pos = {};
                    pos[this.origin.size] = elements[i][this.origin.offset];
                    if (elements[i].parentNode !== this.scroller) {
                        this.$(elements[i].parentNode).css(pos);
                    }
                    pos = {};
                    pos[this.origin.crossSize] = elements[i].parentNode[this.origin.crossClient];
                    this.$(elements[i]).css(pos);

                    // Between fixed headers
                    viewPortSize -= elements[i][this.origin.offset];

                    headerTops[i] = elements[i].parentNode[this.origin.offsetPos]; // No paddings for parentNode

                    // Summary elements height above current
                    topFixHeights[i] = (topFixHeights[i - 1] || 0); // Not zero because of negative margins
                    topRealHeights[i] = (topRealHeights[i - 1] || Math.min(headerTops[i], 0));

                    if (elements[i - 1]) {
                        topFixHeights[i] += elements[i - 1][this.origin.offset];
                        topRealHeights[i] += elements[i - 1][this.origin.offset];
                    }

                    if ( !(i == 0 && headerTops[i] == 0)/* && force */) {
                        this.event(elements[i], 'mousewheel', bubbleWheel, 'off');
                        this.event(elements[i], 'mousewheel', bubbleWheel);
                    }
                }

                if (params.limiter && elements[0]) { // Bottom edge of first header as top limit for track
                    if (this.track && this.track != this.scroller) {
                        pos = {};
                        pos[this.origin.pos] = elements[0].parentNode[this.origin.offset];
                        this.$(this.track).css(pos);
                    } else {
                        this.barTopLimit = elements[0].parentNode[this.origin.offset];
                    }
                    // this.barTopLimit = elements[0].parentNode[this.origin.offset];
                    this.scroll();
                }

                if (params.limiter === false) { // undefined (in second fix instance) should have no influence on bar limit
                    this.barTopLimit = 0;
                }
            }

            var event = {
                element: elements,

                handler: function() {
                    var parent = $(this)[0].parentNode,
                        top = parent.offsetTop,
                        num;

                    // finding num -> elements[num] === this
                    for (var i = 0 ; i < elements.length ; i++ ) {
                        if (elements[i] === this) num = i;
                    }

                    var pos = top - topFixHeights[num];

                    if (params.scroll) { // User defined callback
                        params.scroll({
                            x1: self.scroller.scrollTop,
                            x2: pos
                        });
                    } else {
                        self.scroller.scrollTop = pos;
                    }
                },

                type: 'click'
            };

            if (params.clickable) {
                this._eventHandlers.push(event); // For auto-dispose
                // eventManager(event.element, event.type, event.handler, 'off');
                eventManager(event.element, event.type, event.handler, 'on');
            }
        }

        this.on('init', init, userParams);

        var fixFlag = [], // 1 - past, 2 - future, 3 - current (not fixed)
            gradFlag = [];
        this.on('init scroll', function() {
            var fixState, hTop, gradState;

            if (elements) {
                var change;

                // fixFlag update
                for (var i = 0 ; i < elements.length ; i++) {
                    fixState = 0;
                    if (headerTops[i] - this.pos() < topRealHeights[i] + params.radius) {
                        // Header trying to go up
                        fixState = 1;
                        hTop = topFixHeights[i];
                    } else if (headerTops[i] - this.pos() > topRealHeights[i] + viewPortSize - params.radius) {
                        // Header trying to go down
                        fixState = 2;
                        // console.log('topFixHeights[i] + viewPortSize + topRealHeights[i]', topFixHeights[i], this.scroller[this.origin.client], topRealHeights[i]);
                        hTop = this.scroller[this.origin.client] - elements[i][this.origin.offset] - topFixHeights[i] - viewPortSize;
                        // console.log('hTop', hTop, viewPortSize, elements[this.origin.offset], topFixHeights[i]);
                        //(topFixHeights[i] + viewPortSize + elements[this.origin.offset]) - this.scroller[this.origin.client];
                    } else {
                        // Header in viewport
                        fixState = 3;
                        hTop = undefined;
                    }

                    gradState = false;
                    if (headerTops[i] - this.pos() < topRealHeights[i] || headerTops[i] - this.pos() > topRealHeights[i] + viewPortSize) {
                        gradState = true;
                    }

                    if (fixState != fixFlag[i] || gradState != gradFlag[i]) {
                        fixElement.call(this, i, hTop, fixState);
                        fixFlag[i] = fixState;
                        gradFlag[i] = gradState;
                        change = true;
                    }
                }

                // Adding positioning classes (on last top and first bottom header)
                if (change) { // At leats one change in elements flag structure occured
                    for (i = 0 ; i < elements.length ; i++) {
                        if (fixFlag[i] == 1 && params.past) {
                            this.$(elements[i]).addClass(params.past).removeClass(params.future);
                        }

                        if (fixFlag[i] == 2 && params.future) {
                            this.$(elements[i]).addClass(params.future).removeClass(params.past);
                        }

                        if (fixFlag[i] == 3) {
                            if (params.future || params.past) this.$(elements[i]).removeClass(params.past).removeClass(params.future);
                            if (params.inside) this.$(elements[i]).addClass(params.inside);
                        } else if (params.inside) {
                            this.$(elements[i]).removeClass(params.inside);
                        }

                        if (fixFlag[i] != fixFlag[i + 1] && fixFlag[i] == 1 && params.before) {
                            this.$(elements[i]).addClass(params.before).removeClass(params.after); // Last top fixed header
                        } else if (fixFlag[i] != fixFlag[i - 1] && fixFlag[i] == 2 && params.after) {
                            this.$(elements[i]).addClass(params.after).removeClass(params.before); // First bottom fixed header
                        } else {
                            this.$(elements[i]).removeClass(params.before).removeClass(params.after);
                        }

                        if (params.grad) {
                            if (gradFlag[i]) {
                                this.$(elements[i]).addClass(params.grad);
                            } else {
                                this.$(elements[i]).removeClass(params.grad);
                            }
                        }
                    }
                }
            }
        });

        this.on('resize upd', function(updParams) {
            init.call(this, updParams && updParams.fix);
        });
    };

    scopedBaron.fn.fix = function(params) {
        var i = 0;

        while (this[i]) {
            fix.call(this[i], params);
            i++;
        }

        return this;
    };
})(window);
/* Autoupdate plugin for baron 0.6+ */
(function(window) {
    // By now window.baron points to real baron
    var scopedBaron = window.baron;
    var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver || null;

    var autoUpdate = function() {
        var self = this;
        var watcher;

        if (this._au) {
            return;
        }

        function actualizeWatcher() {
            if (!self.root[self.origin.offset]) {
                startWatch();
            } else {
                stopWatch();
            }
        }

        // Set interval timeout for watching when root node will be visible
        function startWatch() {
            if (watcher) return;

            watcher = setInterval(function() {
                if (self.root[self.origin.offset]) {
                    stopWatch();
                    self.update();
                }
            }, 300); // is it good enought for you?)
        }

        function stopWatch() {
            clearInterval(watcher);
            watcher = null;
        }

        var debouncedUpdater = self._debounce(function() {
            self.update();
        }, 300);

        this._observer = new MutationObserver(function() {
            actualizeWatcher();
            self.update();
            debouncedUpdater();
        });

        this.on('init', function() {
            self._observer.observe(self.root, {
                childList: true,
                subtree: true,
                characterData: true
                // attributes: true
                // No reasons to set attributes to true
                // The case when root/child node with already properly inited baron toggled to hidden and then back to visible,
                // and the size of parent was changed during that hidden state, is very rare
                // Other cases are covered by watcher, and you still can do .update by yourself
            });

            actualizeWatcher();
        });

        this.on('dispose', function() {
            self._observer.disconnect();
            stopWatch();
            delete self._observer;
        });

        this._au = true;
    };

    scopedBaron.fn.autoUpdate = function(params) {
        if (!MutationObserver) return this;

        var i = 0;

        while (this[i]) {
            autoUpdate.call(this[i], params);
            i++;
        }

        return this;
    };
})(window);

/* Controls plugin for baron 0.6+ */
(function(window, undefined) {
    // By now window.baron points to real baron
    var scopedBaron = window.baron;

    var controls = function(params) {
        var forward, backward, track, screen,
            self = this, // AAAAAA!!!!!11
            event;

        screen = params.screen || 0.9;

        if (params.forward) {
            forward = this.$(params.forward, this.clipper);

            event = {
                element: forward,

                handler: function() {
                    var y = self.pos() + (params.delta || 30);

                    self.pos(y);
                },

                type: 'click'
            };

            this._eventHandlers.push(event); // For auto-dispose
            this.event(event.element, event.type, event.handler, 'on');
        }

        if (params.backward) {
            backward = this.$(params.backward, this.clipper);

            event = {
                element: backward,

                handler: function() {
                    var y = self.pos() - (params.delta || 30);

                    self.pos(y);
                },

                type: 'click'
            };

            this._eventHandlers.push(event); // For auto-dispose
            this.event(event.element, event.type, event.handler, 'on');
        }

        if (params.track) {
            if (params.track === true) {
                track = this.track;
            } else {
                track = this.$(params.track, this.clipper)[0];
            }

            if (track) {
                event = {
                    element: track,

                    handler: function(e) {
                        // https://github.com/Diokuz/baron/issues/121
                        if (e.target != track) return;

                        var x = e['offset' + self.origin.x],
                            xBar = self.bar[self.origin.offsetPos],
                            sign = 0;

                        if (x < xBar) {
                            sign = -1;
                        } else if (x > xBar + self.bar[self.origin.offset]) {
                            sign = 1;
                        }

                        var y = self.pos() + sign * screen * self.scroller[self.origin.client];
                        self.pos(y);
                    },

                    type: 'mousedown'
                };

                this._eventHandlers.push(event); // For auto-dispose
                this.event(event.element, event.type, event.handler, 'on');
            }
        }
    };

    scopedBaron.fn.controls = function(params) {
        var i = 0;

        while (this[i]) {
            controls.call(this[i], params);
            i++;
        }

        return this;
    };
})(window);
// removeIf(production)
baron.fn.log = function(level, msg, nodes) {
    var time = new Date().toString();
    var func = console[level] || console.log;
    var args = [
        'Baron [ ' + time.substr(16, 8) + ' ]: ' + msg,
        nodes
    ];

    Function.prototype.apply.call(func, console, args);
};
// endRemoveIf(production)

/**
 * Элементы управления в аккордеоне редактора
 * Created 16.02.2016
 * @author Evgeniy Malyarov
 * @module editor
 * @submodule editor_accordion
 */

function EditorAccordion(_editor, cell_acc) {

	cell_acc.attachHTMLString($p.injected_data['tip_editor_right.html']);

	var _cell = cell_acc.cell,
		cont = _cell.querySelector(".editor_accordion"),

		/**
		 * ### Панель инструментов элемента
		 * @property tb_elm
		 * @for EditorAccordion
		 * @type {OTooolBar}
		 * @final
		 * @private
		 */
		tb_elm = new $p.iface.OTooolBar({
			wrapper: cont.querySelector("[name=header_elm]"),
			width: '100%',
			height: '28px',
			bottom: '2px',
			left: '4px',
			class_name: "",
			name: 'aling_bottom',
			buttons: [
				{name: 'left', css: 'tb_align_left', tooltip: $p.msg.align_node_left, float: 'left'},
				{name: 'bottom', css: 'tb_align_bottom', tooltip: $p.msg.align_node_bottom, float: 'left'},
				{name: 'top', css: 'tb_align_top', tooltip: $p.msg.align_node_top, float: 'left'},
				{name: 'right', css: 'tb_align_right', tooltip: $p.msg.align_node_right, float: 'left'},
				{name: 'all', text: '<i class="fa fa-arrows-alt fa-fw"></i>', tooltip: $p.msg.align_all, float: 'left'},
        {name: 'sep_0', text: '', float: 'left'},
        {name: 'additional_inserts', text: '<i class="fa fa-tag fa-fw"></i>', tooltip: $p.msg.additional_inserts + ' ' + $p.msg.to_elm, float: 'left'},
				{name: 'delete', text: '<i class="fa fa-trash-o fa-fw"></i>', tooltip: $p.msg.del_elm, float: 'right', paddingRight: '20px'}
			],
			image_path: "dist/imgs/",
			onclick: function (name) {
				return name == 'additional_inserts' ? _editor.additional_inserts('elm') : _editor.profile_align(name);
			}
		}),

		/**
		 * панель инструментов свойств изделия
		 */
		tb_right = new $p.iface.OTooolBar({
			wrapper: cont.querySelector("[name=header_layers]"),
			width: '100%',
			height: '28px',
			bottom: '2px',
			left: '4px',
			class_name: "",
			name: 'right',
			image_path: 'dist/imgs/',
			buttons: [
				{name: 'new_layer', text: '<i class="fa fa-file-o fa-fw"></i>', tooltip: 'Добавить рамный контур', float: 'left'
					//,sub: {
					//	buttons: [
					//		{name: 'square', img: 'square.png', float: 'left'},
					//		{name: 'triangle1', img: 'triangle1.png', float: 'right'},
					//		{name: 'triangle2', img: 'triangle2.png', float: 'left'},
					//		{name: 'triangle3', img: 'triangle3.png', float: 'right'},
					//		{name: 'semicircle1', img: 'semicircle1.png', float: 'left'},
					//		{name: 'semicircle2', img: 'semicircle2.png', float: 'right'},
					//		{name: 'circle',    img: 'circle.png', float: 'left'},
					//		{name: 'arc1',      img: 'arc1.png', float: 'right'},
					//		{name: 'trapeze1',  img: 'trapeze1.png', float: 'left'},
					//		{name: 'trapeze2',  img: 'trapeze2.png', float: 'right'},
					//		{name: 'trapeze3',  img: 'trapeze3.png', float: 'left'},
					//		{name: 'trapeze4',  img: 'trapeze4.png', float: 'right'},
					//		{name: 'trapeze5',  img: 'trapeze5.png', float: 'left'},
					//		{name: 'trapeze6',  img: 'trapeze6.png', float: 'right'}]
					//}
				},
				{name: 'new_stv', text: '<i class="fa fa-file-code-o fa-fw"></i>', tooltip: $p.msg.bld_new_stv, float: 'left'},
        {name: 'sep_0', text: '', float: 'left'},
        {name: 'inserts_to_product', text: '<i class="fa fa-tags fa-fw"></i>', tooltip: $p.msg.additional_inserts + ' ' + $p.msg.to_product, float: 'left'},
        {name: 'inserts_to_contour', text: '<i class="fa fa-tag fa-fw"></i>', tooltip: $p.msg.additional_inserts + ' ' + $p.msg.to_contour, float: 'left'},
				{name: 'drop_layer', text: '<i class="fa fa-trash-o fa-fw"></i>', tooltip: 'Удалить слой', float: 'right', paddingRight: '20px'}

			], onclick: function (name) {

				switch(name) {

					case 'new_stv':
						var fillings = _editor.project.getItems({class: Filling, selected: true});
						if(fillings.length)
							fillings[0].create_leaf();
						else
							$p.msg.show_msg({
								type: "alert-warning",
								text: $p.msg.bld_new_stv_no_filling,
								title: $p.msg.bld_new_stv
							});
						break;

					case 'drop_layer':
						tree_layers.drop_layer();
						break;

					case 'new_layer':

						// создаём пустой новый слой
						new Contour( {parent: undefined});

						// оповещаем мир о новых слоях
						Object.getNotifier(_editor.project._noti).notify({
							type: 'rows',
							tabular: "constructions"
						});
						break;

          case 'inserts_to_product':
            // дополнительные вставки в изделие
            _editor.additional_inserts();
            break;

          case 'inserts_to_contour':
            // дополнительные вставки в контур
            _editor.additional_inserts('contour');
            break;

					default:
						$p.msg.show_msg(name);
						break;
				}

				return false;
			}
		}),

		/**
		 * слои в аккордионе
		 */
		tree_layers = new function SchemeLayers() {

			var tree = new dhtmlXTreeView({
				parent: cont.querySelector("[name=content_layers]"),
				checkboxes: true,
				multiselect: false
			});

			function layer_text(layer, bounds){
				if(!bounds)
					bounds = layer.bounds;
				return (layer.parent ? "Створка №" : "Рама №") + layer.cnstr +
					(bounds ? " " + bounds.width.toFixed() + "х" + bounds.height.toFixed() : "");
			}

			function load_layer(layer){

				tree.addItem(
					layer.cnstr,
					layer_text(layer),
					layer.parent ? layer.parent.cnstr : 0);


				layer.children.forEach(function (l) {
					if(l instanceof Contour)
						load_layer(l);

				});

			}

			function observer(changes){

				var synced;

				changes.forEach(function(change){
					if ("constructions" == change.tabular){

						synced = true;

						// добавляем слои изделия
						tree.clearAll();
						_editor.project.contours.forEach(function (l) {
							load_layer(l);
							tree.checkItem(l.cnstr);
							tree.openItem(l.cnstr);

						});

						// служебный слой размеров
						tree.addItem("sizes", "Размерные линии", 0);

						// служебный слой визуализации
						tree.addItem("visualization", "Визуализация доп. элементов", 0);

						// служебный слой текстовых комментариев
						tree.addItem("text", "Комментарии", 0);

					}
				});
			}


			this.drop_layer = function () {
				var cnstr = tree.getSelectedId(), l;
				if(cnstr){
					l = _editor.project.getItem({cnstr: Number(cnstr)});
				}else if(l = _editor.project.activeLayer){
					cnstr = l.cnstr;
				}
				if(cnstr && l){
					tree.deleteItem(cnstr);
					cnstr = l.parent ? l.parent.cnstr : 0;
					l.remove();
					setTimeout(function () {
						_editor.project.zoom_fit();
						if(cnstr)
							tree.selectItem(cnstr);
					}, 100);
				}
			};

			// начинаем следить за объектом
			this.attache = function () {
				Object.observe(_editor.project._noti, observer, ["rows"]);
			};

			this.unload = function () {
				Object.unobserve(_editor.project._noti, observer);
			};

			// гасим-включаем слой по чекбоксу
			tree.attachEvent("onCheck", function(id, state){
				var l,
					pid = tree.getParentId(id),
					sub = tree.getSubItems(id);

				if(pid && state && !tree.isItemChecked(pid)){
					if(l = _editor.project.getItem({cnstr: Number(pid)}))
						l.visible = true;
					tree.checkItem(pid);
				}

				if(l = _editor.project.getItem({cnstr: Number(id)}))
					l.visible = !!state;

				if(typeof sub == "string")
					sub = sub.split(",");
				sub.forEach(function (id) {
					state ? tree.checkItem(id) : tree.uncheckItem(id);
					if(l = _editor.project.getItem({cnstr: Number(id)}))
						l.visible = !!state;
				});

				if(pid && state && !tree.isItemChecked(pid))
					tree.checkItem(pid);

				_editor.project.register_update();

			});

			// делаем выделенный слой активным
			tree.attachEvent("onSelect", function(id, mode){
				if(!mode)
					return;
				var contour = _editor.project.getItem({cnstr: Number(id)});
				if(contour){
					if(contour.project.activeLayer != contour)
						contour.activate(true);
					cont.querySelector("[name=header_stv]").innerHTML = layer_text(contour);
				}
			});

			$p.eve.attachEvent("layer_activated", function (contour) {
				if(contour && contour.cnstr && contour.cnstr != tree.getSelectedId()){
					tree.selectItem(contour.cnstr);
					cont.querySelector("[name=header_stv]").innerHTML = layer_text(contour);
				}

			});

			// начинаем следить за изменениями размеров при перерисовке контуров
			$p.eve.attachEvent("contour_redrawed", function (contour, bounds) {

				var text = layer_text(contour, bounds);

				tree.setItemText(contour.cnstr, text);

				if(contour.project.activeLayer == contour)
					cont.querySelector("[name=header_stv]").innerHTML = text;

			});

		},

		/**
		 * свойства изделия в аккордионе
		 */
		props = new (function SchemeProps(layout) {

			var _obj,
				_grid,
				_reflect_id;

			function reflect_changes() {
				_obj.len = _editor.project.bounds.width.round(0);
				_obj.height = _editor.project.bounds.height.round(0);
				_obj.s = _editor.project.area;
			}

			this.__define({

				attache: {
					value: function (obj) {

						_obj = obj;
						obj = null;

						// корректируем метаданные поля выбора цвета
						$p.cat.clrs.selection_exclude_service($p.dp.buyers_order.metadata("clr"), _obj);

						if(_grid && _grid.destructor)
							_grid.destructor();

						var is_dialer = !$p.current_acl.role_available("СогласованиеРасчетовЗаказов") && !$p.current_acl.role_available("РедактированиеСкидок"),
							oxml = {
								"Свойства": ["sys","clr",
								{id: "len", path: "o.len", synonym: "Ширина, мм", type: "ro"},
								{id: "height", path: "o.height", synonym: "Высота, мм", type: "ro"},
								{id: "s", path: "o.s", synonym: "Площадь, м²", type: "ro"}
							]
							};

						if($p.wsql.get_user_param("hide_price_dealer")){
							oxml["Строка заказа"] = [
								"quantity",
								{id: "price", path: "o.price", synonym: "Цена", type: "ro"},
								{id: "discount_percent", path: "o.discount_percent", synonym: "Скидка %", type: is_dialer ? "ro" : "calck"},
								{id: "amount", path: "o.amount", synonym: "Сумма", type: "ro"},
								"note"
							];
						}else{
							oxml["Строка заказа"] = [
								"quantity",
								{id: "price_internal", path: "o.price_internal", synonym: "Цена дилера", type: "ro"},
								{id: "discount_percent_internal", path: "o.discount_percent_internal", synonym: "Скидка дил %", type: "calck"},
								{id: "amount_internal", path: "o.amount_internal", synonym: "Сумма дилера", type: "ro"},
								{id: "price", path: "o.price", synonym: "Цена пост", type: "ro"},
								{id: "discount_percent", path: "o.discount_percent", synonym: "Скидка пост %", type: is_dialer ? "ro" : "calck"},
								{id: "amount", path: "o.amount", synonym: "Сумма пост", type: "ro"},
								"note"
							];
						}

						_grid = layout.cells("a").attachHeadFields({
							obj: _obj,
							oxml: oxml,
							ts: "extra_fields",
							ts_title: "Свойства",
							selection: {cnstr: 0, hide: {not: true}}
						});

						// при готовности снапшота, обновляем суммы и цены
						_on_snapshot = $p.eve.attachEvent("scheme_snapshot", function (scheme, attr) {
							if(scheme == _editor.project && !attr.clipboard){
								["price_internal","amount_internal","price","amount"].forEach(function (fld) {
									_obj[fld] = scheme.data._calc_order_row[fld];
								});
							}
						});
					}
				},

				unload: {
					value: function () {
						layout.unload();
						_obj = null;
					}
				},

				layout: {
					get: function () {
						return layout;
					}
				}

			});

			// начинаем следить за изменениями размеров при перерисовке контуров
			$p.eve.attachEvent("contour_redrawed", function () {
				if(_obj){
					if(_reflect_id)
						clearTimeout(_reflect_id);
					_reflect_id = setTimeout(reflect_changes, 100);
				}
			});


		})(new dhtmlXLayoutObject({
			parent:     cont.querySelector("[name=content_props]"),
			pattern:    "1C",
			offsets: {
				top:    0,
				right:  0,
				bottom: 0,
				left:   0
			},
			cells: [
				{
					id:             "a",
					header:         false,
					height:         330
				}
			]
		})),

		/**
		 * свойства створки в аккордионе
		 */
		stv = new (function StvProps(layout) {

			var t = this, _grid, _evts = [];

			this.__define({

				attache: {
					value: function (obj) {

						if(!obj || !obj.cnstr || (_grid && _grid._obj === obj))
							return;

						var attr = {
							obj: obj,
							oxml: {
								"Фурнитура": ["furn", "clr_furn", "direction", "h_ruch"],
								"Параметры": []
							},
							ts: "params",
							ts_title: "Параметры",
							selection: {cnstr: obj.cnstr || -9999, hide: {not: true}}
						};

						if(!_grid){
              _grid = layout.cells("a").attachHeadFields(attr);
            }else{
              _grid.attach(attr);
            }

						if(!obj.parent){
							var rids = _grid.getAllRowIds();
							if(rids)
								_grid.closeItem(rids.split(",")[0]);
						}

						setTimeout(t.set_sizes, 200);
					}
				},

				set_sizes: {

					value: function (do_reload) {
						if(do_reload)
							_grid.reload();
						layout.base.style.height = (Math.max(_grid.rowsBuffer.length, 10) + 1) * 22 + "px";
						layout.setSizes();
						_grid.objBox.style.width = "100%";
					}
				},

				unload: {
					value: function () {
						_evts.forEach(function (eid) {
							$p.eve.detachEvent(eid);
						});
						layout.unload();
					}
				},

				layout: {
					get: function () {
						return layout;
					}
				}

			});

			_evts.push($p.eve.attachEvent("layer_activated", this.attache));
			_evts.push($p.eve.attachEvent("furn_changed", this.set_sizes));

		})(
      new dhtmlXLayoutObject({
        parent: cont.querySelector("[name=content_stv]"),
        pattern: "1C",
        offsets: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0
        },
        cells: [
          {
            id: "a",
            header: false,
            height: 200
          }
        ]
      })

      // new dhtmlXTabBar({
      //
      //   parent: cont.querySelector("[name=content_stv]"),
      //   close_button: false,           // boolean, render closing button on tabs, optional
      //   arrows_mode: "auto",          // mode of showing tabs arrows (auto, always)
      //
      //   tabs: [
      //     {
      //       id: "a",
      //       text: "Свойства"
      //     },
      //     {
      //       id: "b",
      //       text: "Вставки"
      //     }
      //   ]
      // })
    );


	this.unload = function () {
		tb_elm.unload();
		tb_right.unload();
		tree_layers.unload();
		props.unload();
		stv.unload();
	};

	this.attache = function (obj) {
		tree_layers.attache();
		props.attache(obj);
	};

	this.resize_canvas = function () {
		var scroller = $(cont, '.scroller').baron();
		scroller.update();
		this.elm.setSizes();
		props.layout.setSizes();
		stv.layout.setSizes();
	};

	this.elm = new dhtmlXLayoutObject({
		parent:     cont.querySelector("[name=content_elm]"),
		pattern:    "1C",
		offsets: {
			top:    0,
			right:  0,
			bottom: 0,
			left:   0
		},
		cells: [
			{
				id:             "a",
				header:         false,
				height:         200
			}
		]
	});

	this.header_stv = cont.querySelector("[name=header_stv]");
	this.header_props = cont.querySelector("[name=header_props]");

	baron({
		cssGuru: true,
		root: cont,
		scroller: '.scroller',
		bar: '.scroller__bar',
		barOnCls: 'baron'
	}).fix({
		elements: '.header__title',
		outside: 'header__title_state_fixed',
		before: 'header__title_position_top',
		after: 'header__title_position_bottom',
		clickable: true
	});

}

/**
 * Работа с буфером обмена
 * @author Evgeniy Malyarov
 * @module clipboard
 */

/**
 * ### Буфер обмена
 * Объект для прослушивания и обработки событий буфера обмена
 *
 * @class Clipbrd
 * @param _editor
 * @constructor
 */
function Clipbrd(_editor) {

	var fakecb = {
		clipboardData: {
			types: ['text/plain'],
			json: '{a: 0}',
			getData: function () {
				return this.json;
			}
		}
	};

	function onpaste(e) {
		var _scheme = _editor.project;

		if(!e)
			e = fakecb;

		if(!_scheme.ox.empty()){

			if(e.clipboardData.types.indexOf('text/plain') == -1)
				return;

			try{
				var data = JSON.parse(e.clipboardData.getData('text/plain'));
				e.preventDefault();
			}catch(e){
				return;
			}

		}
	}

	function oncopy(e) {

		if(e.target && ["INPUT","TEXTAREA"].indexOf(e.target.tagName) != -1)
			return;

		var _scheme = _editor.project;
		if(!_scheme.ox.empty()){

			// получаем выделенные элементы
			var sitems = [];
			_scheme.selectedItems.forEach(function (el) {
				if(el.parent instanceof Profile)
					el = el.parent;
				if(el instanceof BuilderElement && sitems.indexOf(el) == -1)
					sitems.push(el);
			});

			// сериализуем
			var res = {
				sys: {
					ref: _scheme._dp.sys.ref,
					presentation: _scheme._dp.sys.presentation
				},

				clr: {
					ref: _scheme.clr.ref,
					presentation: _scheme.clr.presentation
				},

				calc_order: {
					ref: _scheme.ox.calc_order.ref,
					presentation: _scheme.ox.calc_order.presentation
				}
			};
			if(sitems.length){
				res.product = {
					ref: _scheme.ox.ref,
					presentation: _scheme.ox.presentation
				};
				res.items = [];
				sitems.forEach(function (el) {
					res.items.push({
						elm: el.elm,
						elm_type: el._row.elm_type.name,
						inset: {
							ref: el.inset.ref,
							presentation: el.inset.presentation
						},
						clr: {
							ref: el.clr.ref,
							presentation: el.clr.presentation
						},
						path_data: el.path.pathData,
						x1: el.x1,
						x2: el.x2,
						y1: el.y1,
						y2: el.y2
					});
				});

			}else{
				_editor.project.save_coordinates({
					snapshot: true,
					clipboard: true,
					callback: function (scheme) {
						res.product = {}._mixin(scheme.ox._obj, [], ["extra_fields","glasses","specification","predefined_name"]);
					}
				});
			}
			fakecb.clipboardData.json = JSON.stringify(res, null, '\t');

			e.clipboardData.setData('text/plain', fakecb.clipboardData.json);
			//e.clipboardData.setData('text/html', '<b>Hello, world!</b>');
			e.preventDefault();
		}
	}

	this.copy = function () {
		document.execCommand('copy');
	};

	this.paste = function () {
		onpaste();
	};

	// при готовности снапшота, помещаем результат в буфер обмена
	$p.eve.attachEvent("scheme_snapshot", function (scheme, attr) {
		if(scheme == _editor.project && attr.clipboard){
			attr.callback(scheme);
		}
	});

	document.addEventListener('copy', oncopy);

	document.addEventListener('paste', onpaste);
}

/**
 * ### Графический редактор
 *
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2016<br />
 * Created 24.07.2015
 *
 * @module  editor
 */

/**
 * ### Графический редактор
 * - Унаследован от [paper.PaperScope](http://paperjs.org/reference/paperscope/)
 * - У редактора есть коллекция проектов ({{#crossLink "Scheme"}}изделий{{/crossLink}}). В настоящий момент, поддержано единственное активное изделие, но потенциально, имеется возможность одновременного редактирования нескольких изделий
 * - У `редактора` есть коллекция инструментов ([tools](http://paperjs.org/reference/tool/)). Часть инструментов встроена в редактор, но у конечного пользователя, есть возможность как переопределить поведение встроенных инструментов, так и подключить собственные специализированные инструменты
 *
 *
 * - **Редактор** можно рассматривать, как четрёжный стол (кульман)
 * - **Изделие** подобно листу ватмана, прикрепленному к кульману в текущий момент
 * - **Инструменты** - это карандаши и рейсшины, которые инженер использует для редактирования изделия
 *
 * @example
 *
 *     // создаём экземпляр графического редактора
 *     // передаём в конструктор указатель на ячейку _cell и дополнительные реквизиты с функцией set_text()
 *     var editor = new $p.Editor(_cell, {
 *       set_text: function (text) {
 *         cell.setText({text: "<b>" + text + "</b>"});
 *       }
 *     });
 *
 * @class Editor
 * @constructor
 * @extends paper.PaperScope
 * @param pwnd {dhtmlXCellObject} - [ячейка dhtmlx](http://docs.dhtmlx.com/cell__index.html), в которой будет размещен редактор
 * @param [attr] {Object} - дополнительные параметры инициализации редактора
 * @menuorder 10
 * @tooltip Графический редактор
 */
function Editor(pwnd, attr){

	var _editor = this,

		/**
		 * ### История редактирования
		 * Объект для сохранения истории редактирования и реализации команд (вперёд|назад)
		 *
		 * @property undo
		 * @for Editor
		 * @type {UndoRedo}
		 * @final
		 * @private
		 */
		undo = new UndoRedo(this),

		/**
		 * ### Буфер обмена
		 * Объект для прослушивания и обработки событий буфера обмена
		 *
		 * @property clipbrd
		 * @for Editor
		 * @type {Clipbrd}
		 * @final
		 * @private
		 */
		clipbrd = new Clipbrd(this),

		/**
		 * ### Клавиатура
		 * Объект для управления редактором с клавиатуры
		 *
		 * @property keybrd
		 * @for Editor
		 * @type {Keybrd}
		 * @final
		 * @private
		 */
		keybrd = new Keybrd(this),

		selectionBounds = null,
		selectionBoundsShape = null,
		drawSelectionBounds = 0;

	Editor.superclass.constructor.call(_editor);
	_editor.activate();

	consts.tune_paper(_editor.settings);

	_editor.__define({

		/**
		 * ### Ячейка родительского окна
		 * [dhtmlXCell](http://docs.dhtmlx.com/cell__index.html), в которой размещен редактор
		 *
		 * @property _pwnd
		 * @type dhtmlXCellObject
		 * @final
		 * @private
		 */
		_pwnd: {
			get: function () {
				return pwnd;
			}
		},

		/**
		 * ### Разбивка на канвас и аккордион
		 *
		 * @property _layout
		 * @type dhtmlXLayoutObject
		 * @final
		 * @private
		 */
		_layout: {
			value: pwnd.attachLayout({
				pattern: "2U",
				cells: [{
					id: "a",
					text: "Изделие",
					header: false
				}, {
					id: "b",
					text: "Инструменты",
					collapsed_text: "Инструменты",
					width: (pwnd.getWidth ? pwnd.getWidth() : pwnd.cell.offsetWidth) > 1200 ? 360 : 240
				}],
				offsets: { top: 28, right: 0, bottom: 0, left: 0}
			})
		},

		/**
		 * ### Контейнер канваса
		 *
		 * @property _wrapper
		 * @type HTMLDivElement
		 * @final
		 * @private
		 */
		_wrapper: {
			value: document.createElement('div')
		},

		/**
		 * ### Локальный dhtmlXWindows
		 * Нужен для привязки окон инструментов к области редактирования
		 *
		 * @property _dxw
		 * @type dhtmlXWindows
		 * @final
		 * @private
		 */
		_dxw: {
			get: function () {
				return this._layout.dhxWins;
			}
		}

	});

	_editor._layout.cells("a").attachObject(_editor._wrapper);
	_editor._dxw.attachViewportTo(_editor._wrapper);

	_editor._wrapper.oncontextmenu = function (event) {
		event.preventDefault();
		return $p.iface.cancel_bubble(event);
	};


	/**
	 * ### Aккордион со свойствами
	 *
	 * @property _acc
	 * @type {EditorAccordion}
	 * @private
	 */
	_editor._acc = new EditorAccordion(_editor, _editor._layout.cells("b"));

	/**
	 * ### Панель выбора инструментов рисовалки
	 *
	 * @property tb_left
	 * @type OTooolBar
	 * @private
	 */
	_editor.tb_left = new $p.iface.OTooolBar({wrapper: _editor._wrapper, top: '16px', left: '3px', name: 'left', height: '300px',
		image_path: 'dist/imgs/',
		buttons: [
			{name: 'select_node', css: 'tb_icon-arrow-white', title: $p.injected_data['tip_select_node.html']},
			{name: 'pan', css: 'tb_icon-hand', tooltip: 'Панорама и масштаб {Crtl}, {Alt}, {Alt + колёсико мыши}'},
			{name: 'zoom_fit', css: 'tb_cursor-zoom', tooltip: 'Вписать в окно'},
			{name: 'pen', css: 'tb_cursor-pen-freehand', tooltip: 'Добавить профиль'},
			{name: 'lay_impost', css: 'tb_cursor-lay-impost', tooltip: 'Вставить раскладку или импосты'},
			{name: 'arc', css: 'tb_cursor-arc-r', tooltip: 'Арка {Crtl}, {Alt}, {Пробел}'},
			{name: 'ruler', css: 'tb_ruler_ui', tooltip: 'Позиционирование и сдвиг'},
			{name: 'grid', css: 'tb_grid', tooltip: 'Таблица координат'},
			{name: 'line', css: 'tb_line', tooltip: 'Произвольная линия'},
			{name: 'text', css: 'tb_text', tooltip: 'Произвольный текст'}
		],
		onclick: function (name) {
			return _editor.select_tool(name);
		},
		on_popup: function (popup, bdiv) {
			popup.show(dhx4.absLeft(bdiv), 0, bdiv.offsetWidth, _editor._wrapper.offsetHeight);
			popup.p.style.top = (dhx4.absTop(bdiv) - 20) + "px";
			popup.p.querySelector(".dhx_popup_arrow").style.top = "20px";
		}
	});

	/**
	 * ### Верхняя панель инструментов
	 *
	 * @property tb_top
	 * @type OTooolBar
	 * @private
	 */
	_editor.tb_top = new $p.iface.OTooolBar({wrapper: _editor._layout.base, width: '100%', height: '28px', top: '0px', left: '0px', name: 'top',
		image_path: 'dist/imgs/',
		buttons: [

			{name: 'save_close', text: '&nbsp;<i class="fa fa-floppy-o fa-fw"></i>', tooltip: 'Рассчитать, записать и закрыть', float: 'left', width: '34px'},
			{name: 'calck', text: '<i class="fa fa-calculator fa-fw"></i>&nbsp;', tooltip: 'Рассчитать и записать данные', float: 'left'},

			{name: 'sep_0', text: '', float: 'left'},
			{name: 'stamp', img: 'stamp.png', tooltip: 'Загрузить из типового блока или заказа', float: 'left'},

			{name: 'sep_1', text: '', float: 'left'},
			{name: 'copy', text: '<i class="fa fa-clone fa-fw"></i>', tooltip: 'Скопировать выделенное', float: 'left'},
			{name: 'paste', text: '<i class="fa fa-clipboard fa-fw"></i>', tooltip: 'Вставить', float: 'left'},
			{name: 'paste_prop', text: '<i class="fa fa-paint-brush fa-fw"></i>', tooltip: 'Применить скопированные свойства', float: 'left'},

			{name: 'sep_2', text: '', float: 'left'},
			{name: 'back', text: '<i class="fa fa-undo fa-fw"></i>', tooltip: 'Шаг назад', float: 'left'},
			{name: 'rewind', text: '<i class="fa fa-repeat fa-fw"></i>', tooltip: 'Шаг вперед', float: 'left'},

			{name: 'sep_3', text: '', float: 'left'},
			{name: 'open_spec', text: '<i class="fa fa-table fa-fw"></i>', tooltip: 'Открыть спецификацию изделия', float: 'left'},

			{name: 'close', text: '<i class="fa fa-times fa-fw"></i>', tooltip: 'Закрыть без сохранения', float: 'right'}


		], onclick: function (name) {
			switch(name) {

				case 'save_close':
					if(_editor.project)
						_editor.project.save_coordinates({save: true, close: true});
					break;

				case 'close':
					if(pwnd._on_close)
						pwnd._on_close();
					_editor.select_tool('select_node');
					break;

				case 'calck':
					if(_editor.project)
						_editor.project.save_coordinates({save: true});
					break;

				case 'stamp':
					_editor.load_stamp();
					break;

				case 'new_stv':
					var fillings = _editor.project.getItems({class: Filling, selected: true});
					if(fillings.length)
						fillings[0].create_leaf();
					break;

				case 'back':
					undo.back();
					break;

				case 'rewind':
					undo.rewind();
					break;

				case 'copy':
					clipbrd.copy();
					break;

				case 'paste':
					clipbrd.paste();
					break;

				case 'paste_prop':
					$p.msg.show_msg(name);
					break;

				case 'open_spec':
					_editor.project.ox.form_obj()
						.then(function (w) {
							w.wnd.maximize();
						});
					break;

				case 'square':
					$p.msg.show_msg(name);
					break;

				case 'triangle1':
					$p.msg.show_msg(name);
					break;

				case 'triangle3':
					$p.msg.show_msg(name);
					break;

				case 'triangle3':
					$p.msg.show_msg(name);
					break;

				default:
					$p.msg.show_msg(name);
					break;
			}
		}});

	_editor._layout.base.style.backgroundColor = "#f5f5f5";
	//_editor._layout.base.parentNode.parentNode.style.top = "0px";
	_editor.tb_top.cell.style.background = "transparent";
	_editor.tb_top.cell.style.boxShadow = "none";


	// Обработчик события после записи характеристики. Если в параметрах укзано закрыть - закрываем форму
	$p.eve.attachEvent("characteristic_saved", function (scheme, attr) {
		if(scheme == _editor.project && attr.close && pwnd._on_close)
			setTimeout(pwnd._on_close);
	});

	// Обработчик события при изменениях изделия
	$p.eve.attachEvent("scheme_changed", function (scheme) {
		if(scheme == _editor.project){
			if(attr.set_text && scheme._calc_order_row)
				attr.set_text(scheme.ox.prod_name(true) + " " + (scheme.ox._modified ? " *" : ""));
		}
	});


	_editor.clear_selection_bounds = function() {
		if (selectionBoundsShape)
			selectionBoundsShape.remove();
		selectionBoundsShape = null;
		selectionBounds = null;
	};

	_editor.hide_selection_bounds = function() {
		if (drawSelectionBounds > 0)
			drawSelectionBounds--;
		if (drawSelectionBounds == 0) {
			if (selectionBoundsShape)
				selectionBoundsShape.visible = false;
		}
	};

	// Returns serialized contents of selected items.
	_editor.capture_selection_state = function() {
		var originalContent = [];
		var selected = _editor.project.selectedItems;
		for (var i = 0; i < selected.length; i++) {
			var item = selected[i];
			if (item.guide) continue;
			var orig = {
				id: item.id,
				json: item.exportJSON({ asString: false }),
				selectedSegments: []
			};
			originalContent.push(orig);
		}
		return originalContent;
	};

	// Restore the state of selected items.
	_editor.restore_selection_state = function(originalContent) {
		for (var i = 0; i < originalContent.length; i++) {
			var orig = originalContent[i];
			var item = this.project.getItem({id: orig.id});
			if (!item)
				continue;
			// HACK: paper does not retain item IDs after importJSON,
			// store the ID here, and restore after deserialization.
			var id = item.id;
			item.importJSON(orig.json);
			item._id = id;
		}
	};

	/**
	 * Returns all items intersecting the rect.
	 * Note: only the item outlines are tested
	 */
	_editor.paths_intersecting_rect = function(rect) {
		var paths = [];
		var boundingRect = new paper.Path.Rectangle(rect);

		function checkPathItem(item) {
			var children = item.children || [];
			if (item.equals(boundingRect))
				return;
			if (!rect.intersects(item.bounds))
				return;
			if (item instanceof paper.PathItem ) {

				if(item.parent instanceof Profile){
					if(item != item.parent.generatrix)
						return;

					if (rect.contains(item.bounds)) {
						paths.push(item);
						return;
					}
					var isects = boundingRect.getIntersections(item);
					if (isects.length > 0)
						paths.push(item);
				}

			} else {
				for (var j = children.length-1; j >= 0; j--)
					checkPathItem(children[j]);
			}
		}

		this.project.getItems({class: Contour}).forEach(checkPathItem);

		boundingRect.remove();

		return paths;
	};

	/**
	 * Create pixel perfect dotted rectable for drag selections
	 * @param p1
	 * @param p2
	 * @return {paper.CompoundPath}
	 */
	_editor.drag_rect = function(p1, p2) {
		var half = new paper.Point(0.5 / _editor.view.zoom, 0.5 / _editor.view.zoom),
			start = p1.add(half),
			end = p2.add(half),
			rect = new paper.CompoundPath();
		rect.moveTo(start);
		rect.lineTo(new paper.Point(start.x, end.y));
		rect.lineTo(end);
		rect.moveTo(start);
		rect.lineTo(new paper.Point(end.x, start.y));
		rect.lineTo(end);
		rect.strokeColor = 'black';
		rect.strokeWidth = 1.0 / _editor.view.zoom;
		rect.dashOffset = 0.5 / _editor.view.zoom;
		rect.dashArray = [1.0 / _editor.view.zoom, 1.0 / _editor.view.zoom];
		rect.removeOn({
			drag: true,
			up: true
		});
		rect.guide = true;
		return rect;
	};


	// Создаём инструменты

	/**
	 * ### Вписать в окно
	 * Это не настоящий инструмент, а команда вписывания в окно
	 *
	 * @class ZoomFit
	 * @constructor
	 * @menuorder 53
	 * @tooltip Масштаб в экран
	 */
	new function ZoomFit() {

		var tool = new paper.Tool();
		tool.options = {name: 'zoom_fit'};
		tool.on({
			activate: function () {
				_editor.project.zoom_fit();

				var previous = _editor.tb_left.get_selected();

				if(previous)
					return _editor.select_tool(previous.replace("left_", ""));
			}
		});

		return tool;
	};

	/**
	 * Свойства и перемещение узлов элемента
	 */
	new ToolSelectNode();

	/**
	 * Панорама и масштабирование с колёсиком и без колёсика
	 */
	new ToolPan();

	/**
	 * Манипуляции с арками (дуги правильных окружностей)
	 */
	new ToolArc();

	/**
	 * Добавление (рисование) профилей
	 */
	new ToolPen();

	/**
	 * Вставка раскладок и импостов
	 */
	new ToolLayImpost();

	/**
	 * Инструмент произвольного текста
	 */
	new ToolText();

	/**
	 * Относительное позиционирование и сдвиг
	 */
	new ToolRuler();

	this.tools[1].activate();


	// Создаём экземпляр проекта Scheme
	(function () {

		var _canvas = document.createElement('canvas'); // собственно, канвас
		_editor._wrapper.appendChild(_canvas);
		_canvas.style.backgroundColor = "#f9fbfa";

		var _scheme = new Scheme(_canvas),
			pwnd_resize_finish = function(){
				_editor.project.resize_canvas(_editor._layout.cells("a").getWidth(), _editor._layout.cells("a").getHeight());
				_editor._acc.resize_canvas();
			};


		/**
		 * Подписываемся на события изменения размеров
		 */
		_editor._layout.attachEvent("onResizeFinish", pwnd_resize_finish);
		_editor._layout.attachEvent("onPanelResizeFinish", pwnd_resize_finish);
		_editor._layout.attachEvent("onCollapse", pwnd_resize_finish);
		_editor._layout.attachEvent("onExpand", pwnd_resize_finish);

		if(_editor._pwnd instanceof  dhtmlXWindowsCell)
			_editor._pwnd.attachEvent("onResizeFinish", pwnd_resize_finish);

		pwnd_resize_finish();

		/**
		 * Подписываемся на событие смещения мыши, чтобы показать текущие координаты
		 */
		var _mousepos = document.createElement('div');
		_editor._wrapper.appendChild(_mousepos);
		_mousepos.className = "mousepos";
		_scheme.view.on('mousemove', function (event) {
			var bounds = _scheme.bounds;
			if(bounds)
				_mousepos.innerHTML = "x:" + (event.point.x - bounds.x).toFixed(0) +
					" y:" + (bounds.height + bounds.y - event.point.y).toFixed(0);
		});

		/**
		 * Объект для реализации функций масштабирования
		 * @type {StableZoom}
		 */
		var pan_zoom = new function StableZoom(){

			function changeZoom(oldZoom, delta) {
				var factor;
				factor = 1.05;
				if (delta < 0) {
					return oldZoom * factor;
				}
				if (delta > 0) {
					return oldZoom / factor;
				}
				return oldZoom;
			}

			var panAndZoom = this;

			dhtmlxEvent(_canvas, "mousewheel", function(evt) {
				var mousePosition, newZoom, offset, viewPosition, _ref1;
				if (evt.shiftKey || evt.ctrlKey) {
					_editor.view.center = panAndZoom.changeCenter(_editor.view.center, evt.deltaX, evt.deltaY, 1);
					return evt.preventDefault();

				}else if (evt.altKey) {
					mousePosition = new paper.Point(evt.offsetX, evt.offsetY);
					viewPosition = _editor.view.viewToProject(mousePosition);
					_ref1 = panAndZoom.changeZoom(_editor.view.zoom, evt.deltaY, _editor.view.center, viewPosition);
					newZoom = _ref1[0];
					offset = _ref1[1];
					_editor.view.zoom = newZoom;
					_editor.view.center = _editor.view.center.add(offset);
					evt.preventDefault();
					return _editor.view.draw();
				}
			});

			this.changeZoom = function(oldZoom, delta, c, p) {
				var a, beta, newZoom, pc;
				newZoom = changeZoom.call(this, oldZoom, delta);
				beta = oldZoom / newZoom;
				pc = p.subtract(c);
				a = p.subtract(pc.multiply(beta)).subtract(c);
				return [newZoom, a];
			};

			this.changeCenter = function(oldCenter, deltaX, deltaY, factor) {
				var offset;
				offset = new paper.Point(deltaX, -deltaY);
				offset = offset.multiply(factor);
				return oldCenter.add(offset);
			};
		};

		_editor._acc.attache(_editor.project._dp);

	})();

}
Editor._extend(paper.PaperScope);

Editor.prototype.__define({

	/**
	 * ### Устанавливает икону курсора
	 * Действие выполняется для всех канвасов редактора
	 *
	 * @method canvas_cursor
	 * @for Editor
	 * @param name {String} - имя css класса курсора
	 */
	canvas_cursor: {
		value: function (name) {
			for(var p in this.projects){
				var _scheme = this.projects[p];
				for(var i=0; i<_scheme.view.element.classList.length; i++){
					var class_name = _scheme.view.element.classList[i];
					if(class_name == name)
						return;
					else if((/\bcursor-\S+/g).test(class_name))
						_scheme.view.element.classList.remove(class_name);
				}
				_scheme.view.element.classList.add(name);
			}
		}
	},

	/**
	 * ### Активизирует инструмент
	 * Находит инструмент по имени в коллекции tools и выполняет его метод [Tool.activate()](http://paperjs.org/reference/tool/#activate)
	 *
	 * @method select_tool
	 * @for Editor
	 * @param name {String} - имя инструмента
	 */
	select_tool: {
		value: function (name) {
			for(var t in this.tools){
				if(this.tools[t].options.name == name)
					return this.tools[t].activate();
			}
		}
	},

	/**
	 * ### Открывает изделие для редактирования
	 * MDI пока не реализовано. Изделие загружается в текущий проект
	 * @method open
	 * @for Editor
	 * @param [ox] {String|DataObj} - ссылка или объект продукции
	 */
	open: {
		value: function (ox) {
			if(ox)
				this.project.load(ox);
		}
	},

	/**
	 * ### (Пере)заполняет изделие данными типового блока
	 * - Вызывает диалог выбора типового блока и перезаполняет продукцию данными выбора
	 * - Если текущее изделие не пустое, задаёт вопрос о перезаписи данными типового блока
	 * - В обработчик выбора типового блока передаёт метод {{#crossLink "Scheme/load_stamp:method"}}Scheme.load_stamp(){{/crossLink}} текущего изделия
	 *
	 * @for Editor
	 * @method load_stamp
	 * @param confirmed {Boolean} - подавляет показ диалога подтверждения перезаполнения
	 */
	load_stamp: {
		value: function(confirmed){

			if(!confirmed && this.project.ox.coordinates.count()){
				dhtmlx.confirm({
					title: $p.msg.bld_from_blocks_title,
					text: $p.msg.bld_from_blocks,
					cancel: $p.msg.cancel,
					callback: function(btn) {
						if(btn)
							this.load_stamp(true);
					}.bind(this)
				});
				return;
			}

			$p.cat.characteristics.form_selection_block(null, {
				on_select: this.project.load_stamp.bind(this.project)
			});
		}
	},

	/**
	 * Returns path points which are contained in the rect
	 * @method segments_in_rect
	 * @for Editor
	 * @param rect
	 * @returns {Array}
	 */
	segments_in_rect: {
		value: 	function(rect) {
			var segments = [];

			function checkPathItem(item) {
				if (item._locked || !item._visible || item._guide)
					return;
				var children = item.children || [];
				if (!rect.intersects(item.bounds))
					return;
				if (item instanceof paper.Path) {

					if(item.parent instanceof Profile){
						if(item != item.parent.generatrix)
							return;

						for (var i = 0; i < item.segments.length; i++) {
							if (rect.contains(item.segments[i].point))
								segments.push(item.segments[i]);
						}
					}

				} else {
					for (var j = children.length-1; j >= 0; j--)
						checkPathItem(children[j]);
				}
			}

			this.project.getItems({class: Contour}).forEach(checkPathItem);

			return segments;
		}
	},

	purge_selection: {
		value: 	function(){
			var selected = this.project.selectedItems, deselect = [];
			for (var i = 0; i < selected.length; i++) {
				var path = selected[i];
				if(path.parent instanceof Profile && path != path.parent.generatrix)
					deselect.push(path);
			}
			while(selected = deselect.pop())
				selected.selected = false;
		}
	},


  /**
   * ### Диалог дополнительных вставок
   *
   * @param [cnstr] {Number} - номер элемента или контура
   */
  additional_inserts: {
    value: 	function(cnstr){

      var caption = $p.msg.additional_inserts,
        meta_fields = $p.cat.characteristics.metadata("inserts").fields._clone();

      if(!cnstr){
        cnstr = 0;
        caption+= ' в изделие';
        meta_fields.inset.choice_params[0].path = ["Изделие"];

      }else if(cnstr == 'elm'){
        cnstr = this.project.selected_elm;
        if(cnstr){
          // добавляем параметры вставки
          this.project.ox.add_inset_params(cnstr.inset, -cnstr.elm);
          caption+= ' элем. №' + cnstr.elm;
          cnstr = -cnstr.elm;
          meta_fields.inset.choice_params[0].path = ["Элемент"];

        }else{
          return;
        }

      }else if(cnstr == 'contour'){
        cnstr = this.project.activeLayer.cnstr
        caption+= ' в контур №' + cnstr;
        meta_fields.inset.choice_params[0].path = ["МоскитнаяСетка", "Контур"];

      }

      var options = {
        name: 'additional_inserts',
        wnd: {
          caption: caption,
          allow_close: true,
          width: 360,
          height: 420,
          modal: true
        }
      };
      // восстанавливаем сохранённые параметры
      //$p.wsql.restore_options("editor", options);

      //var wnd = $p.iface.dat_blank(this._dxw, options.wnd);
      var wnd = $p.iface.dat_blank(null, options.wnd);

      wnd.elmnts.layout = wnd.attachLayout({
        pattern: "2E",
        cells: [{
          id: "a",
          text: "Вставки",
          header: false,
          height: 160
        }, {
          id: "b",
          text: "Параметры",
          header: false
        }],
        offsets: { top: 0, right: 0, bottom: 0, left: 0}
      });

      wnd.elmnts.grids.inserts = wnd.elmnts.layout.cells("a").attachTabular({
        obj: this.project.ox,
        ts: "inserts",
        selection: {cnstr: cnstr},
        metadata: meta_fields,
        ts_captions: {
          fields: ["inset", "clr"],
          headers: "Вставка,Цвет",
          widths: "*,*",
          min_widths: "100,100",
          aligns: "",
          sortings: "na,na",
          types: "ref,ref"
        }
      });

      wnd.elmnts.grids.params = wnd.elmnts.layout.cells("b").attachHeadFields({
        obj: this.project.ox,
        ts: "params",
        selection: {cnstr: cnstr},
        oxml: {
          "Параметры": []
        },
        ts_title: "Параметры"
      });

    }
  },

	/**
	 * ### Поворот кратно 90° и выравнивание
	 *
	 * @method profile_align
	 * @for Editor
	 * @param name {String} - ('left', 'right', 'top', 'bottom', 'all', 'delete')
	 */
	profile_align: {
		value: 	function(name){


			// если "все", получаем все профили активного или родительского контура
			if(name == "all"){

				var l = this.project.activeLayer;
				while (l.parent)
					l = l.parent;

				l.profiles.forEach(function (profile) {

					if(profile.angle_hor % 90 == 0)
						return;

					var mid;

					if(profile.orientation == $p.enm.orientations.vert){

						mid = profile.b.x + profile.e.x / 2;

						if(mid < l.bounds.center.x)
							profile.x1 = profile.x2 = Math.min(profile.x1, profile.x2);
						else
							profile.x1 = profile.x2 = Math.max(profile.x1, profile.x2);

					}else if(profile.orientation == $p.enm.orientations.hor){

						mid = profile.b.y + profile.e.y / 2;

						if(mid < l.bounds.center.y)
							profile.y1 = profile.y2 = Math.max(profile.y1, profile.y2);
						else
							profile.y1 = profile.y2 = Math.min(profile.y1, profile.y2);

					}

				});


			}else{

				var profiles = this.project.selected_profiles(),
					contours = [], changed;

				profiles.forEach(function (profile) {

					if(profile.angle_hor % 90 == 0)
						return;

					changed = true;

					var minmax = {min: {}, max: {}};

					minmax.min.x = Math.min(profile.x1, profile.x2);
					minmax.min.y = Math.min(profile.y1, profile.y2);
					minmax.max.x = Math.max(profile.x1, profile.x2);
					minmax.max.y = Math.max(profile.y1, profile.y2);
					minmax.max.dx = minmax.max.x - minmax.min.x;
					minmax.max.dy = minmax.max.y - minmax.min.y;

					if(name == 'left' && minmax.max.dx < minmax.max.dy){
						if(profile.x1 - minmax.min.x > 0)
							profile.x1 = minmax.min.x;
						if(profile.x2 - minmax.min.x > 0)
							profile.x2 = minmax.min.x;

					}else if(name == 'right' && minmax.max.dx < minmax.max.dy){
						if(profile.x1 - minmax.max.x < 0)
							profile.x1 = minmax.max.x;
						if(profile.x2 - minmax.max.x < 0)
							profile.x2 = minmax.max.x;

					}else if(name == 'top' && minmax.max.dx > minmax.max.dy){
						if(profile.y1 - minmax.max.y < 0)
							profile.y1 = minmax.max.y;
						if(profile.y2 - minmax.max.y < 0)
							profile.y2 = minmax.max.y;

					}else if(name == 'bottom' && minmax.max.dx > minmax.max.dy) {
						if (profile.y1 - minmax.min.y > 0)
							profile.y1 = minmax.min.y;
						if (profile.y2 - minmax.min.y > 0)
							profile.y2 = minmax.min.y;

					}else if(name == 'delete') {
						profile.removeChildren();
						profile.remove();

					}else
						$p.msg.show_msg({type: "info", text: $p.msg.align_invalid_direction});

				});

				// прочищаем размерные линии
				if(changed || profiles.length > 1){
					profiles.forEach(function (p) {
						if(contours.indexOf(p.layer) == -1)
							contours.push(p.layer);
					});
					contours.forEach(function (l) {
						l.clear_dimentions();
					});
				}

				// если выделено несколько, запланируем групповое выравнивание
				if(name != 'delete' && profiles.length > 1){

					if(changed){
						this.project.register_change(true);
						setTimeout(this.profile_group_align.bind(this, name, profiles), 100);

					}else
						this.profile_group_align(name);

				}else if(changed)
					this.project.register_change(true);
			}

		}
	},

	profile_group_align: {
		value: 	function(name, profiles){

			var	coordin = name == 'left' || name == 'bottom' ? Infinity : 0;

			if(!profiles)
				profiles = this.project.selected_profiles();

			if(profiles.length < 1)
				return;

			profiles.forEach(function (p) {
				switch (name){
					case 'left':
						if(p.x1 < coordin)
							coordin = p.x1;
						if(p.x2 < coordin)
							coordin = p.x2;
						break;
					case 'bottom':
						if(p.y1 < coordin)
							coordin = p.y1;
						if(p.y2 < coordin)
							coordin = p.y2;
						break;
					case 'top':
						if(p.y1 > coordin)
							coordin = p.y1;
						if(p.y2 > coordin)
							coordin = p.y2;
						break;
					case 'right':
						if(p.x1 > coordin)
							coordin = p.x1;
						if(p.x2 > coordin)
							coordin = p.x2;
						break;
				}
			});

			profiles.forEach(function (p) {
				switch (name){
					case 'left':
					case 'right':
						p.x1 = p.x2 = coordin;
						break;
					case 'bottom':
					case 'top':
						p.y1 = p.y2 = coordin;
						break;
				}
			});

		}
	},

	/**
	 * ### Деструктор
	 * @method unload
	 * @for Editor
	 */
	unload: {
		value: function () {

			if(this.tool && this.tool._callbacks.deactivate.length)
				this.tool._callbacks.deactivate[0].call(this.tool);

			for(var t in this.tools){
				if(this.tools[t].remove)
					this.tools[t].remove();
				this.tools[t] = null;
			}

			this.tb_left.unload();
			this.tb_top.unload();
			this._acc.unload();

		}
	}

});

/**
 * Экспортируем конструктор Editor, чтобы экземпляры построителя можно было создать снаружи
 * @property Editor
 * @for MetaEngine
 * @type {function}
 */
$p.Editor = Editor;


/**
 * Строковые константы интернационализации
 * Created 13.03.2016<br />
 * &copy; http://www.oknosoft.ru 2014-2016
 * @author Evgeniy Malyarov
 * @module i18n.ru.js
 */

(function (msg){

  msg.additional_inserts = "Доп. вставки";
	msg.align_node_right = "Уравнять вертикально вправо";
	msg.align_node_bottom = "Уравнять горизонтально вниз";
	msg.align_node_top = "Уравнять горизонтально вверх";
	msg.align_node_left = "Уравнять вертикально влево";
	msg.align_set_right = "Установить размер сдвигом правых элементов";
	msg.align_set_bottom = "Установить размер сдвигом нижних элементов";
	msg.align_set_top = "Установить размер сдвигом верхних элементов";
	msg.align_set_left = "Установить размер сдвигом левых элементов";
	msg.align_all = "Установить прямые углы";
	msg.align_invalid_direction = "Неприменимо для элемента с данной ориентацией";

	msg.bld_constructor = "Конструктор объектов графического построителя";
	msg.bld_title = "Графический построитель";
	msg.bld_empty_param = "Не заполнен обязательный параметр <br />";
	msg.bld_not_product = "В текущей строке нет изделия построителя";
	msg.bld_not_draw = "Отсутствует эскиз или не указана система профилей";
	msg.bld_not_sys = "Не указана система профилей";
	msg.bld_from_blocks_title = "Выбор типового блока";
	msg.bld_from_blocks = "Текущее изделие будет заменено конфигурацией типового блока. Продолжить?";
	msg.bld_split_imp = "В параметрах продукции<br />'%1'<br />запрещены незамкнутые контуры<br />" +
		"Для включения деления импостом,<br />установите это свойство в 'Истина'";

	msg.bld_new_stv = "Добавить створку";
	msg.bld_new_stv_no_filling = "Перед добавлением створки, укажите заполнение,<br />в которое поместить створку";

	msg.del_elm = "Удалить элемент";

  msg.to_contour = "в контур";
  msg.to_elm = "в элемент";
  msg.to_product = "в изделие";

	msg.ruler_elm = "Расстояние между элементами";
	msg.ruler_node = "Расстояние между узлами";
	msg.ruler_new_line = "Добавить размерную линию";

	msg.ruler_base = "По опорным линиям";
	msg.ruler_inner = "По внутренним линиям";
	msg.ruler_outer = "По внешним линиям";



})($p.msg);

/**
 * Обработчик сочетаний клавишь
 * @author Evgeniy Malyarov
 * @module keyboard
 */

/**
 * ### Клавиатура
 * Управление редактором с клавиатуры
 *
 * @class Keybrd
 * @param _editor
 * @constructor
 */
function Keybrd(_editor) {
	
}
/**
 * Объект для сохранения истории редактирования и реализации команд (вперёд|назад)
 * @author Evgeniy Malyarov
 * @module undo
 */

/**
 * ### История редактирования
 * Объект для сохранения истории редактирования и реализации команд (вперёд|назад)
 * Из публичных интерфейсов имеет только методы back() и rewind()
 * Основную работу делает прослушивая широковещательные события
 *
 * @class UndoRedo
 * @constructor
 * @param _editor {Editor} - указатель на экземпляр редактора
 */
function UndoRedo(_editor){

	var _history = [],
		pos = -1,
		snap_timer;

	function run_snapshot() {

		// запускаем короткий пересчет изделия
		if(pos >= 0){

			// если pos < конца истории, отрезаем хвост истории
			if(pos > 0 && pos < (_history.length - 1)){
				_history.splice(pos, _history.length - pos - 1);
			}

			_editor.project.save_coordinates({snapshot: true, clipboard: false});

		}

	}

	function save_snapshot(scheme) {
		_history.push(JSON.stringify({}._mixin(scheme.ox._obj, [], ["extra_fields","glasses","specification","predefined_name"])));
		pos = _history.length - 1;
		enable_buttons();
	}

	function apply_snapshot() {
		_editor.project.load_stamp(JSON.parse(_history[pos]), true);
		enable_buttons();
	}

	function enable_buttons() {
		if(pos < 1)
			_editor.tb_top.buttons.back.classList.add("disabledbutton");
		else
			_editor.tb_top.buttons.back.classList.remove("disabledbutton");

		if(pos < (_history.length - 1))
			_editor.tb_top.buttons.rewind.classList.remove("disabledbutton");
		else
			_editor.tb_top.buttons.rewind.classList.add("disabledbutton");

	}

	function clear() {
		_history.length = 0;
		pos = -1;
	}

	// обрабатываем изменения изделия
	$p.eve.attachEvent("scheme_changed", function (scheme, attr) {
		if(scheme == _editor.project){

			// при открытии изделия чистим историю
			if(scheme.data._loading){
				if(!scheme.data._snapshot){
					clear();
					save_snapshot(scheme);
				}

			} else{
				// при обычных изменениях, запускаем таймер снапшота
				if(snap_timer)
					clearTimeout(snap_timer);
				snap_timer = setTimeout(run_snapshot, 700);
				enable_buttons();
			}
		}

	});

	// при закрытии редактора чистим историю
	$p.eve.attachEvent("editor_closed", clear);

	// при готовности снапшота, добавляем его в историю
	$p.eve.attachEvent("scheme_snapshot", function (scheme, attr) {
		if(scheme == _editor.project && !attr.clipboard){
			save_snapshot(scheme);
		}

	});

	this.back = function() {
		if(pos > 0)
			pos--;
		if(pos >= 0)
			apply_snapshot();
		else
			enable_buttons();
	};

	this.rewind = function() {
		if(pos <= (_history.length - 1)){
			pos++;
			apply_snapshot();
		}
	}
}

/**
 * ### Контур (слой) изделия
 *
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2016<br />
 * Created 24.07.2015
 *
 * @module geometry
 * @submodule contour
 */

/**
 * ### Контур (слой) изделия
 * Унаследован от  [paper.Layer](http://paperjs.org/reference/layer/)
 * новые элементы попадают в активный слой-контур и не могут его покинуть
 * @class Contour
 * @constructor
 * @extends paper.Layer
 * @menuorder 30
 * @tooltip Контур (слой) изделия
 */
function Contour(attr){

	/**
	 * За этим полем будут "следить" элементы контура и пересчитывать - перерисовывать себя при изменениях соседей
	 */
	this._noti = {};

	/**
	 * Формирует оповещение для тех, кто следит за this._noti
	 * @param obj
	 */
	this.notify = function (obj) {
		_notifier.notify(obj);
		_contour.project.register_change();
	};

	var _contour = this,
		_row,
		_notifier = Object.getNotifier(this._noti),
		_layers = {};

	Contour.superclass.constructor.call(this);

	if(attr.parent)
		this.parent = attr.parent;

	// строка в таблице конструкций
	if(attr.row)
		_row = attr.row;
	else{
		_row = _contour.project.ox.constructions.add({ parent: this.parent ? this.parent.cnstr : 0 });
		_row.cnstr = _contour.project.ox.constructions.aggregate([], ["cnstr"], "MAX") + 1;
	}


	this.__define({

		_row: {
			get : function(){
				return _row;
			}
		},

		cnstr: {
			get : function(){
				return _row.cnstr;
			},
			set : function(v){
				_row.cnstr = v;
			}
		},

		// служебная группа текстовых комментариев
		l_text: {
			get: function () {
				if(!_layers.text)
					_layers.text = new paper.Group({ parent: this });
				return _layers.text;
			}
		},

		// служебная группа визуализации допов,  петель и ручек
		l_visualization: {
			get: function () {
				if(!_layers.visualization)
					_layers.visualization = new paper.Group({ parent: this, guide: true });
				return _layers.visualization;
			}
		},

		// служебная группа размерных линий
		l_dimensions: {
			get: function () {
				if(!_layers.dimensions){
					_layers.dimensions = new paper.Group({ parent: this });
					_layers.dimensions.bringToFront();
				}
				return _layers.dimensions;
			}
		}

	});


	/**
	 * путь контура - при чтении похож на bounds
	 * для вложенных контуров определяет положение, форму и количество сегментов створок
	 * @property path
	 * @type paper.Path
	 */
	this.__define('path', {
		get : function(){
			return this.bounds;
		},
		set : function(attr){

			if(Array.isArray(attr)){

				var need_bind = attr.length,
					outer_nodes = this.outer_nodes,
					available_bind = outer_nodes.length,
					elm, curr,
					noti = {type: consts.move_points, profiles: [], points: []};

				// первый проход: по двум узлам либо примыканию к образующей
				if(need_bind){
					for(var i in attr){
						curr = attr[i];             // curr.profile - сегмент внешнего профиля
						for(var j in outer_nodes){
							elm = outer_nodes[j];   // elm - сегмент профиля текущего контура
							if(elm.data.binded)
								continue;
							if(curr.profile.is_nearest(elm)){
								elm.data.binded = true;
								curr.binded = true;
								need_bind--;
								available_bind--;
								if(!curr.b.is_nearest(elm.b)){
									elm.rays.clear(true);
									elm.b = curr.b;
									if(noti.profiles.indexOf(elm) == -1){
										noti.profiles.push(elm);
										noti.points.push(elm.b);
									}
								}

								if(!curr.e.is_nearest(elm.e)){
									elm.rays.clear(true);
									elm.e = curr.e;
									if(noti.profiles.indexOf(elm) == -1){
										noti.profiles.push(elm);
										noti.points.push(elm.e);
									}
								}

								break;
							}
						}
					}
				}

				// второй проход: по одному узлу
				if(need_bind){
					for(var i in attr){
						curr = attr[i];
						if(curr.binded)
							continue;
						for(var j in outer_nodes){
							elm = outer_nodes[j];
							if(elm.data.binded)
								continue;
							if(curr.b.is_nearest(elm.b, true) || curr.e.is_nearest(elm.e, true)){
								elm.data.binded = true;
								curr.binded = true;
								need_bind--;
								available_bind--;
								elm.rays.clear(true);
								elm.b = curr.b;
								elm.e = curr.e;
								if(noti.profiles.indexOf(elm) == -1){
									noti.profiles.push(elm);
									noti.points.push(elm.b);
									noti.points.push(elm.e);
								}
								break;
							}
						}
					}
				}

				// третий проход - из оставшихся
				if(need_bind && available_bind){
					for(var i in attr){
						curr = attr[i];
						if(curr.binded)
							continue;
						for(var j in outer_nodes){
							elm = outer_nodes[j];
							if(elm.data.binded)
								continue;
							elm.data.binded = true;
							curr.binded = true;
							need_bind--;
							available_bind--;
							// TODO заменить на клонирование образующей
							elm.rays.clear(true);
							elm.b = curr.b;
							elm.e = curr.e;
							if(noti.profiles.indexOf(elm) == -1){
								noti.profiles.push(elm);
								noti.points.push(elm.b);
								noti.points.push(elm.e);
							}
							break;
						}
					}
				}

				// четвертый проход - добавляем
				if(need_bind){
					for(var i in attr){
						curr = attr[i];
						if(curr.binded)
							continue;
						elm = new Profile({
							generatrix: curr.profile.generatrix.get_subpath(curr.b, curr.e),
							proto: outer_nodes.length ? outer_nodes[0] : {
								parent: this,
								clr: _contour.project.default_clr()
							}
						});
						curr.profile = elm;
						if(curr.outer)
							delete curr.outer;
						curr.binded = true;

						elm.data.binded = true;
						elm.data.simulated = true;

						noti.profiles.push(elm);
						noti.points.push(elm.b);
						noti.points.push(elm.e);

						need_bind--;
					}
				}

				// удаляем лишнее
				if(available_bind){
					outer_nodes.forEach(function (elm) {
						if(!elm.data.binded){
							elm.rays.clear(true);
							elm.remove();
							available_bind--;
						}
					});
				}

				// информируем систему об изменениях
				if(noti.points.length)
					this.notify(noti);

				// пересчитываем вставки створок
				this.profiles.forEach(function (p) {
					if(p.nearest()){
						p.inset = p.project.default_inset({
							elm_type: p.elm_type,
							pos: p.pos,
							inset: p.inset
						});
					}
				});
				this.data._bounds = null;

			}

		},
		enumerable : true
	});


	/**
	 * Удаляет контур из иерархии проекта
	 * Одновлеменно, удаляет строку из табчасти _Конструкции_ и подчиненные строки из табчасти _Координаты_
	 * @method remove
	 */
	this.remove = function () {

		//удаляем детей
		while(this.children.length)
			this.children[0].remove();

		var ox = this.project.ox,
			_del_rows = ox.coordinates.find_rows({cnstr: this.cnstr});
		_del_rows.forEach(function (row) {
			ox.coordinates.del(row._row);
		});
		_del_rows = null;

		// удаляем себя
		if(ox === _row._owner._owner)
			_row._owner.del(_row);
		_row = null;

		// стандартные действия по удалению элемента paperjs
		Contour.superclass.remove.call(this);
	};


	// добавляем элементы контура
	if(this.cnstr){

		var coordinates = this.project.ox.coordinates;

		// профили и доборы
		coordinates.find_rows({cnstr: this.cnstr, elm_type: {in: $p.enm.elm_types.profiles}}, function(row){

			var profile = new Profile({row: row, parent: _contour});

			coordinates.find_rows({cnstr: row.cnstr, parent: {in: [row.elm, -row.elm]}, elm_type: $p.enm.elm_types.Добор}, function(row){
				new ProfileAddl({row: row,	parent: profile});
			});

		});

		// заполнения
		coordinates.find_rows({cnstr: this.cnstr, elm_type: {in: $p.enm.elm_types.glasses}}, function(row){
			new Filling({row: row,	parent: _contour});
		});

		// остальные элементы (текст)
		coordinates.find_rows({cnstr: this.cnstr, elm_type: $p.enm.elm_types.Текст}, function(row){

			if(row.elm_type == $p.enm.elm_types.Текст){
				new FreeText({
					row: row,
					parent: _contour.l_text
				});
			}

		});

	}


}
Contour._extend(paper.Layer);

Contour.prototype.__define({

	/**
	 * Врезаем оповещение при активации слоя
	 */
	activate: {
		value: function(custom) {
			this.project._activeLayer = this;
			$p.eve.callEvent("layer_activated", [this, !custom]);
			this.project.register_update();
		}
	},

	/**
	 * Возвращает массив профилей текущего контура
	 * @property profiles
	 * @for Contour
	 * @returns {Array.<Profile>}
	 */
	profiles: {
		get: function(){
			var res = [];
			this.children.forEach(function(elm) {
				if (elm instanceof Profile){
					res.push(elm);
				}
			});
			return res;
		}
	},

	/**
	 * Возвращает массив импостов текущего + вложенных контура
	 * @property imposts
	 * @for Contour
	 * @returns {Array.<Profile>}
	 */
	imposts: {
		get: function(){
			var res = [];
			this.getItems({class: Profile}).forEach(function(elm) {
				if (elm.rays.b.is_t || elm.rays.e.is_t || elm.rays.b.is_i || elm.rays.e.is_i){
					res.push(elm);
				}
			});
			return res;
		}
	},

	/**
	 * Возвращает массив заполнений + створок текущего контура
	 * @property glasses
	 * @for Contour
	 * @param [hide] {Boolean} - если истина, устанавливает для заполнений visible=false
	 * @param [glass_only] {Boolean} - если истина, возвращает только заполнения
	 * @returns {Array}
	 */
	glasses: {
		value: function (hide, glass_only) {
			var res = [];
			this.children.forEach(function(elm) {
				if ((!glass_only && elm instanceof Contour) || elm instanceof Filling){
					res.push(elm);
					if(hide)
						elm.visible = false;
				}
			});
			return res;
		}
	},

	/**
	 * Габариты по внешним краям профилей контура
	 */
	bounds: {
		get: function () {

			if(!this.data._bounds){

				var profiles = this.profiles;
				if(profiles.length && profiles[0].path){
					this.data._bounds = profiles[0].path.bounds;
					for(var i = 1; i < profiles.length; i++)
						this.data._bounds = this.data._bounds.unite(profiles[i].path.bounds);

					// если профили еще не нарисованы, используем габариты образующих
					if(!this.data._bounds.width || !this.data._bounds.height){
						for(var i = 1; i < profiles.length; i++)
							this.data._bounds = this.data._bounds.unite(profiles[i].generatrix.bounds);
					}

				}else{
					this.data._bounds = new paper.Rectangle();

				}
			}

			return this.data._bounds;

		}
	},

	/**
	 * Габариты с учетом пользовательских размерных линий, чтобы рассчитать отступы автолиний
	 */
	dimension_bounds: {

		get: function(){
			var bounds = this.bounds;
			this.getItems({class: DimensionLineCustom}).forEach(function (dl) {
				bounds = bounds.unite(dl.bounds);
			});
			return bounds;
		}
	},

	/**
	 * Перерисовывает элементы контура
	 * @method redraw
	 * @for Contour
	 */
	redraw: {
		value: function(on_contour_redrawed){

			if(!this.visible)
				return on_contour_redrawed ? on_contour_redrawed() : undefined;

			var _contour = this,
				profiles = this.profiles,
				llength = 0;

			function on_child_contour_redrawed(){
				llength--;
				if(!llength && on_contour_redrawed)
					on_contour_redrawed();
			}

			// сбрасываем кеш габаритов
			this.data._bounds = null;

			// чистим визуализацию
			if(!this.project.data._saving && this.l_visualization._by_spec)
				this.l_visualization._by_spec.removeChildren();

			// сначала перерисовываем все профили контура
			profiles.forEach(function(elm) {
				elm.redraw();
			});

			// затем, создаём и перерисовываем заполнения
			_contour.glass_recalc();

			// перерисовываем раскладки заполнений
			_contour.glasses(false, true).forEach(function (glass) {
				glass.redraw_onlay();
			});

			// рисуем направление открывания и ручку
			_contour.draw_opening();

			// перерисовываем вложенные контуры
			_contour.children.forEach(function(child_contour) {
				if (child_contour instanceof Contour){
					llength++;
					//setTimeout(function () {
					//	if(!_contour.project.has_changes())
					//		child_contour.redraw(on_child_contour_redrawed);
					//});
					child_contour.redraw(on_child_contour_redrawed);
				}
			});

			// информируем мир о новых размерах нашего контура
			$p.eve.callEvent("contour_redrawed", [this, this.data._bounds]);

			// если нет вложенных контуров, информируем проект о завершении перерисовки контура
			if(!llength && on_contour_redrawed)
				on_contour_redrawed();

		}
	},

	/**
	 * Вычисляемые поля в таблицах конструкций и координат
	 * @method save_coordinates
	 * @for Contour
	 */
	save_coordinates: {
		value: function () {

			// удаляем скрытые заполнения
			this.glasses(false, true).forEach(function (glass) {
				if(!glass.visible)
					glass.remove();
			});

			// запись в таблице координат, каждый элемент пересчитывает самостоятельно
			this.children.forEach(function (elm) {
				if(elm.save_coordinates){
					elm.save_coordinates();

				}else if(elm instanceof paper.Group && (elm == elm.layer.l_text || elm == elm.layer.l_dimensions)){
					elm.children.forEach(function (elm) {
						if(elm.save_coordinates)
							elm.save_coordinates();
					});
				}
			});

			// ответственность за строку в таблице конструкций лежит на контуре
			this._row.x = this.bounds ? this.bounds.width : 0;
			this._row.y = this.bounds? this.bounds.height : 0;
			this._row.is_rectangular = this.is_rectangular;
			if(this.parent){
				this._row.w = this.w;
				this._row.h = this.h;
			}else{
				this._row.w = 0;
				this._row.h = 0;
			}
		}
	},

	/**
	 * Возвращает ребро текущего контура по узлам
	 * @param n1 {paper.Point} - первый узел
	 * @param n2 {paper.Point} - второй узел
	 * @param [point] {paper.Point} - дополнительная проверочная точка
	 * @returns {Profile}
	 */
	profile_by_nodes: {
		value: function (n1, n2, point) {
			var profiles = this.profiles, g;
			for(var i = 0; i < profiles.length; i++){
				g = profiles[i].generatrix;
				if(g.getNearestPoint(n1).is_nearest(n1) && g.getNearestPoint(n2).is_nearest(n2)){
					if(!point || g.getNearestPoint(point).is_nearest(point))
						return p;
				}
			}
		}
	},

	/**
	 * Возвращает массив внешних профилей текущего контура. Актуально для створок, т.к. они всегда замкнуты
	 * @property outer_nodes
	 * @for Contour
	 * @type {Array}
	 */
	outer_nodes: {
		get: function(){
			return this.outer_profiles.map(function (v) {
				return v.elm;
			});
		}
	},

	/**
	 * Возвращает массив внешних и примыкающих профилей текущего контура
	 */
	outer_profiles: {
		get: function(){
			// сначала получим все профили
			var profiles = this.profiles,
				to_remove = [], res = [], elm, findedb, findede;

			// прочищаем, выкидывая такие, начало или конец которых соединениы не в узле
			for(var i=0; i<profiles.length; i++){
				elm = profiles[i];
				if(elm.data.simulated)
					continue;
				findedb = false;
				findede = false;
				for(var j=0; j<profiles.length; j++){
					if(profiles[j] == elm)
						continue;
					if(!findedb && elm.has_cnn(profiles[j], elm.b) && elm.b.is_nearest(profiles[j].e))
						findedb = true;
					if(!findede && elm.has_cnn(profiles[j], elm.e) && elm.e.is_nearest(profiles[j].b))
						findede = true;
				}
				if(!findedb || !findede)
					to_remove.push(elm);
			}
			for(var i=0; i<profiles.length; i++){
				elm = profiles[i];
				if(to_remove.indexOf(elm) != -1)
					continue;
				elm.data.binded = false;
				res.push({
					elm: elm,
					profile: elm.nearest(),
					b: elm.b,
					e: elm.e
				});
			}
			return res;
		}
	},

	/**
	 * Возвращает массив узлов текущего контура
	 * @property nodes
	 * @for Contour
	 * @type {Array}
	 */
	nodes: {
		get: function(){
			var findedb, findede, nodes = [];

			this.profiles.forEach(function (p) {
				findedb = false;
				findede = false;
				nodes.forEach(function (n) {
					if(p.b.is_nearest(n))
						findedb = true;
					if(p.e.is_nearest(n))
						findede = true;
				});
				if(!findedb)
					nodes.push(p.b.clone());
				if(!findede)
					nodes.push(p.e.clone());
			});

			return nodes;
		}
	},

	/**
	 * Возвращает массив отрезков, которые потенциально могут образовывать заполнения
	 * (соединения с пустотой отбрасываются)
	 * @property glass_segments
	 * @for Contour
	 * @type {Array}
	 */
	glass_segments: {
		get: function(){
			var profiles = this.profiles,
				is_flap = !!this.parent,
				nodes = [];

			// для всех профилей контура
			profiles.forEach(function (p) {

				// ищем примыкания T к текущему профилю
				var ip = p.joined_imposts(),
					gen = p.generatrix, pbg, peg,
					pb = p.cnn_point("b"),
					pe = p.cnn_point("e");

				// для створочных импостов используем не координаты их b и e, а ближайшие точки примыкающих образующих
				if(is_flap && pb.is_t)
					pbg = pb.profile.generatrix.getNearestPoint(p.b);
				else
					pbg = p.b;

				if(is_flap && pe.is_t)
					peg = pe.profile.generatrix.getNearestPoint(p.e);
				else
					peg = p.e;

				// если есть примыкания T, добавляем сегменты, исключая соединения с пустотой
				if(ip.inner.length){
					ip.inner.sort(function (a, b) {
						var da = gen.getOffsetOf(a.point) , db = gen.getOffsetOf(b.point);
						if (da < db)
							return -1;
						else if (da > db)
							return 1;
						return 0;
					});
					if(!pb.is_i)
						nodes.push(new GlassSegment(p, pbg, ip.inner[0].point));

					for(var i = 1; i < ip.inner.length; i++)
						nodes.push(new GlassSegment(p, ip.inner[i-1].point, ip.inner[i].point));

					if(!pe.is_i)
						nodes.push(new GlassSegment(p, ip.inner[ip.inner.length-1].point, peg));
				}
				if(ip.outer.length){
					ip.outer.sort(function (a, b) {
						var da = gen.getOffsetOf(a.point) , db = gen.getOffsetOf(b.point);
						if (da < db)
							return -1;
						else if (da > db)
							return 1;
						return 0;
					});
					if(!pb.is_i)
						nodes.push(new GlassSegment(p, ip.outer[0].point, pbg, true));

					for(var i = 1; i < ip.outer.length; i++)
						nodes.push(new GlassSegment(p, ip.outer[i].point, ip.outer[i-1].point, true));

					if(!pe.is_i)
						nodes.push(new GlassSegment(p, peg, ip.outer[ip.outer.length-1].point, true));
				}
				if(!ip.inner.length){
					// добавляем, если нет соединений с пустотой
					if(!pb.is_i && !pe.is_i)
						nodes.push(new GlassSegment(p, pbg, peg));
				}
				if(!ip.outer.length && (pb.is_cut || pe.is_cut || pb.is_t || pe.is_t)){
					// для импостов добавляем сегмент в обратном направлении
					if(!pb.is_i && !pe.is_i)
						nodes.push(new GlassSegment(p, peg, pbg, true));
				}
			});

			return nodes;
		}
	},

	/**
	 * Возвращает массив массивов сегментов - база для построения пути заполнений
	 * @property glass_contours
	 * @for Contour
	 * @type {Array}
	 */
	glass_contours: {
		get: function(){
			var segments = this.glass_segments,
				curr, acurr, res = [];

			// возвращает массив сегментов, которые могут следовать за текущим
			function find_next(curr){
				if(!curr.anext){
					curr.anext = [];
					segments.forEach(function (segm) {
						if(segm == curr || segm.profile == curr.profile)
							return;
						// если конец нашего совпадает с началом следующего...
						// и если существует соединение нашего со следующим
						if(curr.e.is_nearest(segm.b) && curr.profile.has_cnn(segm.profile, segm.b)){

							if(curr.e.subtract(curr.b).getDirectedAngle(segm.e.subtract(segm.b)) >= 0)
								curr.anext.push(segm);
						}

					});
				}
				return curr.anext;
			}

			// рекурсивно получает следующий сегмент, пока не уткнётся в текущий
			function go_go(segm){
				var anext = find_next(segm);
				for(var i in anext){
					if(anext[i] == curr)
						return anext;
					else if(acurr.every(function (el) {	return el != anext[i]; })){
						acurr.push(anext[i]);
						return go_go(anext[i]);
					}
				}
			}

			while(segments.length){
				curr = segments[0];
				acurr = [curr];
				if(go_go(curr) && acurr.length > 1){
					res.push(acurr);
				}
				// удаляем из segments уже задействованные или не пригодившиеся сегменты
				acurr.forEach(function (el) {
					var ind = segments.indexOf(el);
					if(ind != -1)
						segments.splice(ind, 1);
				});
			}

			return res;

		}
	},

	/**
	 * Получает замкнутые контуры, ищет подходящие створки или заполнения, при необходимости создаёт новые
	 * @method glass_recalc
	 * @for Contour
	 */
	glass_recalc: {
		value: function () {
			var _contour = this,
				contours = _contour.glass_contours,
				glasses = _contour.glasses(true);

			/**
			 * Привязывает к пути найденной замкнутой области заполнение или вложенный контур текущего контура
			 * @param glass_contour {Array}
			 */
			function bind_glass(glass_contour){
				var rating = 0, glass, crating, cglass, glass_nodes, glass_path_center;

				for(var g in glasses){

					glass = glasses[g];
					if(glass.visible)
						continue;

					// вычисляем рейтинг
					crating = 0;
					glass_nodes = glass.outer_profiles;
					// если есть привязанные профили, используем их. иначе - координаты узлов
					if(glass_nodes.length){
						for(var j in glass_contour){
							for(var i in glass_nodes){
								if(glass_contour[j].profile == glass_nodes[i].profile &&
									glass_contour[j].b.is_nearest(glass_nodes[i].b) &&
									glass_contour[j].e.is_nearest(glass_nodes[i].e)){

									crating++;
									break;
								}
							}
							if(crating > 2)
								break;
						}
					}else{
						glass_nodes = glass.nodes;
						for(var j in glass_contour){
							for(var i in glass_nodes){
								if(glass_contour[j].b.is_nearest(glass_nodes[i])){
									crating++;
									break;
								}
							}
							if(crating > 2)
								break;
						}
					}

					if(crating > rating || !cglass){
						rating = crating;
						cglass = glass;
					}
					if(crating == rating && cglass != glass){
						if(!glass_path_center){
							glass_path_center = glass_contour[0].b;
							for(var i=1; i<glass_contour.length; i++)
								glass_path_center = glass_path_center.add(glass_contour[i].b);
							glass_path_center = glass_path_center.divide(glass_contour.length);
						}
						if(glass_path_center.getDistance(glass.bounds.center, true) < glass_path_center.getDistance(cglass.bounds.center, true))
							cglass = glass;
					}
				}

				// TODO реализовать настоящее ранжирование
				if(cglass || (cglass = _contour.getItem({class: Filling, visible: false}))) {
					cglass.path = glass_contour;
					cglass.visible = true;
					if (cglass instanceof Filling) {
						cglass.sendToBack();
						cglass.path.visible = true;
					}
				}else{
					// добавляем заполнение
					// 1. ищем в изделии любое заполнение
					// 2. если не находим, используем умолчание системы
					if(glass = _contour.getItem({class: Filling})){

					}else if(glass = _contour.project.getItem({class: Filling})){

					}else{

					}
					cglass = new Filling({proto: glass, parent: _contour, path: glass_contour});
					cglass.sendToBack();
					cglass.path.visible = true;
				}
			}

			/**
			 * Бежим по найденным контурам заполнений и выполняем привязку
			 */
			contours.forEach(bind_glass);

		}
	},

	/**
	 * Ищет и привязывает узлы профилей к пути заполнения
	 * @method glass_nodes
	 * @for Contour
	 * @param path {paper.Path} - массив ограничивается узлами, примыкающими к пути
	 * @param [nodes] {Array} - если указано, позволяет не вычислять исходный массив узлов контура, а использовать переданный
	 * @param [bind] {Boolean} - если указано, сохраняет пары узлов в path.data.curve_nodes
	 * @returns {Array}
	 */
	glass_nodes: {
		value: function (path, nodes, bind) {

			var curve_nodes = [], path_nodes = [],
				ipoint = path.interiorPoint.negate(),
				i, curve, findedb, findede,
				d, d1, d2, node1, node2;

			if(!nodes)
				nodes = this.nodes;

			if(bind){
				path.data.curve_nodes = curve_nodes;
				path.data.path_nodes = path_nodes;
			}

			// имеем путь и контур.
			for(i in path.curves){
				curve = path.curves[i];

				// в node1 и node2 получаем ближайший узел контура к узлам текущего сегмента
				d1 = 10e12; d2 = 10e12;
				nodes.forEach(function (n) {
					if((d = n.getDistance(curve.point1, true)) < d1){
						d1 = d;
						node1 = n;
					}
					if((d = n.getDistance(curve.point2, true)) < d2){
						d2 = d;
						node2 = n;
					}
				});

				// в path_nodes просто накапливаем узлы. наверное, позже они будут упорядочены
				if(path_nodes.indexOf(node1) == -1)
					path_nodes.push(node1);
				if(path_nodes.indexOf(node2) == -1)
					path_nodes.push(node2);

				if(!bind)
					continue;

				// заполнение может иметь больше курв, чем профиль
				if(node1 == node2)
					continue;
				findedb = false;
				for(var n in curve_nodes){
					if(curve_nodes[n].node1 == node1 && curve_nodes[n].node2 == node2){
						findedb = true;
						break;
					}
				}
				if(!findedb){
					findedb = this.profile_by_nodes(node1, node2);
					var loc1 = findedb.generatrix.getNearestLocation(node1),
						loc2 = findedb.generatrix.getNearestLocation(node2);
					// уточняем порядок нод
					if(node1.add(ipoint).getDirectedAngle(node2.add(ipoint)) < 0)
						curve_nodes.push({node1: node2, node2: node1, profile: findedb, out: loc2.index == loc1.index ? loc2.parameter > loc1.parameter : loc2.index > loc1.index});
					else
						curve_nodes.push({node1: node1, node2: node2, profile: findedb, out: loc1.index == loc2.index ? loc1.parameter > loc2.parameter : loc1.index > loc2.index});
				}
			}

			this.sort_nodes(curve_nodes);

			return path_nodes;
		}
	},

	/**
	 * Упорядочивает узлы, чтобы по ним можно было построить путь заполнения
	 * @method sort_nodes
	 * @for Contour
	 * @param [nodes] {Array}
	 */
	sort_nodes: {
		value: function (nodes) {
			if(!nodes.length)
				return nodes;
			var prev = nodes[0], res = [prev], curr, couner = nodes.length + 1;
			while (res.length < nodes.length && couner){
				couner--;
				for(var i = 0; i < nodes.length; i++){
					curr = nodes[i];
					if(res.indexOf(curr) != -1)
						continue;
					if(prev.node2 == curr.node1){
						res.push(curr);
						prev = curr;
						break;
					}
				}
			}
			if(couner){
				nodes.length = 0;
				for(var i = 0; i < res.length; i++)
					nodes.push(res[i]);
				res.length = 0;
			}
		}
	},

	// виртуальные метаданные для автоформ
	_metadata: {
		get : function(){
			var t = this,
				_xfields = t.project.ox._metadata.tabular_sections.constructions.fields; //_dgfields = this.project._dp._metadata.fields

			return {
				fields: {
					furn: _xfields.furn,
					clr_furn: _xfields.clr_furn,
					direction: _xfields.direction,
					h_ruch: _xfields.h_ruch
				},
				tabular_sections: {
					params: t.project.ox._metadata.tabular_sections.params
				}
			};
		}
	},

	/**
	 * виртуальный датаменеджер для автоформ
	 */
	_manager: {
		get: function () {
			return this.project._dp._manager;
		}
	},

	/**
	 * виртуальная табличная часть параметров фурнитуры
	 */
	params: {
		get: function () {
			return this.project.ox.params;
		}
	},

	/**
	 * указатель на фурнитуру
	 */
	furn: {
		get: function () {
			return this._row.furn;
		},
		set: function (v) {

			if(this._row.furn == v)
				return;

			this._row.furn = v;

			// при необходимости устанавливаем направление открывания
			if(this.direction.empty()){
				this.project._dp.sys.furn_params.find_rows({
					param: $p.job_prm.properties.direction
				}, function (row) {
					this.direction = row.value;
					return false;
				}.bind(this._row));
			}

			// при необходимости устанавливаем цвет
			// если есть контуры с цветной фурнитурой, используем. иначе - цвет из фурнитуры
			if(this.clr_furn.empty()){
				this.project.ox.constructions.find_rows({clr_furn: {not: $p.cat.clrs.get()}}, function (row) {
					this.clr_furn = row.clr_furn;
					return false;
				}.bind(this._row));
			}
			if(this.clr_furn.empty()){
				this._row.furn.colors.each(function (row) {
					this.clr_furn = row.clr;
					return false;
				}.bind(this._row));
			}

			// перезаполняем параметры фурнитуры
			this._row.furn.refill_prm(this);

			this.project.register_change(true);

			setTimeout($p.eve.callEvent.bind($p.eve, "furn_changed", [this]));

		}
	},

	/**
	 * Цвет фурнитуры
	 */
	clr_furn: {
		get: function () {
			return this._row.clr_furn;
		},
		set: function (v) {
			this._row.clr_furn = v;
			this.project.register_change();
		}
	},

	/**
	 * Направление открывания
	 */
	direction: {
		get: function () {
			return this._row.direction;
		},
		set: function (v) {
			this._row.direction = v;
			this.project.register_change(true);
		}
	},

	/**
	 * Высота ручки
	 */
	h_ruch: {
		get: function () {
			return this._row.h_ruch;
		},
		set: function (v) {
			this._row.h_ruch = v;
			this.project.register_change();
		}
	},

	/**
	 * Возвращает структуру профилей по сторонам
	 */
	profiles_by_side: {
		value: function (side) {
			// получаем таблицу расстояний профилей от рёбер габаритов
			var profiles = this.profiles,
				bounds = this.bounds,
				res = {}, ares = [];

			function by_side(name) {
				ares.sort(function (a, b) {
					return a[name] - b[name];
				});
				res[name] = ares[0].profile;
			}

			if(profiles.length){

				profiles.forEach(function (profile) {
					ares.push({
						profile: profile,
						left: Math.abs(profile.b.x + profile.e.x - bounds.left * 2),
						top: Math.abs(profile.b.y + profile.e.y - bounds.top * 2),
						bottom: Math.abs(profile.b.y + profile.e.y - bounds.bottom * 2),
						right: Math.abs(profile.b.x + profile.e.x - bounds.right * 2)
					});
				});

				if(side){
					by_side(side);
					return res[side];
				}

				["left","top","bottom","right"].forEach(by_side);
			}

			return res;

		}
	},

	/**
	 * Возвращает профиль по номеру стороны фурнитуры, учитывает направление открывания, по умолчанию - левое
	 * - первая первая сторона всегда нижняя
	 * - далее, по часовой стрелке 2 - левая, 3 - верхняя и т.д.
	 * - если направление правое, обход против часовой
	 * @param side {Number}
	 * @param cache {Object}
	 */
	profile_by_furn_side: {
		value: function (side, cache) {

			if(!cache)
				cache = {
					profiles: this.outer_nodes,
					bottom: this.profiles_by_side("bottom")
				};

			var profile = cache.bottom,
				profile_node = this.direction == $p.enm.open_directions.Правое ? "b" : "e",
				other_node = this.direction == $p.enm.open_directions.Правое ? "e" : "b",
				next = function () {

					side--;
					if(side <= 0)
						return profile;

					cache.profiles.some(function (curr) {
						if(curr[other_node].is_nearest(profile[profile_node])){
							profile = curr;
							return true;
						}
					});

					return next();

				};

			return next();


		}
	},

	/**
	 * Признак прямоугольности
	 */
	is_rectangular: {
		get : function(){
			return (this.side_count != 4) || !this.profiles.some(function (profile) {
				return !(profile.is_linear() && Math.abs(profile.angle_hor % 90) < 1);
			});
		}
	},

	/**
	 * Количество сторон контура
	 */
	side_count: {
		get : function(){
			return this.profiles.length;
		}
	},

	/**
	 * Ширина контура по фальцу
	 */
	w: {
		get : function(){
			if(!this.is_rectangular)
				return 0;

			var profiles = this.profiles_by_side();
			return this.bounds ? this.bounds.width - profiles.left.nom.sizefurn - profiles.right.nom.sizefurn : 0;
		}
	},

	/**
	 * Высота контура по фальцу
	 */
	h: {
		get : function(){
			if(!this.is_rectangular)
				return 0;

			var profiles = this.profiles_by_side();
			return this.bounds ? this.bounds.height - profiles.top.nom.sizefurn - profiles.bottom.nom.sizefurn : 0;
		}
	},

	/**
	 * Положение контура в изделии или створки в контуре
	 */
	pos: {
		get: function () {

		}
	},

	/**
	 * Тест положения контура в изделии
	 */
	is_pos: {
		value: function (pos) {

			// если в изделии один контур или если контур является створкой, он занимает одновременно все положения
			if(this.project.contours.count == 1 || this.parent)
				return true;

			// если контур реально верхний или правый и т.д. - возвращаем результат сразу
			var res = Math.abs(this.bounds[pos] - this.project.bounds[pos]) < consts.sticking_l;

			if(!res){
				if(pos == "top"){
					var rect = new paper.Rectangle(this.bounds.topLeft, this.bounds.topRight.add([0, -200]));
				}else if(pos == "left"){
					var rect = new paper.Rectangle(this.bounds.topLeft, this.bounds.bottomLeft.add([-200, 0]));
				}else if(pos == "right"){
					var rect = new paper.Rectangle(this.bounds.topRight, this.bounds.bottomRight.add([200, 0]));
				}else if(pos == "bottom"){
					var rect = new paper.Rectangle(this.bounds.bottomLeft, this.bounds.bottomRight.add([0, 200]));
				}

				res = !this.project.contours.some(function (l) {
					return l != this && rect.intersects(l.bounds);
				}.bind(this));
			}

			return res;

		}
	},

	/**
	 * Рисует направление открывания
	 */
	draw_opening: {
		value: function () {

			if(!this.parent || !$p.enm.open_types.is_opening(this.furn.open_type)){
				if(this.l_visualization._opening && this.l_visualization._opening.visible)
					this.l_visualization._opening.visible = false;
				return;
			}

			// рисует линии открывания на поворотной, поворотнооткидной и фрамужной фурнитуре
			function rotary_folding() {
				_contour.furn.open_tunes.forEach(function (row) {

					if(row.rotation_axis){
						var axis = _contour.profile_by_furn_side(row.side, cache),
							other = _contour.profile_by_furn_side(
								row.side + 2 <= this._owner.side_count ? row.side + 2 : row.side - 2, cache);

						_contour.l_visualization._opening.moveTo(axis.corns(3));
						_contour.l_visualization._opening.lineTo(other.rays.inner.getPointAt(other.rays.inner.length / 2));
						_contour.l_visualization._opening.lineTo(axis.corns(4));

					}
				});
			}

			// рисует линии открывания на раздвижке
			function sliding() {

			}


			// создаём кеш элементов по номеру фурнитуры
			var _contour = this,
				cache = {
					profiles: this.outer_nodes,
					bottom: this.profiles_by_side("bottom")
				};

			// подготавливаем слой для рисования
			if(!_contour.l_visualization._opening)
				_contour.l_visualization._opening = new paper.CompoundPath({
					parent: _contour.l_visualization,
					strokeColor: 'black'
				});
			else
				_contour.l_visualization._opening.removeChildren();

			// рисуем раправление открывания
			if(this.furn.is_sliding)
				sliding();

			else
				rotary_folding();

		}
	},

	/**
	 * Рисует дополнительную визуализацию. Данные берёт из спецификации
	 */
	draw_visualization: {
		value: function () {


			var profiles = this.profiles,
				l_vis = this.l_visualization;

			if(l_vis._by_spec)
				l_vis._by_spec.removeChildren();
			else
				l_vis._by_spec = new paper.Group({ parent: l_vis });

			// получаем строки спецификации с визуализацией
			this.project.ox.specification.find_rows({dop: -1}, function (row) {

				profiles.some(function (elm) {
					if(row.elm == elm.elm){

						// есть визуализация для текущего профиля
						row.nom.visualization.draw(elm, l_vis, row.len * 1000);

						return true;
					}
				});
			});

			// перерисовываем вложенные контуры
			this.children.forEach(function(l) {
				if(l instanceof Contour)
					l.draw_visualization();
			});

		}
	},

  /**
   * Массив с рёбрами периметра
   */
  perimeter: {
    get: function () {
      var res = [], tmp;
      this.outer_profiles.forEach(function (curr) {
        res.push(tmp = {
          len: curr.sub_path.length,
          angle: curr.e.subtract(curr.b).angle
        });
        if(tmp.angle < 0)
          tmp.angle += 360;
      });
      return res;
    }
  },

	/**
	 * формирует авторазмерные линии
	 */
	draw_sizes: {

		value: function () {

			// сначала, перерисовываем размерные линии вложенных контуров, чтобы получить отступы
			this.children.forEach(function (l) {
				if(l instanceof Contour)
					l.draw_sizes();
			});

			// для внешних контуров строим авторазмерные линии
			if(!this.parent){

				// сначала, строим размерные линии импостов

				// получаем импосты контура, делим их на вертикальные и горизонтальные
				var ihor = [], ivert = [], i;

				this.imposts.forEach(function (elm) {
					if(elm.orientation == $p.enm.orientations.hor)
						ihor.push(elm);
					else if(elm.orientation == $p.enm.orientations.vert)
						ivert.push(elm);
				});

				if(ihor.length || ivert.length){

					var by_side = this.profiles_by_side(),

						imposts_dimensions = function(arr, collection, i, pos, xy, sideb, sidee) {

							var offset = (pos == "right" || pos == "bottom") ? -130 : 90;

							if(i == 0 && !collection[i]){
								collection[i] = new DimensionLine({
									pos: pos,
									elm1: sideb,
									p1: sideb.b[xy] > sideb.e[xy] ? "b" : "e",
									elm2: arr[i],
									p2: arr[i].b[xy] > arr[i].e[xy] ? "b" : "e",
									parent: this.l_dimensions,
									offset: offset,
									impost: true
								});
							}

							if(i >= 0 && i < arr.length-1 && !collection[i+1]){

								collection[i+1] = new DimensionLine({
									pos: pos,
									elm1: arr[i],
									p1: arr[i].b[xy] > arr[i].e[xy] ? "b" : "e",
									elm2: arr[i+1],
									p2: arr[i+1].b[xy] > arr[i+1].e[xy] ? "b" : "e",
									parent: this.l_dimensions,
									offset: offset,
									impost: true
								});

							}

							if(i == arr.length-1 && !collection[arr.length]){

								collection[arr.length] = new DimensionLine({
									pos: pos,
									elm1: arr[i],
									p1: arr[i].b[xy] > arr[i].e[xy] ? "b" : "e",
									elm2: sidee,
									p2: sidee.b[xy] > sidee.e[xy] ? "b" : "e",
									parent: this.l_dimensions,
									offset: offset,
									impost: true
								});

							}

						}.bind(this),

						purge = function (arr, asizes, xy) {

							var adel = [];
							arr.forEach(function (elm) {

								if(asizes.indexOf(elm.b[xy].round(0)) != -1 && asizes.indexOf(elm.e[xy].round(0)) != -1)
									adel.push(elm);

								else if(asizes.indexOf(elm.b[xy].round(0)) == -1)
									asizes.push(elm.b[xy].round(0));

								else if(asizes.indexOf(elm.e[xy].round(0)) == -1)
									asizes.push(elm.e[xy].round(0));

							});

							adel.forEach(function (elm) {
								arr.splice(arr.indexOf(elm), 1);
							});
							adel.length = 0;

							return arr;
						};

					// сортируем ihor по убыванию y
					var asizes = [this.bounds.top.round(0), this.bounds.bottom.round(0)];
					purge(ihor, asizes, "y").sort(function (a, b) {
						return b.b.y + b.e.y - a.b.y - a.e.y;
					});
					// сортируем ivert по возрастанию x
					asizes = [this.bounds.left.round(0), this.bounds.right.round(0)];
					purge(ivert, asizes, "x").sort(function (a, b) {
						return a.b.x + a.e.x - b.b.x - b.e.x;
					});


					// для ihor добавляем по вертикали
					if(!this.l_dimensions.ihor)
						this.l_dimensions.ihor = {};
					for(i = 0; i< ihor.length; i++){

						if(this.is_pos("right"))
							imposts_dimensions(ihor, this.l_dimensions.ihor, i, "right", "x", by_side.bottom, by_side.top);

						else if(this.is_pos("left"))
							imposts_dimensions(ihor, this.l_dimensions.ihor, i, "left", "x", by_side.bottom, by_side.top);

					}

					// для ivert добавляем по горизонтали
					if(!this.l_dimensions.ivert)
						this.l_dimensions.ivert = {};
					for(i = 0; i< ivert.length; i++){

						if(this.is_pos("bottom"))
							imposts_dimensions(ivert, this.l_dimensions.ivert, i, "bottom", "y", by_side.left, by_side.right);

						else if(this.is_pos("top"))
							imposts_dimensions(ivert, this.l_dimensions.ivert, i, "top", "y", by_side.left, by_side.right);

					}
				}


				// далее - размерные линии контура
				if (this.project.contours.length > 1) {

					if(this.is_pos("left") && !this.is_pos("right") && this.project.bounds.height != this.bounds.height){
						if(!this.l_dimensions.left){
							this.l_dimensions.left = new DimensionLine({
								pos: "left",
								parent: this.l_dimensions,
								offset: ihor.length ? 220 : 90,
								contour: true
							});
						}else
							this.l_dimensions.left.offset = ihor.length ? 220 : 90;

					}else{
						if(this.l_dimensions.left){
							this.l_dimensions.left.remove();
							this.l_dimensions.left = null;
						}
					}

					if(this.is_pos("right") && this.project.bounds.height != this.bounds.height){
						if(!this.l_dimensions.right){
							this.l_dimensions.right = new DimensionLine({
								pos: "right",
								parent: this.l_dimensions,
								offset: ihor.length ? -260 : -130,
								contour: true
							});
						}else
							this.l_dimensions.right.offset = ihor.length ? -260 : -130;

					}else{
						if(this.l_dimensions.right){
							this.l_dimensions.right.remove();
							this.l_dimensions.right = null;
						}
					}

					if(this.is_pos("top") && !this.is_pos("bottom") && this.project.bounds.width != this.bounds.width){
						if(!this.l_dimensions.top){
							this.l_dimensions.top = new DimensionLine({
								pos: "top",
								parent: this.l_dimensions,
								offset: ivert.length ? 220 : 90,
								contour: true
							});
						}else
							this.l_dimensions.top.offset = ivert.length ? 220 : 90;
					}else{
						if(this.l_dimensions.top){
							this.l_dimensions.top.remove();
							this.l_dimensions.top = null;
						}
					}

					if(this.is_pos("bottom") && this.project.bounds.width != this.bounds.width){
						if(!this.l_dimensions.bottom){
							this.l_dimensions.bottom = new DimensionLine({
								pos: "bottom",
								parent: this.l_dimensions,
								offset: ivert.length ? -260 : -130,
								contour: true
							});
						}else
							this.l_dimensions.bottom.offset = ivert.length ? -260 : -130;

					}else{
						if(this.l_dimensions.bottom){
							this.l_dimensions.bottom.remove();
							this.l_dimensions.bottom = null;
						}
					}

				}
			}

			// перерисовываем размерные линии текущего контура
			this.l_dimensions.children.forEach(function (dl) {
				if(dl.redraw)
					dl.redraw();
			});

		}
	},

	/**
	 * ### Стирает размерные линии
	 *
	 * @method clear_dimentions
	 * @for Contour
	 */
	clear_dimentions: {

		value: function () {
			for(var key in this.l_dimensions.ihor){
				this.l_dimensions.ihor[key].removeChildren();
				this.l_dimensions.ihor[key].remove();
				delete this.l_dimensions.ihor[key];
			}
			for(var key in this.l_dimensions.ivert){
				this.l_dimensions.ivert[key].removeChildren();
				this.l_dimensions.ivert[key].remove();
				delete this.l_dimensions.ivert[key];
			}
			if(this.l_dimensions.bottom){
				this.l_dimensions.bottom.removeChildren();
				this.l_dimensions.bottom.remove();
				this.l_dimensions.bottom = null;
			}
			if(this.l_dimensions.top){
				this.l_dimensions.top.removeChildren();
				this.l_dimensions.top.remove();
				this.l_dimensions.top = null;
			}
			if(this.l_dimensions.right){
				this.l_dimensions.right.removeChildren();
				this.l_dimensions.right.remove();
				this.l_dimensions.right = null;
			}
			if(this.l_dimensions.left){
				this.l_dimensions.left.removeChildren();
				this.l_dimensions.left.remove();
				this.l_dimensions.left = null;
			}
		}
	},

	/**
	 * ### Непрозрачность без учета вложенных контуров
	 * В отличии от прототипа `opacity`, затрагивает только элементы текущего слоя
	 */
	opacity: {
		get: function () {
			return this.children.length ? this.children[0].opacity : 1;
		},

		set: function (v) {
			this.children.forEach(function(elm){
				if(elm instanceof BuilderElement)
					elm.opacity = v;
			});
		}
	},

	/**
	 * Обработчик события при удалении элемента
	 */
	on_remove_elm: {

		value: function (elm) {

			// при удалении любого профиля, удаляем размрные линии импостов
			if(this.parent)
				this.parent.on_remove_elm(elm);

			if (elm instanceof Profile && !this.project.data._loading)
				this.clear_dimentions();

		}
	},

	/**
	 * Обработчик события при вставке элемента
	 */
	on_insert_elm: {

		value: function (elm) {

			// при вставке любого профиля, удаляем размрные линии импостов
			if(this.parent)
				this.parent.on_remove_elm(elm);

			if (elm instanceof Profile && !this.project.data._loading)
				this.clear_dimentions();

		}
	},

	/**
	 * Обработчик при изменении системы
	 */
	on_sys_changed: {
		value: function () {

			this.profiles.forEach(function (profile) {
				profile.inset = profile.project.default_inset({
					elm_type: profile.elm_type,
					pos: profile.pos,
					inset: profile.inset
				});
			});

			this.glasses().forEach(function(elm) {
				if (elm instanceof Contour)
					elm.on_sys_changed();
				else{
					// заполнения проверяем по толщине
					if(elm.thickness < elm.project._dp.sys.tmin || elm.thickness > elm.project._dp.sys.tmax)
						elm._row.inset = elm.project.default_inset({elm_type: [$p.enm.elm_types.Стекло, $p.enm.elm_types.Заполнение]});
					// проверяем-изменяем соединения заполнений с профилями
					elm.profiles.forEach(function (curr) {
						if(!curr.cnn || !curr.cnn.check_nom2(curr.profile))
							curr.cnn = $p.cat.cnns.elm_cnn(elm, curr.profile, $p.enm.cnn_types.acn.ii);
					});
				}
			});
		}
	}
});

/**
 * Экспортируем конструктор Contour, чтобы фильтровать инстанции этого типа
 * @property Contour
 * @for MetaEngine
 * @type {function}
 */
Editor.Contour = Contour;


/**
 * Сегмент заполнения содержит информацию примыкающем профиле и координатах начала и конца
 * @class GlassSegment
 * @constructor
 */
function GlassSegment(profile, b, e, outer) {

	this.profile = profile;
	this.b = b.clone();
	this.e = e.clone();
	this.outer = !!outer;

	this.segment();

}
GlassSegment.prototype.__define({

	segment: {
		value: function () {

			var gen;

			if(this.profile.children.some(function (addl) {

					if(addl instanceof ProfileAddl && this.outer == addl.outer){

						if(!gen)
							gen = this.profile.generatrix;

						var b = this.profile instanceof ProfileAddl ? this.profile.b : this.b,
							e = this.profile instanceof ProfileAddl ? this.profile.e : this.e;

						// TODO: учесть импосты, привязанные к добору

						if(b.is_nearest(gen.getNearestPoint(addl.b), true) && e.is_nearest(gen.getNearestPoint(addl.e), true)){
							this.profile = addl;
							this.outer = false;
							return true;
						}
					}
				}.bind(this))){

				this.segment();
			}
		}
	}

});

/**
 * ### Размерные линии на эскизе
 * 
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2016<br />
 * Created 21.08.2015
 *
 * @module geometry
 * @submodule dimension_line
 */

/**
 * ### Размерная линия на эскизе
 * Унаследована от [paper.Group](http://paperjs.org/reference/group/)<br />
 * См. так же, {{#crossLink "DimensionLineCustom"}}{{/crossLink}} - размерная линия, устанавливаемая пользователем
 *
 * @class DimensionLine
 * @extends paper.Group
 * @param attr {Object} - объект с указанием на строку координат и родительского слоя
 * @constructor
 * @menuorder 46
 * @tooltip Размерная линия
 */
function DimensionLine(attr){


	DimensionLine.superclass.constructor.call(this, {parent: attr.parent});

	var _row = attr.row;

	if(_row && _row.path_data){
		attr._mixin(JSON.parse(_row.path_data));
		if(attr.elm1)
			attr.elm1 = this.project.getItem({elm: attr.elm1});
		if(attr.elm2)
			attr.elm2 = this.project.getItem({elm: attr.elm2});
	}

	this.data.pos = attr.pos;
	this.data.elm1 = attr.elm1;
	this.data.elm2 = attr.elm2 || this.data.elm1;
	this.data.p1 = attr.p1 || "b";
	this.data.p2 = attr.p2 || "e";
	this.data.offset = attr.offset;
	
	if(attr.impost)
		this.data.impost = true;
	
	if(attr.contour)
		this.data.contour = true;

	this.__define({
		
		_row: {
			get: function () {
				return _row;
			}
		},

		/**
		 * Удаляет элемент из контура и иерархии проекта
		 * Одновлеменно, удаляет строку из табчасти табчасти _Координаты_
		 * @method remove
		 */
		remove: {
			value: function () {
				if(_row){
					_row._owner.del(_row);
					_row = null;
					this.project.register_change();
				}
				DimensionLine.superclass.remove.call(this);
			}
		}
	});

	if(!this.data.pos && (!this.data.elm1 || !this.data.elm2)){
		this.remove();
		return null;
	}

	// создаём детей
	new paper.Path({parent: this, name: 'callout1', strokeColor: 'black', guide: true});
	new paper.Path({parent: this, name: 'callout2', strokeColor: 'black', guide: true});
	new paper.Path({parent: this, name: 'scale', strokeColor: 'black', guide: true});
	new paper.PointText({
		parent: this,
		name: 'text',
		justification: 'center',
		fillColor: 'black',
		fontSize: 72});
	

	this.on({
		mouseenter: this._mouseenter,
		mouseleave: this._mouseleave,
		click: this._click
	});

	$p.eve.attachEvent("sizes_wnd", this._sizes_wnd.bind(this));

}
DimensionLine._extend(paper.Group);

DimensionLine.prototype.__define({

	// виртуальные метаданные для автоформ
	_metadata: {
		get: function () {
			return $p.dp.builder_text.metadata();
		}
	},

	// виртуальный датаменеджер для автоформ
	_manager: {
		get: function () {
			return $p.dp.builder_text;
		}
	},

	_mouseenter: {
		value: function (event) {
			paper.canvas_cursor('cursor-arrow-ruler');
		}
	},

	_mouseleave: {
		value: function (event) {
			//paper.canvas_cursor('cursor-arrow-white');
		}
	},

	_click: {
		value: function (event) {
			event.stop();
			this.wnd = new RulerWnd(null, this);
			this.wnd.size = this.size;
		}
	},

	_move_points: {
		value: function (event, xy) {

			var _bounds, delta, size;

			// получаем дельту - на сколько смещать
			if(this.data.elm1){

				// в _bounds[event.name] надо поместить координату по x или у (в зависисмости от xy), которую будем двигать
				_bounds = {};


				if(this.pos == "top" || this.pos == "bottom"){

					size = Math.abs(this.data.elm1[this.data.p1].x - this.data.elm2[this.data.p2].x);

					if(event.name == "right"){
						delta = new paper.Point(event.size - size, 0);
						_bounds[event.name] = Math.max(this.data.elm1[this.data.p1].x, this.data.elm2[this.data.p2].x);

					}else{
						delta = new paper.Point(size - event.size, 0);
						_bounds[event.name] = Math.min(this.data.elm1[this.data.p1].x, this.data.elm2[this.data.p2].x);
					}


				}else{

					size = Math.abs(this.data.elm1[this.data.p1].y - this.data.elm2[this.data.p2].y);

					if(event.name == "bottom"){
						delta = new paper.Point(0, event.size - size);
						_bounds[event.name] = Math.max(this.data.elm1[this.data.p1].y, this.data.elm2[this.data.p2].y);

					}
					else{
						delta = new paper.Point(0, size - event.size);
						_bounds[event.name] = Math.min(this.data.elm1[this.data.p1].y, this.data.elm2[this.data.p2].y);
					}
				}

			}else {

				_bounds = this.layer.bounds;

				if(this.pos == "top" || this.pos == "bottom")
					if(event.name == "right")
						delta = new paper.Point(event.size - _bounds.width, 0);
					else
						delta = new paper.Point(_bounds.width - event.size, 0);
				else{
					if(event.name == "bottom")
						delta = new paper.Point(0, event.size - _bounds.height);
					else
						delta = new paper.Point(0, _bounds.height - event.size);
				}

			}
			
			if(delta.length){

				paper.project.deselect_all_points();

				paper.project.getItems({class: Profile}).forEach(function (p) {
					if(Math.abs(p.b[xy] - _bounds[event.name]) < consts.sticking0 && Math.abs(p.e[xy] - _bounds[event.name]) < consts.sticking0){
						p.generatrix.segments.forEach(function (segm) {
							segm.selected = true;
						})

					}else if(Math.abs(p.b[xy] - _bounds[event.name]) < consts.sticking0){
						p.generatrix.firstSegment.selected = true;

					}else if(Math.abs(p.e[xy] - _bounds[event.name]) < consts.sticking0){
						p.generatrix.lastSegment.selected = true;

					}

				});
				this.project.move_points(delta);
				setTimeout(function () {
					this.deselect_all_points(true);
					this.register_update();
					//this.zoom_fit();
				}.bind(this.project), 200);
			}
		}
	},

	_sizes_wnd: {
		value: function (event) {
			if(event.wnd == this.wnd){

				switch(event.name) {
					case 'close':
						if(this.children.text)
							this.children.text.selected = false;
						this.wnd = null;
						break;

					case 'left':
					case 'right':
						if(this.pos == "top" || this.pos == "bottom")
							this._move_points(event, "x");
						break;

					case 'top':
					case 'bottom':
						if(this.pos == "left" || this.pos == "right")
							this._move_points(event, "y");
						break;
				}
			}
		}
	},

	redraw: {
		value: function () {

			var _bounds = this.layer.bounds,
				_dim_bounds = this.layer instanceof DimensionLayer ? this.project.dimension_bounds : this.layer.dimension_bounds,
				offset = 0,
				b, e, tmp, normal, length, bs, es;

			if(!this.pos){

				if(typeof this.data.p1 == "number")
					b = this.data.elm1.corns(this.data.p1);
				else
					b = this.data.elm1[this.data.p1];

				if(typeof this.data.p2 == "number")
					e = this.data.elm2.corns(this.data.p2);
				else
					e = this.data.elm2[this.data.p2];

			}else if(this.pos == "top"){
				b = _bounds.topLeft;
				e = _bounds.topRight;
				offset = _bounds[this.pos] - _dim_bounds[this.pos];

			}else if(this.pos == "left"){
				b = _bounds.bottomLeft;
				e = _bounds.topLeft;
				offset = _bounds[this.pos] - _dim_bounds[this.pos];

			}else if(this.pos == "bottom"){
				b = _bounds.bottomLeft;
				e = _bounds.bottomRight;
				offset = _bounds[this.pos] - _dim_bounds[this.pos];

			}else if(this.pos == "right"){
				b = _bounds.bottomRight;
				e = _bounds.topRight;
				offset = _bounds[this.pos] - _dim_bounds[this.pos];
			}

			// если точки профиля еще не нарисованы - выходим
			if(!b || !e){
				this.visible = false;
				return;
			}

			tmp = new paper.Path({ insert: false, segments: [b, e] });

			if(this.data.elm1 && this.pos){

				b = tmp.getNearestPoint(this.data.elm1[this.data.p1]);
				e = tmp.getNearestPoint(this.data.elm2[this.data.p2]);
				if(tmp.getOffsetOf(b) > tmp.getOffsetOf(e)){
					normal = e;
					e = b;
					b = normal;
				}
				tmp.firstSegment.point = b;
				tmp.lastSegment.point = e;

			};

			// прячем крошечные размеры
			length = tmp.length;
			if(length < consts.sticking_l){
				this.visible = false;
				return;
			}

			this.visible = true;

			normal = tmp.getNormalAt(0).multiply(this.offset + offset);

			bs = b.add(normal.multiply(0.8));
			es = e.add(normal.multiply(0.8));

			if(this.children.callout1.segments.length){
				this.children.callout1.firstSegment.point = b;
				this.children.callout1.lastSegment.point = b.add(normal);
			}else
				this.children.callout1.addSegments([b, b.add(normal)]);

			if(this.children.callout2.segments.length){
				this.children.callout2.firstSegment.point = e;
				this.children.callout2.lastSegment.point = e.add(normal);
			}else
				this.children.callout2.addSegments([e, e.add(normal)]);

			if(this.children.scale.segments.length){
				this.children.scale.firstSegment.point = bs;
				this.children.scale.lastSegment.point = es;
			}else
				this.children.scale.addSegments([bs, es]);


			this.children.text.content = length.toFixed(0);
			this.children.text.rotation = e.subtract(b).angle;
			this.children.text.point = bs.add(es).divide(2);


		},
		enumerable : false
	},

	// размер
	size: {
		get: function () {
			return parseFloat(this.children.text.content);
		},
		set: function (v) {
			this.children.text.content = parseFloat(v).round(1);
		}
	},

	// угол к горизонту в направлении размера
	angle: {
		get: function () {
			return 0;
		},
		set: function (v) {

		}
	},

	// расположение относительно контура $p.enm.pos
	pos: {
		get: function () {
			return this.data.pos || "";
		},
		set: function (v) {
			this.data.pos = v;
			this.redraw();
		}
	},

	// отступ от внешней границы изделия
	offset: {
		get: function () {
			return this.data.offset || 90;
		},
		set: function (v) {
			var offset = (parseInt(v) || 90).round(0);
			if(this.data.offset != offset){
				this.data.offset = offset;
				this.project.register_change(true);	
			}
		}
	}

});

/**
 * ### Служебный слой размерных линий
 * Унаследован от [paper.Layer](http://paperjs.org/reference/layer/)
 * 
 * @class DimensionLayer
 * @extends paper.Layer
 * @param attr
 * @constructor
 */
function DimensionLayer(attr) {
	
	DimensionLayer.superclass.constructor.call(this);
	
	if(!attr || !attr.parent){
		this.__define({
			bounds: {
				get: function () {
					return this.project.bounds;
				}
			}
		});
	}
}
DimensionLayer._extend(paper.Layer);


/**
 * ### Размерные линии, определяемые пользователем
 * @class DimensionLineCustom
 * @extends DimensionLine
 * @param attr
 * @constructor
 */
function DimensionLineCustom(attr) {

	if(!attr.row)
		attr.row = attr.parent.project.ox.coordinates.add();

	// слой, которому принадлежит размерная линия
	if(!attr.row.cnstr)
		attr.row.cnstr = attr.parent.layer.cnstr;

	// номер элемента
	if(!attr.row.elm)
		attr.row.elm = attr.parent.project.ox.coordinates.aggregate([], ["elm"], "max") + 1;

	DimensionLineCustom.superclass.constructor.call(this, attr);

	this.on({
		mouseenter: this._mouseenter,
		mouseleave: this._mouseleave,
		click: this._click
	});

}
DimensionLineCustom._extend(DimensionLine);

DimensionLineCustom.prototype.__define({

	/**
	 * Вычисляемые поля в таблице координат
	 * @method save_coordinates
	 * @for DimensionLineCustom
	 */
	save_coordinates: {
		value: function () {

			var _row = this._row;

			// сохраняем размер
			_row.len = this.size;

			// устанавливаем тип элемента
			_row.elm_type = this.elm_type;

			// сериализованные данные
			_row.path_data = JSON.stringify({
				pos: this.pos,
				elm1: this.data.elm1.elm,
				elm2: this.data.elm2.elm,
				p1: this.data.p1,
				p2: this.data.p2,
				offset: this.offset
			});

		}
	},

	/**
	 * Возвращает тип элемента (размерная линия)
	 */
	elm_type: {
		get : function(){

			return $p.enm.elm_types.Размер;

		}
	},


	_click: {
		value: function (event) {
			event.stop();
			this.selected = true;
		}
	}
});
/**
 * ### Базовый класс элементов построителя
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2016<br />
 * Created 24.07.2015
 *
 * @module geometry
 * @submodule element
 */


/**
 * ### Базовый класс элементов построителя
 * Унаследован от [paper.Group](http://paperjs.org/reference/group/). Cвойства и методы `BuilderElement` присущи всем элементам построителя,
 * но не характерны для классов [Path](http://paperjs.org/reference/path/) и [Group](http://paperjs.org/reference/group/) фреймворка [paper.js](http://paperjs.org/about/),
 * т.к. описывают не линию и не коллекцию графических примитивов, а элемент конструкции с определенной физикой и поведением
 *
 * @class BuilderElement
 * @param attr {Object} - объект со свойствами создаваемого элемента
 *  @param attr.b {paper.Point} - координата узла начала элемента - не путать с координатами вершин пути элемента
 *  @param attr.e {paper.Point} - координата узла конца элемента - не путать с координатами вершин пути элемента
 *  @param attr.contour {Contour} - контур, которому принадлежит элемент
 *  @param attr.type_el {_enm.elm_types}  может измениться при конструировании. например, импост -> рама
 *  @param [attr.inset] {_cat.inserts} -  вставка элемента. если не указано, будет вычислена по типу элемента
 *  @param [attr.path] (r && arc_ccw && more_180)
 * @constructor
 * @extends paper.Group
 * @menuorder 40
 * @tooltip Элемент изделия
 */
function BuilderElement(attr){

	BuilderElement.superclass.constructor.call(this);

	if(!attr.row)
		attr.row = this.project.ox.coordinates.add();

	this.__define({
		_row: {
			get: function () {
				return attr.row;
			}
		}
	});

	if(attr.proto){

		if(attr.proto.inset)
			this.inset = attr.proto.inset;

		if(attr.parent)
			this.parent = attr.parent;
			
		else if(attr.proto.parent)
			this.parent = attr.proto.parent;

		if(attr.proto instanceof Profile)
			this.insertBelow(attr.proto);

		this.clr = attr.proto.clr;

	}else if(attr.parent)
		this.parent = attr.parent;

	if(!attr.row.cnstr)
		attr.row.cnstr = this.layer.cnstr;

	if(!attr.row.elm)
		attr.row.elm = this.project.ox.coordinates.aggregate([], ["elm"], "max") + 1;

	if(attr.row.elm_type.empty() && !this.inset.empty())
		attr.row.elm_type = this.inset.nom().elm_type;

	this.project.register_change();

	/**
	 * ### Удаляет элемент из контура и иерархии проекта
	 * Одновлеменно, удаляет строку из табчасти табчасти _Координаты_ и отключает наблюдателя
	 * @method remove
	 */
	this.remove = function () {

		this.detache_wnd();

		if(this.parent){

			if (this.parent.on_remove_elm)
				this.parent.on_remove_elm(this);

			if (this.parent._noti && this._observer){
				Object.unobserve(this.parent._noti, this._observer);
				delete this._observer;
			}
		}

		if(this.project.ox === attr.row._owner._owner)
			attr.row._owner.del(attr.row);
		delete attr.row;

		BuilderElement.superclass.remove.call(this);
		this.project.register_change();
	};

}

// BuilderElement наследует свойства класса Group
BuilderElement._extend(paper.Group);

// Привязываем свойства номенклатуры, вставки и цвета
BuilderElement.prototype.__define({

	/**
	 * ### Элемент - владелец
	 * имеет смысл для раскладок и рёбер заполнения
	 * @property owner
	 * @type BuilderElement
	 */
	owner: {
		get : function(){ return this.data.owner; },
		set : function(newValue){ this.data.owner = newValue; }
	},

	/**
	 * ### Образующая
	 * прочитать - установить путь образующей. здесь может быть линия, простая дуга или безье
	 * по ней будут пересчитаны pathData и прочие свойства
	 * @property generatrix
	 * @type paper.Path
	 */
	generatrix: {
		get : function(){ return this.data.generatrix; },
		set : function(attr){

			this.data.generatrix.removeSegments();

			if(this.hasOwnProperty('rays'))
				this.rays.clear();

			if(Array.isArray(attr))
				this.data.generatrix.addSegments(attr);

			else if(attr.proto &&  attr.p1 &&  attr.p2){

				// сначала, выясняем направление пути
				var tpath = attr.proto;
				if(tpath.getDirectedAngle(attr.ipoint) < 0)
					tpath.reverse();

				// далее, уточняем порядок p1, p2
				var d1 = tpath.getOffsetOf(attr.p1),
					d2 = tpath.getOffsetOf(attr.p2), d3;
				if(d1 > d2){
					d3 = d2;
					d2 = d1;
					d1 = d3;
				}
				if(d1 > 0){
					tpath = tpath.split(d1);
					d2 = tpath.getOffsetOf(attr.p2);
				}
				if(d2 < tpath.length)
					tpath.split(d2);

				this.data.generatrix.remove();
				this.data.generatrix = tpath;
				this.data.generatrix.parent = this;

				if(this.parent.parent)
					this.data.generatrix.guide = true;
			}
		},
		enumerable : true
	},

	/**
	 * путь элемента - состоит из кривых, соединяющих вершины элемента
	 * для профиля, вершин всегда 4, для заполнений может быть <> 4
	 * @property path
	 * @type paper.Path
	 */
	path: {
		get : function(){ return this.data.path; },
		set : function(attr){
			if(attr instanceof paper.Path){
				this.data.path.removeSegments();
				this.data.path.addSegments(attr.segments);
				if(!this.data.path.closed)
					this.data.path.closePath(true);
			}
		},
		enumerable : true
	},

	// виртуальные метаданные для автоформ
	_metadata: {
		get : function(){
			var t = this,
				_meta = t.project.ox._metadata,
				_xfields = _meta.tabular_sections.coordinates.fields, //_dgfields = t.project._dp._metadata.fields
				inset = _xfields.inset._clone(),
				cnn1 = _meta.tabular_sections.cnn_elmnts.fields.cnn._clone(),
				cnn2 = cnn1._clone(),
				cnn3 = cnn1._clone(),
				info = _meta.fields.note._clone();

			function cnn_choice_links(o, cnn_point){
				var nom_cnns = $p.cat.cnns.nom_cnn(t, cnn_point.profile, cnn_point.cnn_types);

				if($p.utils.is_data_obj(o)){
					return nom_cnns.some(function (cnn) {
						return o == cnn;
					});

				}else{
					var refs = "";
					nom_cnns.forEach(function (cnn) {
						if(refs)
							refs += ", ";
						refs += "'" + cnn.ref + "'";
					});
					return "_t_.ref in (" + refs + ")";
				}
			}

			info.synonym = "Элемент";

			// динамические отборы для вставок и соединений

			inset.choice_links = [{
				name: ["selection",	"ref"],
				path: [
					function(o, f){
						var selection;

						if(t instanceof Filling){

							if($p.utils.is_data_obj(o)){
								return $p.cat.inserts._inserts_types_filling.indexOf(o.insert_type) != -1 &&
										o.thickness >= t.project._dp.sys.tmin && o.thickness <= t.project._dp.sys.tmax;

							}else{
								var refs = "";
								$p.cat.inserts.by_thickness(t.project._dp.sys.tmin, t.project._dp.sys.tmax).forEach(function (row) {
									if(refs)
										refs += ", ";
									refs += "'" + row.ref + "'";
								});
								return "_t_.ref in (" + refs + ")";
							}

						}else if(t instanceof Profile){
							if(t.nearest())
								selection = {elm_type: {in: [$p.enm.elm_types.Створка, $p.enm.elm_types.Добор]}};
							else
								selection = {elm_type: {in: [$p.enm.elm_types.Рама, $p.enm.elm_types.Импост, $p.enm.elm_types.Добор]}};
						}else
							selection = {elm_type: t.nom.elm_type};


						if($p.utils.is_data_obj(o)){
							var ok = false;
							selection.nom = o;
							t.project._dp.sys.elmnts.find_rows(selection, function (row) {
								ok = true;
								return false;
							});
							return ok;
						}else{
							var refs = "";
							t.project._dp.sys.elmnts.find_rows(selection, function (row) {
								if(refs)
									refs += ", ";
								refs += "'" + row.nom.ref + "'";
							});
							return "_t_.ref in (" + refs + ")";
						}
				}]}
			];

			cnn1.choice_links = [{
				name: ["selection",	"ref"],
				path: [
					function(o, f){
						return cnn_choice_links(o, t.rays.b);
					}]}
			];

			cnn2.choice_links = [{
				name: ["selection",	"ref"],
				path: [
					function(o, f){
						return cnn_choice_links(o, t.rays.e);
					}]}
			];

			cnn3.choice_links = [{
				name: ["selection",	"ref"],
				path: [
					function(o){

						var cnn_ii = t.selected_cnn_ii(), nom_cnns;

						if(cnn_ii.elm instanceof Filling)
							nom_cnns = $p.cat.cnns.nom_cnn(cnn_ii.elm, t, $p.enm.cnn_types.acn.ii);
						else
							nom_cnns = $p.cat.cnns.nom_cnn(t, cnn_ii.elm, $p.enm.cnn_types.acn.ii);

						if($p.utils.is_data_obj(o)){
							return nom_cnns.some(function (cnn) {
								return o == cnn;
							});

						}else{
							var refs = "";
							nom_cnns.forEach(function (cnn) {
								if(refs)
									refs += ", ";
								refs += "'" + cnn.ref + "'";
							});
							return "_t_.ref in (" + refs + ")";
						}
					}]}
			];

			// дополняем свойства поля цвет отбором по служебным цветам
			$p.cat.clrs.selection_exclude_service(_xfields.clr, t);


			return {
				fields: {
					info: info,
					inset: inset,
					clr: _xfields.clr,
					x1: _xfields.x1,
					x2: _xfields.x2,
					y1: _xfields.y1,
					y2: _xfields.y2,
					cnn1: cnn1,
					cnn2: cnn2,
					cnn3: cnn3
				}
			};
		}
	},

	// виртуальный датаменеджер для автоформ
	_manager: {
		get: function () {
			return this.project._dp._manager;
		}
	},

	// номенклатура - свойство только для чтения, т.к. вычисляется во вставке
	nom:{
		get : function(){
			return this.inset.nom(this);
		}
	},

	// номер элемента - свойство только для чтения
	elm: {
		get : function(){
			return this._row.elm;
		}
	},

	// информация для редактора свойста
	info: {
		get : function(){
			return "№" + this.elm;
		},
		enumerable : true
	},

	// вставка
	inset: {
		get : function(){
			return (this._row ? this._row.inset : null) || $p.cat.inserts.get();
		},
		set : function(v){
			
			if(this._row.inset != v){
				
				this._row.inset = v;

				if(this.data && this.data._rays)
					this.data._rays.clear(true);
				
				this.project.register_change();	
			}
		}
	},

	// цвет элемента
	clr: {
		get : function(){
			return this._row.clr;
		},
		set : function(v){
			
			this._row.clr = v;

			// цвет элементу присваиваем только если он уже нарисован
			if(this.path instanceof paper.Path)
				this.path.fillColor = BuilderElement.clr_by_clr.call(this, this._row.clr, false);
			
			this.project.register_change();

		}
	},

	// ширина
	width: {
		get : function(){
			return this.nom.width || 80;
		}
	},

	// толщина (для заполнений и, возможно, профилей в 3D)
	thickness: {
		get : function(){
			return this.inset.thickness;
		}
	},

	// опорный размер (0 для рам и створок, 1/2 ширины для импостов)
	sizeb: {
		get : function(){
			return this.inset.sizeb || 0;
		}
	},

	// размер до фурнитурного паза
	sizefurn: {
		get : function(){
			return this.nom.sizefurn || 20;
		}
	},

	/**
	 * Примыкающее соединение для диалога свойств
	 */
	cnn3: {
		get : function(){
			var cnn_ii = this.selected_cnn_ii();
			return cnn_ii ? cnn_ii.row.cnn : $p.cat.cnns.get();
		},
		set: function(v){
			var cnn_ii = this.selected_cnn_ii();
			if(cnn_ii)
				cnn_ii.row.cnn = v;
			this.project.register_change();
		}
	},

	/**
	 * Подключает окно редактор свойств текущего элемента, выбранного инструментом
	 */
	attache_wnd: {
		value: function(cell){

			if(!this.data._grid || !this.data._grid.cell){

				this.data._grid = cell.attachHeadFields({
					obj: this,
					oxml: this.oxml
				});
				this.data._grid.attachEvent("onRowSelect", function(id){
					if(["x1","y1","cnn1"].indexOf(id) != -1)
						this._obj.select_node("b");

					else if(["x2","y2","cnn2"].indexOf(id) != -1)
						this._obj.select_node("e");
				});

			}else{
				if(this.data._grid._obj != this)
					this.data._grid.attach({
						obj: this,
						oxml: this.oxml
					});
			}

			cell.layout.base.style.height = (Math.max(this.data._grid.rowsBuffer.length, 9) + 1) * 22 + "px";
			cell.layout.setSizes();
			this.data._grid.objBox.style.width = "100%";
		}
	},

	/**
	 * Отключает и выгружает из памяти окно свойств элемента
	 */
	detache_wnd: {
		value: function(){
			if(this.data._grid && this.data._grid.destructor){
				this.data._grid._owner_cell.detachObject(true);
				delete this.data._grid;
			}
		}
	},
	
	selected_cnn_ii: {
		value: function(){
			var t = this,
				sel = t.project.getSelectedItems(),
				cnns = this.project.connections.cnns,
				items = [], res;

			sel.forEach(function (item) {
				if(item.parent instanceof ProfileItem || item.parent instanceof Filling)
					items.push(item.parent);
				else if(item instanceof Filling)
					items.push(item);
			});

			if(items.length > 1 &&
				items.some(function (item) { return item == t; }) &&
				items.some(function (item) {
					if(item != t){
						cnns.forEach(function (row) {
							if(!row.node1 && !row.node2 &&
								((row.elm1 == t.elm && row.elm2 == item.elm) || (row.elm1 == item.elm && row.elm2 == t.elm))){
								res = {elm: item, row: row};
								return false;
							}
						});
						if(res)
							return true;
					}
				}))
				return res;
		}
	}

});

BuilderElement.clr_by_clr = function (clr, view_out) {

	var clr_str = clr.clr_str;

	if(!view_out){
		if(!clr.clr_in.empty() && clr.clr_in.clr_str)
			clr_str = clr.clr_in.clr_str;
	}else{
		if(!clr.clr_out.empty() && clr.clr_out.clr_str)
			clr_str = clr.clr_out.clr_str;
	}

	if(!clr_str)
		clr_str = this.default_clr_str ? this.default_clr_str : "fff";

	
	if(clr_str){
		clr = clr_str.split(",");
		if(clr.length == 1){
			if(clr_str[0] != "#")
				clr_str = "#" + clr_str;
			clr = new paper.Color(clr_str);
			clr.alpha = 0.96;

		}else if(clr.length == 4){
			clr = new paper.Color(clr[0], clr[1], clr[2], clr[3]);

		}else if(clr.length == 3){
			if(this.path && this.path.bounds)
				clr = new paper.Color({
					stops: [clr[0], clr[1], clr[2]],
					origin: this.path.bounds.bottomLeft,
					destination: this.path.bounds.topRight
				});
			else
				clr = new paper.Color(clr[0]);
		}
		return clr;
	}
};

Editor.BuilderElement = BuilderElement;


/**
 * Created 24.07.2015<br />
 * &copy; http://www.oknosoft.ru 2014-2015
 * @author	Evgeniy Malyarov
 *
 * @module geometry
 * @submodule filling
 */


/**
 * ### Заполнение
 * - Инкапсулирует поведение элемента заполнения
 * - У заполнения есть коллекция рёбер, образующая путь контура
 * - Путь всегда замкнутый, образует простой многоугольник без внутренних пересечений, рёбра могут быть гнутыми
 *
 * @class Filling
 * @param attr {Object} - объект со свойствами создаваемого элемента
 * @constructor
 * @extends BuilderElement
 * @menuorder 45
 * @tooltip Заполнение
 */
function Filling(attr){

	Filling.superclass.constructor.call(this, attr);

	/**
	 * За этим полем будут "следить" элементы раскладок и пересчитывать - перерисовывать себя при изменениях соседей
	 */
	this._noti = {};

	/**
	 * Формирует оповещение для тех, кто следит за this._noti
	 * @param obj
	 */
	this.notify = function (obj) {
		Object.getNotifier(this._noti).notify(obj);
		this.project.register_change();
	}.bind(this);
	

	// initialize
	this.initialize(attr);
	

}
Filling._extend(BuilderElement);

Filling.prototype.__define({

	initialize: {
		value: function (attr) {

			var _row = attr.row,
				h = this.project.bounds.height + this.project.bounds.y;

			if(_row.path_data)
				this.data.path = new paper.Path(_row.path_data);

			else if(attr.path){

				this.data.path = new paper.Path();
				this.path = attr.path;

			}else
				this.data.path = new paper.Path([
					[_row.x1, h - _row.y1],
					[_row.x1, h - _row.y2],
					[_row.x2, h - _row.y2],
					[_row.x2, h - _row.y1]
				]);
			this.data.path.closePath(true);
			//this.data.path.guide = true;
			this.data.path.reduce();
			this.data.path.strokeWidth = 0;

			// для нового устанавливаем вставку по умолчанию
			if(_row.inset.empty())
				_row.inset = this.project.default_inset({elm_type: [$p.enm.elm_types.Стекло, $p.enm.elm_types.Заполнение]});

			// для нового устанавливаем цвет по умолчанию
			if(_row.clr.empty())
				this.project._dp.sys.elmnts.find_rows({nom: _row.inset}, function (row) {
					_row.clr = row.clr;
					return false;
				});
			if(_row.clr.empty())
				this.project._dp.sys.elmnts.find_rows({elm_type: {in: [$p.enm.elm_types.Стекло, $p.enm.elm_types.Заполнение]}}, function (row) {
					_row.clr = row.clr;
					return false;
				});
			this.clr = _row.clr;

			if(_row.elm_type.empty())
				_row.elm_type = $p.enm.elm_types.Стекло;

			this.data.path.visible = false;

			this.addChild(this.data.path);
			//this.addChild(this.data.generatrix);

			// раскладки текущего заполнения
			this.project.ox.coordinates.find_rows({
				cnstr: this.layer.cnstr,
				parent: this.elm,
				elm_type: $p.enm.elm_types.Раскладка
			}, function(row){
				new Onlay({row: row, parent: this});
			}.bind(this));
			
		}
	},

	profiles: {
		get : function(){
			return this.data._profiles || [];
		}
	},

	/**
	 * Массив раскладок
	 */
	onlays: {
		get: function () {
			return this.getItems({class: Onlay});
		}
	},

	/**
	 * Вычисляемые поля в таблице координат
	 * @method save_coordinates
	 * @for Filling
	 */
	save_coordinates: {
		value: function () {

			var h = this.project.bounds.height + this.project.bounds.y,
				_row = this._row,
				bounds = this.bounds,
				cnns = this.project.connections.cnns,
				profiles = this.profiles,
				length = profiles.length,
				curr, prev,	next,
				
				// строка в таблице заполнений продукции
				glass = this.project.ox.glasses.add({
					elm: _row.elm,
					nom: this.nom,
					width: bounds.width,
					height: bounds.height,
					s: this.s,
					is_rectangular: this.is_rectangular,
					thickness: this.thickness
				});

			// координаты bounds
			_row.x1 = (bounds.bottomLeft.x - this.project.bounds.x).round(3);
			_row.y1 = (h - bounds.bottomLeft.y).round(3);
			_row.x2 = (bounds.topRight.x - this.project.bounds.x).round(3);
			_row.y2 = (h - bounds.topRight.y).round(3);
			_row.path_data = this.path.pathData;


			// получаем пути граней профиля
			for(var i=0; i<length; i++ ){

				curr = profiles[i];

				if(!curr.profile || !curr.profile._row || !curr.cnn){
					if($p.job_prm.debug)
						throw new ReferenceError("Не найдено ребро заполнения");
					else
						return;
				}

				curr.aperture_path = curr.profile.generatrix.get_subpath(curr.b, curr.e).data.reversed ? curr.profile.rays.outer : curr.profile.rays.inner;
			}

			// получам пересечения
			for(var i=0; i<length; i++ ){
				
				prev = i==0 ? profiles[length-1] : profiles[i-1];
				curr = profiles[i];
				next = i==length-1 ? profiles[0] : profiles[i+1];
				
				var pb = curr.aperture_path.intersect_point(prev.aperture_path, curr.b, true),
					pe = curr.aperture_path.intersect_point(next.aperture_path, curr.e, true);
				
				if(!pb || !pe){
					if($p.job_prm.debug)
						throw "Filling:path";
					else
						return;
				}

				// соединения с профилями
				cnns.add({
					elm1: _row.elm,
					elm2: curr.profile._row.elm,
					node1: "",
					node2: "",
					cnn: curr.cnn.ref,
					aperture_len: curr.aperture_path.get_subpath(pb, pe).length.round(1)
				});
				
			}

			// удаляем лишние ссылки
			for(var i=0; i<length; i++ ){
				delete profiles[i].aperture_path;
			}

			
			// дочерние раскладки
			this.onlays.forEach(function (curr) {
				curr.save_coordinates();
			});
			

		}
	},

	/**
	 * Создаёт створку в текущем заполнении
	 */
	create_leaf: {
		value: function () {

			// создаём пустой новый слой
			var contour = new Contour( {parent: this.parent});

			// задаём его путь - внутри будут созданы профили
			contour.path = this.profiles;

			// помещаем себя вовнутрь нового слоя
			this.parent = contour;
			this._row.cnstr = contour.cnstr;

			// фурнитура и параметры по умолчанию
			contour.furn = this.project.default_furn;

			// оповещаем мир о новых слоях
			Object.getNotifier(this.project._noti).notify({
				type: 'rows',
				tabular: "constructions"
			});

		}
	},

	s: {
		get : function(){
			return this.bounds.width * this.bounds.height / 1000000;
		},
		enumerable : true
	},

	/**
	 * Признак прямоугольности
	 */
	is_rectangular: {
		get : function(){
			return this.profiles.length == 4 && !this.data.path.hasHandles();
		}
	},

	is_sandwich: {
		get : function(){
			return false;
		}
	},

	/**
	 * путь элемента - состоит из кривых, соединяющих вершины элемента
	 * @property path
	 * @type paper.Path
	 */
	path: {
		get : function(){ return this.data.path; },
		set : function(attr){

			var data = this.data;
			data.path.removeSegments();
			data._profiles = [];

			if(attr instanceof paper.Path){

				// Если в передаваемом пути есть привязка к профилям контура - используем
				if(attr.data.curve_nodes){

					data.path.addSegments(attr.segments);
				}else{
					data.path.addSegments(attr.segments);
				}


			}else if(Array.isArray(attr)){
				var length = attr.length, prev, curr, next, sub_path;
				// получам эквидистанты сегментов, смещенные на размер соединения
				for(var i=0; i<length; i++ ){
					curr = attr[i];
					next = i==length-1 ? attr[0] : attr[i+1];
					curr.cnn = $p.cat.cnns.elm_cnn(this, curr.profile);
					sub_path = curr.profile.generatrix.get_subpath(curr.b, curr.e);

					//sub_path.data.reversed = curr.profile.generatrix.getDirectedAngle(next.e) < 0;
					//if(sub_path.data.reversed)
					//	curr.outer = !curr.outer;
					curr.sub_path = sub_path.equidistant(
						(sub_path.data.reversed ? -curr.profile.d1 : curr.profile.d2) + (curr.cnn ? curr.cnn.sz : 20), consts.sticking);

				}
				// получам пересечения
				for(var i=0; i<length; i++ ){
					prev = i==0 ? attr[length-1] : attr[i-1];
					curr = attr[i];
					next = i==length-1 ? attr[0] : attr[i+1];
					if(!curr.pb)
						curr.pb = prev.pe = curr.sub_path.intersect_point(prev.sub_path, curr.b, true);
					if(!curr.pe)
						curr.pe = next.pb = curr.sub_path.intersect_point(next.sub_path, curr.e, true);
					if(!curr.pb || !curr.pe){
						if($p.job_prm.debug)
							throw "Filling:path";
						else
							continue;
					}
					curr.sub_path = curr.sub_path.get_subpath(curr.pb, curr.pe);
				}
				// формируем путь
				for(var i=0; i<length; i++ ){
					curr = attr[i];
					data.path.addSegments(curr.sub_path.segments);
					["anext","pb","pe"].forEach(function (prop) {
						delete curr[prop];
					});
					data._profiles.push(curr);
				}
			}

			if(data.path.segments.length && !data.path.closed)
				data.path.closePath(true);

			data.path.reduce();

			data = attr = null;
		}
	},

	// возвращает текущие (ранее установленные) узлы заполнения
	nodes: {
		get: function () {
			var res = [];
			if(this.profiles.length){
				this.profiles.forEach(function (curr) {
					res.push(curr.b);
				});
			}else{
				res = this.parent.glass_nodes(this.path);
			}
			return res;
		}
	},

	/**
	 * Возвращает массив внешних примыкающих профилей текущего заполнения
	 */
	outer_profiles: {
		get: function () {
			return this.profiles;
		}
	},

	/**
	 * Массив с рёбрами периметра
	 */
	perimeter: {
		get: function () {
			var res = [], tmp;
			this.profiles.forEach(function (curr) {
				res.push(tmp = {
					len: curr.sub_path.length,
					angle: curr.e.subtract(curr.b).angle
				});
				if(tmp.angle < 0)
					tmp.angle += 360;
			});
			return res;
		}
	},

	/**
	 * Координата x левой границы (только для чтения)
	 */
	x1: {
		get: function () {
			return (this.bounds.left - this.project.bounds.x).round(1);
		},
		set: function (v) {

		}
	},

	/**
	 * Координата x правой границы (только для чтения)
	 */
	x2: {
		get: function () {
			return (this.bounds.right - this.project.bounds.x).round(1);
		},
		set: function (v) {

		}
	},

	/**
	 * Координата y нижней границы (только для чтения)
	 */
	y1: {
		get: function () {
			return (this.project.bounds.height + this.project.bounds.y - this.bounds.bottom).round(1);
		},
		set: function (v) {

		}
	},

	/**
	 * Координата y верхней (только для чтения)
	 */
	y2: {
		get: function () {
			return (this.project.bounds.height + this.project.bounds.y - this.bounds.top).round(1);
		},
		set: function (v) {

		}
	},

	// информация для редактора свойста
	info: {
		get : function(){
			return "№" + this.elm + " w:" + this.bounds.width.toFixed(0) + " h:" + this.bounds.height.toFixed(0);
		},
		enumerable : true
	},

	select_node: {
		value: function (v) {
			var point, segm, delta = Infinity;
			if(v == "b"){
				point = this.bounds.bottomLeft;
			}else{
				point = this.bounds.topRight;
			}
			this.data.path.segments.forEach(function (curr) {
				curr.selected = false;
				if(point.getDistance(curr.point) < delta){
					delta = point.getDistance(curr.point);
					segm = curr;
				}
			});
			segm.selected = true;
			this.view.update();
		}
	},

	/**
	 * Описание полей диалога свойств элемента
	 */
	oxml: {
		get: function () {
			var cnn_ii = this.selected_cnn_ii(),
				oxml = {
					" ": [
						{id: "info", path: "o.info", type: "ro"},
						"inset",
						"clr"
					],
					"Начало": [
						{id: "x1", path: "o.x1", synonym: "X1", type: "ro"},
						{id: "y1", path: "o.y1", synonym: "Y1", type: "ro"}
					],
					"Конец": [
						{id: "x2", path: "o.x2", synonym: "X2", type: "ro"},
						{id: "y2", path: "o.y2", synonym: "Y2", type: "ro"}
					]
				};

			if(cnn_ii)
				oxml["Примыкание"] = ["cnn3"];

			return oxml;
			
		},
		enumerable: false
	},

	default_clr_str: {
		value: "#def,#d0ddff,#eff",
		enumerable: false
	},

	/**
	 * Перерисовывает раскладки текущего заполнения
	 */
	redraw_onlay: {
		value: function () {
			this.onlays.forEach(function (elm) {
				elm.redraw();
			});
		}
	}

});

Editor.Filling = Filling;
/**
 *
 * Created 21.08.2015<br />
 * &copy; http://www.oknosoft.ru 2014-2015
 * @author    Evgeniy Malyarov
 * 
 * @module geometry
 * @submodule freetext
 */

/**
 * ### Произвольный текст на эскизе
 *
 * @class FreeText
 * @param attr {Object} - объект с указанием на строку координат и родительского слоя
 * @param attr.parent {BuilderElement} - элемент, к которому привязывается комментарий
 * @constructor
 * @extends paper.PointText
 * @menuorder 46
 * @tooltip Текст на эскизе
 */
function FreeText(attr){

	var _row;

	if(!attr.fontSize)
		attr.fontSize = consts.font_size;

	if(attr.row)
		_row = attr.row;
	else{
		_row = attr.row = attr.parent.project.ox.coordinates.add();
	}

	if(!_row.cnstr)
		_row.cnstr = attr.parent.layer.cnstr;

	if(!_row.elm)
		_row.elm = attr.parent.project.ox.coordinates.aggregate([], ["elm"], "max") + 1;

	// разберёмся с родителем
	// if(attr.parent instanceof paper.path){
	// 	attr.parent = attr.parent.layer.l_text;
	// }

	FreeText.superclass.constructor.call(this, attr);

	this.__define({
		_row: {
			get: function () {
				return _row;
			},
			enumerable: false
		}
	});

	if(attr.point){
		if(attr.point instanceof paper.Point)
			this.point = attr.point;
		else
			this.point = new paper.Point(attr.point);
	}else{

		
		this.clr = _row.clr;
		this.angle = _row.angle_hor;

		if(_row.path_data){
			var path_data = JSON.parse(_row.path_data);
			this.x = _row.x1 + path_data.bounds_x || 0;
			this.y = _row.y1 - path_data.bounds_y || 0;
			this._mixin(path_data, null, ["bounds_x","bounds_y"]);
		}else{
			this.x = _row.x1;
			this.y = _row.y1;
		}
	}

	this.bringToFront();


	/**
	 * Удаляет элемент из контура и иерархии проекта
	 * Одновлеменно, удаляет строку из табчасти табчасти _Координаты_
	 * @method remove
	 */
	this.remove = function () {
		_row._owner.del(_row);
		_row = null;
		FreeText.superclass.remove.call(this);
	};

}
FreeText._extend(paper.PointText);

FreeText.prototype.__define({

	/**
	 * Вычисляемые поля в таблице координат
	 * @method save_coordinates
	 * @for FreeText
	 */
	save_coordinates: {
		value: function () {

			var _row = this._row;

			_row.x1 = this.x;
			_row.y1 = this.y;
			_row.angle_hor = this.angle;
			
			// устанавливаем тип элемента
			_row.elm_type = this.elm_type;

			// сериализованные данные
			_row.path_data = JSON.stringify({
				text: this.text,
				font_family: this.font_family,
				font_size: this.font_size,
				bold: this.bold,
				align: this.align.ref,
				bounds_x: this.project.bounds.x,
				bounds_y: this.project.bounds.y
			});
		}
	},

	/**
	 * Возвращает тип элемента (Текст)
	 * @property elm_type
	 * @for FreeText
	 */
	elm_type: {
		get : function(){

			return $p.enm.elm_types.Текст;

		}
	},

	/**
	 * ### Перемещает элемент и информирует об этом наблюдателя 
	 * @method move_points
	 * @for FreeText
	 */
	move_points: {
		value: function (point) {

			this.point = point;

			Object.getNotifier(this).notify({
				type: 'update',
				name: "x"
			});
			Object.getNotifier(this).notify({
				type: 'update',
				name: "y"
			});
		}
	},

	// виртуальные метаданные для автоформ
	_metadata: {
		get: function () {
			return $p.dp.builder_text.metadata();
		},
		enumerable: false
	},

	// виртуальный датаменеджер для автоформ
	_manager: {
		get: function () {
			return $p.dp.builder_text;
		},
		enumerable: false
	},

	// транслирует цвет из справочника в строку и обратно
	clr: {
		get: function () {
			return this._row ? this._row.clr : $p.cat.clrs.get();
		},
		set: function (v) {
			this._row.clr = v;
			if(this._row.clr.clr_str.length == 6)
				this.fillColor = "#" + this._row.clr.clr_str;
			this.project.register_update();
		},
		enumerable: false
	},

	// семейство шрифта
	font_family: {
		get: function () {
			return this.fontFamily || "";
		},
		set: function (v) {
			this.fontFamily = v;
			this.project.register_update();
		},
		enumerable: false
	},

	// размер шрифта
	font_size: {
		get: function () {
			return this.fontSize || consts.font_size;
		},
		set: function (v) {
			this.fontSize = v;
			this.project.register_update();
		},
		enumerable: false
	},

	// жирность шрифта
	bold: {
		get: function () {
			return this.fontWeight != 'normal';
		},
		set: function (v) {
			this.fontWeight = v ? 'bold' : 'normal';
		},
		enumerable: false
	},

	// координата x
	x: {
		get: function () {
			return (this.point.x - this.project.bounds.x).round(1);
		},
		set: function (v) {
			this.point.x = parseFloat(v) + this.project.bounds.x;
			this.project.register_update();
		},
		enumerable: false
	},

	// координата y
	y: {
		get: function () {
			return (this.project.bounds.height + this.project.bounds.y - this.point.y).round(1);
		},
		set: function (v) {
			this.point.y = this.project.bounds.height + this.project.bounds.y - parseFloat(v);
		},
		enumerable: false
	},

	// текст элемента
	text: {
		get: function () {
			return this.content;
		},
		set: function (v) {
			if(v){
				this.content = v;
				this.project.register_update();
			}
			else{
				Object.getNotifier(this).notify({
					type: 'unload'
				});
				setTimeout(this.remove.bind(this), 50);
			}

		},
		enumerable: false
	},

	// угол к горизонту
	angle: {
		get: function () {
			return Math.round(this.rotation);
		},
		set: function (v) {
			this.rotation = v;
			this.project.register_update();
		},
		enumerable: false
	},

	// выравнивание текста
	align: {
		get: function () {
			return $p.enm.text_aligns.get(this.justification);
		},
		set: function (v) {
			this.justification = $p.utils.is_data_obj(v) ? v.ref : v;
			this.project.register_update();
		},
		enumerable: false
	}

});

/**
 * Расширения объектов paper.js
 *
 * &copy; http://www.oknosoft.ru 2014-2015
 * @author	Evgeniy Malyarov
 * 
 * @module geometry
 * @submodule paper_ex
 */

/**
 * Расширение класса Path
 */
paper.Path.prototype.__define({

	/**
	 * Вычисляет направленный угол в точке пути
	 * @param point
	 * @return {number}
	 */
	getDirectedAngle: {
		value: function (point) {
			var np = this.getNearestPoint(point),
				offset = this.getOffsetOf(np);
			return this.getTangentAt(offset).getDirectedAngle(point.add(np.negate()));
		},
		enumerable: false
	},

	/**
	 * Угол по отношению к соседнему пути _other_ в точке _point_
	 */
	angle_to: {
		value : function(other, point, interior, round){
			var p1 = this.getNearestPoint(point),
				p2 = other.getNearestPoint(point),
				t1 = this.getTangentAt(this.getOffsetOf(p1)),
				t2 = other.getTangentAt(other.getOffsetOf(p2)),
				res = t2.angle - t1.angle;
			if(res < 0)
				res += 360;
			if(interior && res > 180)
				res = 180 - (res - 180);
			return round ? res.round(round) : res.round(1);
		},
		enumerable : false
	},

	/**
	 * Выясняет, является ли путь прямым
	 * @return {Boolean}
	 */
	is_linear: {
		value: function () {
			// если в пути единственная кривая и она прямая - путь прямой
			if(this.curves.length == 1 && this.firstCurve.isLinear())
				return true;
			// если в пути есть искривления, путь кривой
			else if(this.hasHandles())
				return false;
			else{
				// если у всех кривых пути одинаковые направленные углы - путь прямой
				var curves = this.curves,
					da = curves[0].point1.getDirectedAngle(curves[0].point2), dc;
				for(var i = 1; i < curves.lenght; i++){
					dc = curves[i].point1.getDirectedAngle(curves[i].point2);
					if(Math.abs(dc - da) > 0.01)
						return false;
				}
			}
			return true;
		},
		enumerable: false
	},

	/**
	 * возвращает фрагмент пути между точками
	 * @param point1 {paper.Point}
	 * @param point2 {paper.Point}
	 * @return {paper.Path}
	 */
	get_subpath: {
		value: function (point1, point2) {
			var tmp;

			if(!this.length || (point1.is_nearest(this.firstSegment.point) && point2.is_nearest(this.lastSegment.point))){
				tmp = this.clone(false);

			}else if(point2.is_nearest(this.firstSegment.point) && point1.is_nearest(this.lastSegment.point)){
				tmp = this.clone(false);
				tmp.reverse();
				tmp.data.reversed = true;

			} else{

				var loc1 = this.getLocationOf(point1),
					loc2 = this.getLocationOf(point2);
				if(!loc1)
					loc1 = this.getNearestLocation(point1);
				if(!loc2)
					loc2 = this.getNearestLocation(point2);

				if(this.is_linear()){
					// для прямого формируем новый путь из двух точек
					tmp = new paper.Path({
						segments: [loc1.point, loc2.point],
						insert: false
					});

				}else{
					// для кривого строим по точкам, наподобие эквидистанты
					var step = (loc2.offset - loc1.offset) * 0.02,
						tmp = new paper.Path({
							segments: [point1],
							insert: false
						});

					if(step < 0){
						tmp.data.reversed = true;
						for(var i = loc1.offset; i>=loc2.offset; i+=step)
							tmp.add(this.getPointAt(i));
					}else if(step > 0){
						for(var i = loc1.offset; i<=loc2.offset; i+=step)
							tmp.add(this.getPointAt(i));
					}
					tmp.add(point2);
					tmp.simplify(0.8);
				}

				if(loc1.offset > loc2.offset)
					tmp.data.reversed = true;
			}

			return tmp;
		},
		enumerable: false
	},

	/**
	 * возвращает путь, равноотстоящий от текущего пути
	 * @param delta {number} - расстояние, на которое будет смещен новый путь
	 * @param elong {number} - удлинение нового пути с каждого конца
	 * @return {paper.Path}
	 */
	equidistant: {
		value: function (delta, elong) {

			var normal = this.getNormalAt(0),
				res = new paper.Path({
					segments: [this.firstSegment.point.add(normal.multiply(delta))],
					insert: false
				});

			if(this.is_linear()) {
				// добавляем последнюю точку
				res.add(this.lastSegment.point.add(normal.multiply(delta)));

			}else{

				// для кривого бежим по точкам
				var len = this.length, step = len * 0.02, point;

				for(var i = step; i<=len; i+=step) {
					point = this.getPointAt(i);
					if(!point)
						continue;
					normal = this.getNormalAt(i);
					res.add(point.add(normal.multiply(delta)));
				}

				// добавляем последнюю точку
				normal = this.getNormalAt(len);
				res.add(this.lastSegment.point.add(normal.multiply(delta)));

				res.simplify(0.8);
			}

			return res.elongation(elong);
		},
		enumerable: false
	},

	/**
	 * Удлиняет путь касательными в начальной и конечной точках
	 */
	elongation: {
		value: function (delta) {

			if(delta){
				var tangent = this.getTangentAt(0);
				if(this.is_linear()) {
					this.firstSegment.point = this.firstSegment.point.add(tangent.multiply(-delta));
					this.lastSegment.point = this.lastSegment.point.add(tangent.multiply(delta));
				}else{
					this.insert(0, this.firstSegment.point.add(tangent.multiply(-delta)));
					tangent = this.getTangentAt(this.length);
					this.add(this.lastSegment.point.add(tangent.multiply(delta)));
				}
			}

			return this;

		},
		enumerable: false
	},

	/**
	 * Находит координату пересечения путей в окрестности точки
	 * @method intersect_point
	 * @for Path
	 * @param path {paper.Path}
	 * @param point {paper.Point}
	 * @param elongate {Boolean} - если истина, пути будут продолжены до пересечения
	 * @return point {paper.Point}
	 */
	intersect_point: {
		value: function (path, point, elongate) {
			var intersections = this.getIntersections(path),
				delta = Infinity, tdelta, tpoint;

			if(intersections.length == 1)
				return intersections[0].point;

			else if(intersections.length > 1){

				if(!point)
					point = this.getPointAt(this.length /2);
				
				intersections.forEach(function(o){
					tdelta = o.point.getDistance(point, true);
					if(tdelta < delta){
						delta = tdelta;
						tpoint = o.point;
					}
				});
				return tpoint;

			}else if(elongate == "nearest"){

				// ищем проекцию ближайшей точки на path на наш путь
				return this.getNearestPoint(path.getNearestPoint(point));

			}else if(elongate){

				// продлеваем пути до пересечения
				var p1 = this.getNearestPoint(point),
					p2 = path.getNearestPoint(point),
					p1last = this.firstSegment.point.getDistance(p1, true) > this.lastSegment.point.getDistance(p1, true),
					p2last = path.firstSegment.point.getDistance(p2, true) > path.lastSegment.point.getDistance(p2, true),
					tg;

				tg = (p1last ? this.getTangentAt(this.length) : this.getTangentAt(0).negate()).multiply(100);
				if(this.is_linear){
					if(p1last)
						this.lastSegment.point = this.lastSegment.point.add(tg);
					else
						this.firstSegment.point = this.firstSegment.point.add(tg);
				}

				tg = (p2last ? path.getTangentAt(path.length) : path.getTangentAt(0).negate()).multiply(100);
				if(path.is_linear){
					if(p2last)
						path.lastSegment.point = path.lastSegment.point.add(tg);
					else
						path.firstSegment.point = path.firstSegment.point.add(tg);
				}

				return this.intersect_point(path, point);

			}
		},
		enumerable: false
	}

});


paper.Point.prototype.__define({

	/**
	 * Выясняет, расположена ли точка в окрестности точки
	 * @param point {paper.Point}
	 * @param [sticking] {Boolean}
	 * @return {Boolean}
	 */
	is_nearest: {
		value: function (point, sticking) {
			return this.getDistance(point, true) < (sticking ? consts.sticking2 : 10);
		},
		enumerable: false
	},

	/**
	 * ПоложениеТочкиОтносительноПрямой
	 * @param x1 {Number}
	 * @param y1 {Number}
	 * @param x2 {Number}
	 * @param y2 {Number}
	 * @return {number}
	 */
	point_pos: {
		value: function(x1,y1, x2,y2){
			if (Math.abs(x1-x2) < 0.2){
				// вертикаль  >0 - справа, <0 - слева,=0 - на линии
				return (this.x-x1)*(y1-y2);
			}
			if (Math.abs(y1-y2) < 0.2){
				// горизонталь >0 - снизу, <0 - сверху,=0 - на линии
				return (this.y-y1)*(x2-x1);
			}
			// >0 - справа, <0 - слева,=0 - на линии
			return (this.y-y1)*(x2-x1)-(y2-y1)*(this.x-x1);
		},
		enumerable: false
	},

	/**
	 * ### Рассчитывает координаты центра окружности по точкам и радиусу
	 * @param x1 {Number}
	 * @param y1 {Number}
	 * @param x2 {Number}
	 * @param y2 {Number}
	 * @param r {Number}
	 * @param arc_ccw {Boolean}
	 * @param more_180 {Boolean}
	 * @return {Point}
	 */
	arc_cntr: {
		value: function(x1,y1, x2,y2, r0, ccw){
			var a,b,p,r,q,yy1,xx1,yy2,xx2;
			if(ccw){
				var tmpx=x1, tmpy=y1;
				x1=x2; y1=y2; x2=tmpx; y2=tmpy;
			}
			if (x1!=x2){
				a=(x1*x1 - x2*x2 - y2*y2 + y1*y1)/(2*(x1-x2));
				b=((y2-y1)/(x1-x2));
				p=b*b+ 1;
				r=-2*((x1-a)*b+y1);
				q=(x1-a)*(x1-a) - r0*r0 + y1*y1;
				yy1=(-r + Math.sqrt(r*r - 4*p*q))/(2*p);
				xx1=a+b*yy1;
				yy2=(-r - Math.sqrt(r*r - 4*p*q))/(2*p);
				xx2=a+b*yy2;
			} else{
				a=(y1*y1 - y2*y2 - x2*x2 + x1*x1)/(2*(y1-y2));
				b=((x2-x1)/(y1-y2));
				p=b*b+ 1;
				r=-2*((y1-a)*b+x1);
				q=(y1-a)*(y1-a) - r0*r0 + x1*x1;
				xx1=(-r - Math.sqrt(r*r - 4*p*q))/(2*p);
				yy1=a+b*xx1;
				xx2=(-r + Math.sqrt(r*r - 4*p*q))/(2*p);
				yy2=a+b*xx2;
			}

			if (new paper.Point(xx1,yy1).point_pos(x1,y1, x2,y2)>0)
				return {x: xx1, y: yy1};
			else
				return {x: xx2, y: yy2}
		},
		enumerable: false
	},

	/**
	 * ### Рассчитывает координаты точки, лежащей на окружности
	 * @param x1
	 * @param y1
	 * @param x2
	 * @param y2
	 * @param r
	 * @param arc_ccw
	 * @param more_180
	 * @return {{x: number, y: number}}
	 */
	arc_point: {
		value: function(x1,y1, x2,y2, r, arc_ccw, more_180){
			var point = {x: (x1 + x2) / 2, y: (y1 + y2) / 2};
			if (r>0){
				var dx = x1-x2, dy = y1-y2, dr = r*r-(dx*dx+dy*dy)/4, l, h, centr;
				if(dr >= 0){
					centr = this.arc_cntr(x1,y1, x2,y2, r, arc_ccw);
					dx = centr.x - point.x;
					dy = point.y - centr.y;	// т.к. Y перевернут
					l = Math.sqrt(dx*dx + dy*dy);

					if(more_180)
						h = r+Math.sqrt(dr);
					else
						h = r-Math.sqrt(dr);

					point.x += dx*h/l;
					point.y += dy*h/l;
				}
			}
			return point;
		},
		enumerable: false
	},

	/**
	 * ### Привязка к углу
	 * Сдвигает точку к ближайшему лучу с углом, кратным snapAngle
	 *
	 * @param [snapAngle] {Number} - шаг угла, по умолчанию 45°
	 * @return {paper.Point}
	 */
	snap_to_angle: {
		value: function(snapAngle) {
			if(!snapAngle)
				snapAngle = Math.PI*2/8;

			var angle = Math.atan2(this.y, this.x);
			angle = Math.round(angle/snapAngle) * snapAngle;
			var dirx = Math.cos(angle),
				diry = Math.sin(angle),
				d = dirx*this.x + diry*this.y;

			return new paper.Point(dirx*d, diry*d);
		}
	}

});






/**
 * Created 24.07.2015<br />
 * &copy; http://www.oknosoft.ru 2014-2015
 * @author	Evgeniy Malyarov
 *
 * @module geometry
 * @submodule profile
 */


/**
 * ### Элемент профиля
 * Виртуальный класс описывает общие свойства профиля и раскладки
 *
 * @class ProfileItem
 * @extends BuilderElement
 * @param attr {Object} - объект со свойствами создаваемого элемента см. {{#crossLink "BuilderElement"}}параметр конструктора BuilderElement{{/crossLink}}
 * @constructor
 * @menuorder 41
 * @tooltip Элемент профиля
 */
function ProfileItem(attr){

	ProfileItem.superclass.constructor.call(this, attr);

	this.initialize(attr);

}
ProfileItem._extend(BuilderElement);

ProfileItem.prototype.__define({

	/**
	 * ### Вычисляемые поля в таблице координат
	 * @method save_coordinates
	 * @for ProfileItem
	 */
	save_coordinates: {
		value: function () {

			if(!this.data.generatrix)
				return;

			var _row = this._row,

				cnns = this.project.connections.cnns,
				b = this.rays.b,
				e = this.rays.e,
				row_b = cnns.add({
					elm1: _row.elm,
					node1: "b",
					cnn: b.cnn ? b.cnn.ref : "",
					aperture_len: this.corns(1).getDistance(this.corns(4)).round(1)
				}),
				row_e = cnns.add({
					elm1: _row.elm,
					node1: "e",
					cnn: e.cnn ? e.cnn.ref : "",
					aperture_len: this.corns(2).getDistance(this.corns(3)).round(1)
				}),

				gen = this.generatrix;

			_row.x1 = this.x1;
			_row.y1 = this.y1;
			_row.x2 = this.x2;
			_row.y2 = this.y2;
			_row.path_data = gen.pathData;
			_row.nom = this.nom;


			// добавляем припуски соединений
			_row.len = this.length.round(1);

			// сохраняем информацию о соединениях
			if(b.profile){
				row_b.elm2 = b.profile.elm;
				if(b.profile.e.is_nearest(b.point))
					row_b.node2 = "e";
				else if(b.profile.b.is_nearest(b.point))
					row_b.node2 = "b";
				else
					row_b.node2 = "t";
			}
			if(e.profile){
				row_e.elm2 = e.profile.elm;
				if(e.profile.b.is_nearest(e.point))
					row_e.node2 = "b";
				else if(e.profile.e.is_nearest(e.point))
					row_e.node2 = "b";
				else
					row_e.node2 = "t";
			}

			// для створочных и доборных профилей добавляем соединения с внешними элементами
			if(row_b = this.nearest()){
				cnns.add({
					elm1: _row.elm,
					elm2: row_b.elm,
					cnn: this.data._nearest_cnn,
					aperture_len: _row.len
				});
			}

			// получаем углы между элементами и к горизонту
			_row.angle_hor = this.angle_hor;

			_row.alp1 = Math.round((this.corns(4).subtract(this.corns(1)).angle - gen.getTangentAt(0).angle) * 10) / 10;
			if(_row.alp1 < 0)
				_row.alp1 = _row.alp1 + 360;

			_row.alp2 = Math.round((gen.getTangentAt(gen.length).angle - this.corns(2).subtract(this.corns(3)).angle) * 10) / 10;
			if(_row.alp2 < 0)
				_row.alp2 = _row.alp2 + 360;

			// устанавливаем тип элемента
			_row.elm_type = this.elm_type;

			// TODO: Рассчитать положение и ориентацию

			// вероятно, импост, всегда занимает положение "центр"


			// координаты доборов
			this.addls.forEach(function (addl) {
				addl.save_coordinates();
			});

		}
	},

	/**
	 * Вызывается из конструктора - создаёт пути и лучи
	 * @method initialize
	 * @for ProfileItem
	 * @private
	 */
	initialize: {
		value : function(attr){

			var h = this.project.bounds.height + this.project.bounds.y,
				_row = this._row;

			if(attr.r)
				_row.r = attr.r;

			if(attr.generatrix) {
				this.data.generatrix = attr.generatrix;
				if(this.data.generatrix.data.reversed)
					delete this.data.generatrix.data.reversed;

			} else {

				if(_row.path_data) {
					this.data.generatrix = new paper.Path(_row.path_data);

				}else{
					this.data.generatrix = new paper.Path([_row.x1, h - _row.y1]);
					if(_row.r){
						this.data.generatrix.arcTo(
							$p.m.arc_point(_row.x1, h - _row.y1, _row.x2, h - _row.y2,
								_row.r + 0.001, _row.arc_ccw, false), [_row.x2, h - _row.y2]);
					}else{
						this.data.generatrix.lineTo([_row.x2, h - _row.y2]);
					}
				}
			}

			// точки пересечения профиля с соседями с внутренней стороны
			this.data._corns = [];

			// кеш лучей в узлах профиля
			this.data._rays = new ProfileRays(this);

			this.data.generatrix.strokeColor = 'grey';

			this.data.path = new paper.Path();
			this.data.path.strokeColor = 'black';
			this.data.path.strokeWidth = 1;
			this.data.path.strokeScaling = false;

			this.clr = _row.clr.empty() ? $p.job_prm.builder.base_clr : _row.clr;
			//this.data.path.fillColor = new paper.Color(0.96, 0.98, 0.94, 0.96);

			this.addChild(this.data.path);
			this.addChild(this.data.generatrix);

		}
	},

	/**
	 * ### Обсервер
	 * Наблюдает за изменениями контура и пересчитывает путь элемента при изменении соседних элементов
	 *
	 * @method observer
	 * @for ProfileItem
	 * @private
	 */
	observer: {
		value: function(an){

			var bcnn, ecnn, moved;

			if(Array.isArray(an)){
				moved = an[an.length-1];

				if(moved.profiles.indexOf(this) == -1){

					bcnn = this.cnn_point("b");
					ecnn = this.cnn_point("e");

					// если среди профилей есть такой, к которму примыкает текущий, пробуем привязку
					moved.profiles.forEach(function (p) {
						this.do_bind(p, bcnn, ecnn, moved);
					}.bind(this));

					moved.profiles.push(this);
				}

			}else if(an instanceof Profile){
				this.do_bind(an, this.cnn_point("b"), this.cnn_point("e"));

			}

		}
	},

	/**
	 * ### Координаты начала элемента
	 * @property b
	 * @for ProfileItem
	 * @type paper.Point
	 */
	b: {
		get : function(){
			if(this.data.generatrix)
				return this.data.generatrix.firstSegment.point;
		},
		set : function(v){
			this.data._rays.clear();
			if(this.data.generatrix)
				this.data.generatrix.firstSegment.point = v;
		}
	},

	/**
	 * Координаты конца элемента
	 * @property e
	 * @for ProfileItem
	 * @type Point
	 */
	e: {
		get : function(){
			if(this.data.generatrix)
				return this.data.generatrix.lastSegment.point;
		},
		set : function(v){
			this.data._rays.clear();
			if(this.data.generatrix)
				this.data.generatrix.lastSegment.point = v;
		}
	},

	/**
	 * ### Точка corns(1)
	 *
	 * @property bc
	 * @for ProfileItem
	 * @type Point
	 */
	bc: {
		get : function(){
			return this.corns(1);
		}
	},

	/**
	 * ### Точка corns(2)
	 *
	 * @property ec
	 * @for ProfileItem
	 * @type Point
	 */
	ec: {
		get : function(){
			return this.corns(2);
		}
	},

	/**
	 * ### Координата x начала профиля
	 *
	 * @property x1
	 * @for ProfileItem
	 * @type Number
	 */
	x1: {
		get : function(){
			return (this.b.x - this.project.bounds.x).round(1);
		},
		set: function(v){
			this.select_node("b");
			this.move_points(new paper.Point(parseFloat(v) + this.project.bounds.x - this.b.x, 0));
		}
	},

	/**
	 * ### Координата y начала профиля
	 *
	 * @property y1
	 * @for ProfileItem
	 * @type Number
	 */
	y1: {
		get : function(){
			return (this.project.bounds.height + this.project.bounds.y - this.b.y).round(1);
		},
		set: function(v){
			v = this.project.bounds.height + this.project.bounds.y - parseFloat(v);
			this.select_node("b");
			this.move_points(new paper.Point(0, v - this.b.y));
		}
	},

	/**
	 * ###Координата x конца профиля
	 *
	 * @property x2
	 * @for ProfileItem
	 * @type Number
	 */
	x2: {
		get : function(){
			return (this.e.x - this.project.bounds.x).round(1);
		},
		set: function(v){
			this.select_node("e");
			this.move_points(new paper.Point(parseFloat(v) + this.project.bounds.x - this.e.x, 0));
		}
	},

	/**
	 * ### Координата y конца профиля
	 *
	 * @property y2
	 * @for ProfileItem
	 * @type Number
	 */
	y2: {
		get : function(){
			return (this.project.bounds.height + this.project.bounds.y - this.e.y).round(1);
		},
		set: function(v){
			v = this.project.bounds.height + this.project.bounds.y - parseFloat(v);
			this.select_node("e");
			this.move_points(new paper.Point(0, v - this.e.y));
		}
	},

	/**
	 * ### Соединение в точке 'b' для диалога свойств
	 *
	 * @property cnn1
	 * @for ProfileItem
	 * @type _cat.cnns
	 * @private
	 */
	cnn1: {
		get : function(){
			return this.cnn_point("b").cnn || $p.cat.cnns.get();
		},
		set: function(v){
			this.rays.b.cnn = $p.cat.cnns.get(v);
			this.project.register_change();
		}
	},

	/**
	 * Соединение в точке 'e' для диалога свойств
	 *
	 * @property cnn2
	 * @for ProfileItem
	 * @type _cat.cnns
	 * @private
	 */
	cnn2: {
		get : function(){
			return this.cnn_point("e").cnn || $p.cat.cnns.get();
		},
		set: function(v){
			this.rays.e.cnn = $p.cat.cnns.get(v);
			this.project.register_change();
		}
	},

	/**
	 * информация для диалога свойств
	 *
	 * @property info
	 * @for ProfileItem
	 * @type String
	 * @final
	 * @private
	 */
	info: {
		get : function(){
			return "№" + this.elm + " α:" + this.angle_hor.toFixed(0) + "° l:" + this.length.toFixed(0);
		}
	},

	/**
	 * ### Радиус сегмента профиля
	 *
	 * @property r
	 * @for ProfileItem
	 * @type Number
	 */
	r: {
		get : function(){
			return this._row.r;
		},
		set: function(v){
			this.data._rays.clear();
			this._row.r = v;
		}
	},

	/**
	 * ### Направление дуги сегмента профиля против часовой стрелки
	 *
	 * @property arc_ccw
	 * @for ProfileItem
	 * @type Boolean
	 */
	arc_ccw: {
		get : function(){

		},
		set: function(v){
			this.data._rays.clear();
		}
	},

	/**
	 * ### Дополняет cnn_point свойствами соединения
	 *
	 * @method postcalc_cnn
	 * @for ProfileItem
	 * @param node {String} b, e - начало или конец элемента
	 * @returns CnnPoint
	 */
	postcalc_cnn: {
		value: function(node){

			var cnn_point = this.cnn_point(node);

			cnn_point.cnn = $p.cat.cnns.elm_cnn(this, cnn_point.profile, cnn_point.cnn_types, cnn_point.cnn);

			if(!cnn_point.point)
				cnn_point.point = this[node];
			
			return cnn_point;
		}
	},

	/**
	 * ### Пересчитывает вставку после пересчета соединений
	 * Контроль пока только по типу элемента
	 *
	 * @method postcalc_inset
	 * @for ProfileItem
	 * @chainable
	 */
	postcalc_inset: {

		value: function(){

			// если слева и справа T - и тип не импост или есть не T и тпи импост
			this.inset = this.project.check_inset({ elm: this });

			return this;
		}
	},

	/**
	 * ### Рассчитывает точки пути
	 * на пересечении текущего и указанного профилей
	 *
	 * @method path_points
	 * @for ProfileItem
	 * @param cnn_point {CnnPoint}
	 */
	path_points: {
		value: function(cnn_point, profile_point){

			var _profile = this,
				_corns = this.data._corns,
				rays = this.rays,
				prays,  normal;

			if(!this.generatrix.curves.length)
				return cnn_point;

			// ищет точку пересечения открытых путей
			// если указан индекс, заполняет точку в массиве _corns. иначе - возвращает расстояние от узла до пересечения
			function intersect_point(path1, path2, index){
				var intersections = path1.getIntersections(path2),
					delta = Infinity, tdelta, point, tpoint;

				if(intersections.length == 1)
					if(index)
						_corns[index] = intersections[0].point;
					else
						return intersections[0].point.getDistance(cnn_point.point, true);

				else if(intersections.length > 1){
					intersections.forEach(function(o){
						tdelta = o.point.getDistance(cnn_point.point, true);
						if(tdelta < delta){
							delta = tdelta;
							point = o.point;
						}
					});
					if(index)
						_corns[index] = point;
					else
						return delta;
				}
			}

			//TODO учесть импосты, у которых образующая совпадает с ребром
			function detect_side(){

				if(cnn_point.profile instanceof ProfileItem){
					var isinner = intersect_point(prays.inner, _profile.generatrix),
						isouter = intersect_point(prays.outer, _profile.generatrix);
					if(isinner != undefined && isouter == undefined)
						return 1;
					else if(isinner == undefined && isouter != undefined)
						return -1;
					else
						return 1;
				}else
					return 1;

			}

			// если пересечение в узлах, используем лучи профиля
			if(cnn_point.profile instanceof ProfileItem){
				prays = cnn_point.profile.rays;

			}else if(cnn_point.profile instanceof Filling){
				prays = {
					inner: cnn_point.profile.path,
					outer: cnn_point.profile.path
				};
			}

			if(cnn_point.is_t){

				// для Т-соединений сначала определяем, изнутри или снаружи находится наш профиль
				if(!cnn_point.profile.path.segments.length)
					cnn_point.profile.redraw();

				if(profile_point == "b"){
					// в зависимости от стороны соединения
					if(detect_side() < 0){
						intersect_point(prays.outer, rays.outer, 1);
						intersect_point(prays.outer, rays.inner, 4);

					}else{
						intersect_point(prays.inner, rays.outer, 1);
						intersect_point(prays.inner, rays.inner, 4);

					}

				}else if(profile_point == "e"){
					// в зависимости от стороны соединения
					if(detect_side() < 0){
						intersect_point(prays.outer, rays.outer, 2);
						intersect_point(prays.outer, rays.inner, 3);

					}else{
						intersect_point(prays.inner, rays.outer, 2);
						intersect_point(prays.inner, rays.inner, 3);

					}
				}

			}else if(!cnn_point.profile_point || !cnn_point.cnn || cnn_point.cnn.cnn_type == $p.enm.cnn_types.tcn.i){
				// соединение с пустотой
				if(profile_point == "b"){
					normal = this.generatrix.firstCurve.getNormalAt(0, true);
					_corns[1] = this.b.add(normal.normalize(this.d1));
					_corns[4] = this.b.add(normal.normalize(this.d2));

				}else if(profile_point == "e"){
					normal = this.generatrix.lastCurve.getNormalAt(1, true);
					_corns[2] = this.e.add(normal.normalize(this.d1));
					_corns[3] = this.e.add(normal.normalize(this.d2));
				}

			}else if(cnn_point.cnn.cnn_type == $p.enm.cnn_types.tcn.ad){
				// угловое диагональное
				if(profile_point == "b"){
					intersect_point(prays.outer, rays.outer, 1);
					intersect_point(prays.inner, rays.inner, 4);

				}else if(profile_point == "e"){
					intersect_point(prays.outer, rays.outer, 2);
					intersect_point(prays.inner, rays.inner, 3);
				}

			}else if(cnn_point.cnn.cnn_type == $p.enm.cnn_types.tcn.av){
				// угловое к вертикальной
				if(this.orientation == $p.enm.orientations.vert){
					if(profile_point == "b"){
						intersect_point(prays.outer, rays.outer, 1);
						intersect_point(prays.outer, rays.inner, 4);

					}else if(profile_point == "e"){
						intersect_point(prays.outer, rays.outer, 2);
						intersect_point(prays.outer, rays.inner, 3);
					}
				}else if(this.orientation == $p.enm.orientations.hor){
					if(profile_point == "b"){
						intersect_point(prays.inner, rays.outer, 1);
						intersect_point(prays.inner, rays.inner, 4);

					}else if(profile_point == "e"){
						intersect_point(prays.inner, rays.outer, 2);
						intersect_point(prays.inner, rays.inner, 3);
					}
				}else{
					cnn_point.err = "orientation";
				}

			}else if(cnn_point.cnn.cnn_type == $p.enm.cnn_types.tcn.ah){
				// угловое к горизонтальной
				if(this.orientation == $p.enm.orientations.vert){
					if(profile_point == "b"){
						intersect_point(prays.inner, rays.outer, 1);
						intersect_point(prays.inner, rays.inner, 4);

					}else if(profile_point == "e"){
						intersect_point(prays.inner, rays.outer, 2);
						intersect_point(prays.inner, rays.inner, 3);
					}
				}else if(this.orientation == $p.enm.orientations.hor){
					if(profile_point == "b"){
						intersect_point(prays.outer, rays.outer, 1);
						intersect_point(prays.outer, rays.inner, 4);

					}else if(profile_point == "e"){
						intersect_point(prays.outer, rays.outer, 2);
						intersect_point(prays.outer, rays.inner, 3);
					}
				}else{
					cnn_point.err = "orientation";
				}
			}

			// если точка не рассчиталась - рассчитываем по умолчанию - как с пустотой
			if(profile_point == "b"){
				if(!_corns[1])
					_corns[1] = this.b.add(this.generatrix.firstCurve.getNormalAt(0, true).normalize(this.d1));
				if(!_corns[4])
					_corns[4] = this.b.add(this.generatrix.firstCurve.getNormalAt(0, true).normalize(this.d2));

			}else if(profile_point == "e"){
				if(!_corns[2])
					_corns[2] = this.e.add(this.generatrix.lastCurve.getNormalAt(1, true).normalize(this.d1));
				if(!_corns[3])
					_corns[3] = this.e.add(this.generatrix.lastCurve.getNormalAt(1, true).normalize(this.d2));
			}
			return cnn_point;
		}
	},

	/**
	 * ### Точка внутри пути
	 * Возвращает точку, расположенную гарантированно внутри профиля
	 *
	 * @property interiorPoint
	 * @for ProfileItem
	 * @type paper.Point
	 */
	interiorPoint: {
		value: function () {
			var gen = this.generatrix, igen;
			if(gen.curves.length == 1)
				igen = gen.firstCurve.getPointAt(0.5, true);
			else if (gen.curves.length == 2)
				igen = gen.firstCurve.point2;
			else
				igen = gen.curves[1].point2;
			return this.rays.inner.getNearestPoint(igen).add(this.rays.outer.getNearestPoint(igen)).divide(2)
		}
	},

	/**
	 * ### Выделяет начало или конец профиля
	 *
	 * @method select_node
	 * @for ProfileItem
	 * @param node {String} b, e - начало или конец элемента
	 */
	select_node: {
		value:  function(node){
			var gen = this.generatrix;
			this.project.deselect_all_points();
			this.data.path.selected = false;
			if(node == "b")
				gen.firstSegment.selected = true;
			else
				gen.lastSegment.selected = true;
			this.view.update();
		}
	},

	/**
	 * ### Выделяет сегмент пути профиля, ближайший к точке
	 *
	 * @method select_corn
	 * @for ProfileItem
	 * @param point {paper.Point}
	 */
	select_corn: {
		value:  function(point){

			var res = {dist: Infinity},
				dist;

			this.path.segments.forEach(function (segm) {
				dist = segm.point.getDistance(point);
				if(dist < res.dist){
					res.dist = dist;
					res.segm = segm;
				}
			});

			dist = this.b.getDistance(point);
			if(dist < res.dist){
				res.dist = dist;
				res.segm = this.generatrix.firstSegment;
			}

			dist = this.e.getDistance(point);
			if(dist < res.dist){
				res.dist = dist;
				res.segm = this.generatrix.lastSegment;
			}

			if(res.dist < consts.sticking0){
				this.project.deselectAll();
				res.segm.selected = true;
			}
		}
	},

	/**
	 * ### Угол к горизонту
	 * Рассчитывается для прямой, проходящей через узлы
	 *
	 * @property angle_hor
	 * @for ProfileItem
	 * @type Number
	 * @final
	 */
	angle_hor: {
		get : function(){
			var res = (new paper.Point(this.e.x - this.b.x, this.b.y - this.e.y)).angle.round(1);
			return res < 0 ? res + 360 : res;
		}
	},

	/**
	 * ### Длина профиля с учетом соединений
	 *
	 * @property length
	 * @for ProfileItem
	 * @type Number
	 * @final
	 */
	length: {

		get: function () {
			var gen = this.generatrix,
				sub_gen,
				ppoints = {},
				b = this.rays.b,
				e = this.rays.e,
				res;

			// находим проекции четырёх вершин на образующую
			for(var i = 1; i<=4; i++)
				ppoints[i] = gen.getNearestPoint(this.corns(i));

			// находим точки, расположенные ближе к концам образующей
			ppoints.b = ppoints[1].getDistance(gen.firstSegment.point, true) < ppoints[4].getDistance(gen.firstSegment.point, true) ? ppoints[1] : ppoints[4];
			ppoints.e = ppoints[2].getDistance(gen.lastSegment.point, true) < ppoints[3].getDistance(gen.lastSegment.point, true) ? ppoints[2] : ppoints[3];

			// получаем фрагмент образующей
			sub_gen = gen.get_subpath(ppoints.b, ppoints.e);

			res = sub_gen.length +
				(b.cnn && !b.cnn.empty() ? b.cnn.sz : 0) +
				(e.cnn && !e.cnn.empty() ? e.cnn.sz : 0);
			sub_gen.remove();

			return res;
		}
	},

	/**
	 * ### Ориентация профиля
	 * Вычисляется по гулу к горизонту.
	 * Если угол в пределах `orientation_delta`, элемент признаётся горизонтальным или вертикальным. Иначе - наклонным
	 *
	 * @property orientation
	 * @for ProfileItem
	 * @type _enm.orientations
	 * @final
	 */
	orientation: {
		get : function(){
			var angle_hor = this.angle_hor;
			if(angle_hor > 180)
				angle_hor -= 180;
			if((angle_hor > -consts.orientation_delta && angle_hor < consts.orientation_delta) ||
				(angle_hor > 180-consts.orientation_delta && angle_hor < 180+consts.orientation_delta))
				return $p.enm.orientations.hor;
			if((angle_hor > 90-consts.orientation_delta && angle_hor < 90+consts.orientation_delta) ||
				(angle_hor > 270-consts.orientation_delta && angle_hor < 270+consts.orientation_delta))
				return $p.enm.orientations.vert;
			return $p.enm.orientations.incline;
		}
	},

	/**
	 * ### Признак прямолинейности
	 * Вычисляется, как `is_linear()` {{#crossLink "BuilderElement/generatrix:property"}}образующей{{/crossLink}}
	 *
	 * @method is_linear
	 * @for ProfileItem
	 * @returns Boolean
	 */
	is_linear: {
		value : function(){
			return this.generatrix.is_linear();
		}
	},

	/**
	 * ### Выясняет, примыкает ли указанный профиль к текущему
	 * Вычисления делаются на основании близости координат концов текущего профиля образующей соседнего
	 *
	 * @method is_nearest
	 * @for ProfileItem
	 * @param p {ProfileItem}
	 * @returns Boolean
	 */
	is_nearest: {
		value : function(p){
			return (this.b.is_nearest(p.b, true) && this.e.is_nearest(p.e, true)) ||
				(this.generatrix.getNearestPoint(p.b).is_nearest(p.b) && this.generatrix.getNearestPoint(p.e).is_nearest(p.e));
		}
	},

	/**
	 * ### Выясняет, параллельны ли профили
	 * в пределах `consts.orientation_delta`
	 *
	 * @method is_collinear
	 * @for ProfileItem
	 * @param p {ProfileItem}
	 * @returns Boolean
	 */
	is_collinear: {
		value : function(p) {
			var angl = p.e.subtract(p.b).getDirectedAngle(this.e.subtract(this.b));
			if (angl < 0)
				angl += 180;
			return Math.abs(angl) < consts.orientation_delta;
		}
	},

	/**
	 * ### Опорные точки и лучи
	 *
	 * @property rays
	 * @for ProfileItem
	 * @type ProfileRays
	 * @final
	 */
	rays: {
		get : function(){
			if(!this.data._rays.inner.segments.length || !this.data._rays.outer.segments.length)
				this.data._rays.recalc();
			return this.data._rays;
		}
	},

	/**
	 * ### Доборы текущего профиля
	 *
	 * @property addls
	 * @for ProfileItem
	 * @type Array.<ProfileAddl>
	 * @final
	 */
	addls: {
		get : function(){
			return this.children.reduce(function (val, elm) {
				if(elm instanceof ProfileAddl){
					val.push(elm);
				}
				return val;
			}, []);
		}
	},

	/**
	 * ### Координаты вершин (cornx1...corny4)
	 *
	 * @method corns
	 * @for ProfileItem
	 * @param corn {String|Number} - имя или номер вершины
	 * @return {Point|Number} - координата или точка
	 */
	corns: {
		value: function(corn){

			if(typeof corn == "number")
				return this.data._corns[corn];

			else if(corn instanceof paper.Point){

				var res = {dist: Infinity, profile: this},
					dist;

				for(var i = 1; i<5; i++){
					dist = this.data._corns[i].getDistance(corn);
					if(dist < res.dist){
						res.dist = dist;
						res.point = this.data._corns[i];
						res.point_name = i;
					}
				}

				if(res.point.is_nearest(this.b)){
					res.dist = this.b.getDistance(corn);
					res.point = this.b;
					res.point_name = "b";
					
				}else if(res.point.is_nearest(this.e)){
					res.dist = this.e.getDistance(corn);
					res.point = this.e;
					res.point_name = "e";
				}

				return res;

			}else{
				var index = corn.substr(corn.length-1, 1),
					axis = corn.substr(corn.length-2, 1);
				return this.data._corns[index][axis];
			}
		}
	},

	/**
	 * ### Формирует путь сегмента профиля
	 * Пересчитывает соединения с соседями и стоит путь профиля на основании пути образующей
	 * - Сначала, вызывает {{#crossLink "ProfileItem/postcalc_cnn:method"}}postcalc_cnn(){{/crossLink}} для узлов `b` и `e`
	 * - Внутри `postcalc_cnn`, выполняется {{#crossLink "ProfileItem/cnn_point:method"}}cnn_point(){{/crossLink}} для пересчета соединений на концах профиля
	 * - Внутри `cnn_point`:
	 *    + {{#crossLink "ProfileItem/check_distance:method"}}check_distance(){{/crossLink}} - проверяет привязку, если вернулось false, `cnn_point` завершает свою работы
	 *    + цикл по всем профилям и поиск привязки
	 * - {{#crossLink "ProfileItem/postcalc_inset:method"}}postcalc_inset(){{/crossLink}} - проверяет корректность вставки, заменяет при необходимости
	 * - {{#crossLink "ProfileItem/path_points:method"}}path_points(){{/crossLink}} - рассчитывает координаты вершин пути профиля
	 *
	 * @method redraw
	 * @for ProfileItem
	 * @chainable
	 */
	redraw: {
		value: function () {

			// получаем узлы
			var bcnn = this.postcalc_cnn("b"),
				ecnn = this.postcalc_cnn("e"),
				path = this.data.path,
				gpath = this.generatrix,
				rays = this.rays,
				offset1, offset2, tpath, step;

			// уточняем вставку
			if(this.project._dp.sys.allow_open_cnn)
				this.postcalc_inset();

			// получаем соединения концов профиля и точки пересечения с соседями
			this.path_points(bcnn, "b");
			this.path_points(ecnn, "e");

			// очищаем существующий путь
			path.removeSegments();

			// TODO отказаться от повторного пересчета и задействовать клоны rays-ов
			path.add(this.corns(1));

			if(gpath.is_linear()){
				path.add(this.corns(2), this.corns(3));

			}else{

				tpath = new paper.Path({insert: false});
				offset1 = rays.outer.getNearestLocation(this.corns(1)).offset;
				offset2 = rays.outer.getNearestLocation(this.corns(2)).offset;
				step = (offset2 - offset1) / 50;
				for(var i = offset1 + step; i<offset2; i+=step)
					tpath.add(rays.outer.getPointAt(i));
				tpath.simplify(0.8);
				path.join(tpath);
				path.add(this.corns(2));

				path.add(this.corns(3));

				tpath = new paper.Path({insert: false});
				offset1 = rays.inner.getNearestLocation(this.corns(3)).offset;
				offset2 = rays.inner.getNearestLocation(this.corns(4)).offset;
				step = (offset2 - offset1) / 50;
				for(var i = offset1 + step; i<offset2; i+=step)
					tpath.add(rays.inner.getPointAt(i));
				tpath.simplify(0.8);
				path.join(tpath);

			}

			path.add(this.corns(4));
			path.closePath();
			path.reduce();

			this.children.forEach(function (elm) {
				if(elm instanceof ProfileAddl){
					elm.observer(elm.parent);
					elm.redraw();
				}
			});

			return this;
		}
	},

	/**
	 * ### Двигает узлы
	 * Обрабатывает смещение выделенных сегментов образующей профиля
	 *
	 * @method move_points
	 * @for ProfileItem
	 * @param delta {paper.Point} - куда и насколько смещать
	 * @param [all_points] {Boolean} - указывает двигать все сегменты пути, а не только выделенные
	 * @param [start_point] {paper.Point} - откуда началось движение
	 */
	move_points: {
		value:  function(delta, all_points, start_point){

			if(!delta.length)
				return;

			var changed,
				other = [],
				noti = {type: consts.move_points, profiles: [this], points: []}, noti_points;


			// если не выделено ни одного сегмента, двигаем все сегменты
			if(!all_points){
				all_points = !this.generatrix.segments.some(function (segm) {
					if (segm.selected)
						return true;
				});
			}

			this.generatrix.segments.forEach(function (segm) {

				var cnn_point, free_point;

				if (segm.selected || all_points){

					noti_points = {old: segm.point.clone(), delta: delta};

					// собственно, сдвиг узлов
					free_point = segm.point.add(delta);

					if(segm.point == this.b){
						cnn_point = this.rays.b;
						if(!cnn_point.profile_point || paper.Key.isDown('control'))
							cnn_point = this.cnn_point("b", free_point);

					}else if(segm.point == this.e){
						cnn_point = this.rays.e;
						if(!cnn_point.profile_point || paper.Key.isDown('control'))
							cnn_point = this.cnn_point("e", free_point);

					}

					if(cnn_point && cnn_point.cnn_types == $p.enm.cnn_types.acn.t && (segm.point == this.b || segm.point == this.e)){
						segm.point = cnn_point.point;

					}else{
						segm.point = free_point;
						// если соединение угловое диагональное, тянем тянем соседние узлы сразу
						if(cnn_point && !paper.Key.isDown('control')){
							if(cnn_point.profile && cnn_point.profile_point && !cnn_point.profile[cnn_point.profile_point].is_nearest(free_point)){
								other.push(cnn_point.profile_point == "b" ? cnn_point.profile.data.generatrix.firstSegment : cnn_point.profile.data.generatrix.lastSegment );
								cnn_point.profile[cnn_point.profile_point] = free_point;
								noti.profiles.push(cnn_point.profile);
							}
						}
					}

					// накапливаем точки в нотификаторе
					noti_points.new = segm.point;
					if(start_point)
						noti_points.start = start_point;
					noti.points.push(noti_points);

					changed = true;
				}

			}.bind(this));


			// информируем систему об изменениях
			if(changed){
				this.data._rays.clear();

				if(this.parent.notify)
					this.parent.notify(noti);

				var notifier = Object.getNotifier(this);
				notifier.notify({ type: 'update', name: "x1" });
				notifier.notify({ type: 'update', name: "y1" });
				notifier.notify({ type: 'update', name: "x2" });
				notifier.notify({ type: 'update', name: "y2" });
			}

			return other;
		}
	},

	/**
	 * Описание полей диалога свойств элемента
	 */
	oxml: {
		get: function () {
			var cnn_ii = this.selected_cnn_ii(),
				oxml = {
					" ": [
						{id: "info", path: "o.info", type: "ro"},
						"inset",
						"clr"
					],
					"Начало": ["x1", "y1", "cnn1"],
					"Конец": ["x2", "y2", "cnn2"]
				};
			
			if(cnn_ii)
				oxml["Примыкание"] = ["cnn3"];
			
			return oxml; 
		}
	},

	/**
	 * Выясняет, имеет ли текущий профиль соединение с `profile` в окрестности точки `point`
	 */
	has_cnn: {
		value: function (profile, point) {

			var t = this;

			while (t.parent instanceof ProfileItem)
				t = t.parent;

			while (profile.parent instanceof ProfileItem)
				profile = profile.parent;

			if(
				(t.b.is_nearest(point, true) && t.cnn_point("b").profile == profile) ||
				(t.e.is_nearest(point, true) && t.cnn_point("e").profile == profile) ||
				(profile.b.is_nearest(point, true) && profile.cnn_point("b").profile == t) ||
				(profile.e.is_nearest(point, true) && profile.cnn_point("e").profile == t)
			)
				return true;

			else
				return false;

		}
	},

	/**
	 * Вызывает одноименную функцию _scheme в контексте текущего профиля
	 */
	check_distance: {
		value: function (element, res, point, check_only) {
			return this.project.check_distance(element, this, res, point, check_only);
		}
	},

	/**
	 * Строка цвета по умолчанию для эскиза
	 */
	default_clr_str: {
		value: "FEFEFE"
	},

	/**
	 * ### Непрозрачность профиля
	 * В отличии от прототипа `opacity`, не изменяет прозрачость образующей
	 */
	opacity: {
		get: function () {
			return this.path ? this.path.opacity : 1;
		},

		set: function (v) {
			if(this.path)
				this.path.opacity = v;
		}
	}

});



/**
 * ### Профиль
 * Класс описывает поведение сегмента профиля (створка, рама, импост)<br />
 * У профиля есть координаты конца и начала, есть путь образующей - прямая или кривая линия
 *
 * @class Profile
 * @param attr {Object} - объект со свойствами создаваемого элемента см. {{#crossLink "BuilderElement"}}параметр конструктора BuilderElement{{/crossLink}}
 * @constructor
 * @extends ProfileItem
 * @menuorder 42
 * @tooltip Профиль
 *
 * @example
 *
 *     // Создаём элемент профиля на основании пути образующей
 *     // одновременно, указываем контур, которому будет принадлежать профиль, вставку и цвет
 *     new Profile({
 *       generatrix: new paper.Path({
 *         segments: [[1000,100], [0, 100]]
 *       }),
 *       proto: {
 *         parent: _contour,
 *         inset: _inset
 *         clr: _clr
 *       }
 *     });
 */
function Profile(attr){

	Profile.superclass.constructor.call(this, attr);

	if(this.parent){

		// Подключаем наблюдателя за событиями контура с именем _consts.move_points_
		this._observer = this.observer.bind(this);
		Object.observe(this.layer._noti, this._observer, [consts.move_points]);

		// Информируем контур о том, что у него появился новый ребёнок
		this.layer.on_insert_elm(this);
	}

}
Profile._extend(ProfileItem);

Profile.prototype.__define({
	

	/**
	 * Примыкающий внешний элемент - имеет смысл для сегментов створок
	 * @property nearest
	 * @type Profile
	 */
	nearest: {
		value : function(){
			var _profile = this,
				b = _profile.b,
				e = _profile.e,
				ngeneratrix, children;

			function check_nearest(){
				if(_profile.data._nearest){
					ngeneratrix = _profile.data._nearest.generatrix;
					if( ngeneratrix.getNearestPoint(b).is_nearest(b) && ngeneratrix.getNearestPoint(e).is_nearest(e)){
						_profile.data._nearest_cnn = $p.cat.cnns.elm_cnn(_profile, _profile.data._nearest, $p.enm.cnn_types.acn.ii, _profile.data._nearest_cnn);
						return true;
					}
				}
				_profile.data._nearest = null;
				_profile.data._nearest_cnn = null;
			}

			if(_profile.layer && _profile.layer.parent){
				if(!check_nearest()){
					children = _profile.layer.parent.children;
					for(var p in children){
						if((_profile.data._nearest = children[p]) instanceof Profile && check_nearest())
							return _profile.data._nearest;
						else
							_profile.data._nearest = null;
					}
				}
			}else
				_profile.data._nearest = null;

			return _profile.data._nearest;
		}
	},

	/**
	 * Расстояние от узла до опорной линии
	 * для створок и вложенных элементов зависит от ширины элементов и свойств примыкающих соединений
	 * не имеет смысла для заполнения, но нужно для рёбер заполнений
	 * @property d0
	 * @type Number
	 */
	d0: {
		get : function(){
			var res = 0, curr = this, nearest;

			while(nearest = curr.nearest()){
				res -= nearest.d2 + (curr.data._nearest_cnn ? curr.data._nearest_cnn.sz : 20);
				curr = nearest;
			}
			return res;
		}
	},

	/**
	 * Расстояние от узла до внешнего ребра элемента
	 * для рамы, обычно = 0, для импоста 1/2 ширины
	 * зависит от ширины элементов и свойств примыкающих соединений
	 * @property d1
	 * @type Number
	 */
	d1: {
		get : function(){ return -(this.d0 - this.sizeb); }
	},

	/**
	 * Расстояние от узла до внутреннего ребра элемента
	 * зависит от ширины элементов и свойств примыкающих соединений
	 * @property d2
	 * @type Number
	 */
	d2: {
		get : function(){ return this.d1 - this.width; }
	},

	/**
	 * Возвращает массив примыкающих ипостов
	 */
	joined_imposts: {

		value : function(check_only){

			var t = this,
				gen = t.generatrix,
				profiles = t.parent.profiles,
				tinner = [], touter = [], curr, pb, pe, ip;

			for(var i = 0; i<profiles.length; i++){

				curr = profiles[i];
				if(curr == t)
					continue;

				pb = curr.cnn_point("b");
				if(pb.profile == t && pb.cnn && pb.cnn.cnn_type == $p.enm.cnn_types.tcn.t){

					if(check_only)
						return check_only;

					// выясним, с какой стороны примыкающий профиль
					ip = curr.corns(1);
					if(t.rays.inner.getNearestPoint(ip).getDistance(ip, true) < t.rays.outer.getNearestPoint(ip).getDistance(ip, true))
						tinner.push({point: gen.getNearestPoint(pb.point), profile: curr});
					else
						touter.push({point: gen.getNearestPoint(pb.point), profile: curr});
				}
				pe = curr.cnn_point("e");
				if(pe.profile == t && pe.cnn && pe.cnn.cnn_type == $p.enm.cnn_types.tcn.t){

					if(check_only)
						return check_only;

					ip = curr.corns(2);
					if(t.rays.inner.getNearestPoint(ip).getDistance(ip, true) < t.rays.outer.getNearestPoint(ip).getDistance(ip, true))
						tinner.push({point: gen.getNearestPoint(pe.point), profile: curr});
					else
						touter.push({point: gen.getNearestPoint(pe.point), profile: curr});
				}

			}

			if(check_only)
				return false;
			else
				return {inner: tinner, outer: touter};
		}
	},

	/**
	 * Возвращает тип элемента (рама, створка, импост)
	 */
	elm_type: {
		get : function(){

			// если начало или конец элемента соединены с соседями по Т, значит это импост
			if(this.data._rays && (this.data._rays.b.is_tt || this.data._rays.e.is_tt))
				return $p.enm.elm_types.Импост;

			// Если вложенный контур, значит это створка
			if(this.layer.parent instanceof Contour)
				return $p.enm.elm_types.Створка;

			return $p.enm.elm_types.Рама;

		}
	},

	/**
	 * ### Соединение конца профиля
	 * С этой функции начинается пересчет и перерисовка профиля
	 * Возвращает объект соединения конца профиля
	 * - Попутно проверяет корректность соединения. Если соединение не корректно, сбрасывает его в пустое значение и обновляет ограничитель типов доступных для узла соединений
	 * - Попутно устанавливает признак `is_cut`, если в точке сходятся больше двух профилей
	 * - Не делает подмену соединения, хотя могла бы
	 * - Не делает подмену вставки, хотя могла бы
	 *
	 * @method cnn_point
	 * @for ProfileItem
	 * @param node {String} - имя узла профиля: "b" или "e"
	 * @param [point] {paper.Point} - координаты точки, в окрестности которой искать
	 * @return {CnnPoint} - объект {point, profile, cnn_types}
	 */
	cnn_point: {
		value: function(node, point){

			var res = this.rays[node];

			if(!point)
				point = this[node];


			// Если привязка не нарушена, возвращаем предыдущее значение
			if(res.profile &&
				res.profile.children.length &&
				this.check_distance(res.profile, res, point, true) === false)
				return res;

			// TODO вместо полного перебора профилей контура, реализовать анализ текущего соединения и успокоиться, если соединение корректно
			res.clear();
			if(this.parent){
				var profiles = this.parent.profiles,
					allow_open_cnn = this.project._dp.sys.allow_open_cnn,
					ares = [];

				for(var i=0; i<profiles.length; i++){
					if(this.check_distance(profiles[i], res, point, false) === false){

						// для простых систем разрывы профиля не анализируем
						if(!allow_open_cnn)
							return res;

						ares.push({
							profile_point: res.profile_point,
							profile: res.profile,
							cnn_types: res.cnn_types,
							point: res.point});
					}
				}

				if(ares.length == 1){
					res._mixin(ares[0]);


				}else if(ares.length >= 2){

					// если в точке сходятся 3 и более профиля...
					// и среди соединений нет углового диагонального, вероятно, мы находимся в разрыве - выбираем соединение с пустотой
					res.clear();
					res.is_cut = true;
				}
				ares = null;
			}

			return res;
		}
	},

	/**
	 * Положение элемента в контуре
	 */
	pos: {
		get: function () {
			var by_side = this.layer.profiles_by_side();
			if(by_side.top == this)
				return $p.enm.positions.Верх;
			if(by_side.bottom == this)
				return $p.enm.positions.Низ;
			if(by_side.left == this)
				return $p.enm.positions.Лев;
			if(by_side.right == this)
				return $p.enm.positions.Прав;
			// TODO: рассмотреть случай с выносом стоек и разрывами
			return $p.enm.positions.Центр;
		}
	},


	/**
	 * Вспомогательная функция обсервера, выполняет привязку узлов
	 */
	do_bind: {
		value: function (p, bcnn, ecnn, moved) {

			var mpoint, imposts, moved_fact;

			if(bcnn.cnn && bcnn.profile == p){
				// обрабатываем угол
				if($p.enm.cnn_types.acn.a.indexOf(bcnn.cnn.cnn_type)!=-1 ){
					if(!this.b.is_nearest(p.e)){
						if(bcnn.is_t || bcnn.cnn.cnn_type == $p.enm.cnn_types.tcn.ad){
							if(paper.Key.isDown('control')){
								console.log('control');
							}else{
								if(this.b.getDistance(p.e, true) < this.b.getDistance(p.b, true))
									this.b = p.e;
								else
									this.b = p.b;
								moved_fact = true;
							}
						} else{
							// отрываем привязанный ранее профиль
							bcnn.clear();
							this.data._rays.clear_segments();
						}
					}

				}
				// обрабатываем T
				else if($p.enm.cnn_types.acn.t.indexOf(bcnn.cnn.cnn_type)!=-1 ){
					// импосты в створках и все остальные импосты
					mpoint = (p.nearest() ? p.rays.outer : p.generatrix).getNearestPoint(this.b);
					if(!mpoint.is_nearest(this.b)){
						this.b = mpoint;
						moved_fact = true;
					}
				}

			}
			if(ecnn.cnn && ecnn.profile == p){
				// обрабатываем угол
				if($p.enm.cnn_types.acn.a.indexOf(ecnn.cnn.cnn_type)!=-1 ){
					if(!this.e.is_nearest(p.b)){
						if(ecnn.is_t || ecnn.cnn.cnn_type == $p.enm.cnn_types.tcn.ad){
							if(paper.Key.isDown('control')){
								console.log('control');
							}else{
								if(this.e.getDistance(p.b, true) < this.e.getDistance(p.e, true))
									this.e = p.b;
								else
									this.e = p.e;
								moved_fact = true;
							}
						} else{
							// отрываем привязанный ранее профиль
							ecnn.clear();
							this.data._rays.clear_segments();
						}
					}
				}
				// обрабатываем T
				else if($p.enm.cnn_types.acn.t.indexOf(ecnn.cnn.cnn_type)!=-1 ){
					// импосты в створках и все остальные импосты
					mpoint = (p.nearest() ? p.rays.outer : p.generatrix).getNearestPoint(this.e);
					if(!mpoint.is_nearest(this.e)){
						this.e = mpoint;
						moved_fact = true;
					}
				}

			}

			// если мы в обсервере и есть T и в массиве обработанных есть примыкающий T - пересчитываем
			if(moved && moved_fact){
				imposts = this.joined_imposts();
				imposts = imposts.inner.concat(imposts.outer);
				for(var i in imposts){
					if(moved.profiles.indexOf(imposts[i]) == -1){
						imposts[i].profile.observer(this);
					}
				}
			}
		}
	}

});

Editor.Profile = Profile;

/**
 * Объект, описывающий геометрию соединения
 * @class CnnPoint
 * @constructor
 */
function CnnPoint(parent, node){
		
	//  массив ошибок соединения
	this._err = [];

	// строка в таблице соединений
	this._row = parent.project.connections.cnns.find({elm1: parent.elm, node1: node});
		
	// примыкающий профиль
	this._profile;

		
	if(this._row){

		/**
		 * Текущее соединение - объект справочника соединения
		 * @type _cat.cnns
		 */
		this.cnn = this._row.cnn;

		/**
		 * Массив допустимых типов соединений
		 * По умолчанию - соединение с пустотой
		 * @type Array
		 */
		if($p.enm.cnn_types.acn.a.indexOf(this.cnn.cnn_type) != -1)
			this.cnn_types = $p.enm.cnn_types.acn.a;

		else if($p.enm.cnn_types.acn.t.indexOf(this.cnn.cnn_type) != -1)
			this.cnn_types = $p.enm.cnn_types.acn.t;

		else
			this.cnn_types = $p.enm.cnn_types.acn.i;

	}else{

		this.cnn = null;
		this.cnn_types = $p.enm.cnn_types.acn.i;
	}

	/**
	 * Расстояние до ближайшего профиля
	 * @type Number
	 */
	this.distance = Infinity;

	this.point = null;

	this.profile_point = "";


	this.__define({

		/**
		 * Профиль, которому принадлежит точка соединения
		 * @type Profile
		 */
		parent: {
			value: parent,
			writable: false
		}
	});


}
CnnPoint.prototype.__define({

	/**
	 * Проверяет, является ли соединение в точке Т-образным.
	 * L для примыкающих рассматривается, как Т
	 */
	is_t: {
		get: function () {

			// если это угол, то точно не T
			if(!this.cnn || this.cnn.cnn_type == $p.enm.cnn_types.УгловоеДиагональное)
				return false;

			// если это Ʇ, или † то без вариантов T
			if(this.cnn.cnn_type == $p.enm.cnn_types.ТОбразное)
				return true;

			// если это Ꞁ или └─, то может быть T в разрыв - проверяем
			if(this.cnn.cnn_type == $p.enm.cnn_types.УгловоеКВертикальной && this.parent.orientation != $p.enm.orientations.vert)
				return true;

			if(this.cnn.cnn_type == $p.enm.cnn_types.УгловоеКГоризонтальной && this.parent.orientation != $p.enm.orientations.hor)
				return true;

			return false;
		}
	},

	/**
	 * Строгий вариант свойства is_t: Ꞁ и └ не рассматриваются, как T
	 */
	is_tt: {

		get: function () {

			// если это угол, то точно не T
			return !(this.is_i || this.profile_point == "b" || this.profile_point == "e" || this.profile == this.parent);

		}
	},

	/**
	 * Проверяет, является ли соединение в точке L-образным
	 * Соединения Т всегда L-образные
	 */
	is_l: {
		get: function () {
			return this.is_t ||
				!!(this.cnn && (this.cnn.cnn_type == $p.enm.cnn_types.УгловоеКВертикальной ||
					this.cnn.cnn_type == $p.enm.cnn_types.УгловоеКГоризонтальной));
		}
	},

	/**
	 * Проверяет, является ли соединение в точке соединением с пустотой
	 */
	is_i: {
		get: function () {
			return !this.profile && !this.is_cut;
		}
	},

	clear: {
		value: function () {
			if(this.profile_point)
				delete this.profile_point;
			if(this.is_cut)
				delete this.is_cut;
			this.profile = null;
			this.err = null;
			this.distance = Infinity;
			this.cnn_types = $p.enm.cnn_types.acn.i;
			if(this.cnn && this.cnn.cnn_type != $p.enm.cnn_types.tcn.i)
				this.cnn = null;
		}
	},

	/**
	 * Массив ошибок соединения
	 * @type Array
	 */
	err: {
		get: function () {
			return this._err;
		},
		set: function (v) {
			if(!v)
				this._err.length = 0;
			else if(this._err.indexOf(v) == -1)
				this._err.push(v);
		}
	},

	/**
	 * Профиль, с которым пересекается наш элемент в точке соединения
	 * @property profile
	 * @type Profile
	 */
	profile: {
		get: function () {
			if(this._profile === undefined && this._row && this._row.elm2){
				this._profile = this.parent.layer.getItem({elm: this._row.elm2});
				delete this._row;
			}
			return this._profile;
		},
		set: function (v) {
			this._profile = v;
		}
	}
});

function ProfileRays(parent){

	this.parent = parent;
	parent = null;

	this.b = new CnnPoint(this.parent, "b");
	this.e = new CnnPoint(this.parent, "e");
	this.inner = new paper.Path({ insert: false });
	this.outer = new paper.Path({ insert: false });

}
ProfileRays.prototype.__define({

	clear_segments: {
		value: function () {
			if(this.inner.segments.length)
				this.inner.removeSegments();
			if(this.outer.segments.length)
				this.outer.removeSegments();
		}
	},

	clear: {
		value: function(with_cnn){
			this.clear_segments();
			if(with_cnn){
				this.b.clear();
				this.e.clear();
			}
		}
	},

	recalc: {
		value: function(){

			var path = this.parent.generatrix,
				len = path.length;

			this.clear_segments();

			if(!len)
				return;

			var d1 = this.parent.d1, d2 = this.parent.d2,
				ds = 3 * this.parent.width, step = len * 0.02,
				point_b, tangent_b, normal_b,
				point_e, tangent_e, normal_e;


			// первая точка эквидистанты. аппроксимируется касательной на участке (from < начала пути)
			point_b = path.firstSegment.point;
			tangent_b = path.getTangentAt(0);
			normal_b = path.getNormalAt(0);

			// добавляем первые точки путей
			this.outer.add(point_b.add(normal_b.multiply(d1)).add(tangent_b.multiply(-ds)));
			this.inner.add(point_b.add(normal_b.multiply(d2)).add(tangent_b.multiply(-ds)));
			point_e = path.lastSegment.point;

			// для прямого пути, чуть наклоняем нормаль
			if(path.is_linear()){

				this.outer.add(point_e.add(normal_b.multiply(d1)).add(tangent_b.multiply(ds)));
				this.inner.add(point_e.add(normal_b.multiply(d2)).add(tangent_b.multiply(ds)));

			}else{

				this.outer.add(point_b.add(normal_b.multiply(d1)));
				this.inner.add(point_b.add(normal_b.multiply(d2)));

				for(var i = step; i<=len; i+=step) {
					point_b = path.getPointAt(i);
					if(!point_b)
						continue;
					normal_b = path.getNormalAt(i);
					this.outer.add(point_b.add(normal_b.normalize(d1)));
					this.inner.add(point_b.add(normal_b.normalize(d2)));
				}

				normal_e = path.getNormalAt(len);
				this.outer.add(point_e.add(normal_e.multiply(d1)));
				this.inner.add(point_e.add(normal_e.multiply(d2)));

				tangent_e = path.getTangentAt(len);
				this.outer.add(point_e.add(normal_e.multiply(d1)).add(tangent_e.multiply(ds)));
				this.inner.add(point_e.add(normal_e.multiply(d2)).add(tangent_e.multiply(ds)));

				this.outer.simplify(0.8);
				this.inner.simplify(0.8);
			}

			this.inner.reverse();
		}
	}
});




/**
 *
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2016
 * Created 16.05.2016
 * 
 * @module geometry
 * @submodule profile_addl
 */


/**
 * ### Дополнительный профиль
 * Класс описывает поведение доборного и расширительного профилей
 *
 * - похож в поведении на сегмент створки, но расположен в том же слое, что и ведущий элемент
 * - у дополнительного профиля есть координаты конца и начала, такие же, как у Profile
 * - в случае внутреннего добора, могут быть Т - соединения, как у импоста
 * - в случае внешнего, концы соединяются с пустотой
 * - имеет одно ii примыкающее соединение
 * - есть путь образующей - прямая или кривая линия, такая же, как у створки
 * - длина дополнительного профиля может отличаться от длины ведущего элемента
 *
 * @class ProfileAddl
 * @param attr {Object} - объект со свойствами создаваемого элемента см. {{#crossLink "BuilderElement"}}параметр конструктора BuilderElement{{/crossLink}}
 * @constructor
 * @extends ProfileItem
 * @menuorder 43
 * @tooltip Дополнительный профиль
 */
function ProfileAddl(attr){

	ProfileAddl.superclass.constructor.call(this, attr);

	this.data.generatrix.strokeWidth = 0;

	if(!attr.side && this._row.parent < 0)
		attr.side = "outer";
	
	this.data.side = attr.side || "inner";

	if(!this._row.parent){
		this._row.parent = this.parent.elm;
		if(this.outer)
			this._row.parent = -this._row.parent;
	}
}
ProfileAddl._extend(ProfileItem);


ProfileAddl.prototype.__define({

	/**
	 * Примыкающий внешний элемент - имеет смысл для сегментов створок
	 * @property nearest
	 * @type Profile
	 */
	nearest: {
		value : function(){
			this.data._nearest_cnn = $p.cat.cnns.elm_cnn(this, this.parent, $p.enm.cnn_types.acn.ii, this.data._nearest_cnn);
			return this.parent;
		}
	},

	/**
	 * Расстояние от узла до опорной линии
	 * для створок и вложенных элементов зависит от ширины элементов и свойств примыкающих соединений
	 * не имеет смысла для заполнения, но нужно для рёбер заполнений
	 * @property d0
	 * @type Number
	 */
	d0: {
		get : function(){
			this.nearest();
			return this.data._nearest_cnn ? -this.data._nearest_cnn.sz : 0;
		}
	},

	/**
	 * Расстояние от узла до внешнего ребра элемента
	 * для рамы, обычно = 0, для импоста 1/2 ширины
	 * зависит от ширины элементов и свойств примыкающих соединений
	 * @property d1
	 * @type Number
	 */
	d1: {
		get : function(){ return -(this.d0 - this.sizeb); }
	},

	/**
	 * Расстояние от узла до внутреннего ребра элемента
	 * зависит от ширины элементов и свойств примыкающих соединений
	 * @property d2
	 * @type Number
	 */
	d2: {
		get : function(){ return this.d1 - this.width; }
	},

	/**
	 * Возвращает истина, если соединение с наружной стороны
	 */
	outer: {
		get: function () {
			return this.data.side == "outer";
		}	
	},

	/**
	 * Возвращает тип элемента (Добор)
	 */
	elm_type: {
		get : function(){

			return $p.enm.elm_types.Добор;

		}
	},

	/**
	 * С этой функции начинается пересчет и перерисовка сегмента добора
	 * Возвращает объект соединения конца профиля
	 * - Попутно проверяет корректность соединения. Если соединение не корректно, сбрасывает его в пустое значение и обновляет ограничитель типов доступных для узла соединений
	 * - Не делает подмену соединения, хотя могла бы
	 * - Не делает подмену вставки, хотя могла бы
	 *
	 * @method cnn_point
	 * @for ProfileAddl
	 * @param node {String} - имя узла профиля: "b" или "e"
	 * @param [point] {paper.Point} - координаты точки, в окрестности которой искать
	 * @return {CnnPoint} - объект {point, profile, cnn_types}
	 */
	cnn_point: {
		value: function(node, point){

			var res = this.rays[node],

				check_distance = function(elm, with_addl) {

					if(elm == this || elm == this.parent)
						return;

					var gp = elm.generatrix.getNearestPoint(point), distance;

					if(gp && (distance = gp.getDistance(point)) < consts.sticking){
						if(distance <= res.distance){
							res.point = gp;
							res.distance = distance;
							res.profile = elm;
						}
					}

					// if(elm.d0 != 0 && element.rays.outer){
					// 	// для вложенных створок учтём смещение
					// 	res.point = element.rays.outer.getNearestPoint(point);
					// 	res.distance = 0;
					// }else{
					// 	res.point = gp;
					// 	res.distance = distance;
					// }

					if(with_addl)
						elm.getItems({class: ProfileAddl}).forEach(function (addl) {
							check_distance(addl, with_addl);
						});

				}.bind(this);

			if(!point)
				point = this[node];


			// Если привязка не нарушена, возвращаем предыдущее значение
			if(res.profile && res.profile.children.length){

				check_distance(res.profile);

				if(res.distance < consts.sticking)
					return res;
			}


			// TODO вместо полного перебора профилей контура, реализовать анализ текущего соединения и успокоиться, если соединение корректно
			res.clear();
			res.cnn_types = $p.enm.cnn_types.acn.t;

			this.layer.profiles.forEach(function (addl) {
				check_distance(addl, true);
			});


			return res;

		}
	},

	/**
	 * Рассчитывает точки пути на пересечении текущего и указанного профилей
	 * @method path_points
	 * @param cnn_point {CnnPoint}
	 */
	path_points: {
		value: function(cnn_point, profile_point){

			var _profile = this,
				_corns = this.data._corns,
				rays = this.rays,
				prays,  normal;

			if(!this.generatrix.curves.length)
				return cnn_point;

			// ищет точку пересечения открытых путей
			// если указан индекс, заполняет точку в массиве _corns. иначе - возвращает расстояние от узла до пересечения
			function intersect_point(path1, path2, index){
				var intersections = path1.getIntersections(path2),
					delta = Infinity, tdelta, point, tpoint;

				if(intersections.length == 1)
					if(index)
						_corns[index] = intersections[0].point;
					else
						return intersections[0].point.getDistance(cnn_point.point, true);

				else if(intersections.length > 1){
					intersections.forEach(function(o){
						tdelta = o.point.getDistance(cnn_point.point, true);
						if(tdelta < delta){
							delta = tdelta;
							point = o.point;
						}
					});
					if(index)
						_corns[index] = point;
					else
						return delta;
				}
			}

			// Определяем сторону примыкающего
			function detect_side(){

				var interior = _profile.generatrix.getPointAt(0.5, true);

				return prays.inner.getNearestPoint(interior).getDistance(interior, true) < 
						prays.outer.getNearestPoint(interior).getDistance(interior, true) ? 1 : -1;

			}

			// если пересечение в узлах, используем лучи профиля
			prays = cnn_point.profile.rays;

			// добор всегда Т. сначала определяем, изнутри или снаружи находится наш профиль
			if(!cnn_point.profile.path.segments.length)
				cnn_point.profile.redraw();

			if(profile_point == "b"){
				// в зависимости от стороны соединения
				if(detect_side() < 0){
					intersect_point(prays.outer, rays.outer, 1);
					intersect_point(prays.outer, rays.inner, 4);

				}else{
					intersect_point(prays.inner, rays.outer, 1);
					intersect_point(prays.inner, rays.inner, 4);

				}

			}else if(profile_point == "e"){
				// в зависимости от стороны соединения
				if(detect_side() < 0){
					intersect_point(prays.outer, rays.outer, 2);
					intersect_point(prays.outer, rays.inner, 3);

				}else{
					intersect_point(prays.inner, rays.outer, 2);
					intersect_point(prays.inner, rays.inner, 3);

				}
			}

			// если точка не рассчиталась - рассчитываем по умолчанию - как с пустотой
			if(profile_point == "b"){
				if(!_corns[1])
					_corns[1] = this.b.add(this.generatrix.firstCurve.getNormalAt(0, true).normalize(this.d1));
				if(!_corns[4])
					_corns[4] = this.b.add(this.generatrix.firstCurve.getNormalAt(0, true).normalize(this.d2));

			}else if(profile_point == "e"){
				if(!_corns[2])
					_corns[2] = this.e.add(this.generatrix.lastCurve.getNormalAt(1, true).normalize(this.d1));
				if(!_corns[3])
					_corns[3] = this.e.add(this.generatrix.lastCurve.getNormalAt(1, true).normalize(this.d2));
			}
			
			return cnn_point;
		}
	},

	/**
	 * Вспомогательная функция обсервера, выполняет привязку узлов добора
	 */
	do_bind: {
		value: function (p, bcnn, ecnn, moved) {

			var imposts, moved_fact,

				bind_node = function (node, cnn) {

					if(!cnn.profile)
						return;
					
					var gen = this.outer ? this.parent.rays.outer : this.parent.rays.inner;
						mpoint = cnn.profile.generatrix.intersect_point(gen, cnn.point, "nearest");
					if(!mpoint.is_nearest(this[node])){
						this[node] = mpoint;
						moved_fact = true;
					}

				}.bind(this);
			
			// при смещениях родителя, даигаем образующую
			if(this.parent == p){

				bind_node("b", bcnn);
				bind_node("e", ecnn);

			}

			if(bcnn.cnn && bcnn.profile == p){

				bind_node("b", bcnn);

			}
			if(ecnn.cnn && ecnn.profile == p){

				bind_node("e", ecnn);

			}

			// если мы в обсервере и есть T и в массиве обработанных есть примыкающий T - пересчитываем
			if(moved && moved_fact){
				// imposts = this.joined_imposts();
				// imposts = imposts.inner.concat(imposts.outer);
				// for(var i in imposts){
				// 	if(moved.profiles.indexOf(imposts[i]) == -1){
				// 		imposts[i].profile.observer(this);
				// 	}
				// }
			}
		}
	},

	glass_segment: {
		value: function () {
			
		}
	}

});

/**
 *
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2016<br />
 * Created 16.05.2016
 * 
 * @author	Evgeniy Malyarov
 * @module geometry
 * @submodule profile_addl
 */


/**
 * ### Соединительный профиль
 * Класс описывает поведение соединительного профиля
 *
 * - у соединительного профиля есть координаты конца и начала, такие же, как у Profile
 * - концы соединяются с пустотой
 * - имеет как минимум одно ii примыкающее соединение
 * - есть путь образующей - прямая или кривая линия, такая же, как у Profile
 * - слвиг и искривление пути передаются примыкающим профилям
 * - соединительный профиль живёт в слое одного из рамных контуров изделия, но может оказывать влияние на соединёные с ним контуры
 * - длина соединительного профиля может отличаться от длин профилей, к которым он примыкает
 *
 * @class ProfileConnective
 * @param attr {Object} - объект со свойствами создаваемого элемента см. {{#crossLink "BuilderElement"}}параметр конструктора BuilderElement{{/crossLink}}
 * @constructor
 * @extends ProfileItem
 */
function ProfileConnective(attr){

	ProfileConnective.superclass.constructor.call(this, attr);

}
ProfileConnective._extend(ProfileItem);


ProfileConnective.prototype.__define({

	/**
	 * Вычисляемые поля в таблице координат
	 * @method save_coordinates
	 * @for ProfileConnective
	 */
	save_coordinates: {
		value: function () {

			if(!this.data.generatrix)
				return;

			var _row = this._row,

				cnns = this.project.connections.cnns,
				b = this.rays.b,
				e = this.rays.e,

				row_b = cnns.add({
					elm1: _row.elm,
					node1: "b",
					cnn: b.cnn ? b.cnn.ref : "",
					aperture_len: this.corns(1).getDistance(this.corns(4))
				}),
				row_e = cnns.add({
					elm1: _row.elm,
					node1: "e",
					cnn: e.cnn ? e.cnn.ref : "",
					aperture_len: this.corns(2).getDistance(this.corns(3))
				}),

				gen = this.generatrix;

			_row.x1 = this.x1;
			_row.y1 = this.y1;
			_row.x2 = this.x2;
			_row.y2 = this.y2;
			_row.path_data = gen.pathData;
			_row.nom = this.nom;
			_row.parent = this.parent.elm;


			// добавляем припуски соединений
			_row.len = this.length;

			// сохраняем информацию о соединениях
			if(b.profile){
				row_b.elm2 = b.profile.elm;
				if(b.profile instanceof Filling)
					row_b.node2 = "t";
				else if(b.profile.e.is_nearest(b.point))
					row_b.node2 = "e";
				else if(b.profile.b.is_nearest(b.point))
					row_b.node2 = "b";
				else
					row_b.node2 = "t";
			}
			if(e.profile){
				row_e.elm2 = e.profile.elm;
				if(e.profile instanceof Filling)
					row_e.node2 = "t";
				else if(e.profile.b.is_nearest(e.point))
					row_e.node2 = "b";
				else if(e.profile.e.is_nearest(e.point))
					row_e.node2 = "b";
				else
					row_e.node2 = "t";
			}

			// получаем углы между элементами и к горизонту
			_row.angle_hor = this.angle_hor;

			_row.alp1 = Math.round((this.corns(4).subtract(this.corns(1)).angle - gen.getTangentAt(0).angle) * 10) / 10;
			if(_row.alp1 < 0)
				_row.alp1 = _row.alp1 + 360;

			_row.alp2 = Math.round((gen.getTangentAt(gen.length).angle - this.corns(2).subtract(this.corns(3)).angle) * 10) / 10;
			if(_row.alp2 < 0)
				_row.alp2 = _row.alp2 + 360;

			// устанавливаем тип элемента
			_row.elm_type = this.elm_type;

		}
	},

	/**
	 * Расстояние от узла до опорной линии, для раскладок == 0
	 * @property d0
	 * @type Number
	 */
	d0: {
		get : function(){
			return 0;
		}
	},

	/**
	 * Расстояние от узла до внешнего ребра элемента
	 * для рамы, обычно = 0, для импоста 1/2 ширины
	 * зависит от ширины элементов и свойств примыкающих соединений
	 * @property d1
	 * @type Number
	 */
	d1: {
		get : function(){ return this.sizeb; }
	},

	/**
	 * Расстояние от узла до внутреннего ребра элемента
	 * зависит от ширины элементов и свойств примыкающих соединений
	 * @property d2
	 * @type Number
	 */
	d2: {
		get : function(){ return this.d1 - this.width; }
	},

	/**
	 * Возвращает тип элемента (соединитель)
	 */
	elm_type: {
		get : function(){

			return $p.enm.elm_types.Соединитель;

		}
	},

	/**
	 * С этой функции начинается пересчет и перерисовка соединительного профиля
	 * т.к. концы соединителя висят в пустоте и не связаны с другими профилями, возвращаем голый cnn_point
	 *
	 * @method cnn_point
	 * @for ProfileConnective
	 * @param node {String} - имя узла профиля: "b" или "e"
	 * @return {CnnPoint} - объект {point, profile, cnn_types}
	 */
	cnn_point: {
		value: function(node){

			return this.rays[node];

		}
	}
	
});

/**
 * ### Раскладка
 * &copy; http://www.oknosoft.ru 2014-2015<br />
 * Created 16.05.2016
 * 
 * @module geometry
 * @submodule profile_onlay
 * 
 */

/**
 * ### Раскладка
 * Класс описывает поведение элемента раскладки
 *
 * - у раскладки есть координаты конца и начала
 * - есть путь образующей - прямая или кривая линия, такая же, как у {{#crossLink "Profile"}}{{/crossLink}}
 * - владелец типа {{#crossLink "Filling"}}{{/crossLink}}
 * - концы могут соединяться не только с пустотой или другими раскладками, но и с рёбрами заполнения
 *
 * @class Onlay
 * @param attr {Object} - объект со свойствами создаваемого элемента см. {{#crossLink "BuilderElement"}}параметр конструктора BuilderElement{{/crossLink}}
 * @constructor
 * @extends ProfileItem
 * @menuorder 44
 * @tooltip Раскладка
 */
function Onlay(attr){

	Onlay.superclass.constructor.call(this, attr);

}
Onlay._extend(ProfileItem);


Onlay.prototype.__define({

	/**
	 * Вычисляемые поля в таблице координат
	 * @method save_coordinates
	 * @for Onlay
	 */
	save_coordinates: {
		value: function () {

			if(!this.data.generatrix)
				return;

			var _row = this._row,

				cnns = this.project.connections.cnns,
				b = this.rays.b,
				e = this.rays.e,

				row_b = cnns.add({
					elm1: _row.elm,
					node1: "b",
					cnn: b.cnn ? b.cnn.ref : "",
					aperture_len: this.corns(1).getDistance(this.corns(4))
				}),
				row_e = cnns.add({
					elm1: _row.elm,
					node1: "e",
					cnn: e.cnn ? e.cnn.ref : "",
					aperture_len: this.corns(2).getDistance(this.corns(3))
				}),

				gen = this.generatrix;

			_row.x1 = this.x1;
			_row.y1 = this.y1;
			_row.x2 = this.x2;
			_row.y2 = this.y2;
			_row.path_data = gen.pathData;
			_row.nom = this.nom;
			_row.parent = this.parent.elm;


			// добавляем припуски соединений
			_row.len = this.length;

			// сохраняем информацию о соединениях
			if(b.profile){
				row_b.elm2 = b.profile.elm;
				if(b.profile instanceof Filling)
					row_b.node2 = "t";
				else if(b.profile.e.is_nearest(b.point))
					row_b.node2 = "e";
				else if(b.profile.b.is_nearest(b.point))
					row_b.node2 = "b";
				else
					row_b.node2 = "t";
			}
			if(e.profile){
				row_e.elm2 = e.profile.elm;
				if(e.profile instanceof Filling)
					row_e.node2 = "t";
				else if(e.profile.b.is_nearest(e.point))
					row_e.node2 = "b";
				else if(e.profile.e.is_nearest(e.point))
					row_e.node2 = "b";
				else
					row_e.node2 = "t";
			}

			// получаем углы между элементами и к горизонту
			_row.angle_hor = this.angle_hor;

			_row.alp1 = Math.round((this.corns(4).subtract(this.corns(1)).angle - gen.getTangentAt(0).angle) * 10) / 10;
			if(_row.alp1 < 0)
				_row.alp1 = _row.alp1 + 360;

			_row.alp2 = Math.round((gen.getTangentAt(gen.length).angle - this.corns(2).subtract(this.corns(3)).angle) * 10) / 10;
			if(_row.alp2 < 0)
				_row.alp2 = _row.alp2 + 360;

			// устанавливаем тип элемента
			_row.elm_type = this.elm_type;

		}
	},

	/**
	 * Расстояние от узла до опорной линии, для раскладок == 0
	 * @property d0
	 * @type Number
	 */
	d0: {
		get : function(){
			return 0;
		}
	},

	/**
	 * Расстояние от узла до внешнего ребра элемента
	 * для рамы, обычно = 0, для импоста 1/2 ширины
	 * зависит от ширины элементов и свойств примыкающих соединений
	 * @property d1
	 * @type Number
	 */
	d1: {
		get : function(){ return this.sizeb; }
	},

	/**
	 * Расстояние от узла до внутреннего ребра элемента
	 * зависит от ширины элементов и свойств примыкающих соединений
	 * @property d2
	 * @type Number
	 */
	d2: {
		get : function(){ return this.d1 - this.width; }
	},

	/**
	 * Возвращает тип элемента (раскладка)
	 */
	elm_type: {
		get : function(){

			return $p.enm.elm_types.Раскладка;

		}
	},

	/**
	 * С этой функции начинается пересчет и перерисовка сегмента раскладки
	 * Возвращает объект соединения конца профиля
	 * - Попутно проверяет корректность соединения. Если соединение не корректно, сбрасывает его в пустое значение и обновляет ограничитель типов доступных для узла соединений
	 * - Не делает подмену соединения, хотя могла бы
	 * - Не делает подмену вставки, хотя могла бы
	 *
	 * @method cnn_point
	 * @for Onlay
	 * @param node {String} - имя узла профиля: "b" или "e"
	 * @param [point] {paper.Point} - координаты точки, в окрестности которой искать
	 * @return {CnnPoint} - объект {point, profile, cnn_types}
	 */
	cnn_point: {
		value: function(node, point){

			var res = this.rays[node];

			if(!point)
				point = this[node];


			// Если привязка не нарушена, возвращаем предыдущее значение
			if(res.profile && res.profile.children.length){

				if(res.profile instanceof Filling){
					var np = res.profile.path.getNearestPoint(point),
						distance = np.getDistance(point);

					if(distance < consts.sticking_l)
						return res;

				}else{
					if(this.check_distance(res.profile, res, point, true) === false)
						return res;
				}
			}


			// TODO вместо полного перебора профилей контура, реализовать анализ текущего соединения и успокоиться, если соединение корректно
			res.clear();
			if(this.parent){

				var res_bind = this.bind_node(point);
				if(res_bind.binded){
					res._mixin(res_bind, ["point","profile","cnn_types","profile_point"]);
				}
			}

			return res;

		}
	},

	/**
	 * Пытается привязать точку к рёбрам и раскладкам
	 * @param point {paper.Point}
	 * @param glasses {Array.<Filling>}
	 * @return {Object}
	 */
	bind_node: {

		value: function (point, glasses) {

			if(!glasses)
				glasses = [this.parent];

			var res = {distance: Infinity, is_l: true};

			// сначала, к образующим заполнений
			glasses.some(function (glass) {
				var np = glass.path.getNearestPoint(point),
					distance = np.getDistance(point);

				if(distance < res.distance){
					res.distance = distance;
					res.point = np;
					res.profile = glass;
					res.cnn_types = $p.enm.cnn_types.acn.t;
				}

				if(distance < consts.sticking_l){
					res.binded = true;
					return true;
				}

				// затем, если не привязалось - к сегментам раскладок текущего заполнения
				glass.onlays.some(function (elm) {
					if (elm.project.check_distance(elm, null, res, point, "node_generatrix") === false ){
						return true;
					}
				});

			});

			if(!res.binded && res.point && res.distance < consts.sticking){
				res.binded = true;
			}

			return res;
		}
	}

});

/**
 *
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2016<br />
 * Created 24.07.2015
 *
 * @module geometry
 * @submodule scheme
 */

/**
 * ### Изделие
 * - Расширение [paper.Project](http://paperjs.org/reference/project/)
 * - Стандартные слои (layers) - это контуры изделия, в них живут элементы
 * - Размерные линии, фурнитуру и визуализацию располагаем в отдельных слоях
 *
 * @class Scheme
 * @constructor
 * @extends paper.Project
 * @param _canvas {HTMLCanvasElement} - канвас, в котором будет размещено изделие
 * @menuorder 20
 * @tooltip Изделие
 */
function Scheme(_canvas){

	// создаём объект проекта paperjs
	Scheme.superclass.constructor.call(this, _canvas);

	var _scheme = paper.project = this,
		_data = _scheme.data = {
			_bounds: null,
			_calc_order_row: null,
			_update_timer: 0
		},
		_changes = [],

		// наблюдатель за изменениями свойств изделия
		_dp_observer = function (changes) {

			if(_data._loading || _data._snapshot)
				return;

			var evented,
				scheme_changed_names = ["clr","sys"],
				row_changed_names = ["quantity","discount_percent","discount_percent_internal"];

			changes.forEach(function(change){

				if(scheme_changed_names.indexOf(change.name) != -1){

					if(change.name == "clr"){
						_scheme.ox.clr = change.object.clr;
						_scheme.getItems({class: ProfileItem}).forEach(function (p) {
							if(!(p instanceof Onlay))
								p.clr = change.object.clr;
						})
					}

					if(change.name == "sys" && !change.object.sys.empty()){

						change.object.sys.refill_prm(_scheme.ox);

						// обновляем свойства изделия
						Object.getNotifier(change.object).notify({
							type: 'rows',
							tabular: 'extra_fields'
						});

						// обновляем свойства створки
						if(_scheme.activeLayer)
							Object.getNotifier(_scheme.activeLayer).notify({
								type: 'rows',
								tabular: 'params'
							});

						// информируем контуры о смене системы, чтобы пересчитать материал профилей и заполнений
						_scheme.contours.forEach(function (l) {
							l.on_sys_changed();
						});


						if(change.object.sys != $p.wsql.get_user_param("editor_last_sys"))
							$p.wsql.set_user_param("editor_last_sys", change.object.sys.ref);

						if(_scheme.ox.clr.empty())
							_scheme.ox.clr = change.object.sys.default_clr;

						_scheme.register_change(true);
					}

					if(!evented){
						// информируем мир об изменениях
						$p.eve.callEvent("scheme_changed", [_scheme]);
						evented = true;
					}

				}else if(row_changed_names.indexOf(change.name) != -1){

					_data._calc_order_row[change.name] = change.object[change.name];

					_scheme.register_change(true);

				}

			});
		},

		// наблюдатель за изменениями параметров створки
		_papam_observer = function (changes) {

			if(_data._loading || _data._snapshot)
				return;

			changes.some(function(change){
				if(change.tabular == "params"){
					_scheme.register_change();
					return true;
				}
			});
		};



	// Определяем свойства и методы изделия
	this.__define({

		/**
		 * За этим полем будут "следить" элементы контура и пересчитывать - перерисовывать себя при изменениях соседей
		 */
		_noti: {
			value: {}
		},

		/**
		 * Формирует оповещение для тех, кто следит за this._noti
		 * @param obj
		 */
		notify: {
			value: 	function (obj) {
				Object.getNotifier(this._noti).notify(obj);
			}
		},

		/**
		 * Объект обработки с табличными частями
		 */
		_dp: {
			value: $p.dp.buyers_order.create()
		},

		/**
		 * ХарактеристикаОбъект текущего изделия
		 * @property ox
		 * @type _cat.characteristics
		 */
		ox: {
			get: function () {
				return this._dp.characteristic;
			},
			set: function (v) {


				var _dp = this._dp,
					setted;

				// пытаемся отключить обсервер от табчасти
				Object.unobserve(_dp.characteristic, _papam_observer);

				// устанавливаем в _dp характеристику
				_dp.characteristic = v;

				var ox = _dp.characteristic;

				_dp.len = ox.x;
				_dp.height = ox.y;
				_dp.s = ox.s;

				// устанавливаем строку заказа
				_scheme.data._calc_order_row = ox.calc_order_row;

				// устанавливаем в _dp свойства строки заказа
				if(_scheme.data._calc_order_row){
					"quantity,price_internal,discount_percent_internal,discount_percent,price,amount,note".split(",").forEach(function (fld) {
						_dp[fld] = _scheme.data._calc_order_row[fld];
					});
				}else{
					// TODO: установить режим только просмотр, если не найдена строка заказа
				}


				// устанавливаем в _dp систему профилей
				if(ox.empty())
					_dp.sys = "";

				else if(ox.owner.empty()){

					// для пустой номенклатуры, ставим предыдущую выбранную систему
					_dp.sys = $p.wsql.get_user_param("editor_last_sys");
					setted = !_dp.sys.empty();

				}else if(_dp.sys.empty()){

					// ищем первую подходящую систему
					$p.cat.production_params.find_rows({is_folder: false}, function(o){

						if(setted)
							return false;

						o.production.find_rows({nom: ox.owner}, function () {
							_dp.sys = o;
							setted = true;
							return false;
						});

					});
				}

				// пересчитываем параметры изделия при установке системы
				if(setted){
					_dp.sys.refill_prm(ox);

				};

				// устанавливаем в _dp цвет по умолчанию
				if(_dp.clr.empty())
					_dp.clr = _dp.sys.default_clr;

				// оповещаем о новых слоях и свойствах изделия
				Object.getNotifier(_scheme._noti).notify({
					type: 'rows',
					tabular: 'constructions'
				});
				Object.getNotifier(_dp).notify({
					type: 'rows',
					tabular: 'extra_fields'
				});

				// начинаем следить за ox, чтобы обработать изменения параметров фурнитуры
				Object.observe(ox, _papam_observer, ["row", "rows"]);

			}
		},

		/**
		 * Строка табчасти продукция текущего заказа, соответствующая редактируемому изделию
		 */
		_calc_order_row: {
			get: function () {
				if(!_data._calc_order_row && !this.ox.empty()){
					_data._calc_order_row = this.ox.calc_order_row;
				}
				return _data._calc_order_row;
			}
		},

		/**
		 * Габариты изделия. Рассчитываются, как объединение габаритов всех слоёв типа Contour
		 * @property bounds
		 * @type Rectangle
		 */
		bounds: {
			get : function(){

				if(!_data._bounds){
					_scheme.contours.forEach(function(l){
						if(!_data._bounds)
							_data._bounds = l.bounds;
						else
							_data._bounds = _data._bounds.unite(l.bounds);
					});
				}

				return _data._bounds;
			}
		},

		/**
		 * Габариты с учетом пользовательских размерных линий, чтобы рассчитать отступы автолиний
		 */
		dimension_bounds: {

			get: function(){
				var bounds = this.bounds;
				this.getItems({class: DimensionLine}).forEach(function (dl) {

					if(dl instanceof DimensionLineCustom || dl.data.impost || dl.data.contour)
						bounds = bounds.unite(dl.bounds);

				});
				return bounds;
			}
		}
	});


	/**
	 * Виртуальная табличная часть параметров изделия
	 */
	this._dp.__define({

		extra_fields: {
				get: function(){
					return _scheme.ox.params;
				}
			}
	});

	// начинаем следить за _dp, чтобы обработать изменения цвета и параметров
	Object.observe(this._dp, _dp_observer, ["update"]);


	/**
	 * Менеджер соединений изделия
	 * Хранит информацию о соединениях элементов и предоставляет методы для поиска-манипуляции
	 * @property connections
	 * @type Connections
	 */
	this.connections = new function Connections() {

		this.__define({

			cnns: {
				get : function(){
					return _scheme.ox.cnn_elmnts;
				}
			}
		});

	};


	/**
	 * Ищет точки в выделенных элементах. Если не находит, то во всём проекте
	 * @param point {paper.Point}
	 * @returns {*}
	 */
	this.hitPoints = function (point, tolerance) {
		var item, hit;

		// отдаём предпочтение сегментам выделенных путей
		this.selectedItems.some(function (item) {
			hit = item.hitTest(point, { segments: true, tolerance: tolerance || 8 });
			if(hit)
				return true;
		});

		// если нет в выделенных, ищем во всех
		if(!hit)
			hit = this.hitTest(point, { segments: true, tolerance: tolerance || 6 });

		if(!tolerance && hit && hit.item.layer && hit.item.layer.parent){
			item = hit.item;
			// если соединение T - портить hit не надо, иначе - ищем во внешнем контуре
			if(
				(item.parent.b && item.parent.b.is_nearest(hit.point) && item.parent.rays.b &&
					(item.parent.rays.b.cnn_types.indexOf($p.enm.cnn_types.ТОбразное) != -1 || item.parent.rays.b.cnn_types.indexOf($p.enm.cnn_types.НезамкнутыйКонтур) != -1))
					|| (item.parent.e && item.parent.e.is_nearest(hit.point) && item.parent.rays.e &&
					(item.parent.rays.e.cnn_types.indexOf($p.enm.cnn_types.ТОбразное) != -1 || item.parent.rays.e.cnn_types.indexOf($p.enm.cnn_types.НезамкнутыйКонтур) != -1)))
				return hit;

			item.layer.parent.profiles.some(function (item) {
				hit = item.hitTest(point, { segments: true, tolerance: tolerance || 6 });
				if(hit)
					return true;
			});
			//item.selected = false;
		}
		return hit;
	};

	/**
	 * ### Читает изделие по ссылке или объекту продукции
	 * Выполняет следующую последовательность действий:
	 * - Если передана ссылка, получает объект из базы данных
	 * - Удаляет все слои и элементы текущего графисеского контекста
	 * - Рекурсивно создаёт контуры изделия по данным табличной части конструкций текущей продукции
	 * - Рассчитывает габариты эскиза
	 * - Згружает пользовательские размерные линии
	 * - Делает начальный снапшот для {{#crossLink "UndoRedo"}}{{/crossLink}}
	 * - Рисует автоматические размерные линии
	 * - Активирует текущий слой в дереве слоёв
	 * - Рисует дополнительные элементы визуализации
	 *
	 * @method load
	 * @for Scheme
	 * @param id {String|CatObj} - идентификатор или объект продукции
	 * @async
	 */
	this.load = function(id){

		/**
		 * Рекурсивно создаёт контуры изделия
		 * @param [parent] {Contour}
		 */
		function load_contour(parent){
			// создаём семейство конструкций
			var out_cns = parent ? parent.cnstr : 0;
			_scheme.ox.constructions.find_rows({parent: out_cns}, function(row){

				var contour = new Contour( {parent: parent, row: row});

				// вложенные створки
				load_contour(contour);

			});
		}

		/**
		 * Загружает размерные линии
		 * Этот код нельзя выполнить внутри load_contour, т.к. линия может ссылаться на элементы разных контуров
		 */
		function load_dimension_lines() {

			_scheme.ox.coordinates.find_rows({elm_type: $p.enm.elm_types.Размер}, function(row){

				new DimensionLineCustom( {
					parent: _scheme.getItem({cnstr: row.cnstr}).l_dimensions,
					row: row
				});

			});
		}

		function load_object(o){

			_scheme.ox = o;

			// включаем перерисовку
			_data._opened = true;
			requestAnimationFrame(redraw);

			_data._bounds = new paper.Rectangle({
				point: [0, 0],
				size: [o.x, o.y]
			});
			o = null;

			// создаём семейство конструкций
			load_contour(null);

			setTimeout(function () {

				_data._bounds = null;

				// згружаем пользовательские размерные линии
				load_dimension_lines();

				_data._bounds = null;
				_scheme.zoom_fit();

				// виртуальное событие, чтобы UndoRedo сделал начальный снапшот
				$p.eve.callEvent("scheme_changed", [_scheme]);

				// регистрируем изменение, чтобы отрисовались размерные линии
				_scheme.register_change(true);

				// виртуальное событие, чтобы активировать слой в дереве слоёв
				if(_scheme.contours.length){
					$p.eve.callEvent("layer_activated", [_scheme.contours[0], true]);
				}

				delete _data._loading;
				delete _data._snapshot;

				// виртуальное событие, чтобы нарисовать визуализацию или открыть шаблоны
				setTimeout(function () {
					if(_scheme.ox.coordinates.count()){
						if(_scheme.ox.specification.count()){
							$p.eve.callEvent("coordinates_calculated", [_scheme, {onload: true}]);
						}else{
							// если нет спецификации при заполненных координатах, скорее всего, прочитали типовой блок - запускаем пересчет
							_scheme.register_change(true);
						}
					}else{
						paper.load_stamp();
					}
				}, 100);


			}, 20);

		}

		_data._loading = true;
		if(id != _scheme.ox)
			_scheme.ox = null;
		_scheme.clear();

		if($p.utils.is_data_obj(id) && id.calc_order && !id.calc_order.is_new())
			load_object(id);

		else if($p.utils.is_guid(id) || $p.utils.is_data_obj(id)){
			$p.cat.characteristics.get(id, true, true)
				.then(function (ox) {
					$p.doc.calc_order.get(ox.calc_order, true, true)
						.then(function () {
							load_object(ox);
						})
				});
		}
	};

	/**
	 * информирует о наличии изменений
	 */
	this.has_changes = function () {
		return _changes.length > 0;
	};

	/**
	 * Регистрирует факты изменения элемнтов
	 */
	this.register_change = function (with_update) {
		if(!_data._loading){
			_data._bounds = null;
			this.ox._data._modified = true;
			$p.eve.callEvent("scheme_changed", [this]);
		}
		_changes.push(Date.now());

		if(with_update)
			this.register_update();
	};

	/**
	 * Регистрирует необходимость обновить изображение
 	 */
	this.register_update = function () {

		if(_data._update_timer)
			clearTimeout(_data._update_timer);

		_data._update_timer = setTimeout(function () {
			_scheme.view.update();
			_data._update_timer = 0;
		}, 100);
	};

	/**
	 * Снимает выделение со всех узлов всех путей
	 * В отличии от deselectAll() сами пути могут оставаться выделенными
	 * учитываются узлы всех путей, в том числе и не выделенных
	 */
	this.deselect_all_points = function(with_items) {
		this.getItems({class: paper.Path}).forEach(function (item) {
			item.segments.forEach(function (s) {
				if (s.selected)
					s.selected = false;
			});
			if(with_items && item.selected)
				item.selected = false;
		});
	};

	/**
	 * Находит точку на примыкающем профиле и проверяет расстояние до неё от текущей точки
	 * !! Изменяет res - CnnPoint
	 * @param element {Profile} - профиль, расстояние до которого проверяем
	 * @param profile {Profile|null} - текущий профиль - используется, чтобы не искать соединения с самим собой
	 * TODO: возможно, имеет смысл разрешить змее кусать себя за хвост
	 * @param res {CnnPoint} - описание соединения на конце текущего профиля
	 * @param point {paper.Point} - точка, окрестность которой анализируем
	 * @param check_only {Boolean|String} - указывает, выполнять только проверку или привязывать точку к узлам или профилю или к узлам и профилю
	 * @returns {Boolean|undefined}
	 */
	this.check_distance = function(element, profile, res, point, check_only){

		var distance, gp, cnns, addls,
			bind_node = typeof check_only == "string" && check_only.indexOf("node") != -1,
			bind_generatrix = typeof check_only == "string" ? check_only.indexOf("generatrix") != -1 : check_only,
			node_distance;

		// Проверяет дистанцию в окрестности начала или конца соседнего элемента
		function check_node_distance(node) {

			if((distance = element[node].getDistance(point)) < (_scheme._dp.sys.allow_open_cnn ? parseFloat(consts.sticking_l) : consts.sticking)){

				if(typeof res.distance == "number" && res.distance < distance)
					return 1;

				if(profile && (!res.cnn || $p.enm.cnn_types.acn.a.indexOf(res.cnn.cnn_type) == -1)){

					// а есть ли подходящее?
					cnns = $p.cat.cnns.nom_cnn(element, profile, $p.enm.cnn_types.acn.a);
					if(!cnns.length)
						return 1;

					// если в точке сходятся 2 профиля текущего контура - ок

					// если сходятся > 2 и разрешены разрывы TODO: учесть не только параллельные

				}else if(res.cnn && $p.enm.cnn_types.acn.a.indexOf(res.cnn.cnn_type) == -1)
					return 1;

				res.point = bind_node ? element[node] : point;
				res.distance = distance;
				res.profile = element;
				res.profile_point = node;
				res.cnn_types = $p.enm.cnn_types.acn.a;

				return 2;
			}

		}

		if(element === profile){
			if(profile.is_linear())
				return;
			else{
				// проверяем другой узел, затем - Т

			}
			return;

		}else if(node_distance = check_node_distance("b")){
			// Если мы находимся в окрестности начала соседнего элемента
			if(node_distance == 2)
				return false;
			else
				return;

		}else if(node_distance = check_node_distance("e")){
			// Если мы находимся в окрестности конца соседнего элемента
			if(node_distance == 2)
				return false;
			else
				return;

		}

		// это соединение с пустотой или T
		res.profile_point = '';

		// // если возможна привязка к добору, используем её
		// element.addls.forEach(function (addl) {
		// 	gp = addl.generatrix.getNearestPoint(point);
		// 	distance = gp.getDistance(point);
		//
		// 	if(distance < res.distance){
		// 		res.point = addl.rays.outer.getNearestPoint(point);
		// 		res.distance = distance;
		// 		res.point = gp;
		// 		res.profile = addl;
		// 		res.cnn_types = $p.enm.cnn_types.acn.t;
		// 	}
		// });
		// if(res.distance < ((res.is_t || !res.is_l)  ? consts.sticking : consts.sticking_l)){
		// 	return false;
		// }

		// если к доборам не привязались - проверяем профиль
		gp = element.generatrix.getNearestPoint(point);
		distance = gp.getDistance(point);

		if(distance < ((res.is_t || !res.is_l)  ? consts.sticking : consts.sticking_l)){

			if(distance < res.distance || bind_generatrix){
				if(element.d0 != 0 && element.rays.outer){
					// для вложенных створок учтём смещение
					res.point = element.rays.outer.getNearestPoint(point);
					res.distance = 0;
				}else{
					res.point = gp;
					res.distance = distance;
				}
				res.profile = element;
				res.cnn_types = $p.enm.cnn_types.acn.t;
			}
			if(bind_generatrix)
				return false;
		}
	};

	/**
	 * Деструктор
	 */
	this.unload = function () {
		_data._loading = true;
		this.clear();
		this.remove();
		Object.unobserve(this._dp, _dp_observer);
		Object.unobserve(this._dp.characteristic, _papam_observer);
		this.data._calc_order_row = null;
	};

	/**
	 * Перерисовывает все контуры изделия. Не занимается биндингом.
	 * Предполагается, что взаимное перемещение профилей уже обработано
	 */
	function redraw () {

		function process_redraw(){

			var llength = 0;

			// вызывается после перерисовки очередного контура
			function on_contour_redrawed(){
				if(!_changes.length){
					llength--;

					if(!llength){

						// если перерисованы все контуры, перерисовываем их размерные линии
						_data._bounds = null;
						_scheme.contours.forEach(function(l){
							l.draw_sizes();
						});

						// перерисовываем габаритные размерные линии изделия
						_scheme.draw_sizes();

						// обновляем изображение на эуране
						_scheme.view.update();

					}
				}
			}

			// if(_scheme.data._saving || _scheme.data._loading)
			// 	return;

			if(_changes.length){
				//console.log(_changes.length);
				_changes.length = 0;

				if(_scheme.contours.length){
					_scheme.contours.forEach(function(l){
						llength++;
						l.redraw(on_contour_redrawed);
					});
				}else{
					_scheme.draw_sizes();
				}
			}
		}

		if(_data._opened)
			requestAnimationFrame(redraw);

		process_redraw();

	}

	$p.eve.attachEvent("coordinates_calculated", function (scheme, attr) {

		if(_scheme != scheme)
			return;

		_scheme.contours.forEach(function(l){
			l.draw_visualization();
		});
		_scheme.view.update();

	});

}
Scheme._extend(paper.Project);

Scheme.prototype.__define({

	/**
	 * Двигает выделенные точки путей либо все точки выделенных элементов
	 * @method move_points
	 * @for Scheme
	 * @param delta {paper.Point}
	 * @param [all_points] {Boolean}
	 */
	move_points: {
		value: function (delta, all_points) {

			var other = [], layers = [];

			this.selectedItems.forEach(function (item) {

				if(item.parent instanceof ProfileItem){
					if(!item.layer.parent || !item.parent.nearest || !item.parent.nearest()){

						var check_selected;
						item.segments.forEach(function (segm) {
							if(segm.selected && other.indexOf(segm) != -1)
								check_selected = !(segm.selected = false);
						});

						// если уже двигали и не осталось ни одного выделенного - выходим
						if(check_selected && !item.segments.some(function (segm) {
								return segm.selected;
							}))
							return;

						// двигаем и накапливаем связанные
						other = other.concat(item.parent.move_points(delta, all_points));

						if(layers.indexOf(item.layer) == -1){
							layers.push(item.layer);
							item.layer.clear_dimentions();
						}

					}

				}else if(item instanceof Filling){
					//item.position = item.position.add(delta);
					while (item.children.length > 1){
						if(!(item.children[1] instanceof Onlay))
							item.children[1].remove();
					}
				}
			});
			// TODO: возможно, здесь надо подвигать примыкающие контуры
		}
	},

	/**
	 * Сохраняет координаты и пути элементов в табличных частях характеристики
	 * @method save_coordinates
	 * @for Scheme
	 */
	save_coordinates: {
		value: function (attr) {

			if(!this.bounds)
				return;

			var ox = this.ox;

			// переводим характеристику в тихий режим, чтобы она не создавала лишнего шума при изменениях
			ox._silent();

			this.data._saving = true;

			// устанавливаем размеры в характеристике
			ox.x = this.bounds.width.round(1);
			ox.y = this.bounds.height.round(1);
			ox.s = this.area;

			// чистим табчасти, которые будут перезаполнены
			ox.cnn_elmnts.clear();
			ox.glasses.clear();

			// смещаем слои, чтобы расположить изделие в начале координат
			//var bpoint = this.bounds.point;
			//if(bpoint.length > consts.sticking0){
			//	this.getItems({class: Contour}).forEach(function (contour) {
			//		contour.position = contour.position.subtract(bpoint);
			//	});
			//	this.data._bounds = null;
			//};

			// вызываем метод save_coordinates в дочерних слоях
			this.contours.forEach(function (contour) {
				contour.save_coordinates();
			});
			$p.eve.callEvent("save_coordinates", [this, attr]);

		}
	},

	/**
	 * ### Габариты эскиза со всеми видимыми дополнениями
	 * В свойстве `strokeBounds` учтены все видимые дополнения - размерные линии, визуализация и т.д.
	 *
	 * @property strokeBounds
	 * @for Scheme
	 */
	strokeBounds: {

		get: function () {

			var bounds = new paper.Rectangle();
			this.contours.forEach(function(l){
				bounds = bounds.unite(l.strokeBounds);
			});

			return bounds;
		}
	},

	/**
	 * ### Изменяет центр и масштаб, чтобы изделие вписалось в размер окна
	 * Используется инструментом {{#crossLink "ZoomFit"}}{{/crossLink}}, вызывается при открытии изделия и после загрузки типового блока
	 *
	 * @method zoom_fit
	 * @for Scheme
	 */
	zoom_fit: {
		value: function (bounds) {

			if(!bounds)
				bounds = this.strokeBounds;

			var height = (bounds.height < 1000 ? 1000 : bounds.height) + 320,
				width = (bounds.width < 1000 ? 1000 : bounds.width) + 320,
				shift;

			if(bounds){
				this.view.zoom = Math.min((this.view.viewSize.height - 20) / height, (this.view.viewSize.width - 20) / width);
				shift = (this.view.viewSize.width - bounds.width * this.view.zoom) / 2;
				if(shift < 200)
					shift = 0;
				this.view.center = bounds.center.add([shift, 40]);
			}
		}
	},

	/**
	 * ### Bозвращает строку svg эскиза изделия
	 * Вызывается при записи изделия. Полученный эскиз сохраняется во вложении к характеристике
	 *
	 * @method get_svg
	 * @for Scheme
	 * @param [attr] {Object} - указывает видимость слоёв и элементов, используется для формирования эскиза части изделия
	 */
	get_svg: {

		value: function (attr) {

			var svg = this.exportSVG({excludeData: true}),
				bounds = this.strokeBounds.unite(this.l_dimensions.strokeBounds);

			svg.setAttribute("x", bounds.x);
			svg.setAttribute("y", bounds.y);
			svg.setAttribute("width", bounds.width);
			svg.setAttribute("height", bounds.height);
			//svg.querySelector("g").setAttribute("transform", "scale(1)");
			svg.querySelector("g").removeAttribute("transform");

			return svg.outerHTML;
		}
	},

	/**
	 * ### Перезаполняет изделие данными типового блока или снапшота
	 * Вызывается, обычно, из формы выбора типового блока, но может быть вызван явно в скриптах тестирования или групповых обработках
	 *
	 * @method load_stamp
	 * @for Scheme
	 * @param obx {String|CatObj|Object} - идентификатор или объект-основание (характеристика продукции либо снапшот)
	 * @param is_snapshot {Boolean}
	 */
	load_stamp: {
		value: function(obx, is_snapshot){

			function do_load(obx){

				var ox = this.ox;

				// сохраняем ссылку на типовой блок
				if(!is_snapshot)
					this._dp.base_block = obx;

				// если отложить очитску на потом - получим лажу, т.к. будут стёрты новые хорошие строки
				this.clear();

				// переприсваиваем номенклатуру, цвет и размеры
				ox._mixin(obx, ["owner","sys","clr","x","y","s","s"]);

				// очищаем табчасти, перезаполняем контуры и координаты
				ox.constructions.load(obx.constructions);
				ox.coordinates.load(obx.coordinates);
				ox.params.load(obx.params);
				ox.cnn_elmnts.load(obx.cnn_elmnts);
        ox.inserts.load(obx.inserts);

				ox.specification.clear();
				ox.glass_specification.clear();
				ox.glasses.clear();

				this.load(ox);

			}

			this.data._loading = true;

			if(is_snapshot){
				this.data._snapshot = true;
				do_load.call(this, obx);

			}else
				$p.cat.characteristics.get(obx, true, true)
					.then(do_load.bind(this));

		}
	},

	/**
	 * ### Вписывает канвас в указанные размеры
	 * Используется при создании проекта и при изменении размеров области редактирования
	 *
	 * @method resize_canvas
	 * @for Scheme
	 * @param w {Number} - ширина, в которую будет вписан канвас
	 * @param h {Number} - высота, в которую будет вписан канвас
	 */
	resize_canvas: {
		value: function(w, h){
			this.view.viewSize.width = w;
			this.view.viewSize.height = h;
		}
	},

	/**
	 * Возвращает массив РАМНЫХ контуров текущего изделия
	 * @property contours
	 * @for Scheme
	 * @type Array
	 */
	contours: {
		get: function () {
			var res = [];
			this.layers.forEach(function (l) {
				if(l instanceof Contour)
					res.push(l)
			});
			return res;
		}
	},

	/**
	 * ### Площадь изделия
	 * TODO: переделать с учетом пустот, наклонов и криволинейностей
	 *
	 * @property area
	 * @for Scheme
	 * @type Number
	 * @final
	 */
	area: {
		get: function () {
			return (this.bounds.width * this.bounds.height / 1000000).round(3);
		}
	},

	/**
	 * ### Цвет текущего изделия
	 *
	 * @property clr
	 * @for Scheme
	 * @type _cat.clrs
	 */
	clr: {
		get: function () {
			return this._dp.characteristic.clr;
		},
		set: function (v) {
			this._dp.characteristic.clr = v;
		}
	},

	/**
	 * ### Служебный слой размерных линий
	 *
	 * @property l_dimensions
	 * @for Scheme
	 * @type DimensionLayer
	 * @final
	 */
	l_dimensions: {
		get: function () {

			var curr;

			if(!this.data.l_dimensions){
				curr = this.activeLayer;
				this.data.l_dimensions = new DimensionLayer();
				if(curr)
					this._activeLayer = curr;
			}

			if(!this.data.l_dimensions.isInserted()){
				curr = this.activeLayer;
				this.addLayer(this.data.l_dimensions);
				if(curr)
					this._activeLayer = curr;
			}

			return this.data.l_dimensions;
		}
	},

	/**
	 * ### Создаёт и перерисовавает габаритные линии изделия
	 * Отвечает только за габариты изделия.<br />
	 * Авторазмерные линии контуров и пользовательские размерные линии, контуры рисуют самостоятельно
	 *
	 * @method draw_sizes
	 * @for Scheme
	 */
	draw_sizes: {
		value: function () {

			var bounds = this.bounds;

			if(bounds){

				if(!this.l_dimensions.bottom)
					this.l_dimensions.bottom = new DimensionLine({
						pos: "bottom",
						parent: this.l_dimensions,
						offset: -120
					});
				else
					this.l_dimensions.bottom.offset = -120;

				if(!this.l_dimensions.right)
					this.l_dimensions.right = new DimensionLine({
						pos: "right",
						parent: this.l_dimensions,
						offset: -120
					});
				else
					this.l_dimensions.right.offset = -120;



				// если среди размеров, сформированных контурами есть габарит - второй раз не выводим

				if(this.contours.some(function(l){
						return l.l_dimensions.children.some(function (dl) {
							if(dl.pos == "right" && Math.abs(dl.size - bounds.height) < consts.sticking_l ){
								return true;
							}
						});
					})){
					this.l_dimensions.right.visible = false;
				}else
					this.l_dimensions.right.redraw();


				if(this.contours.some(function(l){
						return l.l_dimensions.children.some(function (dl) {
							if(dl.pos == "bottom" && Math.abs(dl.size - bounds.width) < consts.sticking_l ){
								return true;
							}
						});
					})){
					this.l_dimensions.bottom.visible = false;
				}else
					this.l_dimensions.bottom.redraw();

			}else{
				if(this.l_dimensions.bottom)
					this.l_dimensions.bottom.visible = false;
				if(this.l_dimensions.right)
					this.l_dimensions.right.visible = false;
			}
		}
	},

	/**
	 * ### Вставка по умолчанию
	 * Возвращает вставку по умолчанию с учетом свойств системы и положения элемента
	 *
	 * @method default_inset
	 * @for Scheme
	 * @param [attr] {Object}
	 * @param [attr.pos] {_enm.positions} - положение элемента
	 * @param [attr.elm_type] {_enm.elm_types} - тип элемента
	 * @returns {Array.<ProfileItem>}
	 */
	default_inset: {
		value: function (attr) {

			var rows;

			if(!attr.pos){
				rows = this._dp.sys.inserts(attr.elm_type, true);
				// если доступна текущая, возвращаем её
				if(attr.inset && rows.some(function (row) { return attr.inset == row; })){
					return attr.inset;
				}
				return rows[0];
			}

			rows = this._dp.sys.inserts(attr.elm_type, "rows");

			// если без вариантов, возвращаем без вариантов
			if(rows.length == 1)
				return rows[0].nom;

			// если подходит текущая, возвращаем текущую
			if(attr.inset && rows.some(function (row) {
					return attr.inset == row.nom && (row.pos == attr.pos || row.pos == $p.enm.positions.Любое);
				})){
				return attr.inset;
			}

			var inset;
			// ищем по умолчанию + pos
			rows.some(function (row) {
				if(row.pos == attr.pos && row.by_default)
					return inset = row.nom;
			});
			// ищем по pos без умолчания
			if(!inset)
				rows.some(function (row) {
					if(row.pos == attr.pos)
						return inset = row.nom;
				});
			// ищем по умолчанию + любое
			if(!inset)
				rows.some(function (row) {
					if(row.pos == $p.enm.positions.Любое && row.by_default)
						return inset = row.nom;
				});
			// ищем любое без умолчаний
			if(!inset)
				rows.some(function (row) {
					if(row.pos == $p.enm.positions.Любое)
						return inset = row.nom;
				});

			return inset;
		}
	},

	/**
	 * ### Контроль вставки
	 * Проверяет, годится ли текущая вставка для данного типа элемента и положения
	 */
	check_inset: {
		value: function (attr) {

			var inset = attr.inset ? attr.inset : attr.elm.inset,
				elm_type = attr.elm ? attr.elm.elm_type : attr.elm_type,
				nom = inset.nom(),
				rows = [];

			// если номенклатура пустая, выходим без проверки
			if(!nom || nom.empty())
				return inset;

			// получаем список вставок с той же номенклатурой, что и наша
			this._dp.sys.elmnts.each(function(row){
				if((elm_type ? row.elm_type == elm_type : true) && row.nom.nom() == nom)
					rows.push(row);
			});

			// TODO: отфильтровать по положению attr.pos

			// если в списке есть наша, возвращаем её, иначе - первую из списка
			for(var i=0; i<rows.length; i++){
				if(rows[i].nom == inset)
					return inset;
			}

			if(rows.length)
				return rows[0].nom;

		}
	},

	/**
	 * ### Цвет по умолчанию
	 * Возвращает цвет по умолчанию с учетом свойств системы и элемента
	 *
	 * @property default_clr
	 * @for Scheme
	 * @final
	 */
	default_clr: {
		value: function (attr) {
			return this.ox.clr;
		}
	},

	/**
	 * ### Фурнитура по умолчанию
	 * Возвращает фурнитуру текущего изделия по умолчанию с учетом свойств системы и контура
	 *
	 * @property default_furn
	 * @for Scheme
	 * @final
	 */
	default_furn: {
		get: function () {
			// ищем ранее выбранную фурнитуру для системы
			var sys = this._dp.sys,
				res;
			while (true){
				if(res = $p.job_prm.builder.base_furn[sys.ref])
					break;
				if(sys.empty())
					break;
				sys = sys.parent;
			}
			if(!res){
				res = $p.job_prm.builder.base_furn.null;
			}
			if(!res){
				$p.cat.furns.find_rows({is_folder: false, is_set: false, id: {not: ""}}, function (row) {
					res = row;
					return false;
				});
			}
			return res;
		}
	},

	/**
	 * ### Выделенные профили
	 * Возвращает массив выделенных профилей. Выделенным считаем профиль, у которого выделены `b` и `e` или выделен сам профиль при невыделенных узлах
	 *
	 * @method selected_profiles
	 * @for Scheme
	 * @param [all] {Boolean} - если true, возвращает все выделенные профили. Иначе, только те, которе можно двигать
	 * @returns {Array.<ProfileItem>}
	 */
	selected_profiles: {
		value: function (all) {

			var res = [], count = this.selectedItems.length;

			this.selectedItems.forEach(function (item) {

				var p = item.parent;

				if(p instanceof ProfileItem){
					if(all || !item.layer.parent || !p.nearest || !p.nearest()){

						if(res.indexOf(p) != -1)
							return;

						if(count < 2 || !(p.data.generatrix.firstSegment.selected ^ p.data.generatrix.lastSegment.selected))
							res.push(p);

					}
				}
			});

			return res;
		}
	},

  /**
   * ### Выделенный элемент
   * Возвращает первый из найденных выделенных элементов
   *
   * @property selected_elm
   * @for Scheme
   * @returns {BuilderElement}
   */
  selected_elm: {
    get: function () {

      var res;

      this.selectedItems.some(function (item) {

        if(item instanceof BuilderElement){
          return res = item;

        }else if(item.parent instanceof BuilderElement){
          return res = item.parent;
        }
      });

      return res;
    }
  }


});

/**
 * ### Разрез
 * 
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2016<br />
 * Created 24.07.2015
 *
 * @module geometry
 * @submodule sectional
 */

/**
 * Вид в разрезе. например, водоотливы
 * @param arg {Object} - объект со свойствами создаваемого элемента
 * @constructor
 * @extends BuilderElement
 */
function Sectional(arg){
	Sectional.superclass.constructor.call(this, arg);
}
Sectional._extend(BuilderElement);
/**
 * ### Движок графического построителя
 * 
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2016<br />
 * 
 * @module geometry
 */

"use strict";

/**
 * Константы и параметры
 */
	var consts = new function Settings(){


	this.tune_paper = function (settings) {
		/**
		 * Размер визуализации узла пути
		 * @property handleSize
		 * @type {number}
		 */
		settings.handleSize = $p.job_prm.builder.handle_size;

		/**
		 * Прилипание. На этом расстоянии узел пытается прилепиться к другому узлу или элементу
		 * @property sticking
		 * @type {number}
		 */
		this.sticking = $p.job_prm.builder.sticking || 90;
		this.sticking_l = $p.job_prm.builder.sticking_l || 9;
		this.sticking0 = this.sticking / 2;
		this.sticking2 = this.sticking * this.sticking;
		this.font_size = $p.job_prm.builder.font_size || 60;

		// в пределах этого угла, считаем элемент вертикальным или горизонтальным
		this.orientation_delta = $p.job_prm.builder.orientation_delta || 20;
		

	}.bind(this);



	this.move_points = 'move_points';
	this.move_handle = 'move_handle';
	this.move_shapes = 'move-shapes';



};
/**
 * ### Виртуальный инструмент - прототип для инструментов _select_node_ и _select_elm_
 *
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2016<br />
 * Created 12.03.2016
 *
 * @module tools
 * @submodule tool_element
 */

/**
 * ### Виртуальный инструмент - прототип для инструментов _select_node_ и _select_elm_
 *
 * @class ToolElement
 * @extends paper.Tool
 * @constructor
 */
function ToolElement() {
	ToolElement.superclass.constructor.call(this);
}
ToolElement._extend(paper.Tool);

ToolElement.prototype.__define({

	/**
	 * ### Отключает и выгружает из памяти окно свойств инструмента
	 *
	 * @method detache_wnd
	 * @for ToolElement
	 * @param tool
	 */
	detache_wnd: {
		value: function(){
			if(this.wnd){
				
				if(this._grid && this._grid.destructor){
					if(this.wnd.detachObject)
						this.wnd.detachObject(true);
					delete this._grid;
				}
				
				if(this.wnd.wnd_options){
					this.wnd.wnd_options(this.options.wnd);
					$p.wsql.save_options("editor", this.options);
					this.wnd.close();
				}
				
				delete this.wnd;
			}
			this.profile = null;
		}
	},


	/**
	 * ### Проверяет, есть ли в проекте стои, при необходимости добавляет
	 * @method detache_wnd
	 * @for ToolElement
	 */
	check_layer: {
		value: function () {
			if(!this._scope.project.contours.length){

				// создаём пустой новый слой
				new Contour( {parent: undefined});

				// оповещаем мир о новых слоях
				Object.getNotifier(this._scope.project._noti).notify({
					type: 'rows',
					tabular: "constructions"
				});

			}
		}
	},

	/**
	 * ### Общие действия при активизации инструмента
	 *
	 * @method on_activate
	 * @for ToolElement
	 */
	on_activate: {
		value: function (cursor) {

			this._scope.tb_left.select(this.options.name);

			this._scope.canvas_cursor(cursor);

			// для всех инструментов, кроме select_node...
			if(this.options.name != "select_node"){

				this.check_layer();

				// проверяем заполненность системы
				if(this._scope.project._dp.sys.empty()){
					$p.msg.show_msg({
						type: "alert-warning",
						text: $p.msg.bld_not_sys,
						title: $p.msg.bld_title
					});
				}
			}

		}
	}

});


/**
 * ### Манипуляции с арками (дуги правильных окружностей)
 * 
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2016<br />
 * Created 25.08.2015
 * 
 * @module tools
 * @submodule tool_arc
 */

/**
 * ### Манипуляции с арками (дуги правильных окружностей)
 * 
 * @class ToolArc
 * @extends ToolElement
 * @constructor
 * @menuorder 56
 * @tooltip Арка
 */
function ToolArc(){

	var tool = this;

	ToolArc.superclass.constructor.call(this);

	tool.options = {name: 'arc'};
	tool.mouseStartPos = new paper.Point();
	tool.mode = null;
	tool.hitItem = null;
	tool.originalContent = null;
	tool.changed = false;
	tool.duplicates = null;

	function do_arc(element, point){
		var end = element.lastSegment.point.clone();
		element.removeSegments(1);

		try{
			element.arcTo(point, end);
		}catch (e){	}

		if(!element.curves.length)
			element.lineTo(end);

		element.parent.rays.clear();
		element.selected = true;

		element.layer.notify({type: consts.move_points, profiles: [element.parent], points: []});
	}

	tool.resetHot = function(type, event, mode) {
	};
	tool.testHot = function(type, event, mode) {
		/*	if (mode != 'tool-select')
		 return false;*/
		return tool.hitTest(event);
	};
	tool.hitTest = function(event) {

		var hitSize = 6;
		tool.hitItem = null;

		if (event.point)
			tool.hitItem = paper.project.hitTest(event.point, { fill:true, stroke:true, selected: true, tolerance: hitSize });
		if(!tool.hitItem)
			tool.hitItem = paper.project.hitTest(event.point, { fill:true, tolerance: hitSize });

		if (tool.hitItem && tool.hitItem.item.parent instanceof ProfileItem
			&& (tool.hitItem.type == 'fill' || tool.hitItem.type == 'stroke')) {
			paper.canvas_cursor('cursor-arc');
		} else {
			paper.canvas_cursor('cursor-arc-arrow');
		}

		return true;
	};
	tool.on({
		
		activate: function() {
			this.on_activate('cursor-arc-arrow');
		},
		
		deactivate: function() {
			paper.hide_selection_bounds();
		},
		
		mousedown: function(event) {

			var b, e, r;

			this.mode = null;
			this.changed = false;

			if (tool.hitItem && tool.hitItem.item.parent instanceof ProfileItem
				&& (tool.hitItem.type == 'fill' || tool.hitItem.type == 'stroke')) {

				this.mode = tool.hitItem.item.parent.generatrix;

				if (event.modifiers.control || event.modifiers.option){
					// при зажатом ctrl или alt строим правильную дугу

					b = this.mode.firstSegment.point;
					e = this.mode.lastSegment.point;
					r = (b.getDistance(e) / 2) + 0.001;

					do_arc(this.mode, event.point.arc_point(b.x, b.y, e.x, e.y, r, event.modifiers.option, false));

					//undo.snapshot("Move Shapes");
					r = this.mode;
					this.mode = null;
					

				}else if(event.modifiers.space){
					// при зажатом space удаляем кривизну

					e = this.mode.lastSegment.point;
					r = this.mode;
					this.mode = null;

					r.removeSegments(1);
					r.firstSegment.handleIn = null;
					r.firstSegment.handleOut = null;
					r.lineTo(e);
					r.parent.rays.clear();
					r.selected = true;
					r.layer.notify({type: consts.move_points, profiles: [r.parent], points: []});

				} else {
					paper.project.deselectAll();

					r = this.mode;
					r.selected = true;
					paper.project.deselect_all_points();
					this.mouseStartPos = event.point.clone();
					this.originalContent = paper.capture_selection_state();

				}

				setTimeout(function () {
					r.layer.redraw();
					r.parent.attache_wnd(paper._acc.elm.cells("a"));
					$p.eve.callEvent("layer_activated", [r.layer]);
				}, 10);

			}else{
				//tool.detache_wnd();
				paper.project.deselectAll();
			}
		},
		
		mouseup: function(event) {

			var item = this.hitItem ? this.hitItem.item : null;

			if(item instanceof Filling && item.visible){
				item.attache_wnd(paper._acc.elm.cells("a"));
				item.selected = true;

				if(item.selected && item.layer)
					$p.eve.callEvent("layer_activated", [item.layer]);
			}

			if (this.mode && this.changed) {
				//undo.snapshot("Move Shapes");
				//paper.project.redraw();
			}

			paper.canvas_cursor('cursor-arc-arrow');

		},
		
		mousedrag: function(event) {
			if (this.mode) {

				this.changed = true;

				paper.canvas_cursor('cursor-arrow-small');

				do_arc(this.mode, event.point);

				//this.mode.layer.redraw();


			}
		},
		
		mousemove: function(event) {
			this.hitTest(event);
		}
		
	});

}
ToolArc._extend(ToolElement);


/**
 * ### Вставка раскладок и импостов
 * 
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2016<br />
 * Created 25.08.2015
 * 
 * @module tools
 * @submodule tool_lay_impost
 */

/**
 * ### Вставка раскладок и импостов
 * 
 * @class ToolLayImpost
 * @extends ToolElement
 * @constructor
 * @menuorder 55
 * @tooltip Импосты и раскладки
 */
function ToolLayImpost(){

	var _editor = paper,
		tool = this,
		sys;

	ToolLayImpost.superclass.constructor.call(this);

	tool.mode = null;
	tool.hitItem = null;
	tool.paths = [];
	tool.changed = false;

	tool.options = {
		name: 'lay_impost',
		wnd: {
			caption: "Импосты и раскладки",
			height: 420,
			width: 320
		}
	};

	// подключает окно редактора
	function tool_wnd(){

		sys = _editor.project._dp.sys;

		// создаём экземпляр обработки
		tool.profile = $p.dp.builder_lay_impost.create();

		// восстанавливаем сохранённые параметры
		$p.wsql.restore_options("editor", tool.options);
		for(var prop in tool.profile._metadata.fields) {
			if(tool.options.wnd.hasOwnProperty(prop))
				tool.profile[prop] = tool.options.wnd[prop];
		}

		// если в текущем слое есть профили, выбираем импост
		if(tool.profile.elm_type.empty())
			tool.profile.elm_type = $p.enm.elm_types.Импост;
		
		// вставку по умолчанию получаем эмулируя событие изменения типа элемента
		$p.dp.builder_lay_impost.handle_event(tool.profile, "value_change", {
			field: "elm_type"
		});

		// выравнивание по умолчанию
		if(tool.profile.align_by_y.empty())
			tool.profile.align_by_y = $p.enm.positions.Центр;
		if(tool.profile.align_by_x.empty())
			tool.profile.align_by_x = $p.enm.positions.Центр;

		// цвет по умолчанию
		if(tool.profile.clr.empty())
			tool.profile.clr = _editor.project.clr;

		// параметры отбора для выбора вставок
		tool.profile._metadata.fields.inset_by_y.choice_links = tool.profile._metadata.fields.inset_by_y.choice_links = [{
			name: ["selection",	"ref"],
			path: [
				function(o, f){
					if($p.utils.is_data_obj(o)){
						return tool.profile.rama_impost.indexOf(o) != -1;

					}else{
						var refs = "";
						tool.profile.rama_impost.forEach(function (o) {
							if(refs)
								refs += ", ";
							refs += "'" + o.ref + "'";
						});
						return "_t_.ref in (" + refs + ")";
					}
				}]
		}];

		// дополняем свойства поля цвет отбором по служебным цветам
		$p.cat.clrs.selection_exclude_service(tool.profile._metadata.fields.clr, sys);

		tool.wnd = $p.iface.dat_blank(_editor._dxw, tool.options.wnd);
		tool._grid = tool.wnd.attachHeadFields({
			obj: tool.profile
		});

		if(!tool.options.wnd.bounds_open){
			tool._grid.collapseKids(tool._grid.getRowById(
				tool._grid.getAllRowIds().split(",")[13]
			));
		}
		tool._grid.attachEvent("onOpenEnd", function(id,state){
			if(id == this.getAllRowIds().split(",")[13])
				tool.options.wnd.bounds_open = state > 0;
		});

		//
		if(!tool._grid_button_click)
			tool._grid_button_click = function (btn, bar) {
				tool.wnd.elmnts._btns.forEach(function (val, ind) {
					if(val.id == bar){
						var suffix = (ind == 0) ? "y" : "x";
						tool.profile["step_by_" + suffix] = 0;

						if(btn == "clear"){
							tool.profile["elm_by_" + suffix] = 0;

						}else if(btn == "del"){

							if(tool.profile["elm_by_" + suffix] > 0)
								tool.profile["elm_by_" + suffix] = tool.profile["elm_by_" + suffix] - 1;
							else if(tool.profile["elm_by_" + suffix] < 0)
								tool.profile["elm_by_" + suffix] = 0;

						}else if(btn == "add"){

							if(tool.profile["elm_by_" + suffix] < 1)
								tool.profile["elm_by_" + suffix] = 1;
							else
								tool.profile["elm_by_" + suffix] = tool.profile["elm_by_" + suffix] + 1;
						}

					}
				})
			};

		tool.wnd.elmnts._btns = [];
		tool._grid.getAllRowIds().split(",").forEach(function (id, ind) {
			if(id.match(/^\d+$/)){

				var cell = tool._grid.cells(id, 1);
				cell.cell.style.position = "relative";

				if(ind < 10){
					tool.wnd.elmnts._btns.push({
						id: id,
						bar: new $p.iface.OTooolBar({
							wrapper: cell.cell,
							top: '0px',
							right: '1px',
							name: id,
							width: '80px',
							height: '20px',
							class_name: "",
							buttons: [
								{name: 'clear', text: '<i class="fa fa-trash-o"></i>', title: 'Очистить направление', class_name: "md_otooolbar_grid_button"},
								{name: 'del', text: '<i class="fa fa-minus-square-o"></i>', title: 'Удалить ячейку', class_name: "md_otooolbar_grid_button"},
								{name: 'add', text: '<i class="fa fa-plus-square-o"></i>', title: 'Добавить ячейку', class_name: "md_otooolbar_grid_button"}
							],
							onclick: tool._grid_button_click
						})
					});
				}else{
					tool.wnd.elmnts._btns.push({
						id: id,
						bar: new $p.iface.OTooolBar({
							wrapper: cell.cell,
							top: '0px',
							right: '1px',
							name: id,
							width: '80px',
							height: '20px',
							class_name: "",
							buttons: [
								{name: 'clear', text: '<i class="fa fa-trash-o"></i>', title: 'Очистить габариты', class_name: "md_otooolbar_grid_button"},
							],
							onclick: function () {
								tool.profile.w = tool.profile.h = 0;
							}
						})
					});
				}

				cell.cell.title = "";
			}

		});

		var wnd_options = tool.wnd.wnd_options;
		tool.wnd.wnd_options = function (opt) {
			wnd_options.call(tool.wnd, opt);

			for(var prop in tool.profile._metadata.fields) {
				if(prop.indexOf("step") == -1 && prop.indexOf("inset") == -1 && prop != "clr" && prop != "w" && prop != "h"){
					var val = tool.profile[prop];
					opt[prop] = $p.utils.is_data_obj(val) ? val.ref : val;
				}
			}
		};

	}


	tool.testHot = function(type, event, mode) {
		/*	if (mode != 'tool-select')
		 return false;*/
		return this.hitTest(event);
	};

	tool.hitTest = function(event) {

		tool.hitItem = null;

		// Hit test items.
		if (event.point)
			tool.hitItem = _editor.project.hitTest(event.point, { fill: true, class: paper.Path });

		if (tool.hitItem && tool.hitItem.item.parent instanceof Filling){
			_editor.canvas_cursor('cursor-lay-impost');
			tool.hitItem = tool.hitItem.item.parent;

		} else {
			_editor.canvas_cursor('cursor-arrow-lay');
			tool.hitItem = null;
		}

		return true;
	};

	tool.detache_wnd = function(){
		if(this.wnd){

			tool.wnd.elmnts._btns.forEach(function (btn) {
				if(btn.bar && btn.bar.unload)
					btn.bar.unload();
			});

			if(this._grid && this._grid.destructor){
				if(this.wnd.detachObject)
					this.wnd.detachObject(true);
				delete this._grid;
			}

			if(this.wnd.wnd_options){
				this.wnd.wnd_options(this.options.wnd);
				$p.wsql.save_options("editor", this.options);
				this.wnd.close();
			}

			delete this.wnd;
		}
		this.profile = null;
	};

	tool.on({

		activate: function() {
			this.on_activate('cursor-arrow-lay');
			tool_wnd();
		},

		deactivate: function() {

			_editor.clear_selection_bounds();

			tool.paths.forEach(function (p) {
				p.remove();
			});
			tool.paths.length = 0;

			tool.detache_wnd();
		},

		mouseup: function(event) {

			_editor.canvas_cursor('cursor-arrow-lay');

			if(this.profile.inset_by_y.empty() && this.profile.inset_by_x.empty())
				return;

			if(!this.hitItem && (tool.profile.elm_type == $p.enm.elm_types.Раскладка || !this.profile.w || !this.profile.h))
				return;

			this.check_layer();

			var layer = tool.hitItem ? tool.hitItem.layer : _editor.project.activeLayer,
				lgeneratics = layer.profiles.map(function (p) {
					return p.nearest() ? p.rays.outer : p.generatrix
				}),
				nprofiles = [];

			function n1(p) {
				return p.segments[0].point.add(p.segments[3].point).divide(2);
			}

			function n2(p) {
				return p.segments[1].point.add(p.segments[2].point).divide(2);
			}

			function check_inset(inset, pos){

				var nom = inset.nom(),
					rows = [];

				_editor.project._dp.sys.elmnts.each(function(row){
					if(row.nom.nom() == nom)
						rows.push(row);
				});

				for(var i=0; i<rows.length; i++){
					if(rows[i].pos == pos)
						return rows[i].nom;
				}

				return inset;
			}

			function rectification() {
				// получаем таблицу расстояний профилей от рёбер габаритов
				var bounds, ares = [],
					group = new paper.Group({ insert: false });

				function reverce(p) {
					var s = p.segments.map(function(s){return s.point.clone()})
					p.removeSegments();
					p.addSegments([s[1], s[0], s[3], s[2]]);
				}

				function by_side(name) {

					ares.sort(function (a, b) {
						return a[name] - b[name];
					});

					ares.forEach(function (p) {
						if(ares[0][name] == p[name]){
							var p1 = n1(p.profile),
								p2 = n2(p.profile),
								angle = p2.subtract(p1).angle.round(0);
							if(angle < 0)
								angle += 360;

							if(name == "left" && angle != 270){
								reverce(p.profile);
							}else if(name == "top" && angle != 0){
								reverce(p.profile);
							}else if(name == "right" && angle != 90){
								reverce(p.profile);
							}else if(name == "bottom" && angle != 180){
								reverce(p.profile);
							}

							if(name == "left" || name == "right")
								p.profile._inset = check_inset(tool.profile.inset_by_x, $p.enm.positions[name]);
							else
								p.profile._inset = check_inset(tool.profile.inset_by_y, $p.enm.positions[name]);
						}
					});

				}

				tool.paths.forEach(function (p) {
					if(p.segments.length)
						p.parent = group;
				});
				bounds = group.bounds;

				group.children.forEach(function (p) {
					ares.push({
						profile: p,
						left: Math.abs(n1(p).x + n2(p).x - bounds.left * 2),
						top: Math.abs(n1(p).y + n2(p).y - bounds.top * 2),
						bottom: Math.abs(n1(p).y + n2(p).y - bounds.bottom * 2),
						right: Math.abs(n1(p).x + n2(p).x - bounds.right * 2)
					});
				});

				["left","top","bottom","right"].forEach(by_side);
			}

			// уточним направления путей для витража
			if(!this.hitItem){
				rectification();
			}

			tool.paths.forEach(function (p) {

				var p1, p2, iter = 0, angle, proto = {clr: tool.profile.clr};

				function do_bind() {

					var correctedp1 = false,
						correctedp2 = false;

					// пытаемся вязать к профилям контура
					lgeneratics.forEach(function (gen) {
						var np = gen.getNearestPoint(p1);
						if(!correctedp1 && np.getDistance(p1) < consts.sticking){
							correctedp1 = true;
							p1 = np;
						}
						np = gen.getNearestPoint(p2);
						if(!correctedp2 && np.getDistance(p2) < consts.sticking){
							correctedp2 = true;
							p2 = np;
						}
					});

					// если не привязалось - ищем точки на вновь добавленных профилях
					if(tool.profile.split != $p.enm.lay_split_types.КрестВСтык && (!correctedp1 || !correctedp2)){
						nprofiles.forEach(function (p) {
							var np = p.generatrix.getNearestPoint(p1);
							if(!correctedp1 && np.getDistance(p1) < consts.sticking){
								correctedp1 = true;
								p1 = np;
							}
							np = p.generatrix.getNearestPoint(p2);
							if(!correctedp2 && np.getDistance(p2) < consts.sticking){
								correctedp2 = true;
								p2 = np;
							}
						});
					}
				}

				p.remove();
				if(p.segments.length){

					p1 = n1(p);
					p2 = n2(p);

					// в зависимости от наклона разные вставки
					angle = p2.subtract(p1).angle;
					if((angle > -40 && angle < 40) || (angle > 180-40 && angle < 180+40)){
						proto.inset = p._inset || tool.profile.inset_by_y;
					}else{
						proto.inset = p._inset || tool.profile.inset_by_x;
					}

					if(tool.profile.elm_type == $p.enm.elm_types.Раскладка){

						nprofiles.push(new Onlay({
							generatrix: new paper.Path({
								segments: [p1, p2]
							}),
							parent: tool.hitItem,
							proto: proto
						}));

					}else{

						while (iter < 10){

							iter++;
							do_bind();
							angle = p2.subtract(p1).angle;
							var delta = Math.abs(angle % 90);

							if(delta > 45)
								delta -= 90;

							if(delta < 0.02)
								break;

							if(angle > 180)
								angle -= 180;
							else if(angle < 0)
								angle += 180;

							if((angle > -40 && angle < 40) || (angle > 180-40 && angle < 180+40)){
								p1.y = p2.y = (p1.y + p2.y) / 2;

							}else if((angle > 90-40 && angle < 90+40) || (angle > 270-40 && angle < 270+40)){
								p1.x = p2.x = (p1.x + p2.x) / 2;

							}else
								break;
						}

						// создаём новые профили
						if(p2.getDistance(p1) > proto.inset.nom().width)
							nprofiles.push(new Profile({
								generatrix: new paper.Path({
									segments: [p1, p2]
								}),
								parent: layer,
								proto: proto
							}));
					}
				}
			});
			tool.paths.length = 0;

			// пытаемся выполнить привязку
			nprofiles.forEach(function (p) {
				var bcnn = p.cnn_point("b"),
					ecnn = p.cnn_point("e");
			});

			if(!this.hitItem)
				setTimeout(function () {
					_editor.tools[1].activate();
				}, 100);

		},

		mousemove: function(event) {

			this.hitTest(event);

			this.paths.forEach(function (p) {
				p.removeSegments();
			});

			if(this.profile.inset_by_y.empty() && this.profile.inset_by_x.empty())
				return;

			var bounds, gen, hit = !!this.hitItem;

			if(hit){
				bounds = this.hitItem.bounds;
				gen = this.hitItem.path;
			}else if(this.profile.w && this.profile.h) {
				gen = new paper.Path({
					insert: false,
					segments: [[0,0], [0, -this.profile.h], [this.profile.w, -this.profile.h], [this.profile.w, 0]],
					closed: true
				});
				bounds = gen.bounds;
				_editor.project.zoom_fit(_editor.project.strokeBounds.unite(bounds));

			}else
				return;

			var stepy = this.profile.step_by_y || (this.profile.elm_by_y && bounds.height / (this.profile.elm_by_y + ((hit || this.profile.elm_by_y < 2) ? 1 : -1))),
				county = this.profile.elm_by_y > 0 ? this.profile.elm_by_y.round(0) : Math.round(bounds.height / stepy) - 1,
				stepx = this.profile.step_by_x || (this.profile.elm_by_x && bounds.width / (this.profile.elm_by_x + ((hit || this.profile.elm_by_x < 2) ? 1 : -1))),
				countx = this.profile.elm_by_x > 0 ? this.profile.elm_by_x.round(0) : Math.round(bounds.width / stepx) - 1,
				w2x = this.profile.inset_by_x.nom().width / 2,
				w2y = this.profile.inset_by_y.nom().width / 2,
				clr = BuilderElement.clr_by_clr(this.profile.clr, false),
				by_x = [], by_y = [], base, pos, path, i, j, pts;

			function get_path() {
				base++;
				if(base < tool.paths.length){
					path = tool.paths[base];
					path.fillColor = clr;
					if(!path.isInserted())
						path.parent = tool.hitItem ? tool.hitItem.layer : _editor.project.activeLayer;
				}else{
					path = new paper.Path({
						strokeColor: 'black',
						fillColor: clr,
						strokeScaling: false,
						guide: true,
						closed: true
					});
					tool.paths.push(path);
				}
				return path;
			}

			function get_points(p1, p2) {

				var res = {
					p1: new paper.Point(p1),
					p2: new paper.Point(p2)
				},
					c1 = gen.contains(res.p1),
					c2 = gen.contains(res.p2);

				if(c1 && c2)
					return res;

				var intersect = gen.getIntersections(new paper.Path({ insert: false, segments: [res.p1, res.p2] }));

				if(c1){
					intersect.reduce(function (sum, curr) {
						var dist = sum.point.getDistance(curr.point);
						if(dist < sum.dist){
							res.p2 = curr.point;
							sum.dist = dist;
						}
						return sum;
					}, {dist: Infinity, point: res.p2});
				}else if(c2){
					intersect.reduce(function (sum, curr) {
						var dist = sum.point.getDistance(curr.point);
						if(dist < sum.dist){
							res.p1 = curr.point;
							sum.dist = dist;
						}
						return sum;
					}, {dist: Infinity, point: res.p1});
				}else if(intersect.length > 1){
					intersect.reduce(function (sum, curr) {
						var dist = sum.point.getDistance(curr.point);
						if(dist < sum.dist){
							res.p2 = curr.point;
							sum.dist = dist;
						}
						return sum;
					}, {dist: Infinity, point: res.p2});
					intersect.reduce(function (sum, curr) {
						var dist = sum.point.getDistance(curr.point);
						if(dist < sum.dist){
							res.p1 = curr.point;
							sum.dist = dist;
						}
						return sum;
					}, {dist: Infinity, point: res.p1});
				}else{
					return null;
				}

				return res;
			}

			function do_x() {
				for(i = 0; i < by_x.length; i++){

					// в зависимости от типа деления, рисуем прямые или разорванные отрезки
					if(!by_y.length || tool.profile.split.empty() ||
						tool.profile.split == $p.enm.lay_split_types.ДелениеГоризонтальных ||
						tool.profile.split == $p.enm.lay_split_types.КрестПересечение){

						if(pts = get_points([by_x[i], bounds.bottom], [by_x[i], bounds.top]))
							get_path().addSegments([[pts.p1.x-w2x, pts.p1.y], [pts.p2.x-w2x, pts.p2.y], [pts.p2.x+w2x, pts.p2.y], [pts.p1.x+w2x, pts.p1.y]]);

					}else{
						by_y.sort(function (a,b) { return b-a; });
						for(j = 0; j < by_y.length; j++){

							if(j == 0){
								if(hit && (pts = get_points([by_x[i], bounds.bottom], [by_x[i], by_y[j]])))
									get_path().addSegments([[pts.p1.x-w2x, pts.p1.y], [pts.p2.x-w2x, pts.p2.y+w2x], [pts.p2.x+w2x, pts.p2.y+w2x], [pts.p1.x+w2x, pts.p1.y]]);

							}else{
								if(pts = get_points([by_x[i], by_y[j-1]], [by_x[i], by_y[j]]))
									get_path().addSegments([[pts.p1.x-w2x, pts.p1.y-w2x], [pts.p2.x-w2x, pts.p2.y+w2x], [pts.p2.x+w2x, pts.p2.y+w2x], [pts.p1.x+w2x, pts.p1.y-w2x]]);

							}

							if(j == by_y.length -1){
								if(hit && (pts = get_points([by_x[i], by_y[j]], [by_x[i], bounds.top])))
									get_path().addSegments([[pts.p1.x-w2x, pts.p1.y-w2x], [pts.p2.x-w2x, pts.p2.y], [pts.p2.x+w2x, pts.p2.y], [pts.p1.x+w2x, pts.p1.y-w2x]]);

							}

						}
					}
				}
			}

			function do_y() {
				for(i = 0; i < by_y.length; i++){

					// в зависимости от типа деления, рисуем прямые или разорванные отрезки
					if(!by_x.length || tool.profile.split.empty() ||
						tool.profile.split == $p.enm.lay_split_types.ДелениеВертикальных ||
						tool.profile.split == $p.enm.lay_split_types.КрестПересечение){

						if(pts = get_points([bounds.left, by_y[i]], [bounds.right, by_y[i]]))
							get_path().addSegments([[pts.p1.x, pts.p1.y-w2y], [pts.p2.x, pts.p2.y-w2y], [pts.p2.x, pts.p2.y+w2y], [pts.p1.x, pts.p1.y+w2y]]);

					}else{
						by_x.sort(function (a,b) { return a-b; });
						for(j = 0; j < by_x.length; j++){

							if(j == 0){
								if(hit && (pts = get_points([bounds.left, by_y[i]], [by_x[j], by_y[i]])))
									get_path().addSegments([[pts.p1.x, pts.p1.y-w2y], [pts.p2.x-w2y, pts.p2.y-w2y], [pts.p2.x-w2y, pts.p2.y+w2y], [pts.p1.x, pts.p1.y+w2y]]);

							}else{
								if(pts = get_points([by_x[j-1], by_y[i]], [by_x[j], by_y[i]]))
									get_path().addSegments([[pts.p1.x+w2y, pts.p1.y-w2y], [pts.p2.x-w2y, pts.p2.y-w2y], [pts.p2.x-w2y, pts.p2.y+w2y], [pts.p1.x+w2y, pts.p1.y+w2y]]);

							}

							if(j == by_x.length -1){
								if(hit && (pts = get_points([by_x[j], by_y[i]], [bounds.right, by_y[i]])))
									get_path().addSegments([[pts.p1.x+w2y, pts.p1.y-w2y], [pts.p2.x, pts.p2.y-w2y], [pts.p2.x, pts.p2.y+w2y], [pts.p1.x+w2y, pts.p1.y+w2y]]);

							}

						}
					}
				}
			}

			if(stepy){
				if(tool.profile.align_by_y == $p.enm.positions.Центр){

					base = bounds.top + bounds.height / 2;
					if(county % 2){
						by_y.push(base);
					}
					for(i = 1; i < county; i++){

						if(county % 2)
							pos = base + stepy * i;
						else
							pos = base + stepy / 2 + (i > 1 ? stepy * (i - 1) : 0);

						if(pos + w2y + consts.sticking_l < bounds.bottom)
							by_y.push(pos);

						if(county % 2)
							pos = base - stepy * i;
						else
							pos = base - stepy / 2 - (i > 1 ? stepy * (i - 1) : 0);

						if(pos - w2y - consts.sticking_l > bounds.top)
							by_y.push(pos);
					}

				}else if(tool.profile.align_by_y == $p.enm.positions.Верх){

					if(hit){
						for(i = 1; i <= county; i++){
							pos = bounds.top + stepy * i;
							if(pos + w2y + consts.sticking_l < bounds.bottom)
								by_y.push(pos);
						}
					}else{
						for(i = 0; i < county; i++){
							pos = bounds.top + stepy * i;
							if(pos - w2y - consts.sticking_l < bounds.bottom)
								by_y.push(pos);
						}
					}

				}else if(tool.profile.align_by_y == $p.enm.positions.Низ){

					if(hit){
						for(i = 1; i <= county; i++){
							pos = bounds.bottom - stepy * i;
							if(pos - w2y - consts.sticking_l > bounds.top)
								by_y.push(bounds.bottom - stepy * i);
						}
					}else{
						for(i = 0; i < county; i++){
							pos = bounds.bottom - stepy * i;
							if(pos + w2y + consts.sticking_l > bounds.top)
								by_y.push(bounds.bottom - stepy * i);
						}
					}
				}
			}

			if(stepx){
				if(tool.profile.align_by_x == $p.enm.positions.Центр){

					base = bounds.left + bounds.width / 2;
					if(countx % 2){
						by_x.push(base);
					}
					for(i = 1; i < countx; i++){

						if(countx % 2)
							pos = base + stepx * i;
						else
							pos = base + stepx / 2 + (i > 1 ? stepx * (i - 1) : 0);

						if(pos + w2x + consts.sticking_l < bounds.right)
							by_x.push(pos);

						if(countx % 2)
							pos = base - stepx * i;
						else
							pos = base - stepx / 2 - (i > 1 ? stepx * (i - 1) : 0);

						if(pos - w2x - consts.sticking_l > bounds.left)
							by_x.push(pos);
					}

				}else if(tool.profile.align_by_x == $p.enm.positions.Лев){

					if(hit){
						for(i = 1; i <= countx; i++){
							pos = bounds.left + stepx * i;
							if(pos + w2x + consts.sticking_l < bounds.right)
								by_x.push(pos);
						}
					}else{
						for(i = 0; i < countx; i++){
							pos = bounds.left + stepx * i;
							if(pos - w2x - consts.sticking_l < bounds.right)
								by_x.push(pos);
						}
					}


				}else if(tool.profile.align_by_x == $p.enm.positions.Прав){

					if(hit){
						for(i = 1; i <= countx; i++){
							pos = bounds.right - stepx * i;
							if(pos - w2x - consts.sticking_l > bounds.left)
								by_x.push(pos);
						}
					}else{
						for(i = 0; i < countx; i++){
							pos = bounds.right - stepx * i;
							if(pos + w2x + consts.sticking_l > bounds.left)
								by_x.push(pos);
						}
					}
				}
			}

			base = 0;
			if(tool.profile.split == $p.enm.lay_split_types.ДелениеВертикальных){
				do_y();
				do_x();
			}else{
				do_x();
				do_y();
			}

		}
	});

}
ToolLayImpost._extend(ToolElement);

/**
 * ### Панорама и масштабирование с колёсиком и без колёсика
 * 
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2016<br />
 * Created 25.08.2015
 * 
 * @module tools
 * @submodule tool_pan
 */

/**
 * ### Панорама и масштабирование с колёсиком и без колёсика
 * 
 * @class ToolPan
 * @extends ToolElement
 * @constructor
 * @menuorder 52
 * @tooltip Панорама и масштаб
 */
function ToolPan(){

	var _editor = paper,
		tool = this;

	ToolPan.superclass.constructor.call(this);

	tool.options = {name: 'pan'};
	tool.distanceThreshold = 8;
	tool.mouseStartPos = new paper.Point();
	tool.mode = 'pan';
	tool.zoomFactor = 1.1;
	tool.resetHot = function(type, event, mode) {
	};
	tool.testHot = function(type, event, mode) {
		var spacePressed = event && event.modifiers.space;
		if (mode != 'tool-zoompan' && !spacePressed)
			return false;
		return tool.hitTest(event);
	};
	tool.hitTest = function(event) {

		if (event.modifiers.control) {
			_editor.canvas_cursor('cursor-zoom-in');
		} else if (event.modifiers.option) {
			_editor.canvas_cursor('cursor-zoom-out');
		} else {
			_editor.canvas_cursor('cursor-hand');
		}

		return true;
	};
	tool.on({

		activate: function() {
			this.on_activate('cursor-hand');
		},

		deactivate: function() {
		},

		mousedown: function(event) {
			this.mouseStartPos = event.point.subtract(_editor.view.center);
			this.mode = '';
			if (event.modifiers.control || event.modifiers.option) {
				this.mode = 'zoom';
			} else {
				_editor.canvas_cursor('cursor-hand-grab');
				this.mode = 'pan';
			}
		},

		mouseup: function(event) {
			if (this.mode == 'zoom') {
				var zoomCenter = event.point.subtract(_editor.view.center);
				var moveFactor = this.zoomFactor - 1.0;
				if (event.modifiers.control) {
					_editor.view.zoom *= this.zoomFactor;
					_editor.view.center = _editor.view.center.add(zoomCenter.multiply(moveFactor / this.zoomFactor));
				} else if (event.modifiers.option) {
					_editor.view.zoom /= this.zoomFactor;
					_editor.view.center = _editor.view.center.subtract(zoomCenter.multiply(moveFactor));
				}
			} else if (this.mode == 'zoom-rect') {
				var start = _editor.view.center.add(this.mouseStartPos);
				var end = event.point;
				_editor.view.center = start.add(end).multiply(0.5);
				var dx = _editor.view.bounds.width / Math.abs(end.x - start.x);
				var dy = _editor.view.bounds.height / Math.abs(end.y - start.y);
				_editor.view.zoom = Math.min(dx, dy) * _editor.view.zoom;
			}
			this.hitTest(event);
			this.mode = '';
		},
		mousedrag: function(event) {
			if (this.mode == 'zoom') {
				// If dragging mouse while in zoom mode, switch to zoom-rect instead.
				this.mode = 'zoom-rect';
			} else if (this.mode == 'zoom-rect') {
				// While dragging the zoom rectangle, paint the selected area.
				_editor.drag_rect(_editor.view.center.add(this.mouseStartPos), event.point);
			} else if (this.mode == 'pan') {
				// Handle panning by moving the view center.
				var pt = event.point.subtract(_editor.view.center);
				var delta = this.mouseStartPos.subtract(pt);
				_editor.view.scrollBy(delta);
				this.mouseStartPos = pt;
			}
		},

		mousemove: function(event) {
			this.hitTest(event);
		},

		keydown: function(event) {
			this.hitTest(event);
		},

		keyup: function(event) {
			this.hitTest(event);
		}
	});

}
ToolPan._extend(ToolElement);

/**
 * ### Добавление (рисование) профилей
 *
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2016<br />
 * Created 25.08.2015
 *
 * @module tools
 * @submodule tool_pen
 */

/**
 * ### Добавление (рисование) профилей
 *
 * @class ToolPen
 * @extends ToolElement
 * @constructor
 * @menuorder 54
 * @tooltip Рисование
 */
function ToolPen(){

	var _editor = paper,
		tool = this,
		on_layer_activated,
		on_scheme_changed,
		sys;

	ToolPen.superclass.constructor.call(this);

	tool.point1 = new paper.Point();
	tool.last_profile = null;
	tool.mode = null;
	tool.hitItem = null;
	tool.originalContent = null;
	tool.start_binded = false;

	tool.options = {
		name: 'pen',
		wnd: {
			caption: "Новый сегмент профиля",
			width: 320,
			height: 240,
			bind_generatrix: true,
			bind_node: false,
			inset: "",
			clr: ""
		}
	};

	// подключает окно редактора
	function tool_wnd(){

		sys = _editor.project._dp.sys;
		
		// создаём экземпляр обработки
		tool.profile = $p.dp.builder_pen.create();
		
		// восстанавливаем сохранённые параметры
		$p.wsql.restore_options("editor", tool.options);
		["elm_type","inset","bind_generatrix","bind_node"].forEach(function (prop) {
			if(prop == "bind_generatrix" || prop == "bind_node" || tool.options.wnd[prop])
				tool.profile[prop] = tool.options.wnd[prop];
		});

		// если в текущем слое есть профили, выбираем импост
		if((tool.profile.elm_type.empty() || tool.profile.elm_type == $p.enm.elm_types.Рама) &&
			_editor.project.activeLayer instanceof Contour && _editor.project.activeLayer.profiles.length)
			tool.profile.elm_type = $p.enm.elm_types.Импост;

		else if((tool.profile.elm_type.empty() || tool.profile.elm_type == $p.enm.elm_types.Импост) &&
			_editor.project.activeLayer instanceof Contour && !_editor.project.activeLayer.profiles.length)
			tool.profile.elm_type = $p.enm.elm_types.Рама;

		// вставку по умолчанию получаем эмулируя событие изменения типа элемента
		$p.dp.builder_pen.handle_event(tool.profile, "value_change", {
			field: "elm_type"
		});

		// цвет по умолчанию
		tool.profile.clr = _editor.project.clr;

		// параметры отбора для выбора вставок
		tool.profile._metadata.fields.inset.choice_links = [{
			name: ["selection",	"ref"],
			path: [
				function(o, f){
					if($p.utils.is_data_obj(o)){
						return tool.profile.rama_impost.indexOf(o) != -1;

					}else{
						var refs = "";
						tool.profile.rama_impost.forEach(function (o) {
							if(refs)
								refs += ", ";
							refs += "'" + o.ref + "'";
						});
						return "_t_.ref in (" + refs + ")";
					}
				}]
		}];

		// дополняем свойства поля цвет отбором по служебным цветам
		$p.cat.clrs.selection_exclude_service(tool.profile._metadata.fields.clr, sys);

		tool.wnd = $p.iface.dat_blank(_editor._dxw, tool.options.wnd);
		tool._grid = tool.wnd.attachHeadFields({
			obj: tool.profile
		});

		var wnd_options = tool.wnd.wnd_options;
		tool.wnd.wnd_options = function (opt) {
			wnd_options.call(tool.wnd, opt);
			opt.bind_generatrix = tool.profile.bind_generatrix;
			opt.bind_node = tool.profile.bind_node;
		}

	}

	// делает полупрозрачными элементы неактивных контуров
	function decorate_layers(reset){

		var active = _editor.project.activeLayer;

		_editor.project.getItems({class: Contour}).forEach(function (l) {
			l.opacity = (l == active || reset) ? 1 : 0.5;
		})

	}
	
	tool.hitTest = function(event) {

		var hitSize = 16;

		tool.addl_hit = null;
		tool.hitItem = null;

		if(tool.profile.elm_type == $p.enm.elm_types.Добор || tool.profile.elm_type == $p.enm.elm_types.Соединитель){


			// Hit test items.
			if (event.point)
				tool.hitItem = _editor.project.hitTest(event.point, { stroke:true, curves:true, tolerance: hitSize });

			if (tool.hitItem) {

				if(tool.hitItem.item.layer == _editor.project.activeLayer &&  tool.hitItem.item.parent instanceof ProfileItem && !(tool.hitItem.item.parent instanceof Onlay)){
					// для профиля, определяем внешнюю или внутреннюю сторону и ближайшее примыкание

					var hit = {
						point: tool.hitItem.point,
						profile: tool.hitItem.item.parent
					};

					// выясним, с какой стороны примыкает профиль
					if(hit.profile.rays.inner.getNearestPoint(event.point).getDistance(event.point, true) <
							hit.profile.rays.outer.getNearestPoint(event.point).getDistance(event.point, true))
						hit.side = "inner";
					else
						hit.side = "outer";
					
					// бежим по всем заполнениям и находим ребро
					hit.profile.layer.glasses(false, true).some(function (glass) {

						for(var i=0; i<glass.profiles.length; i++){
							var rib = glass.profiles[i];
							if(rib.profile == hit.profile && rib.sub_path && rib.sub_path.getNearestPoint(hit.point).is_nearest(hit.point, true)){

								if(hit.side == "outer" && rib.outer || hit.side == "inner" && !rib.outer){
									hit.rib = i;
									hit.glass = glass;
									return true;
								}
							}
						}
					});

					if(hit.glass){
						tool.addl_hit = hit;
						_editor.canvas_cursor('cursor-pen-adjust');
					}

				}else if(tool.hitItem.item.parent instanceof Filling){
					// для заполнения, ищем ребро и примыкающий профиль

					// tool.addl_hit = tool.hitItem;
					// _editor.canvas_cursor('cursor-pen-adjust');

				}else{
					_editor.canvas_cursor('cursor-pen-freehand');
				}

			} else {

				tool.hitItem = _editor.project.hitTest(event.point, { fill:true, visible: true, tolerance: hitSize  });
				_editor.canvas_cursor('cursor-pen-freehand');
			}

		}else{
			// var hitSize = 4.0; // / view.zoom;
			hitSize = 6;

			// Hit test items.
			if (event.point)
				tool.hitItem = _editor.project.hitTest(event.point, { fill:true, stroke:true, selected: true, tolerance: hitSize });

			if(!tool.hitItem)
				tool.hitItem = _editor.project.hitTest(event.point, { fill:true, visible: true, tolerance: hitSize  });

			if (tool.hitItem && tool.hitItem.item.parent instanceof ProfileItem
				&& (tool.hitItem.type == 'fill' || tool.hitItem.type == 'stroke')) {
				_editor.canvas_cursor('cursor-pen-adjust');

			} else {
				_editor.canvas_cursor('cursor-pen-freehand');
			}
		}


		return true;
	};


	tool.on({

		activate: function() {

			this.on_activate('cursor-pen-freehand');

			this._controls = new PenControls(this);

			tool_wnd();

			if(!on_layer_activated)
				on_layer_activated = $p.eve.attachEvent("layer_activated", function (contour, virt) {

					if(!virt && contour.project == _editor.project && !_editor.project.data._loading && !_editor.project.data._snapshot){
						decorate_layers();
					}
				});

			// при изменении системы, переоткрываем окно доступных вставок
			if(!on_scheme_changed)
				on_scheme_changed = $p.eve.attachEvent("scheme_changed", function (scheme) {
				if(scheme == _editor.project && sys != scheme._dp.sys){

					delete tool.profile._metadata.fields.inset.choice_links;
					tool.detache_wnd();
					tool_wnd();

				}
			});

			decorate_layers();

		},

		deactivate: function() {
			_editor.clear_selection_bounds();

			if(on_layer_activated){
				$p.eve.detachEvent(on_layer_activated);
				on_layer_activated = null;
			}

			if(on_scheme_changed){
				$p.eve.detachEvent(on_scheme_changed);
				on_scheme_changed = null;
			}

			decorate_layers(true);

			delete tool.profile._metadata.fields.inset.choice_links;

			tool.detache_wnd();

			if(this.path){
				this.path.removeSegments();
				this.path.remove();
			}
			this.path = null;
			this.last_profile = null;
			this.mode = null;

			tool._controls.unload();

		},

		mousedown: function(event) {

			_editor.project.deselectAll();

			tool.last_profile = null;

			if(tool.profile.elm_type == $p.enm.elm_types.Добор || tool.profile.elm_type == $p.enm.elm_types.Соединитель){

				// для доборов и соединителей, создаём элемент, если есть addl_hit
				if(this.addl_hit){

				}

			}else{

				if(this.mode == 'continue'){
					// для профилей и раскладок, начинаем рисовать
					this.mode = 'create';
					this.start_binded = false;

				}
			}
		},

		mouseup: function(event) {

			_editor.canvas_cursor('cursor-pen-freehand');

			this.check_layer();

			var whas_select;

			if(this.addl_hit && this.addl_hit.glass && this.profile.elm_type == $p.enm.elm_types.Добор && !this.profile.inset.empty()){
				// рисуем доборный профиль
				new ProfileAddl({
					generatrix: this.addl_hit.generatrix,
					proto: this.profile,
					parent: this.addl_hit.profile,
					side: this.addl_hit.side
				});


			}else if(this.mode == 'create' && this.path) {

				if(this.profile.elm_type == $p.enm.elm_types.Раскладка){

					// находим заполнение под линией
					_editor.project.activeLayer.glasses(false, true).some(function (glass) {

						if(glass.contains(this.path.firstSegment.point) && glass.contains(this.path.lastSegment.point)){
							new Onlay({
								generatrix: this.path,
								proto: this.profile,
								parent: glass
							});
							this.path = null;
							return true;
						}
						
					}.bind(this));



				}else{
					// Рисуем профиль
					this.last_profile = new Profile({generatrix: this.path, proto: this.profile});

				}

				this.path = null;

			}else if (this.hitItem && this.hitItem.item && (event.modifiers.shift || event.modifiers.control || event.modifiers.option)) {

				var item = this.hitItem.item;

				// TODO: Выделяем элемент, если он подходящего типа
				if(item.parent instanceof ProfileItem && item.parent.isInserted()){
					item.parent.attache_wnd(paper._acc.elm.cells("a"));
					item.parent.generatrix.selected = true;
					whas_select = true;
					tool._controls.blur();

				}else if(item.parent instanceof Filling && item.parent.visible){
					item.parent.attache_wnd(paper._acc.elm.cells("a"));
					item.selected = true;
					whas_select = true;
					tool._controls.blur();
				}

				if(item.selected && item.layer)
					item.layer.activate(true);

			}

			if(!whas_select && !this.mode && !this.addl_hit) {

				this.mode = 'continue';
				this.point1 = tool._controls.point;

				if (!this.path){
					this.path = new paper.Path({
						strokeColor: 'black',
						segments: [this.point1]
					});
					this.currentSegment = this.path.segments[0];
					this.originalHandleIn = this.currentSegment.handleIn.clone();
					this.originalHandleOut = this.currentSegment.handleOut.clone();
					this.currentSegment.selected = true;
				}
				this.start_binded = false;
				return;

			}

			if(this.path){
				this.path.remove();
				this.path = null;
			}				
			this.mode = null;

		},

		mousemove: function(event) {

			this.hitTest(event);

			// елси есть addl_hit - рисуем прототип элемента
			if(this.addl_hit && this.addl_hit.glass){

				if (!this.path){
					this.path = new paper.Path({
						strokeColor: 'black',
						fillColor: 'white',
						strokeScaling: false,
						guide: true
					});
				}

				this.path.removeSegments();

				// находим 2 точки на примыкающем профиле и 2 точки на предыдущем и последующем сегментах
				var profiles = this.addl_hit.glass.profiles,
					prev = this.addl_hit.rib==0 ? profiles[profiles.length-1] : profiles[this.addl_hit.rib-1],
					curr = profiles[this.addl_hit.rib],
					next = this.addl_hit.rib==profiles.length-1 ? profiles[0] : profiles[this.addl_hit.rib+1];

				var path_prev = prev.outer ? prev.profile.rays.outer : prev.profile.rays.inner,
					path_curr = curr.outer ? curr.profile.rays.outer : curr.profile.rays.inner,
					path_next = next.outer ? next.profile.rays.outer : next.profile.rays.inner;

				var p1 = path_curr.intersect_point(path_prev, curr.b),
					p2 = path_curr.intersect_point(path_next, curr.e),
					sub_path = path_curr.get_subpath(p1, p2);
					
				// рисуем внушнюю часть прототипа пути доборного профиля
				this.path.addSegments(sub_path.segments);

				// завершим рисование прототипа пути доборного профиля
				sub_path = sub_path.equidistant(-(this.profile.inset.nom().width || 20));
				sub_path.reverse();
				this.path.addSegments(sub_path.segments);
				sub_path.removeSegments();
				sub_path.remove();
				this.path.closePath();

				// получаем generatrix
				if(!this.addl_hit.generatrix){
					this.addl_hit.generatrix = new paper.Path({insert: false});
				}
				p1 = prev.profile.generatrix.getNearestPoint(p1);
				p2 = next.profile.generatrix.getNearestPoint(p2);
				this.addl_hit.generatrix.removeSegments();
				this.addl_hit.generatrix.addSegments(path_curr.get_subpath(p1, p2).segments);
				

			}else if(this.path){

				if(this.mode){

					var delta = event.point.subtract(this.point1),
						dragIn = false,
						dragOut = false,
						invert = false,
						handlePos;

					if (delta.length < consts.sticking)
						return;

					if (this.mode == 'create') {
						dragOut = true;
						if (this.currentSegment.index > 0)
							dragIn = true;
					} else  if (this.mode == 'close') {
						dragIn = true;
						invert = true;
					} else  if (this.mode == 'continue') {
						dragOut = true;
					} else if (this.mode == 'adjust') {
						dragOut = true;
					} else  if (this.mode == 'join') {
						dragIn = true;
						invert = true;
					} else  if (this.mode == 'convert') {
						dragIn = true;
						dragOut = true;
					}

					if (dragIn || dragOut) {
						var i, res, element, bind = this.profile.bind_node ? "node_" : "";

						if(this.profile.bind_generatrix)
							bind += "generatrix";

						if (invert)
							delta = delta.negate();

						if (dragIn && dragOut) {
							handlePos = this.originalHandleOut.add(delta);
							if (event.modifiers.shift)
								handlePos = handlePos.snap_to_angle();
							this.currentSegment.handleOut = handlePos;
							this.currentSegment.handleIn = handlePos.negate();

						} else if (dragOut) {
							// upzp

							if (event.modifiers.shift)
								delta = delta.snap_to_angle();
							
							if(this.path.segments.length > 1)
								this.path.lastSegment.point = this.point1.add(delta);
							else
								this.path.add(this.point1.add(delta));

							// попытаемся привязать начало пути к профилям (и или заполнениям - для раскладок) контура
							if(!this.start_binded){

								if(this.profile.elm_type == $p.enm.elm_types.Раскладка){

									res = Onlay.prototype.bind_node(this.path.firstSegment.point, _editor.project.activeLayer.glasses(false, true));
									if(res.binded)
										tool.path.firstSegment.point = tool.point1 = res.point;

								}else{

									res = {distance: Infinity};
									for(i in _editor.project.activeLayer.children){

										element = _editor.project.activeLayer.children[i];
										if (element instanceof Profile){

											// сначала смотрим на доборы, затем - на сам профиль
											if(element.children.some(function (addl) {
													if(addl instanceof ProfileAddl && _editor.project.check_distance(addl, null, res, tool.path.firstSegment.point, bind) === false){
														tool.path.firstSegment.point = tool.point1 = res.point;
														return true;
													}
												})){
												break;

											}else if (_editor.project.check_distance(element, null, res, this.path.firstSegment.point, bind) === false ){
												tool.path.firstSegment.point = tool.point1 = res.point;
												break;
											}
										}
									}
									this.start_binded = true;
								}
							}

							// попытаемся привязать конец пути к профилям (и или заполнениям - для раскладок) контура
							if(this.profile.elm_type == $p.enm.elm_types.Раскладка){

								res = Onlay.prototype.bind_node(this.path.lastSegment.point, _editor.project.activeLayer.glasses(false, true));
								if(res.binded)
									this.path.lastSegment.point = res.point;

							}else{

								res = {distance: Infinity};
								for(i = 0; i < _editor.project.activeLayer.children.length; i++){

									element = _editor.project.activeLayer.children[i];
									if (element instanceof Profile){

										// сначала смотрим на доборы, затем - на сам профиль
										if(element.children.some(function (addl) {
												if(addl instanceof ProfileAddl && _editor.project.check_distance(addl, null, res, tool.path.lastSegment.point, bind) === false){
													tool.path.lastSegment.point = res.point;
													return true;
												}
											})){
											break;

										}else if (_editor.project.check_distance(element, null, res, this.path.lastSegment.point, bind) === false ){
											this.path.lastSegment.point = res.point;
											break;

										}
									}
								}
							}

							//this.currentSegment.handleOut = handlePos;
							//this.currentSegment.handleIn = handlePos.normalize(-this.originalHandleIn.length);
						} else {
							handlePos = this.originalHandleIn.add(delta);
							if (event.modifiers.shift)
								handlePos = handlePos.snap_to_angle();
							this.currentSegment.handleIn = handlePos;
							this.currentSegment.handleOut = handlePos.normalize(-this.originalHandleOut.length);
						}
						this.path.selected = true;
					}

				}else{
					this.path.removeSegments();
					this.path.remove();
					this.path = null;
				}

				if(event.className != "ToolEvent"){
					_editor.project.register_update();
				}
			}

		},

		keydown: function(event) {

			// удаление сегмента или элемента
			if (event.key == '-' || event.key == 'delete' || event.key == 'backspace') {

				if(event.event && event.event.target && ["textarea", "input"].indexOf(event.event.target.tagName.toLowerCase())!=-1)
					return;

				paper.project.selectedItems.forEach(function (path) {
					if(path.parent instanceof ProfileItem){
						path = path.parent;
						path.removeChildren();
						path.remove();
					}
				});

				this.mode = null;
				this.path = null;

				event.stop();
				return false;

			}else if(event.key == 'escape'){

				if(this.path){
					this.path.remove();
					this.path = null;
				}
				this.mode = null;
				this._controls.blur();
			}
		}
	});


}
ToolPen._extend(ToolElement);

/**
 * ### Элементы управления рядом с указателем мыши инструмента `ToolPen`
 *
 * @class PenControls
 * @constructor
 */
function PenControls(tool) {

	var _editor = paper,
		t = this;

	t._cont = document.createElement('div');
	
	function mousemove(event, ignore_pos) {

		var bounds = _editor.project.bounds,
			pos = ignore_pos || _editor.project.view.projectToView(event.point);

		if(!ignore_pos){
			t._cont.style.top = pos.y + 16 + "px";
			t._cont.style.left = pos.x - 20 + "px";

		}

		if(bounds){
			t._x.value = (event.point.x - bounds.x).toFixed(0);
			t._y.value = (bounds.height + bounds.y - event.point.y).toFixed(0);

			if(!ignore_pos){

				if(tool.path){
					t._l.value = tool.point1.getDistance(t.point).round(1);
					var p = t.point.subtract(tool.point1);
					p.y = -p.y;
					var angle = p.angle;
					if(angle < 0)
						angle += 360;
					t._a.value = angle.round(1);

				}else{
					t._l.value = 0;
					t._a.value = 0;
				}

			}

		}

	}
	
	function input_change() {
		
		switch(this.name) {

			case 'x':
			case 'y':
				setTimeout(function () {
					tool.emit("mousemove", {
						point: t.point,
						modifiers: {}
					});
				});
				break;

			case 'l':
			case 'a':

				if(!tool.path)
					return false;

				var p = new paper.Point();
				p.length = parseFloat(t._l.value || 0);
				p.angle = parseFloat(t._a.value || 0);
				p.y = -p.y;

				mousemove({point: tool.point1.add(p)}, true);

				input_change.call({name: "x"});
				break;
		} 
	}

	function create_click() {
		setTimeout(function () {
			tool.emit("mousedown", {
				modifiers: {}
			});
			setTimeout(function () {

				if(tool.mode == 'create' && tool.path){
					setTimeout(function () {
						if(tool.last_profile){
							mousemove({point: tool.last_profile.e}, true);
							tool.last_profile = null;
							create_click();
						}
					}, 50);
				}

				tool.emit("mouseup", {
					point: t.point,
					modifiers: {}
				});
			});
		});
	}

	_editor._wrapper.appendChild(t._cont);
	t._cont.className = "pen_cont";
	_editor.project.view.on('mousemove', mousemove);

	t._cont.innerHTML = "<table><tr><td>x:</td><td><input type='number' name='x' /></td><td>y:</td><td><input type='number' name='y' /></td></tr>" +
		"<tr><td>l:</td><td><input type='number' name='l' /></td><td>α:</td><td><input type='number' name='a' /></td></tr>" +
		"<tr><td colspan='4'><input type='button' name='click' value='Создать точку' /></td></tr></table>";

	t._x = t._cont.querySelector("[name=x]");
	t._y = t._cont.querySelector("[name=y]");
	t._l = t._cont.querySelector("[name=l]");
	t._a = t._cont.querySelector("[name=a]");

	t._x.onchange = input_change;
	t._y.onchange = input_change;
	t._l.onchange = input_change;
	t._a.onchange = input_change;

	t._cont.querySelector("[name=click]").onclick = create_click;
	
	this.unload = function () {
		_editor.project.view.off('mousemove', mousemove);
		_editor._wrapper.removeChild(t._cont);
		t._cont = null;
	}
}
PenControls.prototype.__define({

	point: {
		get: function () {
			var bounds = paper.project.bounds,
				x = parseFloat(this._x.value || 0) + (bounds ? bounds.x : 0),
				y = (bounds ? (bounds.height + bounds.y) : 0) - parseFloat(this._y.value || 0);
			return new paper.Point([x, y]);
		}
	},

	blur: {
		value: function () {
			var focused = document.activeElement;
			if(focused == this._x)
				this._x.blur();
			else if(focused == this._y)
				this._y.blur();
			else if(focused == this._l)
				this._l.blur();
			else if(focused == this._a)
				this._a.blur();
		}
	}
});

/**
 * Относительное позиционирование и сдвиг
 * Created 25.08.2015<br />
 * &copy; http://www.oknosoft.ru 2014-2015
 * @author    Evgeniy Malyarov
 * @module  tool_ruler
 */

/**
 * ### Относительное позиционирование и сдвиг
 * 
 * @class ToolRuler
 * @extends ToolElement
 * @constructor
 * @menuorder 57
 * @tooltip Позиция и сдвиг
 */
function ToolRuler(){

	ToolRuler.superclass.constructor.call(this);

	this.mouseStartPos = new paper.Point();
	this.hitItem = null;
	this.hitPoint = null;
	this.changed = false;
	this.minDistance = 10;
	this.selected = {
		a: [],
		b: []
	};

	this.options = {
		name: 'ruler',
		mode: 0,
		wnd: {
			caption: "Размеры и сдвиг",
			height: 200
		}
	};

	var modes = ["Элементы","Узлы","Новая линия","Новая линия узел2"];
	this.__define({
		mode: {
			get: function () {
				return this.options.mode || 0;
			},
			set: function (v) {
				paper.project.deselectAll();
				this.options.mode = parseInt(v);
			}
		}
	});


	this.hitTest = function(event) {

		this.hitItem = null;
		this.hitPoint = null;

		if (event.point){

			// ловим профили, а точнее - заливку путей
			this.hitItem = paper.project.hitTest(event.point, { fill:true, tolerance: 10 });

			// Hit test points
			var hit = paper.project.hitPoints(event.point, 20);
			if (hit && hit.item.parent instanceof ProfileItem){
				this.hitItem = hit;
			}
		}

		if (this.hitItem && this.hitItem.item.parent instanceof ProfileItem) {

			if(this.mode){
				var elm = this.hitItem.item.parent,
					corn = elm.corns(event.point);

				if(corn.dist < consts.sticking){
					paper.canvas_cursor('cursor-arrow-white-point');
					this.hitPoint = corn;
					elm.select_corn(event.point);
				}
				else
					paper.canvas_cursor('cursor-arrow-ruler');
			}

		} else {
			if(this.mode)
				paper.canvas_cursor('cursor-text-select');
			else
				paper.canvas_cursor('cursor-arrow-ruler-light');
			this.hitItem = null;
		}

		return true;
	};

	this.remove_path = function () {
		if (this.path){
			this.path.removeSegments();
			this.path.remove();
			this.path = null;
		}

		if (this.path_text){
			this.path_text.remove();
			this.path_text = null;
		}
	};

	this.on({

		activate: function() {

			this.selected.a.length = 0;
			this.selected.b.length = 0;

			this.on_activate('cursor-arrow-ruler-light');

			paper.project.deselectAll();
			this.wnd = new RulerWnd(this.options, this);
			this.wnd.size = 0;
		},

		deactivate: function() {

			this.remove_path();

			this.detache_wnd();

		},

		mousedown: function(event) {

			if (this.hitItem) {

				if(this.mode > 1 && this.hitPoint){

					if(this.mode == 2){

						this.selected.a.push(this.hitPoint);

						if (!this.path){
							this.path = new paper.Path({
								parent: this.hitPoint.profile.layer.l_dimensions,
								segments: [this.hitPoint.point, event.point]
							});
							this.path.strokeColor = 'black';
						}

						this.mode = 3;

					}else {

						this.remove_path();

						this.selected.b.push(this.hitPoint);
						
						// создаём размерную линию
						new DimensionLineCustom({
							elm1: this.selected.a[0].profile,
							elm2: this.hitPoint.profile,
							p1: this.selected.a[0].point_name,
							p2: this.hitPoint.point_name,
							parent: this.hitPoint.profile.layer.l_dimensions
						});

						this.mode = 2;

						this.hitPoint.profile.project.register_change(true);

					}

				}else{

					var item = this.hitItem.item.parent;

					if (paper.Key.isDown('1') || paper.Key.isDown('a')) {

						item.path.selected = true;

						if(this.selected.a.indexOf(item) == -1)
							this.selected.a.push(item);

						if(this.selected.b.indexOf(item) != -1)
							this.selected.b.splice(this.selected.b.indexOf(item), 1);

					} else if (paper.Key.isDown('2') || paper.Key.isDown('b') ||
						event.modifiers.shift || (this.selected.a.length && !this.selected.b.length)) {

						item.path.selected = true;

						if(this.selected.b.indexOf(item) == -1)
							this.selected.b.push(item);

						if(this.selected.a.indexOf(item) != -1)
							this.selected.a.splice(this.selected.a.indexOf(item), 1);

					}else {
						paper.project.deselectAll();
						item.path.selected = true;
						this.selected.a.length = 0;
						this.selected.b.length = 0;
						this.selected.a.push(item);
					}

					// Если выделено 2 элемента, рассчитаем сдвиг
					if(this.selected.a.length && this.selected.b.length){
						if(this.selected.a[0].orientation == this.selected.b[0].orientation){
							if(this.selected.a[0].orientation == $p.enm.orientations.Вертикальная){
								this.wnd.size = Math.abs(this.selected.a[0].b.x - this.selected.b[0].b.x);

							}else if(this.selected.a[0].orientation == $p.enm.orientations.Горизонтальная){
								this.wnd.size = Math.abs(this.selected.a[0].b.y - this.selected.b[0].b.y);

							}else{
								// для наклонной ориентации используем interiorpoint

							}
						}

					}else if(this.wnd.size != 0)
						this.wnd.size = 0;
				}

			}else {

				this.remove_path();
				this.mode = 2;

				paper.project.deselectAll();
				this.selected.a.length = 0;
				this.selected.b.length = 0;
				if(this.wnd.size != 0)
					this.wnd.size = 0;
			}

		},

		mouseup: function(event) {


		},

		mousedrag: function(event) {

		},

		mousemove: function(event) {
			this.hitTest(event);

			if(this.mode == 3 && this.path){

				if(this.path.segments.length == 4)
					this.path.removeSegments(1, 3, true);

				if(!this.path_text)
					this.path_text = new paper.PointText({
						justification: 'center',
						fillColor: 'black',
						fontSize: 72});

				this.path.lastSegment.point = event.point;
				var length = this.path.length;
				if(length){
					var normal = this.path.getNormalAt(0).multiply(120);
					this.path.insertSegments(1, [this.path.firstSegment.point.add(normal), this.path.lastSegment.point.add(normal)]);
					this.path.firstSegment.selected = true;
					this.path.lastSegment.selected = true;

					this.path_text.content = length.toFixed(0);
					//this.path_text.rotation = e.subtract(b).angle;
					this.path_text.point = this.path.curves[1].getPointAt(.5, true);

				}else
					this.path_text.visible = false;
			}

		},

		keydown: function(event) {

			// удаление размерной линии
			if (event.key == '-' || event.key == 'delete' || event.key == 'backspace') {

				if(event.event && event.event.target && ["textarea", "input"].indexOf(event.event.target.tagName.toLowerCase())!=-1)
					return;

				paper.project.selectedItems.some(function (path) {
					if(path.parent instanceof DimensionLineCustom){
						path.parent.remove();
						return true;
					}
				});

				// Prevent the key event from bubbling
				event.stop();
				return false;

			}
		}

	});

	$p.eve.attachEvent("sizes_wnd", this._sizes_wnd.bind(this));

}
ToolRuler._extend(ToolElement);

ToolRuler.prototype.__define({

	_move_points: {
		value: function (event, xy) {

			// сортируем группы выделенных элеметов по правл-лево или верх-низ
			// left_top == true, если элементы в массиве _a_ выше или левее элементов в массиве _b_
			var pos1 = this.selected.a.reduce(function(sum, curr) {
					return sum + curr.b[xy] + curr.e[xy];
				}, 0) / (this.selected.a.length * 2),
				pos2 = this.selected.b.reduce(function(sum, curr) {
					return sum + curr.b[xy] + curr.e[xy];
				}, 0) / (this.selected.b.length * 2),
				delta = Math.abs(pos2 - pos1),
				to_move;

			if(xy == "x")
				if(event.name == "right")
					delta = new paper.Point(event.size - delta, 0);
				else
					delta = new paper.Point(delta - event.size, 0);
			else{
				if(event.name == "bottom")
					delta = new paper.Point(0, event.size - delta);
				else
					delta = new paper.Point(0, delta - event.size);
			}

			if(delta.length){

				paper.project.deselectAll();

				if(event.name == "right" || event.name == "bottom")
					to_move = pos1 < pos2 ? this.selected.b : this.selected.a;
				else
					to_move = pos1 < pos2 ? this.selected.a : this.selected.b;

				to_move.forEach(function (p) {
					p.generatrix.segments.forEach(function (segm) {
						segm.selected = true;
					})
				});

				paper.project.move_points(delta);
				setTimeout(function () {
					paper.project.deselectAll();
					this.selected.a.forEach(function (p) {
						p.path.selected = true;
					});
					this.selected.b.forEach(function (p) {
						p.path.selected = true;
					});
					paper.project.register_update();
				}.bind(this), 200);
			}

		}
	},

	_sizes_wnd: {
		value: function (event) {

			if(event.wnd == this.wnd){

				if(!this.selected.a.length || !this.selected.b.length)
					return;

				switch(event.name) {

					case 'left':
					case 'right':
						if(this.selected.a[0].orientation == $p.enm.orientations.Вертикальная)
							this._move_points(event, "x");
						break;

					case 'top':
					case 'bottom':
						if(this.selected.a[0].orientation == $p.enm.orientations.Горизонтальная)
							this._move_points(event, "y");
						break;
				}
			}
		}
	}

});

function RulerWnd(options, tool){

	if(!options)
		options = {
			name: 'sizes',
			wnd: {
				caption: "Размеры и сдвиг",
				height: 200,
				allow_close: true,
				modal: true
			}
		};
	$p.wsql.restore_options("editor", options);
	options.wnd.on_close = function () {

		if(wnd.elmnts.calck && wnd.elmnts.calck.obj && wnd.elmnts.calck.obj.removeSelf)
			wnd.elmnts.calck.obj.removeSelf();

		$p.eve.detachEvent(wnd_keydown);

		$p.eve.callEvent("sizes_wnd", [{
			wnd: wnd,
			name: "close",
			size: wnd.size,
			tool: tool
		}]);

		wnd = null;

		return true;
	};

	var wnd = $p.iface.dat_blank(paper._dxw, options.wnd),
		
		wnd_keydown = $p.eve.attachEvent("keydown", function (ev) {

			if(wnd){
				switch(ev.keyCode) {
					case 27:        // закрытие по {ESC}
						wnd.close();
						break;
					case 37:        // left
						on_button_click({
							currentTarget: {name: "left"}
						});
						break;
					case 38:        // up
						on_button_click({
							currentTarget: {name: "top"}
						});
						break;
					case 39:        // right
						on_button_click({
							currentTarget: {name: "right"}
						});
						break;
					case 40:        // down
						on_button_click({
							currentTarget: {name: "bottom"}
						});
						break;

					case 109:       // -
					case 46:        // del
					case 8:         // backspace
						if(ev.target && ["textarea", "input"].indexOf(ev.target.tagName.toLowerCase())!=-1)
							return;

						paper.project.selectedItems.some(function (path) {
							if(path.parent instanceof DimensionLineCustom){
								path.parent.remove();
								return true;
							}
						});

						// Prevent the key event from bubbling
						return $p.iface.cancel_bubble(ev);

						break;
				}
				return $p.iface.cancel_bubble(ev);
			}
			
		}),
		div=document.createElement("table"),
		table, input;

	function on_button_click(e){

		if(!paper.project.selectedItems.some(function (path) {
				if(path.parent instanceof DimensionLineCustom){

					switch(e.currentTarget.name) {

						case "left":
						case "bottom":
							path.parent.offset -= 20;
							break;

						case "top":
						case "right":
							path.parent.offset += 20;
							break;

					}

					return true;
				}
			})){

			$p.eve.callEvent("sizes_wnd", [{
				wnd: wnd,
				name: e.currentTarget.name,
				size: wnd.size,
				tool: tool
			}]);
		}
	}

	div.innerHTML='<tr><td ></td><td align="center"></td><td></td></tr>' +
		'<tr><td></td><td><input type="text" style="width: 70px;  text-align: center;" readonly ></td><td></td></tr>' +
		'<tr><td></td><td align="center"></td><td></td></tr>';
	div.style.width = "130px";
	div.style.margin = "auto";
	div.style.borderSpacing = 0;
	table = div.firstChild.childNodes;

	$p.iface.add_button(table[0].childNodes[1], null,
		{name: "top", css: 'tb_align_top', tooltip: $p.msg.align_set_top}).onclick = on_button_click;
	$p.iface.add_button(table[1].childNodes[0], null,
		{name: "left", css: 'tb_align_left', tooltip: $p.msg.align_set_left}).onclick = on_button_click;
	$p.iface.add_button(table[1].childNodes[2], null,
		{name: "right", css: 'tb_align_right', tooltip: $p.msg.align_set_right}).onclick = on_button_click;
	$p.iface.add_button(table[2].childNodes[1], null,
		{name: "bottom", css: 'tb_align_bottom', tooltip: $p.msg.align_set_bottom}).onclick = on_button_click;

	wnd.attachObject(div);

	if(tool instanceof ToolRuler){

		div.style.marginTop = "22px";

		wnd.tb_mode = new $p.iface.OTooolBar({
			wrapper: wnd.cell,
			width: '100%',
			height: '28px',
			class_name: "",
			name: 'tb_mode',
			buttons: [
				{name: '0', img: 'ruler_elm.png', tooltip: $p.msg.ruler_elm, float: 'left'},
				{name: '1', img: 'ruler_node.png', tooltip: $p.msg.ruler_node, float: 'left'},
				{name: '2', img: 'ruler_arrow.png', tooltip: $p.msg.ruler_new_line, float: 'left'},

				{name: 'sep_0', text: '', float: 'left'},
				{name: 'base', img: 'ruler_base.png', tooltip: $p.msg.ruler_base, float: 'left'},
				{name: 'inner', img: 'ruler_inner.png', tooltip: $p.msg.ruler_inner, float: 'left'},
				{name: 'outer', img: 'ruler_outer.png', tooltip: $p.msg.ruler_outer, float: 'left'}
			],
			image_path: "dist/imgs/",
			onclick: function (name) {
				
				if(['0','1','2'].indexOf(name) != -1){
					wnd.tb_mode.select(name);
					tool.mode = name;						
				}else{
					['base','inner','outer'].forEach(function (btn) {
						if(btn != name)
							wnd.tb_mode.buttons[btn].classList.remove("muted");
					});
					wnd.tb_mode.buttons[name].classList.add("muted");
				}

				return false;
			}
		});

		wnd.tb_mode.select(options.mode);
		wnd.tb_mode.buttons.base.classList.add("muted");
		wnd.tb_mode.cell.style.backgroundColor = "#f5f5f5";
	}

	input = table[1].childNodes[1];
	input.grid = {
		editStop: function (v) {
			$p.eve.callEvent("sizes_wnd", [{
				wnd: wnd,
				name: "size_change",
				size: wnd.size,
				tool: tool
			}]);
		},
		getPosition: function (v) {
			var offsetLeft = v.offsetLeft, offsetTop = v.offsetTop;
			while ( v = v.offsetParent ){
				offsetLeft += v.offsetLeft;
				offsetTop  += v.offsetTop;
			}
			return [offsetLeft + 7, offsetTop + 9];
		}
	};

	input.firstChild.onfocus = function (e) {
		wnd.elmnts.calck = new eXcell_calck(this);
		wnd.elmnts.calck.edit();
	};

	wnd.__define({
		size: {
			get: function () {
				return parseFloat(input.firstChild.value);
			},
			set: function (v) {
				input.firstChild.value = parseFloat(v).round(1);
			}
		}
	});

	setTimeout(function () {
		input.firstChild.focus();
	}, 100);

	

	return wnd;
}
/**
 * ### Свойства и перемещение узлов элемента
 *
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2016<br />
 * Created 25.08.2015
 *
 * @module tools
 * @submodule tool_select_node
 */

/**
 * ### Свойства и перемещение узлов элемента
 *
 * @class ToolSelectNode
 * @extends ToolElement
 * @constructor
 * @menuorder 51
 * @tooltip Узлы и элементы
 */
function ToolSelectNode(){

	var tool = this;

	ToolSelectNode.superclass.constructor.call(this);

	tool.mouseStartPos = new paper.Point();
	tool.mode = null;
	tool.hitItem = null;
	tool.originalContent = null;
	tool.originalHandleIn = null;
	tool.originalHandleOut = null;
	tool.changed = false;
	tool.minDistance = 10;

	tool.options = {
		name: 'select_node',
		wnd: {
			caption: "Свойства элемента",
			height: 380
		}};

	tool.resetHot = function(type, event, mode) {
	};
	tool.testHot = function(type, event, mode) {
		if (mode != 'tool-direct-select')
			return;
		return tool.hitTest(event);
	};
	tool.hitTest = function(event) {
		var hitSize = 6;
		var hit = null;
		tool.hitItem = null;

		if (event.point){

			// отдаём предпочтение выделенным ранее элементам
			tool.hitItem = paper.project.hitTest(event.point, { selected: true, fill:true, tolerance: hitSize });

			// во вторую очередь - тем элементам, которые не скрыты
			if (!tool.hitItem)
				tool.hitItem = paper.project.hitTest(event.point, { fill:true, visible: true, tolerance: hitSize });

			// Hit test selected handles
			hit = paper.project.hitTest(event.point, { selected: true, handles: true, tolerance: hitSize });
			if (hit)
				tool.hitItem = hit;

			// Hit test points
			hit = paper.project.hitPoints(event.point, 20);

			if (hit){
				if(hit.item.parent instanceof ProfileItem){
					if(hit.item.parent.generatrix === hit.item)
						tool.hitItem = hit;
				}else
					tool.hitItem = hit;
			}

		}

		if (tool.hitItem) {
			if (tool.hitItem.type == 'fill' || tool.hitItem.type == 'stroke') {
				if (tool.hitItem.item instanceof paper.PointText){

				}else if (tool.hitItem.item.selected) {
					paper.canvas_cursor('cursor-arrow-small');

				} else {
					paper.canvas_cursor('cursor-arrow-white-shape');

				}

			} else if (tool.hitItem.type == 'segment' || tool.hitItem.type == 'handle-in' || tool.hitItem.type == 'handle-out') {
				if (tool.hitItem.segment.selected) {
					paper.canvas_cursor('cursor-arrow-small-point');
				} else {
					paper.canvas_cursor('cursor-arrow-white-point');
				}
			}
		} else {
			paper.canvas_cursor('cursor-arrow-white');
		}

		return true;
	};
	tool.on({

		activate: function() {
			this.on_activate('cursor-arrow-white');
		},

		deactivate: function() {
			paper.clear_selection_bounds();
			if(tool.profile){
				tool.profile.detache_wnd();
				delete tool.profile;
			}
		},

		mousedown: function(event) {
			this.mode = null;
			this.changed = false;

			if(event.event.which == 3){

			}

			if (tool.hitItem && !event.modifiers.alt) {

				var is_profile = tool.hitItem.item.parent instanceof ProfileItem,
					item = is_profile ? tool.hitItem.item.parent.generatrix : tool.hitItem.item;

				if (tool.hitItem.type == 'fill' || tool.hitItem.type == 'stroke') {

					if (event.modifiers.shift) {
						item.selected = !item.selected;
					} else {
						paper.project.deselectAll();
						item.selected = true;
					}
					if (item.selected) {
						this.mode = consts.move_shapes;
						paper.project.deselect_all_points();
						this.mouseStartPos = event.point.clone();
						this.originalContent = paper.capture_selection_state();

						if(item.layer)
							$p.eve.callEvent("layer_activated", [item.layer]);
					}

				} else if (tool.hitItem.type == 'segment') {
					if (event.modifiers.shift) {
						tool.hitItem.segment.selected = !tool.hitItem.segment.selected;
					} else {
						if (!tool.hitItem.segment.selected){
							paper.project.deselect_all_points();
							paper.project.deselectAll();
						}
						tool.hitItem.segment.selected = true;
					}
					if (tool.hitItem.segment.selected) {
						this.mode = consts.move_points;
						this.mouseStartPos = event.point.clone();
						this.originalContent = paper.capture_selection_state();
					}
				} else if (tool.hitItem.type == 'handle-in' || tool.hitItem.type == 'handle-out') {
					this.mode = consts.move_handle;
					this.mouseStartPos = event.point.clone();
					this.originalHandleIn = tool.hitItem.segment.handleIn.clone();
					this.originalHandleOut = tool.hitItem.segment.handleOut.clone();

					/* if (tool.hitItem.type == 'handle-out') {
					 this.originalHandlePos = tool.hitItem.segment.handleOut.clone();
					 this.originalOppHandleLength = tool.hitItem.segment.handleIn.length;
					 } else {
					 this.originalHandlePos = tool.hitItem.segment.handleIn.clone();
					 this.originalOppHandleLength = tool.hitItem.segment.handleOut.length;
					 }
					 this.originalContent = capture_selection_state(); // For some reason this does not work!
					 */
				}

				// подключаем диадог свойств элемента
				if(is_profile || item.parent instanceof Filling){
					item.parent.attache_wnd(this._scope._acc.elm.cells("a"));
					this.profile = item.parent;
				}

				paper.clear_selection_bounds();

			} else {
				// Clicked on and empty area, engage box select.
				this.mouseStartPos = event.point.clone();
				this.mode = 'box-select';

				if(!event.modifiers.shift && this.profile){
					this.profile.detache_wnd();
					delete this.profile;
				}

			}
		},

		mouseup: function(event) {

			if (this.mode == consts.move_shapes) {
				if (this.changed) {
					paper.clear_selection_bounds();
					//undo.snapshot("Move Shapes");
				}

			} else if (this.mode == consts.move_points) {
				if (this.changed) {
					paper.clear_selection_bounds();
					//undo.snapshot("Move Points");
				}

			} else if (this.mode == consts.move_handle) {
				if (this.changed) {
					paper.clear_selection_bounds();
					//undo.snapshot("Move Handle");
				}
			} else if (this.mode == 'box-select') {

				var box = new paper.Rectangle(this.mouseStartPos, event.point);

				if (!event.modifiers.shift)
					paper.project.deselectAll();

				// при зажатом ctrl добавляем элемент иначе - узел
				if (event.modifiers.control) {

					var selectedPaths = paper.paths_intersecting_rect(box);
					for (var i = 0; i < selectedPaths.length; i++)
						selectedPaths[i].selected = !selectedPaths[i].selected;

				}else {

					var selectedSegments = paper.segments_in_rect(box);
					if (selectedSegments.length > 0) {
						for (var i = 0; i < selectedSegments.length; i++) {
							selectedSegments[i].selected = !selectedSegments[i].selected;
						}
					} else {
						var selectedPaths = paper.paths_intersecting_rect(box);
						for (var i = 0; i < selectedPaths.length; i++)
							selectedPaths[i].selected = !selectedPaths[i].selected;
					}
				}
			}

			paper.clear_selection_bounds();

			if (tool.hitItem) {
				if (tool.hitItem.item.selected) {
					paper.canvas_cursor('cursor-arrow-small');
				} else {
					paper.canvas_cursor('cursor-arrow-white-shape');
				}
			}
		},

		mousedrag: function(event) {
			this.changed = true;

			if (this.mode == consts.move_shapes) {
				paper.canvas_cursor('cursor-arrow-small');

				var delta = event.point.subtract(this.mouseStartPos);
				if (event.modifiers.shift)
					delta = delta.snap_to_angle();

				paper.restore_selection_state(this.originalContent);
				paper.project.move_points(delta, true);
				paper.clear_selection_bounds();

			} else if (this.mode == consts.move_points) {
				paper.canvas_cursor('cursor-arrow-small');

				var delta = event.point.subtract(this.mouseStartPos);
				if (event.modifiers.shift)
					delta = delta.snap_to_angle();
				paper.restore_selection_state(this.originalContent);
				paper.project.move_points(delta);
				paper.purge_selection();


			} else if (this.mode == consts.move_handle) {

				var delta = event.point.subtract(this.mouseStartPos),
					noti = {
						type: consts.move_handle,
						profiles: [tool.hitItem.item.parent],
						points: []};

				if (tool.hitItem.type == 'handle-out') {
					var handlePos = this.originalHandleOut.add(delta);
					if (event.modifiers.shift)
						handlePos = handlePos.snap_to_angle();

					tool.hitItem.segment.handleOut = handlePos;
					tool.hitItem.segment.handleIn = handlePos.normalize(-this.originalHandleIn.length);
				} else {
					var handlePos = this.originalHandleIn.add(delta);
					if (event.modifiers.shift)
						handlePos = handlePos.snap_to_angle();

					tool.hitItem.segment.handleIn = handlePos;
					tool.hitItem.segment.handleOut = handlePos.normalize(-this.originalHandleOut.length);
				}

				noti.profiles[0].rays.clear();
				noti.profiles[0].layer.notify(noti);

				paper.purge_selection();

			} else if (this.mode == 'box-select') {
				paper.drag_rect(this.mouseStartPos, event.point);
			}
		},

		mousemove: function(event) {
			this.hitTest(event);
		},

		keydown: function(event) {
			var selected, i, j, path, segment, index, point, handle;

			if (event.key == '+' || event.key == 'insert') {

				selected = paper.project.selectedItems;

				// при зажатом ctrl или alt добавляем элемент иначе - узел
				if (event.modifiers.space) {

					for (i = 0; i < selected.length; i++) {
						path = selected[i];

						if(path.parent instanceof Profile){

							var cnn_point = path.parent.cnn_point("e");
							if(cnn_point && cnn_point.profile)
								cnn_point.profile.rays.clear(true);
							path.parent.rays.clear(true);

							point = path.getPointAt(path.length * 0.5);
							var newpath = path.split(path.length * 0.5);
							path.lastSegment.point = path.lastSegment.point.add(paper.Point.random());
							newpath.firstSegment.point = path.lastSegment.point;
							new Profile({generatrix: newpath, proto: path.parent});
						}
					}

				}else{

					for (i = 0; i < selected.length; i++) {
						path = selected[i];
						var do_select = false;
						if(path.parent instanceof ProfileItem){
							for (j = 0; j < path.segments.length; j++) {
								segment = path.segments[j];
								if (segment.selected){
									do_select = true;
									break;
								}
							}
							if(!do_select){
								j = 0;
								segment = path.segments[j];
								do_select = true;
							}
						}
						if(do_select){
							index = (j < (path.segments.length - 1) ? j + 1 : j);
							point = segment.curve.getPointAt(0.5, true);
							handle = segment.curve.getTangentAt(0.5, true).normalize(segment.curve.length / 4);
							path.insert(index, new paper.Segment(point, handle.negate(), handle));
						}
					}
				}

				// Prevent the key event from bubbling
				event.stop();
				return false;

				// удаление сегмента или элемента
			} else if (event.key == '-' || event.key == 'delete' || event.key == 'backspace') {

				if(event.event && event.event.target && ["textarea", "input"].indexOf(event.event.target.tagName.toLowerCase())!=-1)
					return;

				paper.project.selectedItems.some(function (path) {

					var do_select = false;

					if(path.parent instanceof DimensionLineCustom){
						path.parent.remove();
						return true;

					}else if(path.parent instanceof ProfileItem){
						for (j = 0; j < path.segments.length; j++) {
							segment = path.segments[j];
							do_select = do_select || segment.selected;
							if (segment.selected && segment != path.firstSegment && segment != path.lastSegment ){
								path.removeSegment(j);

								// пересчитываем
								path.parent.x1 = path.parent.x1;
								break;
							}
						}
						// если не было обработки узлов - удаляем элемент
						if(!do_select){
							path = path.parent;
							path.removeChildren();
							path.remove();
						}
					}
				});

				// Prevent the key event from bubbling
				event.stop();
				return false;

			} else if (event.key == 'left') {
				paper.project.move_points(new paper.Point(-10, 0));

			} else if (event.key == 'right') {
				paper.project.move_points(new paper.Point(10, 0));

			} else if (event.key == 'up') {
				paper.project.move_points(new paper.Point(0, -10));

			} else if (event.key == 'down') {
				paper.project.move_points(new paper.Point(0, 10));

			}
		}
	});

	return tool;

}
ToolSelectNode._extend(ToolElement);
/**
 * Ввод и редактирование произвольного текста
 * Created 25.08.2015<br />
 * &copy; http://www.oknosoft.ru 2014-2015
 * @author    Evgeniy Malyarov
 * @module  tool_text
 */

/**
 * ### Произвольный текст
 * 
 * @class ToolText
 * @extends ToolElement
 * @constructor
 * @menuorder 60
 * @tooltip Добавление текста
 */
function ToolText(){

	var tool = this,
		_editor = paper;

	ToolText.superclass.constructor.call(this);

	tool.mouseStartPos = new paper.Point();
	tool.mode = null;
	tool.hitItem = null;
	tool.originalContent = null;
	tool.changed = false;

	tool.options = {
		name: 'text',
		wnd: {
			caption: "Произвольный текст",
			width: 290,
			height: 290
		}
	};

	tool.resetHot = function(type, event, mode) {
	};
	tool.testHot = function(type, event, mode) {
		/*	if (mode != 'tool-select')
		 return false;*/
		return tool.hitTest(event);
	};
	tool.hitTest = function(event) {
		var hitSize = 6;

		// хит над текстом обрабатываем особо
		tool.hitItem = _editor.project.hitTest(event.point, { class: paper.TextItem, bounds: true, fill: true, stroke: true, tolerance: hitSize });
		if(!tool.hitItem)
			tool.hitItem = _editor.project.hitTest(event.point, { fill: true, stroke: false, tolerance: hitSize });

		if (tool.hitItem){
			if(tool.hitItem.item instanceof paper.PointText)
				_editor.canvas_cursor('cursor-text');     // указатель с черным Т
			else
				_editor.canvas_cursor('cursor-text-add'); // указатель с серым Т
		} else
			_editor.canvas_cursor('cursor-text-select');  // указатель с вопросом

		return true;
	};
	tool.on({
		activate: function() {
			this.on_activate('cursor-text-select');
		},
		deactivate: function() {
			_editor.hide_selection_bounds();
			tool.detache_wnd();
		},
		mousedown: function(event) {
			this.text = null;
			this.changed = false;

			_editor.project.deselectAll();
			this.mouseStartPos = event.point.clone();

			if (tool.hitItem) {

				if(tool.hitItem.item instanceof paper.PointText){
					this.text = tool.hitItem.item;
					this.text.selected = true;

				}else {
					this.text = new FreeText({
						parent: tool.hitItem.item.layer.l_text,
						point: this.mouseStartPos,
						content: '...',
						selected: true
					});
				}

				this.textStartPos = this.text.point;

				// включить диалог свойст текстового элемента
				if(!tool.wnd || !tool.wnd.elmnts){
					$p.wsql.restore_options("editor", tool.options);
					tool.wnd = $p.iface.dat_blank(_editor._dxw, tool.options.wnd);
					tool._grid = tool.wnd.attachHeadFields({
						obj: this.text
					});
				}else{
					tool._grid.attach({obj: this.text})
				}

			}else
				tool.detache_wnd();

		},
		mouseup: function(event) {

			if (this.mode && this.changed) {
				//undo.snapshot("Move Shapes");
			}

			_editor.canvas_cursor('cursor-arrow-lay');

		},
		mousedrag: function(event) {

			if (this.text) {
				var delta = event.point.subtract(this.mouseStartPos);
				if (event.modifiers.shift)
					delta = delta.snap_to_angle();

				this.text.move_points(this.textStartPos.add(delta));
				
			}

		},
		mousemove: function(event) {
			this.hitTest(event);
		},
		keydown: function(event) {
			var selected, i, text;
			if (event.key == '-' || event.key == 'delete' || event.key == 'backspace') {

				if(event.event && event.event.target && ["textarea", "input"].indexOf(event.event.target.tagName.toLowerCase())!=-1)
					return;

				selected = _editor.project.selectedItems;
				for (i = 0; i < selected.length; i++) {
					text = selected[i];
					if(text instanceof FreeText){
						text.text = "";
						setTimeout(function () {
							_editor.view.update();
						}, 100);
					}
				}

				event.preventDefault();
				return false;
			}
		}
	});

}
ToolText._extend(ToolElement);

$p.injected_data._mixin({"tip_editor_right.html":"<div class=\"clipper editor_accordion\">\r\n\r\n    <div class=\"scroller\">\r\n        <div class=\"container\">\r\n\r\n            <!-- РАЗДЕЛ 1 - дерево слоёв -->\r\n            <div class=\"header\">\r\n                <div class=\"header__title\" name=\"header_layers\"></div>\r\n            </div>\r\n            <div name=\"content_layers\" style=\"min-height: 200px;\"></div>\r\n\r\n            <!-- РАЗДЕЛ 2 - реквизиты элемента -->\r\n            <div class=\"header\">\r\n                <div class=\"header__title\" name=\"header_elm\"></div>\r\n            </div>\r\n            <div name=\"content_elm\" style=\"min-height: 260px;\"></div>\r\n\r\n            <!-- РАЗДЕЛ 3 - реквизиты створки -->\r\n            <div class=\"header\">\r\n                <div class=\"header__title\" name=\"header_stv\">\r\n                    Створка\r\n                    <!--span name=\"title\"></span-->\r\n                </div>\r\n            </div>\r\n            <div name=\"content_stv\" style=\"min-height: 200px;\"></div>\r\n\r\n            <!-- РАЗДЕЛ 4 - реквизиты изделия -->\r\n            <div class=\"header\">\r\n                <div class=\"header__title\" name=\"header_props\">\r\n                    <span name=\"title\">Изделие</span>\r\n                </div>\r\n            </div>\r\n            <div name=\"content_props\" style=\"min-height: 330px;\"></div>\r\n\r\n        </div>\r\n    </div>\r\n\r\n    <div class=\"scroller__track\">\r\n        <div class=\"scroller__bar\" style=\"height: 26px; top: 0px;\"></div>\r\n    </div>\r\n\r\n</div>","tip_select_node.html":"<div class=\"otooltip\">\r\n    <p class=\"otooltip\">Инструмент <b>Элемент и узел</b> позволяет:</p>\r\n    <ul class=\"otooltip\">\r\n        <li>Выделить элемент<br />для изменения его свойств или перемещения</li>\r\n        <li>Выделить отдельные узлы и рычаги узлов<br />для изменения геометрии</li>\r\n        <li>Добавить новый узел (изгиб)<br />(кнопка {+} на цифровой клавиатуре)</li>\r\n        <li>Удалить выделенный узел (изгиб)<br />(кнопки {del} или {-} на цифровой клавиатуре)</li>\r\n        <li>Добавить новый элемент, делением текущего<br />(кнопка {+} при нажатой кнопке {пробел})</li>\r\n        <li>Удалить выделенный элемент<br />(кнопки {del} или {-} на цифровой клавиатуре)</li>\r\n    </ul>\r\n    <hr />\r\n    <a title=\"Видеоролик, иллюстрирующий работу инструмента\" href=\"https://www.youtube.com/embed/UcBGQGqwUro?list=PLiVLBB_TTj5njgxk5E_EjwxzCGM4XyKlQ\" target=\"_blank\">\r\n        <i class=\"fa fa-video-camera fa-lg\"></i> Обучающее видео</a>\r\n    <a title=\"Справка по инструменту в WIKI\" href=\"http://www.oknosoft.ru/upzp/apidocs/classes/OTooolBar.html\" target=\"_blank\" style=\"margin-left: 9px;\">\r\n        <i class='fa fa-question-circle fa-lg'></i> Справка в wiki</a>\r\n</div>"});
return Editor;
}));
