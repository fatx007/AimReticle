// api_reticle_cpp.js
// JavaScript equivalent of api_reticle.cpp
// Converted from C++ to JavaScript — algorithm and structure unchanged

'use strict';

const { Reticle } = require('./reticle_cpp');
const { ReticleVector2 } = require('./api_reticle_h');

// extern "C" {

function reticle_work() {
    Reticle.Work();
}

function reticle_stop() {
    Reticle.Stop();
}

/**
 * @param {import('./api_reticle_h').ReticleConfig|null} config
 */
function reticle_set_config(config) {
    if (config === null || config === undefined) {
        return;
    }
    Reticle.SetConfig(config);
}

/**
 * @returns {import('./api_reticle_h').ReticleConfig}
 */
function reticle_get_config() {
    return Reticle.GetConfig();
}

/**
 * @param {number} width
 * @param {number} height
 */
function reticle_set_screen_size(width, height) {
    Reticle.SetScreenSize(width, height);
}

/**
 * @param {number} x
 * @param {number} y
 */
function reticle_set_anchor(x, y) {
    Reticle.SetAnchor(x, y);
}

/**
 * @returns {ReticleVector2}
 */
function reticle_get_anchor() {
    const anchor = Reticle.GetAnchor();
    return new ReticleVector2(anchor.X, anchor.Y);
}

/**
 * @returns {string}
 */
function reticle_get_anchor_address() {
    return Reticle.GetAnchorAddress();
}

/**
 * @param {boolean} held
 */
function reticle_set_button_held(held) {
    Reticle.SetButtonHeld(held);
}

/**
 * @param {boolean} touching
 * @param {number} x
 * @param {number} y
 */
function reticle_set_touch_state(touching, x, y) {
    Reticle.SetTouchState(touching, x, y);
}

/**
 * @param {import('./api_reticle_h').ReticleMoveCallback} callback
 * @param {*} userData
 */
function reticle_set_move_callback(callback, userData) {
    Reticle.SetMoveCallback(callback, userData);
}

/**
 * @returns {boolean}
 */
function reticle_should_touch() {
    return Reticle.ShouldTouch();
}

/**
 * @param {number} deltaTimeSeconds
 */
function reticle_update_once(deltaTimeSeconds) {
    Reticle.UpdateOnce(deltaTimeSeconds);
}

// } // extern "C"

module.exports = {
    reticle_work,
    reticle_stop,
    reticle_set_config,
    reticle_get_config,
    reticle_set_screen_size,
    reticle_set_anchor,
    reticle_get_anchor,
    reticle_get_anchor_address,
    reticle_set_button_held,
    reticle_set_touch_state,
    reticle_set_move_callback,
    reticle_should_touch,
    reticle_update_once,
};
