#include "api_reticle.h"

#include "reticle.h"

extern "C" {

RETICLE_API void reticle_work(void) {
    fatx007::Reticle::Work();
}

RETICLE_API void reticle_stop(void) {
    fatx007::Reticle::Stop();
}

RETICLE_API void reticle_set_config(const ReticleConfig* config) {
    if (config == nullptr) {
        return;
    }
    fatx007::Reticle::SetConfig(*config);
}

RETICLE_API ReticleConfig reticle_get_config(void) {
    return fatx007::Reticle::GetConfig();
}

RETICLE_API void reticle_set_screen_size(float width, float height) {
    fatx007::Reticle::SetScreenSize(width, height);
}

RETICLE_API void reticle_set_anchor(float x, float y) {
    fatx007::Reticle::SetAnchor(x, y);
}

RETICLE_API ReticleVector2 reticle_get_anchor(void) {
    const fatx007::Vector2 anchor = fatx007::Reticle::GetAnchor();
    return ReticleVector2{anchor.X, anchor.Y};
}

RETICLE_API const char* reticle_get_anchor_address(void) {
    return fatx007::Reticle::GetAnchorAddress();
}

RETICLE_API void reticle_set_button_held(bool held) {
    fatx007::Reticle::SetButtonHeld(held);
}

RETICLE_API void reticle_set_touch_state(bool touching, float x, float y) {
    fatx007::Reticle::SetTouchState(touching, x, y);
}

RETICLE_API void reticle_set_move_callback(ReticleMoveCallback callback, void* userData) {
    fatx007::Reticle::SetMoveCallback(callback, userData);
}

RETICLE_API bool reticle_should_touch(void) {
    return fatx007::Reticle::ShouldTouch();
}

RETICLE_API void reticle_update_once(float deltaTimeSeconds) {
    fatx007::Reticle::UpdateOnce(deltaTimeSeconds);
}

}
