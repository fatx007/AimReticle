// reticle_h.js
// JavaScript equivalent of reticle.h
// Converted from C++ to JavaScript — algorithm and structure unchanged

'use strict';

const { ReticleConfig, ReticleVector2 } = require('./api_reticle_h');

// ─── Structs ────────────────────────────────────────────────────────────────

/**
 * Equivalent to: struct Vector2 { float X; float Y; }
 */
class Vector2 {
    /**
     * @param {number} X
     * @param {number} Y
     */
    constructor(X = 0.0, Y = 0.0) {
        /** @type {number} */ this.X = X;
        /** @type {number} */ this.Y = Y;
    }
}

/**
 * Equivalent to: struct POINT { int32_t x; int32_t y; }
 */
class POINT {
    /**
     * @param {number} x
     * @param {number} y
     */
    constructor(x = 0, y = 0) {
        /** @type {number} */ this.x = x;
        /** @type {number} */ this.y = y;
    }
}

/**
 * Equivalent to: struct TOUCHINPUT { int32_t x; int32_t y; uint32_t hSource; ... }
 */
class TOUCHINPUT {
    constructor() {
        /** @type {number} */ this.x           = 0;
        /** @type {number} */ this.y           = 0;
        /** @type {number} */ this.hSource     = 0;
        /** @type {number} */ this.dwID        = 0;
        /** @type {number} */ this.dwFlags     = 0;
        /** @type {number} */ this.dwMask      = 0;
        /** @type {number} */ this.dwTime      = 0;
        /** @type {number} */ this.dwExtraInfo = 0;
        /** @type {number} */ this.cxContact   = 0;
        /** @type {number} */ this.cyContact   = 0;
    }
}

/**
 * Equivalent to: struct INPUT { uint32_t type; TOUCHINPUT touch; POINT point; }
 */
class INPUT {
    constructor() {
        /** @type {number}     */ this.type  = 0;
        /** @type {TOUCHINPUT} */ this.touch = new TOUCHINPUT();
        /** @type {POINT}      */ this.point = new POINT();
    }
}

// ─── Stopwatch ───────────────────────────────────────────────────────────────

/**
 * Equivalent to: class Stopwatch { ... }
 * Uses performance.now() (milliseconds) as the clock, matching
 * std::chrono::steady_clock semantics.
 */
class Stopwatch {
    constructor() {
        /** @type {number}  */ this._startedAt   = 0.0;   // ms from performance.now()
        /** @type {number}  */ this._accumulated = 0.0;   // ms, equiv. nanoseconds accumulated_
        /** @type {boolean} */ this._running     = false;

        // Mirror: startedAt_ = Clock::now()
        this._startedAt = Stopwatch._now();
    }

    Start() {}   // see reticle_cpp.js for implementation
    Stop() {}
    Restart() {}
    Reset() {}
    IsRunning() {}
    ElapsedSeconds() {}
    ElapsedMilliseconds() {}

    /** @returns {number} current time in milliseconds */
    static _now() {
        return (typeof performance !== 'undefined')
            ? performance.now()
            : Number(process.hrtime.bigint()) / 1e6;
    }
}

// ─── Reticle ─────────────────────────────────────────────────────────────────

/**
 * Equivalent to: class Reticle { ... } (all-static class)
 * Static member declarations — implementations in reticle_cpp.js
 */
class Reticle {
    // ── Public static members (equiv. static field declarations in .h) ───────

    /** @type {Vector2}   */ static anchorPoint          = new Vector2(0.0, 0.0);
    /** @type {string}    */ static anchorAddress        = 'enemy_head';
    /** @type {number}    */ static lastTouch            = 0.0;
    /** @type {number}    */ static currentVelocity      = 0.0;
    /** @type {number[]}  */ static velocityHistory      = [];
    /** @type {Stopwatch} */ static frameTimer           = new Stopwatch();
    /** @type {Stopwatch} */ static buttonHoldTimer      = new Stopwatch();
    /** @type {Vector2}   */ static touchMoveRemainder   = new Vector2(0.0, 0.0);
    /** @type {number}    */ static adaptiveThresholdMs  = 180;
    /** @type {number[]}  */ static recentClicks         = [];

    /** @type {Vector2}  */ static lastTouchPoint        = new Vector2(0.0, 0.0);
    /** @type {Vector2}  */ static currentTouchPoint     = new Vector2(0.0, 0.0);
    /** @type {Vector2}  */ static currentVelocityVector = new Vector2(0.0, 0.0);
    /** @type {number[]} */ static velocityHistoryX      = [];
    /** @type {number[]} */ static velocityHistoryY      = [];

    // ── Private static members ────────────────────────────────────────────────

    // std::mutex stateMutex  → JS is single-threaded; no mutex needed,
    //                          access is serialized by the event loop.
    /** @type {number|null} */ static _loopHandle        = null;   // replaces std::thread workerThread
    /** @type {boolean}     */ static running            = false;  // replaces std::atomic<bool> running
    /** @type {boolean}     */ static touchActive        = false;
    /** @type {boolean}     */ static buttonHeld         = false;
    /** @type {boolean}     */ static hadLastTouch       = false;
    /** @type {number}      */ static screenWidth        = 0.0;
    /** @type {number}      */ static screenHeight       = 0.0;
    /** @type {ReticleConfig}  */ static config          = null;   // set in reticle_cpp.js DefaultConfig()
    /** @type {Function|null}  */ static moveCallback    = null;
    /** @type {*}              */ static moveCallbackUserData = null;

    // Public method declarations — implementations in reticle_cpp.js
    static Work() {}
    static Stop() {}
    static Loop() {}
    static ShouldTouch() {}
    static UpdateVelocity(_currentTouch, _deltaTimeSeconds) {}
    static ApplyTouch(_deltaTimeSeconds) {}
    static MoveTouch(_dx, _dy) {}
    static ResetState(_resetAnchor) {}

    static SetConfig(_newConfig) {}
    static GetConfig() {}
    static SetScreenSize(_width, _height) {}
    static SetAnchor(_x, _y) {}
    static GetAnchor() {}
    static GetAnchorAddress() {}
    static SetButtonHeld(_held) {}
    static SetTouchState(_touching, _x, _y) {}
    static SetMoveCallback(_callback, _userData) {}
    static UpdateOnce(_deltaTimeSeconds) {}

    // Private helper declarations
    static Clamp(_value, _minValue, _maxValue) {}
    static Sign(_value) {}
    static Length(_x, _y) {}
    static Average(_values) {}
    static IsMovingTowardAnchor(_dx, _dy) {}
    static RoundConsistent(_value) {}
    static DefaultConfig() {}
}

module.exports = { Vector2, POINT, TOUCHINPUT, INPUT, Stopwatch, Reticle };
