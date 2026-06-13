// api_reticle_h.js
// JavaScript equivalent of api_reticle.h
// Converted from C++ to JavaScript — algorithm and structure unchanged

'use strict';

/**
 * @typedef {function(number, number, *): void} ReticleMoveCallback
 * Equivalent to: typedef void (*ReticleMoveCallback)(int dx, int dy, void* userData);
 */

/**
 * Equivalent to: struct ReticleVector2 { float X; float Y; }
 */
class ReticleVector2 {
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
 * Equivalent to: struct ReticleConfig { ... }
 */
class ReticleConfig {
    constructor() {
        /** @type {boolean} */ this.TouchAssistEnabled         = false;
        /** @type {number}  */ this.AnchorDeadzone             = 0.0;
        /** @type {number}  */ this.BrakingZoneRadius          = 0.0;
        /** @type {number}  */ this.BoostZoneRadius            = 0.0;
        /** @type {number}  */ this.BrakeSmoothness            = 0.0;
        /** @type {number}  */ this.BoostSmoothness            = 0.0;
        /** @type {number}  */ this.TapBrakingFactor           = 0.0;
        /** @type {number}  */ this.HoldBrakingFactor          = 0.0;
        /** @type {number}  */ this.TapBoostFactor             = 0.0;
        /** @type {number}  */ this.HoldBoostFactor            = 0.0;
        /** @type {number}  */ this.MaxVelocityX               = 0.0;
        /** @type {number}  */ this.MaxVelocityY               = 0.0;
        /** @type {number}  */ this.MaxBrakeStep               = 0.0;
        /** @type {number}  */ this.MaxBoostStep               = 0.0;
        /** @type {boolean} */ this.RemainderEnabled           = false;
        /** @type {boolean} */ this.OvershootProtectionEnabled = false;
        /** @type {number}  */ this.Sens                       = 0.0;
    }
}

// API function declarations — implementations in api_reticle_cpp.js
// RETICLE_API void reticle_work(void);
// RETICLE_API void reticle_stop(void);
// RETICLE_API void reticle_set_config(const ReticleConfig* config);
// RETICLE_API ReticleConfig reticle_get_config(void);
// RETICLE_API void reticle_set_screen_size(float width, float height);
// RETICLE_API void reticle_set_anchor(float x, float y);
// RETICLE_API ReticleVector2 reticle_get_anchor(void);
// RETICLE_API const char* reticle_get_anchor_address(void);
// RETICLE_API void reticle_set_button_held(bool held);
// RETICLE_API void reticle_set_touch_state(bool touching, float x, float y);
// RETICLE_API void reticle_set_move_callback(ReticleMoveCallback callback, void* userData);
// RETICLE_API bool reticle_should_touch(void);
// RETICLE_API void reticle_update_once(float deltaTimeSeconds);

module.exports = { ReticleVector2, ReticleConfig };
