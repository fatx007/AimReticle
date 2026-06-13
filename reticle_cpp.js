// reticle_cpp.js
// JavaScript equivalent of reticle.cpp
// Converted from C++ to JavaScript — algorithm and structure unchanged

'use strict';

const { ReticleConfig }                                       = require('./api_reticle_h');
const { Vector2, POINT, TOUCHINPUT, INPUT, Stopwatch, Reticle } = require('./reticle_h');

// ════════════════════════════════════════════════════════════════════════════
//  Stopwatch implementation
//  Uses performance.now() (ms precision) in place of std::chrono::steady_clock
// ════════════════════════════════════════════════════════════════════════════

Stopwatch.prototype.Start = function () {
    if (!this._running) {
        this._startedAt = Stopwatch._now();
        this._running   = true;
    }
};

Stopwatch.prototype.Stop = function () {
    if (this._running) {
        this._accumulated += Stopwatch._now() - this._startedAt;
        this._running      = false;
    }
};

Stopwatch.prototype.Restart = function () {
    this._accumulated = 0.0;
    this._startedAt   = Stopwatch._now();
    this._running     = true;
};

Stopwatch.prototype.Reset = function () {
    this._accumulated = 0.0;
    this._startedAt   = Stopwatch._now();
    this._running     = false;
};

Stopwatch.prototype.IsRunning = function () {
    return this._running;
};

/** @returns {number} elapsed time in seconds */
Stopwatch.prototype.ElapsedSeconds = function () {
    let elapsed = this._accumulated;   // ms
    if (this._running) {
        elapsed += Stopwatch._now() - this._startedAt;
    }
    return elapsed / 1000.0;           // convert ms → s, mirrors duration<double>
};

/** @returns {number} elapsed time in whole milliseconds */
Stopwatch.prototype.ElapsedMilliseconds = function () {
    return Math.trunc(this.ElapsedSeconds() * 1000.0);
};

// ════════════════════════════════════════════════════════════════════════════
//  Reticle — static member initialization
//  (mirrors the definitions at the top of reticle.cpp)
// ════════════════════════════════════════════════════════════════════════════

Reticle.anchorPoint          = new Vector2(0.0, 0.0);
Reticle.anchorAddress        = 'enemy_head';
Reticle.lastTouch            = 0.0;
Reticle.currentVelocity      = 0.0;
Reticle.velocityHistory      = [];
Reticle.frameTimer           = new Stopwatch();
Reticle.buttonHoldTimer      = new Stopwatch();
Reticle.touchMoveRemainder   = new Vector2(0.0, 0.0);
Reticle.adaptiveThresholdMs  = 180;
Reticle.recentClicks         = [];

Reticle.lastTouchPoint        = new Vector2(0.0, 0.0);
Reticle.currentTouchPoint     = new Vector2(0.0, 0.0);
Reticle.currentVelocityVector = new Vector2(0.0, 0.0);
Reticle.velocityHistoryX      = [];
Reticle.velocityHistoryY      = [];

// std::mutex stateMutex   → not needed in single-threaded JS event loop
// std::thread workerThread → replaced by a setInterval/setTimeout handle
Reticle._loopHandle          = null;
Reticle.running              = false;   // std::atomic<bool> running{false}
Reticle.touchActive          = false;
Reticle.buttonHeld           = false;
Reticle.hadLastTouch         = false;
Reticle.screenWidth          = 0.0;
Reticle.screenHeight         = 0.0;
Reticle.config               = Reticle.DefaultConfig();   // forward-defined below
Reticle.moveCallback         = null;
Reticle.moveCallbackUserData = null;

// ════════════════════════════════════════════════════════════════════════════
//  Reticle — method implementations
// ════════════════════════════════════════════════════════════════════════════

/**
 * Equivalent to: void Reticle::Work()
 * Starts the background worker. Uses recursive setTimeout to replicate
 * the variable-sleep loop (2 ms when active, 15 ms when idle).
 */
Reticle.Work = function () {
    // bool expected = false;
    // if (!running.compare_exchange_strong(expected, true)) return;
    if (Reticle.running) {
        return;
    }
    Reticle.running = true;

    Reticle.frameTimer.Restart();
    Reticle.Loop();   // equivalent to: workerThread = std::thread(&Reticle::Loop)
};

/**
 * Equivalent to: void Reticle::Stop()
 */
Reticle.Stop = function () {
    Reticle.running = false;
    if (Reticle._loopHandle !== null) {
        clearTimeout(Reticle._loopHandle);
        Reticle._loopHandle = null;
    }
    Reticle.buttonHoldTimer.Stop();
    Reticle.frameTimer.Stop();
};

/**
 * Equivalent to: void Reticle::Loop()
 * Replicates the while-loop with variable sleep via recursive setTimeout.
 */
Reticle.Loop = function () {
    if (!Reticle.running) {
        return;
    }

    // const double elapsed = frameTimer.ElapsedSeconds();
    // frameTimer.Restart();
    const elapsed          = Reticle.frameTimer.ElapsedSeconds();
    Reticle.frameTimer.Restart();

    // const float deltaTimeSeconds = Clamp(elapsed, 0.001f, 0.05f)
    const deltaTimeSeconds = Reticle.Clamp(elapsed, 0.001, 0.05);

    // bool held = buttonHeld;  (lock_guard scope)
    const held = Reticle.buttonHeld;

    if (held) {
        if (!Reticle.buttonHoldTimer.IsRunning()) {
            Reticle.buttonHoldTimer.Restart();
        }
    } else {
        if (Reticle.buttonHoldTimer.IsRunning()) {
            const heldMs = Reticle.buttonHoldTimer.ElapsedMilliseconds();
            if (heldMs > 0 && heldMs < Reticle.adaptiveThresholdMs) {
                Reticle.recentClicks.push(heldMs);
                if (Reticle.recentClicks.length > 8) {
                    Reticle.recentClicks.shift();   // erase(begin())
                }
            }
        }
        Reticle.buttonHoldTimer.Reset();
    }

    // Idle branch: sleep_for(15ms)
    if (!Reticle.ShouldTouch()) {
        Reticle.ResetState(false);
        Reticle._loopHandle = setTimeout(() => Reticle.Loop(), 15);
        return;
    }

    // Active branch: sleep_for(2ms)
    Reticle.UpdateOnce(deltaTimeSeconds);
    Reticle._loopHandle = setTimeout(() => Reticle.Loop(), 2);
};

/**
 * Equivalent to: bool Reticle::ShouldTouch()
 * @returns {boolean}
 */
Reticle.ShouldTouch = function () {
    // lock_guard scope
    if (!Reticle.config.TouchAssistEnabled || !Reticle.buttonHeld || !Reticle.touchActive) {
        return false;
    }
    if (Reticle.screenWidth <= 0.0 || Reticle.screenHeight <= 0.0) {
        return false;
    }

    const reticleX          = Reticle.screenWidth  * 0.5;
    const reticleY          = Reticle.screenHeight * 0.5;
    const dx                = Reticle.anchorPoint.X - reticleX;
    const dy                = Reticle.anchorPoint.Y - reticleY;
    const distanceToAnchor  = Reticle.Length(dx, dy);
    const activeRadius      = Math.max(Reticle.config.BrakingZoneRadius, Reticle.config.BoostZoneRadius);
    return distanceToAnchor <= activeRadius && distanceToAnchor >= Reticle.config.AnchorDeadzone;
};

/**
 * Equivalent to: void Reticle::UpdateVelocity(const Vector2& currentTouch, float deltaTimeSeconds)
 * @param {Vector2} currentTouch
 * @param {number}  deltaTimeSeconds
 */
Reticle.UpdateVelocity = function (currentTouch, deltaTimeSeconds) {
    if (deltaTimeSeconds <= 0.0) {
        return;
    }

    if (!Reticle.hadLastTouch) {
        Reticle.lastTouchPoint        = { X: currentTouch.X, Y: currentTouch.Y };
        Reticle.lastTouch             = currentTouch.Y;
        Reticle.hadLastTouch          = true;
        Reticle.currentVelocity       = 0.0;
        Reticle.currentVelocityVector = new Vector2(0.0, 0.0);
        return;
    }

    const deltaX        = currentTouch.X - Reticle.lastTouchPoint.X;
    const deltaY        = currentTouch.Y - Reticle.lastTouchPoint.Y;
    const rawVelocityX  = deltaX / deltaTimeSeconds;
    const rawVelocityY  = deltaY / deltaTimeSeconds;

    Reticle.velocityHistoryX.push(rawVelocityX);
    Reticle.velocityHistoryY.push(rawVelocityY);
    Reticle.velocityHistory.push(Reticle.Length(rawVelocityX, rawVelocityY));

    const maxHistory = 5;   // constexpr size_t maxHistory = 5
    while (Reticle.velocityHistoryX.length > maxHistory) { Reticle.velocityHistoryX.shift(); }
    while (Reticle.velocityHistoryY.length > maxHistory) { Reticle.velocityHistoryY.shift(); }
    while (Reticle.velocityHistory.length  > maxHistory) { Reticle.velocityHistory.shift();  }

    Reticle.currentVelocityVector.X = Reticle.Average(Reticle.velocityHistoryX);
    Reticle.currentVelocityVector.Y = Reticle.Average(Reticle.velocityHistoryY);
    Reticle.currentVelocity         = Reticle.Average(Reticle.velocityHistory);
    Reticle.lastTouchPoint          = { X: currentTouch.X, Y: currentTouch.Y };
    Reticle.lastTouch               = currentTouch.Y;
};

/**
 * Equivalent to: void Reticle::ApplyTouch(float deltaTimeSeconds)
 * @param {number} deltaTimeSeconds
 */
Reticle.ApplyTouch = function (deltaTimeSeconds) {
    // Read shared state (lock_guard scope)
    const anchor      = { X: Reticle.anchorPoint.X,          Y: Reticle.anchorPoint.Y          };
    const touch       = { X: Reticle.currentTouchPoint.X,    Y: Reticle.currentTouchPoint.Y    };
    const velocity    = { X: Reticle.currentVelocityVector.X, Y: Reticle.currentVelocityVector.Y };
    const localConfig = Object.assign(new ReticleConfig(), Reticle.config);
    const width       = Reticle.screenWidth;
    const height      = Reticle.screenHeight;
    const heldMs      = Reticle.buttonHoldTimer.ElapsedMilliseconds();

    const reticleX         = width  * 0.5;
    const reticleY         = height * 0.5;
    const dx               = anchor.X - reticleX;
    const dy               = anchor.Y - reticleY;
    const distanceToAnchor = Reticle.Length(dx, dy);
    if (distanceToAnchor < localConfig.AnchorDeadzone) {
        return;
    }

    const brakingRadius = Math.max(localConfig.BrakingZoneRadius, 1.0);
    const boostRadius   = Math.max(localConfig.BoostZoneRadius,   1.0);
    let   brakeFactor   = Reticle.Clamp(1.0 - (distanceToAnchor / brakingRadius), 0.0, 1.0);
    let   boostFactor   = Reticle.Clamp(distanceToAnchor / boostRadius,           0.0, 1.0);

    const quickTapMode = heldMs > 0 && heldMs < Reticle.adaptiveThresholdMs;
    brakeFactor *= quickTapMode ? localConfig.TapBrakingFactor : localConfig.HoldBrakingFactor;
    boostFactor *= quickTapMode ? localConfig.TapBoostFactor   : localConfig.HoldBoostFactor;

    const movingTowardAnchor  = Reticle.IsMovingTowardAnchor(anchor.X - touch.X, anchor.Y - touch.Y);
    const speed               = Reticle.Length(velocity.X, velocity.Y);
    const fastSwipeThreshold  = Math.max(localConfig.MaxVelocityX, localConfig.MaxVelocityY) * 0.6;

    if (localConfig.OvershootProtectionEnabled && movingTowardAnchor && speed > fastSwipeThreshold) {
        brakeFactor = Reticle.Clamp(brakeFactor * 1.35, 0.0, 1.0);
        boostFactor = Reticle.Clamp(boostFactor * 0.35, 0.0, 1.0);
    } else if (speed < fastSwipeThreshold * 0.25) {
        boostFactor = Reticle.Clamp(boostFactor * 1.2,  0.0, 1.0);
        brakeFactor = Reticle.Clamp(brakeFactor * 0.8,  0.0, 1.0);
    }

    const brakeSmoothness  = Math.max(localConfig.BrakeSmoothness, 1.0);
    const boostSmoothness  = Math.max(localConfig.BoostSmoothness, 1.0);
    const maxVelocityX     = Math.max(localConfig.MaxVelocityX,    0.0);
    const maxVelocityY     = Math.max(localConfig.MaxVelocityY,    0.0);
    const missingVelocityX = Math.max(maxVelocityX - Math.abs(velocity.X), 0.0);
    const missingVelocityY = Math.max(maxVelocityY - Math.abs(velocity.Y), 0.0);

    let stepBrakeX = (Math.abs(velocity.X) * brakeFactor) / brakeSmoothness;
    let stepBrakeY = (Math.abs(velocity.Y) * brakeFactor) / brakeSmoothness;
    stepBrakeX     = Math.min(stepBrakeX, Math.abs(velocity.X) * 0.3);
    stepBrakeY     = Math.min(stepBrakeY, Math.abs(velocity.Y) * 0.3);

    let stepBoostX = (missingVelocityX * boostFactor) / boostSmoothness;
    let stepBoostY = (missingVelocityY * boostFactor) / boostSmoothness;
    stepBoostX     = Math.min(stepBoostX, missingVelocityX * 0.3);
    stepBoostY     = Math.min(stepBoostY, missingVelocityY * 0.3);

    const sens = Math.max(localConfig.Sens, 0.0);
    stepBrakeX *= sens * deltaTimeSeconds;
    stepBrakeY *= sens * deltaTimeSeconds;
    stepBoostX *= sens * deltaTimeSeconds;
    stepBoostY *= sens * deltaTimeSeconds;

    let moveBrakeX = -Reticle.Sign(velocity.X) * stepBrakeX;
    let moveBrakeY = -Reticle.Sign(velocity.Y) * stepBrakeY;
    let moveBoostX =  Reticle.Sign(anchor.X - touch.X) * stepBoostX;
    let moveBoostY =  Reticle.Sign(anchor.Y - touch.Y) * stepBoostY;

    if (localConfig.OvershootProtectionEnabled
            && distanceToAnchor < brakingRadius * 0.35
            && movingTowardAnchor) {
        moveBoostX *= 0.25;
        moveBoostY *= 0.25;
        moveBrakeX *= 1.25;
        moveBrakeY *= 1.25;
    }

    moveBrakeX = Reticle.Clamp(moveBrakeX, -localConfig.MaxBrakeStep, localConfig.MaxBrakeStep);
    moveBrakeY = Reticle.Clamp(moveBrakeY, -localConfig.MaxBrakeStep, localConfig.MaxBrakeStep);
    moveBoostX = Reticle.Clamp(moveBoostX, -localConfig.MaxBoostStep, localConfig.MaxBoostStep);
    moveBoostY = Reticle.Clamp(moveBoostY, -localConfig.MaxBoostStep, localConfig.MaxBoostStep);

    let moveX = moveBoostX + moveBrakeX;
    let moveY = moveBoostY + moveBrakeY;

    if (localConfig.RemainderEnabled) {
        // lock_guard scope
        moveX += Reticle.touchMoveRemainder.X;
        moveY += Reticle.touchMoveRemainder.Y;
        const sendMoveX = Reticle.RoundConsistent(moveX);
        const sendMoveY = Reticle.RoundConsistent(moveY);
        Reticle.touchMoveRemainder.X = moveX - sendMoveX;
        Reticle.touchMoveRemainder.Y = moveY - sendMoveY;
        moveX = sendMoveX;
        moveY = sendMoveY;
    }

    const sendX = Math.round(moveX);   // std::lround
    const sendY = Math.round(moveY);
    if (sendX !== 0 || sendY !== 0) {
        Reticle.MoveTouch(sendX, sendY);
    }
};

/**
 * Equivalent to: void Reticle::MoveTouch(int dx, int dy)
 * @param {number} dx
 * @param {number} dy
 */
Reticle.MoveTouch = function (dx, dy) {
    // lock_guard scope
    const active   = Reticle.touchActive && Reticle.buttonHeld;
    const callback = Reticle.moveCallback;
    const userData = Reticle.moveCallbackUserData;

    if (!active || callback === null || callback === undefined) {
        return;
    }

    const input       = new INPUT();
    input.type        = 1;
    input.touch.x     = dx;
    input.touch.y     = dy;
    input.touch.dwFlags = 0x0002;
    input.point.x     = dx;
    input.point.y     = dy;

    callback(input.touch.x, input.touch.y, userData);
};

/**
 * Equivalent to: void Reticle::ResetState(bool resetAnchor)
 * @param {boolean} resetAnchor
 */
Reticle.ResetState = function (resetAnchor) {
    // lock_guard scope
    Reticle.currentVelocity        = 0.0;
    Reticle.currentVelocityVector  = new Vector2(0.0, 0.0);
    Reticle.velocityHistory        = [];
    Reticle.velocityHistoryX       = [];
    Reticle.velocityHistoryY       = [];
    Reticle.touchMoveRemainder     = new Vector2(0.0, 0.0);
    Reticle.hadLastTouch           = false;
    if (resetAnchor) {
        Reticle.anchorPoint = new Vector2(0.0, 0.0);
    }
};

/**
 * Equivalent to: void Reticle::SetConfig(const ReticleConfig& newConfig)
 * @param {ReticleConfig} newConfig
 */
Reticle.SetConfig = function (newConfig) {
    // lock_guard scope
    Reticle.config = Object.assign(new ReticleConfig(), newConfig);
};

/**
 * Equivalent to: ReticleConfig Reticle::GetConfig()
 * @returns {ReticleConfig}
 */
Reticle.GetConfig = function () {
    // lock_guard scope
    return Object.assign(new ReticleConfig(), Reticle.config);
};

/**
 * Equivalent to: void Reticle::SetScreenSize(float width, float height)
 * @param {number} width
 * @param {number} height
 */
Reticle.SetScreenSize = function (width, height) {
    // lock_guard scope
    Reticle.screenWidth  = Math.max(width,  0.0);
    Reticle.screenHeight = Math.max(height, 0.0);
};

/**
 * Equivalent to: void Reticle::SetAnchor(float x, float y)
 * @param {number} x
 * @param {number} y
 */
Reticle.SetAnchor = function (x, y) {
    // lock_guard scope
    Reticle.anchorPoint = new Vector2(x, y);
};

/**
 * Equivalent to: Vector2 Reticle::GetAnchor()
 * @returns {Vector2}
 */
Reticle.GetAnchor = function () {
    // lock_guard scope
    return new Vector2(Reticle.anchorPoint.X, Reticle.anchorPoint.Y);
};

/**
 * Equivalent to: const char* Reticle::GetAnchorAddress()
 * @returns {string}
 */
Reticle.GetAnchorAddress = function () {
    return Reticle.anchorAddress;
};

/**
 * Equivalent to: void Reticle::SetButtonHeld(bool held)
 * @param {boolean} held
 */
Reticle.SetButtonHeld = function (held) {
    // lock_guard scope
    Reticle.buttonHeld = held;
};

/**
 * Equivalent to: void Reticle::SetTouchState(bool touching, float x, float y)
 * @param {boolean} touching
 * @param {number}  x
 * @param {number}  y
 */
Reticle.SetTouchState = function (touching, x, y) {
    // lock_guard scope
    Reticle.touchActive       = touching;
    Reticle.currentTouchPoint = new Vector2(x, y);
    if (!touching) {
        Reticle.hadLastTouch = false;
    }
};

/**
 * Equivalent to: void Reticle::SetMoveCallback(ReticleMoveCallback callback, void* userData)
 * @param {Function|null} callback
 * @param {*}             userData
 */
Reticle.SetMoveCallback = function (callback, userData) {
    // lock_guard scope
    Reticle.moveCallback         = callback;
    Reticle.moveCallbackUserData = userData;
};

/**
 * Equivalent to: void Reticle::UpdateOnce(float deltaTimeSeconds)
 * @param {number} deltaTimeSeconds
 */
Reticle.UpdateOnce = function (deltaTimeSeconds) {
    // lock_guard scope
    const touch = new Vector2(Reticle.currentTouchPoint.X, Reticle.currentTouchPoint.Y);

    Reticle.UpdateVelocity(touch, deltaTimeSeconds);
    Reticle.ApplyTouch(deltaTimeSeconds);
};

// ════════════════════════════════════════════════════════════════════════════
//  Private helpers
// ════════════════════════════════════════════════════════════════════════════

/**
 * Equivalent to: float Reticle::Clamp(float value, float minValue, float maxValue)
 * @param {number} value
 * @param {number} minValue
 * @param {number} maxValue
 * @returns {number}
 */
Reticle.Clamp = function (value, minValue, maxValue) {
    return Math.max(minValue, Math.min(value, maxValue));
};

/**
 * Equivalent to: float Reticle::Sign(float value)
 * @param {number} value
 * @returns {number}
 */
Reticle.Sign = function (value) {
    if (value > 0.0) { return  1.0; }
    if (value < 0.0) { return -1.0; }
    return 0.0;
};

/**
 * Equivalent to: float Reticle::Length(float x, float y)
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
Reticle.Length = function (x, y) {
    return Math.sqrt((x * x) + (y * y));
};

/**
 * Equivalent to: float Reticle::Average(const std::vector<float>& values)
 * @param {number[]} values
 * @returns {number}
 */
Reticle.Average = function (values) {
    if (values.length === 0) {
        return 0.0;
    }
    let total = 0.0;
    for (const value of values) {
        total += value;
    }
    return total / values.length;
};

/**
 * Equivalent to: bool Reticle::IsMovingTowardAnchor(float dx, float dy)
 * @param {number} dx
 * @param {number} dy
 * @returns {boolean}
 */
Reticle.IsMovingTowardAnchor = function (dx, dy) {
    const dot = (Reticle.currentVelocityVector.X * dx)
              + (Reticle.currentVelocityVector.Y * dy);
    return dot > 0.0;
};

/**
 * Equivalent to: int Reticle::RoundConsistent(float value)
 * Mirrors: floor for non-negative, ceil for negative.
 * @param {number} value
 * @returns {number}
 */
Reticle.RoundConsistent = function (value) {
    if (value >= 0.0) {
        return Math.floor(value);
    }
    return Math.ceil(value);
};

/**
 * Equivalent to: ReticleConfig Reticle::DefaultConfig()
 * @returns {ReticleConfig}
 */
Reticle.DefaultConfig = function () {
    const defaults                          = new ReticleConfig();
    defaults.TouchAssistEnabled             = true;
    defaults.AnchorDeadzone                 = 5.0;
    defaults.BrakingZoneRadius              = 100.0;
    defaults.BoostZoneRadius                = 100.0;
    defaults.BrakeSmoothness                = 24.0;
    defaults.BoostSmoothness                = 24.0;
    defaults.TapBrakingFactor               = 0.85;
    defaults.HoldBrakingFactor              = 1.15;
    defaults.TapBoostFactor                 = 1.05;
    defaults.HoldBoostFactor                = 1.0;
    defaults.MaxVelocityX                   = 2400.0;
    defaults.MaxVelocityY                   = 2400.0;
    defaults.MaxBrakeStep                   = 3.0;
    defaults.MaxBoostStep                   = 3.0;
    defaults.RemainderEnabled               = true;
    defaults.OvershootProtectionEnabled     = true;
    defaults.Sens                           = 1.0;
    return defaults;
};

// Initialise config now that DefaultConfig is defined
Reticle.config = Reticle.DefaultConfig();

// ════════════════════════════════════════════════════════════════════════════
module.exports = { Vector2, POINT, TOUCHINPUT, INPUT, Stopwatch, Reticle };
