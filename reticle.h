#ifndef FATX007_RETICLE_H
#define FATX007_RETICLE_H

#include "api_reticle.h"

#include <atomic>
#include <chrono>
#include <cstdint>
#include <mutex>
#include <thread>
#include <vector>

namespace fatx007 {

struct Vector2 {
    float X;
    float Y;
};

struct POINT {
    int32_t x;
    int32_t y;
};

struct TOUCHINPUT {
    int32_t x;
    int32_t y;
    uint32_t hSource;
    uint32_t dwID;
    uint32_t dwFlags;
    uint32_t dwMask;
    uint32_t dwTime;
    uintptr_t dwExtraInfo;
    uint32_t cxContact;
    uint32_t cyContact;
};

struct INPUT {
    uint32_t type;
    TOUCHINPUT touch;
    POINT point;
};

class Stopwatch {
public:
    Stopwatch();
    void Start();
    void Stop();
    void Restart();
    void Reset();
    bool IsRunning() const;
    double ElapsedSeconds() const;
    int64_t ElapsedMilliseconds() const;

private:
    using Clock = std::chrono::steady_clock;

    Clock::time_point startedAt_;
    std::chrono::nanoseconds accumulated_;
    bool running_;
};

class Reticle {
public:
    static void Work();
    static void Stop();
    static void Loop();
    static bool ShouldTouch();
    static void UpdateVelocity(const Vector2& currentTouch, float deltaTimeSeconds);
    static void ApplyTouch(float deltaTimeSeconds);
    static void MoveTouch(int dx, int dy);
    static void ResetState(bool resetAnchor);

    static void SetConfig(const ReticleConfig& newConfig);
    static ReticleConfig GetConfig();
    static void SetScreenSize(float width, float height);
    static void SetAnchor(float x, float y);
    static Vector2 GetAnchor();
    static const char* GetAnchorAddress();
    static void SetButtonHeld(bool held);
    static void SetTouchState(bool touching, float x, float y);
    static void SetMoveCallback(ReticleMoveCallback callback, void* userData);
    static void UpdateOnce(float deltaTimeSeconds);

    static Vector2 anchorPoint;
    static const char* anchorAddress;
    static float lastTouch;
    static float currentVelocity;
    static std::vector<float> velocityHistory;
    static Stopwatch frameTimer;
    static Stopwatch buttonHoldTimer;
    static Vector2 touchMoveRemainder;
    static int adaptiveThresholdMs;
    static std::vector<int64_t> recentClicks;

    static Vector2 lastTouchPoint;
    static Vector2 currentTouchPoint;
    static Vector2 currentVelocityVector;
    static std::vector<float> velocityHistoryX;
    static std::vector<float> velocityHistoryY;

private:
    static float Clamp(float value, float minValue, float maxValue);
    static float Sign(float value);
    static float Length(float x, float y);
    static float Average(const std::vector<float>& values);
    static bool IsMovingTowardAnchor(float dx, float dy);
    static int RoundConsistent(float value);
    static ReticleConfig DefaultConfig();

    static std::mutex stateMutex;
    static std::thread workerThread;
    static std::atomic<bool> running;
    static bool touchActive;
    static bool buttonHeld;
    static bool hadLastTouch;
    static float screenWidth;
    static float screenHeight;
    static ReticleConfig config;
    static ReticleMoveCallback moveCallback;
    static void* moveCallbackUserData;
};

}  // namespace fatx007

#endif
