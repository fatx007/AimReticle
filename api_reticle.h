#ifndef FATX007_API_RETICLE_H
#define FATX007_API_RETICLE_H

#include <stdint.h>

#ifndef __cplusplus
#include <stdbool.h>
#endif

#ifdef __cplusplus
extern "C" {
#endif

#if defined(__GNUC__) || defined(__clang__)
#define RETICLE_API __attribute__((visibility("default")))
#else
#define RETICLE_API
#endif

typedef void (*ReticleMoveCallback)(int dx, int dy, void* userData);

typedef struct ReticleVector2 {
    float X;
    float Y;
} ReticleVector2;

typedef struct ReticleConfig {
    bool TouchAssistEnabled;
    float AnchorDeadzone;
    float BrakingZoneRadius;
    float BoostZoneRadius;
    float BrakeSmoothness;
    float BoostSmoothness;
    float TapBrakingFactor;
    float HoldBrakingFactor;
    float TapBoostFactor;
    float HoldBoostFactor;
    float MaxVelocityX;
    float MaxVelocityY;
    float MaxBrakeStep;
    float MaxBoostStep;
    bool RemainderEnabled;
    bool OvershootProtectionEnabled;
    float Sens;
} ReticleConfig;

RETICLE_API void reticle_work(void);
RETICLE_API void reticle_stop(void);
RETICLE_API void reticle_set_config(const ReticleConfig* config);
RETICLE_API ReticleConfig reticle_get_config(void);
RETICLE_API void reticle_set_screen_size(float width, float height);
RETICLE_API void reticle_set_anchor(float x, float y);
RETICLE_API ReticleVector2 reticle_get_anchor(void);
RETICLE_API const char* reticle_get_anchor_address(void);
RETICLE_API void reticle_set_button_held(bool held);
RETICLE_API void reticle_set_touch_state(bool touching, float x, float y);
RETICLE_API void reticle_set_move_callback(ReticleMoveCallback callback, void* userData);
RETICLE_API bool reticle_should_touch(void);
RETICLE_API void reticle_update_once(float deltaTimeSeconds);

#ifdef __cplusplus
}
#endif

#endif
