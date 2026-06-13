#include "reticle.h"

#include <algorithm>
#include <cmath>

namespace fatx007 {

Vector2 Reticle::anchorPoint = {0.0f, 0.0f};
const char* Reticle::anchorAddress = "enemy_head";
float Reticle::lastTouch = 0.0f;
float Reticle::currentVelocity = 0.0f;
std::vector<float> Reticle::velocityHistory;
Stopwatch Reticle::frameTimer;
Stopwatch Reticle::buttonHoldTimer;
Vector2 Reticle::touchMoveRemainder = {0.0f, 0.0f};
int Reticle::adaptiveThresholdMs = 180;
std::vector<int64_t> Reticle::recentClicks;

Vector2 Reticle::lastTouchPoint = {0.0f, 0.0f};
Vector2 Reticle::currentTouchPoint = {0.0f, 0.0f};
Vector2 Reticle::currentVelocityVector = {0.0f, 0.0f};
std::vector<float> Reticle::velocityHistoryX;
std::vector<float> Reticle::velocityHistoryY;

std::mutex Reticle::stateMutex;
std::thread Reticle::workerThread;
std::atomic<bool> Reticle::running{false};
bool Reticle::touchActive = false;
bool Reticle::buttonHeld = false;
bool Reticle::hadLastTouch = false;
float Reticle::screenWidth = 0.0f;
float Reticle::screenHeight = 0.0f;
ReticleConfig Reticle::config = Reticle::DefaultConfig();
ReticleMoveCallback Reticle::moveCallback = nullptr;
void* Reticle::moveCallbackUserData = nullptr;

Stopwatch::Stopwatch()
    : startedAt_(Clock::now()), accumulated_(0), running_(false) {}

void Stopwatch::Start() {
    if (!running_) {
        startedAt_ = Clock::now();
        running_ = true;
    }
}

void Stopwatch::Stop() {
    if (running_) {
        accumulated_ += Clock::now() - startedAt_;
        running_ = false;
    }
}

void Stopwatch::Restart() {
    accumulated_ = std::chrono::nanoseconds(0);
    startedAt_ = Clock::now();
    running_ = true;
}

void Stopwatch::Reset() {
    accumulated_ = std::chrono::nanoseconds(0);
    startedAt_ = Clock::now();
    running_ = false;
}

bool Stopwatch::IsRunning() const {
    return running_;
}

double Stopwatch::ElapsedSeconds() const {
    std::chrono::nanoseconds elapsed = accumulated_;
    if (running_) {
        elapsed += Clock::now() - startedAt_;
    }
    return std::chrono::duration<double>(elapsed).count();
}

int64_t Stopwatch::ElapsedMilliseconds() const {
    return static_cast<int64_t>(ElapsedSeconds() * 1000.0);
}

void Reticle::Work() {
    bool expected = false;
    if (!running.compare_exchange_strong(expected, true)) {
        return;
    }

    frameTimer.Restart();
    workerThread = std::thread(&Reticle::Loop);
}

void Reticle::Stop() {
    running.store(false);
    if (workerThread.joinable()) {
        workerThread.join();
    }
    buttonHoldTimer.Stop();
    frameTimer.Stop();
}

void Reticle::Loop() {
    while (running.load()) {
        const double elapsed = frameTimer.ElapsedSeconds();
        frameTimer.Restart();
        const float deltaTimeSeconds = static_cast<float>(Clamp(static_cast<float>(elapsed), 0.001f, 0.05f));

        bool held = false;
        {
            std::lock_guard<std::mutex> lock(stateMutex);
            held = buttonHeld;
        }

        if (held) {
            if (!buttonHoldTimer.IsRunning()) {
                buttonHoldTimer.Restart();
            }
        } else {
            if (buttonHoldTimer.IsRunning()) {
                const int64_t heldMs = buttonHoldTimer.ElapsedMilliseconds();
                if (heldMs > 0 && heldMs < adaptiveThresholdMs) {
                    recentClicks.push_back(heldMs);
                    if (recentClicks.size() > 8) {
                        recentClicks.erase(recentClicks.begin());
                    }
                }
            }
            buttonHoldTimer.Reset();
        }

        if (!ShouldTouch()) {
            ResetState(false);
            std::this_thread::sleep_for(std::chrono::milliseconds(15));
            continue;
        }

        UpdateOnce(deltaTimeSeconds);
        std::this_thread::sleep_for(std::chrono::milliseconds(2));
    }
}

bool Reticle::ShouldTouch() {
    std::lock_guard<std::mutex> lock(stateMutex);
    if (!config.TouchAssistEnabled || !buttonHeld || !touchActive) {
        return false;
    }
    if (screenWidth <= 0.0f || screenHeight <= 0.0f) {
        return false;
    }

    const float reticleX = screenWidth * 0.5f;
    const float reticleY = screenHeight * 0.5f;
    const float dx = anchorPoint.X - reticleX;
    const float dy = anchorPoint.Y - reticleY;
    const float distanceToAnchor = Length(dx, dy);
    const float activeRadius = std::max(config.BrakingZoneRadius, config.BoostZoneRadius);
    return distanceToAnchor <= activeRadius && distanceToAnchor >= config.AnchorDeadzone;
}

void Reticle::UpdateVelocity(const Vector2& currentTouch, float deltaTimeSeconds) {
    if (deltaTimeSeconds <= 0.0f) {
        return;
    }

    if (!hadLastTouch) {
        lastTouchPoint = currentTouch;
        lastTouch = currentTouch.Y;
        hadLastTouch = true;
        currentVelocity = 0.0f;
        currentVelocityVector = {0.0f, 0.0f};
        return;
    }

    const float deltaX = currentTouch.X - lastTouchPoint.X;
    const float deltaY = currentTouch.Y - lastTouchPoint.Y;
    const float rawVelocityX = deltaX / deltaTimeSeconds;
    const float rawVelocityY = deltaY / deltaTimeSeconds;

    velocityHistoryX.push_back(rawVelocityX);
    velocityHistoryY.push_back(rawVelocityY);
    velocityHistory.push_back(Length(rawVelocityX, rawVelocityY));

    constexpr size_t maxHistory = 5;
    while (velocityHistoryX.size() > maxHistory) {
        velocityHistoryX.erase(velocityHistoryX.begin());
    }
    while (velocityHistoryY.size() > maxHistory) {
        velocityHistoryY.erase(velocityHistoryY.begin());
    }
    while (velocityHistory.size() > maxHistory) {
        velocityHistory.erase(velocityHistory.begin());
    }

    currentVelocityVector.X = Average(velocityHistoryX);
    currentVelocityVector.Y = Average(velocityHistoryY);
    currentVelocity = Average(velocityHistory);
    lastTouchPoint = currentTouch;
    lastTouch = currentTouch.Y;
}

void Reticle::ApplyTouch(float deltaTimeSeconds) {
    Vector2 anchor = {0.0f, 0.0f};
    Vector2 touch = {0.0f, 0.0f};
    Vector2 velocity = {0.0f, 0.0f};
    ReticleConfig localConfig{};
    float width = 0.0f;
    float height = 0.0f;
    int64_t heldMs = 0;

    {
        std::lock_guard<std::mutex> lock(stateMutex);
        anchor = anchorPoint;
        touch = currentTouchPoint;
        velocity = currentVelocityVector;
        localConfig = config;
        width = screenWidth;
        height = screenHeight;
        heldMs = buttonHoldTimer.ElapsedMilliseconds();
    }

    const float reticleX = width * 0.5f;
    const float reticleY = height * 0.5f;
    const float dx = anchor.X - reticleX;
    const float dy = anchor.Y - reticleY;
    const float distanceToAnchor = Length(dx, dy);
    if (distanceToAnchor < localConfig.AnchorDeadzone) {
        return;
    }

    const float brakingRadius = std::max(localConfig.BrakingZoneRadius, 1.0f);
    const float boostRadius = std::max(localConfig.BoostZoneRadius, 1.0f);
    float brakeFactor = Clamp(1.0f - (distanceToAnchor / brakingRadius), 0.0f, 1.0f);
    float boostFactor = Clamp(distanceToAnchor / boostRadius, 0.0f, 1.0f);

    const bool quickTapMode = heldMs > 0 && heldMs < adaptiveThresholdMs;
    brakeFactor *= quickTapMode ? localConfig.TapBrakingFactor : localConfig.HoldBrakingFactor;
    boostFactor *= quickTapMode ? localConfig.TapBoostFactor : localConfig.HoldBoostFactor;

    const bool movingTowardAnchor = IsMovingTowardAnchor(anchor.X - touch.X, anchor.Y - touch.Y);
    const float speed = Length(velocity.X, velocity.Y);
    const float fastSwipeThreshold = std::max(localConfig.MaxVelocityX, localConfig.MaxVelocityY) * 0.6f;
    if (localConfig.OvershootProtectionEnabled && movingTowardAnchor && speed > fastSwipeThreshold) {
        brakeFactor = Clamp(brakeFactor * 1.35f, 0.0f, 1.0f);
        boostFactor = Clamp(boostFactor * 0.35f, 0.0f, 1.0f);
    } else if (speed < fastSwipeThreshold * 0.25f) {
        boostFactor = Clamp(boostFactor * 1.2f, 0.0f, 1.0f);
        brakeFactor = Clamp(brakeFactor * 0.8f, 0.0f, 1.0f);
    }

    const float brakeSmoothness = std::max(localConfig.BrakeSmoothness, 1.0f);
    const float boostSmoothness = std::max(localConfig.BoostSmoothness, 1.0f);
    const float maxVelocityX = std::max(localConfig.MaxVelocityX, 0.0f);
    const float maxVelocityY = std::max(localConfig.MaxVelocityY, 0.0f);
    const float missingVelocityX = std::max(maxVelocityX - std::fabs(velocity.X), 0.0f);
    const float missingVelocityY = std::max(maxVelocityY - std::fabs(velocity.Y), 0.0f);

    float stepBrakeX = (std::fabs(velocity.X) * brakeFactor) / brakeSmoothness;
    float stepBrakeY = (std::fabs(velocity.Y) * brakeFactor) / brakeSmoothness;
    stepBrakeX = std::min(stepBrakeX, std::fabs(velocity.X) * 0.3f);
    stepBrakeY = std::min(stepBrakeY, std::fabs(velocity.Y) * 0.3f);

    float stepBoostX = (missingVelocityX * boostFactor) / boostSmoothness;
    float stepBoostY = (missingVelocityY * boostFactor) / boostSmoothness;
    stepBoostX = std::min(stepBoostX, missingVelocityX * 0.3f);
    stepBoostY = std::min(stepBoostY, missingVelocityY * 0.3f);

    stepBrakeX *= std::max(localConfig.Sens, 0.0f) * deltaTimeSeconds;
    stepBrakeY *= std::max(localConfig.Sens, 0.0f) * deltaTimeSeconds;
    stepBoostX *= std::max(localConfig.Sens, 0.0f) * deltaTimeSeconds;
    stepBoostY *= std::max(localConfig.Sens, 0.0f) * deltaTimeSeconds;

    float moveBrakeX = -Sign(velocity.X) * stepBrakeX;
    float moveBrakeY = -Sign(velocity.Y) * stepBrakeY;
    float moveBoostX = Sign(anchor.X - touch.X) * stepBoostX;
    float moveBoostY = Sign(anchor.Y - touch.Y) * stepBoostY;

    if (localConfig.OvershootProtectionEnabled && distanceToAnchor < brakingRadius * 0.35f && movingTowardAnchor) {
        moveBoostX *= 0.25f;
        moveBoostY *= 0.25f;
        moveBrakeX *= 1.25f;
        moveBrakeY *= 1.25f;
    }

    moveBrakeX = Clamp(moveBrakeX, -localConfig.MaxBrakeStep, localConfig.MaxBrakeStep);
    moveBrakeY = Clamp(moveBrakeY, -localConfig.MaxBrakeStep, localConfig.MaxBrakeStep);
    moveBoostX = Clamp(moveBoostX, -localConfig.MaxBoostStep, localConfig.MaxBoostStep);
    moveBoostY = Clamp(moveBoostY, -localConfig.MaxBoostStep, localConfig.MaxBoostStep);

    float moveX = moveBoostX + moveBrakeX;
    float moveY = moveBoostY + moveBrakeY;

    if (localConfig.RemainderEnabled) {
        std::lock_guard<std::mutex> lock(stateMutex);
        moveX += touchMoveRemainder.X;
        moveY += touchMoveRemainder.Y;
        const int sendMoveX = RoundConsistent(moveX);
        const int sendMoveY = RoundConsistent(moveY);
        touchMoveRemainder.X = moveX - static_cast<float>(sendMoveX);
        touchMoveRemainder.Y = moveY - static_cast<float>(sendMoveY);
        moveX = static_cast<float>(sendMoveX);
        moveY = static_cast<float>(sendMoveY);
    }

    const int sendX = static_cast<int>(std::lround(moveX));
    const int sendY = static_cast<int>(std::lround(moveY));
    if (sendX != 0 || sendY != 0) {
        MoveTouch(sendX, sendY);
    }
}

void Reticle::MoveTouch(int dx, int dy) {
    ReticleMoveCallback callback = nullptr;
    void* userData = nullptr;
    bool active = false;
    {
        std::lock_guard<std::mutex> lock(stateMutex);
        active = touchActive && buttonHeld;
        callback = moveCallback;
        userData = moveCallbackUserData;
    }

    if (!active || callback == nullptr) {
        return;
    }

    INPUT input{};
    input.type = 1;
    input.touch.x = dx;
    input.touch.y = dy;
    input.touch.dwFlags = 0x0002;
    input.point.x = dx;
    input.point.y = dy;

    callback(input.touch.x, input.touch.y, userData);
}

void Reticle::ResetState(bool resetAnchor) {
    std::lock_guard<std::mutex> lock(stateMutex);
    currentVelocity = 0.0f;
    currentVelocityVector = {0.0f, 0.0f};
    velocityHistory.clear();
    velocityHistoryX.clear();
    velocityHistoryY.clear();
    touchMoveRemainder = {0.0f, 0.0f};
    hadLastTouch = false;
    if (resetAnchor) {
        anchorPoint = {0.0f, 0.0f};
    }
}

void Reticle::SetConfig(const ReticleConfig& newConfig) {
    std::lock_guard<std::mutex> lock(stateMutex);
    config = newConfig;
}

ReticleConfig Reticle::GetConfig() {
    std::lock_guard<std::mutex> lock(stateMutex);
    return config;
}

void Reticle::SetScreenSize(float width, float height) {
    std::lock_guard<std::mutex> lock(stateMutex);
    screenWidth = std::max(width, 0.0f);
    screenHeight = std::max(height, 0.0f);
}

void Reticle::SetAnchor(float x, float y) {
    std::lock_guard<std::mutex> lock(stateMutex);
    anchorPoint = {x, y};
}

Vector2 Reticle::GetAnchor() {
    std::lock_guard<std::mutex> lock(stateMutex);
    return anchorPoint;
}

const char* Reticle::GetAnchorAddress() {
    return anchorAddress;
}

void Reticle::SetButtonHeld(bool held) {
    std::lock_guard<std::mutex> lock(stateMutex);
    buttonHeld = held;
}

void Reticle::SetTouchState(bool touching, float x, float y) {
    std::lock_guard<std::mutex> lock(stateMutex);
    touchActive = touching;
    currentTouchPoint = {x, y};
    if (!touching) {
        hadLastTouch = false;
    }
}

void Reticle::SetMoveCallback(ReticleMoveCallback callback, void* userData) {
    std::lock_guard<std::mutex> lock(stateMutex);
    moveCallback = callback;
    moveCallbackUserData = userData;
}

void Reticle::UpdateOnce(float deltaTimeSeconds) {
    Vector2 touch = {0.0f, 0.0f};
    {
        std::lock_guard<std::mutex> lock(stateMutex);
        touch = currentTouchPoint;
    }
    UpdateVelocity(touch, deltaTimeSeconds);
    ApplyTouch(deltaTimeSeconds);
}

float Reticle::Clamp(float value, float minValue, float maxValue) {
    return std::max(minValue, std::min(value, maxValue));
}

float Reticle::Sign(float value) {
    if (value > 0.0f) {
        return 1.0f;
    }
    if (value < 0.0f) {
        return -1.0f;
    }
    return 0.0f;
}

float Reticle::Length(float x, float y) {
    return std::sqrt((x * x) + (y * y));
}

float Reticle::Average(const std::vector<float>& values) {
    if (values.empty()) {
        return 0.0f;
    }
    float total = 0.0f;
    for (float value : values) {
        total += value;
    }
    return total / static_cast<float>(values.size());
}

bool Reticle::IsMovingTowardAnchor(float dx, float dy) {
    const float dot = (currentVelocityVector.X * dx) + (currentVelocityVector.Y * dy);
    return dot > 0.0f;
}

int Reticle::RoundConsistent(float value) {
    if (value >= 0.0f) {
        return static_cast<int>(std::floor(value));
    }
    return static_cast<int>(std::ceil(value));
}

ReticleConfig Reticle::DefaultConfig() {
    ReticleConfig defaults{};
    defaults.TouchAssistEnabled = true;
    defaults.AnchorDeadzone = 5.0f;
    defaults.BrakingZoneRadius = 100.0f;
    defaults.BoostZoneRadius = 100.0f;
    defaults.BrakeSmoothness = 24.0f;
    defaults.BoostSmoothness = 24.0f;
    defaults.TapBrakingFactor = 0.85f;
    defaults.HoldBrakingFactor = 1.15f;
    defaults.TapBoostFactor = 1.05f;
    defaults.HoldBoostFactor = 1.0f;
    defaults.MaxVelocityX = 2400.0f;
    defaults.MaxVelocityY = 2400.0f;
    defaults.MaxBrakeStep = 3.0f;
    defaults.MaxBoostStep = 3.0f;
    defaults.RemainderEnabled = true;
    defaults.OvershootProtectionEnabled = true;
    defaults.Sens = 1.0f;
    return defaults;
}

}  // namespace fatx007
